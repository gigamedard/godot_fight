# HANDOVER: Suivi du Projet Web3 Combat Game (Godot & Laravel)

## État actuel du projet

L'application tourne avec une architecture repensée (Single Instance) où le jeu Godot est chargé une seule fois en arrière-plan afin d'éviter les rechargements pénibles du moteur 3D à chaque nouvelle page ou match.
Le système gère les duels classiques et les Poules (tournois à élimination avec N joueurs).

**Toutes les problématiques majeures de blocage des poules et de désynchronisation ont été résolues.** L'architecture repose sur un système Gasless/Hybride où le backend Laravel orchestre et valide la logique des combats (commits/reveals off-chain, résolution serveur), tout en synchronisant les états via Websockets (Reverb) et Polling sécurisé.

## Pile technique (environnement de développement)

| Élément | Valeur |
|---|---|
| Frontend | Python HTTP sur `http://127.0.0.1:8080` (fichiers statiques `frontend/`, cache-buster `app.js?v=26`) |
| Backend | Laravel sur `http://127.0.0.1:8000` (API `/api`) |
| Websockets | Laravel Reverb sur `127.0.0.1:8081` |
| Blockchain | Hardhat local sur `http://127.0.0.1:8545` |
| Contrat | `CombatGame` (`blockchain/contracts/CombatGame.sol`) — `0x5FbDB2315678afecb367f032d93F642f64180aa3` |
| Base locale | SQLite `backend/web3_combat` (poules 24/25, fights 70-74) |
| Branche git | `feature/battle-hybrid-matchmaking` — dernier commit local `63bd46d` « Fix unknown winner via activity-based timeout, server pot consolidation and idempotent resolution » (non pushé) |

### Variante conteneurisée (Docker Compose)
Le `docker-compose.yml` reflète le runtime réel (SQLite, Reverb, frontend Python) — **plus de MySQL ni d'indexer** :
- `blockchain` : Hardhat node + déploiement du contrat (`8545:8545`).
- `api` : Laravel (`artisan serve` 8000) **et** Reverb (8081) dans le même conteneur (le broadcast boucle sur `127.0.0.1:8081`, comme en natif). SQLite monté depuis `./backend/web3_combat`. Le backend lance les scripts node `settle_fight.js`/`consolidate_pool.js` montés depuis `./blockchain` (`WEB3_SETTLE_SCRIPT`/`WEB3_CONSOLIDATE_SCRIPT`), en joignant le nœud via `WEB3_RPC_URL=http://blockchain:8545`.
- `frontend` : serveur statique Python (`frontend/serve.py`, MIME `.wasm` correct, `8080:8080`).
- Lancement : `docker compose up --build` (nécessite Docker Desktop démarré).
- Les scripts node sont lancés via `App\Support\ProcessHelper::spawnBackground` (Windows `start /B`, Linux/Docker `nohup`).

### Comptes Hardhat (dev)
- Compte #0 = joueur par défaut : `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` (clé `0xac0974...f2ff80`).
- Compte #1 = backend signer (signe les vouchers ET paie le gaz) : `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` (clé `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d`).
- Comptes #2/#3 = joueurs secondaires (`0x3C44...`, `0x90F7...`).

## Configuration développeur

- **Durée du round (timeout)** : variable `FIGHT_TIMEOUT_MS` dans `backend/.env` (défaut `60000`, soit 60 s). Fichier source : `backend/config/game.php`. La deadline de chaque combat est **fixe** (`created_at + timeout`) : le compte à rebours exposé aux joueurs est monotone (il ne remonte jamais). Exposée au frontend via `GET /api/game-config` et `GET /api/battle/status/{id}` (champ `timeout_ms`).
- Modifications PHP rechargées par le serveur Laravel ; les modifications frontend nécessitent un bump du cache-buster (`index.html`, `app.js?v=N`).

## Résolutions récentes (à ne pas régresser)

### 1. Bug « Vainqueur Inconnu » (poule 24, fight 70)
- **Symptôme** : les deux joueurs avaient commit, le move adverse était révélé, mais le combat était résolu en `double_elimination` → 0 survivant → `winner:null` → « Champion : Inconnu ».
- **Cause racine** : deadline ancrée sur `created_at + 35s` ; les reveals arrivaient après (+42 s) et le serveur tuait le combat.
- **Correctif** : deadline ancrée sur `created_at + TIMEOUT` (60 s), résolution autoritaire par le serveur (`resolveIfExpired` sur chaque `GET /status`), garde d'idempotence dans `FightService::resolveHybridFight` (un combat `completed`/`canceled` ne se re-résout pas), affichage « Poule terminée (aucun vainqueur) » au lieu de « Champion : Inconnu ».

### 2. Compte à rebours non monotone (« tantôt augmente, tantôt diminue »)
- **Cause racine** : deadline **glissante** sur `updated_at + 45s` (chaque commit/reveal de n'importe quel joueur repoussait la deadline → le timer sautait vers le haut).
- **Correctif** : deadline **fixe par round** (`created_at + timeout`), côté serveur ET frontend (`startVisibleTimer(fightTimeoutSeconds())`, fallback local basé sur `fightTimeoutMs`). Le compte à rebours ne peut plus que descendre.

### 3. Distribution du pot de poule (winner-takes-all)
- **Attendu** : après chaque fight, le gagnant prend la mise du perdant (cascade) ; le champion final accumule toutes les mises (3× pour une poule de 3).
- **Correctif** : **règlement serveur par combat** — à chaque résolution d'un fight de poule, `FightService::settleLoserAsync` lance `blockchain/scripts/settle_fight.js` qui transfère `userBalances[loser]` → gagnant via le signer backend. La consolidation finale (`consolidatePoolPot` + `consolidate_pool.js`) reste un filet de sécurité.
- **Rôle client** : le règlement client (`settleMatchOnWin`) est réservé aux **duels** ; en poule, c'est le serveur qui règle (gate `!AppState.currentPoolId`).

### 4. Messages console bénins (ne pas « corriger »)
- **« execution reverted: Nothing to settle »** : le perdant a un solde `userBalances` nul (jamais financé, ou déjà réglé). Attendu. En poule 25, `0x90F7` n'avait jamais déposé → pot de 20 ETH au lieu de 30, champion correctement crédité.
- **« animationFinished ignoré car pas de pendingResult »** : double appel de `animationFinished` (timer JS de secours 4 s puis Godot). Attendu.

## Bilan des Conflits de Vitesse (Race Conditions) Résolus

De nombreuses anomalies asynchrones ont été corrigées :

### 1. Couche Frontend (Javascript / DOM)
- **UI Overwrite (écrasement d'interface)** : `renderPoolRoom` vérifie le statut `finished` et déduit le vainqueur depuis la base pour empêcher un écrasement par une requête réseau en retard.
- **Spam DDoS du Timeout (Infinite Loop)** : réinitialisation stricte `AppState.lastActionTime = Date.now()` à la soumission du coup.
- **Polling schizophrène (Duplicate Triggers)** : mutex global `window._isPolling = true/false`.
- **Ghost Matches** : `startUnifiedMatchPolling()` démarre obligatoirement dès l'apparition de Godot.
- **Animation vs WebSocket** : file d'attente `AppState.pendingPoolRoundEvent` qui intercepte les événements `PoolRoundStarted` pendant l'animation Godot et ne les libère qu'après `animationFinished()`.

### 2. Couche Backend (Laravel) & Base de Données
- **State Mismatch des personnages** : le backend impose formellement les identifiants de personnages (`e.pairs`, `p1_char`/`p2_char`).
- **Matchmaking Concurrency (Double Round Trigger)** : gestion atomique + vérification `pendingFights === 0` lors de la résolution d'un `hybridFight`.

### 3. Couche Blockchain / Node
- Le système Gasless délègue la résolution au backend, évitant l'imprévisibilité du minage pour l'expérience temps réel Godot.

## Règles projet / conventions
- Pas de tableaux JS vers Godot, pas d'iframe. Vérifier les accolades. (Voir `G:\DEV\GODOT_GAME\.agents\AGENTS.md`.)
- Commits avec préfixes courts. Ne pousser/commiter que sur demande explicite.
- Les tests utilisent une base SQLite en mémoire (`phpunit.xml` → `DB_DATABASE=:memory:`) ; la base locale `web3_combat` n'est pas impactée par `php artisan test`.

## Prochaines étapes suggérées
- **Robustesse du dépôt d'entrée de poule** : s'assurer que TOUS les participants déposent leur mise à la jonction (en poule 25, `0x90F7` n'a jamais financé → pot incomplet). Envisager un verrou (le joueur ne peut pas être matché tant qu'il n'a pas déposé).
- **Sécurisation** : authentification robuste / validation des signatures cryptographiques sur les routes `/battle/commit` et `/battle/reveal`.
- **Nettoyage du code** : déprécier les anciennes routes API de validation de match devenues inutiles après le passage au système Hybride/Gasless.
- **Reset de la chaîne Hardhat** entre les tests E2E : les soldes `userBalances` persistent sur le nœud local ; penser à `hardhat_reset` ou au redémarrage avant un nouveau scénario.

## Les Outils à Disposition du Prochain Agent
- **Serveurs MCP Godot et Blender** : configurés et disponibles (`call_mcp_tool`, `get_debug_output`, compilation, interaction avec la scène 3D).
- **Graphify** : exploration du graphe du projet dans `graphify-out/` pour une vue d'ensemble des dépendances (fichiers, classes PHP, fonctions JS).
