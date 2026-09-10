<?php

use Illuminate\Support\Facades\Broadcast;

// IMPORTANT — convention de nommage des canaux privés/presence :
// le PusherBroadcaster::auth() passe le nom NORMALISÉ (préfixe 'private-'
// ou 'presence-' retiré) à verifyUserCanAccessChannel. Les patterns de
// Broadcast::channel() doivent donc être déclarés SANS préfixe pour matcher,
// sinon AccessDeniedHttpException (403) sur /broadcasting/auth.
//   Canal front 'presence-lobby'    → pattern 'lobby'      (+ variante préfixée conservée)
//   Canal front 'private-player.X'  → pattern 'player.{id}' (+ variante préfixée conservée)
//   Canal front 'pool.{id}'         → pattern 'pool.{id}'  (inchangé)
// On garde les déclarations préfixées pour compat si une version du framework
// les matche telles quelles.

Broadcast::channel('lobby', function ($user) {
    // presence-lobby (nom normalisé) : retourne les infos de l'utilisateur
    return ['id' => $user->id, 'name' => $user->name, 'status' => 'available'];
});

Broadcast::channel('presence-lobby', function ($user) {
    // Variante préfixée (compat)
    return ['id' => $user->id, 'name' => $user->name, 'status' => 'available'];
});

Broadcast::channel('player.{id}', function ($user, $id) {
    // private-player.{id} (nom normalisé). Comparaison insensible à la casse :
    // le front envoie l'adresse en format checksum (MetaMask) tandis que la
    // DB stocke en lowercase.
    return strtolower((string) $user->id) === strtolower((string) $id);
});

Broadcast::channel('private-player.{id}', function ($user, $id) {
    // Variante préfixée conservée (compat).
    return strtolower((string) $user->id) === strtolower((string) $id);
});

Broadcast::channel('pool.{id}', function ($user, $id) {
    // Dans un channel presence pool, on retourne les infos
    return ['id' => $user->id, 'name' => $user->name, 'status' => 'in_pool'];
});
