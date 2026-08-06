extends SceneTree
## Validation de l'intégrité de la scène Main + arène procédurale.
## Usage : godot --headless --path . --script res://scripts/validate_arena.gd
## Quitte avec code 0 si tout est bon, 1 sinon.

func _init() -> void:
	call_deferred("_run")

func _run() -> void:
	var errors: Array[String] = []
	var main: Node = load("res://scenes/Main.tscn").instantiate()
	root.add_child(main)
	# Attendre le premier frame : _ready() des nœuds (moteur + arène) n'est
	# appelé qu'une fois la boucle principale démarrée.
	await process_frame

	# --- 1. Contrat : nœuds critiques du moteur de combat (NE PAS CASSER) ---
	var camera: Node = main.get_node_or_null("Camera3D")
	if camera == null or not camera is Camera3D:
		errors.append("Camera3D manquant ou mauvais type")
	if main.get_node_or_null("Fighters/Player1") == null:
		errors.append("Fighters/Player1 manquant")
	if main.get_node_or_null("Fighters/Player2") == null:
		errors.append("Fighters/Player2 manquant")

	# --- 2. Arène présente + structure ---
	var arena: Node = main.get_node_or_null("Arena")
	if arena == null:
		errors.append("Nœud Arena manquant")
	else:
		# --- 3. Sol à y = 0 (les particules de poussière sont émises à y = -0.5) ---
		var floor_node: Node3D = arena.get_node_or_null("Floor")
		if floor_node == null:
			errors.append("Arena/Floor manquant")
		else:
			var top_y: float = floor_node.position.y + 0.1  # BoxMesh height 0.2, centré -0.1
			if absf(top_y) > 0.001:
				errors.append("Sol non à y=0 (top = %s)" % top_y)

		# --- 4. Budget : nœuds mesh / lumières / particules ---
		var mesh_count := 0
		var light_count := 0
		var particle_count := 0
		for node in arena.find_children("*", "MeshInstance3D", true, false):
			mesh_count += 1
		for node in arena.find_children("*", "Light3D", true, false):
			light_count += 1
		for node in arena.find_children("*", "CPUParticles3D", true, false):
			particle_count += 1
		if light_count > 5:
			errors.append("Budget lumière dépassé : %d (> 5)" % light_count)

		# --- 5. Pont JS : main.gd doit rester lisible ---
		if not load("res://scripts/main.gd") is GDScript:
			errors.append("main.gd illisible")

		if errors.is_empty():
			print("VALIDATION OK : Arena OK | meshes=%d lumières=%d particules=%d | Camera3D/Fighters/Floor intacts" % [mesh_count, light_count, particle_count])
	_finish(main, errors)

func _finish(main: Node, errors: Array[String]) -> void:
	for e in errors:
		print("VALIDATION FAIL: " + e)
	root.remove_child(main)
	main.free()
	quit(1 if not errors.is_empty() else 0)
