/**
 * Règlement winner-takes-all d'UN combat de poule, exécuté par le SERVEUR.
 *
 * Usage :
 *   node settle_fight.js <pool_id> <winner_wallet> <loser_wallet>
 *
 * Si le perdant a encore un solde sur le contrat :
 *   1. Récupère le voucher de règlement signé par le backend (API Laravel),
 *   2. Soumet settleLoser(winner, loser, signature) via le compte signer backend.
 *
 * Le gagnant du combat accumule ainsi la mise du perdant immédiatement après
 * chaque round (cascade), sans dépendre du client du gagnant. Les combats de
 * poule suivants puis la consolidation finale (consolidate_pool.js) servent de
 * filet de sécurité : tout solde restant finit sur le champion.
 */
import { ethers } from "ethers";

const RPC = process.env.WEB3_RPC_URL || "http://127.0.0.1:8545";
const BACKEND = process.env.WEB3_BACKEND_URL || "http://127.0.0.1:8000/api";
// Compte #1 Hardhat = backend signer (signe les vouchers ET paie le gaz)
const SIGNER_KEY = process.env.WEB3_BACKEND_SIGNER_KEY || "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

const [,, poolId, winner, loser] = process.argv;

if (!poolId || !winner || !loser) {
  console.error("Usage: node settle_fight.js <pool_id> <winner> <loser>");
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider(RPC);
const signer = new ethers.Wallet(SIGNER_KEY, provider);

const probeRes = await fetch(`${BACKEND}/withdraw/settle-voucher`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ winner_address: winner, loser_address: loser })
});
const probe = await probeRes.json();
const contractAddress = probe.contract_address;
if (!contractAddress) {
  console.error("Impossible de déterminer l'adresse du contrat :", probe);
  process.exit(1);
}

const abi = [
  "function userBalances(address) view returns (uint256)",
  "function settleLoser(address,address,bytes)"
];
const readContract = new ethers.Contract(contractAddress, abi, provider);
const writeContract = new ethers.Contract(contractAddress, abi, signer);

console.log(`Settle poule #${poolId} — ${winner.slice(0, 6)}... gagne sur ${loser.slice(0, 6)}...`);

let bal;
try {
  bal = await readContract.userBalances(loser);
} catch (e) {
  console.error("Lecture solde échouée pour", loser, e.message);
  process.exit(1);
}
if (bal <= 0n) {
  console.log(`  ${loser.slice(0, 6)}... solde 0, rien à régler`);
  process.exit(0);
}

const res = await fetch(`${BACKEND}/withdraw/settle-voucher`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ winner_address: winner, loser_address: loser })
});
const v = await res.json();
if (!res.ok || !v.signature) {
  console.error(`Voucher refusé pour ${loser.slice(0, 6)}... :`, v.error || "inconnu");
  process.exit(1);
}

try {
  const tx = await writeContract.settleLoser(v.winner, v.loser, v.signature);
  await tx.wait();
  console.log(`  ${loser.slice(0, 6)}... réglé -> +${ethers.formatEther(bal)} ETH (tx ${tx.hash})`);
} catch (e) {
  console.error(`Échec settle pour ${loser.slice(0, 6)}... :`, e.shortMessage || e.message);
  process.exit(1);
}
