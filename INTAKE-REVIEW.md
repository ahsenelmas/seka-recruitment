# Email and CV intake review

Built against the uploaded seka-intake-source.zip. This update changes the existing internal /intake demonstration screen, not the candidate's workflow. Candidates still email spontaneous applications without a public form.

## Behaviour

1. HR enters a fictional sender, original subject/body and optional PDF.
2. Find suggestions previews explicit first/last-name and position labels and branch-city mentions from the email and up to five PDF pages / 20,000 CV characters.
3. Suggestions show a short evidence excerpt and email/CV source. Multiple differing values produce a conflict, leaving that field unset. City mentions are not an inference of preferred work location.
4. HR applies individual suggestions, confirms overwriting existing values, or edits the existing intake fields manually. Source changes invalidate the preview and cancel in-flight requests.
5. HR checks a confirmation box before the existing create action. Preview never creates an applicant, application, document or message; save uses the existing intake endpoint and validation.

## Deliberate limits

- Deterministic local rules, not an AI integration. No new API keys or services needed.
- Names require explicit Imię:/Nazwisko: or First name:/Last name:/Surname: labels; position requires Stanowisko:/Position:/Role:. Unlabelled prose, inflections, employment intent and name signatures are not interpreted.
- City matching uses existing branch names, with accent-insensitive matching. Multiple cities (including CV employment history) require manual resolution.
- Scanned PDFs need manual review; OCR is not included. No full CV text is returned. Password-protected, malformed and unsupported documents are flagged.
- Sender addresses remain restricted to example.com. Sender identity comes from the existing input, not guesses from a CV email address.
- No database migration, Composer dependency change, mail delivery or mailbox access. The existing smalot/pdfparser is reused. The UI checkbox is a review aid, not a new backend authentication control.
- Preview requires the existing company-wide intake.create permission and is limited to ten requests/minute per default Laravel throttle key.

## Apply in PowerShell

Extract the ZIP into Downloads. At your existing repository root:

```powershell
git switch -c feature/intake-review
git apply --check --ignore-space-change "$HOME\Downloads\seka-intake-review\seka-intake-review.patch"
git apply --ignore-space-change "$HOME\Downloads\seka-intake-review\seka-intake-review.patch"
Push-Location .\backend-laravel
php artisan test --filter=IntakePreviewTest
php artisan test
Pop-Location
Push-Location .\frontend
npm run build
npm run dev
```

Keep Laravel running on port 8001. No Docker setup is needed. Do not proceed with apply if --check fails. The whitespace option accommodates Windows line endings in the uploaded files. If the branch already exists, skip its creation.

## Try it

Open /intake as an HR demo employee. Fill with sample data, then Find suggestions. Apply each suggestion, check the details, tick confirmation and save. The sample intentionally leaves reviewed fields blank so the suggestions are visible. Without a PDF, missing CV remains flagged.

Try a message containing two branch cities, a broken PDF and manually edited values. Branch managers and System Admin should be denied preview access. Check both languages.

## Verification

Frontend production build and mocked browser interaction checks are run during packaging. Backend feature tests cover labelled extraction, Windows newlines, conflicting cities/sources, PDF extraction, invalid attachments, permissions and no preview persistence. PHP is unavailable in the authoring environment; run the supplied tests locally before committing.

## Remaining integration work

Real mailbox ingestion, Microsoft sign-in, AI extraction of free-form prose, OCR and actual email delivery remain separate work. This update does not mark those integrations complete.
