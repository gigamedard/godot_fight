extends SceneTree
## Validation du système audio procédural (autoload Sfx).
## Usage : godot --headless --path . --script res://scripts/validate_sfx.gd
## Quitte avec code 0 si tout est bon, 1 sinon.

const EXPECTED := ["click", "countdown", "whoosh", "impact", "hit", "hurt", "death", "victory", "music"]

func _init() -> void:
	call_deferred("_run")

func _run() -> void:
	var errors: Array[String] = []

	# --- 1. Autoload Sfx présent ---
	var sfx: Node = root.get_node_or_null("Sfx")
	if sfx == null or not sfx.has_method("play"):
		errors.append("Autoload Sfx absent ou inopérant")
	else:
		# --- 2. Chaque stream généré (données non vides) ---
		var dump: String = sfx.summarize()
		print(dump)
		for nm in EXPECTED:
			if not dump.contains(nm + "="):
				errors.append("Stream manquant : %s" % nm)

		# --- 3. Lecture sans erreur ---
		sfx.play("impact")
		sfx.start_music()
		sfx.stop_music()

	# --- 4. Buses audio créées ---
	for bus in ["Sfx", "Music"]:
		var found := false
		for i in AudioServer.bus_count:
			if AudioServer.get_bus_name(i) == bus:
				found = true
		if not found:
			errors.append("Bus audio manquant : %s" % bus)

	if errors.is_empty():
		print("AUDIO OK : %d streams procéduraux générés + buses Sfx/Music présentes" % EXPECTED.size())
		quit(0)
	else:
		for e in errors:
			print("AUDIO FAIL: " + e)
		quit(1)