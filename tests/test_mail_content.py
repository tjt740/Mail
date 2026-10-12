import base64
import unittest
from email.mime.image import MIMEImage

from python.mail_fetcher import ProxyMailFetcher


class InlineImageTests(unittest.TestCase):
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


if __name__ == '__main__':
    unittest.main()
