"""CC Bot bridge: one-use tickets, existing mail permissions, revocable sessions.

The private ticket ledger is separate from mailbox data and shared by all workers
on this host. No password, CC Bot bearer token, or service secret is stored in it.
"""
import hashlib
import hmac
import os
import re
import secrets
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path
from urllib.parse import urlsplit

from flask import jsonify, request, session, render_template, send_file

ALLOWED_USERS = frozenset(('tjt740', 'pink'))
TICKET_TTL = 60
MAX_SESSION_TTL = 7 * 24 * 3600


def register(app, get_db, security):
    app.config.setdefault('CCBOT_SSO_SECRET', os.environ.get('CCBOT_SSO_SECRET', ''))
    app.config.setdefault('CCBOT_SSO_PARENT_ORIGINS', os.environ.get(
        'CCBOT_SSO_PARENT_ORIGINS', 'https://heihei.it,https://47.106.176.71'))
    app.config.setdefault('CCBOT_SSO_DB', os.environ.get('CCBOT_SSO_DB', str(
        Path(app.root_path) / 'db' / 'ccbot-sso.sqlite')))

    def allowed_origin(value):
        try:
            p = urlsplit(value)
            if p.path or p.query or p.fragment or p.username or p.password or not p.hostname:
                return False
            p.port  # Reject malformed ports.
            local = p.scheme == 'http' and p.hostname in ('localhost', '127.0.0.1')
            return local or value in [x.strip() for x in app.config['CCBOT_SSO_PARENT_ORIGINS'].split(',') if x.strip()]
        except (TypeError, ValueError):
            return False

    def enabled():
        return len(app.config['CCBOT_SSO_SECRET'].strip()) >= 32

    def trusted_service():
        expected = app.config['CCBOT_SSO_SECRET'].strip()
        return enabled() and hmac.compare_digest(
            request.headers.get('Authorization', '').encode(), ('Bearer ' + expected).encode())

    @contextmanager
    def ledger():
        path = Path(app.config['CCBOT_SSO_DB'])
        path.parent.mkdir(parents=True, exist_ok=True)
        # Create with private permissions even on the first request.
        fd = os.open(str(path), os.O_CREAT | os.O_RDWR, 0o600)
        os.close(fd)
        db = sqlite3.connect(str(path), timeout=5)
        db.row_factory = sqlite3.Row
        try:
            db.execute('''CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY, username TEXT NOT NULL, expires INTEGER NOT NULL,
                revoked INTEGER NOT NULL DEFAULT 0)''')
            db.execute('''CREATE TABLE IF NOT EXISTS tickets (
                digest TEXT PRIMARY KEY, session_id TEXT NOT NULL, username TEXT NOT NULL,
                admin_id INTEGER NOT NULL, version INTEGER NOT NULL,
                parent_origin TEXT NOT NULL, expires INTEGER NOT NULL)''')
            with db:
                yield db
        finally:
            db.close()

    def actor_for(username):
        return next((p for p in security.profiles(get_db()).values() if p['username'] == username), None)

    def identity_body():
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return None
        username, binding, expiry = data.get('username'), data.get('session_id'), data.get('session_expires_at')
        if (username not in ALLOWED_USERS or not isinstance(binding, str)
                or not re.fullmatch(r'[a-f0-9]{64}', binding) or type(expiry) is not int
                or expiry <= int(time.time())):
            return None
        return username, binding, min(expiry, int(time.time()) + MAX_SESSION_TTL)

    @app.post('/auth/ccbot/issue')
    def ccbot_sso_issue():
        if not trusted_service():
            return jsonify(error='Forbidden'), 403
        identity = identity_body()
        data = request.get_json(silent=True)
        if not identity or not allowed_origin(data.get('parent_origin')):
            return jsonify(error='Invalid request'), 400
        username, binding, expiry = identity
        actor = actor_for(username)
        if not actor or not security.has(get_db(), 'mailbox', actor['id']):
            return jsonify(error='Account unavailable'), 403
        now = int(time.time())
        ticket = secrets.token_urlsafe(32)
        with ledger() as db:
            db.execute('BEGIN IMMEDIATE')
            db.execute('DELETE FROM tickets WHERE expires <= ?', (now,))
            db.execute('DELETE FROM sessions WHERE expires <= ?', (now,))
            existing = db.execute('SELECT * FROM sessions WHERE id = ?', (binding,)).fetchone()
            if existing and (existing['revoked'] or existing['username'] != username):
                return jsonify(error='Session revoked'), 403
            db.execute('INSERT OR IGNORE INTO sessions (id, username, expires) VALUES (?, ?, ?)',
                       (binding, username, expiry))
            # Concurrent tabs/React remounts must not invalidate one another.
            db.execute('INSERT INTO tickets VALUES (?, ?, ?, ?, ?, ?, ?)', (
                hashlib.sha256(ticket.encode()).hexdigest(), binding, username, actor['id'],
                actor['session_version'], data['parent_origin'], min(now + TICKET_TTL, expiry)))
        return jsonify(ticket=ticket, expires_in=TICKET_TTL)

    @app.post('/auth/ccbot/revoke')
    def ccbot_sso_revoke():
        if not trusted_service():
            return jsonify(error='Forbidden'), 403
        identity = identity_body()
        if not identity:
            return jsonify(error='Invalid request'), 400
        username, binding, expiry = identity
        with ledger() as db:
            db.execute('INSERT OR IGNORE INTO sessions (id, username, expires, revoked) VALUES (?, ?, ?, 1)',
                       (binding, username, expiry))
            db.execute('UPDATE sessions SET revoked = 1 WHERE id = ? AND username = ?', (binding, username))
            db.execute('DELETE FROM tickets WHERE session_id = ?', (binding,))
        return jsonify(ok=True)

    def live_session():
        binding = session.get('ccbot_session_id')
        if not enabled() or not isinstance(binding, str):
            return False
        with ledger() as db:
            row = db.execute('SELECT * FROM sessions WHERE id = ?', (binding,)).fetchone()
        return bool(row and not row['revoked'] and row['expires'] > time.time()
                    and row['username'] == session.get('admin_username'))

    @app.before_request
    def validate_ccbot_session():
        if session.get('ccbot_session_id') and not live_session():
            session.clear()

    @app.post('/auth/ccbot/consume')
    def ccbot_sso_consume():
        # JSON plus a same-origin request prevents cross-site form login attacks.
        if not enabled() or not request.is_json or request.headers.get('Origin') != request.host_url.rstrip('/'):
            return jsonify(error='Forbidden'), 403
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return jsonify(error='Invalid request'), 400
        ticket = data.get('ticket')
        if not isinstance(ticket, str) or not re.fullmatch(r'[A-Za-z0-9_-]{43}', ticket):
            return jsonify(error='Invalid ticket'), 400
        with ledger() as db:
            db.execute('BEGIN IMMEDIATE')
            digest = hashlib.sha256(ticket.encode()).hexdigest()
            row = db.execute('SELECT * FROM tickets WHERE digest = ?', (digest,)).fetchone()
            if not row or row['expires'] <= time.time() or row['parent_origin'] != data.get('parent_origin'):
                return jsonify(error='Ticket expired or invalid'), 403
            lease = db.execute('SELECT * FROM sessions WHERE id = ?', (row['session_id'],)).fetchone()
            db.execute('DELETE FROM tickets WHERE digest = ?', (digest,))
            if not lease or lease['revoked'] or lease['expires'] <= time.time():
                return jsonify(error='Session expired'), 403
            actor = actor_for(row['username'])
            if (not actor or actor['id'] != row['admin_id'] or actor['session_version'] != row['version']
                    or not security.has(get_db(), 'mailbox', actor['id'])):
                return jsonify(error='Account unavailable'), 403
            session.clear()
            session.update(admin_logged_in=True, admin_id=actor['id'], admin_username=actor['username'],
                           admin_session_version=actor['session_version'], ccbot_session_id=row['session_id'])
        return jsonify(username=actor['username'], session_id=row['session_id'])

    @app.get('/auth/ccbot/status')
    def ccbot_sso_status():
        actor = security.current(get_db())
        if not actor or not live_session() or not security.has(get_db(), 'mailbox', actor['id']):
            return jsonify(error='Session expired'), 401
        return jsonify(username=actor['username'], session_id=session['ccbot_session_id'])

    @app.get('/auth/ccbot')
    def ccbot_sso_bridge():
        if not enabled():
            return '邮局快捷登录尚未配置', 503
        origins = [x.strip() for x in app.config['CCBOT_SSO_PARENT_ORIGINS'].split(',') if x.strip()]
        response = app.make_response(render_template('ccbot_sso.html', origins=origins))
        response.headers['Content-Security-Policy'] = (
            "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; "
            "connect-src 'self'; frame-src 'self'; base-uri 'none'; form-action 'none'; "
            "frame-ancestors " + ' '.join(origins + ['http://localhost:*', 'http://127.0.0.1:*']))
        return response

    @app.get('/auth/ccbot/client.js')
    def ccbot_sso_client():
        return send_file(Path(app.root_path) / 'static' / 'ccbot-sso.js', mimetype='text/javascript')

    @app.after_request
    def protect_ccbot_sso(response):
        if request.path.startswith('/auth/ccbot'):
            response.headers['Cache-Control'] = 'no-store'
            response.headers['Referrer-Policy'] = 'no-referrer'
            response.headers['X-Content-Type-Options'] = 'nosniff'
        return response
