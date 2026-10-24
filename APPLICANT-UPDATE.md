# Applicant profile foundation

Based on main commit 54b279c. Review this patch on a feature branch.

This additive change groups submissions by trimmed, case-insensitive email.
Existing candidate rows now represent individual submissions and retain their
IDs, branch permissions, statuses, notes, and CV paths. Existing screens and
URLs remain compatible. Names and phone numbers remain on each submission
until the profile editor is implemented. An email address is a provisional
identity match, not proof that two submissions belong to the same person.

New API: GET /api/applicants/{applicant_id}. Candidate responses include
applicant_id. The new endpoint only includes submissions visible to the
current role; branch managers cannot see the applicant's other branches.

## Install (PowerShell, repository root)

Back up the development database first. Stop incoming writes during migration.
Do not use migrate:fresh or reset the database.

```powershell
git switch main
git pull --ff-only origin main
git switch -c feature/applicant-profiles
git apply --check .\seka-applicant-profiles.patch
git apply .\seka-applicant-profiles.patch
Push-Location .\backend-laravel
php artisan test --filter=ApplicantProfilesTest
php artisan migrate --pretend
php artisan migrate
php artisan route:list --path=api/applicants
Pop-Location
```

The tests use SQLite in memory as configured in phpunit.xml. Ensure testing
database overrides are active; never point tests at the deployed database.
Run tests before migrating the development database. The implementation was
reviewed statically here; PHP/Composer were unavailable, so these tests have
NOT been executed. If any command fails, stop and share its error.

Check two sample submissions using the same email: their candidate IDs must
differ and applicant_id must match. Fetch the applicant endpoint as HR and
then a branch manager to verify the appropriate visible submissions.

Not included yet: applicant profile UI, manual merge/split review, mailbox
integration, follow-up thread matching, custom permissions, and event history.
Uploading a replacement CV within one submission still uses the current
replacement behavior; this update preserves CVs across separate submissions.
