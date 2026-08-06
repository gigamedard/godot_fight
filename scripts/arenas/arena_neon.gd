extends Node3D
## Arène de démonstration : "Cyber Alley" (BATTLEPOOL)
## ------------------------------------------------------------
## 100 % PROCÉDURALE : aucune ressource binaire, aucune texture importée.
## Renderer cible : GL Compatibility (Godot 4.7, export web).
## Contrat : ce script ne touche PAS à Camera3D / Fighters / au pont JS.
## Le sol est à y = 0 (les particules de poussière du combat sont émises à y = -0.5).

const NEON_CYAN := Color(0.15, 1.0, 1.0)
const NEON_MAGENTA := Color(1.0, 0.15, 0.85)
const NEON_ORANGE := Color(1.0, 0.5, 0.1)
const NEON_GREEN := Color(0.3, 1.0, 0.45)
const NEON_BLUE := Color(0.25, 0.6, 1.0)
const NEON_RED := Color(1.0, 0.2, 0.2)

var _floor_mat: StandardMaterial3D
var _sign_mats: Array[StandardMaterial3D] = []
var _sign_phases: Array[float] = []
var _rim_left: OmniLight3D
var _rim_right: OmniLight3D
var _time := 0.0

func _ready() -> void:
	_build_floor()
	_build_background()
	_build_lights()
	_build_particles()

func _process(delta: float) -> void:
	_time += delta
	_animate(delta)

# ===========================================================================
# SOL : dalle sombre + grille néon défilante + anneau de combat + flaques
# ===========================================================================
func _build_floor() -> void:
	var grid_tex := _make_grid_texture()
	_floor_mat = StandardMaterial3D.new()
	_floor_mat.albedo_color = Color(0.04, 0.05, 0.07)
	_floor_mat.metallic = 0.75
	_floor_mat.roughness = 0.4
	_floor_mat.albedo_texture = grid_tex
	_floor_mat.emission_enabled = true
	_floor_mat.emission_texture = grid_tex
	_floor_mat.emission = NEON_CYAN
	_floor_mat.emission_energy_multiplier = 1.3

	var floor_mesh := BoxMesh.new()
	floor_mesh.size = Vector3(20.0, 0.2, 14.0)
	var floor_node := MeshInstance3D.new()
	floor_node.name = "Floor"
	floor_node.mesh = floor_mesh
	floor_node.material_override = _floor_mat
	floor_node.position = Vector3(0.0, -0.1, 0.0)  # dessus du sol = y 0
	add_child(floor_node)

	# Anneau lumineux autour de la zone de combat (P1/P2 à x = ±2)
	var ring_mat := StandardMaterial3D.new()
	ring_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	ring_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	ring_mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	ring_mat.albedo_color = Color(0.15, 1.0, 1.0, 0.7)
	var ring_mesh := CylinderMesh.new()
	ring_mesh.top_radius = 3.4
	ring_mesh.bottom_radius = 3.4
	ring_mesh.height = 0.02
	ring_mesh.radial_segments = 48
	var ring_node := MeshInstance3D.new()
	ring_node.name = "CombatRing"
	ring_node.mesh = ring_mesh
	ring_node.material_override = ring_mat
	ring_node.position = Vector3(0.0, 0.01, 0.0)
	add_child(ring_node)

	# Deux flaques spéculaires (réflexion néon simulée par spécularité + émission)
	for i in 2:
		var puddle_mat := StandardMaterial3D.new()
		puddle_mat.albedo_color = Color(0.03, 0.1, 0.12)
		puddle_mat.metallic = 1.0
		puddle_mat.roughness = 0.06
		puddle_mat.emission_enabled = true
		puddle_mat.emission = Color(0.05, 0.3, 0.35)
		puddle_mat.emission_energy_multiplier = 0.6
		var puddle_mesh := QuadMesh.new()
		puddle_mesh.size = Vector2(3.0, 1.8)
		puddle_mesh.orientation = QuadMesh.FACE_Y
		var puddle_node := MeshInstance3D.new()
		puddle_node.name = "Puddle%d" % (i + 1)
		puddle_node.mesh = puddle_mesh
		puddle_node.material_override = puddle_mat
		puddle_node.position = Vector3(1.4 - 2.8 * i, 0.005, 0.4)
		add_child(puddle_node)

# ===========================================================================
# FOND : mur + halo additive + panneaux néon + poteaux + câbles
# ===========================================================================
func _build_background() -> void:
	# Mur de fond
	var wall_mat := StandardMaterial3D.new()
	wall_mat.albedo_color = Color(0.02, 0.02, 0.04)
	wall_mat.metallic = 0.6
	wall_mat.roughness = 0.8
	var wall_mesh := BoxMesh.new()
	wall_mesh.size = Vector3(22.0, 7.0, 0.2)
	var wall_node := MeshInstance3D.new()
	wall_node.name = "BackWall"
	wall_node.mesh = wall_mesh
	wall_node.material_override = wall_mat
	wall_node.position = Vector3(0.0, 3.5, -7.0)
	add_child(wall_node)

	# Halo néon (quad additive, texture radiale générée en code)
	var halo_mat := StandardMaterial3D.new()
	halo_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	halo_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	halo_mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	halo_mat.albedo_texture = _make_halo_texture()
	var halo_mesh := QuadMesh.new()
	halo_mesh.size = Vector2(20.0, 7.0)
	var halo_node := MeshInstance3D.new()
	halo_node.name = "NeonHalo"
	halo_node.mesh = halo_mesh
	halo_node.material_override = halo_mat
	halo_node.position = Vector3(0.0, 3.5, -6.95)
	add_child(halo_node)

	# 5 panneaux néon verticaux avec bandes lumineuses pulsantes
	var sign_colors := [NEON_MAGENTA, NEON_CYAN, NEON_ORANGE, NEON_GREEN, NEON_BLUE]
	var sign_x := [-6.0, -3.0, 0.0, 3.0, 6.0]
	for i in sign_x.size():
		var panel_mat := StandardMaterial3D.new()
		panel_mat.albedo_color = Color(0.05, 0.05, 0.08)
		panel_mat.metallic = 0.4
		panel_mat.roughness = 0.7
		var panel_mesh := BoxMesh.new()
		panel_mesh.size = Vector3(2.2, 3.0, 0.15)
		var panel_node := MeshInstance3D.new()
		panel_node.name = "SignPanel%d" % (i + 1)
		panel_node.mesh = panel_mesh
		panel_node.material_override = panel_mat
		panel_node.position = Vector3(sign_x[i], 3.0, -6.5)
		add_child(panel_node)

		for b in 2:
			var band_mat := StandardMaterial3D.new()
			band_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
			band_mat.albedo_color = sign_colors[i]
			band_mat.emission_enabled = true
			band_mat.emission = sign_colors[i]
			band_mat.emission_energy_multiplier = 2.0
			var band_mesh := BoxMesh.new()
			band_mesh.size = Vector3(1.6, 0.22, 0.06)
			var band_node := MeshInstance3D.new()
			band_node.name = "NeonBand%d_%d" % [i + 1, b + 1]
			band_node.mesh = band_mesh
			band_node.material_override = band_mat
			band_node.position = Vector3(sign_x[i], 2.1 + 1.2 * b, -6.42)
			add_child(band_node)
			_sign_mats.append(band_mat)
			_sign_phases.append(float(i * 0.7 + b * 1.3))

	# Poteaux latéraux (rouge à gauche, bleu à droite) avec anneaux émissifs
	for side in [-1.0, 1.0]:
		var pole_mat := StandardMaterial3D.new()
		pole_mat.albedo_color = Color(0.04, 0.04, 0.06)
		pole_mat.metallic = 0.8
		pole_mat.roughness = 0.4
		var pole_mesh := CylinderMesh.new()
		pole_mesh.top_radius = 0.12
		pole_mesh.bottom_radius = 0.12
		pole_mesh.height = 9.0
		pole_mesh.radial_segments = 16
		var pole_node := MeshInstance3D.new()
		pole_node.name = "PoleL" if side < 0.0 else "PoleR"
		pole_node.mesh = pole_mesh
		pole_node.material_override = pole_mat
		pole_node.position = Vector3(7.0 * side, 4.5, -6.0)
		add_child(pole_node)

		var ring_color := NEON_RED if side < 0.0 else NEON_BLUE
		var side_name := "L" if side < 0.0 else "R"
		for a in 3:
			var ring_mat := StandardMaterial3D.new()
			ring_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
			ring_mat.albedo_color = ring_color
			ring_mat.emission_enabled = true
			ring_mat.emission = ring_color
			ring_mat.emission_energy_multiplier = 1.8
			var ring_mesh := CylinderMesh.new()
			ring_mesh.top_radius = 0.16
			ring_mesh.bottom_radius = 0.16
			ring_mesh.height = 0.08
			ring_mesh.radial_segments = 16
			var pole_ring_node := MeshInstance3D.new()
			pole_ring_node.name = "Pole%sRing%d" % [side_name, a + 1]
			pole_ring_node.mesh = ring_mesh
			pole_ring_node.material_override = ring_mat
			pole_ring_node.position = Vector3(7.0 * side, 2.0 + 2.0 * a, -6.0)
			add_child(pole_ring_node)

	# Câbles lumineux horizontaux entre les poteaux
	for c in 3:
		var cable_mat := StandardMaterial3D.new()
		cable_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		cable_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		cable_mat.albedo_color = Color(0.2, 0.8, 0.9, 0.8)
		cable_mat.emission_enabled = true
		cable_mat.emission = Color(0.2, 0.8, 0.9)
		cable_mat.emission_energy_multiplier = 1.2
		var cable_mesh := CylinderMesh.new()
		cable_mesh.top_radius = 0.02
		cable_mesh.bottom_radius = 0.02
		cable_mesh.height = 14.4
		cable_mesh.radial_segments = 8
		var cable_node := MeshInstance3D.new()
		cable_node.name = "Cable%d" % (c + 1)
		cable_node.mesh = cable_mesh
		cable_node.material_override = cable_mat
		cable_node.position = Vector3(0.0, 7.5 + 0.4 * c, -6.0)
		cable_node.rotation_degrees = Vector3(0.0, 0.0, 90.0)
		add_child(cable_node)

# ===========================================================================
# LUMIÈRES : rim lights colorées (rouge P1 / bleu P2) + spot néon de fond
# ===========================================================================
func _build_lights() -> void:
	_rim_left = OmniLight3D.new()
	_rim_left.name = "RimRed"
	_rim_left.light_color = NEON_RED
	_rim_left.light_energy = 2.5
	_rim_left.omni_range = 6.0
	_rim_left.shadow_enabled = false
	_rim_left.position = Vector3(-2.4, 2.4, 1.4)
	add_child(_rim_left)

	_rim_right = OmniLight3D.new()
	_rim_right.name = "RimBlue"
	_rim_right.light_color = NEON_BLUE
	_rim_right.light_energy = 2.5
	_rim_right.omni_range = 6.0
	_rim_right.shadow_enabled = false
	_rim_right.position = Vector3(2.4, 2.4, 1.4)
	add_child(_rim_right)

	var spot := SpotLight3D.new()
	spot.name = "NeonSpot"
	spot.light_color = NEON_MAGENTA
	spot.light_energy = 5.0
	spot.spot_range = 14.0
	spot.spot_angle = 45.0
	spot.shadow_enabled = false
	spot.position = Vector3(0.0, 4.2, -5.2)
	add_child(spot)
	spot.look_at(Vector3(0.0, 1.0, 0.0))

# ===========================================================================
# PARTICULES : motes holographiques montantes + pluie fine
# ===========================================================================
func _build_particles() -> void:
	var mote_tex := _make_glow_dot()
	var mote_mat := StandardMaterial3D.new()
	mote_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mote_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mote_mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	mote_mat.albedo_texture = mote_tex
	mote_mat.albedo_color = Color(0.5, 1.0, 1.0)
	var mote_mesh := QuadMesh.new()
	mote_mesh.size = Vector2(0.06, 0.06)
	mote_mesh.material = mote_mat

	var motes := CPUParticles3D.new()
	motes.name = "HoloMotes"
	motes.amount = 80
	motes.lifetime = 4.0
	motes.one_shot = false
	motes.direction = Vector3(0.0, 1.0, 0.0)
	motes.spread = 30.0
	motes.initial_velocity_min = 0.4
	motes.initial_velocity_max = 1.0
	motes.gravity = Vector3(0.0, -0.3, 0.0)
	motes.emission_shape = CPUParticles3D.EMISSION_SHAPE_BOX
	motes.emission_box_extents = Vector3(6.0, 0.4, 4.0)
	motes.scale_amount_min = 0.8
	motes.scale_amount_max = 1.6
	motes.mesh = mote_mesh
	motes.position = Vector3(0.0, 0.3, 0.0)
	add_child(motes)

	var rain_mat := StandardMaterial3D.new()
	rain_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	rain_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	rain_mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	rain_mat.albedo_color = Color(0.4, 0.7, 1.0, 0.5)
	var rain_mesh := SphereMesh.new()
	rain_mesh.radius = 0.01
	rain_mesh.height = 0.02
	rain_mesh.material = rain_mat

	var rain := CPUParticles3D.new()
	rain.name = "Rain"
	rain.amount = 150
	rain.lifetime = 2.5
	rain.one_shot = false
	rain.direction = Vector3(0.0, -1.0, 0.0)
	rain.spread = 4.0
	rain.initial_velocity_min = 5.0
	rain.initial_velocity_max = 7.0
	rain.gravity = Vector3(0.0, -4.0, 0.0)
	rain.emission_shape = CPUParticles3D.EMISSION_SHAPE_BOX
	rain.emission_box_extents = Vector3(8.0, 0.2, 6.0)
	rain.mesh = rain_mesh
	rain.position = Vector3(0.0, 5.0, 0.0)
	add_child(rain)

# ===========================================================================
# ANIMATION : grille défilante, pulsation des néons, respiration des rims
# ===========================================================================
func _animate(delta: float) -> void:
	if _floor_mat:
		_floor_mat.uv1_offset.x = fmod(_floor_mat.uv1_offset.x + delta * 0.25, 1.0)

	for i in _sign_mats.size():
		var m := _sign_mats[i]
		m.emission_energy_multiplier = 1.4 + 0.8 * sin(_time * 2.2 + _sign_phases[i])

	if _rim_left and _rim_right:
		var pulse := 0.25 * sin(_time * 1.4)
		_rim_left.light_energy = 2.3 + pulse
		_rim_right.light_energy = 2.3 - pulse

# ===========================================================================
# TEXTURES GÉNÉRÉES EN CODE (aucun asset binaire)
# ===========================================================================
func _make_grid_texture() -> ImageTexture:
	var size := 256
	var img := Image.create(size, size, false, Image.FORMAT_RGBA8)
	img.fill(Color(0, 0, 0, 1))
	var step := 32
	var line := Color(0.35, 1.0, 1.0, 1.0)
	for y in size:
		for x in size:
			if x % step == 0 or y % step == 0:
				img.set_pixel(x, y, line)
	return ImageTexture.create_from_image(img)

func _make_halo_texture() -> ImageTexture:
	var size := 256
	var img := Image.create(size, size, false, Image.FORMAT_RGBA8)
	img.fill(Color(0, 0, 0, 0))
	var center := Vector2((size - 1) / 2.0, (size - 1) / 2.0)
	var radius := size / 2.0
	for y in size:
		for x in size:
			var d := Vector2(x, y).distance_to(center) / radius
			if d <= 1.0:
				var a := pow(1.0 - d, 2.0)
				img.set_pixel(x, y, Color(0.3, 0.8, 1.0, a))
	return ImageTexture.create_from_image(img)

func _make_glow_dot() -> ImageTexture:
	var size := 64
	var img := Image.create(size, size, false, Image.FORMAT_RGBA8)
	img.fill(Color(0, 0, 0, 0))
	var center := Vector2((size - 1) / 2.0, (size - 1) / 2.0)
	var radius := size / 2.0
	for y in size:
		for x in size:
			var d := Vector2(x, y).distance_to(center) / radius
			if d <= 1.0:
				var a := pow(1.0 - d, 2.0)
				img.set_pixel(x, y, Color(1, 1, 1, a))
	return ImageTexture.create_from_image(img)
