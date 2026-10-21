<?php

use App\Http\Controllers\RecruitmentController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\CandidateCvController;

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
