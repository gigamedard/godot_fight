<?php
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

// req2->user() OK, mais Broadcast::auth FAIL. Le PusherBroadcaster::auth():
//   if ($request->channel_name) → str_starts_with private → parent::verifyUserCanAccessChannel
// PusherBroadcaster::auth override : ligne ~70 : si ($request->input('socket_id') && $request->input('channel_name'))
// SINON → throw AccessDeniedHttpException aussi ?
// Regardons la méthode auth du PusherBroadcaster :
$src = file_get_contents('/var/www/html/vendor/laravel/framework/src/Illuminate/Broadcasting/Broadcasters/PusherBroadcaster.php');
preg_match('/public function auth\(Illuminate\\Http\\Request[\s\S]*?\n    \}/', $src, $m);
echo $m[0] . "\n";