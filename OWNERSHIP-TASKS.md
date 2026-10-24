# Fictional employee entry, application ownership, and delegation

Based on main dea3aef (inbox and display fixes merged).

## What is included

- Existing simulated role preview remains available. The login page now defaults
  to fictional employee accounts: Demo HR, Demo Admin, Demo System Admin, and
  one Demo Manager / Demo Assistant for each existing branch at migration time.
  No passwords and no verified identity. These are demonstration accounts only.
- A demo employee cookie references the stored employee; role and branch are
  derived on every API request. Altering the old role cookie cannot change the
  selected employee's role. Switching to role preview expires the employee
  cookie. Invalid or inactive accounts can recover through the entry page.
- An Owner & Tasks tab on each application. Eligible owners/assignees must be
  active, have an active role with application viewing, and have access to the
  application's current branch. System Admin is not eligible for recruitment.
- Versioned ownership and follow-up calendar date; tasks with title, description,
  assignee, due date, open/done/cancelled state, completion/reopening, and history.
- Stable UUIDs prevent duplicate task creation on retry. Version checks reject
  stale edits. Branch transfers clear incompatible owners and open-task
  assignments, with history; completed-task assignments remain historical.
- /tasks lists accessible tasks with state, overdue, and My tasks filters.
  Deadlines are calendar dates; overdue means an open task due before today's
  date in Europe/Warsaw. There are no email reminders or background alerts yet.
- New permissions: tasks.view, tasks.manage, tasks.complete, work.assign.
  Admin/HR receive all. Branch Manager receives viewing only, preserving its
  default read-only workflow. New Demo Assistant has branch-scoped viewing,
  note editing, correspondence viewing, and completion of its own tasks only.
  Existing custom roles receive no automatic new permissions.
- Role preview has no personal identity, so My tasks is unavailable there.
  Task managers can manage all tasks they can access. A non-manager with
  tasks.complete can only complete/reopen its own tasks using a demo employee.
- New CSS is imported separately to retain the working workspace styling.

## Not included

Real password login, Microsoft Entra authentication, real employee directory
administration, employee onboarding/deactivation UI, multiple branches per
employee, actual SEKA account assignments, mailbox delivery, notifications,
or automatic reminders. The demo employee table deliberately stays separate
from future trusted user identities. Keep using fictional data and keys.
If branches are added later, provisioning their fictional accounts is not yet
exposed in the UI. Role preview can still demonstrate those branches.

## Checks

Production frontend build and TypeScript checked in the authoring environment.
PHP/Composer are unavailable there: backend tests have NOT been executed there.
Added ApplicationWorkTest covers eligibility, versions, duplicate creates,
branch isolation, own-task completion, role-cookie tampering, disabled accounts,
and safe reassignment on branch transfer. Existing tests remain in place.

## Install (PowerShell, repository root)

```powershell
git switch main
git pull --ff-only origin main
git switch -c feature/ownership-tasks
git apply --check "$HOME\Downloads\seka-ownership-tasks.patch"
git apply "$HOME\Downloads\seka-ownership-tasks.patch"
Push-Location .\backend-laravel
php artisan test
Pop-Location
Push-Location .\frontend
npm run build
Pop-Location
```

Do not force a failed patch or reset uncommitted changes. Share any error.
Tests use the forced SQLite in-memory configuration in phpunit.xml. They must
not use the deployed company database.

After tests pass, stop the backend and back up the development database. Use
the backend terminal with working Neon credentials:

```powershell
php artisan migrate:status
php artisan migrate
php artisan serve --host=localhost --port=8001
```

The migration adds demo_employees, application_tasks, ownership fields, and the
Demo Assistant role. Existing applications, documents, and conversations are
preserved. Automatic rollback is blocked to preserve assignments and tasks;
use a reviewed corrective migration or backup if needed, not reset/fresh.

## Review locally

1. Restart frontend separately. Open /login and choose fictional Demo HR.
2. Open an application -> Owner & Tasks. Assign its branch's Demo Assistant as
   owner and choose a follow-up date. Save and refresh to verify persistence.
3. Create a task for that assistant, optionally due yesterday to see Overdue.
4. Change account to the same Demo Assistant. Open /tasks -> My tasks. Complete
   the task, then reopen it. Other employees' tasks must not be completable.
5. Branch Manager can view its branch tasks but cannot create/edit/complete by
   default. System Admin cannot access tasks or recruitment data.
6. HR can reassign/cancel/restore tasks. Move an application to another branch
   and verify incompatible open assignments are cleared with history.
7. Check stale edits in two tabs: the second save gets 409. Reload before
   retrying; unsaved changes have browser/tab-navigation warnings.
8. Check Polish/English and narrow mobile layout, then save the milestone.

## API

POST /api/demo/employee {employee_id}; GET /api/demo/catalog includes demo seats.
GET /api/demo/context includes the selected fictional employee or null.
GET /api/candidates/{id}/work?page=1
PATCH /api/candidates/{id}/work {version, owner_employee_id, follow_up_on}
POST /api/candidates/{id}/tasks {client_id, title, description?, due_on?, assignee_employee_id?}
PATCH /api/candidates/{id}/tasks/{taskId} {version, changed fields...}
GET /api/tasks?state=open|done|cancelled&mine=1&overdue=1&page=1
