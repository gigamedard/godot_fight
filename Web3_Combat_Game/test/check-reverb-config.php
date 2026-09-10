<?php
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
echo "REVERB: " . json_encode(config('broadcasting.connections.reverb')) . "\n";
echo "DRIVER: " . config('broadcasting.default') . "\n";