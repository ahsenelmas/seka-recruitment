<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Models\Candidate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class RecruitmentController extends Controller
{
    public function branches(): JsonResponse
    {
        return response()->json(
            Branch::orderBy('city')->get()
        );
    }

    public function candidates(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:200'],
            'city' => ['nullable', 'string', 'max:100'],
            'position' => ['nullable', 'string', 'max:150'],
            'status' => [
                'nullable',
                Rule::in([
                    'new',
                    'review',
                    'interview',
                    'hired',
                    'rejected',
                ]),
            ],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'offset' => ['sometimes', 'integer', 'min:0'],
        ]);

        $query = Candidate::query()->with('branch');

        $search = trim($filters['search'] ?? '');

        if ($search !== '') {
            $escaped = str_replace(
                ['\\', '%', '_'],
                ['\\\\', '\\%', '\\_'],
                $search
            );

            $pattern = '%' . $escaped . '%';

            $query->where(function ($q) use ($pattern) {
                $q->whereRaw(
                    "(first_name || ' ' || last_name) ILIKE ?",
                    [$pattern]
                )
                    ->orWhereLike('email', $pattern)
                    ->orWhereLike('position', $pattern);
            });
        }

        if (! empty($filters['city'])) {
            $query->whereHas('branch', function ($q) use ($filters) {
                $q->where('city', $filters['city']);
            });
        }

        foreach (['position', 'status'] as $field) {
            if (! empty($filters[$field])) {
                $query->where($field, $filters[$field]);
            }
        }

        $total = (clone $query)->count();
        $limit = (int) ($filters['limit'] ?? 20);
        $offset = (int) ($filters['offset'] ?? 0);

        $items = $query
            ->orderByDesc('created_at')
            ->orderBy('id')
            ->offset($offset)
            ->limit($limit)
            ->get();

        return response()->json([
            'items' => $items,
            'total' => $total,
            'limit' => $limit,
            'offset' => $offset,
        ]);
    }

    public function show(string $id): JsonResponse
    {
        $candidate = Candidate::with('branch')->find($id);

        if (! $candidate) {
            return response()->json([
                'message' => 'Nie znaleziono kandydata.',
            ], 404);
        }

        return response()->json($candidate);
    }

    public function positions(): JsonResponse
    {
        return response()->json(
            Candidate::whereNotNull('position')
                ->where('position', '<>', '')
                ->distinct()
                ->orderBy('position')
                ->pluck('position')
        );
    }

    public function dashboard(): JsonResponse
    {
        $statuses = array_fill_keys([
            'new',
            'review',
            'interview',
            'hired',
            'rejected',
        ], 0);

        $counts = Candidate::query()
            ->selectRaw('status, COUNT(*) AS total')
            ->groupBy('status')
            ->pluck('total', 'status');

        foreach ($counts as $status => $total) {
            $statuses[$status] = (int) $total;
        }

        $branches = Branch::withCount('candidates')
            ->orderBy('city')
            ->get()
            ->map(fn (Branch $branch) => [
                'branch_id' => $branch->id,
                'city' => $branch->city,
                'total' => $branch->candidates_count,
            ]);

        return response()->json([
            'total' => array_sum($statuses),
            'by_status' => $statuses,
            'unassigned' => Candidate::whereNull('branch_id')->count(),
            'by_branch' => $branches,
        ]);
    }
    public function update(Request $request, string $id): JsonResponse
{
    $candidate = Candidate::find($id);

    if (! $candidate) {
        return response()->json([
            'message' => 'Nie znaleziono kandydata.',
        ], 404);
    }

    $validated = $request->validate([
        'status' => [
            'sometimes',
            'required',
            Rule::in([
                'new',
                'review',
                'interview',
                'hired',
                'rejected',
            ]),
        ],
        'hr_notes' => [
            'sometimes',
            'nullable',
            'string',
            'max:10000',
        ],
        'branch_id' => [
            'sometimes',
            'nullable',
            'integer',
            Rule::exists('branches', 'id'),
        ],
        'position' => [
            'sometimes',
            'nullable',
            'string',
            'max:150',
        ],
    ]);

    if (array_key_exists('hr_notes', $validated)) {
    $validated['hr_notes'] = $validated['hr_notes'] ?? '';
}
    $candidate->fill($validated);
    $candidate->save();

    return response()->json(
        $candidate->fresh('branch')
    );
}
}
