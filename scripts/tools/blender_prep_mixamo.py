import bpy
import sys
import os

# Paramètre attendu via args
input_path = ""
for i, arg in enumerate(sys.argv):
    if arg == "--input" and i + 1 < len(sys.argv):
        input_path = sys.argv[i + 1]

if not input_path or not os.path.exists(input_path):
    print("Erreur : input_path invalide ou manquant.")
    sys.exit(1)

def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

clear_scene()

if input_path.lower().endswith('.glb') or input_path.lower().endswith('.gltf'):
    bpy.ops.import_scene.gltf(filepath=input_path)
elif input_path.lower().endswith('.obj'):
    bpy.ops.import_scene.obj(filepath=input_path)
elif input_path.lower().endswith('.fbx'):
    bpy.ops.import_scene.fbx(filepath=input_path)

# Appliquer les transformations
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# Supprimer tous les armatures (squelettes) existants
for obj in bpy.data.objects:
    if obj.type == 'ARMATURE':
        bpy.data.objects.remove(obj, do_unlink=True)

# Exporter en FBX pour Mixamo dans le même dossier
output_name = "to_mixamo_" + os.path.splitext(os.path.basename(input_path))[0] + ".fbx"
output_path = os.path.join(os.path.dirname(input_path), output_name)
bpy.ops.export_scene.fbx(filepath=output_path, use_selection=False, add_leaf_bones=False)

print(f"Fichier exporté avec succès pour Mixamo : {output_path}")
