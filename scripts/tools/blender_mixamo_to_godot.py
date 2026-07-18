import bpy
import sys
import os
import glob

# Paramètre attendu via args
prefix = ""
for i, arg in enumerate(sys.argv):
    if arg == "--prefix" and i + 1 < len(sys.argv):
        prefix = sys.argv[i + 1]

if not prefix:
    print("Erreur : --prefix invalide ou manquant.")
    sys.exit(1)

# Dossiers
mixamo_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../assets/models/mixamo_raw"))
output_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../assets/models"))

# Trouver tous les fichiers du préfixe
fbx_files = glob.glob(os.path.join(mixamo_dir, f"{prefix}_*.fbx"))

if not fbx_files:
    print(f"Aucun fichier trouvé pour le préfixe {prefix} dans {mixamo_dir}")
    sys.exit(1)

def clear_scene_and_data():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    # Vider la mémoire pour éviter l'accumulation catastrophique d'animations
    for action in bpy.data.actions:
        bpy.data.actions.remove(action)
    for mesh in bpy.data.meshes:
        bpy.data.meshes.remove(mesh)

for fbx in fbx_files:
    clear_scene_and_data()
    
    # Importer
    bpy.ops.import_scene.fbx(filepath=fbx)
    
    # Exporter en GLB
    glb_name = os.path.splitext(os.path.basename(fbx))[0] + ".glb"
    glb_path = os.path.join(output_dir, glb_name)
    
    bpy.ops.export_scene.gltf(filepath=glb_path, export_format='GLB')
    print(f"Converti: {glb_path}")

print("Toutes les conversions GLB sont terminées avec succès.")
