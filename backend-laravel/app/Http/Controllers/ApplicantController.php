<?php

namespace App\Http\Controllers;

class ApplicantController extends Controller
{
    public function show(string $id)
    {
        abort(410, 'P01: applications are independent; applicant grouping is retired.');
    }
}
