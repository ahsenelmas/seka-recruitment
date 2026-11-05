<?php

namespace App\Support;

use App\Models\ApplicationEvent;
use App\Models\Candidate;
use App\Models\DemoEmployee;
use Illuminate\Support\Facades\DB;

class P01
{
    public static function employee(): ?DemoEmployee
    {
        return request()->attributes->get('seka_demo_employee');
    }

    public static function actor(): string
    {
        return self::employee()?->name ?? 'Demo · '.request()->attributes->get('seka_demo_role', 'system');
    }

    public static function allows(string $p): bool
    {
        return in_array($p, request()->attributes->get('seka_demo_permissions', []), true);
    }

    public static function record(Candidate $c, string $type, array $changes = []): void
    {
        ApplicationEvent::create(['candidate_id' => $c->id, 'type' => $type, 'actor_role' => request()->attributes->get('seka_demo_role', 'system'), 'simulated' => request()->attributes->get('seka_auth_simulated', true), 'changes' => $changes + ['actor' => self::actor()], 'created_at' => now()]);
    }

    public static function notify(Candidate $c, string $kind, array $extra = []): void
    {
        $ids = DB::table('demo_employees')->where('is_demo', config('p01.auth_mode') !== 'entra')->where('is_active', true)->where('role_code', 'hr_manager')->pluck('id')->all();
        $ids = array_merge($ids, DB::table('demo_employees')->where('is_demo', config('p01.auth_mode') !== 'entra')->where('is_active', true)->where('role_code', 'branch_manager')->where('branch_id', $c->branch_id)->pluck('id')->all());
        if ($c->owner_employee_id) {
            $ids[] = $c->owner_employee_id;
        }
        foreach (array_unique(array_filter([...$ids, ...$extra])) as $id) {
            DB::table('recruitment_notifications')->insert(['employee_id' => $id, 'candidate_id' => $c->id, 'kind' => $kind, 'created_at' => now(), 'updated_at' => now()]);
        }
    }

    public static function base(Candidate $c): array
    {
        return ['candidate_id' => $c->id, 'actor_id' => self::employee()?->id, 'actor_label' => self::actor(), 'process_status' => $c->status, 'created_at' => now(), 'updated_at' => now()];
    }
}
