<?php

namespace App\Http\Controllers;

use App\Models\Candidate;
use Illuminate\Http\JsonResponse;

class ApplicantController extends Controller
{
    public function show(string $id): JsonResponse
    {
        // Query through scoped submissions: managers never see other branches.
        $applications = Candidate::with('branch')
            ->where('applicant_id', $id)->orderByDesc('created_at')->get();
        abort_if($applications->isEmpty(), 404);

        return response()->json([
            'id' => $id,
            'email' => $applications->first()->email,
            'applications' => $applications,
            'visible_application_count' => $applications->count(),
        ]);
    }
}
