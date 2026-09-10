/**
 * anim2d.js — Moteur de Combat 2D Dynamique (Light Combat Visualizer)
 * ====================================================================
 * Affiche une animation 2D de combat interactive pendant le chargement
 * du moteur 3D Godot. Une fois Godot prêt, fait la transition en fondu.
 *
 * API publique :
 *  - window.setFighters2D(p1id, p2id)         → personnages en idle
 *  - window.triggerRound2D(winner, p1id, p2id) → déclenche la séquence
 *  - window.toggleAnim2D()                     → affiche/masque
 *  - window.transition2Dto3D()                 → basculer vers Godot 3D
 *  - ?mode2d=1   → mode test 2D infini
 *  - ?delay2d=N  → délai mini avant transition (ms)
 */
(function () {
    'use strict';

    var CHARS = {
        1: { key: 'ninja',  dir: 'anim2d/ninja/',  name: 'Guerrier Ninja' },
        2: { key: 'cyborg', dir: 'anim2d/cyborg/', name: 'Mutant Cyborg'  },
        3: { key: 'tom',    dir: 'anim2d/tom/',    name: 'Tom Frazer'     },
        4: { key: 'choco',  dir: 'anim2d/choco/',  name: 'Big Choco'      }
    };
    var POSES          = ['idle', 'attack', 'hurt', 'victory'];
    var IDLE_PERIOD    = 1800;
    var IDLE_AMPLITUDE = 6;
    var ATTACK_DUR     = 480;
    var HURT_DUR       = 380;
    var CHAR_SCALE     = 0.65;   // hauteur de référence des combattants
    var P1_SCALE_MULT  = 0.88;   // P1 (gauche) légèrement réduit pour équilibrer la scène
    var P2_SCALE_MULT  = 0.95;   // P2 (droite) légèrement augmenté (compense les poses)
    var P1_X_FRAC      = 0.22;
    var P2_X_FRAC      = 0.78;
    // Écartement max entre les combattants : sur écran large, on borne la
    // distance pour que les attaques portent (sinon coups dans le vide).
    var MAX_ARENA_SPREAD = 300;   // offset max depuis le centre, en px
    var MAX_ARENA_SPREAD_FRAC = 0.25; // ou 25% de la largeur, le plus petit des deux
    var EDGE_MARGIN_FRAC = 0.05;  // mobile étroit : sprites collés aux bords à 5%
    function fighterX(side) {
        // side : -1 (P1, gauche) ou +1 (P2, droite)
        // Écran étroit (portrait mobile) : sprites aux bords (5% de marge),
        // façon moteur de jeu — le clamp central les collerait au milieu.
        if (canvas.width <= 600) {
            var m = canvas.width * EDGE_MARGIN_FRAC;
            return (side < 0) ? m : (canvas.width - m);
        }
        var half = Math.min(canvas.width * MAX_ARENA_SPREAD_FRAC, MAX_ARENA_SPREAD);
        return canvas.width / 2 + side * half;
    }
    var FLOOR_Y        = 0.88;
    // Hauteur des combattants : bornée (comme un vrai moteur de jeu).
    // Évite un sprite gigantesque en 4K ou minuscule en fenêtre réduite.
    var CHAR_H_MIN = 150;  // px minimum
    var CHAR_H_MAX = 400;  // px maximum
    function charHeight() {
        var h = canvas.height * CHAR_SCALE * mobileScale();
        return Math.min(Math.max(h, CHAR_H_MIN), CHAR_H_MAX);
    }
    // Mobile portrait : réduit l'échelle pour ne pas recouvrir tout l'écran
    // (instruction + barre de choix visibles en bas, HUD en haut).
    function isMobilePortrait() {
        return window.innerWidth <= 768 && window.innerHeight > window.innerWidth;
    }
    function mobileScale() { return isMobilePortrait() ? 0.52 : 1; }

    var canvas, ctx;
    var isGodotReady  = false;
    var animRunning   = false;
    var sprites       = {};
    var spritesLoaded = false;
    var spritesToLoad = 0;
    var spritesCount  = 0;
    var p1CharId = 1, p2CharId = 4;
    var p1Pose = 'idle', p2Pose = 'idle';
    var combatPhase = null, phaseStart = 0;
    var shakeFrames = 0, shakeMag = 0;
    var showVs = true;

    // ── Priorité au mode Lite : les sprites 2D sont l'asset critique ─────────
    // Préchargement des 16 sprites AVANT Godot (142MB) pour que le mode 2D
    // soit jouable immédiatement, pendant que Godot se télécharge en arrière-plan.
    var spritesReadyFired = false;

    function fireSpritesReady() {
        if (spritesReadyFired) return;
        spritesReadyFired = true;
        try {
            document.dispatchEvent(new CustomEvent('anim2d:ready'));
        } catch (e) { /* env. sans CustomEvent : pas bloquant */ }
    }

    var urlParams  = new URLSearchParams(window.location.search);
    var force2D    = urlParams.has('mode2d') || urlParams.has('test2d');
    var minDelay   = urlParams.has('delay2d') ? parseInt(urlParams.get('delay2d'), 10) : 4000;
    var startMs    = performance.now();

    // ── Préchargement ────────────────────────────────────────────────────────
    // Traitement anti-fond-blanc : les sprites PNG sources ont un fond blanc
    // non transparent qui crée un rectangle disgracieux sur l'arène sombre.
    // On applique, une seule fois par sprite au preload :
    //   1. un flood-fill depuis tous les pixels de bordure (tolérance réglable)
    //      qui rend le fond blanc transparent — les blancs INTÉRIEURS du sprite
    //      (yeux, armes, détails) sont préservés car non connectés au bord ;
    //   2. un recadrage sur la boîte englobante du contenu non transparent
    //      (bounding box) — normalise la hauteur maximale et équilibre la
    //      taille visuelle des deux combattants.
    var BG_TOLERANCE = 235;      // seuil de luminosité considéré comme "fond clair"
    var PROCESSED_W  = 0;        // fallback : 0 = garder la taille source

    function processSprite(img) {
        try {
            var w = img.naturalWidth, h = img.naturalHeight;
            if (!w || !h) return img;
            var c = document.createElement('canvas');
            c.width = w; c.height = h;
            var cx = c.getContext('2d');
            if (!cx) return img;
            cx.drawImage(img, 0, 0);
            var data;
            try { data = cx.getImageData(0, 0, w, h); }
            catch (e) { return img; } // canvas "tainted" ou non supporté : image brute

            var px = data.data;
            var visited = new Uint8Array(w * h);
            var stack = [];
            var x, y, i;

            // Seed : tous les pixels de bordure
            for (x = 0; x < w; x++) { stack.push(x); stack.push(0); stack.push(x); stack.push(h - 1); }
            for (y = 0; y < h; y++) { stack.push(0); stack.push(y); stack.push(w - 1); stack.push(y); }

            while (stack.length) {
                y = stack.pop(); x = stack.pop();
                if (x < 0 || y < 0 || x >= w || y >= h) continue;
                i = y * w + x;
                if (visited[i]) continue;
                visited[i] = 1;
                var o = i * 4;
                var r = px[o], g = px[o + 1], b = px[o + 2], a = px[o + 3];
                // Fond = pixel clair et opaque (blanc cassé inclus)
                if (a === 0 || (a > 200 && r >= BG_TOLERANCE && g >= BG_TOLERANCE && b >= BG_TOLERANCE)) {
                    px[o + 3] = 0; // transparent
                    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
                }
            }

            // Bounding box du contenu restant (alpha > 8)
            var minX = w, minY = h, maxX = -1, maxY = -1;
            for (y = 0; y < h; y++) {
                for (x = 0; x < w; x++) {
                    if (px[(y * w + x) * 4 + 3] > 8) {
                        if (x < minX) minX = x;
                        if (x > maxX) maxX = x;
                        if (y < minY) minY = y;
                        if (y > maxY) maxY = y;
                    }
                }
            }
            if (maxX < 0 || maxY < 0) return img; // sprite vide : image brute

            cx.putImageData(data, 0, 0);
            var bw = maxX - minX + 1, bh = maxY - minY + 1;

            // Recadrage normalisé : le sprite rogné remplit ensuite la hauteur
            // CHAR_SCALE dans drawChar → tailles visuelles équilibrées.
            var out = document.createElement('canvas');
            out.width = bw; out.height = bh;
            out.getContext('2d').drawImage(c, minX, minY, bw, bh, 0, 0, bw, bh);
            return out;
        } catch (e) {
            return img; // tout échec → fallback image brute
        }
    }

    function preloadSprites() {
        var chars = Object.values(CHARS);
        spritesToLoad = chars.length * POSES.length;
        chars.forEach(function (ch) {
            sprites[ch.key] = {};
            POSES.forEach(function (pose) {
                var img = new Image();
                img.src = ch.dir + pose + '.png?v=1';
                img.onload = img.onerror = function () {
                    // Fond blanc rendu transparent + recadrage normalisé.
                    sprites[ch.key][pose] = (img.complete && img.naturalWidth) ? processSprite(img) : img;
                    spritesCount++;
                    if (spritesCount >= spritesToLoad) {
                        spritesLoaded = true;
                        fireSpritesReady(); // signal : assets 2D prêts → Godot peut démarrer
                        if (!animRunning) startLoop();
                    }
                };
                sprites[ch.key][pose] = img;
            });
        });
    }

    // ── Init ─────────────────────────────────────────────────────────────────
    function initAnim2D() {
        canvas = document.getElementById('anim2d-canvas');
        if (!canvas) return;
        ctx = canvas.getContext('2d');
        function resize() { if (canvas) { canvas.width = window.innerWidth; canvas.height = window.innerHeight; } }
        window.addEventListener('resize', resize);
        resize();
        preloadSprites();

        // Phase 1 (Lite) : progression du préchargement des sprites pendant
        // que Godot n'a pas encore démarré (l'évent anim2d:ready le déclenchera).
        var liteTimer = setInterval(function () {
            if (spritesLoaded) {
                clearInterval(liteTimer);
                // État final propre : barre pleine + libellé de bascule
                window.updateAnim2DProgress();
                return;
            }
            window.updateAnim2DProgress(); // phase 1 : % des sprites 2D
        }, 250);
    }

    // ── Boucle ───────────────────────────────────────────────────────────────
    function startLoop() {
        if (animRunning) return;
        animRunning = true;
        requestAnimationFrame(loop);
    }

    function loop(ts) {
        if (isGodotReady) { animRunning = false; return; }
        requestAnimationFrame(loop);
        if (!canvas || !ctx || !spritesLoaded) return;

        updatePhase(ts);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Fond
        var bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
        bg.addColorStop(0, '#0a0c14'); bg.addColorStop(0.6, '#0d1020'); bg.addColorStop(1, '#050709');
        ctx.fillStyle = bg; ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Sol : relevé en mobile portrait pour que les noms cyan sous les
        // sprites ne soient jamais recouverts par l'instruction / la barre
        // de choix (fixée en bas, ~120px de haut avec boutons).
        var floorFrac = isMobilePortrait() ? 0.80 : FLOOR_Y;
        var fy = canvas.height * floorFrac;
        var sg = ctx.createLinearGradient(0, fy, 0, fy + 30);
        sg.addColorStop(0, 'rgba(0,220,255,0.25)'); sg.addColorStop(1, 'rgba(0,220,255,0)');
        ctx.fillStyle = sg; ctx.fillRect(0, fy, canvas.width, 30);

        // Shake
        var sx = 0, sy = 0;
        if (shakeFrames > 0) { sx = (Math.random()-0.5)*shakeMag*2; sy = (Math.random()-0.5)*shakeMag; shakeFrames--; }
        ctx.save(); ctx.translate(sx, sy);

        if (showVs) drawVs(ts);
        drawName(p1CharId, fighterX(-1), fy);
        drawName(p2CharId, fighterX(1), fy);
        drawChar(ts, p1CharId, p1Pose, fighterX(-1), fy, false, P1_SCALE_MULT);
        drawChar(ts, p2CharId, p2Pose, fighterX(1), fy, true, P2_SCALE_MULT);
        ctx.restore();

        // Feedback du coup choisi : badge néon au-dessus de la tête de P1
        // (dessiné DANS le canvas, façon moteur de jeu — reste visible même
        // pendant le bob d'idle). Dessiné hors du translate(shake) pour ne
        // pas trembler avec l'impact.
        if (selectedMove) drawSelectedMoveBadge(ts, fy);

        // HUD DOM : synchronise les pseudos/noms affichés avec les combattants réels.
        // No-op si les éléments n'existent pas (HUD non présent) ou valeurs identiques.
        var hudP1 = document.getElementById('hud-p1-name');
        if (hudP1 && hudP1.textContent !== (CHARS[p1CharId] ? CHARS[p1CharId].name : '')) {
            hudP1.textContent = CHARS[p1CharId] ? CHARS[p1CharId].name : '';
        }
        var hudP2 = document.getElementById('hud-p2-name');
        if (hudP2 && hudP2.textContent !== (CHARS[p2CharId] ? CHARS[p2CharId].name : '')) {
            hudP2.textContent = CHARS[p2CharId] ? CHARS[p2CharId].name : '';
        }
    }

    function drawChar(ts, id, pose, cx, fy, mirror, scaleMult) {
        var ch = CHARS[id]; if (!ch) return;
        var spr = sprites[ch.key] && sprites[ch.key][pose];
        if (!spr || !(spr.complete !== undefined ? spr.complete : true) ||
            !(spr.naturalWidth || spr.width)) {
            spr = sprites[ch.key] && sprites[ch.key]['idle'];
            if (!spr || !(spr.complete !== undefined ? spr.complete : true) ||
                !(spr.naturalWidth || spr.width)) return;
        }
        // Dimensions source : Image (natural*) ou canvas traité (width/height)
        var srcW = spr.naturalWidth || spr.width;
        var srcH = spr.naturalHeight || spr.height;
        var h = charHeight() * (scaleMult || 1);
        var sc = h / srcH;
        var w = srcW * sc;
        var bob = (pose === 'idle') ? Math.sin(ts / IDLE_PERIOD * Math.PI * 2) * IDLE_AMPLITUDE : 0;
        ctx.save(); ctx.translate(cx, fy + bob);
        if (mirror) ctx.scale(-1, 1);
        ctx.drawImage(spr, -w/2, -h, w, h);
        ctx.restore();
    }

    // Badge néon du coup choisi, dessiné au-dessus de la tête de P1.
    // Rect biseauté (équivalent canvas du clip-path cyber) + glow de la
    // couleur du coup, animation popIn sur les 300ms suivant le clic.
    function drawSelectedMoveBadge(ts, fy) {
        var n = selectedMove;
        var color = MOVE_COLORS[n] || '#00E5FF';
        var cx = fighterX(-1);

        // Sommet de la tête : sol - hauteur dessinée de P1 (+ marge)
        var headY = fy - charHeight() * P1_SCALE_MULT - 26;

        // Progression popIn : 0.4 → 1.12 → 1 (écho du CSS popIn)
        var age = ts - selectedMoveAt;
        var t = Math.min(1, age / MOVE_POPIN_MS);
        var scale;
        if (t >= 1) {
            scale = 1;
        } else if (t < 0.7) {
            scale = 0.4 + (1.12 - 0.4) * (t / 0.7);       // montée avec overshoot
        } else {
            scale = 1.12 - 0.12 * ((t - 0.7) / 0.3);      // retombée vers 1
        }

        var size = isMobilePortrait() ? 36 : 44;
        var half = (size / 2) * scale;

        ctx.save();
        ctx.translate(cx, headY);
        ctx.scale(scale, scale);

        // Fond + biseau
        ctx.beginPath();
        ctx.moveTo(-half + 8, -half);
        ctx.lineTo(half, -half);
        ctx.lineTo(half, half - 8);
        ctx.lineTo(half - 8, half);
        ctx.lineTo(-half, half);
        ctx.lineTo(-half, -half + 8);
        ctx.closePath();
        ctx.fillStyle = 'rgba(31,27,46,0.9)';
        ctx.fill();
        // Glow néon de la couleur du coup
        ctx.shadowColor = color;
        ctx.shadowBlur = 15;
        ctx.lineWidth = 2;
        ctx.strokeStyle = color;
        ctx.stroke();

        // Émoji du coup : rendu identique sur tous les OS, indépendant de Lucide
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#FFFFFF';
        ctx.font = Math.round(size * 0.55) + 'px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(MOVE_EMOJI[n] || '', 0, 0);
        ctx.restore();
    }

    function drawName(id, cx, fy) {
        var ch = CHARS[id]; if (!ch) return;
        ctx.save(); ctx.font = 'bold 13px Impact,sans-serif'; ctx.textAlign = 'center';
        ctx.fillStyle = '#00dcff'; ctx.shadowColor = '#00dcff'; ctx.shadowBlur = 8;
        ctx.fillText(ch.name.toUpperCase(), cx, fy + 18); ctx.restore();
    }

    function drawVs(ts) {
        var cx = canvas.width/2, cy = canvas.height * 0.42;
        var p = 0.92 + Math.sin(ts/500) * 0.08;
        ctx.save(); ctx.translate(cx, cy); ctx.scale(p, p);
        ctx.font = 'bold 56px Impact,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowColor = '#00dcff'; ctx.shadowBlur = 30;
        ctx.fillStyle = '#ffffff'; ctx.fillText('VS', 0, 0);
        ctx.shadowBlur = 0; ctx.strokeStyle = '#00dcff'; ctx.lineWidth = 2;
        ctx.strokeText('VS', 0, 0); ctx.restore();
    }

    // ── Phases de combat ─────────────────────────────────────────────────────
    function updatePhase(ts) {
        if (!combatPhase) return;
        var e = ts - phaseStart;

        if (combatPhase === 'p1_attacks') {
            if (e < ATTACK_DUR) { p1Pose='attack'; p2Pose='idle'; }
            else if (e < ATTACK_DUR+HURT_DUR) { p1Pose='idle'; p2Pose='hurt'; if(e-ATTACK_DUR<30) shake(12,8); }
            else setPhase('p2_attacks_back', ts);

        } else if (combatPhase === 'p2_attacks') {
            if (e < ATTACK_DUR) { p2Pose='attack'; p1Pose='idle'; }
            else if (e < ATTACK_DUR+HURT_DUR) { p2Pose='idle'; p1Pose='hurt'; if(e-ATTACK_DUR<30) shake(12,8); }
            else setPhase('p1_attacks_back', ts);

        } else if (combatPhase === 'p1_attacks_back') {
            if (e < ATTACK_DUR) { p1Pose='attack'; p2Pose='idle'; }
            else if (e < ATTACK_DUR+HURT_DUR) { p1Pose='idle'; p2Pose='hurt'; if(e-ATTACK_DUR<30) shake(10,6); }
            else { p1Pose='victory'; p2Pose='hurt'; combatPhase='done'; showVs=false; }

        } else if (combatPhase === 'p2_attacks_back') {
            if (e < ATTACK_DUR) { p2Pose='attack'; p1Pose='idle'; }
            else if (e < ATTACK_DUR+HURT_DUR) { p2Pose='idle'; p1Pose='hurt'; if(e-ATTACK_DUR<30) shake(10,6); }
            else { p2Pose='victory'; p1Pose='hurt'; combatPhase='done'; showVs=false; }
        }
    }

    function setPhase(ph, ts) { combatPhase=ph; phaseStart=ts; }
    function shake(f, m) { shakeFrames=f; shakeMag=m; }

    // ── API Publique ─────────────────────────────────────────────────────────
    window.setFighters2D = function (p1id, p2id) {
        if (p1id && CHARS[p1id]) p1CharId = p1id;
        if (p2id && CHARS[p2id]) p2CharId = p2id;
        p1Pose='idle'; p2Pose='idle'; combatPhase=null; showVs=true;
        if (!animRunning && spritesLoaded) startLoop();
    };

    window.triggerRound2D = function (winner, p1id, p2id) {
        if (p1id && CHARS[p1id]) p1CharId = p1id;
        if (p2id && CHARS[p2id]) p2CharId = p2id;
        showVs=true; combatPhase=null; p1Pose='idle'; p2Pose='idle';
        // Nouveau tour : le feedback du coup précédent est réinitialisé.
        if (typeof window.clearSelectedMove2D === 'function') window.clearSelectedMove2D();
        if (!animRunning && spritesLoaded) startLoop();
        setTimeout(function () {
            showVs = false;
            if (winner === 1) setPhase('p1_attacks', performance.now());
            else if (winner === 2) setPhase('p2_attacks', performance.now());
            else setPhase(Math.random()>0.5?'p1_attacks':'p2_attacks', performance.now());
        }, 800);
    };

    // ── Feedback du coup choisi (Itération 4B) ───────────────────────────────
    // Mapping coup → icône Lucide. NB : "fist" n'existe pas dans le bundle
    // local, on utilise "hand-metal" (poing) pour la Pierre.
    var MOVE_ICONS = { 1: 'hand-metal', 2: 'hand', 3: 'scissors' };
    var MOVE_LABELS = { 1: 'Pierre', 2: 'Feuille', 3: 'Ciseaux' };
    // Couleurs néon par coup (identité visuelle §6 du PRD)
    var MOVE_COLORS = { 1: '#00E5FF', 2: '#7B2CBF', 3: '#FFC700' };
    // Émojis de secours si le SVG n'est pas encore régénéré
    var MOVE_EMOJI = { 1: '✊', 2: '✋', 3: '✌' };
    // État du feedback dessiné DANS le canvas (au-dessus de la tête P1)
    var selectedMove = null;       // 1|2|3 ou null
    var selectedMoveAt = 0;        // performance.now() du choix (anim popIn)
    var MOVE_POPIN_MS = 300;       // durée de l'animation popIn (cohérent CSS)

    window.setSelectedMove2D = function (moveIndex) {
        var badge = document.getElementById('player-selected-move');
        var icon = document.getElementById('selected-move-icon');
        var n = parseInt(moveIndex, 10);
        if (!MOVE_ICONS[n]) return;

        // 0) État canvas : icône néon au-dessus de la tête de P1.
        selectedMove = n;
        selectedMoveAt = performance.now();

        if (badge && icon) {
            // 1) Icône : data-lucide → createIcons() régénère le SVG.
            //    createIcons REMPLACE le <i> par un <svg data-lucide="..."> :
            //    on (ré)insère donc un <i> neuf à chaque fois.
            var newIcon = document.createElement('i');
            newIcon.id = 'selected-move-icon';
            newIcon.setAttribute('data-lucide', MOVE_ICONS[n]);
            newIcon.setAttribute('title', MOVE_LABELS[n]);
            icon.parentNode.replaceChild(newIcon, icon);
            if (window.lucide && typeof lucide.createIcons === 'function') {
                lucide.createIcons();
            }

            // 2) Badge visible + animation popIn (retrigger)
            badge.classList.remove('hidden');
            badge.classList.remove('pop-in');
            void badge.offsetWidth; // reflow pour relancer l'animation
            badge.classList.add('pop-in');
        }

        // 3) Mise en valeur du bouton cliqué dans la barre de choix
        document.querySelectorAll('.anim2d-move-btn.selected').forEach(function (b) {
            b.classList.remove('selected');
        });
        var btn = document.getElementById('btn-move-' + n);
        if (btn) btn.classList.add('selected');
    };

    window.clearSelectedMove2D = function () {
        selectedMove = null;
        selectedMoveAt = 0;
        var badge = document.getElementById('player-selected-move');
        if (badge) badge.classList.add('hidden');
        document.querySelectorAll('.anim2d-move-btn.selected').forEach(function (b) {
            b.classList.remove('selected');
        });
    };

    // Interception passive des clics sur les 3 boutons : n'interfère pas avec
    // window.submitMove2D (app.js), qui reste le contrat de jeu.
    window.showMoveBar2D = window.showMoveBar2D || function (show) {
        var bar = document.getElementById('anim2d-move-bar');
        if (bar) bar.classList.toggle('hidden', !show);
    };
    function hookMoveButtons() {
        [1, 2, 3].forEach(function (n) {
            var btn = document.getElementById('btn-move-' + n);
            if (btn && !btn.dataset.moveHooked) {
                btn.addEventListener('click', function () {
                    window.setSelectedMove2D(n);
                });
                btn.dataset.moveHooked = '1';
            }
        });
    }

    window.transition2Dto3D = function () {
        if (force2D) {
            // Mode test 2D (?mode2d=1) : le HUD de chargement (badge debug
            // "MODE COMBAT 2D (TEST)", spinner, barre de progression) n'a plus
            // d'utilité une fois le combat 2D actif → masqué (pas supprimé du DOM,
            // le contrat anim2d.js sur #anim2d-status-text reste intact).
            var hud = document.getElementById('anim2d-hud');
            if (hud) hud.style.display = 'none';
            return;
        }
        var delay = Math.max(0, minDelay - (performance.now() - startMs));
        setTimeout(function () {
            if (isGodotReady) return;
            isGodotReady = true;
            var layer = document.getElementById('anim2d-layer');
            if (layer) { layer.classList.add('hidden'); setTimeout(function(){layer.style.display='none';},850); }
        }, delay);
    };

    window.toggleAnim2D = function (show) {
        var layer = document.getElementById('anim2d-layer'); if (!layer) return;
        if (show === undefined) show = layer.classList.contains('hidden') || layer.style.display==='none';
        if (show) {
            layer.style.display='flex';
            requestAnimationFrame(function(){layer.classList.remove('hidden');});
            isGodotReady=false; animRunning=false;
            p1Pose='idle'; p2Pose='idle'; combatPhase=null; showVs=true;
            if (spritesLoaded) startLoop();
        } else {
            layer.classList.add('hidden');
            setTimeout(function(){layer.style.display='none';},850);
            isGodotReady=true;
        }
    };

    // ── API Lite : état du préchargement 2D (consommé par index.html) ────────
    window.isSprites2DReady = function () {
        return spritesLoaded;
    };
    window.getSprites2DProgress = function () {
        return spritesToLoad > 0 ? Math.round((spritesCount / spritesToLoad) * 100) : 0;
    };

    // ── API Lite : état du préchargement 2D (consommé par index.html) ────────
    window.isSprites2DReady = function () {
        return spritesLoaded;
    };
    window.getSprites2DProgress = function () {
        return spritesToLoad > 0 ? Math.round((spritesCount / spritesToLoad) * 100) : 0;
    };

    // Progress Lite : le texte du badge affiche d'abord le préchargement 2D
    // (avant le démarrage de Godot), puis bascule sur la progression Godot.
    window.updateAnim2DProgress = function (current, total) {
        var fill = document.getElementById('anim2d-progress-fill');
        var text = document.getElementById('anim2d-status-text');
        var godotActive = (current !== undefined && total !== undefined);
        if (!godotActive) {
            // Phase 1 : progression des sprites 2D uniquement
            if (fill) fill.style.width = getSprites2DProgress() + '%';
            if (text && !force2D) {
                text.innerText = 'PRÉPARATION DU COMBAT 2D (' + getSprites2DProgress() + '%)...';
            }
            return;
        }
        // Phase 2 : Godot se télécharge en arrière-plan (le jeu 2D est déjà jouable)
        if (total > 0 && fill) {
            var pct = Math.min(100, Math.round((current/total)*100));
            fill.style.width = pct + '%';
            if (text && !force2D) text.innerText = 'MOTEUR 3D EN ARRIÈRE-PLAN (' + pct + '%)...';
        }
    };

    // ── Démarrage ────────────────────────────────────────────────────────────
    function initAll() {
        initAnim2D();
        hookMoveButtons();
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAll);
    } else {
        initAll();
    }

})();
