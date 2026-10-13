import base64
import os
import sqlite3
import tempfile
import unittest
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage

import app as app_module
from python.mail_fetcher import ProxyMailFetcher


class InlineImageTests(unittest.TestCase):
    def test_multipart_keeps_full_html_instead_of_plain_alternative(self):
        message = MIMEMultipart('related')
        alternative = MIMEMultipart('alternative')
        html = '<style>p { color: red }</style>' + '<p>完整内容</p>' * 25000 + '<img src="cid:banner"><p>邮件末尾</p>'
        alternative.attach(MIMEText('Plain fallback', 'plain', 'utf-8'))
        alternative.attach(MIMEText(html, 'html', 'utf-8'))
        message.attach(alternative)
        image = MIMEImage(b'fixture', _subtype='png')
        image['Content-ID'] = '<banner>'
        message.attach(image)
        result = object.__new__(ProxyMailFetcher)._parse_body(message)
        self.assertEqual(result['body_type'], 'html')
        self.assertEqual(result['body'], html)
        self.assertEqual(result['images'][0]['content_id'], 'banner')

    def test_inline_and_attached_images_keep_cid_and_content(self):
        payload = b'fixture image bytes'
        fetcher = object.__new__(ProxyMailFetcher)
        for disposition in ('inline', 'attachment'):
            with self.subTest(disposition=disposition):
                part = MIMEImage(payload, _subtype='png')
                part['Content-ID'] = '<banner@example.com>'
                part.add_header('Content-Disposition', disposition, filename='banner.png')
                result = fetcher._process_part(part)
                self.assertEqual(result['disposition'], disposition)
                self.assertEqual(result['data']['content_id'], 'banner@example.com')
                self.assertEqual(result['data']['size'], len(payload))
                self.assertEqual(base64.b64decode(result['data']['content']), payload)


class SavedMailContentTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.previous = {key: app_module.app.config.get(key) for key in ('DATABASE', 'DATABASE_TYPE', 'TESTING')}
        self.path = os.path.join(self.temp.name, 'mail.sqlite')
        app_module.app.config.update(DATABASE=self.path, DATABASE_TYPE='sqlite', TESTING=True)
        app_module.init_db()
        self.client = app_module.app.test_client()
        with self.client.session_transaction() as session:
            session.update(admin_logged_in=True, admin_id=1, admin_session_version=0)
        self.mail = {
            'message_id': 'fixture-message', 'subject': 'Full HTML message', 'from': 'sender@example.com',
            'to': 'reader@example.com', 'date': '2026-10-13 08:00:00', 'body_type': 'html',
            'body': '<html><style>p { color: blue }</style><body>' + '<p>完整邮件</p>' * 25000 +
                    '<img src="cid:banner"><p id="end">END</p></body></html>',
            'images': [{'content_id': 'banner', 'mime_type': 'image/png', 'content': 'aW1hZ2U='}],
            'attachments': [{'filename': 'report.txt', 'mime_type': 'text/plain', 'content': 'cmVwb3J0'}],
        }

    def tearDown(self):
        app_module.app.config.update(self.previous)
        self.temp.cleanup()

    def save(self, mail):
        with sqlite3.connect(self.path) as db:
            db.row_factory = sqlite3.Row
            added = app_module._insert_mail_log(db, 'sqlite', 'reader@example.com', mail, 'manual')
            log_id = db.execute('SELECT id FROM mail_logs').fetchone()[0]
        return added, log_id

    def test_detail_keeps_entire_document_and_resources_list_stays_small(self):
        added, log_id = self.save(self.mail)
        self.assertTrue(added)
        response = self.client.get(f'/admin/api/mail-logs/{log_id}')
        self.assertEqual(response.status_code, 200)
        detail = response.get_json()['data']
        self.assertEqual(detail['mail_body'], self.mail['body'])
        self.assertEqual(detail['mail_body_type'], 'html')
        self.assertEqual(detail['mail_images'], self.mail['images'])
        self.assertEqual(detail['mail_attachments'], self.mail['attachments'])
        response = self.client.get('/admin/api/mail-logs')
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('mail_images', response.get_data(as_text=True))
        self.assertNotIn('mail_attachments', response.get_data(as_text=True))
        self.assertLess(len(response.data), 10000)
        self.assertEqual(app_module.app.test_client().get(f'/admin/api/mail-logs/{log_id}').status_code, 401)

    def test_refetch_upgrades_existing_text_or_truncated_body_without_duplicate(self):
        _, log_id = self.save({**self.mail, 'body_type': 'text', 'body': 'Old preview', 'images': [], 'attachments': []})
        added, updated_id = self.save(self.mail)
        self.assertFalse(added)
        self.assertEqual(updated_id, log_id)
        detail = self.client.get(f'/admin/api/mail-logs/{log_id}').get_json()['data']
        self.assertEqual(detail['mail_body'], self.mail['body'])
        self.assertEqual(detail['mail_body_type'], 'html')
        self.assertEqual(detail['mail_images'], self.mail['images'])
        with sqlite3.connect(self.path) as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM mail_logs').fetchone()[0], 1)

    def test_migration_preserves_historical_body_and_is_repeatable(self):
        with sqlite3.connect(':memory:') as db:
            db.execute('CREATE TABLE mail_logs (id INTEGER PRIMARY KEY, email TEXT, status TEXT, created_at TEXT, mail_body TEXT)')
            db.execute("INSERT INTO mail_logs (mail_body) VALUES ('<p>Historical content</p>')")
            app_module.migrate_mail_logs_table(db, 'sqlite')
            app_module.migrate_mail_logs_table(db, 'sqlite')
            self.assertEqual(db.execute('SELECT mail_body, mail_images, mail_attachments FROM mail_logs').fetchone(),
                             ('<p>Historical content</p>', '[]', '[]'))


if __name__ == '__main__':
    unittest.main()
