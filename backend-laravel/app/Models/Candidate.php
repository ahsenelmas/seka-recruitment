<?php

namespace App\Models;

use App\Models\Concerns\ScopesDemoBranch;
use App\Observers\CandidateHistoryObserver;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;

class Candidate extends Model
{
    use HasUuids;
    use ScopesDemoBranch;

    protected $attributes = ['status' => 'new'];

    protected $fillable = [
        'first_name',
        'last_name',
        'email',
        'phone',
        'position',
        'branch_id',
        'status',
        'hr_notes',
        'source',
        'email_subject',
        'email_body',
        'cv_storage_key',
        'cv_original_filename',
        'cv_validation_error',
    ];

    protected $hidden = [
        'cv_storage_key', 'applicant_id',
    ];

    protected $appends = [
        'missing_information',
        'is_complete',
        'follow_up_email', 'main_state',
    ];

    // Keep the submission write and its history events in the same transaction.
    public function save(array $options = [])
    {
        return DB::transaction(fn () => parent::save($options));
    }

    protected function casts(): array
    {
        return ['hr_support_required' => 'boolean', 'qualification_required' => 'boolean', 'future_consent' => 'boolean', 'completed_at' => 'datetime', 'interview_at' => 'datetime', 'consent_recorded_at' => 'datetime'];
    }

    protected static function booted(): void
    {
        static::saving(function (Candidate $candidate) {
            if (in_array($candidate->status, ['new_complete', 'new_incomplete'], true)) {
                $candidate->status = $candidate->is_complete ? 'new_complete' : 'new_incomplete';
            }if ($candidate->exists && $candidate->isDirty('status') && ! $candidate->isDirty('process_version')) {
                $candidate->process_version = (int) $candidate->process_version + 1;
            }
        });
        static::observe(CandidateHistoryObserver::class);
        static::creating(function (Candidate $candidate) {
            $email = mb_strtolower(trim($candidate->email));
            $candidate->email = $email;
        });
    }

    public function messages(): HasMany
    {
        return $this->hasMany(ApplicationMessage::class);
    }

    public function attributesToArray(): array
    {
        $attributes = parent::attributesToArray();
        $permissions = request()->attributes->get('seka_demo_permissions');
        if (is_array($permissions) && ! in_array('correspondence.view', $permissions, true)) {
            unset($attributes['email_subject'], $attributes['email_body']);
        }

        return $attributes;
    }

    public function applicant(): BelongsTo
    {
        return $this->belongsTo(Applicant::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    protected function mainState(): Attribute
    {
        return Attribute::make(get: fn () => RecruitmentStatus::find($this->status)?->main_state ?? 'new');
    }

    protected function missingInformation(): Attribute
    {
        return Attribute::make(
            get: function (): array {
                $issues = [];

                if ($this->cv_validation_error) {
                    $issues[] = 'invalid_cv';
                } elseif (! $this->cv_storage_key) {
                    $issues[] = 'missing_cv';
                }

                if ($this->branch_id === null) {
                    $issues[] = 'missing_city';
                }

                if (trim((string) $this->position) === '') {
                    $issues[] = 'missing_position';
                }

                return $issues;
            }
        );
    }

    protected function isComplete(): Attribute
    {
        return Attribute::make(
            get: fn (): bool => empty($this->missing_information)
        );
    }

    protected function followUpEmail(): Attribute
    {
        return Attribute::make(
            get: function (): array {
                $issues = $this->missing_information;

                if (empty($issues)) {
                    return [
                        'status' => 'not_needed',
                        'recipient' => $this->email,
                        'subject' => null,
                        'body' => null,
                        'missing_information' => [],
                    ];
                }

                $requests = [
                    'missing_cv' => 'dokument CV w formacie PDF',
                    'invalid_cv' => 'poprawny, czytelny dokument CV w formacie PDF bez hasła',
                    'missing_city' => 'miasto / oddział, do którego kierowana jest aplikacja',
                    'missing_position' => 'nazwa stanowiska, na które składana jest aplikacja',
                ];

                $lines = array_map(
                    fn (string $issue): string => '- '.$requests[$issue],
                    $issues
                );

                $body = "Dzień dobry,\n\n"
                    .'dziękujemy za przesłanie aplikacji do SEKA. '
                    .'Aby kontynuować proces rekrutacji, prosimy '
                    ."o uzupełnienie następujących informacji lub dokumentów:\n\n"
                    .implode("\n", $lines)
                    ."\n\nProsimy o przesłanie brakujących informacji "
                    ."lub dokumentów w odpowiedzi na tę wiadomość.\n\n"
                    ."Pozdrawiamy,\nZespół HR SEKA";

                return [
                    'status' => 'draft_only',
                    'recipient' => $this->email,
                    'subject' => 'SEKA — prośba o uzupełnienie aplikacji',
                    'body' => $body,
                    'missing_information' => $issues,
                ];
            }
        );
    }
}
