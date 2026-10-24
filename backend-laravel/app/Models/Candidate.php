<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Candidate extends Model
{
    use \App\Models\Concerns\ScopesDemoBranch;

    use HasUuids;

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
        'cv_storage_key',
    ];

    protected $appends = [
        'missing_information',
        'is_complete',
        'follow_up_email',
    ];

    // Keep the submission write and its history events in the same transaction.
    public function save(array $options = [])
    {
        return \Illuminate\Support\Facades\DB::transaction(fn () => parent::save($options));
    }

    protected static function booted(): void
    {
        static::observe(\App\Observers\CandidateHistoryObserver::class);
        static::creating(function (Candidate $candidate) {
            $email = mb_strtolower(trim($candidate->email));
            // The unique email index also protects simultaneous submissions.
            $profile = Applicant::firstOrCreate(['email' => $email]);
            $candidate->applicant_id = $profile->id;
            $candidate->email = $email;
        });
    }

    public function applicant(): BelongsTo
    {
        return $this->belongsTo(Applicant::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
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
                    fn (string $issue): string => '- ' . $requests[$issue],
                    $issues
                );

                $body = "Dzień dobry,\n\n"
                    . "dziękujemy za przesłanie aplikacji do SEKA. "
                    . "Aby kontynuować proces rekrutacji, prosimy "
                    . "o uzupełnienie następujących informacji lub dokumentów:\n\n"
                    . implode("\n", $lines)
                    . "\n\nProsimy o przesłanie brakujących informacji "
                    . "lub dokumentów w odpowiedzi na tę wiadomość.\n\n"
                    . "Pozdrawiamy,\nZespół HR SEKA";

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
