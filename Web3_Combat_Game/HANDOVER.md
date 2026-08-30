# HANDOVER — App 2 « Web3 Combat Game » (passation agent successeur)

> Dernière mise à jour : **2026-08-30T12:26Z**. État écrit d'après le disque, pas de mémoire.
> ⚠️ **Lire [TEST_RUNBOOK.md](TEST_RUNBOOK.md) en premier** : procédure d'intervention
> (P.R.O.T. Provision/Recreate/Operate/Teardown), POST-RESTART PROTOCOL, table symptômes→remèdes.

---

## §1. État au moment de la passation (2026-08-30)

- Repo git : `G:\DEV\GODOT_GAME` — branche courante, dernier commit **`c7d35cd`
  « feat(indexer): robust idempotent blockchain indexer (polling + reorg safety) »**
  (précédents : `82d9762` préservation wallet portail + clé privée Hardhat pour signer
  les commits, `4efcb22` bouton retour iframe, `f6aefbd` nettoyage `?mode=`, `3b778d6`
  skip écran mode en entrée portail).
- **NON COMMITÉ** : `Web3_Combat_Game/frontend/app.js` (refactor complet de l'auth
  itérations 1+2 + gardes défensives `Echo`/`ethers`, **audit APPROUVÉ**), `serve.py` (HTTP/1.1
  + threads daemonisés + headers anti-cache/CORS), `index.html` (cache-busters `?v=1` sur scripts tiers,
  `anim2d.js?v=3`, `app.js?v=4.3`). En résumé :
  1. `connectWallet()` est devenu **async** avec un ordre de priorité strict :
     1) entrée portail `?mode=&wallet=` (synchrone, jamais de popup) ;
     2) `?player=N` e2e déterministe (compte Hardhat #N, écrit `web3combat_wallet`+`web3combat_pk`) ;
     3) MetaMask (`eth_accounts` silencieux si l'adresse sauvegardée est toujours autorisée,
        sinon `eth_requestAccounts` ; persiste l'ADRESSE SEULE ; refus → toast bloquant) ;
     4) restauration `localStorage['user'].wallet_address` (mode dégradé, `initWeb3` sauté) ;
     5) session dev explicite déjà persistée (paire wallet+pk) ; 6) toast bloquant — aucune génération.
  2. Le fallback « compte Hardhat aléatoire » (`Math.random()`) est **SUPPRIMÉ** :
     `performLogin()` ne peut plus écraser un wallet établi (portail = source de vérité).
  3. `updateBalance()` garde sa garde `if (!provider) return` (mode dégradé sans provider).
  4. Gardes `typeof Echo !== 'undefined'` dans `performLogin()` et `typeof ethers !== 'undefined'`
     dans `initSessionKey()` pour résilience totale face aux aléas réseau.
  5. `node --check app.js` → exit 0 (2445 lignes).
- **Moteur 2D dynamique (session 2026-08-30)** :
  - `frontend/anim2d.js` **entièrement réécrit** (v3, 11 Ko) : moteur de combat 2D canvas à personnages
    réels, animation idle par respiration sinusoïdale, séquences bidirectionnelles
    ATTACK→HURT→VICTORY avec screen-shake, label VS pulsant, noms des personnages.
    API publique : `window.setFighters2D(p1id, p2id)` (idle face à face) et
    `window.triggerRound2D(winner, p1id, p2id)` (déclenche la séquence de combat).
  - Portraits réalistes découpés automatiquement (fond blanc → transparence PNG via Pillow) et
    enregistrés dans `frontend/anim2d/<clé>/{idle,attack,hurt,victory}.png` pour les **4 combattants** :

    | ID | Personnage | Clé | Dossier |
    |----|-----------|-----|---------|
    | 1  | Guerrier Ninja  | `ninja`  | `frontend/anim2d/ninja/`  |
    | 2  | Mutant Cyborg   | `cyborg` | `frontend/anim2d/cyborg/` |
    | 3  | Tom Frazer      | `tom`    | `frontend/anim2d/tom/`    |
    | 4  | Big Choco       | `choco`  | `frontend/anim2d/choco/`  |

  - `attack.png` de Tom Frazer : pied arrière manquant (coupé par Gemini) **réparé** par greffe
    du membre depuis `idle.png` via Pillow (rotation -12°, collage aligné).
  - `frontend/index.html` mis à jour : `anim2d.js?v=3`.
- Stack Docker : **5/5 conteneurs Up** au 2026-08-30 (`web3_combat_api`, `web3_combat_blockchain`,
  `web3_combat_db` healthy, `web3_combat_frontend` rebuildé en HTTP/1.1, `web3_combat_indexer`).
- Notes de session non commitées à la racine du repo : `SESSION_GRAPHIFY_RESUME.md`,
  `conversation_restructuree.md`, `raisonnements_agent.md` (untracked, à trier/supprimer).

## §2. Pile technique & services

| Service (docker-compose) | Conteneur | Ports hôte | Rôle |
|---|---|---|---|
| `blockchain` (build ./blockchain) | `web3_combat_blockchain` | 8545 | Hardhat node + déploiement auto du contrat (`entrypoint.sh` : `npx hardhat node` & → sleep 5 → `hardhat run scripts/deploy.js --network localhost` → wait) |
| `db` (mysql:8.0) | `web3_combat_db` | 3306 | MySQL applicatif, base `web3_combat`, user/password, healthcheck mysqladmin, volume `db_data` |
| `indexer` (build ./indexer) | `web3_combat_indexer` | — | Watcher d'events → POST `http://api:8000/api/internal`. Robuste : polling (HTTP), reorg safety, idempotence. `DEPLOYMENT_BLOCK=0`, `CONFIRMATIONS_REQUIRED=5`, `POLL_INTERVAL_MS=2000`, `MAX_BLOCK_RANGE=1000`, backoff 2 s→30 s. MySQL : `DB_HOST=db` user/password/web3_combat |
| `api` (build ./backend) | `web3_combat_api` | 8000 **et** 8081 | Laravel `artisan serve` (8000) + Reverb WebSocket (8081). `entrypoint.sh` : attend Hardhat (30 essais) → attend MySQL (60 essais × 2 s) → `php artisan migrate --force` → `reverb:start --host=0.0.0.0 --port=8081 &` → `PHP_CLI_SERVER_WORKERS=4 php artisan serve --port 8000 --no-reload` |
| `frontend` (build ./frontend) | `web3_combat_frontend` | 8080 | Serveur Python `serve.py` (HTTP/1.1, racine `/srv/www`, montage `./frontend:ro`). MIME `application/wasm` forcé, en-têtes anti-cache et CORS |

Env clés (vérifiées sur disque, secrets masqués) :
- **Contrat** : `CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3` — présent aux
  **3 endroits** : `frontend/config.js`, `backend/.env`, env indexer (`docker-compose.yml`).
- **Signer backend** : `WEB3_BACKEND_SIGNER_KEY=0x59c6995e…78690d` (masquée, valeur complète
  dans `backend/.env` et `docker-compose.yml`) = **compte Hardhat #1** `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`,
  dérivé `m/44'/60'/0'/0/1` (mnemonic Hardhat). Signe les vouchers, paie le gaz des
  `settleLoser`/consolidations. `WEB3_RPC_URL=http://blockchain:8545`.
- Scripts serveur : `WEB3_SETTLE_SCRIPT=/srv/blockchain/scripts/settle_fight.js`,
  `WEB3_CONSOLIDATE_SCRIPT=/srv/blockchain/scripts/consolidate_pool.js` (montés `ro` depuis `./blockchain`).
- Reverb : app id `123456`, key `web3combat`, secret masqué dans `.env`, port 8081.
- DB : `db:3306`, base `web3_combat`, user/password (dev).
- FIGHT_TIMEOUT_MS : défaut 60000 (`backend/config/game.php`, exposé via `GET /api/game-config`).

## §3. Carte des fichiers clés par couche

### Frontend (service `frontend`, monté `:ro` → Ctrl+F5 suffit)
| Fichier | Rôle |
|---|---|
| `frontend/serve.py` | Serveur HTTP 8080 en `HTTP/1.1` (ThreadingTCPServer daemonisé), MIME `.wasm`→application/wasm, headers anti-cache stricts + CORS |
| `frontend/index.html` (450 lignes) | Charge `#anim2d-layer` (canvas 2D préloader fluide), `godot/jeu.js?v=3` + `jeu.wasm`, `anim2d.js?v=3`, `config.js?v=6`, `app.js?v=4.3` defer, `ethers.min.js?v=1`, `hardhat_keys.js?v=1`, `contract_abi.js?v=3`, `pusher.min.js?v=1`, `echo.iife.js?v=1`, `lucide.min.js?v=1`. Hook `transition2Dto3D()` lors du callback `engine.startGame().then()` |
| `frontend/anim2d.js` (v3, 11 Ko) | **Moteur de combat 2D dynamique**. P1 (gauche, face droite) vs P2 (droite, miroir). Idle respiratoire sinusoïdal. Séquences bidirectionnelles ATTACK→HURT→VICTORY avec screen-shake. Fond gradient sombre + ligne de sol cyan. Label VS pulsant + noms des combattants. Modes test : `?mode2d=1`, `?delay2d=N`, `window.toggleAnim2D()`. **API** : `window.setFighters2D(p1id, p2id)` (idle face à face avant choix), `window.triggerRound2D(winner, p1id, p2id)` (déclenche le combat). Une fois Godot 3D prêt → fondu fluide. |
| `frontend/anim2d/ninja/` | Sprites PNG transparents du **Guerrier Ninja** (ID 1) : `idle.png`, `attack.png`, `hurt.png`, `victory.png` — détourés depuis spritesheet Gemini (fond blanc → alpha) |
| `frontend/anim2d/cyborg/` | Sprites PNG transparents du **Mutant Cyborg** (ID 2) : même structure |
| `frontend/anim2d/tom/` | Sprites PNG transparents de **Tom Frazer** (ID 3) : même structure. `attack.png` : pied arrière réparé par greffe depuis `idle.png` (Pillow, rotation -12°) |
| `frontend/anim2d/choco/` | Sprites PNG transparents de **Big Choco** (ID 4) : même structure |
| `frontend/characters/` | Avatars réalistes carrés pour le sélecteur de personnage : `p1-ninja.png`, `p2-cyborg.png`, `p3-tom.png`, `p4-mage.png` |
| `frontend/app.js` (2445 lignes, **non commité**) | Couche UI/auth. `connectWallet()` async l.233-363 (6 priorités décrites §1) ; `performLogin()` l.819-895 (préserve wallet portail, garde `Echo` l.940) ; `updateBalance()` l.708+ avec garde mode dégradé ; `initWeb3()` l.590+ (privateKey→`JsonRpcProvider 127.0.0.1:8545`+Wallet ; sinon `BrowserProvider(window.ethereum)`) ; `initSessionKey()` l.647+ (garde `ethers` l.648, message « Authorize session key: <pubkey> », POST `/auth/session-key`, cache `web3combat_session_sig_<wallet>`) ; postMessage BATTLEPOOL_CLOSE/SESSION_SAVE/SESSION_GET/SESSION_CLEAR l.452-495 ; auto-entrée portail DOMContentLoaded l.2047-2112 (match clé privée Hardhat l.2094-2103) ; `node --check` exit 0 |
| `frontend/config.js` | `API_BASE_URL :8000/api`, Reverb `:8081`, RPC `:8545`, `PORTAL_URL :8001/portal?v=6` — tout sur `window.location.hostname` ; `CONTRACT_ADDRESS` en dur |
| `frontend/hardhat_keys.js` | 20 comptes Hardhat (adresse+clé, clés dev publiques). #0 `0xf39F…92266`, #1 `0x7099…79C8` (= signer backend, ne pas l'utiliser comme joueur), #2 `0x3C44…93BC`, #3 `0x90F7…b906`, #4 `0x15d3…aC6A65` |
| `frontend/contract_abi.js`, `abi.json` | ABI du contrat (source de vérité : `blockchain/artifacts/`) |
| `frontend/godot/jeu.{html,js,wasm,pck}` | Export web Godot (déjà généré). Ré-export via éditeur + preset Web de `G:\DEV\GODOT_GAME\export_presets.cfg` si le code Godot racine change (`export_path=Web3_Combat_Game/frontend/godot/jeu.html`) |


### Backend (service `api`, Laravel)
| Fichier | Rôle |
|---|---|
| `backend/routes/api.php` (109 lignes) | GET `/user` (sanctum), POST `/match-result`, POST `/broadcasting/auth` (GenericUser par wallet 42 car.), matchmaking `/matchmaking/{challenge,accept,decline,status}`, pools GET/POST `/pools`, `/pools/user/{wallet}`, `/pools/{id}`, `/pools/invite/{code}`, POST `/pools/{id}/join`, `/pools/{id}/matchmake`, internes indexer POST `/internal/pool-started` + `/internal/match-finished` (secret header), POST `/auth/session-key`, battle POST `/battle/{commit,reveal,timeout}`, GET `/battle/status/{match_id}`, GET `/game-config`, withdraw POST `/withdraw/{voucher,settle-voucher,claim-pool-voucher}` |
| `MatchmakingController.php` | Défis duel ; sur accept → crée le Fight et appelle `FightService::resolveHybridFight` sur résolution (l.156) |
| `PoolController.php` | Cycle de vie poules (join, matchmaking par rounds, broadcast `PoolRoundStarted`) ; `consolidatePoolPot()` l.205-237 : à la fin de poule, lance `consolidate_pool.js` en arrière-plan via `ProcessHelper::spawnBackground` (l.235) pour acheminer les mises des perdants vers le champion |
| `BattleController.php` | Commit/reveal hybride off-chain (hash commit, résolution serveur via `FightService`, timeout) |
| `AuthController.php` | `registerSessionKey` : vérifie signature du message `"Authorize session key: " . $sessionKey` (l.26) |
| `WithdrawController.php` | Vouchers signés par le signer backend : `/withdraw/voucher` (retrait simple), `/withdraw/settle-voucher` (v settlement pour `CombatGame.settleLoser`), `/withdraw/claim-pool-voucher` (claim du pot par le champion, contrôle `poolTotal` on-chain) |
| `InternalController.php` | Endpoints indexer (`pool-started`, `match-finished`), protégés par secret `INDEXER_SECRET` |
| `app/Services/FightService.php` | `resolveHybridFight` (idempotent, éliminations, forfaits, double AFK) ; **règlement du combat de poule OFF-chain** : le pot reste entier sur le contrat jusqu'à la fin de poule, une seule consolidation finale (`consolidate_pool.js`) |
| `app/Support/ProcessHelper.php` | `spawnBackground` : `start /B` (Windows) / `nohup … &` (Linux/Docker) pour lancer les scripts node |
| `config/services.php` | Bloc `web3` : contract_address, backend_signer_key, node_path, settle_script, consolidate_script, rpc_url |
| `backend/entrypoint.sh` | Cf. §2 (waits → migrate → reverb → serve) |

### Blockchain (service `blockchain`)
| Fichier | Rôle |
|---|---|
| `blockchain/entrypoint.sh` | Node en background + deploy + wait |
| `scripts/deploy.js` l.18-19 | Logs critiques : `CombatGame deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa3` + `Backend Signer set to: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8` (deploy avec compte #0, signer = compte #1 `m/44'/60'/0'/0/1`) |
| `contracts/CombatGame.sol` + `artifacts/` | Contrat + ABI/bytecode (artifacts = **source de vérité ABI**) |
| `scripts/settle_fight.js` | `node settle_fight.js <pool_id> <winner> <loser>` : récupère voucher `/withdraw/settle-voucher` puis `settleLoser(winner, loser, sig)` via signer backend — règlement winner-takes-all d'un combat |
| `scripts/consolidate_pool.js` | `node consolidate_pool.js <pool_id> <winner> <loser…>` : filet de sécurité serveur, consolide le pot pour le champion (indépendant du client du gagnant) |
| Autres scripts | `deposit_dev.js`, `export_abi.js`, `export_keys.js`, `test_settle_e2e.js`, `test_withdraw_e2e.js`, `check_pool_14.js` |

### Indexer (service `indexer`, Node ESM)
| Fichier | Rôle |
|---|---|
| `index.js` | Bootstrap |
| `indexer.js` | Boucle polling HTTP (reorg safety : `CONFIRMATIONS_REQUIRED=5`), backoff 2 s→30 s |
| `blockTracker.js` | Persistance du dernier bloc traité (MySQL) — idempotence |
| `eventProcessor.js` / `handlers.js` | Décodage des events + envoi vers `POST http://api:8000/api/internal` (header secret) |
| `db.js` + `schema.sql` | MySQL de l'indexer : tables d'état |
| `config.js` | Lit les env du docker-compose (contract, DEPLOYMENT_BLOCK, POLL_INTERVAL_MS…) |

### Godot (racine du repo, export web)
| Fichier | Rôle |
|---|---|
| `project.godot` | Autoload `Sfx="*res://scripts/sfx.gd"` |
| `Main.tscn` (dans `scenes/`) + `scripts/main.gd` | Scène principale, logique combat |
| `scripts/sfx.gd` | Audio (autoload) |
| `export_presets.cfg` | Preset Web → `export_path="Web3_Combat_Game/frontend/godot/jeu.html"` — ré-export nécessaire si le gameplay change, puis Ctrl+F5 côté navigateur |
| `scenes/arenas/`, `scripts/arenas/` | Arènes + scripts associés |

## §4. Rappels critiques (le minimum vital)

1. **« Poste connecté »** : front sur `window.location.hostname` (config.js) — fonctionne en
   `localhost` comme en IP réseau, mais **MetaMask et le RPC Hardhat doivent pointer sur la
   même origine** que la page. En local pur, les providers dev écrivent `http://127.0.0.1:8545`.
2. **Wallet du portail non-Hardhat = `BrowserProvider` MetaMask** : le portail App 1 passe
   l'adresse via URL (`?mode=&wallet=`) ; si elle ne matche aucun compte Hardhat,
   `AppState.privateKey` reste `null` → si MetaMask est dispo on signe via
   `BrowserProvider(window.ethereum)` ; sinon **mode dégradé** (aucun signer, `initWeb3` sauté,
   `updateBalance` garde `if (!provider) return`). Ne jamais réintroduire un fallback de clé aléatoire.
3. **`?player=N` e2e** : déterministe, écrit `web3combat_wallet`+`web3combat_pk`. Pour 2 joueurs :
   `?player=1` en fenêtre normale + `?player=2` en onglet privé (localStorage séparé).
4. **Comptes Hardhat** : #1 (`0x7099…79C8`) est le **signer backend** — il signe les vouchers et
   paie le gaz des settlements. Ne pas l'utiliser comme joueur en e2e (le serveur dépense son ETH).
5. **Adresses de contrat** : `CONTRACT_ADDRESS` existe en **3 exemplaires** (frontend/config.js,
   backend/.env, indexer env du docker-compose). Si le contrat re-déploie à une autre adresse
   (cf. TEST_RUNBOOK §3 ligne 4/9) : corriger les 3 + recreate api/indexer + Ctrl+F5.
6. **FIGHT_TIMEOUT_MS** : 60000 par défaut (`config/game.php`), servi par `GET /api/game-config`,
   consommé au DOMContentLoaded par `app.js`.
7. **Cache-busters** : après toute modification de `app.js`/`config.js`, Ctrl+F5 ; si le cache
   résiste, bump `app.js?v=` et `config.js?v=` dans `index.html`. Le dossier `frontend/` est
   monté `:ro` : **aucun rebuild frontend nécessaire**.
8. **Règles `.agents/AGENTS.md` (racine du repo)** : pas de tableaux JS vers Godot, pas de
   Godot dans une iframe (canvas z-index 0 / iframe réservée au portail), vérifier les
   accolades de `app.js`, commits à préfixes courts, ne commit/push QUE sur demande explicite.
9. **Rideau — ancien HANDOVER périmé** : `G:\DEV\GODOT_GAME\HANDOVER.md` (à la racine, PAS
   celui-ci) décrit l'époque SQLite (« plus de MySQL ni d'indexer »), un cache-buster app.js
   `?v=26` et un commit `63bd46d` : **faux aujourd'hui**. Ne pas s'y fier pour Docker/db/stack ;
   seuls sa section « prochaines étapes » historique reste une inspiration (cf. §5).

## §5. Points d'attention / prochains pas

- **Connecter `triggerRound2D` aux événements de round dans `app.js`** *(prochaine étape logique)* :
  Quand `app.js` reçoit le résultat d'un round via WebSocket (ex. `MatchResolved`, `BattleRevealed`),
  appeler `window.triggerRound2D(winner, p1CharId, p2CharId)` pour déclencher la séquence 2D pendant
  le chargement Godot. Si Godot 3D est déjà chargé, cette API devient no-op (layer masqué).
  De même, après `selectCharacter()` dans `app.js`, appeler `window.setFighters2D(myCharId, opponentCharId)`
  pour afficher les deux combattants en idle face à face.

- **Sécuriser l'auth et le battle commit-reveal** : les routes `/battle/commit` et `/battle/reveal`
  doivent valider les signatures cryptographiques — actuellement le `wallet_address` posté côté client
  n'y est pas systématiquement prouvé (à traiter, ex. exiger la signature de session key).

- **Committer le refactor auth + moteur 2D** : `frontend/app.js` (it. 1+2), `frontend/anim2d.js` (v3),
  `frontend/index.html`, et les `frontend/anim2d/*/` sprites sont approuvés mais **non commités**.
  Prévoir un commit double, ex. :
  - `fix(app2): auth metamask deterministic sans fallback hardhat aleatoire`
  - `feat(app2): moteur combat 2D dynamique - sprites 4 personnages + API triggerRound2D`
  Ne commiter QUE sur demande explicite de l'utilisateur (règle repo).

- **Ré-export du wasm si le gameplay Godot change** : éditer le code racine → exporter via
  preset Web (`export_presets.cfg`) → `frontend/godot/jeu.*` mis à jour → Ctrl+F5.

- **Coordination App 1 (portail)** : projet `G:\DEV\PHP\rock-paper-scissors` (conteneurs
  `rock-paper-scissors-*` : app 127.0.0.1:8001→8080, reverb 8008, blockchain 8546→8545
  chainId 31337, db 3307). `portal.html` authentifie par MetaMask (`personal_sign` →
  `/api/wallet/verify-signature` → `localStorage.user`+`auth_token` sur origine 8001) puis
  ouvre l'App 2 en iframe sandbox avec `?mode=&wallet=`. **Chaînes distinctes** : Battlepool =
  8546, CombatGame = 8545 — règles d'or dans `PORTAL_CONFIG_MEMO.md` côté App 1.
  L'App 2 n'a **pas** accès au localStorage de l'App 1 (origines différentes) d'où le
  protocole postMessage BATTLEPOOL_* (app.js l.452-495) et la persistence `localStorage['user']` côté 8080.

- **`rock-paper-scissors-ref`** (copie figée dans `G:\DEV\GODOT_GAME\`, gitignorée ligne
  « rock-paper-scissors-ref/ ») est **obsolète et supprimable** — ne pas s'y référer.

- Purger au besoin les notes de session untracked (`SESSION_GRAPHIFY_RESUME.md`,
  `conversation_restructuree.md`, `raisonnements_agent.md`) — aucun contenu contractuel.