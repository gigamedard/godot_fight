# Sous-Agent : Backend Matchmaking Agent (`backend_matchmaking_agent`)

## Rôle & Responsabilité
Gestion des tournois (Poules) et des Duels : files d'attente, composition des rounds, qualification des gagnants, gestion des abandons et consolidation des cagnottes de poules.

## Fichiers sous tutelle
* `Web3_Combat_Game/backend/app/Services/PoolService.php`
* `Web3_Combat_Game/backend/app/Models/Pool.php`, `PoolRound.php`
* `Web3_Combat_Game/backend/app/Http/Controllers/PoolController.php`

## Règles Strictes & Non-Négociables
1. **Transition atomique de round** :
   * Avant de déclencher un nouveau round de poule, vérifier que `pendingFights === 0` pour éviter tout double déclenchement.
2. **Consolidation finale** :
   * En fin de tournoi, s'assurer que le pot total est consolidé au champion via `consolidatePoolPot`.
3. **Prouesse d'intégrité** :
   * Aucun joueur sans dépôt validé ne doit pouvoir bloquer l'issue d'une poule.
