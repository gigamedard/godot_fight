import "@nomicfoundation/hardhat-toolbox";

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
    // ChainId dédié à CE projet (Web3 Combat Game) : 8845 (hex 0x2295).
    // L'utilisateur a déjà un réseau Hardhat 31337 (0x7a69) pour un AUTRE
    // projet dans MetaMask — deux projets ne peuvent pas partager un chainId
    // dans MetaMask, d'où cet ID distinct.
    hardhat: {
      chainId: 8845,
    },
  },
};
