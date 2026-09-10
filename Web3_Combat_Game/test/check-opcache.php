<?php
// Test : les options du canal 'guards' — Broadcaster::retrieveUser :
//   $options = $this->retrieveChannelOptions($channel);
//   $guards = $options['guards'] ?? null;
//   if (is_null($guards)) return $request->user();
// retrieveChannelOptions lit $this->channelOptions[$channel] — MAIS PusherBroadcaster
// reçoit les options depuis config('broadcasting.connections.reverb') ?
// En fait pour les canaux Broadcast::channel() simples, options = [].
// Donc retrieveUser → $request->user() → resolver → guard OK (prouvé).
//
// ALORS pourquoi 403 ? Vérifions si le Serveur Laravel utilise un NOEUD
// OPcache avec l'ANCIEN code de channels.php (opcache !) :
echo "opcache.enable: " . (function_exists('opcache_get_configuration') ? 'oui' : 'non') . "\n";
if (function_exists('opcache_get_status')) {
    $s = opcache_get_status(false);
    echo "opcache actif: " . var_export(!empty($s), true) . "\n";
    if ($s && isset($s['scripts'])) {
        foreach ($s['scripts'] as $file => $info) {
            if (str_contains($file, 'channels.php')) {
                echo "channels.php en cache: $file\n";
                echo "timestamp compilé: " . date('H:i:s', $info['timestamp']) . "\n";
            }
        }
    }
}