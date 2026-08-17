// ============================================================
// Configuration de l'indexeur blockchain (APP2)
// Chargée depuis les variables d'environnement (.env / docker-compose).
// ============================================================
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Charge .env s'il existe (non bloquant : docker-compose injecte déjà les vars)
dotenv.config({ path: join(__dirname, '.env') });

function intEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) {
    throw new Error(`[Indexer] ${name} doit être un entier, reçu: "${raw}"`);
  }
  return n;
}

export const config = {
  // --- RPC ---
  // Le polling (getLogs/getBlockNumber) nécessite un endpoint HTTP RPC.
  // RPC_HTTP_URL est prioritaire ; sinon on dérive de RPC_URL en convertissant
  // ws:// -> http:// (le WebSocket n'est plus utilisé : on fait du polling).
  rpcUrl: process.env.RPC_HTTP_URL || (process.env.RPC_URL || 'ws://blockchain:8545').replace(/^ws:/, 'http:'),

  // --- Contrat ---
  contractAddress: (process.env.CONTRACT_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3').toLowerCase(),
  artifactPath: process.env.ARTIFACT_PATH || '/srv/blockchain/artifacts/contracts/CombatGame.sol/CombatGame.json',

  // --- Bloc de déploiement (point de départ si aucun état persisté) ---
  deploymentBlock: intEnv('DEPLOYMENT_BLOCK', 0),

  // --- Sécurité reorg ---
  // Nombre de blocs de confirmation requis avant de considérer un bloc final.
  // 5-12 selon la chaîne. Hardhat local = 0 (pas de reorg), mais on garde
  // une valeur par défaut prudente.
  confirmationsRequired: intEnv('CONFIRMATIONS_REQUIRED', 5),

  // --- Polling ---
  pollIntervalMs: intEnv('POLL_INTERVAL_MS', 2000),
  maxBlockRange: intEnv('MAX_BLOCK_RANGE', 1000),

  // --- Backoff exponentiel (erreurs RPC) ---
  backoffBaseMs: intEnv('BACKOFF_BASE_MS', 2000),
  backoffMaxMs: intEnv('BACKOFF_MAX_MS', 30000),

  // --- Backend Laravel (webhook interne) ---
  apiUrl: process.env.API_URL || 'http://api:8000/api/internal',
  indexerSecret: process.env.INDEXER_SECRET || 'super_secret_indexer_token',

  // --- MySQL (persistance d'état) ---
  db: {
    host: process.env.DB_HOST || 'db',
    port: intEnv('DB_PORT', 3306),
    user: process.env.DB_USERNAME || 'user',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_DATABASE || 'web3_combat',
  },
};

// Validation stricte au démarrage : refuse de tourner avec une config incohérente.
export function validateConfig() {
  const errors = [];
  if (!config.rpcUrl) errors.push('RPC_URL manquant');
  if (!config.contractAddress || !/^0x[0-9a-f]{40}$/.test(config.contractAddress)) {
    errors.push(`CONTRACT_ADDRESS invalide: "${config.contractAddress}"`);
  }
  if (config.confirmationsRequired < 0) errors.push('CONFIRMATIONS_REQUIRED doit être >= 0');
  if (config.maxBlockRange < 1) errors.push('MAX_BLOCK_RANGE doit être >= 1');
  if (config.pollIntervalMs < 100) errors.push('POLL_INTERVAL_MS doit être >= 100ms');
  if (config.backoffMaxMs < config.backoffBaseMs) {
    errors.push('BACKOFF_MAX_MS doit être >= BACKOFF_BASE_MS');
  }
  if (errors.length > 0) {
    throw new Error(`[Indexer] Configuration invalide:\n  - ${errors.join('\n  - ')}`);
  }
}
