# Configurable recruitment statuses

Based on main 9c715e2 (application history merged). This patch does not change
secrets, uploaded documents, or dependencies. Frontend production build passed
with the repository's installed Next.js 16.4.3 lockfile. PHP runtime tests could
not be executed here because PHP/Composer are unavailable.

## Behaviour

Admin can create statuses, edit Polish/English labels and colour, reorder,
archive, and reactivate. Codes are immutable. Status `new` stays active because
sample email intake uses it. There is no destructive delete action.

Archiving preserves assigned applications and history. Archived statuses stay
in filtering and reporting. Existing applications with an archived status can
still be edited without changing that status; assigning it elsewhere is blocked.
Dashboard, profile, related applications, and history fetch configured labels.
History uses current labels for stored status codes. Refresh an already-open
screen after changing configuration in another tab.

The existing simulated Admin role controls write access; this is not real
Microsoft authentication. System Admin/Admin separation is a later milestone.

## Apply (PowerShell, repository root)

```powershell
git switch main
git pull --ff-only origin main
git switch -c feature/configurable-statuses
git apply --check "$HOME\Downloads\seka-configurable-statuses.patch"
git apply "$HOME\Downloads\seka-configurable-statuses.patch"
Push-Location .\backend-laravel
php artisan test --filter=RecruitmentStatusesTest
php artisan test --filter=ApplicationHistoryTest
php artisan test --filter=ApplicantProfilesTest
Pop-Location
Push-Location .\frontend
npm run build
Pop-Location
```

Use the testing SQLite in-memory database from phpunit.xml. Clear inherited
DB_* overrides in the test terminal if necessary. Never run tests against the
company database. Stop on a failing test and share the error.

## Development database migration (only after tests pass)

Stop the backend and back up the development database. The migration preserves
existing status codes, seeds their editable labels, replaces the fixed enum
constraint with a status-table foreign key, and supports PostgreSQL/SQLite.
Because later custom labels and statuses cannot be safely translated back into
the old enum, automatic rollback is deliberately blocked. Recovery requires
a reviewed corrective migration or restoring the pre-migration backup. Do not
run migrate:fresh, reset, or rollback on the development or deployed database.

In the terminal with the correct Neon configuration:

```powershell
Push-Location .\backend-laravel
php artisan migrate:status
php artisan migrate
php artisan serve --host=localhost --port=8001
```

Restart frontend separately. Enter as Administrator and open
http://localhost:3000/admin/statuses (also linked in the sidebar).
Create `on_hold` with labels `Wstrzymana` / `On hold`, assign it to an application,
check filtering and dashboard counts, rename the labels, reorder, and archive.
Confirm the application retains its status, another application cannot select
that archived status, and HR/Branch Manager cannot edit configuration.

## API

- GET /api/statuses: all statuses, ordered, including archived.
- POST /api/admin/statuses: code, label_pl, label_en, color.
- PATCH /api/admin/statuses/{code}: labels, color, is_active.
- POST /api/admin/statuses/reorder: codes array containing every code once.

Codes: lowercase letter followed by lowercase letters, digits, underscores,
up to 50 characters. Colours are six-digit hex. Application updates continue
to record status changes in the existing application history.
