// ============================================================
// Handlers métier : mapping événement on-chain → webhook Laravel.
//
// NOTE IMPORTANTE (décalage à aligner avec le métier) :
//   L'ancien indexer (index.js) écoutait `PoolStarted` et
//   `PoolMatchFinished` et postait vers /internal/pool-started et
//   /internal/match-finished. Le contrat CombatGame.sol ACTUEL
//   n'émet plus ces événements : il émet désormais Deposit,
//   DepositWithFee, PoolDeposit, PoolClaimed, Withdrawal,
//   MatchSettled, MoveCommitted, TreasuryWithdrawn.
//
//   Ce module fournit donc :
//     - les handlers des événements réellement émis par le contrat actuel ;
//     - un fallback de log pour tout événement sans handler dédié.
//   Le mapping vers les endpoints Laravel doit être validé avec le métier
//   (certains événements n'ont pas encore d'endpoint interne dédié).
// ============================================================
import axios from 'axios';
import { config } from './config.js';

const api = axios.create({
  baseURL: config.apiUrl,
  headers: {
    Authorization: `Bearer ${config.indexerSecret}`,
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

/**
 * POST sécurisé vers l'API interne Laravel.
 * @param {string} endpoint - ex: '/pool-started'
 * @param {object} body
 */
async function postToLaravel(endpoint, body) {
  try {
    await api.post(endpoint, body);
    console.log(`  ✅ [Indexer] → Laravel ${endpoint}`);
  } catch (e) {
    // On loggue mais on ne fait PAS échouer le traitement : l'événement
    // est déjà claimé en BDD, un re-run de réconciliation pourra le
    // re-pousser si nécessaire.
    console.error(`  ❌ [Indexer] Laravel ${endpoint} error:`, e.response?.data || e.message);
  }
}

/**
 * Registre des handlers par nom d'événement.
 * Chaque handler reçoit l'objet événement parsé (args + métadonnées).
 */
const handlers = {
  // --- Dépôts (comptabilité serveur) ---
  async Deposit(ev) {
    const [user, amount] = ev.args;
    console.log(`  💰 [Deposit] user=${user} amount=${amount.toString()}`);
    // TODO: endpoint Laravel de crédit de solde (à confirmer avec le métier).
  },

  async DepositWithFee(ev) {
    const [user, stake, fee] = ev.args;
    console.log(`  💰 [DepositWithFee] user=${user} stake=${stake.toString()} fee=${fee.toString()}`);
  },

  // --- Escrow de poule (winner-take-all) ---
  async PoolDeposit(ev) {
    const [poolId, user, stake] = ev.args;
    console.log(`  🟦 [PoolDeposit] poolId=${poolId.toString()} user=${user} stake=${stake.toString()}`);
  },

  async PoolClaimed(ev) {
    const [poolId, winner, amount] = ev.args;
    console.log(`  🏆 [PoolClaimed] poolId=${poolId.toString()} winner=${winner} amount=${amount.toString()}`);
    await postToLaravel('/pool-claimed', {
      pool_id: poolId.toString(),
      winner,
      amount: amount.toString(),
    });
  },

  // --- Retraits / règlements ---
  async Withdrawal(ev) {
    const [user, amount, nonce] = ev.args;
    console.log(`  💸 [Withdrawal] user=${user} amount=${amount.toString()} nonce=${nonce.toString()}`);
  },

  async MatchSettled(ev) {
    const [winner, loser, amount] = ev.args;
    console.log(`  ⚔️ [MatchSettled] winner=${winner} loser=${loser} amount=${amount.toString()}`);
  },

  async MoveCommitted(ev) {
    const [matchHash, player, commitHash] = ev.args;
    console.log(`  🔒 [MoveCommitted] player=${player} matchHash=${matchHash}`);
  },

  async TreasuryWithdrawn(ev) {
    const [owner, amount] = ev.args;
    console.log(`  🏦 [TreasuryWithdrawn] owner=${owner} amount=${amount.toString()}`);
  },

  // --- Compatibilité avec l'ancien contrat (si ces events reviennent) ---
  async PoolStarted(ev) {
    const [poolId, participants] = ev.args;
    console.log(`  🏆 [PoolStarted] poolId=${poolId.toString()} participants=${participants.length}`);
    await postToLaravel('/pool-started', {
      pool_id: poolId.toString(),
      participants,
    });
  },

  async PoolMatchFinished(ev) {
    const [poolId, matchId, player1, player2, winner, loser, isLoserEliminated] = ev.args;
    console.log(`  ⚔️ [PoolMatchFinished] pool=${poolId.toString()} match=${matchId.toString()}`);
    await postToLaravel('/match-finished', {
      pool_id: poolId.toString(),
      match_id: matchId.toString(),
      player1,
      player2,
      winner,
      loser,
      is_eliminated: isLoserEliminated,
    });
  },
};

/**
 * Dispatch un événement vers son handler. Fallback de log si inconnu.
 * @param {{eventName: string, args: any}} ev
 */
export async function handleEvent(ev) {
  const handler = handlers[ev.eventName];
  if (handler) {
    await handler(ev);
  } else {
    console.log(`  ⚠️ [Indexer] Événement sans handler: ${ev.eventName} (ignoré)`);
  }
}
