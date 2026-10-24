# Configurable roles and technical settings

Prerequisite: the configurable-status patch is installed. This patch is an
incremental update on top of that patch; it does not repeat status changes.

## Included

- System Admin: technical configuration only, without candidate access.
- Admin: recruitment, business role management, and status management.
- HR Manager and Branch Manager: seeded with their existing permissions.
- Custom business roles, e.g. Assistant: labels, company-wide or single-branch
  scope, and selected recruitment permissions. Archive/restore custom roles.
- Admin can edit HR Manager/Branch Manager business permissions and scope.
  These built-in roles remain active. Admin and System Admin are protected
  from editing, preventing escalation or accidentally removing all admins.
- Server checks on every API request, including each profile update field,
  CV routes, intake, and direct applicant/history URLs. Unknown API operations
  are denied by default. Branch filtering now applies to every branch-scoped
  role, not only the role called branch_manager.
- Login cards, navigation, field controls, and CV controls follow permissions.
  Permission changes take effect on the next API request. Refresh an already
  open interface to update its controls. If a role is archived or its scope
  changes, choose a role again via /login.
- System settings UI stores tenant/client IDs, redirect URL, AI provider/model,
  and write-only Microsoft client secret / AI key. Values are encrypted with
  Laravel APP_KEY; API responses expose only secret configured flags. Blank
  secret fields retain values; explicit clear actions remove them.
- Health no longer depends on a selected role or checks the branch database.
  Use role context or recruitment endpoints to check database connectivity.

## Deliberate limits

This remains role simulation, not authentication. Any viewer can select a role.
Use fictional candidates and fictional integration secrets only. Existing
Entra login, AI extraction, mailbox intake, email sending, and real employee
role/branch assignments are NOT activated by saving this configuration.

Business roles always require applications.view. CV upload requires cv.view.
Branch-scoped roles cannot create intake or reassign branches in this version.
Administrative permissions are not assignable to custom business roles.
Multiple branch assignments and task delegation remain separate work.
No existing application/CV/history data is changed by this migration.

Keep APP_KEY stable and back it up securely with the encrypted database. Do not
regenerate it after storing settings. Real configuration must wait until demo
role selection is removed and actual authentication is enforced.

## Install (PowerShell, repository root)

Create feature/configurable-roles from the current status-update branch if
needed. Uncommitted status changes can stay in place; never reset them.

```powershell
git switch -c feature/configurable-roles
git apply --check "$HOME\Downloads\seka-configurable-roles.patch"
git apply "$HOME\Downloads\seka-configurable-roles.patch"
Push-Location .\backend-laravel
php artisan test
Pop-Location
Push-Location .\frontend
npm run build
Pop-Location
```

Tests force APP_ENV=testing and SQLite :memory: in phpunit.xml, protecting the
development/production database from inherited Windows connection overrides.
New tests cover custom-role isolation, per-field permissions, immediate
revocation, administrator separation, and encrypted/hidden/clearable secrets.
PHP/Composer are unavailable in the authoring environment, so PHP tests have
NOT been executed there. Production build and TypeScript passed on Next 16.4.3.

If git apply --check fails, stop and send the output; do not force the patch.
If the feature branch exists, switch to it instead of creating it.

## Migrate only after all tests pass

Stop Laravel and back up the development database. In the backend terminal
where Neon credentials work:

```powershell
php artisan migrate:status
php artisan migrate
php artisan serve --host=localhost --port=8001
```

The new migration creates recruitment_roles and recruitment_settings. It keeps
application data intact. Automatic rollback is deliberately blocked so custom
role definitions and encrypted settings cannot be silently dropped. Recovery
requires a backup or reviewed corrective migration, not migrate:fresh/reset.

Restart frontend separately and open http://localhost:3000/login.

1. Admin -> /admin/roles: create assistant, branch scope, View applications and
   Edit HR notes. Do not grant Open CV unless desired.
2. Change role -> Assistant -> Warszawa. Only that branch is visible; notes
   can be changed; status and position are disabled; CV access is unavailable
   unless granted. Direct requests must also be denied.
3. Admin: change Assistant permissions or archive it. Reload the Assistant
   view to see revocation or choose a new role.
4. System Admin -> /system/settings: save a fictional AI key. It shows only
   Configured. Reload and verify the secret field stays empty. Test clearing.
5. Verify Admin cannot open system settings; System Admin cannot open roles,
   statuses, or candidate data; HR/Branch Manager retain existing workflows.

## Added/changed endpoints

GET /api/demo/catalog: simulation login metadata, recovers from stale cookies.
GET/POST /api/demo/context: dynamic role context and selection.
GET/POST /api/admin/roles, PATCH /api/admin/roles/{code}: Admin only.
GET/PATCH /api/system/settings: System Admin only.
Existing endpoints now enforce business permission checks centrally.
