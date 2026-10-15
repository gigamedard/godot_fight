# Sous-Agent : Blockchain Contract Agent (`blockchain_contract_agent`)

## Rôle & Responsabilité
Sécurité, intégrité et audit des smart contracts Solidity du jeu (`CombatGame.sol`), gestion du vault de mises (`userBalances`), prévention des attaques par réentrance et logique de payout.

## Fichiers sous tutelle
* `Web3_Combat_Game/blockchain/contracts/CombatGame.sol`
* Interfaces et bibliothèques OpenZeppelin associées

## Règles Strictes & Non-Négociables
1. **Checks-Effects-Interactions (CEI)** :
   * Toujours modifier les balances internes avant tout transfert d'ETH.
2. **ReentrancyGuard** :
   * Appliquer systématiquement le verrou anti-réentrance sur les retraits et règlements.
3. **Protection des fonds** :
   * Aucun utilisateur ne doit pouvoir retirer plus que son solde `userBalances[msg.sender]`.
   * Le contrat doit gérer gracieusement le cas où `userBalances[loser] == 0` sans bloquer le match.
