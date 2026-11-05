<?php

namespace App\Http\Controllers;

use App\Models\ApplicationMessage;
use App\Models\Branch;
use App\Models\Candidate;
use App\Models\RecruitmentStatus;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

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
                'nullable', 'string', 'max:50',
                Rule::exists('recruitment_statuses', 'code'),
            ],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'offset' => ['sometimes', 'integer', 'min:0'],
            'attention' => ['nullable', Rule::in(['incomplete', 'unassigned'])],
        ]);

        $query = Candidate::query()->with('branch');

        $search = trim($filters['search'] ?? '');

        if ($search !== '') {
            $escaped = str_replace(
                ['\\', '%', '_'],
                ['\\\\', '\\%', '\\_'],
                $search
            );

            $pattern = '%'.$escaped.'%';

            $query->where(function ($q) use ($pattern) {
                $q->whereLike(DB::raw("first_name || ' ' || last_name"), $pattern)
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

        if (($filters['attention'] ?? '') === 'unassigned') {
            $query->whereNull('branch_id');
        }
        if (($filters['attention'] ?? '') === 'incomplete') {
            $query->where(fn ($q) => $q->whereNull('cv_storage_key')->orWhereNotNull('cv_validation_error')->orWhereNull('branch_id')->orWhereNull('position')->orWhereRaw("trim(position) = ''"));
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
        $statuses = RecruitmentStatus::pluck('code')->mapWithKeys(fn ($code) => [$code => 0])->all();

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
            'needs_information' => Candidate::where(fn ($q) => $q->whereNull('cv_storage_key')->orWhereNotNull('cv_validation_error')->orWhereNull('branch_id')->orWhereNull('position')->orWhereRaw("trim(position) = ''"))->count(),
            'conversations' => in_array('correspondence.view', request()->attributes->get('seka_demo_permissions', []), true) ? Candidate::whereHas('messages')->count() : null,
            'reply_drafts' => in_array('correspondence.view', request()->attributes->get('seka_demo_permissions', []), true) ? ApplicationMessage::where('direction', 'outbound')->where('delivery_status', 'draft')->whereIn('candidate_id', Candidate::select('id'))->count() : null,
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
                'required', 'string', 'max:50',
                Rule::exists('recruitment_statuses', 'code'),
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
        $candidate = DB::transaction(function () use ($id, $validated) {
            $candidate = Candidate::whereKey($id)->lockForUpdate()->firstOrFail();
            if (isset($validated['status'])) {
                $target = RecruitmentStatus::whereKey($validated['status'])->lockForUpdate()->firstOrFail();
                if (! $target->is_active && $candidate->status !== $target->code) {
                    throw ValidationException::withMessages(['status' => 'This status is archived.']);
                }
            }
            if (isset($validated['status'])) {
                $main = RecruitmentStatus::findOrFail($validated['status'])->main_state;
                abort_if($candidate->main_state === 'finished' && $main !== 'finished', 422, 'Reopening policy requires SEKA approval.');
                abort_if($validated['status'] === 'interview_scheduled' && (! $candidate->interview_at || ! $candidate->interview_format), 422, 'Set interview details in the Process tab.');
                if ($main === 'finished' && $candidate->main_state !== 'finished' && ! $candidate->completed_at) {
                    $candidate->completed_at = now();
                }
                $candidate->process_version = (int) $candidate->process_version + 1;
            }
            $candidate->fill($validated);
            $candidate->save();

            return $candidate;
        });

        return response()->json(
            $candidate->fresh('branch')
        );
    }
}
