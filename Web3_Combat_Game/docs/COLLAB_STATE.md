# COLLAB STATE — App 2 « POLY COMBAT »

> **Tableau noir partagé** entre l'agent **LOCAL** et l'agent **CLOUD**.
> Règles : modifier par petits commits ; **jamais deux agents en même temps** sur ce
> fichier ; journal de passation **append-only** dans `docs/handoffs/`.

---

## 1. Ancrages (source de vérité — ne pas diverger)

| Élément | Valeur |
|---|---|
| Remote | `github.com/gigamedard/godot_fight` |
| Branche d'intégration | `main` (merge par PR uniquement) |
| Branche de travail courante | `feat/app2-pool-share-payout` |
| Contrat CombatGame | `0x73F5065cBD382EF0D4b75c9e19f556E1D4Ba40f9` (bloc **352**) |
| Contrat legacy | `0xA2722921…` (NE PAS utiliser) |
| Chaîne | Pingala **99999** (`0x1869f`), symbole **TST** |
| Front déployé (VPS) | `app.js?v=4.58` · `config.js?v=11` · `i18n.js?v=10` · `sw.js?v=19` |
| Commit code déployé | `3a42f57` |
| Docs / onboarding | `701af02` puis ce commit |

> **Agents** : LOCAL = poste Windows (déploie via SSH) · CLOUD = **root sur le VPS**
> (`srv2032251`, `31.187.72.98`). Les deux peuvent déployer → verrou §4.

---

## 2. Propriété des zones (anti-conflit)

| Zone | Owner | Fichiers |
|---|---|---|
| Wallet / provider front | LOCAL | `frontend/app.js` (sections wallet : `getReadProvider`, `refreshWalletContract`, `initWeb3`) |
| Deep-link App1 ↔ App2 | LOCAL | `frontend/config.js`, `app.js` (`launchBattlePool`) |
| Économie de poule (butin, fins, règlement) | LOCAL | `backend/app/Services/FightService.php`, `PoolController.php`, `WithdrawController.php` |
| Nettoyage routes / API | CLOUD | `backend/routes/api.php` |
| Contrat Solidity | LOCAL | `blockchain/contracts/CombatGame.sol` |
| Ops VPS / DB / .env / Caddy / domaine | LOCAL | VPS `/opt/web3-combat` (hors repo) |
| Docs / onboarding | PARTAGÉ | `docs/*`, `*.md` |

> **Hotspots** (jamais les deux agents en même temps) : `frontend/app.js`,
> `backend/routes/api.php`, `backend/app/Http/Controllers/Api/PoolController.php`.

---

## 3. Tâches

| ID | Statut | Owner | Branche | Commit | Note |
|---|---|---|---|---|---|
| M1 — retirer `/api/test-pool` | DONE | CLOUD | feat/app2-pool-share-payout | 3e2f2c7 | route supprimée ; `php -l` OK ; maj `AGENT_ONBOARDING_APP2.md` ligne ~151 à faire |
| M2 — audit config prod | DONE | CLOUD | — | — | rapport validé (APP_ENV/DEBUG/URL/LOG + CORS) |
| M2b — durcir CORS | TODO | CLOUD | — | — | à faire **avec** le domaine prod (M8) |
| M3 — reset données de test | TODO | LOCAL | — | — | VPS ; accord + backup requis |
| M4 — merge → `main` + tag | TODO | CLOUD | — | — | accord requis avant push |
| M5 — auth combat (signature) | TODO | CLOUD | — | — | commencer par un PLAN |
| M6 — backups (cron + restore) | TODO | LOCAL | — | — | VPS |
| M7 — monitoring (signer/health/indexer) | TODO | LOCAL | — | — | VPS |
| M8 — domaine réel + TLS | BLOCKED | LOCAL | — | — | **domaine à fournir** |
| M9 — Godot export Release | TODO | CLOUD | — | — | rapport d'abord |
| M10 — création de poule conditionnée au dépôt du créateur | DONE | CLOUD | feat/app2-pool-share-payout | 1f9e249 | poule `pending_creation` tant que le créateur n'a pas déposé |

---

## 4. Verrou & déploiement

### 4.1 Fichiers chauds
- Aucun verrou actif.
- Avant d'éditer un hotspot (`frontend/app.js`, `backend/routes/api.php`,
  `PoolController.php`) : écrire `Verrou fichier : <fichier> par <owner> (depuis <date>)`,
  puis retirer en fin de tâche.

### 4.2 Déploiement (LOCAL **et** CLOUD peuvent déployer)
- **Un seul déployeur à la fois** : écrire `Verrou deploy : <owner> (depuis <date>)`
  avant toute opération VPS, puis retirer après.
- **Jamais** de déploiement concurrent (scp/restart/build simultanés = panne).
- Après déploiement : renseigner `Dernier déployé : <commit> par <owner> (<date>)`
  et incrémenter les cache-busters + `sw.js` CACHE.
- Un déploiement n'est autorisé que **dans le cadre d'une mission explicite**
  (pas de déploiement « au passage »).

| Déploiement | Valeur |
|---|---|
| Dernier déployé | `3a42f57` (backend + front 4.58/sw 19) par CLOUD (2026-10-18) |
| Déployeurs | LOCAL, CLOUD |
| Verrou deploy | (aucun) |

---

## 5. Périmètre & sécurité (CLOUD = root sur le VPS)

Le CLOUD est **root** : les interdits sont **procéduraux**, pas techniques.

**Autorisé** (avec mandat de mission) :
- `scp`/édition des fichiers bind-mount (`frontend/`, `backend/`, `blockchain/`),
- `docker restart web3_combat_api`,
- `docker compose -f docker-compose.vps.yml build/up` pour `frontend`/`indexer`,
- lecture de `backend/.env` **seulement si la mission l'exige**.

**Interdit (absolu)** :
- `avalanchego`, `signature-aggregator`, `battlepool-*` (6 conteneurs), `/opt/battlepool`,
  blocs Caddy L1/battlepool.
- Toute opération destructive DB (`truncate`, `migrate:fresh`, `DROP`) sans mandat explicite + backup.
- Exposer/copier des secrets (`backend/.env`, clés, mots de passe) hors du VPS.
- Déployer hors verrou / sans mission.

**Recommandé (durcissement)** : utilisateur de déploiement **non-root** avec droits
limités à `docker` sur `web3_combat_*`, et clé dédiée.

---

## 6. Dernière passation

- Voir `docs/handoffs/2026-10-18-cloud.md`.
