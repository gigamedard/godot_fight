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

class ChallengeSent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $challengerId;
    public $targetId;
    public $betAmount;
    public $challengerChar;

    /**
     * Create a new event instance.
     */
    public function __construct($challengerId, $targetId, $betAmount = 0, $challengerChar = 2)
    {
        $this->challengerId = $challengerId;
        $this->targetId = $targetId;
        $this->betAmount = $betAmount;
        $this->challengerChar = $challengerChar;
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, Channel>
     */
    public function broadcastOn(): array
    {
        // NB : PrivateChannel ajoute automatiquement le préfixe "private-" —
        // passer 'player.X' (et non 'private-player.X' qui donnait
        // 'private-private-player.X'). Le front souscrit à
        // private-player.<wallet> ; publication et souscription doivent viser
        // le même canal. Lowercase : Reverb distingue la casse et le front
        // peut envoyer l'adresse en format checksum.
        return [
            new PrivateChannel('player.' . strtolower($this->targetId)),
        ];
    }
}
