# SEKA Recruitment — P01 update

Laravel 13 / PostgreSQL / Next.js recruitment workspace, updated against the SEKA technical document received 3 November 2026. This is a reviewable implementation, not a claim of production acceptance.

Start with [P01-SETUP.md](P01-SETUP.md). The implementation and remaining decisions are mapped in [P01-REQUIREMENTS.md](P01-REQUIREMENTS.md).

## What changed

- A new light workspace with navy navigation, teal actions, compact tables and application panels, in Polish and English.
- Each submission is independent, including repeat submissions from one address. Existing legacy applicant links are retained only for migration compatibility; grouping is no longer exposed.
- Recruitment statuses map to New / In progress / Finished. Process fields cover ownership, interviews, HR support, qualification checks and retention consent evidence.
- Separate attributed notes, structured contact events, technical audit history and per-user notifications.
- Six P01 roles, unit scope and explicit application grants; separate initial qualification opinions and confirmation decisions.
- Microsoft Entra code-flow integration and server sessions; Azure controls employee roles. Local fictional demo sign-in remains available.
- Quarantine intake, multiple private attachments, reviewed acceptance, manual entry and explicit email reply sending from kariera@seka.pl.
- Retention dry run, opt-in deletion and durable file cleanup.

The earlier FastAPI `backend/` is historical. Current application code is in `backend-laravel/` and `frontend/`. Older feature markdown files describe previous milestones; the P01 documents supersede conflicting applicant-grouping, role-assignment and graphite-design guidance.

## Verification

60 backend tests / 320 assertions passed on PHP 8.5.12 with SQLite. Production frontend compilation and TypeScript checks passed. Real Laravel/frontend browser checks covered sign-in, application list, process updates, notes, contacts, intake acceptance and five mobile pages. Composer audit reported no known advisories at verification time.

PostgreSQL and Docker execution, a real Microsoft tenant, live SMTP and an incoming mailbox provider have not been exercised here. AI/provider security choices and several business policies require SEKA approval. See the requirements matrix before using real candidate data.
