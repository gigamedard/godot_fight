# GODOT — Package de Design : Arènes & Effets

> **À fournir tel quel au modèle de vision** avec les fichiers listés en §6.
> Ce document est la source de vérité technique. Toute contradiction entre
> une idée créative et ce document doit être tranchée en faveur de ce document.

---

## 1. Objectif (2 missions)

Le jeu **BATTLEPOOL** (duel 1v1, web, crypto) possède un moteur de combat
fonctionnel mais **aucun décor** : les combattants flottent dans un ciel gris
uniforme. Deux missions pour le modèle de vision :

1. **Concevoir des arènes / terrains / paysages** : 4 arènes distinctes,
   100 % procédurales (code GDScript + géométrie, sans gros assets binaires).
2. **Améliorer les effets** : lumière (rig d'éclairage cinématique), vitesse
   (sensations d'impact), caméra (cadrage/dynamique) et post-processing,
   dans les limites du renderer **GL Compatibility** (voir §3).

---

## 2. État actuel du projet (vérifié)

### 2.1 Config moteur — `project.godot`
- Godot **4.7**, renderer **GL Compatibility** (`config/features=PackedStringArray("4.7", "GL Compatibility")`).
- Scène principale : `res://scenes/Main.tscn`.
- Viewport : 1280×720, `stretch/mode="canvas_items"`, `stretch/aspect="expand"`.

### 2.2 Export web — `export_presets.cfg`
- Cible : `Web3_Combat_Game/frontend/godot/jeu.html`.
- `export_filter="all_resources"`, `exclude_filter="Web3_Combat_Game/*"`.
  → **Tout nouveau fichier ajouté au projet Godot (scenes/, scripts/, assets/)
  est automatiquement inclus au prochain export web.** Aucune config à toucher.
- Poids actuel du wasm exporté : **≈ 37,9 Mo** → l'ajout d'assets binaires
  (textures PNG/JPG) est à éviter, d'où l'exigence "100 % procédural".

### 2.3 Scène — `scenes/Main.tscn` (39 lignes, très basique)
```
Main (Node3D)  + script main.gd
├── WorldEnvironment   → ProceduralSkyMaterial (gris 0.646), tonemap_mode=2 (Filmic), glow_enabled=true
├── DirectionalLight3D → UNE seule lumière, shadow_enabled=true
├── Camera3D           → position (0, 1.5, 4), rotation X ≈ 15°  [exporté: player1_camera]
└── Fighters (Node3D)
    ├── Player1 (Node3D) → position (-2, 0, 0)                    [exporté: player1_node]
    └── Player2 (Node3D) → position ( 2, 0, 0), rotation Y 180°   [exporté: player2_node]
```
- **Aucun sol, aucun décor, aucune seconde lumière, aucun fond.** C'est ce vide
  que les arènes doivent remplir.
- L'arène doit couvrir au moins **X ∈ [-3, 3]**, **Z ∈ [-2, 2]**, avec le **sol à
  y = 0** (le script principal émet les particules de poussière à `y = -0.5`).

### 2.4 Script — `scripts/main.gd` (567 lignes)
Effets **déjà implémentés** (ne pas dupliquer, s'appuyer dessus) :
- `CPUParticles3D` sparks (40 → 100 unités) et dust (30 unités).
- `ColorRect` `flash_rect` plein écran + `_flash_screen()` (flash blanc).
- `_shake_camera(intensity)` : tween `v_offset`/`h_offset`.
- FOV punch caméra via tweens (fov 30 / 45 / 60).
- **Hit-stop / slow-mo** : `Engine.time_scale = 0.2` pendant 0,1 s (`effect == 1`).
- Chorégraphie des coups par tweens (`position`, `rotation_degrees`).

---

## 3. Contraintes techniques STRICTES (à respecter à la lettre)

### 3.1 Renderer GL Compatibility (limites / capacités)
| Interdit (non supporté en GL Compatibility) | Autorisé / supporté |
|---|---|
| SSAO, SSR / reflets screen-space | Glow (bloom) via `Environment` |
| Volumétriques (fog volumétrique) | Fog de densité simple (à valider en test) |
| Motion blur | Tonemapping **Filmic** (déjà actif) |
| Soft shadows "variable penumbra" matériel | Ombres **PCF** (shadow_enabled) |
| Réflexions temps réel sur sol | Illusion par émission + spéculaire + glow |
| Shaders lourds / boucles GPU longues | Shaders GLSL ES 3.0 raisonnables, StandardMaterial3D |

> ⚠️ Honnêteté technique : « fog de densité » et « contact shadows » sont à
> **tester en pratique** sur l'export web avant de les utiliser massivement.
> Tout ce qui est marqué Interdit ci-dessus ne doit PAS être utilisé, même si
> ça marche dans l'éditeur de bureau (l'éditeur peut fallback différemment).

### 3.2 Budget (export web)
- **Zéro nouveau gros asset binaire.** Arènes 100 % procédurales : géométrie
  (BoxMesh/CylinderMesh/PrismMesh/ArrayMesh), matériaux StandardMaterial3D et
  shaders simples, particules CPUParticles.
- Budget arène : **≤ ~50 000 triangles**, ≤ ~20 nœuds MeshInstance3D,
  ≤ 5 lumières dont 1 avec ombres.
- Textures éventuelles : uniquement générées en code (GradientTexture2D,
  NoiseTexture2D) et ≤ 256×256.

### 3.3 Ne jamais casser (contrat d'intégrité)
- **Ne pas renommer / déplacer / supprimer** : `Camera3D`, `Fighters`,
  `Fighters/Player1`, `Fighters/Player2`, `Main` — référencés par les
  `@export` de `main.gd`.
- **Ne pas modifier** les fonctions du pont JavaScript (voir §4) dans `main.gd`.
- **Ne jamais supprimer** l'appel `window.animationFinished()` en fin de climax.
- Les arènes doivent être **ajoutées** en tant que nœuds enfants de `Main`
  (ou instanciées par un script), jamais en remplaçant la structure existante.

### 3.4 Test / validation
- Validation headless : `godot --headless --path . --script res://scripts/inspect.gd`
  (existe déjà). Pour une arène : instancier la scène en headless et
  vérifier `get_node("Arena") != null`.
- La ré-exportation web (fichiers `jeu.js`/`jeu.wasm`) est **manuelle** via
  l'éditeur Godot (Export → Web). Le livrable du modèle est le **code source
  Godot**, pas l'export.

---

## 4. Contrat d'interface JavaScript ↔ Godot (PONT — immuable)

| Sens | Fonction | Rôle |
|---|---|---|
| JS → Godot (exposées par main.gd sur `window`) | `godotSpawnPlayer(charId)` | Spawn du combattant du joueur |
| JS → Godot | `godotSpawnOpponent(charId)` | Spawn de l'adversaire |
| JS → Godot | `godotClearOpponent()` | Retire l'adversaire (retour menu) |
| JS → Godot | `receiveMatchResult(result, opponentMove)` | 0 = draw, 1 = win, 2 = loss |
| Godot → JS | `window.onGodotReady()` | Jeu chargé, prêt |
| Godot → JS | `window.submitMove(1\|2\|3)` | Envoie le choix de l'utilisateur |
| Godot → JS | `window.animationFinished()` | Fin du climax, fin du tour |

**Règle :** le design d'arènes et d'effets ne doit jamais ajouter, renommer ou
retirer une de ces fonctions. Toute nouvelle fonction Godot→JS doit être
préfixée `godotArena...` et exposée en **option** (vérifier `if(window.x)` côté
JS avant appel).

---

## 5. Direction artistique BATTLEPOOL

**Pitch :** « Neo-Street Fighter » — combat télévisé, énergie électrique,
néons saturés sur fond sombre, lisibilité totale des deux combattants.

- Palette : fonds très sombres (gris-bleu nuit) + 1 ou 2 couleurs néon saturées
  par arène (cyan, magenta, orange, vert toxique, rouge) + halos émissifs.
- Le sol doit **répondre visuellement** aux impacts (pulsation d'émission,
  halo, éclats de particules) — c'est le tapis de scène.
- Éclairage : le rig (voir §7.1) doit garder les combattants **nets et
  contrastés** : jamais de silhouette noyée dans le fond.
- Les 4 arènes doivent être **identifiables d'un coup d'œil** et cohérentes
  avec les 4 personnages existants (p1..p4, IDs vus dans le pont JS).

---

## 6. Mission 1 — Concevoir 4 arènes (proposition thématique)

Chaque arène = une scène instanciable OU un script procédural, root `Node3D`
nommé `Arena`, sol à y=0, éclairage propre inclus (sauf la lumière principale
qu'on garde optionnelle), **sans** combattants ni caméra (ils sont dans `Main`).

| # | Arène (fichier suggéré) | Ambiance | Éléments procéduraux |
|---|---|---|---|
| 1 | `arena_dojo.tscn` — *Dojo Ninja* | Nuit japonaise, lanternes rouges | Tatamis (boxes), poteaux, clôture bambou, lanterne émissive, pétales CPUParticles3D, brouillard fin |
| 2 | `arena_neon.tscn` — *Cyber Alley* | Ruelle cyberpunk, pluie, néons | Grille au sol émissive, panneaux néon (boxes + shader), câbles (cylindres), flaques spéculaires, brouillard |
| 3 | `arena_ring.tscn` — *Cage de Combat* | Ring TV, foule, projecteurs | Ring + 4 poteaux + cordes (cylindres), sol élastique, projecteurs (spotlights), foule silhouettes sombres, lueur caméra |
| 4 | `arena_crystal.tscn` — *Sanctuaire Magique* | Cristaux flottants, runes | Plateforme pierre runique, cristaux (prismes émissifs, rotation lente), particules magiques ascendantes, halos |

**Structure d'architecture recommandée (à valider avant de coder en dur) :**
- Un script `scripts/arenas/arena_manager.gd` (Node `Arena` enfant de `Main`)
  qui instancie `res://scenes/arenas/arena_<id>.tscn` et l'échange.
- Ou, plus simple et plus robuste pour un modèle : **une seule scène
  `arena_<id>.tscn` par arène**, instanciée manuellement dans `Main.tscn`
  pour la mise au point, puis gérée par le manager.
- Ne PAS mettre de `WorldEnvironment` dans l'arène (il y en a un dans `Main`)
  — sauf à vouloir surcharger, ce qui est déconseillé.
- Toute animation d'arène (rotation de cristaux, pulsation néon) doit être en
  `_process` léger ou AnimationPlayer, jamais bloquant.

---

## 7. Mission 2 — Effets (lumière / vitesse / caméra / post)

### 7.1 Rig d'éclairage (remplacer l'unique DirectionalLight3D)
1. **Lumière clé** : `DirectionalLight3D` (ombres PCF) — éclairage principal,
   légèrement chaud, depuis le haut-devant (angle actuel conservé ou affiné).
2. **Rim lights** (contraste des combattants) : 2 `OmniLight3D` ou `SpotLight3D`
   colorées — **rouge/or côté P1 (gauche)**, **bleu/cyan côté P2 (droite)**,
   placées derrière/au-dessus de chaque fighter, sans ombres (perf).
3. **Lumière d'ambiance** : `ambient_light` du `WorldEnvironment` très basse
   (le fond doit rester sombre) + `ambient_light_energy` ≈ 0.1–0.2.
4. **Néon** : matériaux `StandardMaterial3D` avec `emission_enabled`, `emission`
   de couleur néon, `emission_energy_multiplier` 1–2 — le glow déjà activé les
   fait briller.
5. Réglages `Environment` : `glow_enabled=true`, `glow_bloom` faible
   (0.02–0.05), `glow_intensity` 0.8–1.2, tonemap Filmic conservé.
6. Optionnel (à valider en web) : ajouter en `project.godot` :
   `rendering/anti_aliasing/quality/msaa_3d=2` pour la netteté (GL Compatibility
   supporte MSAA).

### 7.2 Vitesse & sensations d'impact (s'appuyer sur l'existant)
1. **Hit-stop** : garder `Engine.time_scale = 0.2` sur ~0,1 s (existant) ;
   y ajouter un **arrêt net de 3–4 frames** avant la reprise.
2. **FOV punch** : accentuer l'existant — fov 45 → 30 pendant le hit, retour
   élastique `TRANS_BACK` (tweens existants, ajouter l'ease).
3. **Speed lines** : `CanvasLayer` + `CPUParticles2D` radiales (émission du
   centre vers les bords) déclenchées pendant 0,15 s au moment du hit —
   purement 2D, très léger, lisible.
4. **Traînée / afterimage** : pendant le slow-mo, dupliquer le MeshInstance3D
   du combattant frappeur en arrière avec `transparency`/alpha décroissant sur
   ~3 copies (à positionner par rapport au sens du coup).
5. **Camera shake** : renforcer l'existant (intensité 0.2 → 0.35 sur impact),
   ajouter un **micro-roll** (tween `rotation.z` ±0.02 rad, 0,06 s).
6. **Flash** : conserver `_flash_screen()` ; variante possible : flash coloré
   par coup (rouge pour P1, bleu pour P2).

### 7.3 Caméra & cadrage
1. FOV de base **60** ; serrage **45** en position de combat (existant),
   **30** au climax (existant) — garder les `Tween.TRANS_CUBIC`.
2. En climax : **zoom lent** (`fov` 30 → 24 sur 1,5 s) + **letterbox**
   cinématique (2 `ColorRect` noirs haut/bas, ~12 % d'écran, fondu).
3. Légère parallaxe : l'arène peut avoir 2-3 plans (fond/milieu/sol) pour la
   profondeur — les lumières de l'arène doivent rester hors champ ou floues.

### 7.4 Post-processing (limites GL Compatibility)
- Autorisé : glow (actif), tonemap Filmic (actif), vignette 2D (ColorRect +
  shader ou texture), letterbox, flash (existant), speed lines 2D, particules.
- Interdit : motion blur GPU, SSAO, SSR, DOF matériel — **ne pas essayer**.
  (Le DOF/radial blur peut être simulé 2D sur un screenshot du canvas via
  shader, mais hors scope pour rester sûr.)

---

## 8. INTERDICTIONS & PIÈGES (récapitulatif critique)

1. ❌ Renommer/déplacer `Camera3D`, `Fighters/Player1`, `Fighters/Player2`, `Main`.
2. ❌ Toucher au pont JS (§4) dans `main.gd` — ni retirer, ni renommer les fonctions.
3. ❌ Supprimer l'appel `window.animationFinished()` en fin de climax.
4. ❌ Utiliser des features Vulkan/Forward+ : SSAO, SSR, volumétriques, motion blur, soft shadows matériel.
5. ❌ Ajouter des textures binaires lourdes (wasm = 37,9 Mo déjà) → arènes 100 % procédurales.
6. ❌ Mettre le sol ailleurs qu'à `y = 0` (particules de poussière émises à `y = -0.5`).
7. ❌ Bloquer la vue caméra (0, 1.5, 4) → fighters : aucun mur/élément dans l'axe caméra-fighters.
8. ❌ Noyer les combattants : garder le contraste P1/P2 et un fond plus sombre qu'eux.
9. ❌ Dépasser le budget : ≤ 50 k triangles, ≤ 5 lumières (1 avec ombres), particules modérées.
10. ❌ Supposer que ce qui marche dans l'éditeur de bureau marchera en web → valider l'export.

---

## 9. Format de livraison attendu du modèle

Fichiers à produire (code source, pas d'export) :
- `scenes/arenas/arena_dojo.tscn`, `arena_neon.tscn`, `arena_ring.tscn`, `arena_crystal.tscn`
  (ou scripts procéduraux équivalents `scripts/arenas/arena_<id>.gd` — au choix,
  **procédural script est préféré** car plus facile à re-générer/vérifier).
- `scripts/arenas/arena_manager.gd` (permutation des arènes, noeud `Arena` sous `Main`).
- Toute modification de `Main.tscn` : **ajout seul** (nœud `Arena` + référence),
  jamais de suppression/renommage.
- Toute modification de `project.godot` : ajout de lignes (MSAA, glow), jamais
  de retrait des lignes existantes.
- Un bref README de la mission dans la réponse : ce qui a été créé, ce qui est
  à tester, ce qui est incertain (ex. fog en web).

Critères de validation :
1. `godot --headless --path . --check-only` (ou import) sans erreur.
2. Scène `Main.tscn` charge : `Main/Arena` existe, `Camera3D`/`Fighters/*` intacts.
3. Aucune fonction du pont §4 modifiée (diff sur `main.gd` = vide).
4. Budget respecté (triangles/lumières/textures).
5. Rendu lisible : les 2 combattants nets sur fond sombre néon.

---

## 10. PROMPT PRÊT À COPIER-COLLER (pour le modèle de vision)

> **Rôle :** Architecte 3D / Artiste de niveau Godot 4.7 pour un jeu de combat
> web « BATTLEPOOL » (style Neo-Street Fighter : néons, fond sombre, énergie).
> Tu vas **concevoir des arènes** et **améliorer les effets de lumière/vitesse/
> caméra** d'un duel 1v1 dont le moteur de combat est déjà codé et fonctionnel.
>
> **Fichiers à lire avant de répondre** (tous dans le repo) :
> - `scenes/Main.tscn` (scène actuelle, très basique : aucun sol, aucun décor)
> - `scripts/main.gd` (moteur de combat : pont JS, particules, tweens, hit-stop)
> - `project.godot` (Godot 4.7, renderer **GL Compatibility**)
> - `export_presets.cfg` (export web : tout est inclus sauf `Web3_Combat_Game/*`)
> - `GODOT_ARENA_DESIGN_PACKAGE.md` (ce document = source de vérité)
> - Captures d'écran de l'état actuel fournies par l'utilisateur.
>
> **RÈGLES NON NÉGOCIABLES :**
> 1. Ne jamais renommer/déplacer `Camera3D`, `Fighters/Player1`, `Fighters/Player2`.
> 2. Ne jamais modifier le pont JS (§4 du document) dans `main.gd`.
> 3. Renderer GL Compatibility : interdits SSAO/SSR/volumétriques/motion blur.
> 4. **Zéro gros asset binaire** : arènes 100 % procédurales (GDScript,
>    primitives mesh, matériaux StandardMaterial3D, shaders simples).
> 5. Sol à `y = 0` (les particules de poussière sont émises à `y = -0.5`).
> 6. Budget : ≤ 50 k triangles, ≤ 5 lumières (1 avec ombres), textures ≤ 256×256
>    (ou générées en code).
> 7. Garder les combattants nets et contrastés (fond plus sombre qu'eux).
>
> **MISSION 1 — ARÈNES :** Livre 4 arènes procédurales distinctes
> (`arena_dojo` / `arena_neon` / `arena_ring` / `arena_crystal`), chacune sous
> forme de scène `.tscn` ou script GDScript avec root `Node3D` nommé `Arena`,
> contenant : sol, fond, éléments de décor, éclairage propre, 1-2 effets
> particules/émission, et une animation lente d'ambiance (pulsation/rotation).
> Fournis un `arena_manager.gd` qui instancie l'arène active sous `Main/Arena`.
>
> **MISSION 2 — EFFETS :** 
> - **Lumière** : rig = 1 DirectionalLight3D (ombres) + 2 rim lights colorées
>   (rouge côté gauche/P1, bleu côté droite/P2) + ambient très basse ; néons
>   émissifs ; réglages glow (bloom faible, intensity ~1.0).
> - **Vitesse** : accentue le hit-stop existant (`time_scale` 0.2), FOV punch
>   avec `TRANS_BACK`, speed lines 2D (CPUParticles2D radiales), afterimage
>   (copies du mesh en transparence), micro-roll caméra sur impact.
> - **Caméra** : FOV 60/45/30 existants conservés, zoom lent + letterbox au
>   climax, plans de profondeur (fond/milieu/sol) dans les arènes.
> - **Post** : flash existant conservé, vignette et letterbox en ColorRect 2D.
>
> **FORMAT DE RÉPONSE :** 1) le code complet de chaque fichier créé/modifié,
> 2) un diff expliqué pour `Main.tscn` et `project.godot` (ajouts uniquement),
> 3) une checklist « testable » avec les commandes `godot --headless`,
> 4) la liste des points incertains à valider sur l'export web (ex. fog).
> Le pont JS, les noms de nœuds et l'appel `animationFinished()` doivent
> rester intacts (fournis un diff vide sur `main.gd`).

---

## 11. Fichiers à fournir au modèle de vision (checklist de l'utilisateur)

- [ ] `GODOT_ARENA_DESIGN_PACKAGE.md` (ce fichier)
- [ ] `scenes/Main.tscn`
- [ ] `scripts/main.gd`
- [ ] `project.godot`
- [ ] `export_presets.cfg`
- [ ] Captures d'écran de l'état actuel (à générer dans l'éditeur : F12 ou Alt+Impr. Écran)
- [ ] (optionnel) `scripts/inspect2.gd` pour montrer la structure des modèles

### Exemple de référence déjà livré (à donner au modèle comme pattern)

- `scripts/arenas/arena_neon.gd` — arène « Cyber Alley » 100 % procédurale
  (sol grille défilante, panneaux néon pulsants, rim lights rouge/bleu,
  spot néon, motes + pluie, textures générées en code).
- `scenes/Main.tscn` — contient déjà le nœud `Arena` (Node3D, script attaché).
- Ce pattern est LE modèle à suivre : zéro asset binaire, budgétaire,
  respectueux du contrat (Camera3D/Fighters/pont JS intacts).

### Validation (déjà en place)

- `scripts/validate_arena.gd` — valide le contrat (Camera3D, Fighters/Player1/2,
  Arena, Floor à y=0) + budget (≤ 5 lumières) et compte les nœuds.
- Commande : `godot --headless --path . --script res://scripts/validate_arena.gd`
- Résultat actuel : `VALIDATION OK : meshes=32 lumières=3 particules=2`.
