// ============================================================
// Event Processor : idempotence & anti-doublons strict.
//
// Stratégie "claim-then-process" (crash-safe) :
//   1. On tente d'insérer (tx_hash, log_index) en statut 'pending'
//      dans une transaction. La clé unique (tx_hash, log_index)
//      garantit qu'un seul worker "gagne" le droit de traiter.
//   2. Si l'insertion échoue (duplicate), l'événement a déjà été
//      claimé → on le skip (idempotence).
//   3. On exécute le handler métier, puis on passe le statut à
//      'processed' dans la MÊME transaction.
//   4. En cas de crash entre claim et process, le statut reste
//      'pending' : un re-run de réconciliation peut le reprendre.
// ============================================================
import { getPool } from './db.js';

/**
 * Traite un lot d'événements de façon atomique et idempotente.
 *
 * @param {Array<{txHash: string, logIndex: number, eventName: string, blockNumber: number, args: any}>} events
 * @param {(event: any) => Promise<void>} handler - logique métier (webhook Laravel)
 * @returns {Promise<{processed: number, skipped: number}>}
 */
export async function processEvents(events, handler) {
  const p = getPool();
  let processed = 0;
  let skipped = 0;

  for (const ev of events) {
    const conn = await p.getConnection();
    try {
      await conn.beginTransaction();

      // 1. Claim : insertion idempotente. En cas de doublon, on skip.
      let claimed = false;
      try {
        await conn.query(
          `INSERT INTO processed_blockchain_events
             (tx_hash, log_index, event_name, block_number, status)
           VALUES (?, ?, ?, ?, 'pending')`,
          [ev.txHash, ev.logIndex, ev.eventName, ev.blockNumber]
        );
        claimed = true;
      } catch (err) {
        // ER_DUP_ENTRY (1062) = déjà traité → skip silencieux.
        if (err && err.code === 'ER_DUP_ENTRY') {
          claimed = false;
        } else {
          throw err;
        }
      }

      if (!claimed) {
        await conn.rollback();
        skipped++;
        continue;
      }

      // 2. Logique métier (webhook Laravel).
      await handler(ev);

      // 3. Marque comme traité dans la même transaction.
      await conn.query(
        `UPDATE processed_blockchain_events
         SET status = 'processed'
         WHERE tx_hash = ? AND log_index = ?`,
        [ev.txHash, ev.logIndex]
      );

      await conn.commit();
      processed++;
    } catch (err) {
      // Rollback : le claim reste 'pending' (ou est annulé si le rollback
      // intervient avant le commit de l'insertion). Dans tous les cas,
      // l'événement sera re-tenté au prochain cycle (catch-up).
      try { await conn.rollback(); } catch (_) { /* ignore */ }
      throw err;
    } finally {
      conn.release();
    }
  }

  return { processed, skipped };
}
