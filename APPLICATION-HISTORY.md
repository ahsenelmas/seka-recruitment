# Application history

Based on main adcd957. This update requires the existing applicant-profile migration.

Adds GET /api/candidates/{id}/history, paginated newest first (30 per page).
The controller resolves the candidate through the branch scope before querying
history. The History tab reloads when opened and after candidate saves.

Records application creation, status/branch/position changes, HR note changes,
and accepted CV attachments. Each event includes a timestamp and simulated
role or system actor. No authenticated person is claimed. Private note text
and storage keys are excluded. Earlier events are not reconstructed.

Candidate::save and its history inserts share a transaction. Direct SQL,
Eloquent bulk updates, and saveQuietly bypass observers: future mailbox or
admin workflows must use model saves or explicitly record their events.
Deleting an application cascades to history; this is an activity timeline,
not a tamper-proof compliance audit log. Branch changes show branch IDs.

## Apply from repository root (PowerShell)

```powershell
git switch -c feature/application-history
git apply --check "$HOME\Downloads\seka-application-history.patch"
git apply "$HOME\Downloads\seka-application-history.patch"
Push-Location .\backend-laravel
php artisan test --filter=ApplicationHistoryTest
php artisan test --filter=ApplicantProfilesTest
Pop-Location
Push-Location .\frontend
npm run build
Pop-Location
```

If the feature branch already exists, switch to it instead of creating it.
Tests are configured for SQLite in memory in phpunit.xml. Clear inherited
DB_* environment overrides before running tests as needed, and never run tests
against the company database. PHP tests could not be executed in the authoring
environment (PHP/Composer unavailable). Frontend TypeScript checks passed.

After tests pass, back up the development database, stop the backend, then:

```powershell
Push-Location .\backend-laravel
php artisan migrate:status
php artisan migrate
php artisan serve --host=localhost --port=8001
```

Use the terminal with the correct Neon environment configuration. Restart
frontend separately. Change a status, save, then open History. A new event
should show previous/new status and the simulated role. Upload a PDF to see a
CV event. A branch manager must get 404 for another branch's history URL.
An old application starts with an empty history until a tracked change occurs.

Live mailbox sending, custom roles/statuses, and real Microsoft authentication
are separate milestones.
