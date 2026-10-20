import unittest
import test_incomplete as fixture
from test_incomplete import pdf_bytes
from sqlalchemy.orm import Session
from app.models import Branch


class RoleTests(unittest.TestCase):
    intake = fixture.IntakeTests.intake
    tearDown = fixture.IntakeTests.tearDown
    def setUp(self):
        fixture.IntakeTests.setUp(self)
        with Session(self.engine) as db:
            db.add(Branch(id=2, city='Kraków', name='SEKA Kraków'))
            db.commit()
        self.warsaw = self.intake({'branch_id': '1', 'position': 'Warszawa only'}, ('cv.pdf', pdf_bytes(), 'application/pdf')).json()
        self.krakow = self.intake({'branch_id': '2', 'position': 'Kraków only'}, ('cv.pdf', pdf_bytes(), 'application/pdf')).json()
        self.unassigned = self.intake().json()

    def select(self, role, branch_id=None):
        response = self.client.post('/api/demo/context', json={'role': role, 'branch_id': branch_id})
        self.assertEqual(response.status_code, 200, response.text)

    def test_branch_scope_all_read_endpoints(self):
        self.select('branch_manager', 1)
        listing = self.client.get('/api/candidates').json()
        self.assertEqual(listing['total'], 1)
        self.assertEqual(listing['items'][0]['id'], self.warsaw['id'])
        summary = self.client.get('/api/dashboard').json()
        self.assertEqual(summary['total'], 1)
        self.assertEqual(summary['unassigned'], 0)
        self.assertEqual([b['city'] for b in summary['by_branch']], ['Warszawa'])
        self.assertEqual(self.client.get('/api/positions').json(), ['Warszawa only'])
        self.assertEqual([b['id'] for b in self.client.get('/api/branches').json()], [1])
        self.assertEqual(self.client.get('/api/candidates?city=Kraków').json()['total'], 0)
        for other in [self.krakow, self.unassigned]:
            self.assertEqual(self.client.get('/api/candidates/'+other['id']).status_code, 404)
            self.assertEqual(self.client.get('/api/candidates/'+other['id']+'/cv').status_code, 404)
        self.assertEqual(self.client.get('/api/candidates/'+self.warsaw['id']).status_code, 200)
        self.assertEqual(self.client.get('/api/candidates/'+self.warsaw['id']+'/cv').status_code, 200)

    def test_branch_cannot_mutate_even_with_direct_requests(self):
        self.select('branch_manager', 1)
        for c in [self.warsaw, self.krakow]:
            self.assertEqual(self.client.patch('/api/candidates/'+c['id'], json={'hr_notes': 'blocked'}).status_code, 403)
            self.assertEqual(self.client.post('/api/candidates/'+c['id']+'/cv', files={'file': ('cv.pdf', pdf_bytes(), 'application/pdf')}).status_code, 403)
        self.assertEqual(self.intake().status_code, 403)
        self.select('hr_manager')
        self.assertEqual(self.client.get('/api/candidates').json()['total'], 3)
        self.assertEqual(self.client.get('/api/candidates/'+self.warsaw['id']).json()['hr_notes'], self.warsaw['hr_notes'])

    def test_hr_and_admin_company_access_and_admin_endpoint(self):
        for role in ['hr_manager', 'admin']:
            self.select(role)
            self.assertEqual(self.client.get('/api/candidates').json()['total'], 3)
            self.assertEqual(self.client.get('/api/dashboard').json()['unassigned'], 1)
            self.assertEqual(self.client.patch('/api/candidates/'+self.krakow['id'], json={'hr_notes': role}).status_code, 200)
            self.assertEqual(self.client.get('/api/demo/admin-overview').status_code, 200 if role == 'admin' else 403)
        self.select('branch_manager', 2)
        self.assertEqual(self.client.get('/api/candidates').json()['items'][0]['id'], self.krakow['id'])
        self.assertEqual(self.client.get('/api/demo/admin-overview').status_code, 403)

    def test_invalid_context_fails_closed(self):
        self.assertEqual(self.client.post('/api/demo/context', json={'role': 'branch_manager'}).status_code, 422)
        self.assertEqual(self.client.post('/api/demo/context', json={'role': 'branch_manager', 'branch_id': 999}).status_code, 404)
        self.client.cookies.set('seka_demo', 'invalid:')
        self.assertEqual(self.client.get('/api/candidates').status_code, 400)

    def test_cookie_and_cors(self):
        response = self.client.post('/api/demo/context', json={'role': 'branch_manager', 'branch_id': 1})
        cookie = response.headers['set-cookie']
        self.assertIn('HttpOnly', cookie)
        self.assertIn('SameSite=lax', cookie)
        response = self.client.options('/api/demo/context', headers={'Origin': 'http://localhost:3000', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers['access-control-allow-credentials'], 'true')
        self.assertEqual(response.headers['access-control-allow-origin'], 'http://localhost:3000')
