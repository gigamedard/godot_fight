<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class PoolRoundStarted implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $poolId;
    public $pairs;
    public $waitingPlayer;
    public $winner;

    public function __construct($poolId, $pairs, $waitingPlayer, $winner = null)
    {
        $this->poolId = $poolId;
        $this->pairs = $pairs;
        $this->waitingPlayer = $waitingPlayer;
        $this->winner = $winner;
    }

    public function broadcastOn(): array
    {
        // Broadcast on a specific pool channel
        return [
            new PresenceChannel('pool.'.$this->poolId),
        ];
    }
}
