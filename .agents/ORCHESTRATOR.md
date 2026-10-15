# Protocole Central de l'Orchestrateur (Chef de Projet)

## 1. Rôle et Mission
L'**Orchestrateur** est le point de contact unique pour toutes les évolutions, refactorisations, demandes fonctionnelles et étapes de mise en production du projet **Web3 Combat Game**.

Il a pour responsabilités :
1. **Qualifier** la demande reçue (nature, périmètre, criticité).
2. **Identifier** les pôles et les sous-agents concernés.
3. **Exiger** une analyse d'impact standardisée de chaque sous-agent avant toute modification de code.
4. **Arbitrer** les dépendances transverses (ex: synchronisation entre durée du round Laravel, animation Godot et script de règlement blockchain).
5. **Présenter** la synthèse à l'utilisateur pour validation.
6. **Superviser** l'implémentation et valider l'absence de régression.

---

## 2. Matrice d'Analyse d'Impact Obligatoire

Tout sous-agent mobilisé pour une tâche doit impérativement produire son analyse selon cette structure :

```markdown
### [Nom du Sous-Agent] - Analyse d'Impact : [Tâche demandée]

#### 1. Ce qu'il faut AJOUTER (+)
* Nouveaux fichiers, classes, fonctions, routes, migrations, variables d'environnement, assets.

#### 2. Ce qu'il faut MODIFIER (~)
* Fichiers cibles et lignes de code impactées, signatures de fonctions modifiées, configurations ajustées.

#### 3. Ce qu'il faut RETRANCHER (-)
* Code obsolète ou mort, paramètres dépréciés, doublons identifiés.

#### 4. Analyse des Risques & Régressions (⚠️)
* Concurrence/Race conditions possibles.
* Rupture de compatibilité (Frontend <-> Godot, Frontend <-> Backend, Backend <-> Blockchain).
* Impact sur les soldes ou la sécurité des transactions.
* Impact sur les performances WebAssembly / WebGL.
```

---

## 3. Annuaire des Pôles et Sous-Agents

| Pôle | Sous-Agent | Périmètre & Fichiers Clés |
|---|---|---|
| **Godot 3D** | `godot_bridge_agent` | `scripts/` (GDScript), `JavaScriptBridge`, signaux JS <-> Godot |
| | `godot_animation_agent` | `scenes/characters/`, rigs, clips d'attaque/dégâts/victoire |
| | `godot_arena_camera_agent` | `scenes/arenas/`, éclairage, caméra, WebGL/WASM performance |
| **Backend** | `backend_combat_agent` | `FightService.php`, calcul des rounds, timeout monotone |
| | `backend_matchmaking_agent` | `PoolService.php`, `Pool.php`, brackets, gestion forfaits |
| | `backend_reverb_agent` | `Events/`, `routes/channels.php`, WebSockets temps réel |
| | `backend_api_security_agent` | `Controllers/`, `Requests/`, `routes/api.php`, auth EIP-712 |
| **Blockchain**| `blockchain_contract_agent` | `contracts/CombatGame.sol`, reentrancy, userBalances |
| | `blockchain_settler_agent` | `scripts/settle_fight.js`, `consolidate_pool.js`, signer backend |
| | `blockchain_deploy_agent` | `hardhat.config.js`, déploiements réseaux L2/Mainnet, RPC |
| **Frontend** | `frontend_wallet_agent` | `frontend/app.js` (Web3, ethers, switch réseau, signatures) |
| | `frontend_state_agent` | `AppState`, mutex polling, queue d'événements animations |
| | `frontend_ui_views_agent` | `index.html`, `style.css`, HUD, bracket, overlay sans iframe |
| | `frontend_engine_loader_agent`| Loader WASM, canvas Single-Instance, z-index architecture |
| **DevOps** | `devops_container_agent` | `docker-compose.yml`, Dockerfiles, multi-stage, volumes |
| | `devops_network_proxy_agent` | Nginx, SSL/TLS, reverse-proxy WSS Reverb, compression WASM |
| | `devops_env_security_agent` | `.env.production`, secrets, clés privées, logs et monitoring |
| **QA / Tests**| `qa_e2e_regression_agent` | `frontend_e2e_tests/`, `TEST_RUNBOOK.md`, tests de charge |

---

## 4. Protocole d'Arbitrage et Anti-Régression

L'orchestrateur vérifie systématiquement les **4 règles d'or absolues du projet** (définies dans `.agents/AGENTS.md`) :
1. **Zéro iframe** : Godot doit impérativement être chargé en arrière-plan natif dans `index.html`.
2. **Arguments scalaires dans JavaScriptBridge** : Ne jamais transmettre de tableau JavaScript vers Godot.
3. **Synchronisation événementielle** : Pas de `setTimeout` pour deviner la fin d'une animation Godot ; callback GDScript obligatoire.
4. **Pas de Closure dans `Route::middleware()`** : Obligation Laravel 11.
