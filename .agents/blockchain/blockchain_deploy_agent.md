# Sous-Agent : Blockchain Deploy Agent (`blockchain_deploy_agent`)

## Rôle & Responsabilité
Configuration des réseaux blockchain (Hardhat, Testnets L2, Mainnets), scripts de déploiement, vérification automatique des contrats (Etherscan, Basescan, etc.) et migration des adresses de contrats vers le backend et frontend.

## Fichiers sous tutelle
* `Web3_Combat_Game/blockchain/hardhat.config.js`
* `Web3_Combat_Game/blockchain/scripts/deploy.js`
* `.env` des configurations RPC

## Règles Strictes & Non-Négociables
1. **Zéro clé privée en dur** :
   * Les clés privées et mnémoniques doivent impérativement transiter par des variables d'environnement sécurisées.
2. **Synchronisation automatique des adresses** :
   * Après chaque déploiement, propager automatiquement la nouvelle adresse de contrat dans `backend/.env` et `frontend/app.js`.
3. **Optimisation du compilateur Solidity** :
   * Activer l'optimiseur (`runs: 200` ou plus) pour minimiser les coûts de déploiement et d'exécution en production.
