extends SceneTree
func _init():
	var scene = load("res://assets/models/p1_idle.fbx").instantiate()
	var anim_player = scene.get_node_or_null("AnimationPlayer")
	if anim_player:
		print("ANIMATIONS_FOUND in p1_idle.fbx: ", anim_player.get_animation_list())
	else:
		print("NO_ANIMATION_PLAYER")
	quit()
