# SPEC — Économie de poule « butin » + types de tournoi + widget survivants

> Branche : **`feat/app2-loot-tournament`** (depuis `feat/app2-gasless-ux2d-icdm`).
> Objet : nouvelle version « gameplay & contenu » (chantiers 2 & 3).
> Statut : **à valider** (règles de butin à confirmer, cf. §6).

---

## 1. Vocabulaire

- **stake (mise de base)** : montant d'entrée d'une poule (ex. 0.01 TST).
- **butin (`loot`)** : solde **virtuel** d'un joueur dans la poule (comptabilité serveur).
  Au départ, `loot = stake` (la mise déposée dans l'escrow on-chain).
- **alive / eliminated** : un joueur sans butin (`loot = 0`) est **éliminé**.

> Rappel architecture : l'escrow on-chain reste **par joueur** (`registerForPool`),
> la comptabilité de butin est **off-chain** (serveur), et la **consolidation finale**
> on-chain envoie le pot au(x) champion(s). Aucun changement de contrat requis.

---

## 2. État actuel (rappel)

- Poules = **mort subite** : on joue des rounds jusqu'à 1 survivant ; le champion
  réclame **tout le pot**.
- `pools` : `entry_fee`, `max_players`, `penalty_mode`, `status`, `round_pending_matches`.
- `pool_players` : `status` (`alive` / `eliminated` / `waiting`), `character_id`.
- Matchmaking par rounds (`PoolController::triggerMatchmaking`), résolution serveur
  (`FightService::resolveHybridFight`), consolidation finale (`consolidate_pool.js`).

---

## 3. Économie de butin (RÈGLES RETENUES)

### 3.1 Combat (winner W, loser L)

- `loot[i]` démarre à `stake` (la mise de base déposée dans l'escrow).
- **1re défaite d'un joueur** : le winner prend **TOUT** le butin du loser → `L.loot = 0`
  → **L éliminé**.
- **Défaites suivantes** : le winner prend `L.loot - stake` (le loser garde son **plancher
  = mise de base**). S'il était **déjà au plancher** (`L.loot <= stake`), il perd tout
  → `L.loot = 0` → **éliminé**.
- Le butin est **conservé au total** (transfert interne) : `sum(loot) = N × stake` = escrow.

### 3.2 Fin de tournoi selon le type (chantier 3)

| Type | Condition d'arrêt | Issue |
|---|---|---|
| **Mort subite** (défaut) | 1 survivant | le seul survivant a tout le butin |
| **Fin quand il reste N joueurs** | `alive_count <= N` | **chaque survivant touche SON butin** (gains différents) |
| **Fin par temps** | `now - started_at >= T` | **chaque survivant touche SON butin** ; classement par butin |

> **Pas de « pot central »** : à la fin, chaque joueur (encore en vie) **retire son propre
> butin** ; le plus gros butin = le plus gros gain. Les éliminés ont `loot = 0`.

---

## 4. Widget survivants (chantier 2)

- **Contenu** : liste temps réel des joueurs **encore en vie** (nom + perso + statut + butin).
- **Visible par** : participants **ET** joueurs sortis/éliminés (spectateurs), sur le **lobby**.
- **Temps réel** : via Reverb (`PoolRoundStarted`, `PlayerStatusChanged` + nouvel event
  léger de MAJ de butin/élimination, ex. `PoolLootUpdated`).
- **Où** : widget flottant (coin) sur `screen-main`/lobby + intégré au salon de poule.
- **Données** : endpoint `GET /pools/{id}` renvoie déjà `players` (statut) → à étendre avec `loot`.

---

## 5. Impacts techniques

- **Backend** : colonnes `pools.end_condition` (`last_man`|`remaining`|`time`),
  `end_count`, `end_seconds`, `started_at`, `finished_at` ; `pool_players.loot`.
  Logique de butin dans `FightService`/`PoolController` ; arrêt conditionnel du tournoi.
  Consolidation finale : pot → gagnant(s) selon le type (partage = plusieurs transferts).
- **Front** : modale « Créer une poule » → sélecteur de type + paramètre ; widget survivants.
- **Godot/Indexer** : inchangés (la comptabilité reste serveur).
- **Contrat** : ⚠️ **point bloquant** — le contrat actuel `claimPool` paie **tout**
  `poolTotal` à **UN SEUL** gagnant (`poolSettled`). Or la nouvelle économie paie
  **chaque survivant selon SON butin** → le règlement on-chain doit pouvoir distribuer à
  **plusieurs** adresses (cf. §7).

---

## 7. Point bloquant on-chain : distribution multi-gagnants

État du contrat (`0xA2722921…`) :
- `registerForPool(poolId, stake)` : escrow **par joueur** (`poolEscrow[poolId][user]`).
- `claimPool(poolId, amount, nonce, sig)` : **le champion réclame TOUT** `poolTotal`
  (une seule adresse, une seule fois).

La nouvelle économie exige de payer **N joueurs avec des montants différents** (leur butin).
Options à trancher (cf. Q3) :
- **(A) Off-chain par le serveur** : le/les champion(s) réclament on-chain (ou le backend
  consolide), puis le **backend re-distribue** les butins aux autres survivants
  (transactions natives signées par le serveur). Le plus rapide, **trust serveur**.
- **(B) Modification du contrat** : rendre le règlement de poule **multi-bénéficiaires**
  (ex. `settlePool(poolId, [users], [amounts], sig)`), puis déploiement d'un **nouveau
  contrat** (adresse à reporter partout). Plus « propre/trustless », mais **redéploiement**.
- **(C) MVP** : garder 1 champion on-chain, et n'utiliser le butin que comme **score
  d'affichage** (le champion touche tout, puis re-distribue aux autres hors-chaîne).

---

## 6. Décisions à confirmer

**Q1 — Règle de butin exacte** (cf. §3.1) :
- (a) **Plancher** : à chaque défaite, le loser garde `baseBet` ; éliminé seulement s'il était déjà au plancher.
- (b) **Première défaite = tout**, ensuite plancher.
- (c) **Take-all** à chaque combat (mort subite pure, pas de plancher).

**Q2 — Partage du pot (types « reste N » / « temps »)** :
- (a) partagé **à parts égales** entre les N survivants / ex-æquo ;
- (b) **un seul** gagnant (le meilleur).

**Q3 — Paramètre « temps »** : durée par défaut (ex. 5 / 10 / 15 min) et plage autorisée.

---

*Sources : `backend/app/{Models/Pool.php,Models/PoolPlayer.php,Http/Controllers/Api/PoolController.php,Services/FightService.php}`,
`backend/database/migrations/*pools*`, `frontend/{index.html,app.js}`. Contrat : `0xA2722921…` (inchangé).*
