<?php

use App\Http\Controllers\ApplicantController;
use App\Http\Controllers\ApplicationHistoryController;
use App\Http\Controllers\ApplicationMailboxController;
use App\Http\Controllers\ApplicationWorkController;
use App\Http\Controllers\CandidateCvController;
use App\Http\Controllers\DemoContextController;
use App\Http\Controllers\EmailIntakeController;
use App\Http\Controllers\EntraController;
use App\Http\Controllers\IntakePreviewController;
use App\Http\Controllers\IntakeQueueController;
use App\Http\Controllers\P01Controller;
use App\Http\Controllers\RecruitmentController;
use App\Http\Controllers\RecruitmentRoleController;
use App\Http\Controllers\RecruitmentSettingsController;
use App\Http\Controllers\RecruitmentStatusController;
use App\Http\Controllers\SendReplyController;
use Illuminate\Support\Facades\Route;

Route::get('/health', function () {
    return response()->json([
        'status' => 'ok',
        'message' => 'API Laravel działa poprawnie.',
    ]);
});

Route::get('/branches', [
    RecruitmentController::class,
    'branches',
]);

Route::get('/positions', [
    RecruitmentController::class,
    'positions',
]);

Route::get('/dashboard', [
    RecruitmentController::class,
    'dashboard',
]);

Route::get('/candidates', [
    RecruitmentController::class,
    'candidates',
]);

Route::get('/candidates/{id}', [
    RecruitmentController::class,
    'show',
])->whereUuid('id');

Route::patch('/candidates/{id}', [
    RecruitmentController::class,
    'update',
])->whereUuid('id');

Route::post('/candidates/{id}/cv', [
    CandidateCvController::class,
    'upload',
])->whereUuid('id');

Route::get('/candidates/{id}/cv', [
    CandidateCvController::class,
    'show',
])->whereUuid('id');

Route::post('/intake/sample-email', [
    EmailIntakeController::class,
    'store',
]);

// SEKA_DEMO_ROLE_ROUTES
Route::get('/demo/context', [DemoContextController::class, 'show']);
Route::post('/demo/context', [DemoContextController::class, 'store']);
Route::get('/demo/admin-overview', [DemoContextController::class, 'adminOverview']);

Route::get('/applicants/{id}', [
    ApplicantController::class, 'show',
])->whereUuid('id');

Route::get('/candidates/{id}/history', [
    ApplicationHistoryController::class, 'index',
])->whereUuid('id');

Route::get('/statuses', [RecruitmentStatusController::class, 'index']);
Route::post('/admin/statuses', [RecruitmentStatusController::class, 'store']);
Route::post('/admin/statuses/reorder', [RecruitmentStatusController::class, 'reorder']);
Route::patch('/admin/statuses/{code}', [RecruitmentStatusController::class, 'update']);

Route::get('/demo/catalog', [DemoContextController::class, 'catalog']);
Route::get('/admin/roles', [RecruitmentRoleController::class, 'index']);
Route::post('/admin/roles', [RecruitmentRoleController::class, 'store']);
Route::patch('/admin/roles/{code}', [RecruitmentRoleController::class, 'update']);
Route::get('/system/settings', [RecruitmentSettingsController::class, 'show']);
Route::patch('/system/settings', [RecruitmentSettingsController::class, 'update']);

Route::get('/inbox', [ApplicationMailboxController::class, 'inbox']);
Route::get('/candidates/{id}/messages', [ApplicationMailboxController::class, 'messages'])->whereUuid('id');
Route::post('/candidates/{id}/messages', [ApplicationMailboxController::class, 'createDraft'])->whereUuid('id');
Route::post('/candidates/{id}/messages/sample-incoming', [ApplicationMailboxController::class, 'sampleIncoming'])->whereUuid('id');
Route::patch('/candidates/{id}/messages/{messageId}', [ApplicationMailboxController::class, 'updateDraft'])->whereUuid('id')->whereUuid('messageId');

Route::post('/demo/employee', [DemoContextController::class, 'employee']);
Route::get('/tasks', [ApplicationWorkController::class, 'index']);
Route::get('/candidates/{id}/work', [ApplicationWorkController::class, 'show'])->whereUuid('id');
Route::patch('/candidates/{id}/work', [ApplicationWorkController::class, 'owner'])->whereUuid('id');
Route::post('/candidates/{id}/tasks', [ApplicationWorkController::class, 'store'])->whereUuid('id');
Route::patch('/candidates/{id}/tasks/{taskId}', [ApplicationWorkController::class, 'update'])->whereUuid('id')->whereUuid('taskId');

Route::post('/intake/preview', IntakePreviewController::class)->middleware('throttle:10,1');

// P01 business records use the same application-scoped permission checks.
Route::prefix('p01')->controller(P01Controller::class)->group(function () {
    Route::get('/meta', 'meta');
    Route::get('/applications/{id}', 'show')->whereUuid('id');
    Route::patch('/applications/{id}/process', 'process')->whereUuid('id');
    Route::post('/applications/{id}/notes', 'note')->whereUuid('id');
    Route::post('/applications/{id}/contacts', 'contact')->whereUuid('id');
    Route::post('/applications/{id}/reviews', 'review')->whereUuid('id');
    Route::patch('/applications/{id}/reviews/{review}', 'decide')->whereUuid('id');
    Route::post('/applications/{id}/grants', 'grant')->whereUuid('id');
    Route::delete('/applications/{id}/grants/{grant}', 'revoke')->whereUuid('id');
    Route::get('/dictionaries', 'dictionaries');
    Route::post('/dictionaries', 'dictionary');
    Route::patch('/dictionaries/{id}', 'archiveDictionary');
    Route::get('/notifications', 'notifications');
    Route::patch('/notifications/{id}', 'readNotification');
});

Route::get('/auth/config', [EntraController::class, 'config']);
Route::get('/auth/entra/start', [EntraController::class, 'start']);
Route::get('/auth/entra/callback', [EntraController::class, 'callback']);
Route::post('/auth/logout', [EntraController::class, 'logout']);

Route::post('/mailbox/ingest', [IntakeQueueController::class, 'ingest'])->middleware('throttle:30,1');
Route::prefix('p01')->controller(IntakeQueueController::class)->group(function () {
    Route::get('/intake', 'index');
    Route::get('/intake/{id}', 'show');
    Route::patch('/intake/{id}', 'classify');
    Route::post('/intake/{id}/accept', 'accept');
    Route::delete('/intake/{id}', 'remove');
    Route::get('/attachments/{attachment}', 'attachment');
    Route::post('/manual', 'manual');
});

Route::post('/p01/applications/{id}/attachments', [IntakeQueueController::class, 'upload'])->whereUuid('id');
Route::post('/p01/applications/{id}/messages/{message}/send', SendReplyController::class)->whereUuid('id')->whereUuid('message');

Route::get('/p01/units', [P01Controller::class, 'units']);
Route::post('/p01/units', [P01Controller::class, 'addUnit']);

Route::patch('/p01/applications/{id}/contacts/{contact}', [P01Controller::class, 'contactPurpose'])->whereUuid('id');
