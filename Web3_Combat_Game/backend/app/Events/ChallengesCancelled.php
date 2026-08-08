<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;

class ChallengesCancelled implements ShouldBroadcast
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
        return [
            new Channel('lobby'),
        ];
    }

    public function broadcastAs(): string
    {
        return 'ChallengesCancelled';
    }
}
