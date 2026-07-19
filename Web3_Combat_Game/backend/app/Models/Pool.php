<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Pool extends Model
{
    use HasFactory;

    // Use on-chain ID directly as primary key without auto incrementing if needed, but since it's integer, it's fine.
    public $incrementing = false;
    protected $keyType = 'integer';

    protected $fillable = [
        'id',
        'entry_fee',
        'max_players',
        'penalty_mode',
        'is_private',
        'invite_code',
        'status',
        'round_pending_matches'
    ];

    public function players()
    {
        return $this->hasMany(PoolPlayer::class);
    }
}
