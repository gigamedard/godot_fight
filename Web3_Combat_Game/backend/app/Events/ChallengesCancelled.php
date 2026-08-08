<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

class ChallengesCancelled implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets;

    public string $playerId;
    public string $reason;

    public function __construct(string $playerId, string $reason = 'entered_duel')
    {
        $this->playerId = strtolower($playerId);
        $this->reason = $reason;
    }

    public function broadcastOn(): array
    {
        // Broadcast sur le presence-lobby : TOUS les joueurs connectés le reçoivent.
        // Chaque client décide quoi annuler (sa propre modale, ou celle d'un challenger
        // parti en duel) — c'est le seul canal que tous les joueurs écoutent.
        return [
            new PresenceChannel('presence-lobby'),
        ];
    }

    public function broadcastAs(): string
    {
        return 'ChallengesCancelled';
    }
}
