import { ethers } from "ethers";
import fs from "fs";

async function main() {
  const keys = [];
  
  // Hardhat uses a standard mnemonic: "test test test test test test test test test test test junk"
  const mnemonic = "test test test test test test test test test test test junk";
  
  // We only export 20 to match Hardhat's default funded accounts
  for (let i = 0; i < 20; i++) {
    const path = `m/44'/60'/0'/0/${i}`;
    const wallet = ethers.HDNodeWallet.fromPhrase(mnemonic, "", path);
    keys.push({
      address: wallet.address,
      privateKey: wallet.privateKey
    });
  }

  const jsContent = `const HARDHAT_ACCOUNTS = ${JSON.stringify(keys, null, 2)};`;
  fs.writeFileSync("../frontend/hardhat_keys.js", jsContent);
  console.log("Exported 51 hardhat keys to frontend/hardhat_keys.js");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
