extends SceneTree

func _init():
	var scene = load("res://assets/models/p1_idle.glb").instantiate()
	print("--- p1_idle.glb Node Tree ---")
	_print_tree(scene, "")
	var anim = scene.get_node_or_null("AnimationPlayer")
	if anim:
		print("Animations: ", anim.get_animation_list())
	else:
		print("NO AnimationPlayer found at root")
	quit()

func _print_tree(node, indent):
	print(indent + node.name + " (" + node.get_class() + ")")
	for child in node.get_children():
		_print_tree(child, indent + "  ")
