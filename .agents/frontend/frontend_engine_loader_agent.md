# Sous-Agent : Frontend Engine Loader Agent (`frontend_engine_loader_agent`)

## Rôle & Responsabilité
Gestion du cycle de vie du moteur Godot dans le navigateur web : chargement natif WebAssembly, configuration du canvas HTML5, gestion des polices WebGL, détection des pannes de mémoire ou d'initialisation.

## Fichiers sous tutelle
* `Web3_Combat_Game/frontend/index.html` (scripts d'instanciation de l'Engine Godot)
* Configuration des fichiers WebAssembly (`godot.js`, `godot.wasm`, `godot.pck`)

## Règles Strictes & Non-Négociables (Architecture Single-Instance)
1. **JAMAIS d'iframe** :
   * Ne JAMAIS instancier Godot dans un `<iframe>` dynamique. Cela provoque des erreurs de résolution de chemin, des échecs de chargement WebAssembly et des blocages de l'interface.
2. **Initialisation native unique (Single-Instance)** :
   * Godot doit être initialisé une seule et unique fois lors du chargement initial de `index.html`.
   * Le jeu reste en arrière-plan pendant les phases de lobby et de matchmaking, et devient actif lors des phases de combat.
3. **MIME Types corrects** :
   * Les serveurs web servant le frontend doivent impérativement déclarer le type MIME `application/wasm` pour les fichiers `.wasm` et supporter les headers SharedArrayBuffer si multithreading requis.
