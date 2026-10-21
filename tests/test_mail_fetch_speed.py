import imaplib
import socket
import ssl
import threading
import unittest
from unittest.mock import MagicMock, patch

from python import mail_fetcher as module


class MailFetchSpeedTests(unittest.TestCase):
    def setUp(self):
        self.proxy_check = patch.object(module.ProxyMailFetcher, '_check_proxy_status')
        self.proxy_check.start()
        self.addCleanup(self.proxy_check.stop)
        self.imap = MagicMock()
        self.imap.select.return_value = ('OK', [b'2'])
        self.imap.search.return_value = ('OK', [b'1 2'])
        self.imap.fetch.return_value = ('OK', [
            (b'1 (RFC822 {90}', b'Subject: first\r\nMessage-ID: <1>\r\n\r\nfirst body'),
            b')',
            (b'2 (RFC822 {90}', b'Subject: latest\r\nMessage-ID: <2>\r\n\r\nlatest body'),
            b')',
        ])
        self.factory = patch.object(module.imaplib, 'IMAP4_SSL', return_value=self.imap)
        self.factory.start()
        self.addCleanup(self.factory.stop)

    def fetcher(self, **kwargs):
        return module.ProxyMailFetcher('imap.example.com', 993, 'reader@example.com', 'fixture', **kwargs)

    def test_real_authenticated_test_uses_no_extra_tcp_probe(self):
        fetcher = self.fetcher()
        with patch.object(socket, 'gethostbyname', return_value='192.0.2.1'), \
             patch.object(socket, 'socket', side_effect=AssertionError('unexpected TCP probe')):
            result = fetcher.test_connection()
        self.assertTrue(result['success'])
        self.assertIn('TCP连接成功', result['diagnostics']['tcp_connection'])
        self.imap.login.assert_called_once()
        self.imap.select.assert_called_once_with('INBOX')
        self.imap.logout.assert_called_once()
        self.imap.close.assert_not_called()

    def test_receive_reuses_selection_and_keeps_complete_messages_in_order(self):
        fetcher = self.fetcher(fast_mode=True)
        fetcher.connect()
        result = fetcher.get_latest_mail_filtered({'limit': 20, 'folder': 'inbox'})
        self.assertTrue(result['success'])
        self.assertEqual(result['fetched_count'], 2)
        self.assertEqual([mail['message_id'] for mail in result['mails']], ['<2>', '<1>'])
        self.assertEqual(result['mails'][0]['body'], 'latest body')
        self.assertEqual(result['mails'][1]['body'], 'first body')
        self.imap.select.assert_called_once_with('INBOX')
        self.imap.fetch.assert_called_once_with('2,1', '(RFC822)')

    def test_failed_folder_switch_reselects_inbox_before_fetch(self):
        fetcher = self.fetcher()
        fetcher.connect()
        self.imap.select.side_effect = [('NO', [b'no folder']), ('OK', [b'2'])]
        result = fetcher.get_latest_mail_filtered({'limit': 20, 'folder': 'Trash'})
        self.assertTrue(result['success'])
        self.assertEqual([call.args[0] for call in self.imap.select.call_args_list], ['INBOX', 'Trash', 'INBOX'])
        self.assertTrue(all(mail['folder'] == 'inbox' for mail in result['mails']))

    def test_switch_folder_and_connection_never_reuses_old_selection(self):
        fetcher = self.fetcher()
        fetcher.connect()
        result = fetcher.get_latest_mail_filtered({'limit': 20, 'folder': 'Trash'})
        self.assertEqual(result['mails'][0]['folder'], 'trash')
        new_connection = MagicMock()
        new_connection.select.return_value = ('OK', [b'0'])
        fetcher.connection = new_connection
        fetcher._select_mailbox('Trash')
        new_connection.select.assert_called_once_with('Trash')

    def test_failed_inbox_selection_cannot_report_success(self):
        self.imap.select.return_value = ('NO', [b'unavailable'])
        fetcher = self.fetcher()
        with patch.object(socket, 'gethostbyname', return_value='192.0.2.1'):
            result = fetcher.test_connection()
        self.assertFalse(result['success'])
        self.assertIn('无法选择', result['message'])
        self.assertIsNone(fetcher._selected_mailbox)

    def test_direct_oauth_token_refresh_overlaps_handshake_once(self):
        fetcher = self.fetcher(auth_type='oauth', oauth_client_id='fixture', oauth_refresh_token='fixture')
        token_started = threading.Event()
        handshake_started = threading.Event()

        def token():
            token_started.set()
            self.assertTrue(handshake_started.wait(2), 'handshake did not overlap token refresh')
            return 'fixture-access-token'

        def handshake(*args, **kwargs):
            handshake_started.set()
            self.assertTrue(token_started.wait(2), 'token refresh did not start')
            return self.imap

        with patch.object(fetcher, '_fetch_oauth_access_token', side_effect=token) as refresh, \
             patch.object(module.imaplib, 'IMAP4_SSL', side_effect=handshake):
            self.assertTrue(fetcher.connect())
        refresh.assert_called_once()
        self.imap.authenticate.assert_called_once()
        mechanism, response = self.imap.authenticate.call_args.args
        self.assertEqual(mechanism, 'XOAUTH2')
        self.assertEqual(response(b''), b'user=reader@example.com\x01auth=Bearer fixture-access-token\x01\x01')

    def test_proxy_oauth_remains_sequential(self):
        fetcher = self.fetcher(auth_type='oauth', oauth_client_id='fixture', oauth_refresh_token='fixture')
        fetcher.proxy_enabled = True
        with patch.object(module, 'ThreadPoolExecutor', side_effect=AssertionError('proxy must not use threads')), \
             patch.object(fetcher, '_fetch_oauth_access_token', return_value='fixture-token') as refresh:
            self.assertTrue(fetcher._connect_imap())
        refresh.assert_called_once()

    def test_oauth_error_does_not_trigger_duplicate_refresh(self):
        fetcher = self.fetcher(auth_type='oauth', oauth_client_id='fixture', oauth_refresh_token='fixture')
        original_timeout = socket.getdefaulttimeout()
        with patch.object(fetcher, '_fetch_oauth_access_token', side_effect=ValueError('invalid_grant')) as refresh:
            with self.assertRaisesRegex(Exception, 'OAuth登录失败: invalid_grant'):
                fetcher.connect()
        refresh.assert_called_once()
        self.assertEqual(socket.getdefaulttimeout(), original_timeout)
        self.imap.authenticate.assert_not_called()

    def test_network_errors_keep_useful_diagnostics_without_preflight(self):
        for error, error_type in (
            (socket.timeout('connection timed out'), 'timeout'),
            (ConnectionRefusedError('connection refused'), 'connection_refused'),
            (ssl.SSLError('handshake failed'), 'ssl_error'),
            (socket.gaierror('name or service not known'), 'dns_error'),
        ):
            with self.subTest(error_type=error_type), \
                 patch.object(socket, 'gethostbyname', return_value='192.0.2.1'), \
                 patch.object(module.imaplib, 'IMAP4_SSL', side_effect=error):
                result = self.fetcher().test_connection()
                self.assertFalse(result['success'])
                self.assertEqual(result['error_type'], error_type)

    def test_oauth_network_timeout_is_not_labeled_invalid_credentials(self):
        fetcher = self.fetcher(auth_type='oauth', oauth_client_id='fixture', oauth_refresh_token='fixture')
        with patch.object(socket, 'gethostbyname', return_value='192.0.2.1'), \
             patch.object(fetcher, '_fetch_oauth_access_token', side_effect=socket.timeout('login.microsoftonline.com connection timed out')):
            result = fetcher.test_connection()
        self.assertFalse(result['success'])
        self.assertEqual(result['error_type'], 'timeout')

    def test_handshake_failure_joins_token_worker_and_restores_socket_timeout(self):
        fetcher = self.fetcher(auth_type='oauth', oauth_client_id='fixture', oauth_refresh_token='fixture')
        token_finished = threading.Event()
        worker = []
        original_timeout = socket.getdefaulttimeout()

        def token():
            worker.append(threading.current_thread())
            token_finished.set()
            return 'fixture-token'

        with patch.object(fetcher, '_fetch_oauth_access_token', side_effect=token), \
             patch.object(module.imaplib, 'IMAP4_SSL', side_effect=OSError('connection refused')):
            with self.assertRaisesRegex(Exception, 'connection refused'):
                fetcher.connect()
        self.assertTrue(token_finished.is_set())
        self.assertFalse(worker[0].is_alive())
        self.assertEqual(socket.getdefaulttimeout(), original_timeout)

    def test_authentication_failure_is_not_reported_as_tcp_success(self):
        self.imap.login.side_effect = imaplib.IMAP4.error('invalid credentials')
        with patch.object(socket, 'gethostbyname', return_value='192.0.2.1'):
            result = self.fetcher().test_connection()
        self.assertFalse(result['success'])
        self.assertEqual(result['error_type'], 'auth_failed')

    def test_logout_failure_still_clears_connection_and_selection(self):
        fetcher = self.fetcher()
        fetcher.connect()
        self.imap.logout.side_effect = OSError('closed')
        fetcher.close()
        self.assertIsNone(fetcher.connection)
        self.assertIsNone(fetcher._selected_mailbox)
        self.imap.close.assert_not_called()


if __name__ == '__main__':
    unittest.main()
