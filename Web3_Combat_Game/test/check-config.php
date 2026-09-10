<?php
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
echo "settle_script config: " . config('services.web3.settle_script') . "\n";
echo "withdraw_push config: " . config('services.web3.withdraw_push_script') . "\n";
echo "settle is_file: " . var_export(is_file(config('services.web3.settle_script')), true) . "\n";