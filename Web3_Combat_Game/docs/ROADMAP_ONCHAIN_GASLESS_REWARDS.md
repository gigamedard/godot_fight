# Roadmap d'évolution — Dépôts gasless & Récompenses on-chain

> ⛔ **STATUT : NON ADOPTÉ (2026-10-13).** Décision produit : **pas de gasless en
> mode duel** → l'Option 3 a été **annulée** ; le contrat a été **restauré à
> l'état déployé** (`0xA2722921B753C1E76e1d9a4294204DF983746C3D`, bytecode vérifié
> identique). Document conservé comme historique / référence si on y revient.

> Rédigé le **2026-10-13** (branche `feat/app2-gasless-ux2d-icdm`).
> Périmètre : faire évoluer `CombatGame` et la stack pour (1) jouer **sans
> popup wallet à chaque match** (dépôts gasless côté joueur) et (2) un système
> de **récompenses** on-chain. À valider avant implémentation.
>
> Contrat actuel : **`0xA2722921B753C1E76e1d9a4294204DF983746C3D`** (Pingala 99999,
> bloc 171). backendSigner `0xa07c07E4C7EE00243D1591313911DB2Ef753a146`.

---

## 1. Objectif & principe

**Problème actuel** : chaque entrée en match/poule exige une **transaction
`register(stake)` signée par le joueur** (mise en natif TST via `msg.value`) →
1 popup wallet par combat. Pénible en mobile (Core/ios).

**Principe “Option 3”** :
1. Le joueur **recharge une fois** sa *balance de jeu on-chain* (`userBalances`)
   avec une transaction `depositToBalance()` — **1 seul popup**.
2. Les entrées de match sont ensuite débitées de cette balance par le
   **backendSigner** (`registerFromBalance`) → **0 popup** pendant le jeu.
3. Les gains/reliquats sont retirés via le flux **déjà gasless** (`withdrawTo`).

> ⚠️ Un transfert de **natif TST** ne peut pas être “gasless” à l'origine (il
> faut la signature de l'émetteur). Le gain réel = **1 popup au rechargement**,
> puis **0 popup** par match. À dire explicitement dans l'UI.

---

## 2. État actuel (rappel vérifié sur disque)

| Élément | État |
|---|---|
| Contrat | Escrow natif ; `register`, `registerForPool` (payables, joueur), `deposit`, `withdraw`/`withdrawTo` (voucher backend, gasless), `settleLoser`, `claimPool` |
| feeBps | 250 (2,5 %) |
| backendSigner | Signe vouchers + paie le gaz (settle/consolidate/withdraw push) |
| Front | 1 tx `register` par match (popup) ; `prepareWalletForTx` réveille Core en mobile |
| Backend | Endpoints vouchers + `battle/settle` + `withdraw/push` ; OPcache (restart requis) |
| Indexeur | Events → webhooks internes ; `CONFIRMATIONS_REQUIRED=0` |

---

## 3. Cible — flux joueur

```
[1] Recharge (1 popup)
    joueur: depositToBalance() payable  -> userBalances[joueur] += msg.value
[2] Match/poule (0 popup)
    backend: registerFromBalance(joueur, stake) onlyBackendSigner
             -> userBalances[joueur] -= (stake+fee)
             -> poolEscrow/pot += stake ; treasury += fee
[3] Résultat (0 popup joueur)
    backend: settleLoser / consolidation (déjà gasless)
[4] Retrait (0 popup joueur)
    backend: withdrawTo (voucher) ; OU garder en balance pour rejouer
[5] Récompenses
    backend/owner: rewardPool + claim signé (0 popup pour l'éligible)
```

---

## 4. Changements contrat (`CombatGame.sol`)

### 4.1 Dépôts depuis balance (Option 3)
- `depositToBalance() external payable` — alias/renommage de `deposit()` ; émet
  `Deposit(user, amount)` (déjà existant).
- `registerFromBalance(address user, uint256 stake) external onlyBackendSigner`
  - `require(userBalances[user] >= stake + fee)`
  - `userBalances[user] -= stake + fee`
  - `poolEscrow[poolId]/...` selon le mode ; émet un event dédié
    `RegisteredFromBalance(user, stake, fee, nonce)`.
- Variante poule : `registerForPoolFromBalance(uint256 poolId, address user, uint256 stake)`.
- **Duel** : le duel actuel utilise `userBalances` (winner-take-all via `settleLoser`),
  donc `registerFromBalance` crédite directement `userBalances` du pot (même logique
  que `register` mais sans `msg.value`).

### 4.2 Garde-fous (sécurité)
- `onlyBackendSigner` (ou `owner` + `backendSigner`) sur les fonctions débitrices.
- `nonReentrant` (mutex) sur toute fonction qui `call{value}`.
- **Anti-rejeu** : `nonce` par user pour `registerFromBalance` (le backend signe
  `keccak256(user, mode, poolId, stake, nonce, address(this))`) — le backend fournit
  une signature que le contrat vérifie, **en plus** de `onlyBackendSigner`, pour
  empêcher un backendSigner compromis de débiter arbitrairement.
- `Pausable` (owner) + plafond de recharge configurable.
- Respect du pattern **CEI** (effects avant interactions).

### 4.3 Récompenses
Option A (recommandée) — **pool de récompenses + claim signé** (comme `withdraw`) :
- `fundRewards() payable` (owner/équipe) alimente `rewardPool`.
- `claimReward(uint256 amount, uint256 nonce, bytes signature) external` :
  `rewardPool -= amount`, `userBalances[user] += amount` (ou transfert direct),
  signature backend sur `keccak256(user, amount, nonce, address(this))` ; nonce
  anti-rejeu. Réutilisation du pattern d'`withdraw()` (déjà éprouvé).
- Event `RewardClaimed(user, amount, nonce)`.

Option B — distribution directe par owner (`reward(user, amount)`) sans signature.
Plus simple, moins de contrôle (owner manuel).

### 4.4 Compatibilité
- **Ne pas casser** `register()`/`registerForPool()` (garder pour compat/desktop)
  ni les vouchers existants.

---

## 5. Backend (Laravel)

- Nouvel endpoint interne **`POST /battle/register-from-balance`** (secret indexer) :
  vérifie le match côté serveur, calcule stake+fee, pose un `nonce` unique, signe
  `keccak256(user, mode, poolId, stake, nonce, address(this))`, puis exécute le
  script node `register_from_balance.js` (backendSigner paie le gaz).
- Idempotence (clé match+user) + file d'attente si échec (retry).
- **Vérification amont** : le joueur doit avoir une balance suffisante
  (lecture `userBalances`) avant de lancer le match (sinon message clair).
- `reward` : endpoint `POST /rewards/claim` génère le voucher signé (admin/backend).
- Env : nouvelle variable `WEB3_REGISTER_SCRIPT`.
- Rappel : après edit backend → `docker restart` (OPcache).

## 6. Frontend (app.js / index.html)

- **Deux soldes affichés** : *Solde wallet* (natif TST) et **Solde de jeu**
  (`userBalances`, on-chain) — le second est celui qui finance les matchs.
- Bouton **« Recharger »** → `depositToBalance()` (1 popup) ; preset 10/50/100/MAX.
- **Créer/rejoindre un match** : plus de tx joueur → appelle l'endpoint backend
  `register-from-balance` ; affiche « inscription en cours… » puis 0 popup.
- Si solde de jeu insuffisant : toast + bouton « Recharger » (pas de popup surprise).
- Retrait : reste le flux gasless `withdraw/push` (inchangé).
- Récompenses : badge + bouton « Réclamer » (claim signé, 0 popup).

## 7. Indexeur

- Ajouter les handlers des nouveaux events (`RegisteredFromBalance`,
  `RewardClaimed`, `RewardsFunded`) → webhooks internes (crédit/maj du solde de jeu
  côté serveur, historique).
- Même sémantique de rejeu (5xx/réseau → retry ; 4xx → log).

## 8. Déploiement & migration

1. Modifier + **re-déployer** `CombatGame` (nouvelle adresse).
2. Reporter l'adresse + `DEPLOYMENT_BLOCK` dans **les 8 emplacements**
   (`frontend/config.js`, `backend/.env[.example]`, `services.php`, `indexer`
   config+example, `docker-compose.yml`, `docker-compose.vps.yml`) et sur le VPS.
3. Bump cache-buster `config.js?v=N`.
4. Reset base optionnel (test from scratch) selon besoin.
5. Régénérer `contract_abi.js` (nouvel ABI) + rebuild du bundle si l'`ethers`
   ABI change côté front (non : l'ABI est chargée depuis `contract_abi.js`).

## 9. Sécurité & garde-fous (checklist)

- [ ] Access control (`onlyBackendSigner`/`owner`) sur toute fonction débitrice.
- [ ] Verrou anti-reentrancy sur les `call{value}`.
- [ ] Nonces anti-rejeu (débits + rewards).
- [ ] `Pausable` + plafonds.
- [ ] Clé backendSigner = secret serveur (Docker secret idéalement).
- [ ] Audit du diff contrat avant déploiement réel.

---

## 10. Lots (ordre d'exécution)

| Lot | Contenu | Dépendance |
|---|---|---|
| **L1** | Contrat : `depositToBalance`, `registerFromBalance` (+ poule), nonces, events, tests Hardhat | — |
| **L2** | Récompenses contrat : `fundRewards`, `claimReward` signé, `RewardClaimed` | L1 |
| **L3** | Backend : script `register_from_balance.js`, endpoints `/battle/register-from-balance` + `/rewards/*`, env | L1 |
| **L4** | Indexeur : handlers nouveaux events | L1 |
| **L5** | Front : double solde, « Recharger », inscription sans popup, réclamation récompense | L3 |
| **L6** | Redéploiement + report adresse + reset DB + tests E2E mobile | L1–L5 |
| **L7** | Durcissement (pause, plafonds), monitoring, doc | L6 |

## 11. Tests & critères d'acceptation

- Hardhat : recharge → `registerFromBalance` débite correctement (fee au trésor),
  rejeu/nonce refusés, signer non autorisé refusé, reentrancy bloquée.
- Mobile : recharge (1 popup) → 3 matchs consécutifs **sans aucun popup** →
  gains consolidés → retrait gasless OK.
- Solde insuffisant : message clair, aucune tx.
- Récompense : claim signé une seule fois, nonce anti-rejeu.
- `/api/health` reste `ok`.

## 12. Décisions

### Actées (2026-10-13)
1. **Récompenses : REPORTÉES** — on ne fait que les dépôts gasless pour l'instant
   (lots L2 « récompenses » et L4 associés sont **gelés**).
2. **Éligibilité récompenses** : non traitée pour le moment.
3. **Compatibilité des dépôts : ON GARDE LES DEUX CHEMINS** — `register()` /
   `registerForPool()` (payables, 1 popup) restent, en plus du chemin balance
   (0 popup). Migration douce, rien ne casse.
4. **Autorisation on-chain** : `registerFromBalance` / `registerForPoolFromBalance`
   sont restreints par `onlyBackendSigner` + **nonce anti-rejeu** (pas de signature
   ECDSA redondante : le même backendSigner soumet la tx — la signature n'ajouterait
   aucune protection). `Pausable` + `nonReentrant` ajoutés.

### Restent ouvertes
5. **Montant de recharge max** (plafond anti-abus) ?
6. **Staking** : chantier séparé, hors périmètre actuel.

### État d'avancement
- **L1 (contrat) : FAIT** — `depositToBalance`, `registerFromBalance`,
  `registerForPoolFromBalance`, `usedActionNonces`, `setPaused`, `nonReentrant`,
  event `RegisteredFromBalance`. Compile + **11/11 tests Hardhat** (`CombatGame.test.js`,
  réécrit car l'ancienne suite testait une API disparue).
- L2 (récompenses) : **gelé**.
- Prochain : **L3 backend** (`register_from_balance.js` + endpoint) puis
  **L5 front** (double solde + « Recharger »), puis **L6 redéploiement**.

---

*Références : `blockchain/contracts/CombatGame.sol`, `docs/PROJECT_MEMORY.md` §6bis
(Option 3), `backend/app/Http/Controllers/Api/{InternalController,WithdrawController}.php`,
`blockchain/scripts/{settle_fight,withdraw_push}.js`, `frontend/app.js`.*
