/**
 * Export de l'ABI CombatGame vers frontend/contract_abi.js (host).
 * Le conteneur blockchain compile dans son volume ; on lit l'artifact monté.
 */
const fs = require('fs');
const artifact = JSON.parse(
    fs.readFileSync('G:/DEV/GODOT_GAME/Web3_Combat_Game/blockchain/artifacts/contracts/CombatGame.sol/CombatGame.json', 'utf8')
);
const jsContent = `const COMBAT_GAME_ABI = ${JSON.stringify(artifact.abi, null, 2)};`;
fs.writeFileSync('G:/DEV/GODOT_GAME/Web3_Combat_Game/frontend/contract_abi.js', jsContent);
const hasWithdrawTo = artifact.abi.some(x => x.type === 'function' && x.name === 'withdrawTo');
console.log('ABI exporté — withdrawTo présent :', hasWithdrawTo);