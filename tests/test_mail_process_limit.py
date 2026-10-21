import json
import os
import sqlite3
import subprocess
import tempfile
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch

import app as mail


class MailProcessLimitTests(unittest.TestCase):
    def test_tests_receiving_and_polling_share_capacity(self):
        entered = threading.Condition()
        release = threading.Event()
        running = []

        def process(args, **kwargs):
            with entered:
                running.append(args)
                entered.notify_all()
            self.assertTrue(release.wait(3))
            return subprocess.CompletedProcess(args, 0, '{}', '')

        with patch.object(mail, 'MAIL_PROCESS_SLOTS', threading.BoundedSemaphore(3)), \
             patch.object(mail.subprocess, 'run', side_effect=process) as run, \
             ThreadPoolExecutor(max_workers=4) as pool:
            try:
                jobs = [pool.submit(mail._run_mail_fetcher, 'fixture@example.test'),
                        pool.submit(mail._run_mail_process, ['fetcher', '--admin-access']),
                        pool.submit(mail._run_mail_process, ['fetcher', '--test-connection'])]
                with entered:
                    self.assertTrue(entered.wait_for(lambda: len(running) == 3, timeout=2))
                with self.assertRaises(mail.MailboxTestBusy):
                    mail._run_mail_process(['fetcher', '--test-connection'])
                self.assertEqual(run.call_count, 3)
                queued = pool.submit(mail._run_mail_process, ['fetcher', '--admin-access'])
                self.assertFalse(queued.done())
            finally:
                release.set()
            for job in jobs:
                job.result(timeout=3)
            queued.result(timeout=3)
            self.assertEqual(run.call_count, 4)

    def test_exception_and_timeout_return_capacity(self):
        for error in (OSError('failed'), subprocess.TimeoutExpired('fetcher', 30)):
            with self.subTest(error=type(error)), \
                 patch.object(mail, 'MAIL_PROCESS_SLOTS', threading.BoundedSemaphore(1)), \
                 patch.object(mail.subprocess, 'run', side_effect=[error, 'success']):
                with self.assertRaises(type(error)):
                    mail._run_mail_process(['fetcher', '--test-connection'], timeout=30)
                self.assertEqual(mail._run_mail_process(['fetcher', '--test-connection']), 'success')

    def test_busy_existing_mailbox_does_not_change_saved_health(self):
        db = sqlite3.connect(':memory:')
        db.row_factory = sqlite3.Row
        self.addCleanup(db.close)
        db.execute('CREATE TABLE mail_accounts (id INTEGER, email TEXT, account_status TEXT, last_test TEXT, test_result TEXT)')
        db.execute("INSERT INTO mail_accounts VALUES (1, 'fixture@example.test', 'normal', 'previous time', 'previous result')")
        before = tuple(db.execute('SELECT * FROM mail_accounts').fetchone())
        with mail.app.test_request_context('/'), \
             patch.dict(mail.app.config, DATABASE_TYPE='sqlite'), \
             patch.object(mail, 'MAIL_PROCESS_SLOTS', threading.BoundedSemaphore(0)), \
             patch.object(mail.subprocess, 'run') as run:
            response = mail.app.make_response(mail._test_mailbox(db, {'id': 1}))
            self.assertEqual(response.status_code, 503)
            self.assertEqual(response.headers['Retry-After'], '1')
            self.assertEqual(response.get_json()['error_type'], 'test_busy')
            self.assertNotIn('account_status', response.get_json())
            run.assert_not_called()
        self.assertEqual(tuple(db.execute('SELECT * FROM mail_accounts').fetchone()), before)

    def test_busy_new_mailbox_cleans_up_temporary_record(self):
        with tempfile.TemporaryDirectory() as directory, \
             patch.dict(mail.app.config, DATABASE=os.path.join(directory, 'mail.sqlite'), DATABASE_TYPE='sqlite', TESTING=True), \
             patch.object(mail, 'MAIL_PROCESS_SLOTS', threading.BoundedSemaphore(0)), \
             patch.object(mail.subprocess, 'run') as run, mail.app.test_request_context('/'):
            mail.init_db()
            response = mail.app.make_response(mail._test_new_mailbox({
                'email': 'fixture@example.test', 'password': 'fixture',
                'server': 'imap.example.test', 'port': 993,
            }))
            self.assertEqual(response.status_code, 503)
            self.assertNotIn('account_status', response.get_json())
            run.assert_not_called()
            self.assertEqual(mail.get_db().execute('SELECT count(*) FROM mail_accounts').fetchone()[0], 0)


if __name__ == '__main__':
    unittest.main()
