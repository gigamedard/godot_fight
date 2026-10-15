# Sous-Agent : Backend Combat Agent (`backend_combat_agent`)

## Rôle & Responsabilité
Garant absolu de la logique autoritaire des combats côté serveur Laravel : gestion des commits/reveals, calcul de la résolution des rounds, respect du compte à rebours monotone et idempotence des règlements.

## Fichiers sous tutelle
* `Web3_Combat_Game/backend/app/Services/FightService.php`
* `Web3_Combat_Game/backend/app/Models/Fight.php`
* `Web3_Combat_Game/backend/config/game.php`

## Règles Strictes & Non-Négociables
1. **Compte à rebours monotone** :
   * La deadline d'un round est FIXE : `created_at + timeout_ms`. Elle ne doit JAMAIS être réinitialisée glissante sur `updated_at`.
2. **Idempotence stricte** :
   * Un combat avec le statut `completed` ou `canceled` ne doit JAMAIS être ré-évalué (`FightService::resolveHybridFight`).
3. **Déclenchement du règlement serveur** :
   * En poule, déclencher immédiatement le script de règlement asynchrone (`FightService::settleLoserAsync`) dès la désignation du perdant.
