/**
 * Retrait PUSH gasless — exécuté par le SERVEUR.
 *
 * Usage :
 *   node withdraw_push.js <user_wallet>
 *
 * 1. Récupère le solde on-chain du joueur, puis le voucher de retrait signé
 *    par le backend (API Laravel) pour ce montant,
 * 2. Soumet withdrawTo(user, amount, nonce, signature) via le compte signer
 *    backend (paie le gaz — le joueur ne signe rien, ne paie rien).
 *
 * Le joueur voit ses ETH arriver directement dans son wallet : 0 popup MetaMask.
 */
import { ethers } from "ethers";

const RPC = process.env.WEB3_RPC_URL || "http://127.0.0.1:8545";
const BACKEND = process.env.WEB3_BACKEND_URL || "http://127.0.0.1:8000/api";
const SIGNER_KEY = process.env.WEB3_BACKEND_SIGNER_KEY || "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

const [,, user] = process.argv;

if (!user) {
  console.error("Usage: node withdraw_push.js <user_wallet>");
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider(RPC);
const signer = new ethers.Wallet(SIGNER_KEY, provider);

const abi = [
  "function userBalances(address) view returns (uint256)",
  "function withdrawTo(address,uint256,uint256,bytes)"
];

// 1. Solde on-chain du joueur (via un probe du backend pour l'adresse contrat)
const probeRes = await fetch(`${BACKEND}/withdraw/voucher`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ wallet_address: user, amount_wei: "1" })
});
const probe = await probeRes.json().catch(() => ({}));
const contractAddress = probe.contract_address;
if (!contractAddress) {
  console.error("Impossible de déterminer l'adresse du contrat :", probe);
  process.exit(1);
}

const readContract = new ethers.Contract(contractAddress, abi, provider);
const writeContract = new ethers.Contract(contractAddress, abi, signer);

let bal;
try {
  bal = await readContract.userBalances(user);
} catch (e) {
  console.error("Lecture solde échouée pour", user, e.message);
  process.exit(1);
}
if (bal <= 0n) {
  console.log(`  ${user.slice(0, 6)}... solde 0, rien à retirer`);
  process.exit(0);
}

// 2. Voucher pour le montant exact du solde
const vRes = await fetch(`${BACKEND}/withdraw/voucher`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ wallet_address: user, amount_wei: bal.toString() })
});
const v = await vRes.json();
if (!vRes.ok || !v.signature) {
  console.error(`Voucher de retrait refusé pour ${user.slice(0, 6)}... :`, v.error || "inconnu");
  process.exit(1);
}

// 3. Soumission gasless via le backend signer
try {
  const tx = await writeContract.withdrawTo(user, v.amount, v.nonce, v.signature);
  const rec = await tx.wait();
  console.log(`  ${user.slice(0, 6)}... a retiré ${ethers.formatEther(v.amount)} ETH (tx ${rec.hash})`);
} catch (e) {
  console.error(`Échec retrait pour ${user.slice(0, 6)}... :`, e.shortMessage || e.message);
  process.exit(1);
}