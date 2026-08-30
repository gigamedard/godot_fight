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
    var CHAR_SCALE     = 0.65;
    var P1_X_FRAC      = 0.22;
    var P2_X_FRAC      = 0.78;
    var FLOOR_Y        = 0.88;

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

    var urlParams  = new URLSearchParams(window.location.search);
    var force2D    = urlParams.has('mode2d') || urlParams.has('test2d');
    var minDelay   = urlParams.has('delay2d') ? parseInt(urlParams.get('delay2d'), 10) : 4000;
    var startMs    = performance.now();

    // ── Préchargement ────────────────────────────────────────────────────────
    function preloadSprites() {
        var chars = Object.values(CHARS);
        spritesToLoad = chars.length * POSES.length;
        chars.forEach(function (ch) {
            sprites[ch.key] = {};
            POSES.forEach(function (pose) {
                var img = new Image();
                img.src = ch.dir + pose + '.png?v=1';
                img.onload = img.onerror = function () {
                    spritesCount++;
                    if (spritesCount >= spritesToLoad) {
                        spritesLoaded = true;
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

        // Sol
        var fy = canvas.height * FLOOR_Y;
        var sg = ctx.createLinearGradient(0, fy, 0, fy + 30);
        sg.addColorStop(0, 'rgba(0,220,255,0.25)'); sg.addColorStop(1, 'rgba(0,220,255,0)');
        ctx.fillStyle = sg; ctx.fillRect(0, fy, canvas.width, 30);

        // Shake
        var sx = 0, sy = 0;
        if (shakeFrames > 0) { sx = (Math.random()-0.5)*shakeMag*2; sy = (Math.random()-0.5)*shakeMag; shakeFrames--; }
        ctx.save(); ctx.translate(sx, sy);

        if (showVs) drawVs(ts);
        drawName(p1CharId, canvas.width * P1_X_FRAC, fy);
        drawName(p2CharId, canvas.width * P2_X_FRAC, fy);
        drawChar(ts, p1CharId, p1Pose, canvas.width * P1_X_FRAC, fy, false);
        drawChar(ts, p2CharId, p2Pose, canvas.width * P2_X_FRAC, fy, true);
        ctx.restore();
    }

    function drawChar(ts, id, pose, cx, fy, mirror) {
        var ch = CHARS[id]; if (!ch) return;
        var spr = sprites[ch.key] && sprites[ch.key][pose];
        if (!spr || !spr.complete || !spr.naturalWidth) {
            spr = sprites[ch.key] && sprites[ch.key]['idle'];
            if (!spr || !spr.complete || !spr.naturalWidth) return;
        }
        var h = canvas.height * CHAR_SCALE;
        var sc = h / spr.naturalHeight;
        var w = spr.naturalWidth * sc;
        var bob = (pose === 'idle') ? Math.sin(ts / IDLE_PERIOD * Math.PI * 2) * IDLE_AMPLITUDE : 0;
        ctx.save(); ctx.translate(cx, fy + bob);
        if (mirror) ctx.scale(-1, 1);
        ctx.drawImage(spr, -w/2, -h, w, h);
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
        if (!animRunning && spritesLoaded) startLoop();
        setTimeout(function () {
            showVs = false;
            if (winner === 1) setPhase('p1_attacks', performance.now());
            else if (winner === 2) setPhase('p2_attacks', performance.now());
            else setPhase(Math.random()>0.5?'p1_attacks':'p2_attacks', performance.now());
        }, 800);
    };

    window.transition2Dto3D = function () {
        if (force2D) {
            var txt = document.getElementById('anim2d-status-text');
            if (txt) txt.innerText = 'MODE COMBAT 2D (TEST)';
            var sp = document.querySelector('.anim2d-spinner');
            if (sp) sp.style.display = 'none';
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

    window.updateAnim2DProgress = function (current, total) {
        var fill = document.getElementById('anim2d-progress-fill');
        var text = document.getElementById('anim2d-status-text');
        if (total > 0 && fill) {
            var pct = Math.min(100, Math.round((current/total)*100));
            fill.style.width = pct + '%';
            if (text && !force2D) text.innerText = 'CHARGEMENT DU MOTEUR 3D (' + pct + '%)...';
        }
    };

    // ── Démarrage ────────────────────────────────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAnim2D);
    } else {
        initAnim2D();
    }

})();
