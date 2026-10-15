# WALKTHROUGH & GUIDE D'INTÉGRATION IA
**Projet : Web3 Combat Game (Godot 3D WASM + Laravel 11 Reverb + Solidity)**  
**Dernière mise à jour : Septembre 2026**

> [!IMPORTANT]
> **Instructions pour tout nouvel agent IA prenant le relais sur ce projet :**  
> Ce projet utilise une gouvernance stricte à 3 niveaux (Orchestrateur -> Leads de Pôles -> Sous-Agents Spécialistes).  
> Avant d'effectuer la moindre modification de code, vous **DEVEZ** vous référer au protocole [`.agents/ORCHESTRATOR.md`](file:///g:/DEV/GODOT_GAME/.agents/ORCHESTRATOR.md) et respecter les 4 règles d'or historiques décrites dans [`.agents/AGENTS.md`](file:///g:/DEV/GODOT_GAME/.agents/AGENTS.md).

---

## 1. Vue d'Ensemble du Projet

* **Moteur 3D** : Godot 4.x compilé en WebAssembly (WASM), instancié une seule fois en arrière-plan (`z-index: 0`) dans la page web.
* **Interface Web** : HTML5 / CSS3 / JavaScript pur (Overlay `z-index: 10`), piloté par Web3 (MetaMask, WalletConnect) et communication bi-directionnelle avec Godot via `JavaScriptBridge`.
* **Backend** : Laravel 11 (PHP 8.2+), API REST, base de données (SQLite en dev, MySQL 8 / PostgreSQL en prod), WebSockets temps réel natifs via Laravel Reverb (port 8081).
* **Blockchain** : Smart Contract Solidity `CombatGame.sol` (dépôts, trésorerie, règlements différés autoritaires par signature backend).

---

## 2. Système Multi-Agents Mis en Place

Pour éviter les régressions et les conflits de responsabilités, le projet est découpé en pôles et sous-agents dotés de fiches de mission strictes :

```
                                 ┌───────────────────────────────┐
                                 │       ORCHESTRATEUR IA        │
                                 │   (.agents/ORCHESTRATOR.md)   │
                                 └───────────────┬───────────────┘
                                                 │
         ┌───────────────────┬───────────────────┼───────────────────┬───────────────────┐
         │                   │                   │                   │                   │
         ▼                   ▼                   ▼                   ▼                   ▼
   [PÔLE GODOT]       [PÔLE BACKEND]     [PÔLE BLOCKCHAIN]    [PÔLE FRONTEND]     [PÔLE DEVOPS & QA]
   - godot_bridge     - backend_combat   - blockchain_contract- frontend_wallet   - devops_container
   - godot_animation  - backend_match    - blockchain_settler - frontend_state    - devops_proxy
   - godot_arena      - backend_reverb   - blockchain_deploy  - frontend_ui_views - devops_security
                      - backend_security                      - frontend_loader   - qa_e2e_regression
```

### Annuaire des Fiches de Spécialistes
* 🧭 **Protocole Central** : [`.agents/ORCHESTRATOR.md`](file:///g:/DEV/GODOT_GAME/.agents/ORCHESTRATOR.md)
* 🛡️ **Règles Historiques** : [`.agents/AGENTS.md`](file:///g:/DEV/GODOT_GAME/.agents/AGENTS.md)
* 🎮 **Godot** : [`.agents/godot/`](file:///g:/DEV/GODOT_GAME/.agents/godot/)
* ⚙️ **Backend** : [`.agents/backend/`](file:///g:/DEV/GODOT_GAME/.agents/backend/)
* ⛓️ **Blockchain** : [`.agents/blockchain/`](file:///g:/DEV/GODOT_GAME/.agents/blockchain/)
* 🖥️ **Frontend** : [`.agents/frontend/`](file:///g:/DEV/GODOT_GAME/.agents/frontend/)
* 🚀 **DevOps & QA** : [`.agents/devops/`](file:///g:/DEV/GODOT_GAME/.agents/devops/) et [`.agents/qa/`](file:///g:/DEV/GODOT_GAME/.agents/qa/)

---

## 3. Protocole Obligatoire Avant Toute Modification

Quand l'utilisateur vous confie une tâche ou une modification :
1. **Endosser le rôle de l'Orchestrateur** pour identifier les sous-agents concernés.
2. **Produire systématiquement la Matrice d'Impact** :
   * **[+] Ce qu'il faut ajouter** (fichiers, routes, méthodes, tables).
   * **[~] Ce qu'il faut modifier** (code existant, configs).
   * **[-] Ce qu'il faut retrancher** (code mort, options obsolètes).
   * **[⚠️] Analyse des Risques & Régressions** (race conditions, rupture de compatibilité, sécurité).
3. **Attendre ou demander confirmation** avant d'altérer les fichiers sensibles.

---

## 4. Les 4 Règles d'Or Inviolables (Anti-Régression)

1. **JAMAIS d'iframe pour Godot** : Initialisation native unique (`Single-Instance`) en fond de `index.html` (`z-index: 0`). Utiliser les classes CSS `.hidden` pour basculer la visibilité de l'UI (`z-index: 10`).
2. **Arguments scalaires dans JavaScriptBridge** : Ne jamais passer de tableau JS vers Godot (`window.godotSpawnPlayer(id)` et JAMAIS `["p1"]`).
3. **Synchronisation d'animation sans setTimeout** : Le JS ne doit jamais deviner la fin d'une animation 3D avec un timer ; attendre le callback émis par GDScript (`window.animationFinished()`).
4. **Zéro Closure dans `Route::middleware()` (Laravel 11)** : Utiliser des noms de middleware sous forme de chaîne de caractères ou appliquer le middleware directement sur les routes pour éviter le fatal error `Closure could not be converted to string`.

---

## 5. Feuille de Route Pré-Production (Current Status)

Consultez le document complet : [`PRE_PRODUCTION_AUDIT.md`](file:///g:/DEV/GODOT_GAME/PRE_PRODUCTION_AUDIT.md).

### Prochaines étapes à traiter :
* **Sécurité Signer & Clés** : Remplacer la clé Hardhat dev `#1` par un wallet de production et sécuriser les variables hors Git.
* **Sécurité API Combat** : Imposer la vérification cryptographique des signatures sur `/battle/commit` et `/battle/reveal`.
* **Infrastructure Docker & Nginx** : Mettre en place Nginx avec reverse-proxy HTTPS + WSS (port 8081 Reverb), compression Brotli/Gzip et en-têtes COOP/COEP.
* **Réseau Blockchain Réel** : Configurer la cible L2 (Base / Arbitrum) dans `hardhat.config.js` et déployer le contrat de production.
