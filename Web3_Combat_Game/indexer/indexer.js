// ============================================================
// Indexeur blockchain robuste & idempotent (APP2)
//
// Remplace l'ancien listener WebSocket en mémoire par un polling
// par plage de blocs avec :
//   - état de synchronisation persistant (blockchain_sync_states)
//   - anti-doublons strict (processed_blockchain_events)
//   - sécurité reorg (CONFIRMATIONS_REQUIRED)
//   - exponential backoff sur erreur RPC (sans crash)
//   - catch-up automatique au redémarrage
// ============================================================
import fs from 'fs';
import { ethers } from 'ethers';
import { config, validateConfig } from './config.js';
import { initSchema, closePool } from './db.js';
import { loadLastProcessedBlock, saveLastProcessedBlock } from './blockTracker.js';
import { processEvents } from './eventProcessor.js';
import { handleEvent } from './handlers.js';

let provider;
let contract;
let lastProcessedBlock;
let backoffMs = config.backoffBaseMs;
let running = true;

/**
 * Charge l'ABI depuis l'artifact Hardhat.
 */
function loadAbi() {
  try {
    const artifact = JSON.parse(fs.readFileSync(config.artifactPath, 'utf8'));
    return artifact.abi;
  } catch (e) {
    throw new Error(`[Indexer] Impossible de charger l'ABI depuis ${config.artifactPath}: ${e.message}`);
  }
}

/**
 * Récupère les logs d'une plage de blocs via getLogs (polling).
 * @param {number} fromBlock
 * @param {number} toBlock
 * @returns {Promise<Array<{txHash, logIndex, eventName, blockNumber, args}>>}
 */
async function fetchLogs(fromBlock, toBlock) {
  const logs = await provider.getLogs({
    address: config.contractAddress,
    fromBlock,
    toBlock,
  });

  const events = [];
  for (const log of logs) {
    let parsed;
    try {
      parsed = contract.interface.parseLog(log);
    } catch (_) {
      // Log non décodable (autre contrat / topic inconnu) → ignoré.
      continue;
    }
    if (!parsed) continue;

    events.push({
      txHash: log.transactionHash,
      logIndex: log.index,
      eventName: parsed.name,
      blockNumber: log.blockNumber,
      args: parsed.args,
    });
  }
  return events;
}

/**
 * Un cycle de polling complet.
 * @returns {Promise<{synced: boolean, processed: number, skipped: number}>}
 */
async function pollOnce() {
  // 1. Dernier bloc de la chaîne (number).
  const latestBlock = await provider.getBlockNumber();

  // 2. Bloc max sécurisé (reorg safety).
  const targetBlock = latestBlock - config.confirmationsRequired;

  // 3. Rien à faire si on est déjà à jour.
  if (lastProcessedBlock >= targetBlock) {
    return { synced: false, processed: 0, skipped: 0 };
  }

  // 4. Plage de traitement bornée par MAX_BLOCK_RANGE.
  const fromBlock = lastProcessedBlock + 1;
  const toBlock = Math.min(fromBlock + config.maxBlockRange - 1, targetBlock);

  // 5. Récupération des logs.
  const events = await fetchLogs(fromBlock, toBlock);

  // 6. Traitement idempotent (claim + handler + mark processed).
  const { processed, skipped } = await processEvents(events, handleEvent);

  // 7. Persistance de l'avancement (uniquement après succès complet).
  await saveLastProcessedBlock(toBlock);
  lastProcessedBlock = toBlock;

  console.log(
    `[Indexer] Synced blocks ${fromBlock} -> ${toBlock} | Events processed: ${processed} | Skipped: ${skipped}`
  );

  return { synced: true, processed, skipped };
}

/**
 * Boucle principale : polling + backoff exponentiel.
 */
async function run() {
  while (running) {
    try {
      const { synced } = await pollOnce();
      // Succès : reset du backoff.
      backoffMs = config.backoffBaseMs;

      if (!synced) {
        // À jour : on attend l'intervalle normal.
        await sleep(config.pollIntervalMs);
      }
      // Si synced, on enchaîne immédiatement pour rattraper le retard
      // (catch-up rapide) sans attendre l'intervalle.
    } catch (err) {
      // Erreur RPC / DB : on loggue, on backoff, on ne persiste PAS
      // last_processed_block → catch-up automatique au rétablissement.
      console.error(`[Indexer] Erreur de polling: ${err.message}`);
      console.error(`[Indexer] Backoff ${backoffMs}ms avant retry...`);
      await sleep(backoffMs);
      backoffMs = Math.min(backoffMs * 2, config.backoffMaxMs);
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Point d'entrée.
 */
async function main() {
  validateConfig();
  console.log('🔄 [Indexer] Démarrage (polling par plage de blocs)...');
  console.log(`   RPC: ${config.rpcUrl}`);
  console.log(`   Contrat: ${config.contractAddress}`);
  console.log(`   Confirmations requises: ${config.confirmationsRequired}`);
  console.log(`   Plage max: ${config.maxBlockRange} blocs | Intervalle: ${config.pollIntervalMs}ms`);

  // 1. Schéma BDD (idempotent).
  await initSchema();

  // 2. État de synchronisation persistant.
  lastProcessedBlock = await loadLastProcessedBlock();
  console.log(`   Reprise depuis le bloc: ${lastProcessedBlock.toString()}`);

  // 3. Provider + contrat.
  provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const abi = loadAbi();
  contract = new ethers.Contract(config.contractAddress, abi, provider);

  // 4. Boucle.
  await run();
}

// Arrêt propre (SIGINT/SIGTERM).
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    console.log(`\n[Indexer] Arrêt demandé (${sig})...`);
    running = false;
    await closePool();
    process.exit(0);
  });
}

main().catch(async (err) => {
  console.error('[Indexer] Erreur fatale au démarrage:', err);
  await closePool();
  process.exit(1);
});
