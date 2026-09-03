import json
import sqlite3
import subprocess
import unittest
from unittest.mock import patch

import app as app_module


class MailboxAccountStatusTestCase(unittest.TestCase):
    def test_successful_test_is_normal(self):
        self.assertEqual(
            app_module.classify_mailbox_account_status({
                'success': True,
                'message': '邮箱连接测试成功',
            }),
            app_module.MAILBOX_ACCOUNT_STATUS_NORMAL,
        )

    def test_microsoft_disabled_and_locked_responses_are_banned(self):
        messages = (
            'AADSTS50057: User account is disabled.',
            'AADSTS50053: The account is locked.',
            '该账号已被封禁，请联系管理员',
        )
        for message in messages:
            with self.subTest(message=message):
                self.assertEqual(
                    app_module.classify_mailbox_account_status({
                        'success': False,
                        'message': message,
                        'error_type': 'auth_failed',
                    }),
                    app_module.MAILBOX_ACCOUNT_STATUS_BANNED,
                )

    def test_expired_credentials_are_not_mislabeled_as_banned(self):
        self.assertEqual(
            app_module.classify_mailbox_account_status({
                'success': False,
                'message': 'invalid_grant: refresh token has expired',
                'error_type': 'auth_failed',
            }),
            app_module.MAILBOX_ACCOUNT_STATUS_INVALID,
        )

    def test_network_errors_remain_separate_from_account_health(self):
        for error_type in ('timeout', 'proxy_error', 'dns_error', 'ssl_error'):
            with self.subTest(error_type=error_type):
                self.assertEqual(
                    app_module.classify_mailbox_account_status({
                        'success': False,
                        'message': '连接失败',
                        'error_type': error_type,
                    }),
                    app_module.MAILBOX_ACCOUNT_STATUS_NETWORK,
                )

    def test_unknown_failures_are_test_errors(self):
        self.assertEqual(
            app_module.classify_mailbox_account_status({
                'success': False,
                'message': 'unexpected response',
            }),
            app_module.MAILBOX_ACCOUNT_STATUS_ERROR,
        )

    def test_mailbox_test_response_status_is_persisted_and_returned(self):
        connection = sqlite3.connect(':memory:')
        connection.row_factory = sqlite3.Row
        connection.execute('''
            CREATE TABLE mail_accounts (
                id INTEGER PRIMARY KEY,
                email TEXT NOT NULL,
                last_test TEXT,
                test_result TEXT DEFAULT '',
                account_status TEXT DEFAULT 'pending'
            )
        ''')
        connection.execute(
            "INSERT INTO mail_accounts (id, email) VALUES (1, 'blocked@example.com')"
        )
        previous_database_type = app_module.app.config['DATABASE_TYPE']
        app_module.app.config['DATABASE_TYPE'] = 'sqlite'
        process_result = subprocess.CompletedProcess(
            args=[],
            returncode=0,
            stdout=json.dumps({
                'success': False,
                'message': 'AADSTS50057: User account is disabled.',
                'error_type': 'auth_failed',
            }),
            stderr='',
        )

        try:
            with app_module.app.test_request_context('/'):
                with patch.object(app_module.subprocess, 'run', return_value=process_result):
                    response = app_module._test_mailbox(connection, {'id': 1})
                    payload = response.get_json()

            stored = connection.execute(
                'SELECT account_status, test_result, last_test FROM mail_accounts WHERE id = 1'
            ).fetchone()
            self.assertFalse(payload['success'])
            self.assertEqual(payload['account_status'], app_module.MAILBOX_ACCOUNT_STATUS_BANNED)
            self.assertEqual(stored['account_status'], app_module.MAILBOX_ACCOUNT_STATUS_BANNED)
            self.assertIn('AADSTS50057', stored['test_result'])
            self.assertTrue(stored['last_test'])
        finally:
            app_module.app.config['DATABASE_TYPE'] = previous_database_type
            connection.close()


if __name__ == '__main__':
    unittest.main()
