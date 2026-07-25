# Web3 Combat Game - Project Rules & Learnings

These rules were established after significant debugging and must be strictly followed to prevent regressions.

## 1. Godot Web Integration Architecture
*   **NEVER** use `iframe` to load Godot dynamically. It causes file path resolution errors, WebAssembly loading failures, and UI freezing.
*   **ALWAYS** initialize Godot natively in `index.html` on page load. Use a background canvas (`z-index: 0`) and overlay the HTML UI (`z-index: 10`), using CSS `.hidden` (opacity 0, pointer-events none) to toggle visibility between the UI and the 3D Engine.

## 2. JavaScript to Godot Communication (`JavaScriptBridge`)
*   When calling a Godot callback from JavaScript (e.g., `window.godotSpawnPlayer(id)`), pass the raw arguments directly (e.g., a plain string or integer).
*   **DO NOT** wrap the argument in a JavaScript array (e.g., `window.godotSpawnPlayer(["p1"])`). Godot's `JavaScriptBridge` automatically packages arguments into an `args` array in GDScript (`func _on_spawn_player(args): var id = args[0]`). Passing an array from JS results in Godot receiving a `<JavaScriptObject>`, which will crash dictionary lookups.
*   **DO NOT** use `setTimeout` in JavaScript to wait for a Godot animation to finish. Always trigger a callback from GDScript to JS (e.g., `JavaScriptBridge.eval("window.animationFinished()")`) to ensure perfect synchronization.

## 3. Laravel 11 Routing
*   **NEVER** pass a `Closure` to `Route::middleware()` when defining route groups in `api.php`. In Laravel 11, this triggers an `Object of class Closure could not be converted to string` fatal error. 
*   Always use string middleware names or apply middleware directly to the route definitions.

## 4. Code Modification Safety
*   When using replace operations on code blocks, meticulously verify that closing braces `}` and parentheses `)` of surrounding functions/callbacks are not accidentally deleted, which would cause silent syntax errors and application failure.
