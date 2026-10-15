# Sous-Agent : Blockchain Settler Agent (`blockchain_settler_agent`)

## Rôle & Responsabilité
Gestion de l'exécution des transactions de règlement sur la blockchain via les scripts Node.js déclenchés par le backend Laravel.

## Fichiers sous tutelle
* `Web3_Combat_Game/blockchain/scripts/settle_fight.js`
* `Web3_Combat_Game/blockchain/scripts/consolidate_pool.js`
* Intégration dans `App\Support\ProcessHelper::spawnBackground`

## Règles Strictes & Non-Négociables
1. **Gestion des nonces et de la concurrence** :
   * Le compte backend signer paie le gaz. En cas de règlements simultanés, gérer l'incrément atomique des nonces pour éviter les blocages de transaction.
2. **Tolérance aux erreurs bénignes** :
   * Conserver la gestion du cas `execution reverted: Nothing to settle` comme un événement normal (le perdant n'avait pas de solde ou était déjà réglé) sans lever d'exception bloquante.
3. **Estimation du gaz** :
   * Toujours inclure un tampon de gaz (gas buffer 20%) pour éviter les out-of-gas lors des consolidations de poules à plusieurs combattants.
