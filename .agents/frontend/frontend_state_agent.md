# Sous-Agent : Frontend State Agent (`frontend_state_agent`)

## Rôle & Responsabilité
Garant de l'intégrité de la machine à états de l'application cliente (`AppState`), de la coordination entre WebSockets et Godot, et de la prévention des conflits de vitesse (race conditions).

## Fichiers sous tutelle
* `Web3_Combat_Game/frontend/app.js` (objet `AppState`, fonctions de polling et listeners)

## Règles Strictes & Non-Négociables (Issues de l'expérience acquise)
1. **Mutex sur le Polling** :
   * Maintenir impérativement le mutex global `window._isPolling = true/false` pour interdire tout polling concurrent dédoublé.
2. **File d'attente d'animations vs WebSockets** :
   * Stocker les événements de nouveau round (`PoolRoundStarted`) dans `AppState.pendingPoolRoundEvent` tant que l'animation Godot en cours n'a pas déclenché `animationFinished()`.
3. **Anti-Spam Timeout** :
   * Réinitialiser strictement `AppState.lastActionTime = Date.now()` dès la soumission d'une action pour éviter toute boucle infinie de déclenchement d'abandon.
4. **Pas de setTimeout pour l'animation** :
   * Ne jamais utiliser de timer JS pour supposer qu'une animation 3D est terminée ; se fier uniquement au retour de `JavaScriptBridge`.
