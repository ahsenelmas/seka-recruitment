<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class DemoContextController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        // Branch names are selector metadata, not candidate data.
        return response()->json([
            'role' => $request->attributes->get('seka_demo_role'),
            'branch_id' => $request->attributes->get('seka_demo_branch_id'),
            'simulation' => true,
            'branches' => Branch::withoutGlobalScopes()->orderBy('city')->get(['id', 'city', 'name']),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'role' => ['required', Rule::in(['admin', 'hr_manager', 'branch_manager'])],
            'branch_id' => [
                'required_if:role,branch_manager',
                'prohibited_unless:role,branch_manager',
                'nullable', 'integer', 'min:1', Rule::exists('branches', 'id'),
            ],
        ], [
            'required' => 'Wybierz rolę.',
            'in' => 'Nieprawidłowa rola.',
            'required_if' => 'Wybierz oddział.',
            'prohibited_unless' => 'Oddział dotyczy tylko kierownika oddziału.',
            'exists' => 'Nie znaleziono oddziału.',
            'integer' => 'Wybierz prawidłowy oddział.',
            'min' => 'Wybierz prawidłowy oddział.',
        ]);

        $branch = $data['role'] === 'branch_manager' ? (int) $data['branch_id'] : null;
        return response()->json([
            'role' => $data['role'], 'branch_id' => $branch, 'simulation' => true,
        ])->cookie('seka_demo', $data['role'] . ':' . ($branch ?? ''), 480, '/api', null, $request->isSecure(), true, false, 'lax');
    }

    public function adminOverview(): JsonResponse
    {
        return response()->json([
            'authentication' => 'demo_only',
            'company_login' => 'not_connected',
            'email_delivery' => 'not_configured',
            'roles' => ['admin', 'hr_manager', 'branch_manager'],
        ]);
    }
}
