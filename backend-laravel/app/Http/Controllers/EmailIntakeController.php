<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class EmailIntakeController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        return response()->json([]);
    }
}
