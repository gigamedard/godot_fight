import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";

/** @type import('hardhat/config').HardhatUserConfig */
export default {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    // Réseau EN MÉMOIRE réservé aux tests unitaires (`npx hardhat test`).
    // chainId 8845 (hex 0x2295) distinct de l'ancien Hardhat local pour ne pas
    // entrer en collision avec les autres réseaux de dev dans MetaMask.
    // AUCUN déploiement de production ne doit plus viser ce réseau.
    hardhat: {
      chainId: 8845,
    },

    // --- L1 Pingala Chain (RÉSEAU DE PRODUCTION) ---
    // chainId 99999 (hex 0x1869f), symbole natif TST (18 décimales).
    // La clé déployeur est lue depuis PINGALA_DEPLOYER_PK (jamais committée).
    // Les tests E2E locaux d'un nœud Hardhat restent possibles via `hardhat`.
    pingala: {
      url:
        process.env.PINGALA_RPC_URL ||
        "https://31.187.72.98.sslip.io/ext/bc/2bU2988XvYbG4z85k39QxhDNomHWREnTKzYWLViU1RMCeSwEea/rpc",
      chainId: 99999,
      accounts: process.env.PINGALA_DEPLOYER_PK ? [process.env.PINGALA_DEPLOYER_PK] : [],
    },
  },
};
