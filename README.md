# SEKA Recruitment Management System

A recruitment management application designed to support SEKA’s HR team in reviewing candidates and organising applications across company branches.

The main workflow supports Mrs Agnieszka from HR, with company-wide access for HR managers and branch-specific views for branch managers.

## Current status

The application runs locally with a Next.js frontend, Laravel API, and PostgreSQL database hosted on Neon.

Core recruitment workflows are implemented. Microsoft Entra ID authentication, live mailbox integration, automatic email delivery, and production deployment remain planned.

Only fictional candidate data should be used in the current version.

## Features

- Recruitment dashboard with candidate totals and status distribution.
- Searchable candidate list.
- Filters by city, position, and recruitment status.
- Candidate profiles with contact details.
- Editable recruitment statuses and HR notes.
- Branch and position assignment.
- PDF CV upload and viewing.
- Sample email intake that creates candidate profiles.
- Detection of missing CVs, unreadable CVs, missing cities, and missing positions.
- Polish follow-up email previews requesting missing information.
- Polish and English interface with a saved language preference.
- Responsive layout for desktop and mobile screens.
- Simulated administrator, HR manager, and branch manager views.

## Technology

| Component | Technology |
|---|---|
| Frontend | Next.js, React, TypeScript, Tailwind CSS |
| Backend | Laravel, PHP |
| Database | PostgreSQL on Neon |
| PDF validation | smalot/pdfparser |
| Planned deployment | Docker; hosting to be confirmed |
| Planned authentication | Microsoft Entra ID |

The `backend` directory contains the earlier FastAPI implementation. The current frontend connects to the Laravel API in `backend-laravel`.

## Repository structure

```text
seka-recruitment/
├── frontend/          Next.js application
├── backend-laravel/   Current Laravel API
├── backend/           Earlier FastAPI implementation
└── README.md
```

## Requirements

- Git
- Node.js and npm compatible with the frontend dependencies
- PHP compatible with backend-laravel/composer.json
- Composer
- PostgreSQL database access
- PHP extensions required by Composer, including pdo_pgsql

Docker is planned for deployment and is not required for the current local setup.

## Local setup — Windows PowerShell

Run the frontend and backend in separate terminals.

### 1. Install backend dependencies

From the repository root:

```powershell
Set-Location .\backend-laravel
composer install

if (!(Test-Path .env)) {
    Copy-Item .env.example .env
    php artisan key:generate
}
```

### 2. Configure PostgreSQL

Edit `backend-laravel/.env` using your own database credentials:

```dotenv
APP_ENV=local
APP_DEBUG=true
APP_URL=http://localhost:8001

DB_CONNECTION=pgsql
DB_HOST=YOUR_NEON_HOST
DB_PORT=5432
DB_DATABASE=seka_laravel_dev
DB_USERNAME=YOUR_NEON_ROLE
DB_PASSWORD="YOUR_NEON_PASSWORD"
DB_SSLMODE=require
```

Use a separate development database. Never commit the actual `.env` file.

Clear cached configuration and run migrations:

```powershell
php artisan config:clear
php artisan migrate
```

The optional recruitment seeder creates fictional branches and candidates. It is restricted to the local environment and a database named `seka_laravel_dev`:

```powershell
php artisan db:seed --class=RecruitmentDemoSeeder
```

### 3. Start the Laravel API

From `backend-laravel`:

```powershell
php artisan serve --host=localhost --port=8001
```

Health endpoint:

```text
http://localhost:8001/api/health
```

### 4. Configure the frontend

In a second terminal, open the frontend directory from the repository root:

```powershell
Set-Location .\frontend
npm ci
```

Create `.env.local`:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:8001/api
```

Start the frontend:

```powershell
npm run dev
```

Open:

```text
http://localhost:3000
```

Use `localhost` consistently for both applications. The Laravel CORS configuration must allow `http://localhost:3000` and credentialed requests.

Restart the frontend after changing `.env.local`.

## Recruitment statuses

| API value | Polish label |
|---|---|
| new | Nowa aplikacja |
| review | W trakcie analizy |
| interview | Rozmowa kwalifikacyjna |
| hired | Zatrudniony |
| rejected | Odrzucony |

Application completeness is tracked separately from recruitment status.

## Role simulation

The current role selector demonstrates access rules without Microsoft login.

| Role | Current behaviour |
|---|---|
| Administrator | Company-wide recruitment access and an integration status overview |
| HR manager | Company-wide candidate viewing and editing |
| Branch manager | Read-only access to candidates assigned to the selected branch |

The role selector is freely selectable and is not authentication. Real user identities, trusted role assignments, and branch assignments must be connected before handling company data.

Administrator configuration and user management are not yet implemented.

## Email intake and missing information

The sample intake accepts fictional email addresses in the `example.com` domain.

An application can be recorded even when the CV, city, or position is missing. The system marks the missing information and prepares a Polish follow-up email preview.

Unreadable or invalid CV attachments are flagged for replacement.

Current limitations:

- No live mailbox is connected.
- Follow-up emails are previews and are not sent.
- Candidate replies are not automatically matched to existing applications.
- Automatic delivery, retries, and duplicate-message handling remain planned.

## CV handling

- PDF attachments up to 5 MB.
- PDF parsing checks whether a document can be read.
- Uploaded CVs use Laravel’s private local storage.
- CVs are served through API routes.
- Branch restrictions apply to CV access in the simulated branch view.

PDF parsing does not provide antivirus scanning. Deployment requires persistent private storage so uploads survive application rebuilds and restarts.

## Main API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /api/health | API health |
| GET | /api/dashboard | Recruitment statistics |
| GET | /api/branches | Available branches |
| GET | /api/positions | Available positions |
| GET | /api/candidates | Search and filter candidates |
| GET | /api/candidates/{id} | Candidate profile |
| PATCH | /api/candidates/{id} | Update recruitment information |
| POST | /api/intake/sample-email | Create a candidate from sample email intake |
| GET | /api/demo/context | Current simulated role |
| POST | /api/demo/context | Change simulated role |
| GET | /api/demo/admin-overview | Administrator integration overview |

To inspect all registered routes, including CV routes:

```powershell
php artisan route:list --path=api
```

## Verification

Build the frontend:

```powershell
Set-Location .\frontend
npm run build
```

Before presenting or deploying, verify:

- Polish and English switching across pages and after refresh.
- Search, filters, status totals, and candidate profiles.
- Saving HR notes, statuses, branch assignments, and positions.
- Uploading and viewing a valid CV.
- Missing and invalid attachment handling.
- Follow-up email previews.
- Branch manager restrictions, including direct profile and CV access.
- Desktop and mobile layouts.

## Troubleshooting

### Laravel uses the wrong database credentials

Windows environment variables can override Laravel’s `.env` values.

Check the username inherited by the terminal:

```powershell
Get-Item Env:DB_USERNAME -ErrorAction SilentlyContinue
```

If it belongs to another project, remove the inherited database overrides from the terminal used to start Laravel:

```powershell
@(
    "DB_CONNECTION",
    "DB_HOST",
    "DB_PORT",
    "DB_DATABASE",
    "DB_USERNAME",
    "DB_PASSWORD",
    "DB_URL"
) | ForEach-Object {
    Remove-Item "Env:$_" -ErrorAction SilentlyContinue
}

php artisan config:clear
```

Restart Laravel from that same terminal.

### The frontend cannot connect

Check that:

- Laravel is running on port 8001.
- NEXT_PUBLIC_API_URL is http://localhost:8001/api.
- Laravel CORS allows http://localhost:3000 with credentials.
- The frontend was restarted after environment changes.

### Artisan cannot be found

Run PHP Artisan commands from the `backend-laravel` directory.

## Remaining work

- Confirm hosting and deploy the application.
- Add Docker configuration and persistent private CV storage.
- Integrate Microsoft Entra ID.
- Assign trusted roles and branches to authenticated users.
- Connect the recruitment mailbox.
- Enable approved automatic missing-information requests.
- Handle candidate replies, retries, and duplicate messages.
- Implement administrator configuration and user management.
- Confirm retention, deletion, backup, and operational requirements with SEKA.
- Complete production access-control and workflow verification.

## Configuration and secrets

Keep database passwords, application keys, Microsoft credentials, uploaded CVs, and personal candidate data out of Git.

Commit safe configuration examples containing placeholders only.
