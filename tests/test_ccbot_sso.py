"""SSO regressions use disposable mailbox and ticket databases only."""
import concurrent.futures
import hashlib
import os
import sqlite3
import tempfile
import time
import unittest
from unittest.mock import patch

import app as module


class CCBotSSOTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.old = dict(module.app.config)
        self.addCleanup(lambda: module.app.config.update(self.old))
        self.secret = 'test-only-service-secret-not-for-production'
        module.app.config.update(TESTING=True, DATABASE_TYPE='sqlite',
            DATABASE=os.path.join(self.tmp.name, 'mail.sqlite'), SECRET_KEY='isolated-session-secret',
            CCBOT_SSO_SECRET=self.secret, CCBOT_SSO_DB=os.path.join(self.tmp.name, 'tickets.sqlite'))
        module.init_db()
        with sqlite3.connect(module.app.config['DATABASE']) as db:
            db.execute("UPDATE admin_users SET username='tjt740' WHERE id=1")
            db.execute("INSERT INTO admin_users (id, username, password) VALUES (2, 'pink', 'fixture')")
            db.execute('''INSERT INTO admin_access (admin_id, parent_admin_id, is_super_admin,
                permissions, session_version, master_key_hash, admin_level, is_builtin_admin)
                VALUES (2, 1, 0, '["mailbox"]', 0, '', 2, 1)''')
        self.client = module.app.test_client()
        self.binding = 'a' * 64
        self.origin = 'http://localhost:5173'

    def issue(self, username='pink', binding=None, **extra):
        return self.client.post('/auth/ccbot/issue', headers={'Authorization': 'Bearer ' + self.secret}, json={
            'username': username, 'session_id': binding or self.binding,
            'session_expires_at': int(time.time()) + 3600, 'parent_origin': self.origin, **extra})

    def consume(self, ticket, client=None, **extra):
        return (client or self.client).post('/auth/ccbot/consume',
            headers={'Origin': 'http://localhost'}, json={
                'ticket': ticket, 'parent_origin': self.origin, **extra})

    def test_each_account_keeps_own_persisted_permissions(self):
        for username, root in [('tjt740', True), ('pink', False)]:
            response = self.issue(username, binding=hashlib.sha256(username.encode()).hexdigest())
            self.assertEqual(response.status_code, 200)
            ticket = response.json['ticket']
            self.assertEqual(self.consume(ticket).status_code, 200)
            with self.client.session_transaction() as session:
                self.assertEqual(session['admin_username'], username)
                self.assertEqual(session['admin_id'], 1 if root else 2)
            self.assertEqual(self.client.get('/admin/mailbox').status_code, 200)
            self.assertEqual(self.client.get('/admin/api/dashboard').status_code, 200 if root else 403)
            self.assertEqual(self.client.get('/auth/ccbot/status').json['username'], username)
            self.assertEqual(self.consume(ticket).status_code, 403)

    def test_expiry_does_not_expire_established_mail_session(self):
        ticket = self.issue().json['ticket']
        self.assertEqual(self.consume(ticket).status_code, 200)
        with patch('ccbot_sso.time.time', return_value=time.time() + 61):
            self.assertEqual(self.client.get('/auth/ccbot/status').status_code, 200)
        ticket = self.issue().json['ticket']
        with patch('ccbot_sso.time.time', return_value=time.time() + 61):
            self.assertEqual(self.consume(ticket).status_code, 403)

    def test_tickets_consumed_atomically_across_clients(self):
        ticket = self.issue().json['ticket']
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            statuses = list(pool.map(lambda _: self.consume(ticket, module.app.test_client()).status_code, range(4)))
        self.assertEqual(sorted(statuses), [200, 403, 403, 403])

    def test_revoke_invalidates_session_and_unused_tickets(self):
        first = self.issue().json['ticket']
        self.consume(first)
        pending = self.issue().json['ticket']
        response = self.client.post('/auth/ccbot/revoke', headers={'Authorization': 'Bearer ' + self.secret}, json={
            'username': 'pink', 'session_id': self.binding, 'session_expires_at': int(time.time()) + 3600})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.consume(pending).status_code, 403)
        self.assertEqual(self.client.get('/auth/ccbot/status').status_code, 401)
        self.assertEqual(self.client.get('/admin/mailbox').status_code, 302)
        self.assertEqual(self.issue().status_code, 403)

    def test_both_outstanding_attempts_are_usable_and_ticket_not_stored_raw(self):
        one, two = self.issue().json['ticket'], self.issue().json['ticket']
        with sqlite3.connect(module.app.config['CCBOT_SSO_DB']) as db:
            values = str(db.execute('SELECT * FROM tickets').fetchall())
            self.assertNotIn(one, values)
            self.assertNotIn(two, values)
        self.assertEqual(self.consume(one).status_code, 200)
        self.assertEqual(self.consume(two).status_code, 200)

    def test_service_auth_origin_allowlist_and_account_allowlist(self):
        self.assertEqual(self.client.post('/auth/ccbot/issue', json={}).status_code, 403)
        self.assertEqual(self.issue('lhm').status_code, 400)
        self.assertEqual(self.issue(parent_origin='https://attacker.test').status_code, 400)
        self.assertEqual(self.issue(parent_origin='http://localhost:bad').status_code, 400)
        ticket = self.issue().json['ticket']
        self.assertEqual(self.consume(ticket, parent_origin='https://attacker.test').status_code, 403)
        response = self.client.post('/auth/ccbot/consume', headers={'Origin': 'https://attacker.test'},
            json={'ticket': ticket, 'parent_origin': self.origin})
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.consume(ticket).status_code, 200)
        module.app.config['CCBOT_SSO_SECRET'] = ''
        self.assertEqual(self.issue().status_code, 403)
        self.assertEqual(self.client.get('/auth/ccbot/status').status_code, 401)

    def test_password_reset_deleted_account_and_grant_removal(self):
        for change in ("UPDATE admin_access SET session_version=1 WHERE admin_id=2",
                       "UPDATE admin_access SET permissions='[]' WHERE admin_id=2",
                       "DELETE FROM admin_users WHERE id=2"):
            with self.subTest(change=change):
                # Restore fixture identity between checks.
                with sqlite3.connect(module.app.config['DATABASE']) as db:
                    db.execute("UPDATE admin_access SET session_version=0, permissions='[\"mailbox\"]' WHERE admin_id=2")
                ticket = self.issue().json['ticket']
                with sqlite3.connect(module.app.config['DATABASE']) as db:
                    db.execute(change)
                self.assertEqual(self.consume(ticket).status_code, 403)

    def test_bridge_headers_and_no_secret_in_html(self):
        response = self.client.get('/auth/ccbot')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers['Cache-Control'], 'no-store')
        self.assertIn('frame-ancestors', response.headers['Content-Security-Policy'])
        self.assertNotIn(self.secret, response.text)
        self.assertNotIn(self.binding, response.text)
        self.assertEqual(self.client.get('/auth/ccbot/client.js').status_code, 200)
