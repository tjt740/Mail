import os
import sqlite3
import tempfile
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch

import app as app_module


class MailboxDeduplicationTestCase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = os.path.join(self.tmp.name, 'dedup.sqlite')
        self.previous = {k: app_module.app.config.get(k) for k in ('DATABASE', 'DATABASE_TYPE', 'TESTING')}
        app_module.app.config.update(DATABASE=self.path, DATABASE_TYPE='sqlite', TESTING=True)
        app_module.init_db()
        with sqlite3.connect(self.path) as db:
            db.execute("UPDATE admin_users SET username = 'root' WHERE id = 1")
            db.execute("INSERT INTO mailbox_groups(id, name, created_by_admin) VALUES (1, 'A', 'root'), (2, 'B', 'root')")
        self.client = self.client_for(1)

    def tearDown(self):
        app_module.app.config.update(self.previous)
        self.tmp.cleanup()

    def client_for(self, admin_id):
        client = app_module.app.test_client()
        with sqlite3.connect(self.path) as db:
            username, version = db.execute('''SELECT u.username, a.session_version FROM admin_users u
                JOIN admin_access a ON a.admin_id=u.id WHERE u.id=?''', (admin_id,)).fetchone()
        with client.session_transaction() as session:
            session.update(admin_logged_in=True, admin_id=admin_id, admin_username=username, admin_session_version=version)
        return client

    def seed(self, emails):
        # Simulate a pre-upgrade database. No production records are modified.
        with sqlite3.connect(self.path) as db:
            db.execute('DROP TRIGGER prevent_duplicate_mailbox_insert')
            for address, owner in emails:
                db.execute('''INSERT INTO mail_accounts(email, username, password, server, port, created_by_admin)
                    VALUES (?, ?, 'original-password', 'imap.example.com', 993, ?)''', (address, address.strip(), owner))
            app_module.ensure_mailbox_email_guards(db, 'sqlite')

    def add(self, email, client=None, **extra):
        return (client or self.client).post('/admin/api/mailbox', json={
            'action': 'add', 'email': email, 'password': 'new-password', 'server': 'imap.example.com', 'port': 993, **extra,
        }).get_json()

    def batch(self, content, client=None, **extra):
        return (client or self.client).post('/admin/api/mailbox', json={
            'action': 'batch_add', 'batch_content': content, 'server': 'imap.example.com', 'port': 993, **extra,
        }).get_json()

    def test_single_import_rejects_case_space_and_cross_group_duplicates(self):
        self.seed([(' Existing@Example.com ', 'root')])
        with sqlite3.connect(self.path) as db:
            db.execute('INSERT INTO mailbox_group_mappings(mailbox_id,group_id) VALUES (1,1)')
        for address, extra in [('existing@example.com', {}), (' EXISTING@example.com ', {'group_id': 2}),
                               ('', {'import_content': 'existing@example.com----changed-password', 'group_id': 2})]:
            result = self.add(address, **extra)
            self.assertFalse(result['success'], result)
            self.assertIn('重复', result['message'])
        with sqlite3.connect(self.path) as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM mail_accounts').fetchone()[0], 1)
            self.assertEqual(db.execute('SELECT password FROM mail_accounts').fetchone()[0], 'original-password')
            self.assertEqual(db.execute('SELECT group_id FROM mailbox_group_mappings').fetchall(), [(1,)])

    def test_batch_reports_database_and_in_batch_duplicates_without_overwriting(self):
        self.seed([('existing@example.com', 'root')])
        result = self.batch('existing@example.com----new\nNew@Example.com----first\n NEW@example.com----second\ninvalid\nother@example.com----valid', group_id=2)
        self.assertTrue(result['success'], result)
        self.assertEqual(result['details']['success_count'], 2)
        self.assertEqual(result['details']['duplicate_count'], 2)
        self.assertEqual(result['details']['error_count'], 1)
        self.assertEqual(len(result['details']['created_mailboxes']), 2)
        with sqlite3.connect(self.path) as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM mail_accounts').fetchone()[0], 3)
            self.assertEqual(db.execute("SELECT password FROM mail_accounts WHERE LOWER(email)='new@example.com'").fetchone()[0], 'first')
            self.assertEqual(db.execute('SELECT COUNT(*) FROM mailbox_group_mappings').fetchone()[0], 2)

    def test_scoped_admin_imports_new_mail_but_cannot_duplicate_an_inaccessible_address(self):
        self.seed([('private@example.com', 'root')])
        response = self.client.post('/admin/api/system-config', json={
            'action': 'add_admin', 'admin_username': 'child', 'admin_password': 'password123', 'permissions': ['mailbox'],
        }).get_json()
        child = self.client_for(response['data']['id'])
        result = self.batch('PRIVATE@example.com----new\nchild@example.com----pass', client=child, group_id=None)
        self.assertEqual(result['details']['success_count'], 1, result)
        self.assertEqual(result['details']['duplicate_count'], 1)
        self.assertNotIn('root', result['message'])
        rows = child.get('/admin/api/mailbox').get_json()['data']
        self.assertEqual([r['email'] for r in rows], ['child@example.com'])

    def test_list_search_and_pagination_deduplicate_after_permissions(self):
        response = self.client.post('/admin/api/system-config', json={
            'action': 'add_admin', 'admin_username': 'child', 'admin_password': 'password123', 'permissions': ['mailbox'],
        }).get_json()
        child = self.client_for(response['data']['id'])
        self.seed([('same@example.com', 'root'), (' SAME@EXAMPLE.COM ', 'child'), ('other@example.com', 'child')])
        for url in ['/admin/api/mailbox', '/admin/api/mailbox/search?q=example.com']:
            separator = '&' if '?' in url else '?'
            first = self.client.get(url + separator + 'per_page=1&page=1').get_json()
            second = self.client.get(url + separator + 'per_page=1&page=2').get_json()
            self.assertEqual(first['pagination']['total'], 2)
            self.assertEqual([r['id'] for r in first['data']], [1])
            self.assertEqual([r['id'] for r in second['data']], [3])
            rows = child.get(url).get_json()['data']
            self.assertEqual([r['id'] for r in rows], [2, 3])
        raw = child.get('/admin/api/mailbox?include_legacy_duplicates=1').get_json()['data']
        self.assertEqual([r['id'] for r in raw], [2, 3])
        fast = self.client.get('/admin/api/mailbox?fast=1').get_json()['data']
        self.assertEqual([r['id'] for r in fast], [1, 3])

    def test_edit_rejects_collision_but_allows_credentials_on_legacy_duplicate(self):
        self.seed([('same@example.com', 'root'), ('SAME@example.com', 'root'), ('other@example.com', 'root')])
        base = {'action': 'edit', 'password': 'updated', 'server': 'imap.example.com', 'port': 993}
        result = self.client.post('/admin/api/mailbox', json={**base, 'id': 3, 'email': ' same@example.com '}).get_json()
        self.assertFalse(result['success'])
        result = self.client.post('/admin/api/mailbox', json={**base, 'id': 2, 'email': 'same@example.com'}).get_json()
        self.assertTrue(result['success'], result)
        with sqlite3.connect(self.path) as db:
            self.assertEqual(db.execute('SELECT email FROM mail_accounts WHERE id=3').fetchone()[0], 'other@example.com')
            self.assertEqual(db.execute('SELECT password FROM mail_accounts WHERE id=2').fetchone()[0], 'updated')

    def test_atomic_database_guards_retain_existing_rows_and_survive_reinstallation(self):
        self.seed([('same@example.com', 'root'), ('SAME@example.com', 'root'), ('other@example.com', 'root')])
        with sqlite3.connect(self.path) as db:
            app_module.ensure_mailbox_email_guards(db, 'sqlite')
            for sql in ["INSERT INTO mail_accounts(email,username,password,server,port) VALUES (' Same@example.com ', 'x','x','x',993)",
                        "UPDATE mail_accounts SET email='same@example.com' WHERE id=3"]:
                with self.assertRaisesRegex(sqlite3.IntegrityError, 'duplicate_mailbox_email'):
                    db.execute(sql)
            self.assertEqual(db.execute('SELECT COUNT(*) FROM mail_accounts').fetchone()[0], 3)

    def test_racing_imports_create_only_one_account(self):
        barrier = threading.Barrier(2)
        original = app_module._mailbox_email_exists

        def competing_check(*args, **kwargs):
            exists = original(*args, **kwargs)
            barrier.wait(timeout=10)
            return exists

        clients = [self.client_for(1), self.client_for(1)]
        with patch.object(app_module, '_mailbox_email_exists', side_effect=competing_check):
            with ThreadPoolExecutor(max_workers=2) as pool:
                results = list(pool.map(lambda item: self.add(item[1], client=item[0]), zip(clients, ['race@example.com', 'RACE@example.com'])))
        self.assertEqual(sum(result['success'] for result in results), 1, results)
        self.assertIn('重复', next(result['message'] for result in results if not result['success']))

    def test_failed_batch_row_does_not_discard_other_valid_rows(self):
        with sqlite3.connect(self.path) as db:
            db.execute("""CREATE TRIGGER reject_fixture BEFORE INSERT ON mail_accounts
                WHEN NEW.email='fail@example.com' BEGIN SELECT RAISE(ABORT, 'fixture failure'); END""")
        result = self.batch('first@example.com----pass\nfail@example.com----pass\nlast@example.com----pass')
        self.assertEqual(result['details']['success_count'], 2, result)
        self.assertEqual(result['details']['error_count'], 1)
        with sqlite3.connect(self.path) as db:
            self.assertEqual(db.execute('SELECT email FROM mail_accounts ORDER BY id').fetchall(), [('first@example.com',), ('last@example.com',)])


if __name__ == '__main__':
    unittest.main()
