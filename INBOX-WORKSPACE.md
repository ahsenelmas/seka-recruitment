# Shared inbox and workspace redesign

Based on main bbdfd5b (configurable roles/statuses merged).

## Included

- Compact navy navigation with consistent SVG icons and a lighter work area.
- Dashboard promotional hero replaced with a compact title. Action cards show
  missing information, unassigned applications, saved drafts, and conversations.
  Counts come from the scoped API, with working filter actions.
- /inbox: conversation list, search by name/email/subject, branch filters,
  draft/incomplete filters, pagination, selected conversation, and draft editor.
- Each application's Correspondence view uses the same conversation component.
- Existing source emails are copied into application_messages by the migration.
  Applications without source emails do not get invented conversations.
- Future sample intake captures its source message in the same transaction as
  the application/history. A fictional follow-up can be added to a known
  application with an example.com address by authorised company-wide intake
  roles. Text only; it does not import attachments or update extracted fields.
- Drafts always use sender kariera@seka.pl and the selected applicant's address.
  No Send action, transport, queue, queued/sent badge, or actual email delivery.
- Stable client UUIDs prevent duplicate creates on a retry; draft version checks
  reject stale edits with 409. Drafts are deliberately separate per application,
  even if two applications share an applicant profile.
- Message events are recorded in application history without copying body text.
- New permissions: correspondence.view and correspondence.draft. Admin and HR
  get both; Branch Manager gets viewing only. Existing custom roles get no new
  grants automatically. Admin can explicitly grant them. Drafting requires
  applications.view and correspondence.view; every message operation also checks
  branch scope through the application. System Admin has no inbox access.
- Without correspondence.view, original email subject/body are redacted from
  candidate JSON too. Missing-information templates remain application metadata.
- New roles/edit controls support the added permissions. Refresh an existing
  session after migration so current permissions are loaded.

## Verification performed here

Next.js 16.4.3 production build and TypeScript passed. PHP/Composer are not
available in the authoring environment, so backend tests have NOT been run.
Browser visual/interaction checks could not complete because the browser
binary download failed. Review desktop and mobile after installing.

## Install from the project root (PowerShell)

First finish/merge the role/status update if it is not already on main. Do not
reset uncommitted work. This patch targets the merged role/status code.

```powershell
git switch main
git pull --ff-only origin main
git switch -c feature/inbox-workspace
git apply --check "$HOME\Downloads\seka-inbox-workspace.patch"
git apply "$HOME\Downloads\seka-inbox-workspace.patch"
Push-Location .\backend-laravel
php artisan test
Pop-Location
Push-Location .\frontend
npm run build
Pop-Location
```

Stop if a patch check or test fails and share the error. Tests use the forced
SQLite in-memory configuration from phpunit.xml, not the development database.
The added ApplicationMailboxTest covers thread isolation, fixed-sender drafts,
no delivery, idempotency, version conflicts, permissions, source-email
redaction, pagination, and rollback. Existing tests remain in place.

## Migration after tests pass

Stop Laravel and back up the development database. The migration creates
application_messages, copies the existing source email on each application,
and adds correspondence permissions to the built-in roles above. Application
IDs, applicant grouping, CV files, notes, and statuses remain unchanged.
Automatic rollback is blocked to avoid dropping conversations/drafts.

Use the backend terminal where Neon credentials work:

```powershell
php artisan migrate:status
php artisan migrate
php artisan serve --host=localhost --port=8001
```

Restart frontend separately. Open http://localhost:3000/login and enter again.
Choose HR Manager, then Inbox. If empty, use Email intake to add a fictional
example.com application; do not reset or reseed the database.

## Manual review

1. Desktop: open Inbox, select a conversation, inspect source email and profile.
2. Create a reply, save as draft, refresh, and confirm it persists as NOT SENT.
3. Edit that draft. A second editor's stale version must get 409 instead of
   overwriting. Refresh conversation to load current saved messages; unsaved
   composer text remains local until explicitly changed/discarded.
4. Try changing conversations/tabs with unsaved changes; the UI should warn.
   Browser reload/navigation uses the browser's normal unsaved-change prompt.
5. Use the Polish missing-information template if available; save the draft.
6. Add a fictional incoming text reply to the chosen application. This is a
   manual simulation, not automatic matching from a real mailbox.
7. Branch Manager: only their branch's conversations, no reply-draft editing.
8. Admin: optionally grant Assistant correspondence view/draft; test scope and
   direct API denial for other branches. System Admin cannot view messages.
9. Test Polish/English and narrow mobile layout, including scrolling to the
   conversation after selecting a row. No horizontal page overflow should occur.

## API

GET /api/inbox?filter=all|drafts|incomplete&search=...&city=...&page=1
GET /api/candidates/{id}/messages?page=1
POST /api/candidates/{id}/messages: client_id UUID, subject, body
PATCH /api/candidates/{id}/messages/{messageId}: version, subject, body
POST /api/candidates/{id}/messages/sample-incoming: client_id UUID, subject, body

Sender, recipient, direction, source, and delivery status cannot be supplied by
clients. Messages are plain text and safely rendered as text, not HTML.
An application's timeline uses its current branch access rules.

## Remaining work

Real Microsoft 365 mailbox permissions/adapter, delivery and retries, provider
message deduplication, reply-thread matching, attachment processing, employee
identity/assignments, draft deletion/retention rules, and final production
access-control verification. Stored integration settings do not activate these.
