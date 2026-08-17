// ============================================================
// Block Tracker : état de synchronisation persistant par contrat.
// Garantit le catch-up au redémarrage et la non-régression en cas
// d'erreur RPC (on ne persiste que les blocs réellement traités).
// ============================================================
import { getPool } from './db.js';
import { config } from './config.js';

/**
 * Charge last_processed_block depuis la BDD.
 * Si absent, initialise à DEPLOYMENT_BLOCK - 1 (le bloc de déploiement
 * lui-même sera inclus dans la première plage traitée).
 * @returns {Promise<number>}
 */
export async function loadLastProcessedBlock() {
  const p = getPool();
  const [rows] = await p.query(
    'SELECT last_processed_block FROM blockchain_sync_states WHERE contract_address = ?',
    [config.contractAddress]
  );

  if (rows.length === 0) {
    const start = config.deploymentBlock - 1;
    return start < 0 ? 0 : start;
  }

  // mysql2 avec bigNumberStrings retourne une string → conversion en number.
  return Number(rows[0].last_processed_block);
}

/**
 * Persiste last_processed_block (upsert).
 * @param {number} block
 */
export async function saveLastProcessedBlock(block) {
  const p = getPool();
  await p.query(
    `INSERT INTO blockchain_sync_states (contract_address, last_processed_block)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE last_processed_block = VALUES(last_processed_block)`,
    [config.contractAddress, block]
  );
}
