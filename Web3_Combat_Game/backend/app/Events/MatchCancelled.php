<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Diffusé quand un match est ANNULÉ avant tout combat — typiquement parce qu'un
 * dépôt escrow a ÉCHOUÉ définitivement côté wallet (réseau/refus utilisateur).
 * Permet à l'adversaire (déjà en attente de MatchReady) de sortir proprement du
 * match, au lieu d'un « forfait silencieux » après timeout.
 * NB : PrivateChannel préfixe automatiquement "private-" → passer 'player.X'.
 */
class MatchCancelled implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $matchId;
    public $player1;
    public $player2;
    public $reason;
    public $cancelledBy;

    public function __construct($matchId, $player1, $player2, $reason = 'deposit_failed', $cancelledBy = null)
    {
        $this->matchId = $matchId;
        $this->player1 = $player1;
        $this->player2 = $player2;
        $this->reason = $reason;
        $this->cancelledBy = $cancelledBy;
    }

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('player.' . strtolower($this->player1)),
            new PrivateChannel('player.' . strtolower($this->player2)),
        ];
    }
}
