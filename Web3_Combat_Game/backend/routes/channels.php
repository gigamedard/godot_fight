<?php

use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('presence-lobby', function ($user) {
    // Dans un channel de type 'presence', on retourne un array avec les infos de l'utilisateur
    return ['id' => $user->id, 'name' => $user->name, 'status' => 'available'];
});

Broadcast::channel('private-player.{id}', function ($user, $id) {
    // Vérifie que le joueur qui tente de s'abonner est bien le propriétaire du wallet
    return (string) $user->id === (string) $id;
});

Broadcast::channel('pool.{id}', function ($user, $id) {
    // Dans un channel presence pool, on retourne les infos
    return ['id' => $user->id, 'name' => $user->name, 'status' => 'in_pool'];
});
