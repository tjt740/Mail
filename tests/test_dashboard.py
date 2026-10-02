import json
import os
import sqlite3
import tempfile
import unittest
from unittest.mock import patch
import app as app_module


class DashboardTestCase(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = os.path.join(self.temp.name, 'dashboard.sqlite')
        self.previous = {key: app_module.app.config.get(key) for key in ('DATABASE', 'DATABASE_TYPE', 'TESTING')}
        app_module.app.config.update(DATABASE=self.path, DATABASE_TYPE='sqlite', TESTING=True)
        app_module.init_db()
        self.root = self.client_for(1)
        response = self.root.post('/admin/api/system-config', json={
            'action': 'add_admin', 'admin_username': 'viewer', 'admin_password': 'fixture-password',
            'permissions': ['home', 'mail_logs', 'mailbox'], 'admin_level': 2,
        })
        self.assertEqual(response.status_code, 200, response.get_json())
        self.viewer_id = response.get_json()['data']['id']
        self.viewer = self.client_for(self.viewer_id)
        with sqlite3.connect(self.path) as db:
            for mailbox_id, owner, status in ((1, 'viewer', 'normal'), (2, 'viewer', 'network_error'), (3, 'root', 'banned')):
                db.execute('''INSERT INTO mail_accounts(id, email, username, password, server, port, created_by_admin, account_status)
                    VALUES (?, ?, 'fixture', 'DO-NOT-EXPOSE', 'imap.example.com', 993, ?, ?)''',
                    (mailbox_id, f'mail{mailbox_id}@example.com', owner, status))
            for email, status, when in [
                ('mail1@example.com', 'received', '2026-10-02 00:00:00'),
                ('mail2@example.com', 'failed', '2026-09-26 12:00:00'),
                ('mail3@example.com', 'failed', '2026-10-02 12:00:00'),
                ('mail1@example.com', 'received', '2026-09-25 23:59:59'),
                ('mail1@example.com', 'received', '2026-10-03 00:00:00'),
            ]:
                db.execute("INSERT INTO mail_logs(email, status, created_at, mail_body, error_message) VALUES (?, ?, ?, 'SECRET-BODY', 'SECRET-ERROR')", (email, status, when))
            db.execute("INSERT INTO http_proxies(name, host, port, status, last_check, response_time) VALUES ('fixture', '127.0.0.1', 9999, 1, '2026-10-02', 120)")
            db.execute("INSERT INTO socks5_proxies(name, host, port, status) VALUES ('fixture', '127.0.0.1', 9998, 0)")
            db.execute("INSERT INTO cards(card_key, usage_limit, used_count, status) VALUES ('SECRET-CARD', 10, 2, 1)")
        self.time_patch = patch.object(app_module, 'get_beijing_time', return_value='2026-10-02 16:00:00')
        self.time_patch.start()

    def tearDown(self):
        self.time_patch.stop()
        app_module.app.config.update(self.previous)
        self.temp.cleanup()

    def client_for(self, admin_id):
        client = app_module.app.test_client()
        with sqlite3.connect(self.path) as db:
            username, version = db.execute('SELECT u.username, a.session_version FROM admin_users u JOIN admin_access a ON a.admin_id=u.id WHERE u.id=?', (admin_id,)).fetchone()
        with client.session_transaction() as session:
            session.update(admin_logged_in=True, admin_id=admin_id, admin_username=username, admin_session_version=version)
        return client

    def test_snapshot_scopes_health_logs_and_dates_and_hides_ungranted_panels(self):
        response = self.viewer.get('/admin/api/dashboard')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers['Cache-Control'], 'no-store')
        data = response.get_json()
        self.assertEqual(data['mailboxes']['total'], 2)
        self.assertEqual(data['mailboxes']['health']['normal'], 1)
        self.assertEqual(data['mailboxes']['health']['banned'], 0)
        self.assertEqual(len(data['trend']), 7)
        self.assertEqual(data['trend'][0]['day'], '2026-09-26')
        self.assertEqual(sum(row['received'] for row in data['trend']), 1)
        self.assertEqual(sum(row['failed'] for row in data['trend']), 1)
        self.assertEqual([row['email'] for row in data['recent_failures']], ['mail2@example.com'])
        for key in ('proxies', 'cards', 'poller'):
            self.assertIsNone(data[key])
        for secret in ('DO-NOT-EXPOSE', 'SECRET-BODY', 'SECRET-ERROR', 'SECRET-CARD', 'mail3@example.com'):
            self.assertNotIn(secret, response.get_data(as_text=True))

    def test_root_resources_use_enabled_status_and_measured_latency(self):
        data = self.root.get('/admin/api/dashboard').get_json()
        self.assertEqual(data['mailboxes']['total'], 3)
        self.assertEqual(data['proxies'], {'total': 2, 'enabled': 1, 'tested': 1, 'latency_ms': 120})
        self.assertEqual(data['cards']['active'], 1)
        self.assertIsInstance(data['poller']['enabled'], bool)
        self.assertNotIn('backoff', data['poller'])

    def test_revocation_and_signed_out_requests_are_denied(self):
        self.assertEqual(app_module.app.test_client().get('/admin/api/dashboard').status_code, 401)
        self.root.post('/admin/api/system-config', json={'action': 'update_admin_permissions', 'admin_id': self.viewer_id, 'permissions': ['mailbox']})
        self.assertEqual(self.viewer.get('/admin/api/dashboard').status_code, 403)

    def test_no_log_permission_is_unavailable_not_zero_and_empty_health_has_no_fake_success(self):
        self.root.post('/admin/api/system-config', json={'action': 'update_admin_permissions', 'admin_id': self.viewer_id, 'permissions': ['home']})
        with sqlite3.connect(self.path) as db:
            db.execute("DELETE FROM mail_accounts WHERE created_by_admin='viewer'")
        data = self.viewer.get('/admin/api/dashboard').get_json()
        self.assertEqual(data['mailboxes']['total'], 0)
        self.assertIsNone(data['trend'])
        self.assertIsNone(data['recent_failures'])

    def test_home_html_does_not_embed_global_counts_or_credentials(self):
        response = self.viewer.get('/legacy/admin/home?embedded=1')
        self.assertEqual(response.status_code, 200)
        self.assertIn('monitorScene', response.get_data(as_text=True))
        self.assertNotIn('SECRET-CARD', response.get_data(as_text=True))


if __name__ == '__main__':
    unittest.main()
