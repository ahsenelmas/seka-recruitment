<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Models\Candidate;
use App\Models\DemoEmployee;
use App\Models\RecruitmentStatus;
use App\Support\P01;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class P01Controller extends Controller
{
    public function dispatch(Request $r, Closure $next)
    {
        abort_unless(P01::allows('applications.view') || ($r->is('api/p01/dictionaries*', 'api/p01/units*') && P01::allows('system.configure')), 403);
        $response = $next($r);
        $response->headers->set('Cache-Control', 'private, no-store');
        $response->setVary('Cookie', false);

        return $response;
    }

    private function permit(string $permission): void
    {
        abort_unless(P01::allows($permission), 403);
    }

    private function candidate(string $id): Candidate
    {
        return Candidate::findOrFail($id);
    }

    private function canGrant(): void
    {
        abort_unless(request()->attributes->get('seka_demo_scope') === 'all' && P01::allows('qualification.request'), 403);
        abort_unless(app()->environment(['local', 'testing']) || config('p01.grant_policy_approved'), 423, 'The per-application grant policy requires SEKA approval.');
    }

    public function meta()
    {
        return response()->json(['dictionaries' => DB::table('recruitment_dictionaries')->orderBy('id')->get(), 'employees' => DemoEmployee::with('role')->where('is_active', true)->orderBy('name')->get()->map(fn ($e) => ['id' => $e->id, 'name' => $e->name, 'role_code' => $e->role_code, 'branch_id' => $e->branch_id]), 'policy' => ['role_assignment' => 'azure', 'grants' => 'proposed_hr_coordinator', 'hr_support' => 'explicit_grant_only', 'transitions' => 'unrestricted_except_reopening_pending_approval', 'extended_status_mapping' => 'proposed', 'ai' => 'local_rules_only', 'mail' => 'draft_only']]);
    }

    public function show(string $id)
    {
        $c = $this->candidate($id);
        request()->validate(['notes_page' => ['nullable', 'integer', 'min:1'], 'contacts_page' => ['nullable', 'integer', 'min:1'], 'reviews_page' => ['nullable', 'integer', 'min:1'], 'grants_page' => ['nullable', 'integer', 'min:1']]);
        $paging = [];
        $collect = function ($table, $name) use ($id, &$paging) {
            $page = DB::table($table)->where('candidate_id', $id)->orderByDesc('id')->paginate(30, ['*'], $name.'_page');
            $paging[$name] = ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total()];

            return $page->items();
        };
        $notes = $collect('application_notes', 'notes');
        $contacts = $collect('application_contacts', 'contacts');
        $reviews = $collect('qualification_reviews', 'reviews');
        $grants = request()->attributes->get('seka_demo_scope') === 'all' ? $collect('application_grants', 'grants') : [];

        return response()->json(['application' => $c, 'attachments' => DB::table('application_attachments')->where('candidate_id', $id)->get(['id', 'filename', 'mime', 'size']), 'notes' => $notes, 'contacts' => $contacts, 'reviews' => $reviews, 'grants' => $grants, 'paging' => $paging]);
    }

    public function process(Request $r, string $id)
    {
        $this->permit('process.manage');
        $d = $r->validate(['version' => ['required', 'integer', 'min:1'], 'status' => ['sometimes', 'string', Rule::exists('recruitment_statuses', 'code')], 'hr_support_required' => ['sometimes', 'boolean'], 'qualification_required' => ['sometimes', 'boolean'], 'future_consent' => ['sometimes', 'boolean'], 'consent_evidence' => ['sometimes', 'nullable', 'string', 'max:2000'], 'interview_at' => ['sometimes', 'nullable', 'date'], 'interview_format' => ['sometimes', 'nullable', Rule::in(['phone', 'video', 'onsite'])], 'rejection_reason' => ['sometimes', 'nullable', 'string', 'max:4000']]);

        return DB::transaction(function () use ($id, $d) {
            $c = Candidate::whereKey($id)->lockForUpdate()->firstOrFail();
            abort_unless((int) $c->process_version === (int) $d['version'], 409, 'Process changed. Reload before saving.');
            unset($d['version']);
            $before = $c->main_state;
            if (isset($d['status'])) {
                $status = RecruitmentStatus::findOrFail($d['status']);
                abort_unless($status->is_active || $status->code === $c->status, 422, 'Archived status.');
                abort_if($before === 'finished' && $status->main_state !== 'finished', 422, 'Reopening policy requires confirmation from SEKA.');
            }
            if (($d['future_consent'] ?? false) && ! ($d['consent_evidence'] ?? $c->consent_evidence)) {
                abort(422, 'Record the source/evidence of future-recruitment consent.');
            }
            foreach ($d as $k => $v) {
                $c->$k = $v;
            }
            if ($c->isDirty('future_consent')) {
                $c->consent_recorded_at = $c->future_consent ? now() : null;
            }
            if ($c->status === 'interview_scheduled' && (! $c->interview_at || ! $c->interview_format)) {
                abort(422, 'Interview date and format are required.');
            }
            if ($c->main_state === 'finished' && $before !== 'finished' && ! $c->completed_at) {
                $c->completed_at = now();
            }
            $c->process_version = (int) $c->process_version + 1;
            $c->save();
            P01::record($c, 'process_updated', array_intersect_key($d, array_flip(['status', 'hr_support_required', 'qualification_required', 'future_consent', 'interview_format'])));

            return response()->json($c->fresh('branch'));
        });
    }

    public function note(Request $r, string $id)
    {
        $this->permit('notes.create');
        $d = $r->validate(['content' => ['required', 'string', 'max:10000']]);

        return DB::transaction(function () use ($id, $d) {
            $c = $this->candidate($id);
            $row = DB::table('application_notes')->insertGetId(P01::base($c) + $d);
            P01::record($c, 'note_added', ['note_id' => $row]);

            return response()->json(['id' => $row], 201);
        });
    }

    public function contact(Request $r, string $id)
    {
        $this->permit('contacts.create');
        $d = $r->validate(['event_code' => ['required', 'string'], 'purpose_code' => ['nullable', 'string'], 'phone_outcome' => ['nullable', Rule::in(['answered', 'not_answered'])], 'occurred_at' => ['required', 'date'], 'content' => ['nullable', 'string', 'max:10000']]);
        foreach (['event_code' => 'event', 'purpose_code' => 'purpose'] as $field => $kind) {
            if (! empty($d[$field])) {
                abort_unless(DB::table('recruitment_dictionaries')->where('kind', $kind)->where('code', $d[$field])->where('is_active', true)->exists(), 422, 'Choose an active dictionary value.');
            }
        }
        if ($d['event_code'] === 'phone') {
            abort_unless(! empty($d['phone_outcome']), 422, 'Record whether the call was answered.');
        } else {
            $d['phone_outcome'] = null;
        }
        // Email entries are generated by mailbox operations; do not pretend a manually entered event sent mail.
        abort_if(in_array($d['event_code'], ['email_sent', 'email_received']), 422, 'Email events are recorded by mailbox operations.');

        return DB::transaction(function () use ($id, $d) {
            $c = $this->candidate($id);
            $row = DB::table('application_contacts')->insertGetId(P01::base($c) + $d);
            P01::record($c, 'contact_recorded', ['contact_id' => $row]);

            return response()->json(['id' => $row], 201);
        });
    }

    public function review(Request $r, string $id)
    {
        $this->permit('qualification.request');
        abort_unless(app()->environment(['local', 'testing']) || config('p01.grant_policy_approved'), 423, 'Qualification access policy requires approval.');
        $d = $r->validate(['reviewer_id' => ['required', 'uuid'], 'stage' => ['required', Rule::in(['opinion', 'confirmation'])]]);
        $person = DemoEmployee::whereKey($d['reviewer_id'])->where('is_active', true)->where('role_code', 'specialist_director')->firstOrFail();

        return DB::transaction(function () use ($id, $d, $person) {
            $c = $this->candidate($id);
            $c->qualification_required = true;
            $c->save();
            DB::table('application_grants')->updateOrInsert(['candidate_id' => $id, 'employee_id' => $person->id], P01::base($c) + ['employee_id' => $person->id, 'grant_kind' => 'specialist', 'expires_at' => null]);
            $row = DB::table('qualification_reviews')->insertGetId(P01::base($c) + $d);
            P01::record($c, 'qualification_requested', ['review_id' => $row, 'stage' => $d['stage']]);
            P01::notify($c, 'qualification_requested', [$person->id]);

            return response()->json(['id' => $row], 201);
        });
    }

    public function decide(Request $r, string $id, string $review)
    {
        $this->permit('qualification.decide');
        $d = $r->validate(['version' => ['required', 'integer'], 'decision' => ['required', Rule::in(['opinion', 'accepted', 'rejected'])], 'opinion' => ['required', 'string', 'max:10000']]);

        return DB::transaction(function () use ($id, $review, $d) {
            $c = $this->candidate($id);
            $row = DB::table('qualification_reviews')->where('id', $review)->where('candidate_id', $id)->lockForUpdate()->first();
            abort_unless($row, 404);
            abort_unless($row->reviewer_id === P01::employee()?->id, 403);
            abort_unless($row->decision === 'pending' && (int) $row->version === (int) $d['version'], 409, 'Review already changed.');
            abort_unless(($row->stage === 'opinion') === ($d['decision'] === 'opinion'), 422, 'Opinion and qualification confirmation are different stages.');
            DB::table('qualification_reviews')->where('id', $review)->update(['decision' => $d['decision'], 'opinion' => $d['opinion'], 'decided_at' => now(), 'updated_at' => now(), 'version' => $row->version + 1]);
            P01::record($c, 'qualification_decided', ['review_id' => $row->id, 'decision' => $d['decision']]);
            P01::notify($c, 'qualification_decided');

            return response()->json(['id' => $row->id]);
        });
    }

    public function grant(Request $r, string $id)
    {
        $this->canGrant();
        $d = $r->validate(['employee_id' => ['required', 'uuid'], 'expires_at' => ['nullable', 'date', 'after:now']]);
        $e = DemoEmployee::whereKey($d['employee_id'])->where('is_active', true)->whereIn('role_code', ['deputy_director', 'hr_support'])->firstOrFail();

        return DB::transaction(function () use ($id, $d, $e) {
            $c = $this->candidate($id);
            DB::table('application_grants')->updateOrInsert(['candidate_id' => $id, 'employee_id' => $e->id], P01::base($c) + ['employee_id' => $e->id, 'expires_at' => $d['expires_at'] ?? null, 'grant_kind' => $e->role_code]);
            P01::record($c, 'access_granted', ['employee_id' => $e->id]);

            return response()->json(['granted' => true]);
        });
    }

    public function revoke(string $id, string $grant)
    {
        $this->canGrant();
        $c = $this->candidate($id);
        DB::table('application_grants')->where('id', $grant)->where('candidate_id', $id)->delete();
        P01::record($c, 'access_revoked', ['grant_id' => $grant]);

        return response()->json(['revoked' => true]);
    }

    public function dictionaries()
    {
        return response()->json(DB::table('recruitment_dictionaries')->orderBy('kind')->orderBy('id')->get());
    }

    public function dictionary(Request $r)
    {
        $this->permit('system.configure');
        $d = $r->validate(['kind' => ['required', 'in:event,purpose'], 'code' => ['required', 'regex:/^[a-z][a-z0-9_]{0,49}$/'], 'label_pl' => ['required', 'string', 'max:150'], 'label_en' => ['required', 'string', 'max:150']]);
        abort_if(DB::table('recruitment_dictionaries')->where('kind', $d['kind'])->where('code', $d['code'])->exists(), 422, 'Code already exists.');
        $id = DB::table('recruitment_dictionaries')->insertGetId($d + ['created_at' => now(), 'updated_at' => now()]);

        return response()->json(['id' => $id], 201);
    }

    public function archiveDictionary(Request $r, string $id)
    {
        $this->permit('system.configure');
        $d = $r->validate(['is_active' => ['required', 'boolean']]);
        abort_if(DB::table('recruitment_dictionaries')->where('id', $id)->whereIn('code', ['email_sent', 'email_received'])->exists(), 422, 'Email event types are reserved.');
        DB::table('recruitment_dictionaries')->where('id', $id)->update($d + ['updated_at' => now()]);

        return response()->json(['updated' => true]);
    }

    public function notifications()
    {
        abort_unless(P01::employee(), 422, 'Select an employee account.');

        return response()->json(DB::table('recruitment_notifications')->where('employee_id', P01::employee()->id)->whereIn('candidate_id', Candidate::select('id'))->orderByDesc('id')->paginate(30));
    }

    public function readNotification(string $id)
    {
        abort_unless(P01::employee(), 403);
        DB::table('recruitment_notifications')->where('employee_id', P01::employee()->id)->where('id', $id)->update(['read_at' => now()]);

        return response()->json(['read' => true]);
    }

    public function units()
    {
        return response()->json(Branch::withoutGlobalScopes()->orderBy('name')->get());
    }

    public function addUnit(Request $r)
    {
        $this->permit('system.configure');
        $d = $r->validate(['code' => ['required', 'regex:/^[a-z0-9][a-z0-9_-]{0,79}$/', Rule::unique('branches', 'code')], 'name' => ['required', 'string', 'max:150'], 'city' => ['required', 'string', 'max:100'], 'unit_type' => ['required', 'in:branch,department']]);

        return response()->json(Branch::create($d), 201);
    }

    public function contactPurpose(Request $r, string $id, string $contact)
    {
        $this->permit('contacts.create');
        $c = $this->candidate($id);
        $d = $r->validate(['purpose_code' => ['present', 'nullable', 'string', 'max:50']]);
        if ($d['purpose_code']) {
            abort_unless(DB::table('recruitment_dictionaries')->where('kind', 'purpose')->where('code', $d['purpose_code'])->where('is_active', true)->exists(), 422);
        }$row = DB::table('application_contacts')->where('id', $contact)->where('candidate_id', $id)->first();
        abort_unless($row, 404);
        DB::table('application_contacts')->where('id', $contact)->update($d + ['updated_at' => now()]);
        P01::record($c, 'contact_purpose_updated', ['contact_id' => $row->id, 'purpose_code' => $d['purpose_code']]);

        return response()->json(['updated' => true]);
    }
}
