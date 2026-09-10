<?php
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
event(new \App\Events\ChallengeSent(
    '0x0000000000000000000000000000000000000001',
    '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    10, 1
));
echo "dispatch OK";