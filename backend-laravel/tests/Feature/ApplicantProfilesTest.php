<?php

namespace Tests\Feature;

use App\Models\Applicant;
use App\Models\Branch;
use App\Models\Candidate;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApplicantProfilesTest extends TestCase
{
    use RefreshDatabase;

    public function test_repeat_submissions_share_identity_without_losing_documents(): void
    {
        $first = Candidate::create([
            'first_name' => 'Anna', 'last_name' => 'Test',
            'email' => 'Anna@example.com', 'cv_storage_key' => 'cvs/first.pdf',
        ]);
        $second = Candidate::create([
            'first_name' => 'Anna', 'last_name' => 'Test',
            'email' => 'anna@example.com', 'cv_storage_key' => 'cvs/second.pdf',
        ]);
        $this->assertSame($first->applicant_id, $second->applicant_id);
        $this->assertSame(1, Applicant::count());
        $this->assertSame(2, Candidate::count());
        $this->assertSame('cvs/first.pdf', $first->fresh()->cv_storage_key);
        $this->assertSame('cvs/second.pdf', $second->fresh()->cv_storage_key);
    }

    public function test_profile_excludes_other_branches_for_branch_manager(): void
    {
        $warsaw = Branch::create(['name' => 'Warsaw', 'city' => 'Warszawa']);
        $krakow = Branch::create(['name' => 'Krakow', 'city' => 'KrakĂłw']);
        $first = Candidate::create([
            'first_name' => 'Anna', 'last_name' => 'Test',
            'email' => 'anna@example.com', 'branch_id' => $warsaw->id,
        ]);
        $other = Candidate::create([
            'first_name' => 'Anna', 'last_name' => 'Test',
            'email' => 'anna@example.com', 'branch_id' => $krakow->id,
        ]);
        $this->withCredentials()->withUnencryptedCookie('seka_demo', 'branch_manager:'.$warsaw->id)
            ->getJson('/api/applicants/'.$first->applicant_id)
            ->assertOk()->assertJsonPath('visible_application_count', 1)
            ->assertJsonPath('applications.0.id', $first->id)
            ->assertJsonMissing(['id' => $other->id]);
    }
}
