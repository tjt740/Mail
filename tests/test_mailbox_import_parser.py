import unittest

import app as app_module


class MailboxImportParserTestCase(unittest.TestCase):
    CLIENT_ID = '9e5f94bc-e8a4-4e73-b8be-63364c29d753'
    REFRESH_TOKEN = 'M.C555_SN1.0.U.MsaArtifacts.' + ('token-segment-' * 32)

    def test_outlook_four_part_oauth_format_keeps_email_field_isolated(self):
        line = (
            'example.user7887@outlook.com'
            '----mail-password'
            f'----{self.CLIENT_ID}'
            f'----{self.REFRESH_TOKEN}'
        )

        parsed, error = app_module.parse_mailbox_import_line(line)

        self.assertEqual(error, '')
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed['email'], 'example.user7887@outlook.com')
        self.assertEqual(parsed['username'], 'example.user7887@outlook.com')
        self.assertEqual(parsed['password'], 'mail-password')
        self.assertEqual(parsed['oauth_client_id'], self.CLIENT_ID)
        self.assertEqual(parsed['oauth_refresh_token'], self.REFRESH_TOKEN)
        self.assertEqual(parsed['auth_type'], 'oauth')
        self.assertEqual(parsed['remarks'], 'OAuth登录')

    def test_positional_formats_detect_oauth_fields_in_either_order(self):
        cases = {
            'dash_reverse': f'user1@outlook.com----pw----{self.REFRESH_TOKEN}----{self.CLIENT_ID}',
            'comma': f'user2@outlook.com,pw,{self.CLIENT_ID},{self.REFRESH_TOKEN}',
            'chinese_comma': f'user3@outlook.com，pw，{self.CLIENT_ID}，{self.REFRESH_TOKEN}',
            'semicolon': f'user4@outlook.com;pw;{self.REFRESH_TOKEN};{self.CLIENT_ID}',
            'chinese_pipe': f'user5@outlook.com｜pw｜{self.CLIENT_ID}｜{self.REFRESH_TOKEN}',
            'tab': f'user6@outlook.com\tpw\t{self.CLIENT_ID}\t{self.REFRESH_TOKEN}',
            'colon': f'user7@outlook.com:pw:{self.CLIENT_ID}:{self.REFRESH_TOKEN}',
            'space': f'user8@outlook.com pw {self.CLIENT_ID} {self.REFRESH_TOKEN}',
        }

        for name, line in cases.items():
            with self.subTest(name=name):
                parsed, error = app_module.parse_mailbox_import_line(line)
                self.assertEqual(error, '')
                self.assertEqual(parsed['password'], 'pw')
                self.assertEqual(parsed['oauth_client_id'], self.CLIENT_ID)
                self.assertEqual(parsed['oauth_refresh_token'], self.REFRESH_TOKEN)
                self.assertEqual(parsed['auth_type'], 'oauth')

    def test_labeled_and_json_formats_support_aliases(self):
        cases = (
            (
                f'邮箱=user9@outlook.com----邮箱密码=pw----客户端ID={self.CLIENT_ID}'
                f'----刷新令牌={self.REFRESH_TOKEN}',
                'user9@outlook.com',
            ),
            (
                f'Email Address: user10@outlook.com Password: pw Client ID: {self.CLIENT_ID} '
                f'Refresh Token: {self.REFRESH_TOKEN}',
                'user10@outlook.com',
            ),
            (
                '{{"email":"user11@outlook.com","passwd":"pw","clientId":"{}",'
                '"refreshToken":"{}"}}'.format(self.CLIENT_ID, self.REFRESH_TOKEN),
                'user11@outlook.com',
            ),
        )

        for line, expected_email in cases:
            with self.subTest(email=expected_email):
                parsed, error = app_module.parse_mailbox_import_line(line)
                self.assertEqual(error, '')
                self.assertEqual(parsed['email'], expected_email)
                self.assertEqual(parsed['password'], 'pw')
                self.assertEqual(parsed['oauth_client_id'], self.CLIENT_ID)
                self.assertEqual(parsed['oauth_refresh_token'], self.REFRESH_TOKEN)
                self.assertEqual(parsed['auth_type'], 'oauth')

    def test_structured_batch_formats_expand_into_records(self):
        contents = {
            'json_array': (
                '[{"email":"json1@outlook.com","password":"pw1"},'
                '{"邮箱":"json2@outlook.com","密码":"pw2"}]'
            ),
            'csv_header': (
                f'email,password,client_id,refresh_token\n'
                f'csv@outlook.com,pw,{self.CLIENT_ID},{self.REFRESH_TOKEN}'
            ),
            'tsv_chinese_header': (
                f'邮箱\t密码\t客户端ID\t刷新令牌\n'
                f'tsv@outlook.com\tpw\t{self.CLIENT_ID}\t{self.REFRESH_TOKEN}'
            ),
            'multiline_fields': (
                f'Email: block@outlook.com\nPassword: pw\nClient ID: {self.CLIENT_ID}\n'
                f'Refresh Token: {self.REFRESH_TOKEN}'
            ),
        }
        expected_emails = {
            'json_array': ['json1@outlook.com', 'json2@outlook.com'],
            'csv_header': ['csv@outlook.com'],
            'tsv_chinese_header': ['tsv@outlook.com'],
            'multiline_fields': ['block@outlook.com'],
        }

        for name, content in contents.items():
            with self.subTest(name=name):
                entries = app_module.expand_mailbox_import_entries(content)
                parsed_records = [app_module.parse_mailbox_import_line(entry)[0] for entry in entries]
                self.assertEqual(
                    [record['email'] for record in parsed_records],
                    expected_emails[name],
                )


if __name__ == '__main__':
    unittest.main()
