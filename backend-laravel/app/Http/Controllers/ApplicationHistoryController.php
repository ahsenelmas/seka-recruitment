<?php

namespace App\Http\Controllers;

use App\Models\ApplicationEvent;
use App\Models\Candidate;
use Illuminate\Http\JsonResponse;

class ApplicationHistoryController extends Controller
{
    public function index(string $id): JsonResponse
    {
        // Authorize through the scoped application, including direct API requests.
        Candidate::findOrFail($id);
        return response()->json(
            ApplicationEvent::where('candidate_id', $id)->orderByDesc('id')->paginate(30)
        );
    }
}
