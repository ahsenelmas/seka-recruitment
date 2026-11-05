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
        $data = request()->validate(['type' => ['nullable', 'string', 'max:80']]);
        $query = ApplicationEvent::where('candidate_id', $id);
        if (! empty($data['type'])) {
            $query->where('type', $data['type']);
        }
        $page = $query->orderByDesc('id')->paginate(30);

        return response()->json(array_merge($page->toArray(), ['available_types' => ApplicationEvent::where('candidate_id', $id)->distinct()->pluck('type')]));
    }
}
