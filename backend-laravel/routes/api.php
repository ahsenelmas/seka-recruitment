<?php

use App\Http\Controllers\RecruitmentController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\CandidateCvController;
use App\Http\Controllers\EmailIntakeController;

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
\Illuminate\Support\Facades\Route::get('/demo/context', [\App\Http\Controllers\DemoContextController::class, 'show']);
\Illuminate\Support\Facades\Route::post('/demo/context', [\App\Http\Controllers\DemoContextController::class, 'store']);
\Illuminate\Support\Facades\Route::get('/demo/admin-overview', [\App\Http\Controllers\DemoContextController::class, 'adminOverview']);

Route::get('/applicants/{id}', [
    \App\Http\Controllers\ApplicantController::class, 'show',
])->whereUuid('id');

Route::get('/candidates/{id}/history', [
    \App\Http\Controllers\ApplicationHistoryController::class, 'index',
])->whereUuid('id');

Route::get('/statuses', [\App\Http\Controllers\RecruitmentStatusController::class, 'index']);
Route::post('/admin/statuses', [\App\Http\Controllers\RecruitmentStatusController::class, 'store']);
Route::post('/admin/statuses/reorder', [\App\Http\Controllers\RecruitmentStatusController::class, 'reorder']);
Route::patch('/admin/statuses/{code}', [\App\Http\Controllers\RecruitmentStatusController::class, 'update']);

Route::get('/demo/catalog', [\App\Http\Controllers\DemoContextController::class, 'catalog']);
Route::get('/admin/roles', [\App\Http\Controllers\RecruitmentRoleController::class, 'index']);
Route::post('/admin/roles', [\App\Http\Controllers\RecruitmentRoleController::class, 'store']);
Route::patch('/admin/roles/{code}', [\App\Http\Controllers\RecruitmentRoleController::class, 'update']);
Route::get('/system/settings', [\App\Http\Controllers\RecruitmentSettingsController::class, 'show']);
Route::patch('/system/settings', [\App\Http\Controllers\RecruitmentSettingsController::class, 'update']);
