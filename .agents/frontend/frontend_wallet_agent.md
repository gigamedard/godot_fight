# Sous-Agent : Frontend Wallet Agent (`frontend_wallet_agent`)

## Rôle & Responsabilité
Gestion des fournisseurs Web3 (MetaMask, WalletConnect, Coinbase Wallet), détection des réseaux, switch automatique vers la chaîne cible, signatures cryptographiques des coups et consultation des soldes.

## Fichiers sous tutelle
* `Web3_Combat_Game/frontend/app.js` (modules `connectWallet`, `signMessage`, `getContract`)
* Dépendances Web3 / ethers

## Règles Strictes & Non-Négociables
1. **Gestion des refus utilisateur** :
   * Si l'utilisateur rejette une signature dans son wallet (code 4001), l'UI doit rester propre et permettre de ré-essayer immédiatement sans blocage d'état.
2. **Déconnexion et changement de compte** :
   * Écouter les événements `accountsChanged` et `chainChanged` d'Ethereum pour réinitialiser ou rafraîchir l'application sans recharger la page complète si possible.
3. **Format des signatures** :
   * Garantir que les messages signés correspondent strictement au format attendu par le backend pour la vérification.
