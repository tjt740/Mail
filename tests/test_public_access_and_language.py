import os
import sqlite3
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import app as app_module


class PublicAccessAndLanguageTestCase(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.database_path = os.path.join(self.temp_dir.name, 'test.sqlite')
        self.original_config = {
            'DATABASE': app_module.app.config['DATABASE'],
            'DATABASE_TYPE': app_module.app.config['DATABASE_TYPE'],
            'TESTING': app_module.app.config.get('TESTING', False),
        }
        app_module.app.config.update(
            DATABASE=self.database_path,
            DATABASE_TYPE='sqlite',
            TESTING=True,
        )
        with sqlite3.connect(self.database_path) as db:
            db.execute('CREATE TABLE system_config (config_key TEXT PRIMARY KEY, config_value TEXT)')

    def tearDown(self):
        app_module.app.config.update(self.original_config)
        self.temp_dir.cleanup()

    def test_country_header_selects_supported_languages(self):
        cases = (
            ('CN', 'zh'),
            ('TW', 'zh'),
            ('VN', 'vi'),
            ('PH', 'fil'),
            ('US', 'en'),
        )
        with app_module.app.test_client() as client:
            for country, expected_language in cases:
                with self.subTest(country=country):
                    response = client.get('/api/language', headers={'CF-IPCountry': country})
                    payload = response.get_json()
                    self.assertTrue(payload['success'])
                    self.assertEqual(payload['language'], expected_language)
                    self.assertEqual(payload['country'], country)
                    self.assertEqual(payload['source'], 'country_header')

    def test_private_ip_falls_back_to_browser_language(self):
        with app_module.app.test_client() as client:
            response = client.get(
                '/api/language',
                headers={'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8'},
                environ_base={'REMOTE_ADDR': '127.0.0.1'},
            )

        payload = response.get_json()
        self.assertEqual(payload['language'], 'vi')
        self.assertIsNone(payload['country'])
        self.assertEqual(payload['source'], 'accept_language')

    def test_filipino_and_tagalog_browser_locales(self):
        with app_module.app.test_client() as client:
            for language in ('fil', 'fil-PH', 'tl', 'tl-PH'):
                with self.subTest(language=language):
                    response = client.get(
                        '/api/language',
                        headers={'Accept-Language': f'{language},en;q=0.8'},
                        environ_base={'REMOTE_ADDR': '127.0.0.1'},
                    )
                    payload = response.get_json()
                    self.assertEqual(payload['language'], 'fil')
                    self.assertEqual(payload['source'], 'accept_language')

            response = client.get(
                '/api/language',
                headers={'Accept-Language': 'fil-PH;q=0.5,en;q=0.9'},
                environ_base={'REMOTE_ADDR': '127.0.0.1'},
            )
            self.assertEqual(response.get_json()['language'], 'en')

    def test_public_mail_lookup_does_not_require_credentials(self):
        failed_fetch = SimpleNamespace(returncode=1, stdout='', stderr='mailbox probe failed')
        with app_module.app.test_client() as client:
            with patch.object(app_module.subprocess, 'run', return_value=failed_fetch) as run:
                response = client.post('/api/get_mail', json={
                    'email': 'public@example.com',
                    'email_limit': 10,
                })

        payload = response.get_json()
        self.assertFalse(payload['success'])
        self.assertIn('mailbox probe failed', payload['message'])
        run.assert_called_once()
        command = run.call_args.args[0]
        self.assertIn('public@example.com', command)
        self.assertIn('--admin-access', command)
        self.assertNotIn('--card-key', command)


if __name__ == '__main__':
    unittest.main()
