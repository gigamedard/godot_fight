extends SceneTree

# Script headless : mesure la bounding box de chaque modèle du roster
# Usage : Godot_v4.7-stable_win64.exe --headless --script res://scripts/probe_models.gd

func _init() -> void:
	var roster = {
		"p1": ["idle", "attack_1", "attack_2", "attack_3", "death", "reaction"],
		"p2": ["idle", "attack_1", "attack_2", "attack_3", "death", "reaction"],
		"p3": ["idle", "attack_1", "attack_2", "attack_3", "death", "reaction"],
		"p4": ["idle", "attack_1", "attack_2", "attack_3", "death", "reaction"],
	}
	var state_map := {
		"idle": "idle", "attack_1": "attack1", "attack_2": "attack2",
		"attack_3": "attack3", "death": "death", "reaction": "reaction",
	}
	# Exception : p1 n'a pas p1_attack1, il a p1_attak2 pour attack_3
	for prefix in roster.keys():
		for state in roster[prefix]:
			var fname = ""
			if prefix == "p1":
				if state == "idle": fname = "p1_idle.glb"
				elif state == "attack_1": fname = "p1_attack2.glb"
				elif state == "attack_2": fname = "p1_attack3.glb"
				elif state == "attack_3": fname = "p1_attak2.glb"
				elif state == "death": fname = "p1_death.glb"
				elif state == "reaction": fname = "p1_reaction.glb"
			else:
				fname = "%s_%s.glb" % [prefix, state_map[state]]
			var path: String = "res://assets/models/" + fname
			if not ResourceLoader.exists(path):
				print("%-4s %-8s %s -> MANQUANT" % [prefix, state, fname])
				continue
			var res = load(path)
			if res == null:
				print("%-4s %-8s %s -> LOAD FAIL" % [prefix, state, fname])
				continue
			var inst = res.instantiate()
			var mesh: ArrayMesh = null
			# Récupérer le premier MeshInstance3D et sa boîte englobante
			root.add_child(inst)
			inst.global_position = Vector3.ZERO
			var stack := [inst]
			var bb_min := Vector3.INF
			var bb_max := Vector3(-INF, -INF, -INF)
			while not stack.is_empty():
				var node = stack.pop_back()
				if node is MeshInstance3D:
					var mi: MeshInstance3D = node
					var aabb := mi.get_aabb()
					var global_bb_min = mi.global_position + aabb.position
					var global_bb_max = mi.global_position + aabb.position + aabb.size
					bb_min = bb_min.min(global_bb_min)
					bb_max = bb_max.max(global_bb_max)
				for c in node.get_children():
					stack.push_back(c)
			var size := Vector3.ZERO
			if not (bb_min.x >= 1e30):
				size = bb_max - bb_min
			print("%-4s %-8s %-18s min=%s max=%s size=%s" % [prefix, state, fname, bb_min, bb_max, size])
			inst.free()
	quit()
