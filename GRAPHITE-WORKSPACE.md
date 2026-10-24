# SEKA graphite workspace

Apply after the ownership/tasks update. This patch changes frontend presentation only; no backend migration or package installation is needed.

## Design

- One graphite stylesheet replaces globals.css plus the old workspace-v2.css/tasks.css layers.
- Compact sidebar, table controls, status labels, inbox, task forms, and expandable administration editors.
- Small demo access screen retains fictional employee and role preview modes.
- /applications provides a submission register and an embedded candidate inspector. The full profile remains available with related submissions.
- Inspector tabs reuse the existing CV, process, correspondence, work, and history components and permissions.
- Switching the selected submission prompts when the inspector contains unsaved changes. Saved application fields update its register row.
- Polish/English and mobile layouts remain available.

## Apply (PowerShell, repository root)

```powershell
git switch -c feature/graphite-workspace
git apply --check "$HOME\Downloads\seka-graphite-workspace.patch"
git apply "$HOME\Downloads\seka-graphite-workspace.patch"
Push-Location .\frontend
npm run build
npm run dev
```

Stop the current frontend server before building. Keep Laravel running separately. Do not run database migrations for this patch.

## Review

Open /login, /, /applications, /inbox, /tasks, /admin/statuses, and /admin/roles with suitable demo permissions. Check selection, filters, notes/status saves, CV access, drafts, ownership/tasks, and the full profile. Check both languages and a narrow viewport.

The mailbox remains simulated; saved replies remain drafts. Demo entry remains role/account simulation rather than authentication. Real Microsoft configuration and email integration are separate work.

## Validation

Production build and TypeScript checks pass. Chromium smoke checks use a mocked API to verify seven redesigned screens, application selection, responsive width, and browser errors. These checks do not replace testing against your Laravel database. Backend files are unchanged.
