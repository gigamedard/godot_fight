<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ChallengeDeclined implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $challengerId;
    public $targetId;
    public $isNegotiation;

    /**
     * Create a new event instance.
     */
    public function __construct($challengerId, $targetId, $isNegotiation = false)
    {
        $this->challengerId = $challengerId;
        $this->targetId = $targetId;
        $this->isNegotiation = $isNegotiation;
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    public function broadcastOn(): array
    {
        // NB : PrivateChannel préfixe automatiquement avec "private-" →
        // passer 'player.X' (cf. ChallengeSent).
        return [
            new PrivateChannel('player.' . strtolower($this->challengerId)),
        ];
    }
}
