<?php

return [
    'paths' => ['api/*'],

    'allowed_methods' => ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],

    'allowed_origins' => [env('SEKA_FRONTEND_URL', 'http://localhost:3000')],

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['Content-Type', 'Accept'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,
];
