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

    public function test_repeated_submissions_are_independent_and_keep_documents(): void
    {
        $first = Candidate::create(['first_name' => 'Anna', 'last_name' => 'Test', 'email' => 'Anna@example.com', 'cv_storage_key' => 'cvs/first.pdf']);
        $second = Candidate::create(['first_name' => 'Anna', 'last_name' => 'Test', 'email' => 'anna@example.com', 'cv_storage_key' => 'cvs/second.pdf']);
        $this->assertNull($first->applicant_id);
        $this->assertNull($second->applicant_id);
        $this->assertSame(0, Applicant::count());
        $this->assertSame(2, Candidate::count());
        $this->assertSame('cvs/first.pdf', $first->fresh()->cv_storage_key);
        $this->assertSame('cvs/second.pdf', $second->fresh()->cv_storage_key);
    }

    public function test_independent_records_still_enforce_branch_scope(): void
    {
        $a = Branch::create(['name' => 'A', 'city' => 'Warszawa']);
        $b = Branch::create(['name' => 'B', 'city' => 'Kraków']);
        $mine = Candidate::create(['first_name' => 'Anna', 'last_name' => 'Test', 'email' => 'anna@example.com', 'branch_id' => $a->id]);
        $other = Candidate::create(['first_name' => 'Anna', 'last_name' => 'Test', 'email' => 'anna@example.com', 'branch_id' => $b->id]);
        $this->withCredentials()->withUnencryptedCookie('seka_demo', 'branch_manager:'.$a->id)->getJson('/api/candidates')->assertOk()->assertJsonPath('total', 1);
        $this->getJson('/api/candidates/'.$other->id)->assertNotFound();
        $this->getJson('/api/applicants/11111111-1111-4111-8111-111111111111')->assertStatus(410);
    }
}
