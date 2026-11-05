<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('seka:purge --execute')->dailyAt('02:15')->timezone('Europe/Warsaw')->when(fn () => config('p01.retention_enabled'))->withoutOverlapping();

Schedule::command('seka:cleanup-files')->hourly()->withoutOverlapping();
