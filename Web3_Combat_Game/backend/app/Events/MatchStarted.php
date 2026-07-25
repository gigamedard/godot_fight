<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

class MatchStarted implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $matchId;
    public $player1;
    public $player2;
    public $p1Char;
    public $p2Char;

    /**
     * Create a new event instance.
     */
    public function __construct($matchId, $player1, $player2, $p1Char = 2, $p2Char = 2)
    {
        $this->matchId = $matchId;
        $this->player1 = $player1;
        $this->player2 = $player2;
        $this->p1Char = $p1Char;
        $this->p2Char = $p2Char;
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('private-player.' . $this->player1),
            new PrivateChannel('private-player.' . $this->player2),
        ];
    }
}
