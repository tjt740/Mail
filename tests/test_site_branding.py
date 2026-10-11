import base64
import os
import sqlite3
import tempfile
import unittest
from pathlib import Path

import app as app_module


class SiteBrandingTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.previous = {k: app_module.app.config.get(k) for k in ('DATABASE', 'DATABASE_TYPE', 'TESTING')}
        app_module.app.config.update(DATABASE=os.path.join(self.tmp.name, 'brand.sqlite'), DATABASE_TYPE='sqlite', TESTING=True)
        app_module.init_db()
        with sqlite3.connect(app_module.app.config['DATABASE']) as db:
            db.execute("UPDATE admin_users SET username='tjt740' WHERE id=1")
        self.owner = app_module.app.test_client()
        self.login(self.owner, 1)
        result = self.owner.post('/admin/api/system-config', json={
            'action': 'add_admin', 'admin_username': 'designer', 'admin_password': 'test-password',
            'admin_level': 2, 'permissions': ['settings'],
        })
        self.other = app_module.app.test_client()
        self.login(self.other, result.get_json()['data']['id'])
        self.payload = dict(action='update_page_titles', api_page_title='API', frontend_page_title='我的邮局',
                            admin_login_title='管理员登录', frontend_icon='rocket', frontend_icon_image='')

    def login(self, client, admin_id):
        with client.session_transaction() as session:
            session.update(admin_logged_in=True, admin_id=admin_id, admin_session_version=0)

    def tearDown(self):
        app_module.app.config.update(self.previous)
        self.tmp.cleanup()

    def test_owner_saves_brand_and_fresh_public_pages_use_it(self):
        image = Path('static/img/favicons/favicon-32x32.png').read_bytes()
        self.payload['frontend_icon_image'] = 'data:image/png;base64,' + base64.b64encode(image).decode()
        response = self.owner.post('/admin/api/system-config', json=self.payload)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.get_json()['success'])
        stored = self.owner.get('/admin/api/system-config').get_json()['data']
        self.assertEqual(stored['frontend_icon_image'], self.payload['frontend_icon_image'])
        public = app_module.app.test_client()
        page = public.get('/legacy/?embedded=1').get_data(as_text=True)
        self.assertIn('>我的邮局</h1>', page)
        self.assertIn(self.payload['frontend_icon_image'], page)
        self.assertNotIn('输入后台邮箱地址，即刻查看最新邮件', page)
        self.assertIn('我的邮局', public.get('/').get_data(as_text=True))
        self.payload['frontend_icon_image'] = ''
        self.owner.post('/admin/api/system-config', json=self.payload)
        self.assertIn('href="#ai-rocket"', public.get('/legacy/').get_data(as_text=True))

    def test_delegated_settings_permission_cannot_change_any_branding(self):
        for payload in (self.payload, dict(action='update_system_title', system_title='Unauthorized')):
            response = self.other.post('/admin/api/system-config', json=payload)
            self.assertEqual(response.status_code, 403)
        self.assertNotIn('id="sec-pagetitle"', self.other.get('/legacy/admin/system').get_data(as_text=True))
        self.assertNotIn('id="sec-systitle"', self.other.get('/legacy/admin/system').get_data(as_text=True))
        self.assertIn('id="frontendIconFile"', self.owner.get('/legacy/admin/system').get_data(as_text=True))
        self.assertFalse(self.other.get('/admin/api/system-config').get_json()['data']['can_manage_site_brand'])

    def test_anonymous_and_renamed_root_cannot_update(self):
        self.assertEqual(app_module.app.test_client().post('/admin/api/system-config', json=self.payload).status_code, 401)
        with sqlite3.connect(app_module.app.config['DATABASE']) as db:
            db.execute("UPDATE admin_users SET username='another-root' WHERE id=1")
        self.assertEqual(self.owner.post('/admin/api/system-config', json=self.payload).status_code, 403)

    def test_animated_gif_at_two_mb_is_saved_byte_for_byte_and_oversize_is_rejected(self):
        original = Path('tests/fixtures/animated-icon.gif').read_bytes()

        def padded_gif(size):
            # Valid GIF comment blocks pad the two-frame fixture to an exact size.
            remaining = size - len(original) - 3
            blocks = bytearray(b'\x21\xfe')
            while remaining:
                count = min(256, remaining)
                if remaining - count == 1:
                    count -= 1
                blocks.extend(bytes([count - 1]) + b'x' * (count - 1))
                remaining -= count
            return original[:-1] + blocks + b'\x00;'

        limit = 2 * 1024 * 1024
        for size in (limit - 1, limit):
            image = padded_gif(size)
            self.assertEqual(len(image), size)
            self.payload['frontend_icon_image'] = 'data:image/gif;base64,' + base64.b64encode(image).decode()
            response = self.owner.post('/admin/api/system-config', json=self.payload)
            self.assertEqual(response.status_code, 200)
            self.assertTrue(response.get_json()['success'])
            stored = self.owner.get('/admin/api/system-config').get_json()['data']['frontend_icon_image']
            self.assertTrue(stored == self.payload['frontend_icon_image'], 'Animated GIF must be preserved without conversion')
            self.assertIn(stored, self.owner.get('/legacy/').get_data(as_text=True))

        accepted = self.payload['frontend_icon_image']
        oversized = 'data:image/gif;base64,' + base64.b64encode(padded_gif(limit + 1)).decode()
        for image in (oversized, 'data:image/gif;base64,ZmFrZQ=='):
            response = self.owner.post('/admin/api/system-config', json=dict(self.payload, frontend_icon_image=image))
            self.assertEqual(response.status_code, 400)
            stored = self.owner.get('/admin/api/system-config').get_json()['data']['frontend_icon_image']
            self.assertTrue(stored == accepted, 'Rejected uploads must keep the previous icon')

    def test_validation_rejects_unsafe_images_and_invalid_titles_without_partial_writes(self):
        for changes in ({'frontend_icon': 'bad" onload="alert(1)'},
                        {'frontend_icon_image': 'javascript:alert(1)'},
                        {'frontend_icon_image': 'data:image/svg+xml;base64,PHN2Zz4='},
                        {'frontend_icon_image': 'data:image/png;base64,ZmFrZQ=='},
                        {'frontend_icon_image': 'x' * (3 * 1024 * 1024)},
                        {'frontend_page_title': ''}, {'frontend_page_title': 'x' * 61},
                        {'frontend_page_title': 'two\nlines'}, {'frontend_page_title': []}):
            with self.subTest(changes=list(changes)):
                response = self.owner.post('/admin/api/system-config', json=dict(self.payload, **changes))
                self.assertEqual(response.status_code, 400, response.get_json())
        stored = self.owner.get('/admin/api/system-config').get_json()['data']
        self.assertNotEqual(stored['frontend_page_title'], '我的邮局')
        self.payload['frontend_page_title'] = '<script>alert(1)</script>'
        self.owner.post('/admin/api/system-config', json=self.payload)
        page = self.owner.get('/legacy/').get_data(as_text=True)
        self.assertIn('&lt;script&gt;alert(1)&lt;/script&gt;</h1>', page)
