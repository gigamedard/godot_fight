# Projet : Godot Web3 Combat Game
**Document de Handover (Passation)**
**Date de dernière mise à jour** : 16 Juillet 2026

## 1. Description Générale
Ce projet est un jeu de combat 3D hybride utilisant **Godot 4** pour le moteur de jeu, intégré dans un portail web **Vanilla JS** et propulsé par une API **Laravel** pour la gestion des combats et l'authentification Web3 (Wallet).

## 2. Architecture du Répertoire
- `/` (Racine) : Contient le projet Godot 4 (fichiers `.tscn`, `project.godot`, `assets/`, `scripts/`).
- `/scripts/main.gd` : Script principal gérant la machine à états des animations, la logique de combat, la caméra dynamique, et l'écran de sélection de personnages.
- `/scripts/tools/` : Scripts Python/Blender pour automatiser le nettoyage des modèles 3D et l'extraction de textures (pipeline Mixamo).
- `/Web3_Combat_Game/` : Le dossier de l'infrastructure web.
  - `/docker-compose.yml` : Définit les services `db` (MySQL), `api` (PHP/Laravel) et `frontend` (Nginx).
  - `/frontend/` : Interface Vanilla JS (`index.html`, `style.css`, `app.js`). Prêt à accueillir l'export WebAssembly de Godot. L'objet `window.gameConfig` sert de pont JSBridge avec Godot.
  - `/backend/` : Dossier destiné à recevoir le projet vierge Laravel (qui sera généré automatiquement par le conteneur `api`).

## 3. L'Usine à Personnages & Outils (MCP)
Un protocole d'intégration de personnage très strict a été mis en place pour éviter le cumul d'animations et les conflits de squelettes. Les scripts se trouvent dans `/scripts/tools/`.
- **Serveurs MCP** : Le projet repose fortement sur les serveurs MCP **Blender** et **Godot**. L'agent IA DOIT utiliser ces serveurs (via `call_mcp_tool`) pour exécuter les scripts Python Blender en mode headless et interagir avec le moteur Godot.
- **Modèles actuels intégrés** : Guerrier Ninja (p1), Mutant Cyborg (p2), Tom Frazer (p3), Big Choco (p4).
- Les modèles finaux sont dans `assets/models/` en format `.glb` avec leurs textures séparées (ex: `p3_0.png`) appliquées dynamiquement dans `main.gd` via le dictionnaire `roster`.

## 4. Statut Actuel et Bloquants
- **Le Moteur Godot** : Fonctionnel en local. Les combats se lancent, l'écran de sélection marche, les cinématiques sont fluides.
- **Le Serveur Web / Docker** : 
  - Docker Desktop vient d'être démarré. 
  - La commande `docker compose up -d` a échoué au premier essai car Docker n'était pas encore allumé. Il faut la relancer.
  - L'image de l'API est programmée pour installer Laravel d'elle-même dans `/backend/` au démarrage.
- **Graphify** : Une tentative d'extraction de graphe de connaissance a été annulée. Un fichier `.graphifyignore` a été créé pour filtrer les assets 3D si besoin de relancer.

## 5. Prochaines Étapes (À FAIRE)
1. **Lancer Docker** : S'assurer que Docker Desktop est prêt et exécuter `docker compose up -d` dans `Web3_Combat_Game/`.
2. **Configurer les CORS Laravel** : Une fois Laravel généré par le conteneur, aller dans `Web3_Combat_Game/backend/config/cors.php` et autoriser `http://localhost:8080`.
3. **Export WebAssembly** : Exporter le projet Godot pour le Web, déposer les fichiers résultants dans `Web3_Combat_Game/frontend/`, et relier le lancement de l'instance Godot au bouton "Lancer le Jeu" dans `app.js`.
4. **Logique Web3** : Implémenter l'authentification (Metamask ou autre) dans l'API Laravel et la relier aux appels `fetch` du frontend.
