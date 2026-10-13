import os
import sqlite3
import tempfile
import unittest

import app as app_module


class AdminPaginationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = os.path.join(self.temp.name, 'pagination.sqlite')
        self.previous = {key: app_module.app.config.get(key) for key in ('DATABASE', 'DATABASE_TYPE', 'TESTING')}
        app_module.app.config.update(DATABASE=self.path, DATABASE_TYPE='sqlite', TESTING=True)
        app_module.init_db()
        with sqlite3.connect(self.path) as db:
            for index in range(1, 1108):
                email = f'pagination{index}@example.com'
                db.execute('''INSERT INTO mail_accounts(email, username, password, server, port)
                    VALUES (?, ?, 'fixture', 'imap.example.com', 993)''', (email, email))
                db.execute("INSERT INTO mail_logs(email, status, mail_subject) VALUES (?, 'received', 'fixture')", (email,))
                db.execute("INSERT INTO cards(card_key, usage_limit) VALUES (?, 10)", (f'card-{index}',))
                db.execute("INSERT INTO card_logs(card_id, card_key, bound_email, action) VALUES (?, ?, ?, 'use')", (index, f'card-{index}', email))
                for table in ('http_proxies', 'socks5_proxies'):
                    db.execute(f"INSERT INTO {table}(name, host, port) VALUES (?, '127.0.0.1', 8888)", (f'proxy-{index}',))
        self.client = app_module.app.test_client()
        with self.client.session_transaction() as session:
            session.update(admin_logged_in=True, admin_id=1, admin_session_version=0)

    def tearDown(self):
        app_module.app.config.update(self.previous)
        self.temp.cleanup()

    def fetch_page(self, endpoint, size, page=1):
        response = self.client.get(f'/admin/api/{endpoint}', query_string={'per_page': size, 'page': page})
        self.assertEqual(response.status_code, 200, response.get_json())
        payload = response.get_json()
        self.assertTrue(payload['success'], payload)
        return payload

    def test_all_admin_lists_honor_presets_and_custom_sizes(self):
        for endpoint in ('mailbox', 'mailbox/account-data', 'proxies/http', 'proxies/socks5', 'cards', 'card-logs', 'mail-logs'):
            default = self.client.get(f'/admin/api/{endpoint}').get_json()
            self.assertEqual(default['pagination']['per_page'], 100, endpoint)
            self.assertEqual(len(default['data']), 100, endpoint)
            for size in (20, 50, 100, 200, 500, 1000, 137, 1101, 10000):
                with self.subTest(endpoint=endpoint, size=size):
                    first = self.fetch_page(endpoint, size)
                    self.assertEqual(first['pagination']['per_page'], size)
                    self.assertEqual(first['pagination']['total'], 1107)
                    self.assertEqual(len(first['data']), min(size, 1107))
            first = self.fetch_page(endpoint, 1000)
            second = self.fetch_page(endpoint, 1000, 2)
            self.assertEqual(len(second['data']), 107, endpoint)
            self.assertFalse({row['id'] for row in first['data']} & {row['id'] for row in second['data']}, endpoint)

    def test_expanded_limits_remain_bounded(self):
        for endpoint in ('mailbox/account-data', 'mail-logs'):
            for requested, expected in ((0, 1), (-2, 1), (10001, 10000)):
                with self.subTest(endpoint=endpoint, requested=requested):
                    self.assertEqual(self.fetch_page(endpoint, requested)['pagination']['per_page'], expected)


if __name__ == '__main__':
    unittest.main()
