# PROMPT AGENT UX/UI — Web3 Combat Game
**Version :** 3.0 — Itérations 1-8 intégrées
**À lire en premier :** le document joint **`docs/UX_PRD.md`** (version 3.0) puis
**`docs/PROJECT_MEMORY.md`** (état réel, décisions, bugs résolus, pièges).
Ce sont tes sources de vérité : architecture en couches, écrans, composants,
identité visuelle, contrats DOM/JS et interdits. Lis-les ENTIÈREMENT avant de continuer.

---

## §1. Contexte minimal

Tu interviens sur le front-end d'un jeu de combat web multijoueur en HTML/CSS/JS vanilla.
Le front est déjà **fonctionnel** : ton travail est d'améliorer l'interface (agencement,
styles, animations, lisibilité), pas de reconstruire. Le projet s'intègre dans un écosystème
plus large dans lequel existe une app hôte ; le détail n'est pas nécessaire à ton travail.

## §2. Fichiers que tu peux lire et modifier

| Fichier | Droits |
|---|---|
| `frontend/index.html` | Lire + modifier |
| `frontend/style.css` | Lire + modifier |
| `frontend/app.js` | Lire (couches UI) + modifier **avec prudence** |
| `frontend/anim2d.js`, `frontend/audio.js` | Lire + modifier avec prudence |
| `docs/UX_PRD.md` | Lire (référence) |
| `frontend/config.js` | **Consulter sans modifier** |

## §3. Interdits absolus (besoin de savoir)

- **Ne PAS ouvrir :** `hardhat_keys.js`, `backend/`, `blockchain/`, `indexer/`, scripts
  serveur, `docker-compose.yml`, `frontend_e2e_tests/`.
- **Ne PAS modifier** `config.js` (consultable si indispensable, jamais édité).
- **Ne mentionner, n'utiliser ni ne dépendre d'** : adresses de contrat, clés, secrets,
  comptes, ports autres que 8080.
- **Ne PAS** introduire framework, bundler, build step. La stack est du vanilla, elle le reste.
- **JAMAIS de commit** : aucun `git add`, aucun `git commit`, aucun push. Tes modifications
  restent sur le disque ; l'utilisateur décidera du commit.

## §4. Préserver les fonctions existantes (contrats DOM/JS)

Tout ce que le PRD liste (§5 du PRD) et PROJECT_MEMORY.md (§5) sont des **contrats** :
identifiants, classes dynamiques (`.rematch-banner`), `onclick` inline,
`window.submitMove2D`, `connectWallet()`, modales, toasts, timer, crossfade des fonds,
**et les nouveaux** : `#combat-hud-layer` (z15), `#player-selected-move`,
`.move-bar-instruction`, `.move-rock/.move-paper/.move-scissors`, le boot Godot
différé (`anim2d:ready`), le switch `LAUNCH_GAME_BEFORE_DEPOSIT_CONFIRM`.
Tu peux restyler, déplacer visuellement, animer. Tu ne dois **jamais** :

- renommer ou supprimer un `id` / une `class` référencé(e) par app.js ou anim2d.js ;
- débrancher un `onclick` inline ou un callback `window.*` ;
- casser le flux de connexion : **clic** sur « CONNECTER LE WALLET » en flux autonome ;
  auto-connexion **uniquement** en entrée portail `?mode=…&wallet=…` ou e2e `?player=N` ;
- changer la chaîne z-index du PRD §3 (Godot 0 → toasts 200 ; HUD combat = 15,
  sous timer 20 et barre 2D 21) ;
- réintroduire un `engine.startGame()` immédiat au `window.load` (casserait le
  Mode Lite : le boot est différé sur `anim2d:ready` + garde 15s + protection
  appareils faibles — voir PROJECT_MEMORY §3) ;
- supprimer la **double section « 18 »** de style.css ni la section §22 — la
  numérotation est non continue, ne pas « réorganiser » les titres de sections ;
- utiliser l'icône Lucide `fist` (inexistante dans le bundle local — Pierre =
  `hand-metal`) ;
- toucher au switch `LAUNCH_GAME_BEFORE_DEPOSIT_CONFIRM` sans validation
  (Option 1 = combat immédiat + dépôt arrière-plan ; Option 2 = séquentiel).

Si une restructuration DOM semble nécessaire, pose la question AVANT (cf. §5).

### Exemples concrets (autorisé vs interdit)

| Action | Statut |
|---|---|
| Restyler `#screen-mode` (espacements, hover, animations d'entrée) | ✅ Autorisé |
| Ajouter une classe CSS nouvelle (ex. `.card-glow`) dans style.css | ✅ Autorisé |
| Modifier les styles de `.rematch-banner` (classe dynamique créée par app.js ~l.1795) | ✅ Autorisé |
| Renommer `#character-grid` en `#char-grid` | ❌ Interdit (casse renderCharacterSelect, app.js ~l.770) |
| Supprimer les `onclick="window.submitMove2D(1|2|3)"` des boutons 2D | ❌ Interdit (casse la barre de coups) |
| Rendre la connexion wallet automatique au chargement en flux autonome | ❌ Interdit (casse le flux : clic l.124 / auto-connexion portail uniquement) |
| Passer `.anim2d-move-bar` au-dessus des modales | ❌ Interdit (z-index 21 < 100, ordre voulu) |
| Fusionner les deux sections n°18 de style.css ou renuméroter les sections | ❌ Interdit (numérotation non continue assumée) |

## §5. OBLIGATION : poser des questions AVANT de coder

C'est le cœur de ce prompt. **Avant toute modification de code**, tu dois poser
**entre 3 et 10 questions** précises, dans ta première réponse, couvrant au minimum :

1. périmètre de l'itération : quels écran(s) prioriser ;
2. cible visuelle : fidèle à l'existant (§6 du PRD) ou évolution souhaitée ;
3. tolérance aux changements du DOM statique (déplacer des blocs dans index.html) ;
4. gestion des états vides/erreurs/chargement à traiter en priorité ;
5. contraintes d'accessibilité ou responsive à respecter ;
6. éléments formellement intouchables au-delà du PRD.

Règle de démarrage : **tu ne commences à coder qu'après avoir reçu des réponses, ou après
avoir déclaré explicitement « j'ai suffisamment de contexte, je commence ».** Si tu codes
sans avoir posé de questions ni déclaré ce state, tu as échoué au prompt.

### Gabarit de question (format attendu)

> **Q1.** [Écran/composant concerné] — [question précise, fermée de préférence]
> Options : (a) …, (b) …. Défaut si pas de réponse : ….

Chaque question doit être répondable en une ligne par l'utilisateur. Les questions
génériques (« veux-tu une belle UI ? ») ne comptent pas dans le quota 3-10.

## §6. Workflow obligatoire (dans l'ordre)

1. **Lire le PRD joint + PROJECT_MEMORY.md**, puis le code UI réel : `index.html`,
   `style.css` (~1584 lignes), `app.js` (**~2387 lignes** — naviguer par grep, ne pas
   le lire linéairement), `anim2d.js` (~537 lignes).
2. **Poser 3 à 10 questions** (cf. §5) et attendre les réponses — ou déclarer
   « j'ai suffisamment de contexte, je commence ».
3. **Itérer écran par écran** : un écran = une itération, un lot de modifications cohérent.
   Ordre recommandé (du plus visible au plus sensible) : `screen-connect` → `screen-mode`
   → `screen-character` → `screen-main` → `screen-br` → `screen-pool-room` → `screen-spirit`
   → `screen-combat` → `screen-splash`/`screen-language` ; composants transverses
   (toasts, modales, timer, barre 2D, HUD combat) à la demande de l'utilisateur.
4. **Valider le JS** : `node --check <fichier modifié>` après chaque lot
   (+ chargement sandbox vm pour anim2d.js si le moteur est touché).
5. **Bump des cache-busters :** d'abord **re-vérifier les `?v=` réels sur disque** en
   ouvrant index.html (les docs peuvent dater ; valeurs à l'écriture du PRD v3.0 :
   `app.js?v=4.5`, `style.css?v=4.0`, `anim2d.js?v=9`, `config.js?v=6`,
   `godot/jeu.js?v=3`), puis incrémenter UNIQUEMENT le(s) fichier(s) réellement modifié(s).
6. **Test :** `http://localhost:8080` UNIQUEMENT (jamais `127.0.0.1`), Ctrl+F5 (rechargement
   dur), console F12 exempte d'erreurs. Couche 2D : `?mode2d=1`.
7. **Tests automatisés** (Puppeteer, dossier `test/`) :
   `node test/infra-check.js`, `node test/puppeteer-lite-test.js`,
   `node test/puppeteer-e2e-match.js` — à exécuter en fin d'itération si le
   mode 2D/le flux de match a été touché.
8. **Supervision environnement (facultatif, inoffensif) :** `docker compose ps` est
   acceptable si tu veux vérifier que l'environnement tourne ; ne va pas plus loin.
   ⚠️ après tout edit BACKEND : `docker restart web3_combat_api` obligatoire
   (OPcache sans revalidation, voir PROJECT_MEMORY §7.1).
9. **Checklist non-régression** après chaque itération :
   - les 10 écrans s'affichent et se naviguent ;
   - connexion wallet au clic (flux autonome) fonctionne ;
   - modales (QR, pari, création salon, défi 3 boutons) s'ouvrent et se ferment ;
   - toasts s'affichent au-dessus de tout ;
   - timer visible pendant combat, barre de choix 2D sous les modales (`?mode2d=1`) ;
   - crossfade des fonds et masquage en combat intact ;
   - badge joueur (balance injectée dynamiquement) intact ;
   - HUD combat visible (écran combat/`?mode2d=1`), badge du coup choisi
     s'affiche/masque, classe `.selected` sur les boutons de coup ;
   - Mode Lite : sprites 2D chargés avant Godot (console `[Lite] Assets 2D prêts`) ;
   - `node --check` OK, console F12 propre.
10. **Jamais de commit.** À la fin, tu résumes ce qui a changé et où.

## §7. Format de livraison attendu

Pour chaque itération, réponds selon ce gabarit :

```
### Itération N — [écran ou composant]
Fichiers modifiés : index.html (…), style.css (§…), app.js (fonction …)
Cache-busters : vérifiés sur disque → app.js?v=X.Y, style.css?v=Z (bumpés : oui/non, lesquels)
node --check : OK / échec (détail)
Checklist §6.9 : [x] … [ ] … (avec observations F12)
Tests Puppeteer : infra-check / lite-test / e2e-match (si pertinents, avec scores)
Questions restantes : … ou « contexte suffisant, j'ai commencé »
Commit : AUCUN (modifications sur disque uniquement)
```

## §8. Definition of Done — une itération n'est « terminée » que si TOUT est vrai

- [ ] Modifications effectivement écrites sur le disque (pas seulement décrites).
- [ ] `node --check` OK sur chaque fichier JS modifié.
- [ ] Cache-busters re-vérifiés sur disque et bumpés pour les fichiers réellement modifiés.
- [ ] Ctrl+F5 effectué, console F12 sans erreur, sur `http://localhost:8080`.
- [ ] Checklist de non-régression §6.9 entièrement cochée.
- [ ] Aucun fichier hors front-end touché, aucun commit, aucun secret manipulé.
- [ ] Résumé livré selon le gabarit §7.
- [ ] PROJECT_MEMORY.md mis à jour si une décision/structure a changé.

---

*Ce prompt v3.0 corrige et remplace toute consigne antérieure. En cas de doute entre ce
prompt, le PRD, PROJECT_MEMORY et le code réel sur disque : le code réel gagne, puis le
PRD, puis PROJECT_MEMORY, puis ce prompt — et tu signales l'écart dans ta réponse.*