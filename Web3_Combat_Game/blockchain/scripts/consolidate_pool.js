/**
 * Consolidation du pot d'une poule par le SERVEUR (autorité backend).
 *
 * Usage :
 *   node consolidate_pool.js <pool_id> <winner_wallet> <loser1> <loser2> ...
 *
 * Pour chaque perdant ayant encore un solde sur le contrat :
 *   1. Récupère le voucher de règlement signé par le backend (API Laravel),
 *   2. Soumet settleLoser(winner, loser, signature) via le compte signer backend
 *      (financé en gaz sur le réseau local).
 *
 * Le pot est ainsi consolidé sur le compte du champion même si son client
 * se déconnecte avant la fin.
 */
import { ethers } from "ethers";

const RPC = process.env.WEB3_RPC_URL || "http://127.0.0.1:8545";
const BACKEND = process.env.WEB3_BACKEND_URL || "http://127.0.0.1:8000/api";
// Compte #1 Hardhat = backend signer (signe les vouchers ET paie le gaz)
const SIGNER_KEY = process.env.WEB3_BACKEND_SIGNER_KEY || "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

const [,, poolId, winner, ...losers] = process.argv;

if (!poolId || !winner || losers.length === 0) {
  console.error("Usage: node consolidate_pool.js <pool_id> <winner> <loser1> <loser2> ...");
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider(RPC);
const signer = new ethers.Wallet(SIGNER_KEY, provider);

const contractRes = await fetch(`${BACKEND}/withdraw/settle-voucher`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ winner_address: winner, loser_address: losers[0] })
});
const probe = await contractRes.json();
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

let total = 0n;
console.log(`Consolidation poule #${poolId} — champion ${winner.slice(0, 6)}...`);

for (const loser of losers) {
  if (loser.toLowerCase() === winner.toLowerCase()) continue;
  let bal;
  try {
    bal = await readContract.userBalances(loser);
  } catch (e) {
    console.error("Lecture solde échouée pour", loser, e.message);
    continue;
  }
  if (bal <= 0n) {
    console.log(`  ${loser.slice(0, 6)}... solde 0, ignoré`);
    continue;
  }

  const res = await fetch(`${BACKEND}/withdraw/settle-voucher`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ winner_address: winner, loser_address: loser })
  });
  const v = await res.json();
  if (!res.ok || !v.signature) {
    console.error(`  Voucher refusé pour ${loser.slice(0, 6)}... :`, v.error || "inconnu");
    continue;
  }

  try {
    const tx = await writeContract.settleLoser(v.winner, v.loser, v.signature);
    await tx.wait();
    total += bal;
    console.log(`  ${loser.slice(0, 6)}... réglé -> +${ethers.formatEther(bal)} ETH (tx ${tx.hash})`);
  } catch (e) {
    console.error(`  Échec settle pour ${loser.slice(0, 6)}... :`, e.shortMessage || e.message);
  }
}

console.log(`Consolidation terminée : +${ethers.formatEther(total)} ETH consolidés sur ${winner.slice(0, 6)}...`);
