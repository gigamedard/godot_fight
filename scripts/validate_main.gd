extends SceneTree

# Validation complète de la scène Main : compilation, UI, sons, icônes PFC.
# Usage : Godot_v4.7-stable_win64.exe --headless --script res://scripts/validate_main.gd
# Quitte avec 0 si OK, 1 si erreur.

var errors: Array[String] = []

func _init() -> void:
	call_deferred("_run")

func _run() -> void:
	# Les autoloads (Sfx) ne sont enregistrés comme globals qu'après le 1er frame
	# (call_deferred ci-dessus). On attend aussi que Sfx soit dans l'arbre.
	if not root.has_node("Sfx"):
		errors.append("Autoload Sfx absent")
		quit(1)
		return

	# 1) Charger la scène
	var packed: PackedScene = load("res://scenes/Main.tscn")
	if packed == null:
		errors.append("Scène Main.tscn introuvable")
		quit(1)
		return
	var main: Node = packed.instantiate()
	root.add_child(main)
	# Laisser _ready() s'exécuter
	await process_frame
	await process_frame

	# 2) Vérifier les exports de variables
	if not main.get("player1_camera"):
		errors.append("player1_camera manquant")
	if not main.get("player1_node"):
		errors.append("player1_node manquant")
	if not main.get("player2_node"):
		errors.append("player2_node manquant")

	# 3) Vérifier le roster (fichiers modèles existants)
	var roster: Dictionary = main.get("roster")
	for prefix in roster.keys():
		var entry: Dictionary = roster[prefix]
		for state in entry.models.keys():
			var p: String = entry.models[state]
			if not ResourceLoader.exists(p):
				errors.append("Modèle manquant: %s" % p)

	# 4) Vérifier que les textures du roster existent
	for prefix in roster.keys():
		var tex: String = roster[prefix].texture
		if tex != "" and not ResourceLoader.exists(tex):
			errors.append("Texture manquante: %s" % tex)

	# 5) Vérifier les polices
	for f in ["res://assets/fonts/RussoOne-Regular.ttf", "res://assets/fonts/Orbitron-Variable.ttf"]:
		if not ResourceLoader.exists(f):
			errors.append("Police manquante: %s" % f)

	# 6) Vérifier le bus Sfx (autoload)
	if not root.has_node("Sfx"):
		errors.append("Autoload Sfx absent")

	# 7) Vérifier que l'UI contient les boutons PFC (3 boutons dans rps_ui_container)
	var rps: Node = main.get("rps_ui_container")
	if rps:
		var btn_count := 0
		for c in rps.get_children():
			if c is Button:
				btn_count += 1
				if c.icon == null:
					errors.append("Bouton %s sans icône PFC" % c.text)
		if btn_count != 3:
			errors.append("Attendu 3 boutons PFC, trouvé %d" % btn_count)
	else:
		errors.append("rps_ui_container absent")

	# 8) Tester le générateur d'icônes directement
	if not main.has_method("_make_pfc_icon"):
		errors.append("_make_pfc_icon absent")
	else:
		for kind in ["pierre", "feuille", "ciseaux"]:
			var tex = main.call("_make_pfc_icon", kind)
			if tex == null:
				errors.append("Icône %s non générée" % kind)

	# 9) Vérifier les constantes visuelles
	if main.get("FOOT_Y") != 0.5:
		errors.append("FOOT_Y incorrect")
	if main.get("WAIT_X") != 1.5:
		errors.append("WAIT_X incorrect")

	# 10) Tester le spawn simulé (les deux combattants visibles)
	main.call("_on_spawn_player", ["p1"])
	main.call("_on_spawn_opponent", ["p2"])
	await process_frame
	var p1_pos: Vector3 = main.get("player1_node").position
	var p2_pos: Vector3 = main.get("player2_node").position
	print("P1 pos = %s, P2 pos = %s" % [p1_pos, p2_pos])
	if p1_pos.x != -1.5 or p1_pos.y != 0.5:
		errors.append("P1 mal positionné: %s" % p1_pos)
	if p2_pos.x != 1.5 or p2_pos.y != 0.5:
		errors.append("P2 mal positionné: %s" % p2_pos)
	if p1_pos.x >= p2_pos.x:
		errors.append("P1/P2 se chevauchent ou inversés")

	_finish(main, errors)

func _finish(main: Node, errs: Array[String]) -> void:
	if errs.is_empty():
		print("VALIDATE_MAIN: OK")
		main.queue_free()
		quit(0)
	else:
		print("VALIDATE_MAIN: ECHEC — %d erreur(s):" % errs.size())
		for e in errs:
			print("  - " + e)
		main.queue_free()
		quit(1)
