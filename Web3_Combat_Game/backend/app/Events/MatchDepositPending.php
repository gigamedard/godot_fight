<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

/**
 * FIX (régression ICDM) : diffusé à l'acceptation du défi — indique au front
 * d'OUVRIR METAMASK pour le dépôt escrow (sans lancer le combat). Le combat
 * ne démarre qu'avec MatchReady (les deux dépôts confirmés on-chain).
 * NB : PrivateChannel préfixe automatiquement "private-" → passer 'player.X'.
 */
class MatchDepositPending implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $matchId;
    public $player1;
    public $player2;
    public $p1Char;
    public $p2Char;
    public $betAmount;

    public function __construct($matchId, $player1, $player2, $p1Char = 2, $p2Char = 2, $betAmount = 0)
    {
        $this->matchId = $matchId;
        $this->player1 = $player1;
        $this->player2 = $player2;
        $this->p1Char = $p1Char;
        $this->p2Char = $p2Char;
        $this->betAmount = $betAmount;
    }

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('player.' . strtolower($this->player1)),
            new PrivateChannel('player.' . strtolower($this->player2)),
        ];
    }
}