"""Offline integration tests. No Neon connection and no real mail sending."""
import os
import tempfile
import unittest
from io import BytesIO
from pathlib import Path

os.environ['DATABASE_URL'] = 'postgresql+psycopg://test:test@localhost/test'
_uploads = tempfile.TemporaryDirectory()
os.environ['UPLOAD_DIR'] = _uploads.name

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from pypdf import PdfWriter
from app.database import Base, get_db
from app.main import app
from app.models import Branch


def pdf_bytes(encrypted=False):
    writer = PdfWriter()
    writer.add_blank_page(width=300, height=300)
    if encrypted:
        writer.encrypt('secret')
    stream = BytesIO()
    writer.write(stream)
    return stream.getvalue()


class IntakeTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        with Session(self.engine) as db:
            db.add(Branch(id=1, city='Warszawa', name='SEKA Warszawa'))
            db.commit()
        def override_db():
            with Session(self.engine, expire_on_commit=False) as db:
                yield db
        app.dependency_overrides[get_db] = override_db
        self.client = TestClient(app)
        self.fields = dict(first_name='Anna', last_name='Demo', email='anna@example.com',
                           email_subject='Aplikacja', email_body='Dzień dobry')

    def tearDown(self):
        app.dependency_overrides.clear()
        self.engine.dispose()

    def intake(self, extra=None, attachment=None):
        return self.client.post('/api/intake/sample-email', data=self.fields | (extra or {}),
                                files={'file': attachment} if attachment else None)

    def test_missing_fields_remain_visible_and_can_be_completed(self):
        response = self.intake()
        self.assertEqual(response.status_code, 201, response.text)
        c = response.json()
        self.assertEqual(c['missing_information'], ['missing_cv', 'missing_city', 'missing_position'])
        self.assertFalse(c['is_complete'])
        self.assertEqual(self.client.get('/api/candidates').json()['total'], 1)
        self.assertEqual(self.client.get('/api/dashboard').json()['unassigned'], 1)
        self.assertEqual(self.client.get('/api/positions').json(), [])
        self.assertEqual(self.client.get('/api/candidates?city=Warszawa').json()['total'], 0)
        updated = self.client.patch('/api/candidates/'+c['id'], json={'branch_id': 1, 'position': 'HR', 'hr_notes': 'Notatka'})
        self.assertEqual(updated.status_code, 200, updated.text)
        uploaded = self.client.post('/api/candidates/'+c['id']+'/cv', files={'file': ('cv.pdf', pdf_bytes(), 'application/pdf')})
        self.assertEqual(uploaded.status_code, 200, uploaded.text)
        self.assertTrue(uploaded.json()['is_complete'])
        self.assertEqual(uploaded.json()['hr_notes'], 'Notatka')
        viewed = self.client.get('/api/candidates/'+c['id']+'/cv')
        self.assertEqual(viewed.status_code, 200)
        self.assertTrue(viewed.content.startswith(b'%PDF-'))
        self.assertEqual(self.client.get('/api/candidates?city=Warszawa').json()['total'], 1)
        self.assertEqual(self.client.get('/api/positions').json(), ['HR'])

    def test_invalid_attachment_keeps_application_and_replacement_resolves_it(self):
        response = self.intake({'branch_id': '1', 'position': 'HR'}, ('bad.pdf', b'%PDF-broken', 'application/pdf'))
        self.assertEqual(response.status_code, 201, response.text)
        c = response.json()
        self.assertEqual(c['missing_information'], ['invalid_cv'])
        self.assertIsNone(c['cv_original_filename'])
        self.assertEqual(self.client.get('/api/candidates/'+c['id']+'/cv').status_code, 404)
        response = self.client.post('/api/candidates/'+c['id']+'/cv', files={'file': ('cv.pdf', pdf_bytes(), 'application/pdf')})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertTrue(response.json()['is_complete'])
        bad = self.client.post('/api/candidates/'+c['id']+'/cv', files={'file': ('bad.pdf', b'bad', 'application/pdf')})
        self.assertEqual(bad.status_code, 400)
        self.assertTrue(self.client.get('/api/candidates/'+c['id']).json()['is_complete'])

    def test_encrypted_and_empty_pdf_are_flagged(self):
        for content in [pdf_bytes(encrypted=True), b'']:
            response = self.intake(attachment=('cv.pdf', content, 'application/pdf'))
            self.assertEqual(response.status_code, 201, response.text)
            self.assertIn('invalid_cv', response.json()['missing_information'])

    def test_complete_application_and_clearing_fields(self):
        c = self.intake({'branch_id': '1', 'position': 'HR'}, ('cv.pdf', pdf_bytes(), 'application/pdf')).json()
        self.assertTrue(c['is_complete'])
        response = self.client.patch('/api/candidates/'+c['id'], json={'branch_id': None, 'position': None})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()['missing_information'], ['missing_city', 'missing_position'])
        self.assertEqual(self.client.patch('/api/candidates/'+c['id'], json={'status': None}).status_code, 422)

    def test_unknown_branch_and_real_email_rejected(self):
        self.assertEqual(self.intake({'branch_id': '999'}).status_code, 404)
        self.assertEqual(self.intake({'email': 'anna@real-company.com'}).status_code, 400)
        self.assertEqual(self.client.get('/api/candidates').json()['total'], 0)

    def test_follow_up_preview_is_polish_read_only_and_updates(self):
        c = self.intake().json()
        preview = c['follow_up_email']
        self.assertEqual(preview['status'], 'draft_only')
        self.assertEqual(preview['recipient'], 'anna@example.com')
        self.assertIn('prośba o uzupełnienie', preview['subject'])
        self.assertIn('dokument CV', preview['body'])
        self.assertIn('miasto / oddział', preview['body'])
        self.assertIn('nazwa stanowiska', preview['body'])
        for _ in range(3):
            current = self.client.get('/api/candidates/'+c['id']).json()
            self.assertEqual(current['follow_up_email'], preview)
            self.assertEqual(current['updated_at'], c['updated_at'])
        self.assertEqual(self.client.get('/api/candidates').json()['total'], 1)
        changed = self.client.patch('/api/candidates/'+c['id'], json={'branch_id': 1, 'position': 'HR'}).json()
        self.assertEqual(changed['follow_up_email']['missing_information'], ['missing_cv'])
        self.assertNotIn('miasto / oddział', changed['follow_up_email']['body'])
        completed = self.client.post('/api/candidates/'+c['id']+'/cv', files={'file': ('cv.pdf', pdf_bytes(), 'application/pdf')}).json()
        self.assertEqual(completed['follow_up_email']['status'], 'not_needed')
        self.assertIsNone(completed['follow_up_email']['body'])

    def test_follow_up_invalid_pdf_requests_readable_replacement(self):
        c = self.intake({'branch_id': '1', 'position': 'HR'}, ('cv.pdf', b'broken', 'application/pdf')).json()
        preview = c['follow_up_email']
        self.assertEqual(preview['missing_information'], ['invalid_cv'])
        self.assertIn('bez hasła', preview['body'])

    def test_oversized_file_rejected_without_creating_candidate(self):
        response = self.intake(attachment=('cv.pdf', b'x' * (5 * 1024 * 1024 + 1), 'application/pdf'))
        self.assertEqual(response.status_code, 413)
        self.assertEqual(self.client.get('/api/candidates').json()['total'], 0)


if __name__ == '__main__':
    unittest.main()
