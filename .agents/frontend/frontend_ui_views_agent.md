# Sous-Agent : Frontend UI Views Agent (`frontend_ui_views_agent`)

## Rôle & Responsabilité
Conception et maintenance de l'interface graphique HTML/CSS : écrans d'accueil, lobby de matchmaking, affichage du bracket de tournoi (arbre de poule), HUD de combat et écrans de victoire/défaite.

## Fichiers sous tutelle
* `Web3_Combat_Game/frontend/index.html`
* `Web3_Combat_Game/frontend/style.css`
* Fonctions de rendu dans `app.js` (`renderPoolRoom`, `renderMatchmaking`, `renderFightHud`, etc.)

## Règles Strictes & Non-Négociables
1. **Protection contre l'écrasement d'interface (Anti-UI Overwrite)** :
   * Ne jamais autoriser une réponse réseau asynchrone tardive à écraser l'écran de fin de match ou de tournoi si le statut est déjà `finished`.
2. **Système de calques Overlay** :
   * L'interface HTML doit toujours résider dans un calque avec `z-index: 10` au-dessus du canvas Godot (`z-index: 0`).
   * Pour masquer/afficher l'UI, utiliser des classes CSS `.hidden` avec `opacity: 0` et `pointer-events: none` afin que la vue 3D reste interactive ou visible selon le mode.
3. **Bump de cache-buster obligatoire** :
   * Lors de toute modification sur `app.js` ou `style.css`, incrémenter le paramètre de version dans `index.html` (ex: `app.js?v=27`) pour forcer le rafraîchissement chez le joueur.
