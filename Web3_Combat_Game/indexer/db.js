// ============================================================
// Accès MySQL (persistance d'état de l'indexeur)
// Utilise mysql2/promise pour un pool de connexions propre.
// ============================================================
import mysql from 'mysql2/promise';
import { config } from './config.js';

let pool = null;

/**
 * Retourne le pool MySQL (créé à la première utilisation).
 * @returns {Promise<import('mysql2/promise').Pool>}
 */
export function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      charset: 'utf8mb4',
      // Les BIGINT UNSIGNED sont retournés en string pour éviter la perte
      // de précision JS au-delà de 2^53.
      supportBigNumbers: true,
      bigNumberStrings: true,
    });
  }
  return pool;
}

/**
 * Crée les tables de persistance si elles n'existent pas (idempotent).
 * Appelé une fois au démarrage.
 */
export async function initSchema() {
  const p = getPool();
  await p.query(`
    CREATE TABLE IF NOT EXISTS \`blockchain_sync_states\` (
      \`contract_address\`     VARCHAR(42)  NOT NULL,
      \`last_processed_block\` BIGINT UNSIGNED NOT NULL DEFAULT 0,
      \`updated_at\`           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                                             ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`contract_address\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS \`processed_blockchain_events\` (
      \`id\`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`tx_hash\`      VARCHAR(66)  NOT NULL,
      \`log_index\`    INT UNSIGNED NOT NULL,
      \`event_name\`   VARCHAR(128) NOT NULL,
      \`block_number\` BIGINT UNSIGNED NOT NULL,
      \`status\`       ENUM('pending','processed') NOT NULL DEFAULT 'pending',
      \`created_at\`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                       ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uq_tx_log\` (\`tx_hash\`, \`log_index\`),
      KEY \`idx_block_number\` (\`block_number\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

/**
 * Ferme proprement le pool (arrêt du process).
 */
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
