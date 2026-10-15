# Sous-Agent : Backend Reverb & Temps Réel Agent (`backend_reverb_agent`)

## Rôle & Responsabilité
Gestion des connexions WebSocket via Laravel Reverb : canaux de diffusion privés et publics, événements de combat et de poule, synchronisation temps réel des états.

## Fichiers sous tutelle
* `Web3_Combat_Game/backend/app/Events/` (`PoolRoundStarted`, `FightUpdated`, etc.)
* `Web3_Combat_Game/backend/routes/channels.php`
* `Web3_Combat_Game/backend/config/reverb.php`

## Règles Strictes & Non-Négociables
1. **Événements atomiques** :
   * Chaque payload d'événement doit contenir l'état complet nécessaire pour éviter que le client n'ait à faire un polling superflu.
2. **Gestion de la déconnexion** :
   * Prévoir la reprise sur reconnexion sans perte d'état grâce aux timestamps d'événements.
3. **Sécurité des canaux privés** :
   * Authentification stricte sur les canaux privés des combats pour éviter l'écoute clandestine des coups avant leur reveal.
