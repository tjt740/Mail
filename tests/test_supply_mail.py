import json
import os
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import requests
import app as app_module
import supply_mail

TOKEN = 'fixture-supply-token-only'


class Response:
    def __init__(self, data, status=200):
        self.status_code = status
        self.body = json.dumps(data).encode() if not isinstance(data, bytes) else data

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass

    def iter_content(self, size):
        yield self.body


def ok(data):
    return Response({'code': 200, 'data': data})


def mail_rows():
    return [{'id': 'same', 'subject': f'Message {day}', 'content': '<p>验证码 <b>003821</b></p><script>secret()</script>',
             'createTime': f'2026-10-{day:02}T12:00:00Z', 'from_email': 'sender@example.com',
             'from_name': 'Sender', 'to': 'reader@example.com'} for day in range(1, 9)]


class SupplyClientTests(unittest.TestCase):
    def test_exact_match_normalization_sorting_and_five_message_limit(self):
        with patch.object(supply_mail.requests, 'post', side_effect=[
            ok({'list': [{'id': 1, 'username': 'other@example.com'}, {'id': 'right-id', 'username': ' READER@example.com '}]}),
            ok(mail_rows() + [{'subject': 'Do not disclose', 'to': 'other@example.com'}]),
        ]) as post:
            result = supply_mail.Client(TOKEN).fetch('reader@example.com')
        self.assertEqual([m['subject'] for m in result['mails']], [f'Message {i}' for i in range(8, 3, -1)])
        self.assertEqual(len({m['id'] for m in result['mails']}), 5)
        self.assertEqual(result['total'], 8)
        self.assertEqual(result['mails'][0]['body'], '验证码 003821')
        self.assertEqual(result['mails'][0]['from'], 'Sender <sender@example.com>')
        self.assertEqual(post.call_args.kwargs['json'], {'id': 'right-id'})
        self.assertEqual(post.call_args.kwargs['headers']['Token'], TOKEN)
        self.assertFalse(post.call_args.kwargs['allow_redirects'])

    def test_configurable_limit_and_upstream_number_parameter(self):
        for limit in (1, 5, 10, 20):
            with self.subTest(limit=limit), patch.object(supply_mail.requests, 'post', side_effect=[
                ok([{'id': 1, 'username': 'reader@example.com'}]), ok(mail_rows())]) as post:
                result = supply_mail.Client(TOKEN).fetch('reader@example.com', limit=limit)
                self.assertEqual(len(result['mails']), min(limit, 8))
                self.assertEqual(result['limit'], limit)
                self.assertEqual(post.call_args.kwargs['json'], {'id': 1, **({'number': limit} if limit > 10 else {})})
        for value in (0, 21, True, 1.5, '5', None):
            with self.assertRaises(ValueError):
                supply_mail.Client(TOKEN).fetch('reader@example.com', limit=value)

    def test_fallback_pages_and_id_zero(self):
        unrelated = [{'id': i, 'username': f'{i}@example.com'} for i in range(200)]
        with patch.object(supply_mail.requests, 'post', side_effect=[ok([]), ok({'rows': unrelated, 'total': 201}),
                 ok({'rows': [{'id': 0, 'email': 'reader@example.com'}], 'total': 201}), ok(None)]) as post:
            result = supply_mail.Client(TOKEN).fetch('reader@example.com')
        self.assertEqual(result['mails'], [])
        self.assertEqual([call.kwargs['json'] for call in post.call_args_list], [
            {'page': 1, 'limit': 50, 'username': 'reader@example.com'}, {'page': 1, 'limit': 200},
            {'page': 2, 'limit': 200}, {'id': 0}])

    def test_scan_bound_and_missing(self):
        rows = [{'id': i, 'account': f'other{i}@example.com'} for i in range(200)]
        with patch.object(supply_mail.requests, 'post', return_value=ok(rows)) as post:
            with self.assertRaises(supply_mail.SupplyError) as error:
                supply_mail.Client(TOKEN).fetch('reader@example.com')
        self.assertEqual(error.exception.code, 'missing')
        self.assertEqual(post.call_count, 6)

    def test_errors_are_sanitized_and_1005_is_only_empty_for_getmail(self):
        for response, code in [(Response({'code': 401, 'message': TOKEN}), 'auth'),
                               (Response({}, 403), 'auth'), (Response({}, 429), 'rate'),
                               (Response({}, 500), 'network'), (Response(b'bad json'), 'invalid'),
                               (Response({'code': 1005}), 'invalid'), (ok({'unexpected': []}), 'invalid')]:
            with self.subTest(code=code), patch.object(supply_mail.requests, 'post', return_value=response):
                with self.assertRaises(supply_mail.SupplyError) as error:
                    supply_mail.Client(TOKEN).validate()
                self.assertEqual(error.exception.code, code)
                self.assertNotIn(TOKEN, str(error.exception))
        with patch.object(supply_mail.requests, 'post', side_effect=[ok([{'id': 5, 'account': 'reader@example.com'}]), Response({'code': 1005})]):
            self.assertEqual(supply_mail.Client(TOKEN).fetch('reader@example.com')['mails'], [])

    def test_deadline_and_network_timeout(self):
        with patch.object(supply_mail.requests, 'post', side_effect=requests.Timeout):
            with self.assertRaises(supply_mail.SupplyError) as error:
                supply_mail.Client(TOKEN).validate()
        self.assertEqual(error.exception.code, 'timeout')
        with patch.object(supply_mail.time, 'monotonic', side_effect=[0, 26]), patch.object(supply_mail.requests, 'post') as post:
            with self.assertRaises(supply_mail.SupplyError):
                supply_mail.Client(TOKEN).validate()
            post.assert_not_called()

    def test_date_fallbacks_and_plain_text(self):
        for value in (1760000000, 1760000000000, '1760000000'):
            self.assertEqual(supply_mail.normalize_date(value), '2025-10-09T08:53:20.000Z')
        self.assertEqual(supply_mail.normalize_date('invalid'), '')
        self.assertEqual(supply_mail.normalize_date('2026-10-12 20:00:00'), '2026-10-12T12:00:00.000Z')
        mail = supply_mail.normalize_mail({'title': 'Title', 'text': 'plain < 5 > 2', 'senderEmail': 'sender@example.com'}, 0)
        self.assertEqual(mail['body'], 'plain < 5 > 2')


class SupplyIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / 'private/token.json'
        self.previous = {key: app_module.app.config.get(key) for key in ('DATABASE', 'DATABASE_TYPE', 'TESTING', 'SUPPLY_TOKEN_FILE')}
        app_module.app.config.update(DATABASE=os.path.join(self.tmp.name, 'mail.sqlite'), DATABASE_TYPE='sqlite',
                                     TESTING=True, SUPPLY_TOKEN_FILE=str(self.path))
        app_module.init_db()
        with sqlite3.connect(app_module.app.config['DATABASE']) as db:
            db.execute("UPDATE admin_users SET username='tjt740' WHERE id=1")
        self.owner = app_module.app.test_client()
        self.login(self.owner, 1)
        result = self.owner.post('/admin/api/system-config', json={'action': 'add_admin', 'admin_username': 'other',
            'admin_password': 'fixture-password', 'admin_level': 2, 'permissions': ['settings', 'mailbox', 'master_key']})
        self.other = app_module.app.test_client()
        self.login(self.other, result.get_json()['data']['id'])
        self.public = app_module.app.test_client()

    def login(self, client, admin_id):
        with client.session_transaction() as session:
            session.update(admin_logged_in=True, admin_id=admin_id, admin_session_version=0)

    def tearDown(self):
        app_module.app.config.update(self.previous)
        self.tmp.cleanup()

    def test_owner_only_configuration_read_write_and_hidden_ui(self):
        for client, status in [(self.other, 403), (self.public, 401)]:
            for method in ('get', 'post'):
                response = getattr(client, method)('/admin/api/supply-token', json={'token': TOKEN})
                self.assertEqual(response.status_code, status)
                self.assertIn('no-store', response.headers['Cache-Control'])
        other_page = self.other.get('/legacy/admin/system').get_data(as_text=True)
        owner_page = self.owner.get('/legacy/admin/system').get_data(as_text=True)
        # Both the navigation tab and the entire configuration section must be
        # omitted by the server, even for admins with delegated settings access.
        for marker in ('href="#sec-supply"', 'id="sec-supply"', 'supplyTokenInput'):
            self.assertNotIn(marker, other_page)
            self.assertIn(marker, owner_page)
        # Display names in the session cannot impersonate the persisted owner.
        with self.other.session_transaction() as session:
            session['admin_username'] = 'tjt740'
        self.assertNotIn('href="#sec-supply"', self.other.get('/legacy/admin/system').get_data(as_text=True))
        with patch.object(supply_mail.requests, 'post', return_value=ok([])):
            response = self.owner.post('/admin/api/supply-token', json={'token': ' ' + TOKEN + ' '})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(supply_mail.load_token(self.path), TOKEN)
        self.assertEqual(self.path.stat().st_mode & 0o777, 0o600)
        self.assertEqual(self.path.parent.stat().st_mode & 0o777, 0o700)
        for url in ('/admin/api/supply-token', '/admin/api/system-config', '/legacy/admin/system'):
            self.assertNotIn(TOKEN, self.owner.get(url).get_data(as_text=True))
        with sqlite3.connect(app_module.app.config['DATABASE']) as db:
            db.execute("UPDATE admin_users SET username='renamed' WHERE id=1")
        self.assertEqual(self.owner.get('/admin/api/supply-token').status_code, 403)
        self.assertNotIn('href="#sec-supply"', self.owner.get('/legacy/admin/system').get_data(as_text=True))

    def test_invalid_or_failed_update_preserves_token_and_cross_site_is_rejected(self):
        supply_mail.save_token(self.path, TOKEN)
        with patch.object(supply_mail.requests, 'post', return_value=Response({'code': 401})) as post:
            for candidate in ('short', 'x\ny' * 20, [], 'x' * 513):
                self.assertEqual(self.owner.post('/admin/api/supply-token', json={'token': candidate}).status_code, 400)
            post.assert_not_called()
            response = self.owner.post('/admin/api/supply-token', json={'token': 'different-fixture-token'})
            self.assertEqual(response.status_code, 422)
        for headers in ({'Origin': 'https://foreign.example'}, {'Sec-Fetch-Site': 'cross-site'}):
            self.assertEqual(self.owner.post('/admin/api/supply-token', json={'token': TOKEN}, headers=headers).status_code, 403)
        self.assertEqual(supply_mail.load_token(self.path), TOKEN)
        with patch.object(supply_mail.os, 'replace', side_effect=OSError):
            with self.assertRaises(supply_mail.SupplyError):
                supply_mail.save_token(self.path, 'different-fixture-token')
        self.assertEqual(supply_mail.load_token(self.path), TOKEN)
        self.assertEqual(len(list(self.path.parent.iterdir())), 1)

    def test_token_reveal_requires_explicit_current_owner_request(self):
        response = self.owner.post('/admin/api/supply-token', json={'action': 'reveal'})
        self.assertEqual(response.status_code, 400)
        self.assertNotIn('token', response.get_json())
        supply_mail.save_token(self.path, TOKEN)
        before = self.owner.get('/admin/api/supply-token').get_json()['connection']
        with patch.object(supply_mail.requests, 'post') as upstream:
            response = self.owner.post('/admin/api/supply-token', json={'action': 'reveal'})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.get_json(), {'success': True, 'token': TOKEN})
            self.assertIn('no-store', response.headers['Cache-Control'])
            self.assertIn('private', response.headers['Cache-Control'])
            upstream.assert_not_called()
        self.assertEqual(before, self.owner.get('/admin/api/supply-token').get_json()['connection'])
        self.assertNotIn(TOKEN, self.owner.get('/admin/api/supply-token?action=reveal').get_data(as_text=True))
        for client, status in ((self.other, 403), (self.public, 401)):
            with client.session_transaction() as session:
                session['admin_username'] = 'tjt740'
            response = client.post('/admin/api/supply-token', json={'action': 'reveal'})
            self.assertEqual(response.status_code, status)
            self.assertNotIn(TOKEN, response.get_data(as_text=True))
            self.assertIn('no-store', response.headers['Cache-Control'])
        with patch.object(supply_mail, 'load_token') as load:
            for headers in ({'Origin': 'https://foreign.example'}, {'Sec-Fetch-Site': 'cross-site'}):
                response = self.owner.post('/admin/api/supply-token', json={'action': 'reveal'}, headers=headers)
                self.assertEqual(response.status_code, 403)
                self.assertNotIn(TOKEN, response.get_data(as_text=True))
            load.assert_not_called()

    def test_session_revoked_during_token_read_cannot_reveal_it(self):
        def revoke(path):
            with sqlite3.connect(app_module.app.config['DATABASE']) as db:
                db.execute('UPDATE admin_access SET session_version=session_version+1 WHERE admin_id=1')
            return TOKEN
        with patch.object(supply_mail, 'load_token', side_effect=revoke):
            response = self.owner.post('/admin/api/supply-token', json={'action': 'reveal'})
        self.assertEqual(response.status_code, 403)
        self.assertNotIn(TOKEN, response.get_data(as_text=True))

    def test_frontend_fetches_five_with_current_token_and_keeps_key_authorization(self):
        supply_mail.save_token(self.path, TOKEN)
        upstream = [ok([{'id': 5, 'username': 'reader@example.com'}]), ok(mail_rows())]
        with patch.object(supply_mail.requests, 'post', side_effect=upstream) as post, patch.object(app_module.subprocess, 'run') as run:
            response = self.public.post('/api/get_mail', json={'email': 'READER@example.com', 'email_limit': 200})
            self.assertTrue(response.get_json()['success'], response.get_json())
            self.assertEqual(len(response.get_json()['mails']), 5)
            self.assertIn('no-store', response.headers['Cache-Control'])
            run.assert_not_called()
        next_token = 'replacement-fixture-token'
        supply_mail.save_token(self.path, next_token)
        with patch.object(supply_mail.requests, 'post', side_effect=upstream) as post:
            self.public.post('/api/get_mail', json={'email': 'reader@example.com'})
            self.assertTrue(all(call.kwargs['headers']['Token'] == next_token for call in post.call_args_list))
        self.owner.post('/admin/api/system-config', json={'action': 'update_admin_master_key', 'admin_master_key': 'fixture-master', 'confirm_master_key': 'fixture-master'})
        self.owner.post('/admin/api/system-config', json={'action': 'update_public_mail_key', 'enabled': True})
        with patch.object(supply_mail.requests, 'post') as post:
            for payload in ({}, {'master_key': 'wrong'}, {'admin_access': True}):
                response = self.public.post('/api/get_mail', json={'email': 'reader@example.com', **payload})
                self.assertEqual(response.status_code, 403)
            post.assert_not_called()
        with patch.object(supply_mail.requests, 'post', side_effect=upstream):
            self.assertTrue(self.public.post('/api/get_mail', json={'email': 'reader@example.com', 'master_key': 'fixture-master'}).get_json()['success'])

    def test_scoped_personal_key_cannot_query_an_ungranted_supply_mailbox(self):
        supply_mail.save_token(self.path, TOKEN)
        response = self.other.post('/admin/api/system-config', json={
            'action': 'update_admin_master_key', 'admin_master_key': 'personal-fixture-key',
            'confirm_master_key': 'personal-fixture-key'})
        self.assertTrue(response.get_json()['success'])
        with patch.object(supply_mail.requests, 'post') as post:
            response = self.public.post('/api/get_mail', json={
                'email': 'ungranted@example.com', 'master_key': 'personal-fixture-key'})
            self.assertEqual(response.status_code, 404)
            post.assert_not_called()

    def test_revoked_session_during_validation_cannot_save(self):
        supply_mail.save_token(self.path, TOKEN)
        def revoke(*args, **kwargs):
            with sqlite3.connect(app_module.app.config['DATABASE']) as db:
                db.execute('UPDATE admin_access SET session_version=session_version+1 WHERE admin_id=1')
            return ok([])
        with patch.object(supply_mail.requests, 'post', side_effect=revoke):
            response = self.owner.post('/admin/api/supply-token', json={'token': 'new-fixture-supply-token'})
        self.assertEqual(response.status_code, 403)
        self.assertEqual(supply_mail.load_token(self.path), TOKEN)

    def test_in_flight_query_keeps_token_snapshot_and_next_query_uses_new_value(self):
        supply_mail.save_token(self.path, TOKEN)
        def upstream(url, **kwargs):
            self.assertEqual(kwargs['headers']['Token'], TOKEN)
            if url.endswith('/require'):
                supply_mail.save_token(self.path, 'updated-fixture-token')
                return ok([{'id': 1, 'username': 'reader@example.com'}])
            return ok([])
        with patch.object(supply_mail.requests, 'post', side_effect=upstream):
            response = self.public.post('/api/get_mail', json={'email': 'reader@example.com'})
        self.assertTrue(response.get_json()['success'])
        self.assertEqual(supply_mail.load_token(self.path), 'updated-fixture-token')

    def test_limit_is_owner_only_persisted_and_enforced_on_public_fetches(self):
        supply_mail.save_token(self.path, TOKEN)
        for client, status in ((self.other, 403), (self.public, 401)):
            for action in ('settings', 'test', 'preview'):
                response = client.post('/admin/api/supply-token', json={'action': action, 'email_limit': 3, 'email': 'reader@example.com'})
                self.assertEqual(response.status_code, status)
        with patch.object(supply_mail.requests, 'post') as post:
            response = self.owner.post('/admin/api/supply-token', json={'action': 'settings', 'email_limit': 3})
            self.assertEqual(response.get_json()['email_limit'], 3)
            post.assert_not_called()
            for value in (0, 21, True, 1.5, '5', None):
                self.assertEqual(self.owner.post('/admin/api/supply-token', json={'action': 'settings', 'email_limit': value}).status_code, 400)
        self.assertEqual(self.owner.get('/admin/api/supply-token').get_json()['email_limit'], 3)
        self.assertEqual(self.public.get('/api/public-mail-config').get_json()['email_limit'], 3)
        with patch.object(supply_mail.requests, 'post', side_effect=[ok([{'id': 1, 'username': 'reader@example.com'}]), ok(mail_rows())]):
            response = self.public.post('/api/get_mail', json={'email': 'reader@example.com', 'email_limit': 20})
        self.assertEqual(len(response.get_json()['mails']), 3)

    def test_connection_result_survives_reload_and_is_tied_to_the_tested_token(self):
        with patch.object(supply_mail.requests, 'post', return_value=ok([])):
            response = self.owner.post('/admin/api/supply-token', json={'token': TOKEN})
        connection = response.get_json()['connection']
        self.assertEqual(connection['status'], 'connected')
        self.assertEqual(connection['stage'], 'token')
        self.assertGreaterEqual(connection['latency_ms'], 0)
        self.assertTrue(connection['checked_at'])
        state = self.owner.get('/admin/api/supply-token').get_json()
        self.assertEqual(state['connection'], connection)
        self.assertNotIn('token_digest', json.dumps(state))
        self.assertNotIn(TOKEN, json.dumps(state))
        with patch.object(supply_mail.requests, 'post', side_effect=requests.Timeout):
            response = self.owner.post('/admin/api/supply-token', json={'action': 'test'})
        self.assertEqual(response.status_code, 504)
        self.assertEqual(response.get_json()['connection']['status'], 'failed')
        self.assertEqual(self.owner.get('/admin/api/supply-token').get_json()['connection']['status'], 'failed')
        supply_mail.save_token(self.path, 'replacement-fixture-token')
        self.assertEqual(self.owner.get('/admin/api/supply-token').get_json()['connection']['status'], 'untested')

    def test_preview_uses_saved_token_and_unsaved_limit_without_changing_settings(self):
        supply_mail.save_token(self.path, TOKEN)
        with patch.object(supply_mail.requests, 'post', side_effect=[ok([{'id': 'preview-id', 'username': 'reader@example.com'}]), ok(mail_rows())]) as post:
            response = self.owner.post('/admin/api/supply-token', json={'action': 'preview', 'email': ' READER@example.com ', 'email_limit': 2})
        payload = response.get_json()
        self.assertTrue(payload['success'])
        self.assertEqual([mail['subject'] for mail in payload['mails']], ['Message 8', 'Message 7'])
        self.assertEqual(payload['connection']['status'], 'connected')
        self.assertEqual(payload['connection']['stage'], 'mail')
        self.assertEqual(self.owner.get('/admin/api/supply-token').get_json()['email_limit'], 5)
        self.assertTrue(all(call.kwargs['headers']['Token'] == TOKEN for call in post.call_args_list))
        with sqlite3.connect(app_module.app.config['DATABASE']) as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM admin_mail_logs').fetchone()[0], 0)
        with patch.object(supply_mail.requests, 'post') as post:
            for email in ('bad address', [], None):
                self.assertEqual(self.owner.post('/admin/api/supply-token', json={'action': 'preview', 'email': email}).status_code, 400)
            post.assert_not_called()
        with patch.object(supply_mail.requests, 'post', side_effect=[ok([{'id': 1, 'username': 'reader@example.com'}]), ok(None)]):
            response = self.owner.post('/admin/api/supply-token', json={'action': 'preview', 'email': 'reader@example.com'})
        self.assertEqual(response.get_json()['mails'], [])
        self.assertEqual(response.get_json()['connection']['status'], 'connected')

    def test_corrupt_configuration_does_not_silently_fall_back(self):
        self.path.parent.mkdir()
        self.path.write_text('broken')
        with patch.object(app_module.subprocess, 'run') as run:
            response = self.public.post('/api/get_mail', json={'email': 'reader@example.com'})
            self.assertEqual(response.get_json()['code'], 'storage')
            run.assert_not_called()


if __name__ == '__main__':
    unittest.main()
