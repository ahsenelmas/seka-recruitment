<?php
namespace App\Http\Controllers;
use App\Models\ApplicationTask;
use App\Models\Candidate;
use App\Models\DemoEmployee;
use App\Support\ApplicationWork;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
class ApplicationWorkController extends Controller
{
    public function show(string $id): JsonResponse
    {
        $candidate = Candidate::findOrFail($id);
        $employees = DemoEmployee::with('role')->where('is_active', true)->orderBy('name')->get()->filter(fn ($e) => ApplicationWork::eligible($e, $candidate))->values()->map(fn ($e) => $e->only(['id', 'name', 'email']));
        $tasks = ApplicationTask::with(['assignee.role', 'candidate.branch'])->where('candidate_id', $id)->orderByDesc('created_at')->paginate(30);
        $tasks->through(fn ($task) => ApplicationWork::taskData($task));
        $owner = $candidate->owner_employee_id ? DemoEmployee::with('role')->find($candidate->owner_employee_id) : null;
        return response()->json(['owner_employee_id' => $candidate->owner_employee_id, 'owner' => $owner?->only(['id', 'name', 'email']), 'owner_valid' => ! $owner || ApplicationWork::eligible($owner, $candidate), 'follow_up_on' => $candidate->follow_up_on, 'work_version' => (int) $candidate->work_version, 'employees' => $employees, 'tasks' => $tasks]);
    }
    public function owner(Request $request, string $id): JsonResponse
    {
        $data = $request->validate(['version' => ['required', 'integer', 'min:1'], 'owner_employee_id' => ['present', 'nullable', 'uuid'], 'follow_up_on' => ['present', 'nullable', 'date_format:Y-m-d']]);
        DB::transaction(function () use ($id, $data) {
            $candidate = Candidate::whereKey($id)->lockForUpdate()->firstOrFail();
            abort_unless((int) $candidate->work_version === (int) $data['version'], 409, 'Ownership changed. Reload before saving.');
            $employee = $data['owner_employee_id'] ? DemoEmployee::with('role')->find($data['owner_employee_id']) : null;
            abort_if($data['owner_employee_id'] && ! ApplicationWork::eligible($employee, $candidate), 422, 'Choose an active employee with access to this branch.');
            if ($candidate->owner_employee_id !== $data['owner_employee_id'] || $candidate->follow_up_on !== $data['follow_up_on']) {
                $candidate->owner_employee_id = $data['owner_employee_id']; $candidate->follow_up_on = $data['follow_up_on']; $candidate->work_version = (int) $candidate->work_version + 1; $candidate->save();
                ApplicationWork::record($candidate, 'ownership_updated', ['owner' => $employee?->name, 'follow_up_on' => $data['follow_up_on']]);
            }
        });
        return $this->show($id);
    }
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate(['state' => ['nullable', 'in:open,done,cancelled'], 'mine' => ['nullable', 'boolean'], 'overdue' => ['nullable', 'boolean']]);
        $query = ApplicationTask::with(['assignee.role', 'candidate.branch'])->whereHas('candidate');
        if (! empty($data['state'])) $query->where('status', $data['state']);
        if (! empty($data['overdue'])) $query->where('status', 'open')->where('due_on', '<', now('Europe/Warsaw')->format('Y-m-d'));
        if (! empty($data['mine'])) {
            $employee = $request->attributes->get('seka_demo_employee'); abort_unless($employee, 422, 'Choose a demonstration employee to use My tasks.'); $query->where('assignee_employee_id', $employee->id);
        }
        return response()->json($query->orderByRaw('CASE WHEN due_on IS NULL THEN 1 ELSE 0 END')->orderBy('due_on')->orderBy('id')->paginate(20)->through(fn ($task) => ApplicationWork::taskData($task)));
    }
    public function store(Request $request, string $id): JsonResponse
    {
        $data = $request->validate(['client_id' => ['required', 'uuid'], 'title' => ['required', 'string', 'max:180'], 'description' => ['nullable', 'string', 'max:5000'], 'due_on' => ['nullable', 'date_format:Y-m-d'], 'assignee_employee_id' => ['nullable', 'uuid']]);
        $task = DB::transaction(function () use ($id, $data) {
            $candidate = Candidate::whereKey($id)->lockForUpdate()->firstOrFail();
            $employee = ! empty($data['assignee_employee_id']) ? DemoEmployee::with('role')->find($data['assignee_employee_id']) : null;
            abort_if(! empty($data['assignee_employee_id']) && ! ApplicationWork::eligible($employee, $candidate), 422, 'Choose an eligible employee.');
            $clientId = $data['client_id']; unset($data['client_id']);
            $existing = ApplicationTask::find($clientId);
            if ($existing) {
                abort_unless($existing->candidate_id === $id && $existing->title === $data['title'] && ($existing->description ?? null) === ($data['description'] ?? null) && $existing->due_on?->format('Y-m-d') === ($data['due_on'] ?? null) && $existing->assignee_employee_id === ($data['assignee_employee_id'] ?? null), 409, 'Task changed. Reload before retrying.');
                return $existing;
            }
            $task = ApplicationTask::create($data + ['id' => $clientId, 'candidate_id' => $id, 'status' => 'open', 'version' => 1]);
            ApplicationWork::record($candidate, 'task_created', ['task_id' => $task->id, 'task_title' => $task->title, 'assignee' => $employee?->name]);
            return $task;
        });
        return response()->json(ApplicationWork::taskData($task->load(['candidate.branch', 'assignee.role'])), 201);
    }
    public function update(Request $request, string $id, string $taskId): JsonResponse
    {
        $data = $request->validate(['version' => ['required', 'integer', 'min:1'], 'title' => ['sometimes', 'required', 'string', 'max:180'], 'description' => ['sometimes', 'nullable', 'string', 'max:5000'], 'due_on' => ['sometimes', 'nullable', 'date_format:Y-m-d'], 'assignee_employee_id' => ['sometimes', 'nullable', 'uuid'], 'status' => ['sometimes', 'required', 'string', 'in:open,done,cancelled']]);
        $task = DB::transaction(function () use ($id, $taskId, $data, $request) {
            $candidate = Candidate::whereKey($id)->lockForUpdate()->firstOrFail();
            $task = ApplicationTask::whereKey($taskId)->where('candidate_id', $id)->lockForUpdate()->firstOrFail();
            $manager = in_array('tasks.manage', $request->attributes->get('seka_demo_permissions', []), true);
            if (! $manager) {
                $employee = $request->attributes->get('seka_demo_employee');
                abort_unless($employee && $task->assignee_employee_id === $employee->id && ! array_diff(array_keys($request->all()), ['version', 'status']) && isset($data['status']) && in_array($data['status'], ['open', 'done'], true) && $task->status !== 'cancelled', 403);
            }
            abort_unless($task->version === (int) $data['version'], 409, 'Task changed. Reload before saving.');
            if (! empty($data['assignee_employee_id'])) abort_unless(ApplicationWork::eligible(DemoEmployee::with('role')->find($data['assignee_employee_id']), $candidate), 422, 'Choose an eligible employee.');
            unset($data['version']); $task->fill($data);
            if ($task->isDirty()) {
                $task->completed_at = $task->status === 'done' ? ($task->completed_at ?? now()) : null; $task->version = $task->version + 1; $task->save();
                ApplicationWork::record($candidate, 'task_updated', ['task_id' => $task->id, 'task_title' => $task->title, 'task_status' => $task->status]);
            }
            return $task;
        });
        return response()->json(ApplicationWork::taskData($task->load(['candidate.branch', 'assignee.role'])));
    }
}
