extends Node3D

@export var player1_camera: Camera3D
@export var player1_node: Node3D
@export var player2_node: Node3D

var p1_models = {}
var p2_models = {}

var is_fighting = false
var is_waiting_for_result = false
var final_combat_result = -1
var final_result_text = ""
var sparks_node: CPUParticles3D
var dust_node: CPUParticles3D
var status_label: Label
var my_choice_label: Label
var flash_rect: ColorRect
var canvas: CanvasLayer
var rps_ui_container: HBoxContainer
var selection_ui_container: VBoxContainer

var _js_match_result_callback
var _js_spawn_player_cb
var _js_spawn_opponent_cb
var _js_clear_opponent_cb

var my_name = "Vous"
var opponent_name = "Adversaire"
var my_choice = -1

enum Choice { PIERRE, FEUILLE, CISEAUX }
const CHOICE_NAMES = ["PIERRE", "FEUILLE", "CISEAUX"]

var roster = {
	"p1": {
		"name": "Guerrier Ninja",
		"texture": "res://assets/models/p1_0.png",
		"models": {
			"idle": "res://assets/models/p1_idle.glb",
			"attack_1": "res://assets/models/p1_attack2.glb",
			"attack_2": "res://assets/models/p1_attack3.glb",
			"attack_3": "res://assets/models/p1_attak2.glb",
			"death": "res://assets/models/p1_death.glb",
			"reaction": "res://assets/models/p1_reaction.glb"
		}
	},
	"p2": {
		"name": "Mutant Cyborg",
		"texture": "res://assets/models/p2_0.png",
		"models": {
			"idle": "res://assets/models/p2_idle.glb",
			"attack_1": "res://assets/models/p2_attack1.glb",
			"attack_2": "res://assets/models/p2_attack2.glb",
			"attack_3": "res://assets/models/p2_attack3.glb",
			"death": "res://assets/models/p2_death.glb",
			"reaction": "res://assets/models/p2_reaction.glb"
		}
	},
	"p3": {
		"name": "Tom Frazer",
		"texture": "res://assets/models/p3_0.png",
		"models": {
			"idle": "res://assets/models/p3_idle.glb",
			"attack_1": "res://assets/models/p3_attack1.glb",
			"attack_2": "res://assets/models/p3_attack2.glb",
			"attack_3": "res://assets/models/p3_attack3.glb",
			"death": "res://assets/models/p3_death.glb",
			"reaction": "res://assets/models/p3_reaction.glb"
		}
	},
	"p4": {
		"name": "Big Choco",
		"texture": "res://assets/models/p4_0.png",
		"models": {
			"idle": "res://assets/models/p4_idle.glb",
			"attack_1": "res://assets/models/p4_attack1.glb",
			"attack_2": "res://assets/models/p4_attack2.glb",
			"attack_3": "res://assets/models/p4_attack3.glb",
			"death": "res://assets/models/p4_death.glb",
			"reaction": "res://assets/models/p4_reaction.glb"
		}
	}
}

func _ready():
	# Initial alignment
	if player1_node:
		player1_node.rotation_degrees = Vector3(0, 90, 0)
	if player2_node:
		player2_node.rotation_degrees = Vector3(0, -90, 0)
	if player1_camera:
		player1_camera.keep_aspect = Camera3D.KEEP_HEIGHT
		
	setup_particles()
	setup_ui()
	
	# Afficher l'écran de sélection par défaut uniquement hors web
	rps_ui_container.hide()
	
	# Initialisation Web3 (Pont JS)
	if OS.has_feature("web"):
		selection_ui_container.hide()
		status_label.hide()
		
		_js_match_result_callback = JavaScriptBridge.create_callback(_on_receive_match_result)
		JavaScriptBridge.get_interface("window").receiveMatchResult = _js_match_result_callback
		
		_js_spawn_player_cb = JavaScriptBridge.create_callback(_on_spawn_player)
		JavaScriptBridge.get_interface("window").godotSpawnPlayer = _js_spawn_player_cb
		
		_js_spawn_opponent_cb = JavaScriptBridge.create_callback(_on_spawn_opponent)
		JavaScriptBridge.get_interface("window").godotSpawnOpponent = _js_spawn_opponent_cb
		
		_js_clear_opponent_cb = JavaScriptBridge.create_callback(_on_clear_opponent)
		JavaScriptBridge.get_interface("window").godotClearOpponent = _js_clear_opponent_cb
		
		JavaScriptBridge.eval("if(window.onGodotReady) window.onGodotReady();")
	else:
		selection_ui_container.show()
		status_label.text = "CHOISISSEZ VOTRE COMBATTANT"

func _on_spawn_player(args):
	if args.size() == 0: return
	var player_prefix = str(args[0])
	
	for child in player1_node.get_children():
		child.queue_free()
	p1_models.clear()
	
	var p1_mat = null
	if roster.has(player_prefix) and roster[player_prefix].texture != "":
		p1_mat = StandardMaterial3D.new()
		p1_mat.albedo_texture = load(roster[player_prefix].texture)
	if roster.has(player_prefix):
		_load_models_for(player1_node, p1_models, p1_mat, roster[player_prefix].models)
	
	set_state(1, "idle")

func _on_spawn_opponent(args):
	if args.size() == 0: return
	var opponent_prefix = str(args[0])
	
	for child in player2_node.get_children():
		child.queue_free()
	p2_models.clear()
	
	var p2_mat = null
	if roster.has(opponent_prefix) and roster[opponent_prefix].texture != "":
		p2_mat = StandardMaterial3D.new()
		p2_mat.albedo_texture = load(roster[opponent_prefix].texture)
	if roster.has(opponent_prefix):
		_load_models_for(player2_node, p2_models, p2_mat, roster[opponent_prefix].models)
	
	set_state(2, "idle")
	
	# Réinitialiser l'état du combat pour que les boutons fonctionnent
	is_fighting = false
	if my_choice_label: my_choice_label.hide()
	for btn in rps_ui_container.get_children():
		if btn is Button:
			btn.disabled = false
	
	# Le combat commence
	rps_ui_container.show()
	status_label.show()
	status_label.text = "Choisissez votre attaque !"

func _on_clear_opponent(args):
	for child in player2_node.get_children():
		child.queue_free()
	p2_models.clear()
	
	if my_choice_label: my_choice_label.hide()
	rps_ui_container.hide()
	status_label.hide()

func _start_game(player_prefix: String, opponent_prefix: String = ""):
	selection_ui_container.hide()
	_on_spawn_player([player_prefix])
	if opponent_prefix == "":
		var keys = roster.keys()
		opponent_prefix = keys[randi() % keys.size()]
	_on_spawn_opponent([opponent_prefix])

func _load_models_for(parent: Node3D, model_dict: Dictionary, mat: Material, paths: Dictionary):
	for state in paths.keys():
		var path = paths[state]
		if not ResourceLoader.exists(path):
			print("Warning: Missing ", path)
			continue
		var instance = load(path).instantiate()
		parent.add_child(instance)
		instance.hide()
		model_dict[state] = instance
		
		if mat != null:
			_apply_material(instance, mat)
		
		# Set idle to loop
		if state == "idle":
			var anim = instance.get_node_or_null("AnimationPlayer")
			if anim:
				var alist = anim.get_animation_list()
				if alist.size() > 0:
					var a = anim.get_animation(alist[-1])
					if a:
						a.loop_mode = Animation.LOOP_LINEAR

func _apply_material(node: Node, mat: Material):
	if node is MeshInstance3D:
		node.set_surface_override_material(0, mat)
	for child in node.get_children():
		_apply_material(child, mat)

func set_state(player_id: int, state: String):
	var models = p1_models if player_id == 1 else p2_models
	
	for s in models.keys():
		var inst = models[s]
		if s == state:
			inst.show()
			var anim = inst.get_node_or_null("AnimationPlayer")
			if anim:
				var alist = anim.get_animation_list()
				if alist.size() > 0:
					var anim_name = alist[-1]
					anim.play(anim_name)
					if state == "idle":
						var a = anim.get_animation(anim_name)
						if a:
							anim.advance(randf() * a.length)
		else:
			inst.hide()
			var anim = inst.get_node_or_null("AnimationPlayer")
			if anim:
				anim.stop()

func setup_particles():
	sparks_node = CPUParticles3D.new()
	sparks_node.emitting = false
	sparks_node.one_shot = true
	sparks_node.amount = 40
	sparks_node.explosiveness = 0.95
	sparks_node.direction = Vector3(0, 1, 0)
	sparks_node.spread = 180.0
	sparks_node.initial_velocity_min = 4.0
	sparks_node.initial_velocity_max = 8.0
	var spark_mesh = BoxMesh.new()
	spark_mesh.size = Vector3(0.1, 0.1, 0.1)
	var mat = StandardMaterial3D.new()
	mat.albedo_color = Color(1.0, 0.8, 0.0)
	mat.emission_enabled = true
	mat.emission = Color(1.0, 0.8, 0.0)
	spark_mesh.material = mat
	sparks_node.mesh = spark_mesh
	sparks_node.position.y = 1.0
	add_child(sparks_node)
	
	dust_node = CPUParticles3D.new()
	dust_node.emitting = false
	dust_node.one_shot = true
	dust_node.amount = 30
	dust_node.explosiveness = 1.0
	dust_node.direction = Vector3(0, 1, 0)
	dust_node.spread = 90.0
	dust_node.initial_velocity_min = 2.0
	dust_node.initial_velocity_max = 4.0
	var dust_mesh = SphereMesh.new()
	dust_mesh.radius = 0.2
	dust_mesh.height = 0.4
	var dmat = StandardMaterial3D.new()
	dmat.albedo_color = Color(0.5, 0.4, 0.3, 0.6)
	dmat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	dust_mesh.material = dmat
	dust_node.mesh = dust_mesh
	add_child(dust_node)

func setup_ui():
	canvas = CanvasLayer.new()
	add_child(canvas)
	
	flash_rect = ColorRect.new()
	flash_rect.color = Color(1, 1, 1, 0)
	flash_rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	flash_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	canvas.add_child(flash_rect)
	
	status_label = Label.new()
	status_label.set_anchors_preset(Control.PRESET_TOP_WIDE)
	status_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	status_label.text = "CHOISISSEZ VOTRE COMBATTANT"
	status_label.add_theme_font_size_override("font_size", 32)
	status_label.offset_top = 20
	canvas.add_child(status_label)

	# --- LABEL DU CHOIX DU JOUEUR (SEUL SUR SON ÉCRAN) ---
	my_choice_label = Label.new()
	my_choice_label.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	my_choice_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	my_choice_label.add_theme_font_size_override("font_size", 28)
	my_choice_label.add_theme_color_override("font_color", Color(1.0, 0.85, 0.2))
	my_choice_label.offset_top = -140
	my_choice_label.offset_bottom = -80
	my_choice_label.hide()
	canvas.add_child(my_choice_label)
	
	# --- RPS UI ---
	rps_ui_container = HBoxContainer.new()
	canvas.add_child(rps_ui_container)
	rps_ui_container.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	rps_ui_container.alignment = BoxContainer.ALIGNMENT_CENTER
	rps_ui_container.add_theme_constant_override("separation", 20)
	rps_ui_container.offset_top = -110
	rps_ui_container.offset_bottom = -20
	
	var btn_p = Button.new()
	btn_p.text = " PIERRE "
	btn_p.custom_minimum_size = Vector2(130, 55)
	btn_p.add_theme_font_size_override("font_size", 24)
	btn_p.pressed.connect(func(): _on_choice_made(Choice.PIERRE))
	rps_ui_container.add_child(btn_p)
	
	var btn_f = Button.new()
	btn_f.text = " FEUILLE "
	btn_f.custom_minimum_size = Vector2(130, 55)
	btn_f.add_theme_font_size_override("font_size", 24)
	btn_f.pressed.connect(func(): _on_choice_made(Choice.FEUILLE))
	rps_ui_container.add_child(btn_f)
	
	var btn_c = Button.new()
	btn_c.text = " CISEAUX "
	btn_c.custom_minimum_size = Vector2(130, 55)
	btn_c.add_theme_font_size_override("font_size", 24)
	btn_c.pressed.connect(func(): _on_choice_made(Choice.CISEAUX))
	rps_ui_container.add_child(btn_c)
	
	# --- SÉLECTION UI ---
	selection_ui_container = VBoxContainer.new()
	canvas.add_child(selection_ui_container)
	selection_ui_container.set_anchors_preset(Control.PRESET_CENTER)
	selection_ui_container.alignment = BoxContainer.ALIGNMENT_CENTER
	selection_ui_container.add_theme_constant_override("separation", 20)
	
	for prefix in roster.keys():
		var btn = Button.new()
		btn.text = " Jouer " + roster[prefix].name + " "
		btn.add_theme_font_size_override("font_size", 28)
		# Capture de la variable locale
		btn.pressed.connect(func(p=prefix): _start_game(p))
		selection_ui_container.add_child(btn)

func _on_choice_made(player_choice: Choice):
	if is_fighting:
		return
	is_fighting = true
	my_choice = player_choice
	Sfx.play("click")
	
	status_label.text = "COMBAT EN COURS..."
	rps_ui_container.hide() # On cache les boutons de combat
	
	# Afficher le choix sélectionné sur l'écran du joueur uniquement
	if my_choice_label:
		my_choice_label.text = "Votre choix : " + CHOICE_NAMES[player_choice] + " 🔒"
		my_choice_label.show()
	
	is_waiting_for_result = true
	final_combat_result = -1
	_start_endless_combat_loop()
	
	if OS.has_feature("web"):
		# On envoie le choix au JavaScript et on attend
		# JS attend des valeurs entre 1 et 3
		JavaScriptBridge.eval("window.submitMove(%d)" % (player_choice + 1))
	else:
		# Fallback hors ligne
		var p2_choice = randi() % 3
		var diff = (player_choice - p2_choice + 3) % 3
		var winner = 0
		if diff == 1: winner = 1
		elif diff == 2: winner = 2
		var result_text = my_name + " : " + CHOICE_NAMES[player_choice] + "   VS   " + opponent_name + " : " + CHOICE_NAMES[p2_choice] + "\n"
		if winner == 0: result_text += "ÉGALITÉ !"
		elif winner == 1: result_text += "VOUS GAGNEZ !"
		else: result_text += "L'ORDI GAGNE !"
		_on_receive_match_result([winner, p2_choice + 1])

func _on_receive_match_result(args):
	var godotResult = args[0] # 0: draw, 1: win, 2: loss
	var opponentMove = args[1] # 0: timeout, 1: pierre, 2: feuille, 3: ciseaux
	
	if opponentMove == 0:
		var txt = my_name + "   VS   " + opponent_name + "\n"
		if godotResult == 0:
			txt += "MATCH ANNULÉ (FORFAIT) !"
		elif godotResult == 1:
			txt += "VICTOIRE PAR FORFAIT !"
		else:
			txt += "DÉFAITE PAR INACTIVITÉ !"
			
		final_combat_result = godotResult
		final_result_text = txt
		is_waiting_for_result = false
		return
		
	var opponent_choice = opponentMove - 1
	var result_text = my_name + " : " + CHOICE_NAMES[my_choice] + "   VS   " + opponent_name + " : " + CHOICE_NAMES[opponent_choice] + "\n"
	
	if godotResult == 0:
		result_text += "ÉGALITÉ !"
	elif godotResult == 1:
		result_text += "VOUS GAGNEZ !"
	else:
		result_text += "VOUS PERDEZ !"
		
	final_combat_result = godotResult
	final_result_text = result_text
	is_waiting_for_result = false

func _shake_camera(intensity: float):
	var shake = create_tween()
	shake.tween_property(player1_camera, "v_offset", intensity, 0.02)
	shake.tween_property(player1_camera, "h_offset", intensity, 0.02)
	shake.tween_property(player1_camera, "v_offset", -intensity, 0.02)
	shake.tween_property(player1_camera, "h_offset", -intensity, 0.02)
	shake.tween_property(player1_camera, "v_offset", 0.0, 0.02)
	shake.tween_property(player1_camera, "h_offset", 0.0, 0.02)

func _flash_screen():
	flash_rect.color.a = 1.0
	var tween = create_tween()
	tween.tween_property(flash_rect, "color:a", 0.0, 1.0)

func _start_endless_combat_loop():
	if not player1_node or not player2_node or not player1_camera:
		return
		
	# -- ÉTAPE 0 : RAPPROCHEMENT INITIAL --
	var t0 = create_tween().set_parallel(true)
	t0.tween_property(player1_node, "position", Vector3(-0.4, 0, 0), 0.5).set_trans(Tween.TRANS_CUBIC)
	t0.tween_property(player1_node, "rotation_degrees", Vector3(0, 90, 0), 0.5)
	t0.tween_property(player2_node, "position", Vector3(0.4, 0, 0), 0.5).set_trans(Tween.TRANS_CUBIC)
	t0.tween_property(player2_node, "rotation_degrees", Vector3(0, -90, 0), 0.5)
	t0.tween_property(player1_camera, "fov", 45.0, 0.5).set_trans(Tween.TRANS_CUBIC)
	await t0.finished
	
	# -- ÉTAPE 1 : BOUCLE INFINIE D'ÉCHANGE DE COUPS --
	Sfx.play("countdown")
	Sfx.start_music()
	while is_waiting_for_result:
		var attacker = randi_range(1, 2)
		var defender = 2 if attacker == 1 else 1
		
		var attack_num = randi_range(1, 3)
		set_state(attacker, "attack_" + str(attack_num))
		Sfx.play("whoosh")
		set_state(defender, "idle")
		
		await get_tree().create_timer(0.7).timeout
		if not is_waiting_for_result: break
		
		sparks_node.amount = 20
		sparks_node.emitting = true
		Sfx.play("impact")
		_shake_camera(0.05)
		
		set_state(defender, "reaction")
		Sfx.play("hurt")
		await get_tree().create_timer(0.5).timeout
		if not is_waiting_for_result: break
		
		set_state(attacker, "idle")
		set_state(defender, "idle")
		await get_tree().create_timer(0.1).timeout

	# -- QUAND LA BOUCLE S'ARRÊTE, ON JOUE LE CLIMAX --
	_play_combat_climax(final_combat_result, final_result_text)

func _play_combat_climax(winner: int, final_result_txt: String):
	if not player1_node or not player2_node or not player1_camera:
		return
		
	# -- ÉTAPE 2 : LE COUP DE GRÂCE (CLIMAX) --
	var effect = randi() % 3
	
	if winner != 0:
		var loser = 2 if winner == 1 else 1
		
		var attack_num = randi_range(1, 3)
		set_state(winner, "attack_" + str(attack_num))
		Sfx.play("whoosh")
		await get_tree().create_timer(0.7).timeout
		
		if effect == 1: Engine.time_scale = 0.2
		elif effect == 2: _flash_screen()
		
		if effect == 0:
			var zt = create_tween()
			zt.tween_property(player1_camera, "fov", 30.0, 0.1)
			
		_shake_camera(0.2)
		sparks_node.amount = 100
		sparks_node.emitting = true
		Sfx.play("impact")
		
		await get_tree().create_timer(0.1 * Engine.time_scale).timeout
		Engine.time_scale = 1.0
		
		set_state(loser, "death")
		Sfx.play("death")
		var l_pos = 2.5 if winner == 1 else -2.5
		var l_node = player1_node if loser == 1 else player2_node
		var tfall = create_tween()
		tfall.tween_property(l_node, "position:x", l_pos, 0.5).set_trans(Tween.TRANS_EXPO).set_ease(Tween.EASE_OUT)
		
		await get_tree().create_timer(0.4).timeout
		dust_node.position = l_node.position
		dust_node.position.y = -0.5
		dust_node.emitting = true
		
		await get_tree().create_timer(1.0).timeout
		
		status_label.text = final_result_txt
		if effect == 0: create_tween().tween_property(player1_camera, "fov", 60.0, 0.5)
		
		await get_tree().create_timer(1.5).timeout
		
		var w_pos = -2.0 if winner == 1 else 2.0
		var w_node = player1_node if winner == 1 else player2_node
		create_tween().tween_property(w_node, "position:x", w_pos, 0.5).set_trans(Tween.TRANS_SINE)
		set_state(winner, "idle")
		
		await get_tree().create_timer(0.5).timeout
		set_state(loser, "idle")
		
	else:
		set_state(1, "attack_" + str(randi_range(1, 3)))
		set_state(2, "attack_" + str(randi_range(1, 3)))
		Sfx.play("whoosh")
		await get_tree().create_timer(0.7).timeout
		
		if effect == 1: Engine.time_scale = 0.2
		elif effect == 2: _flash_screen()
		if effect == 0: create_tween().tween_property(player1_camera, "fov", 30.0, 0.1)
		
		_shake_camera(0.2)
		sparks_node.amount = 100
		sparks_node.emitting = true
		Sfx.play("impact")
		
		await get_tree().create_timer(0.1 * Engine.time_scale).timeout
		Engine.time_scale = 1.0
		
		set_state(1, "reaction")
		set_state(2, "reaction")
		Sfx.play("hurt")
		
		var tfall = create_tween().set_parallel(true)
		tfall.tween_property(player1_node, "position:x", -2.0, 0.5).set_trans(Tween.TRANS_SINE)
		tfall.tween_property(player2_node, "position:x", 2.0, 0.5).set_trans(Tween.TRANS_SINE)
		
		await get_tree().create_timer(0.4).timeout
		dust_node.position = Vector3(0, -0.5, 0)
		dust_node.emitting = true
		
		await get_tree().create_timer(1.0).timeout
		
		status_label.text = final_result_txt
		if effect == 0: create_tween().tween_property(player1_camera, "fov", 60.0, 0.5)
		
		await get_tree().create_timer(1.5).timeout
		set_state(1, "idle")
		set_state(2, "idle")
	is_fighting = false
	Sfx.stop_music()
	if winner != 0:
		Sfx.play("victory")
	if my_choice_label: my_choice_label.hide()

	if OS.has_feature("web"):
		JavaScriptBridge.eval("if(window.animationFinished) { window.animationFinished(); }")
