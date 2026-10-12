"""Server-only Supply adapter. Never log upstream bodies or credentials."""
import json
import os
import re
import tempfile
import time
from datetime import datetime, timezone, timedelta
from email.utils import getaddresses, parsedate_to_datetime
from html.parser import HTMLParser
from pathlib import Path

import requests

API_URL = 'https://api.supply.ink'
TIMEOUT = 25
MAX_RESPONSE_BYTES = 4 * 1024 * 1024
DEFAULT_MAIL_LIMIT = 5
MAX_MAIL_LIMIT = 20
ERRORS = {
    'auth': (502, '邮件服务凭证已失效，请联系管理员更新'),
    'missing': (404, '当前邮件服务授权范围内未找到该邮箱'),
    'rate': (429, '邮件服务请求过于频繁，请稍后重试'),
    'timeout': (504, '邮件获取超时，请稍后重试'),
    'network': (502, '邮件服务暂时无法连接，请稍后重试'),
    'invalid': (502, '邮件服务响应格式错误'),
    'storage': (500, '邮件服务配置读写失败，请联系管理员'),
}


class SupplyError(Exception):
    def __init__(self, code):
        self.code = code
        self.status, self.message = ERRORS[code]
        super().__init__(self.message)


def validate_token_input(value):
    if not isinstance(value, str):
        raise ValueError('Token 必须为 16–512 个可见 ASCII 字符')
    token = value.strip()
    if not re.fullmatch(r'[\x21-\x7e]{16,512}', token):
        raise ValueError('Token 必须为 16–512 个可见 ASCII 字符')
    return token


def validate_mail_limit(value):
    if type(value) is not int or not 1 <= value <= MAX_MAIL_LIMIT:
        raise ValueError('邮件数量必须为 1–20 的整数')
    return value


def load_token(path):
    try:
        data = json.loads(Path(path).read_text(encoding='utf-8'))
        return validate_token_input(data['token'])
    except FileNotFoundError:
        return None
    except (OSError, ValueError, KeyError, TypeError):
        raise SupplyError('storage') from None


def save_token(path, token):
    """Atomic replacement; failed validation/writes leave the old token intact."""
    path = Path(path)
    temporary = None
    try:
        path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        fd, temporary = tempfile.mkstemp(prefix='.token-', dir=path.parent)
        with os.fdopen(fd, 'w', encoding='utf-8') as stream:
            json.dump({'token': token}, stream)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    except OSError:
        raise SupplyError('storage') from None
    finally:
        if temporary and os.path.exists(temporary):
            os.unlink(temporary)


class Client:
    def __init__(self, token):
        self.token = token  # One immutable snapshot per lookup, including pagination.
        self.deadline = time.monotonic() + TIMEOUT

    def post(self, endpoint, payload):
        remaining = self.deadline - time.monotonic()
        if remaining <= 0:
            raise SupplyError('timeout')
        try:
            with requests.post(API_URL + endpoint, json=payload, headers={
                'Token': self.token, 'Origin': 'https://admin.supply.ink',
                'Referer': 'https://admin.supply.ink/', 'User-Agent': 'Mozilla/5.0',
                'Accept': '*/*',
            }, timeout=(min(5, remaining), remaining), stream=True, allow_redirects=False) as response:
                if response.status_code in (401, 403):
                    raise SupplyError('auth')
                if response.status_code == 429:
                    raise SupplyError('rate')
                if not 200 <= response.status_code < 300:
                    raise SupplyError('network')
                body = bytearray()
                for chunk in response.iter_content(16384):
                    if time.monotonic() >= self.deadline:
                        raise SupplyError('timeout')
                    body.extend(chunk)
                    if len(body) > MAX_RESPONSE_BYTES:
                        raise SupplyError('invalid')
                data = json.loads(body)
        except requests.Timeout:
            raise SupplyError('timeout') from None
        except requests.RequestException:
            raise SupplyError('network') from None
        except (ValueError, UnicodeError):
            raise SupplyError('invalid') from None
        if time.monotonic() >= self.deadline:
            raise SupplyError('timeout')
        if not isinstance(data, dict):
            raise SupplyError('invalid')
        code = str(data.get('code'))
        if code in ('401', '403'):
            raise SupplyError('auth')
        if code == '429':
            raise SupplyError('rate')
        if endpoint == '/supply/getMail' and code == '1005':
            return []
        if code != '200':
            raise SupplyError('invalid')
        return data.get('data')

    @staticmethod
    def rows(data, allow_empty=False):
        if data is None and allow_empty:
            return []
        rows = data if isinstance(data, list) else (
            data.get('list', data.get('rows')) if isinstance(data, dict) else None)
        if not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows):
            raise SupplyError('invalid')
        return rows

    def validate(self):
        self.rows(self.post('/supply/require', {'page': 1, 'limit': 1}))

    def find_account(self, email):
        def match(rows):
            for row in rows:
                address = row.get('username') or row.get('email') or row.get('account')
                if isinstance(address, str) and address.strip().lower() == email:
                    account_id = row.get('id')
                    if isinstance(account_id, bool) or not isinstance(account_id, (str, int)) or account_id == '':
                        raise SupplyError('invalid')
                    return account_id
            return None

        account_id = match(self.rows(self.post('/supply/require', {'page': 1, 'limit': 50, 'username': email})))
        if account_id is not None:
            return account_id
        for page in range(1, 6):
            data = self.post('/supply/require', {'page': page, 'limit': 200})
            rows = self.rows(data)
            account_id = match(rows)
            if account_id is not None:
                return account_id
            total = data.get('total') if isinstance(data, dict) else None
            if len(rows) < 200 or (isinstance(total, (int, float)) and page * 200 >= total):
                break
        raise SupplyError('missing')

    def fetch(self, email, limit=DEFAULT_MAIL_LIMIT):
        limit = validate_mail_limit(limit)
        account_id = self.find_account(email)
        payload = {'id': account_id}
        if limit > 10:
            payload['number'] = limit
        rows = self.rows(self.post('/supply/getMail', payload), allow_empty=True)
        messages = []
        used_ids = set()
        for index, row in enumerate(rows):
            mail = normalize_mail(row, index)
            # Do not disclose a message explicitly addressed to another mailbox.
            recipients = [address.lower() for _, address in getaddresses([mail['to']]) if address]
            if recipients and email not in recipients:
                continue
            base_id = mail['id']
            suffix = 1
            while mail['id'] in used_ids:
                mail['id'] = f'{base_id}-{suffix}'
                suffix += 1
            used_ids.add(mail['id'])
            messages.append(mail)
        messages.sort(key=lambda item: item['date'], reverse=True)
        return {'success': True, 'email': email, 'mails': messages[:limit], 'total': len(messages), 'limit': limit,
                'fetchedAt': datetime.now(timezone.utc).isoformat(), 'provider': 'supply'}


class PlainText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.hidden = 0

    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style', 'head'):
            self.hidden += 1
        if not self.hidden and tag in ('p', 'div', 'br', 'li', 'tr', 'hr'):
            self.parts.append('\n')

    def handle_endtag(self, tag):
        if tag in ('script', 'style', 'head'):
            self.hidden = max(0, self.hidden - 1)
        if not self.hidden and tag in ('p', 'div', 'li', 'tr'):
            self.parts.append('\n')

    def handle_data(self, value):
        if not self.hidden:
            self.parts.append(value)


def text(value):
    return value if isinstance(value, str) else ''


def normalize_date(value):
    try:
        if isinstance(value, bool) or value is None or value == '':
            return ''
        if isinstance(value, (int, float)) or re.fullmatch(r'\d+(?:\.\d+)?', str(value)):
            stamp = float(value)
            date = datetime.fromtimestamp(stamp / 1000 if stamp > 1e11 else stamp, timezone.utc)
        else:
            try:
                date = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
            except ValueError:
                date = parsedate_to_datetime(str(value))
            if date.tzinfo is None:
                date = date.replace(tzinfo=timezone(timedelta(hours=8)))
        return date.astimezone(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')
    except (ValueError, TypeError, OverflowError, OSError):
        return ''


def normalize_mail(row, index):
    def first(*keys):
        return next((row[key] for key in keys if row.get(key) not in (None, '')), '')

    body = text(first('content', 'body', 'text'))
    if re.search(r'</?[a-zA-Z][^>]*>', body):
        parser = PlainText()
        parser.feed(body)
        body = re.sub(r'\n[ \t]*\n+', '\n\n', ''.join(parser.parts)).strip()
    date = normalize_date(first('createTime', 'createdAt', 'sendTime', 'date', 'time'))
    subject = text(first('subject', 'title'))
    sender = text(first('from', 'sender', 'senderEmail'))
    if not sender:
        name, address = text(row.get('from_name')), text(row.get('from_email'))
        sender = f'{name} <{address}>' if name and address else name or address
    return {'id': str(row.get('id') if row.get('id') is not None else f'{date}:{subject}:{index}'),
            'subject': subject, 'body': body, 'body_type': 'text', 'date': date,
            'from': sender, 'to': text(first('to', 'recipient', 'email')), 'folder': 'inbox'}
