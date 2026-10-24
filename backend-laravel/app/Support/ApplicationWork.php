<?php
namespace App\Support;
use App\Models\ApplicationEvent;
use App\Models\ApplicationTask;
use App\Models\Candidate;
use App\Models\DemoEmployee;
class ApplicationWork
{
    public static function eligible(?DemoEmployee $employee, Candidate $candidate): bool
    {
        if (! $employee || ! $employee->is_active || ! $employee->role?->is_active || ! in_array('applications.view', $employee->role->permissions, true)) return false;
        return $employee->role->scope === 'all' || ($candidate->branch_id !== null && (int) $employee->branch_id === (int) $candidate->branch_id);
    }
    public static function record(Candidate $candidate, string $type, array $changes): void
    {
        $role = request()->attributes->get('seka_demo_role');
        $employee = request()->attributes->get('seka_demo_employee');
        if ($employee) $changes['demo_account'] = $employee->name;
        ApplicationEvent::create(['candidate_id' => $candidate->id, 'type' => $type, 'actor_role' => $role ?? 'system', 'simulated' => is_string($role), 'changes' => $changes, 'created_at' => now()]);
    }
    public static function reconcileBranch(Candidate $candidate): void
    {
        if (! $candidate->wasChanged('branch_id')) return;
        if ($candidate->owner_employee_id && ! self::eligible(DemoEmployee::with('role')->find($candidate->owner_employee_id), $candidate)) {
            $old = $candidate->owner_employee_id; $candidate->owner_employee_id = null;
            $candidate->work_version = (int) $candidate->work_version + 1; $candidate->saveQuietly();
            self::record($candidate, 'owner_cleared_after_transfer', ['previous_owner' => $old]);
        }
        foreach (ApplicationTask::where('candidate_id', $candidate->id)->where('status', 'open')->whereNotNull('assignee_employee_id')->lockForUpdate()->get() as $task) {
            if (! self::eligible($task->assignee?->load('role'), $candidate)) {
                $task->assignee_employee_id = null; $task->version = $task->version + 1; $task->save();
                self::record($candidate, 'task_unassigned_after_transfer', ['task_id' => $task->id]);
            }
        }
    }
    public static function taskData(ApplicationTask $task): array
    {
        $employee = request()->attributes->get('seka_demo_employee');
        $permissions = request()->attributes->get('seka_demo_permissions', []);
        return [
            'id' => $task->id, 'title' => $task->title, 'description' => $task->description, 'due_on' => $task->due_on?->format('Y-m-d'),
            'status' => $task->status, 'version' => $task->version, 'completed_at' => $task->completed_at,
            'assignee_employee_id' => $task->assignee_employee_id, 'assignee' => $task->assignee?->only(['id', 'name', 'email']),
            'assignment_valid' => $task->status !== 'open' || $task->assignee_employee_id === null || self::eligible($task->assignee?->load('role'), $task->candidate),
            'is_overdue' => $task->status === 'open' && $task->due_on && $task->due_on->format('Y-m-d') < now('Europe/Warsaw')->format('Y-m-d'),
            'can_complete' => in_array('tasks.manage', $permissions, true) || (in_array('tasks.complete', $permissions, true) && $employee && $task->assignee_employee_id === $employee->id),
            'candidate' => ['id' => $task->candidate->id, 'name' => $task->candidate->first_name.' '.$task->candidate->last_name, 'city' => $task->candidate->branch?->city],
        ];
    }
}
