# P01 setup and safe upgrade

## Existing Ahsen repository (recommended)

1. Back up PostgreSQL and private CV storage. Preserve the current `backend-laravel/.env`, `frontend/.env.local` and **APP_KEY**. Changing APP_KEY makes existing encrypted configuration unreadable.
2. Extract the delivered package. From your existing repository run the included `Apply-P01.ps1` with its full extracted path. It checks a clean working tree and patch applicability, creates a new branch and applies the patch. It does not migrate your database or overwrite secrets.
3. In `backend-laravel`: run `composer install`, `php artisan config:clear`, then inspect `php artisan migrate --pretend` on a backed-up staging database. After reviewing the SQL, run `php artisan migrate`. Use PHP 8.5 and required extensions, including PDO PostgreSQL, mbstring, fileinfo and XML.
4. Run `php artisan test`. Tests use isolated in-memory SQLite, not Neon. Make a PostgreSQL staging acceptance pass separately.
5. In `frontend`: run `npm ci` and `npm run build` with Node 22. Keep `NEXT_PUBLIC_API_URL=http://localhost:8001/api` for the existing two-server development setup.
6. Start Laravel with `php artisan serve --port=8001`, and Next in another terminal with `npm run dev`. Reuse an existing running server instead of starting a second one.

Do not run `migrate:fresh`, drop existing tables or replace your configured .env with the example. The new migration preserves existing applications/documents but changes email/city unique constraints. Its rollback intentionally refuses destructive reversal: restore a verified backup or write a corrective migration.

If you already applied some P01 code, stop when the patch check fails; do not force it. The `source/` folder is a clean reference snapshot, not an instruction to copy over your working directory.

## Local demonstration

Use `APP_ENV=local`, `SEKA_AUTH_MODE=demo`, `SEKA_FRONTEND_URL=http://localhost:3000`. `php artisan db:seed --class=P01DemoSeeder` optionally adds fictional example.com records to a **local demonstration database only**. Existing sample seeding is not required. Do not seed a real SEKA database.

The revised login lets you choose a fictional employee. Azure mode ignores demo cookies and removes simulated intake/account switching. Outside local/testing, demo mode is disabled unless explicitly enabled; never enable it for real candidate data.

## Entra staging setup (professor / SEKA administrator)

Set `SEKA_AUTH_MODE=entra`, tenant/client IDs, client secret, exact `ENTRA_REDIRECT_URI`, HTTPS `APP_URL` and `SEKA_FRONTEND_URL`. Register a confidential web client and the callback `/api/auth/entra/callback`. Configure the six business role values in `config/p01.php`: SEKA.TechnicalAdmin, SEKA.HRCoordinator, SEKA.UnitDirector, SEKA.DeputyDirector, SEKA.HRSupport, SEKA.QualificationsDirector.

Provision units using the technical configuration page. A unit director additionally needs `SEKA.Unit.<stable-unit-code>` in roles. This is a proposed integration contract requiring SEKA approval. Roles are not assigned from the application. Test a real tenant before acceptance, including rejected roles, logout, expired sessions and cross-unit access. Configure HTTPS/proxy trust for your actual ingress. The settings form stores draft encrypted configuration; active providers currently read server environment values.

## Incoming mail adapter

Set a random `SEKA_INGEST_KEY` of at least 32 characters. The authorized adapter POSTs JSON to `/api/mailbox/ingest` with header `X-SEKA-Ingest-Key`. Fields: `message_id` (stable provider ID), `sender`, `subject`, `body`, optional `attachments` array of `{filename, base64}`. Inspect controller validation before connecting a provider. Up to five PDF/JPEG/PNG documents, 5 MB each and 15 MB combined. Use HTTPS, do not put the key in frontend code, and rotate it securely.

Provider IDs are idempotent and conflicting retries are rejected. Messages are quarantined for human review. Accepted new submissions remain independent. HR may explicitly link an incoming reply to an existing application after the sender matches. Microsoft Graph/IMAP polling, header-based threading, AI triage and malicious-document scanning must be supplied/approved separately. Private application attachments require scoped API authorization and are served as downloads.

## Outbound email

Sending is disabled by default. Configure Laravel SMTP server credentials and `MAIL_MAILER=smtp`, then set `SEKA_MAIL_ENABLED=true` only in an authorized staging environment. The server fixes From and Reply-To to kariera@seka.pl. Verify sender permission, SPF/DKIM/DMARC and reply routing with SEKA. Saving a draft never sends it. A send marked `delivery_uncertain` must be reconciled against SMTP logs rather than blindly retried. Automated rejection/board messages and provider delivery receipts are not implemented.

## Retention and operations

Agree `SEKA_RETENTION_DAYS` and `SEKA_CONSENT_RETENTION_DAYS` first. `php artisan seka:purge` is a dry run. Actual removal additionally requires `SEKA_RETENTION_ENABLED=true` and `php artisan seka:purge --execute`. Review counts, consent evidence and backups before enabling the daily scheduler. `php artisan seka:cleanup-files` retries file deletions already authorized by record removal. Scheduled purge runs at 02:15 Europe/Warsaw only when enabled. Keep storage volumes persistent. Do not treat successful database deletion as proof that backup/provider copies have expired.

## Optional Docker handoff for professor

This is a local compose draft, not an executed deployment. Copy `.env.docker.example` to `.env.docker`, generate a persistent Laravel APP_KEY and random PostgreSQL password, keep both private. Run `docker compose --env-file .env.docker config`, then `docker compose --env-file .env.docker up --build -d`. A separate local PostgreSQL volume is created; it does not connect to Neon. Open http://localhost:8080. The frontend uses same-origin `/api`.

Optional fictional seeding: `docker compose --env-file .env.docker exec backend php artisan db:seed --class=P01DemoSeeder`. Check logs, health, persistence and `GET /api/health`. The optional `operations` profile starts the scheduler. Never remove volumes containing data. Compose defaults disable mail/retention and are not a production configuration. Pin reviewed image digests, configure TLS/backups/monitoring and pass staging checks before deployment.

## Review checklist

Run all backend tests, frontend build, PostgreSQL migrations on a disposable staging clone, role-isolation tests for six Azure accounts, a real incoming/reply cycle, file authorization, SMTP failure reconciliation and retention dry run. Resolve [P01-REQUIREMENTS.md](P01-REQUIREMENTS.md) open decisions. Deployment remains the professor's responsibility.
