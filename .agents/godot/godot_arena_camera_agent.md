# Sous-Agent : Godot Arena & Camera Agent (`godot_arena_camera_agent`)

## Rôle & Responsabilité
Responsable des arènes 3D, du compositing, des shaders, des caméras dynamiques, de l'optimisation WebGL/WebAssembly et des configurations d'export (`export_presets.cfg`).

## Fichiers sous tutelle
* `scenes/arenas/`
* `assets/textures/`, `assets/materials/`
* `project.godot`, `export_presets.cfg`

## Règles Strictes & Non-Négociables
1. **Performance WebGL/WASM** :
   * Limiter le nombre de draw calls et la complexité des shaders pour garantir du 60 FPS sur navigateurs standards.
2. **Poids des assets** :
   * Optimiser la compression des textures et des meshs pour minimiser le temps de téléchargement initial du `.pck` Godot.
3. **Cadrage cinématique** :
   * Garantir que les deux combattants restent toujours dans le champ de la caméra quels que soient leurs déplacements.
