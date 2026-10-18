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
| Front déployé (VPS) | `app.js?v=4.53` · `config.js?v=11` · `i18n.js?v=9` · `sw.js?v=14` |
| Commit code déployé | `36003fe` |
| Docs / onboarding | `701af02` puis ce commit |

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
| M1 — retirer `/api/test-pool` | IN PROGRESS | CLOUD | (branche cloud) | — | diff validé ; preuves (grep / `php -l` / maj doc) en attente |
| M2 — audit config prod | DONE | CLOUD | — | — | rapport validé (APP_ENV/DEBUG/URL/LOG + CORS) |
| M2b — durcir CORS | TODO | CLOUD | — | — | à faire **avec** le domaine prod (M8) |
| M3 — reset données de test | TODO | LOCAL | — | — | VPS ; accord + backup requis |
| M4 — merge → `main` + tag | TODO | CLOUD | — | — | accord requis avant push |
| M5 — auth combat (signature) | TODO | CLOUD | — | — | commencer par un PLAN |
| M6 — backups (cron + restore) | TODO | LOCAL | — | — | VPS |
| M7 — monitoring (signer/health/indexer) | TODO | LOCAL | — | — | VPS |
| M8 — domaine réel + TLS | BLOCKED | LOCAL | — | — | **domaine à fournir** |
| M9 — Godot export Release | TODO | CLOUD | — | — | rapport d'abord |

---

## 4. Verrou

- Aucun fichier chaud verrouillé.
- Pour verrouiller : écrire ici `Verrou : <fichier> par <owner> (depuis <date>)`
  avant d'éditer un hotspot, puis retirer la ligne en fin de tâche.

---

## 5. Dernière passation

- Voir `docs/handoffs/2026-10-16-local.md`.
