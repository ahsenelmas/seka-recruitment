<?php

return [
    // Live integration is fail-closed. Demo identity is available only in local/testing.
    'entra_tenant' => env('ENTRA_TENANT_ID'),
    'entra_client' => env('ENTRA_CLIENT_ID'),
    'entra_secret' => env('ENTRA_CLIENT_SECRET'),
    'entra_redirect' => env('ENTRA_REDIRECT_URI', 'http://localhost:8001/api/auth/entra/callback'),
    'frontend_url' => env('SEKA_FRONTEND_URL', 'http://localhost:3000'),
    'azure_roles' => ['SEKA.TechnicalAdmin' => 'system_admin', 'SEKA.HRCoordinator' => 'hr_manager', 'SEKA.UnitDirector' => 'branch_manager', 'SEKA.DeputyDirector' => 'deputy_director', 'SEKA.HRSupport' => 'hr_support', 'SEKA.QualificationsDirector' => 'specialist_director'],
    'auth_mode' => env('SEKA_AUTH_MODE', 'demo'),
    'allow_demo' => env('SEKA_ALLOW_DEMO', false),
    'grant_policy_approved' => env('SEKA_GRANT_POLICY_APPROVED', false),
    'retention_enabled' => env('SEKA_RETENTION_ENABLED', false),
    'retention_days' => env('SEKA_RETENTION_DAYS'),
    'consent_retention_days' => env('SEKA_CONSENT_RETENTION_DAYS'),
    'ingest_key' => env('SEKA_INGEST_KEY'),
    'mail_enabled' => env('SEKA_MAIL_ENABLED', false),
    'mailbox' => 'kariera@seka.pl',
];
