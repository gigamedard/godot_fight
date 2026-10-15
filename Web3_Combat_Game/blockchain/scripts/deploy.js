/**
 * Déploiement de CombatGame sur la L1 Pingala Chain (chainId 99999).
 *
 * Prérequis :
 *   - PINGALA_DEPLOYER_PK        : clé privée du compte déployeur (fundé en TST).
 *   - PINGALA_BACKEND_SIGNER_ADDRESS : adresse FRAÎCHE du backendSigner (≠ owner,
 *                                   fundée en TST — c'est elle qui signe les
 *                                   vouchers Laravel et paie le gaz des scripts).
 *   - PINGALA_RPC_URL            : optionnel (RPC Pingala par défaut).
 *
 * Exécution :
 *   npx hardhat run scripts/deploy.js --network pingala
 *
 * Le déploiement est SÉQUENTIEL sur une vraie chaîne (une tx + await tx.wait())
 * et écrit blockchain/deployments.pingala.json (adresse + txHash, JAMAIS de clé).
 */
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import "dotenv/config";

const DEFAULT_RPC =
  "https://31.187.72.98.sslip.io/ext/bc/2bU2988XvYbG4z85k39QxhDNomHWREnTKzYWLViU1RMCeSwEea/rpc";
const CHAIN_ID = 99999;

async function main() {
  const pk = process.env.PINGALA_DEPLOYER_PK;
  if (!pk) {
    throw new Error(
      "PINGALA_DEPLOYER_PK manquant : clé privée du déployeur (account fundé en TST)."
    );
  }

  const backendSigner = process.env.PINGALA_BACKEND_SIGNER_ADDRESS;
  if (!backendSigner || !ethers.isAddress(backendSigner)) {
    throw new Error(
      "PINGALA_BACKEND_SIGNER_ADDRESS manquant ou invalide (adresse fraîche ≠ owner)."
    );
  }

  const rpcUrl = process.env.PINGALA_RPC_URL || DEFAULT_RPC;
  const provider = new ethers.JsonRpcProvider(rpcUrl, CHAIN_ID);
  const wallet = new ethers.Wallet(pk, provider);

  console.log(`Réseau Pingala  : ${rpcUrl} (chainId ${CHAIN_ID})`);
  console.log(`Déployeur/owner : ${wallet.address}`);
  console.log(`Backend signer  : ${backendSigner}`);

  const balance = await provider.getBalance(wallet.address);
  console.log(`Solde TST       : ${ethers.formatEther(balance)} TST`);
  if (balance === 0n) {
    throw new Error(
      "Déployeur sans TST : impossible de payer le gaz. Demander un fund à App 1 " +
        "(pas de faucet public)."
    );
  }

  const artifactPath = path.resolve(
    "artifacts/contracts/CombatGame.sol/CombatGame.json"
  );
  if (!fs.existsSync(artifactPath)) {
    throw new Error(
      `Artifact introuvable : ${artifactPath}. Lancer d'abord "npx hardhat compile".`
    );
  }
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);

  // Déploiement séquentiel : une seule tx à la fois, on attend le minage réel.
  console.log("Déploiement de CombatGame...");
  const game = await factory.deploy(backendSigner);
  const deployTx = game.deploymentTransaction();
  console.log(`Tx envoyée      : ${deployTx.hash} — attente (await tx.wait())...`);
  const receipt = await deployTx.wait();

  const address = await game.getAddress();
  console.log(`CombatGame      : ${address}`);

  const out = {
    network: "pingala",
    chainId: CHAIN_ID,
    contract: "CombatGame",
    address,
    txHash: deployTx.hash,
    blockNumber: receipt ? receipt.blockNumber : null,
    owner: wallet.address,
    backendSigner,
    feeBps: 250,
    deployedAt: new Date().toISOString(),
  };
  fs.writeFileSync(
    "deployments.pingala.json",
    JSON.stringify(out, null, 2) + "\n"
  );
  console.log("Écrit           : blockchain/deployments.pingala.json (adresse + txHash, sans clé).");
  console.log("");
  console.log("Étapes suivantes : renseigner CONTRACT_ADDRESS + DEPLOYMENT_BLOCK");
  console.log("dans backend/.env, indexer/.env et frontend/config.js.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
