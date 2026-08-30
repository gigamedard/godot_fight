# TEST_RUNBOOK — App 2 « Web3 Combat Game » (procédure d'intervention opérationnelle)

> Adapté du P.R.O.T. de l'App 1 au contexte de la stack Docker App 2.
> État vérifié sur disque le **2026-08-30** (itération 1 de documentation).
> Carte de passation : voir [HANDOVER.md](HANDOVER.md) — **à lire en premier**.

---

## §0. P.R.O.T. — Provision / Recreate / Operate / Teardown

### P — Provision (démarrage propre de la stack)

Préconditions :
- Docker Desktop **démarré** (icône baleine verte). Sinon toutes les commandes `docker` échouent avec `error during connect`.
- Ports libres : **3306** (MySQL), **8000** (API), **8080** (frontend), **8081** (Reverb), **8545** (Hardhat RPC).

```powershell
# Démarrage standard (depuis la racine App 2)
cd G:\DEV\GODOT_GAME\Web3_Combat_Game
docker compose up -d
```

Ordre de démarrage réel : les 5 services montent ensemble ; `entrypoint.sh` de l'API
attend lui-même Hardhat (30 essais × 1 s) puis MySQL (60 essais × 2 s) avant
`php artisan migrate --force`.

Attente de la base (healthcheck `mysqladmin`, retries 20) :

```powershell
docker inspect --format "{{.State.Health.Status}}" web3_combat_db
# Attendu : healthy (rejeter "starting" tant que ce n'est pas passé)
```

Vérification des **2 lignes critiques** des logs blockchain :

```powershell
docker logs web3_combat_blockchain 2>&1 | Select-String "CombatGame deployed to|Backend Signer set to"
```

Sortie attendue :
```
CombatGame deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa3
Backend Signer set to: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
```
(`deploy.js` déploie avec le compte #0 et configure le signer backend = compte #1,
dérivé `m/44'/60'/0'/0/1` du mnemonic Hardhat.)

### R — Recreate (appliquer du code modifié)

⚠️ **Ne JAMAIS déployer de code sans recreate** : les images ne se reconstruisent pas toutes seules.

| Code modifié | Action |
|---|---|
| backend (PHP, routes, controllers, `.env`) | `docker compose up -d --build api` (ou `--force-recreate api`) |
| indexer (JS, config env) | `docker compose up -d --build indexer` |
| Solidité / scripts blockchain / `hardhat.config.js` | `docker compose up -d --build blockchain` (redéploie le contrat, voir §2) |
| **Frontend (`frontend/*`)** | **RIEN à rebuild** : volume monté `:ro` → **Ctrl+F5** suffit |

Rappels frontend :
- `./frontend` est monté `ro` dans `/srv/www` (serveur Python `serve.py`, `Cache-Control: no-cache`).
- Après modification de `app.js` / `config.js` : **Ctrl+F5** et, si besoin, **bumper les
  cache-busters** dans `index.html` (`app.js?v=4.0`, `config.js?v=6` → incrémenter `?v=N`).
- Le moteur Godot (`godot/jeu.wasm` etc.) est un export web : changer le code Godot
  racine ⇒ ré-export via l'éditeur Godot (preset Web de `G:\DEV\GODOT_GAME\export_presets.cfg`,
  `export_path = Web3_Combat_Game/frontend/godot/jeu.html`).

### O — Operate (vérifications & smoke-tests en service)

```powershell
# État des 5 conteneurs (attendu : 5 × "Up", db "(healthy)")
docker compose ps

# 1. API vivante + config de jeu
curl.exe -s http://localhost:8000/api/game-config
# Attendu : {"fight_timeout_ms":60000}

# 2. Création de pool (route publique)
curl.exe -s -X POST http://localhost:8000/api/pools -H "Content-Type: application/json" -d '{\"entry_fee\":1,\"max_players\":2,\"penalty_mode\":0,\"is_private\":false}'
# Attendu : {"status":"success","pool":{...,"id":N}}

# 3. Reverb (WebSocket) joignable sur 8081
(Test-NetConnection -ComputerName localhost -Port 8081).TcpTestSucceeded
# Attendu : True

# 4. MIME du wasm (critique pour Godot Web)
curl.exe -s -I http://localhost:8080/godot/jeu.wasm | Select-String "HTTP|Content-Type"
# Attendu : HTTP/1.0 200 OK + Content-type: application/wasm

# 5. L'app charge-t-elle les 2 lignes blockchain ? (cf. §P)
docker logs web3_combat_blockchain 2>&1 | Select-String "CombatGame deployed to|Backend Signer set to"
```

Login navigateur (3 voies) :
1. **Portail App 1** (`http://localhost:8001/portal`) → iframe vers `http://localhost:8080/?mode=DUEL|BATTLE&wallet=<addr>` : entrée automatique, aucune popup.
2. **MetaMask** sur `http://localhost:8080` : bouton connexion (MetaMask silencieux si l'adresse sauvegardée est toujours autorisée, sinon `eth_requestAccounts`).
3. **e2e déterministe** : `http://localhost:8080/?player=1` (ou `?player=2` dans un onglet privé pour un 2e joueur) → compte Hardhat #N, clé privée écrite dans `localStorage` (`web3combat_wallet` + `web3combat_pk`).

### T — Teardown (arrêt / purge)

```powershell
# Arrêt SIMPLE (conserve db_data + état blockchain) — comportement par défaut
docker compose down

# Purge TOTALE (supprime le volume db_data : poules, fights, wallets en base perdus ;
# le contrat est re-déployé au redémarrage suivant) → DEMANDER L'ACCORD UTILISATEUR
docker compose down -v

# Purge complète assumée + rebuild blockchain d'abord + redéploiement contrat
.\reset_env.ps1       # (ou .\reset_env.bat)
```

`reset_env.ps1` fait exactement : `down -v` → `build blockchain` → `up -d blockchain`
→ sleep 15 → `build indexer api` → `up -d`. C'est l'outil de rattrapage quand l'état
db/blockchain est incohérent, à condition d'assumer la perte de données.

---

## §1. Arbre de décision « quel service je dois toucher ? »

```
Je modifie…                        → Action
─────────────────────────────────  ─────────────────────────────────────────────
PHP (routes, controllers,          → docker compose up -d --build api
    .env, config/laravel)             puis re-tester curl.exe game-config
Frontend JS/HTML/CSS (app.js,      → Ctrl+F5 sur l'onglet 8080
    config.js, index.html)            (+ bump app.js?v=N / config.js?v=N si besoin)
Solidité / scripts node blockch.   → docker compose up -d --build blockchain
    (deploy, settle, consolidate)     (redéploiement contrat → voir §3, cas getCode="0x" / indexer)
Indexer (index.js, handlers, env)  → docker compose up -d --build indexer
Godot racine (scènes, scripts GD)  → ré-export Web (preset export_presets.cfg)
                                       → fichiers frontend/godot/ MAJ → Ctrl+F5
Migrations / modèles Laravel       → docker exec web3_combat_api php artisan migrate --force
                                       (ou recreate api : l'entrypoint migre au boot)
```

**Cas spécial Solidité** : un rebuild de `blockchain` fait repartir la chaîne au bloc 0
(`npx hardhat node` frais). L'indexer a `DEPLOYMENT_BLOCK=0`, `POLL_INTERVAL_MS=2000`,
`CONFIRMATIONS_REQUIRED=5` : il **auto-resynchronise** depuis le bloc 0. Le contrat se
re-déploie à la **même adresse déterministe** `0x5FbDB…80aa3` tant que la séquence
de déploiement ne change pas (1er contrat du nœud frais). Si l'adresse change → §3.

---

## §2. POST-RESTART PROTOCOL (après tout down/up)

Exécuter **dans l'ordre**, ne pas sauter d'étape :

```powershell
# 1. DB healthy (attendre 30-60 s après up)
docker inspect --format "{{.State.Health.Status}}" web3_combat_db
# Attendu : healthy

# 2. Les 2 lignes blockchain
docker logs web3_combat_blockchain 2>&1 | Select-String "CombatGame deployed to|Backend Signer set to"
# Attendu : 0x5FbDB2315678afecb367f032d93F642f64180aa3 / 0x70997970C51812dc3A010C7d01b50e0d17dc79C8

# 3. 5/5 conteneurs Up
docker compose ps

# 4. API répond
curl.exe -s http://localhost:8000/api/game-config
# Attendu : {"fight_timeout_ms":60000}

# 5. Frontend + MIME wasm
curl.exe -s -I http://localhost:8080/godot/jeu.wasm | Select-String "HTTP|Content-Type"
# Attendu : 200 OK + application/wasm

# 6. Reverb 8081
(Test-NetConnection -ComputerName localhost -Port 8081).TcpTestSucceeded
# Attendu : True
```

Si une des 6 étapes échoue → table symptômes (§3).

---

## §3. Table symptômes → remèdes

| # | Symptôme | Cause probable | Remède |
|---|---|---|---|
| 1 | `docker compose up` échoue : « bind: address already in use » sur 3306/8000/8080/8081/8545 | Port occupé par un process natif ou l'App 1 (3307, 8001, 8546 ne gênent pas) | Identifier via `Get-NetTCPConnection -LocalPort <port>` ; couper le process OU adapter le mapping dans `docker-compose.yml` |
| 2 | `docker inspect … web3_combat_db` reste « starting » / « unhealthy » | MySQL 8 initialise son datadir (1re fois = lent) | Attendre 60-90 s ; si toujours KO : `docker logs web3_combat_db` ; en dernier recours `down -v` (accord utilisateur) |
| 3 | Logs blockchain sans « CombatGame deployed to », ou message d'erreur deploy | Nœud pas prêt après 5 s (`sleep 5`) ou erreur Solidité | Recreate : `docker compose up -d --force-recreate blockchain` ; vérifier `npx hardhat compile` dans les logs |
| 4 | Appels contrat avec `getCode = "0x"` (« contract does not have code ») | Contrat re-déployé à une **autre adresse** que celle configurée, OU backend/indexer pointent un nœud fraîchement vidé | Retrouver l'adresse réelle dans `docker logs web3_combat_blockchain` (ligne `CombatGame deployed to:`) puis **mettre à jour les 3 endroits** : `frontend/config.js` (`CONTRACT_ADDRESS`), `backend/.env` (`CONTRACT_ADDRESS`), env de l'indexer (`CONTRACT_ADDRESS` dans `docker-compose.yml`) → `docker compose up -d --build api indexer` → **Ctrl+F5** |
| 5 | `curl game-config` → 500 | Erreur Laravel (config/.env/migrations) | `docker logs web3_combat_api` ; vérifier `docker exec web3_combat_api php artisan migrate --force` ; recreater `api` |
| 6 | `POST /pools` → erreur SQL / « table pools not found » | Migrations non jouées | `docker exec web3_combat_api php artisan migrate --force` ; si l'entrypoint a migré avant que MySQL soit prêt, recreater : `docker compose up -d --force-recreate api` |
| 7 | `jeu.wasm` refuse de charger / « invalid magic number » sous Godot Web | MIME servi `application/octet-stream` | Vérifier `Content-Type` (`curl.exe -s -I http://localhost:8080/godot/jeu.wasm`) ; le MIME est forcé ligne 9 de `frontend/serve.py` → si erroné, recreater `frontend` (`docker compose up -d --build frontend`) + Ctrl+F5 |
| 8 | Pas de temps réel (matchmaking figé, pas d'events) ; TcpTestSucceeded **False** sur 8081 | Reverb mort dans le conteneur api | `docker logs web3_combat_api` (doit montrer `Starting Reverb WebSocket server...`) ; recreater `api` ; côté navigateur vérifier `config.js` : `REVERB_PORT: 8081` sur `window.location.hostname` |
| 9 | Indexer ne suit pas les events (pools qui démarrent jamais, `match-finished` absent) | Indexer en backoff, ou contrat adressé ailleurs, ou API interne KO | `docker logs web3_combat_indexer` (polling toutes les 2 s, confirmations 5, backoff 2 s→30 s) ; contrôler env dans `docker-compose.yml` (`RPC_HTTP_URL=http://blockchain:8545`, `API_URL=http://api:8000/api/internal`, `CONTRACT_ADDRESS`) ; si le contrat s'est re-déployé à une AUTRE adresse que `0x5FbDB2315678afecb367f032d93F642f64180aa3` : lire la ligne `CombatGame deployed to:` dans les logs blockchain et corriger les **3 endroits** (frontend/config.js, backend/.env, indexer env) → recreate `api` + `indexer` → Ctrl+F5 |
| 10 | Duel à 2 joueurs : impossible d'avoir 2 wallets différents | Même localStorage/localStorage partagé dans le même profil navigateur | Onglet **privé** (ou 2e profil) : `http://localhost:8080/?player=2` ; joueur 1 : `?player=1`. Les `?player=N` mappent des comptes Hardhat déterministes (#0 `0xf39F…92266`, #1 `0x7099…79C8` = signer backend, #2 `0x3C44…93BC`, #3 `0x90F7…b906`, #4 `0x15d3…aC6A65`) — ne pas utiliser #1 comme joueur, il dépense du gaz côté serveur |
| 11 | « Les clés Hardhat ne sont pas chargées » (toast) au login | `hardhat_keys.js` absent/renommé dans `frontend/` | Régénérer via `blockchain/scripts/export_keys.js` ; vérifier `<script src="hardhat_keys.js">` dans `index.html` |
| 12 | Retour au portail : boucle / écran revient en arrière | Ancien comportement de `navGoBack()` | Corrigé (BATTLEPOOL_CLOSE dans l'iframe) — si réapparaît, Ctrl+F5 + bump `app.js?v=` |
| 13 | Session signature demandée en boucle à chaque reload | Signature de session non persistée | Le cache est `localStorage['web3combat_session_sig_<wallet>']` — un changement de wallet ou de session key régénère ; vérifier que `/auth/session-key` répond 2xx dans l'onglet Réseau |
| 14 | Après purge, poules créées avant sont « perdues » | `down -v` a supprimé `db_data` | Normal (Teardown). Recréer les pools de test ; le contrat redeployé repart à 0 ETH côté poules |
| 15 | `ERR_CONNECTION_RESET` sur scripts `.js` / `Echo is not defined` / `Ethers.js ou ABI manquant` | Requêtes concurrentes massives HTTP/1.0 fermant les sockets | `serve.py` configuré en `HTTP/1.1` avec `daemon_threads = True` ; rebuild frontend (`docker compose up -d --build frontend`) + bump `app.js?v=` et scripts tiers `?v=1` dans `index.html` + Ctrl+F5 (gardes actives dans `app.js?v=4.1`) |

---

## §4. Carte des commandes vérité (référence rapide)

```powershell
cd G:\DEV\GODOT_GAME\Web3_Combat_Game   # racine de la stack

docker compose ps                              # état 5 services (api, blockchain, db, frontend, indexer)
docker compose logs --tail=100 api             # entrypoint : waits Hardhat/MySQL → migrate → reverb 8081 → serve 8000
docker compose logs --tail=100 blockchain      # hardhat node + "CombatGame deployed to: …"
docker compose logs --tail=100 indexer         # polling / events capturés / backoff
docker compose logs --tail=100 frontend        # serve.py : "Serving /srv/www on http://0.0.0.0:8080"
docker inspect --format "{{.State.Health.Status}}" web3_combat_db   # healthy attendu
docker exec web3_combat_api php artisan migrate --force   # patch migrations manquées

curl.exe -s http://localhost:8000/api/game-config                       # {"fight_timeout_ms":60000}
curl.exe -s http://localhost:8000/api/pools                             # liste des pools
curl.exe -s -I http://localhost:8080/godot/jeu.wasm                     # application/wasm
(Test-NetConnection -ComputerName localhost -Port 8081).TcpTestSucceeded  # Reverb True

docker exec web3_combat_db mysql -uuser -ppassword web3_combat -e "SELECT id,status FROM pools ORDER BY id DESC LIMIT 10;"
```

Tests e2e backend (répertoire `Web3_Combat_Game/backend/` et `frontend_e2e_tests/`) :
- `backend/test_post.cjs` — smoke API.
- `backend/test_battle.php`, `test_sig.php` — battle commit/reveal + signatures.
- `frontend_e2e_tests/` (npm install puis node) : `test_pool.js`, `test_battlepool_e2e.js`,
  `test_duel_accept_diag.js`, `test_game.js` — lancements avec `?player=N`.
- `blockchain/scripts/test_settle_e2e.js`, `test_withdraw_e2e.js`, `check_pool_14.js` — règlements on-chain.

---

## §5. Rappels de sécurité opérationnelle

- **Ne jamais commit** sans demande explicite (règle `.agents/AGENTS.md` de la racine).
- **Pas de clé privée dans les docs/commits** : la clé signer backend figure uniquement dans `backend/.env`
  (`WEB3_BACKEND_SIGNER_KEY=0x59c6995e…78690d`, masquée ici volontairement) et dans `docker-compose.yml`.
- Les clés des comptes dev Hardhat sont des clés publiques connues de tous — ne jamais y mettre de fonds réels.
- Règles Godot/front à rappeler : pas de tableaux JS vers Godot, pas de Godot dans une iframe
  (le canvas Godot est à z-index 0, l'iframe réservée au portail App 1), vérifier les accolades de `app.js`.