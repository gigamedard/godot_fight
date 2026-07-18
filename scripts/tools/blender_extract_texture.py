import bpy
import sys
import os

# Paramètre attendu via args
input_path = ""
for i, arg in enumerate(sys.argv):
    if arg == "--input" and i + 1 < len(sys.argv):
        input_path = sys.argv[i + 1]

if not input_path or not os.path.exists(input_path):
    print("Erreur : --input invalide ou manquant.")
    sys.exit(1)

output_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../assets/models"))

def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for img in bpy.data.images:
        bpy.data.images.remove(img)

clear_scene()

if input_path.lower().endswith('.glb') or input_path.lower().endswith('.gltf'):
    bpy.ops.import_scene.gltf(filepath=input_path)
elif input_path.lower().endswith('.obj'):
    bpy.ops.import_scene.obj(filepath=input_path)
elif input_path.lower().endswith('.fbx'):
    bpy.ops.import_scene.fbx(filepath=input_path)

# Extraire le nom de base, ex: "p3"
prefix = os.path.splitext(os.path.basename(input_path))[0]

saved = 0
for img in bpy.data.images:
    if img.name != 'Render Result' and img.name != 'Viewer Node':
        print(f"Image trouvée : {img.name}")
        img.pack()
        output_path = os.path.join(output_dir, f"{prefix}_{saved}.png")
        img.filepath_raw = output_path
        img.file_format = 'PNG'
        img.save()
        print(f"Texture sauvegardée dans {output_path}")
        saved += 1

if saved == 0:
    print("Aucune image trouvée à extraire !")
else:
    print("Extraction de texture terminée avec succès.")
