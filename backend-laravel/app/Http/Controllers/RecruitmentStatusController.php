<?php

namespace App\Http\Controllers;

use App\Models\RecruitmentStatus;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class RecruitmentStatusController extends Controller
{
    private function authorizeAdmin(Request $request): void
    {
        abort_unless(in_array('statuses.manage', $request->attributes->get('seka_demo_permissions', []), true), 403);
    }

    public function index(): JsonResponse
    {
        // Archived statuses remain available for existing records and filters.
        return response()->json(RecruitmentStatus::orderBy('sort_order')->orderBy('code')->get());
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);
        $data = $request->validate([
            'code' => ['required', 'string', 'max:50', 'regex:/\A[a-z][a-z0-9_]*\z/', Rule::unique('recruitment_statuses', 'code')],
            'label_pl' => ['required', 'string', 'max:100'],
            'label_en' => ['required', 'string', 'max:100'],
            'color' => ['required', 'regex:/\A#[0-9a-fA-F]{6}\z/'],
        ]);
        return response()->json(DB::transaction(function () use ($data) {
            // Serialize additions/reordering through the protected intake status.
            RecruitmentStatus::whereKey('new')->lockForUpdate()->firstOrFail();
            return RecruitmentStatus::create($data + [
                'sort_order' => ((int) RecruitmentStatus::max('sort_order')) + 1, 'is_active' => true,
            ]);
        }), 201);
    }

    public function update(Request $request, string $code): JsonResponse
    {
        $this->authorizeAdmin($request);
        $data = $request->validate([
            'code' => ['prohibited'],
            'label_pl' => ['sometimes', 'required', 'string', 'max:100'],
            'label_en' => ['sometimes', 'required', 'string', 'max:100'],
            'color' => ['sometimes', 'required', 'regex:/\A#[0-9a-fA-F]{6}\z/'],
            'is_active' => ['sometimes', 'required', 'boolean'],
        ]);
        abort_if($code === 'new' && array_key_exists('is_active', $data) && ! $data['is_active'], 422,
            'The default intake status cannot be archived.');
        return response()->json(DB::transaction(function () use ($code, $data) {
            $status = RecruitmentStatus::whereKey($code)->lockForUpdate()->firstOrFail();
            $status->update($data);
            return $status->fresh();
        }));
    }

    public function reorder(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);
        $data = $request->validate([
            'codes' => ['required', 'array', 'min:1'],
            'codes.*' => ['required', 'string', 'distinct'],
        ]);
        DB::transaction(function () use ($data) {
            RecruitmentStatus::whereKey('new')->lockForUpdate()->firstOrFail();
            $expected = RecruitmentStatus::pluck('code')->sort()->values()->all();
            $provided = $data['codes']; sort($provided);
            abort_unless($expected === $provided, 422, 'Send every status code exactly once.');
            foreach ($data['codes'] as $index => $code) {
                RecruitmentStatus::whereKey($code)->update(['sort_order' => $index]);
            }
        });
        return $this->index();
    }
}
