/* ==========================================================================
   BATTLEPOOL — AUDIO FRONTEND (100 % procédural, Web Audio API)
   --------------------------------------------------------------------------
   Zéro fichier MP3/WAV : tous les sons (clic UI, notifications, musique de
   menu) sont SYNTHÉTISÉS par oscillateurs / bruit blanc à l'exécution.
   Musique de menu : séquenceur rythmique (kick/snare/hats + basse + arpège,
   progression Am-F-C-G à 112 BPM) — pas un simple drone statique.

   API exposée sur window.AUDIO_FX :
     AUDIO_FX.unlock()            → débloque l'audio (autoplay policy browser)
     AUDIO_FX.startMenu()         → démarre la musique d'ambiance du menu
     AUDIO_FX.stopMenu()          → arrête la musique du menu
     AUDIO_FX.click()  hover()  success()  info()  error()   → SFX UI
     AUDIO_FX.setSfx(on)  setMusic(on)                        → mute/démute
   ========================================================================== */
(function () {
    "use strict";

    var ctx = null, master = null, sfxGain = null, musicGain = null, filter = null;
    var unlocked = false;
    var menuOscillators = [];   // oscillateurs du pad de menu
    var menuFilter = null;
    var sfxEnabled = true;
    var musicEnabled = true;
    var masterVolume = 0.85;    // 0..1 (niveau global)

    // Applique le volume maître (0..100) avec un fondu court.
    function setVolume(level) {
        var v = Number(level);
        if (isNaN(v)) return;
        v = Math.max(0, Math.min(100, v)) / 100;
        masterVolume = v;
        if (!ctx || !master) return;
        var t = ctx.currentTime;
        master.gain.cancelScheduledValues(t);
        master.gain.setValueAtTime(master.gain.value, t);
        master.gain.linearRampToValueAtTime(v, t + 0.15);
    }
    function getVolume() { return Math.round(masterVolume * 100); }

    function ensure() {
        if (ctx) return true;
        try {
            var AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return false;
            ctx = new AC();
            master = ctx.createGain();    master.gain.value = 0.85;
            master.connect(ctx.destination);
            sfxGain = ctx.createGain();   sfxGain.gain.value = 0.55;
            sfxGain.connect(master);
            musicGain = ctx.createGain(); musicGain.gain.value = 0.0;
            musicGain.connect(master);
            return true;
        } catch (e) { ctx = null; return false; }
    }

    // Autorise l'audio après une interaction (politique d'autoplay)
    function unlock() {
        if (!ensure()) return;
        if (ctx.state === 'suspended') { ctx.resume().catch(function () {}); }
        unlocked = true;
    }

    /* --------------------------- SFX (one-shot) --------------------------- */
    function tone(freq, dur, vol, type, glideTo) {
        if (!ctx || !sfxEnabled) return;
        var t0 = ctx.currentTime + 0.001;
        var osc = ctx.createOscillator(), g = ctx.createGain();
        osc.type = type || 'sine';
        osc.frequency.setValueAtTime(freq, t0);
        if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(vol, t0 + 0.006);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(g); g.connect(sfxGain);
        osc.start(t0); osc.stop(t0 + dur + 0.03);
    }

    function noise(dur, vol, hp) {
        if (!ctx || !sfxEnabled) return;
        var t0 = ctx.currentTime + 0.001;
        var n = Math.floor(ctx.sampleRate * dur);
        var buf = ctx.createBuffer(1, n, ctx.sampleRate);
        var d = buf.getChannelData(0);
        for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
        var src = ctx.createBufferSource(); src.buffer = buf;
        var g = ctx.createGain(); g.gain.value = vol;
        var f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp || 600;
        src.connect(f); f.connect(g); g.connect(sfxGain);
        src.start(t0);
    }

    var sfx = {
        click:   function () { tone(1500, 0.05, 0.04, 'square'); },
        hover:   function () { tone(1900, 0.03, 0.025, 'sine'); },
        success: function () { tone(660, 0.15, 0.14, 'sine', 990); },
        info:    function () { tone(880, 0.12, 0.10, 'sine'); },
        error:   function () { tone(200, 0.25, 0.14, 'sawtooth'); noise(0.12, 0.08, 900); }
    };

    /* --------------------------- MUSIQUE DE MENU --------------------------- */
    // Séquenceur rythmique 100% procédural (remplace l'ancien drone statique
    // perçu comme un bourdonnement monotone) :
    //   - Batterie : kick / snare / hi-hats (bruit + oscillateurs)
    //   - Basse : ligne rythmée sur progression Am - F - C - G (1 mesure chacune)
    //   - Arpège : pluck aigu synchronisé qui donne le côté "néon arcade"
    // Tempo 112 BPM, boucle de 4 mesures schedulée avec lookahead (précision
    // d'horloge Web Audio, pas de setTimeout approximatif).
    var BPM = 112;
    var SEC_PER_BEAT = 60 / BPM;
    var BAR_SEC = SEC_PER_BEAT * 4;          // 4 temps par mesure
    var LOOP_BARS = 4;                        // Am F C G
    var lookahead = 0.12;                     // fenêtre de schedul (s)
    var scheduleInterval = 40;                // ms entre deux passes de schedul
    var seqTimer = null;
    var nextNoteTime = 0;                     // horloge audio du prochain 1/8 note
    var step = 0;                             // index 1/8 note dans la boucle (64 steps)
    var STEPS_PER_BAR = 8;                    // croches

    // Progression : chaque mesure = accord (racine en Hz) + tierce + quinte
    // A2=110, F2=87.31, C3=130.81, G2=98
    var CHORDS = [
        { root: 110.00, third: 130.81, fifth: 164.81 },  // Am : A2 C3 E3
        { root:  87.31, third: 110.00, fifth: 130.81 },  // F  : F2 A2 C3
        { root: 130.81, third: 164.81, fifth: 196.00 },  // C  : C3 E3 G3
        { root:  98.00, third: 130.81, fifth: 146.83 }   // G  : G2 C3(? non: B2=123.47) D3
    ];
    // Correction G : G2=98, B2=123.47, D3=146.83
    CHORDS[3] = { root: 98.00, third: 123.47, fifth: 146.83 };

    // Motif basse par mesure (8 croches) : 1=note racine, 0=silence, 2=quinte,
    // 3=octave. Style électro syncopé.
    var BASS_PATTERN = [1, 0, 1, 1, 0, 1, 0, 2];
    // Motif arpège : index de note dans [root, third, fifth, octave] par croche
    var ARP_PATTERN  = [0, 2, 1, 3, 0, 2, 1, 2];

    function freqFor(chord, idx) {
        var base = idx === 0 ? chord.root : idx === 1 ? chord.third : idx === 2 ? chord.fifth : chord.root * 2;
        return base;
    }

    function scheduleKick(t) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(150, t);
        o.frequency.exponentialRampToValueAtTime(45, t + 0.11);
        g.gain.setValueAtTime(0.9, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        o.connect(g); g.connect(musicGain);
        o.start(t); o.stop(t + 0.25);
    }

    function scheduleSnare(t) {
        var n = Math.floor(ctx.sampleRate * 0.15);
        var buf = ctx.createBuffer(1, n, ctx.sampleRate);
        var d = buf.getChannelData(0);
        for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.2);
        var src = ctx.createBufferSource(); src.buffer = buf;
        var f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1800;
        var g = ctx.createGain(); g.gain.setValueAtTime(0.35, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
        src.connect(f); f.connect(g); g.connect(musicGain);
        src.start(t);
    }

    function scheduleHat(t, open) {
        var dur = open ? 0.18 : 0.05;
        var n = Math.floor(ctx.sampleRate * dur);
        var buf = ctx.createBuffer(1, n, ctx.sampleRate);
        var d = buf.getChannelData(0);
        for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, open ? 1.5 : 3);
        var src = ctx.createBufferSource(); src.buffer = buf;
        var f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7500;
        var g = ctx.createGain(); g.gain.setValueAtTime(open ? 0.12 : 0.16, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        src.connect(f); f.connect(g); g.connect(musicGain);
        src.start(t);
    }

    function scheduleBass(t, freq, dur) {
        var o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
        o.type = 'square';
        o.frequency.value = freq;
        f.type = 'lowpass'; f.frequency.setValueAtTime(700, t);
        f.frequency.exponentialRampToValueAtTime(220, t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.22, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(f); f.connect(g); g.connect(musicGain);
        o.start(t); o.stop(t + dur + 0.05);
    }

    function schedulePluck(t, freq, vol) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
        o.connect(g); g.connect(musicGain);
        o.start(t); o.stop(t + 0.2);
    }

    // Planifie la croche n° step à l'instant t (horloge Web Audio)
    function scheduleStep(t) {
        var bar = Math.floor(step / STEPS_PER_BAR) % LOOP_BARS;
        var s = step % STEPS_PER_BAR;
        var chord = CHORDS[bar];

        // Batterie : kick temps 1 et 3 (steps 0/4), snare 2 et 4 (steps 2/6),
        // hats sur toutes les croches (ouvert sur la dernière de la mesure).
        if (s === 0 || s === 4) scheduleKick(t);
        if (s === 2 || s === 6) scheduleSnare(t);
        scheduleHat(t, s === 7);

        // Basse : motif syncopé
        var b = BASS_PATTERN[s];
        if (b) scheduleBass(t, b === 1 ? chord.root : b === 2 ? chord.fifth : chord.root * 2, SEC_PER_BEAT * 0.45);

        // Arpège : pluck sur les contretemps (donne le mouvement)
        if (s % 2 === 1) {
            var idx = ARP_PATTERN[s];
            schedulePluck(t, freqFor(chord, idx) * 2, 0.07);
        }
    }

    function schedulerTick() {
        while (nextNoteTime < ctx.currentTime + lookahead) {
            scheduleStep(nextNoteTime);
            nextNoteTime += SEC_PER_BEAT / 2;   // croche
            step = (step + 1) % (STEPS_PER_BAR * LOOP_BARS);
        }
    }

    function buildMenu() {
        // Plus d'oscillateurs continus : tout est schedulé par le séquenceur.
        // Rien à construire ici, la fonction est conservée pour compat.
    }

    function startMenu() {
        if (!ensure() || !musicEnabled) return;
        unlock();
        if (seqTimer) return;   // déjà en cours
        nextNoteTime = ctx.currentTime + 0.1;
        step = 0;
        schedulerTick();
        seqTimer = setInterval(schedulerTick, scheduleInterval);
        var t = ctx.currentTime;
        musicGain.gain.cancelScheduledValues(t);
        musicGain.gain.setValueAtTime(musicGain.gain.value, t);
        musicGain.gain.linearRampToValueAtTime(0.5, t + 1.2);   // fondu d'entrée
    }

    function stopMenu() {
        var t = ctx.currentTime;
        musicGain.gain.cancelScheduledValues(t);
        musicGain.gain.setValueAtTime(musicGain.gain.value, t);
        musicGain.gain.linearRampToValueAtTime(0.0, t + 0.4);   // fondu de sortie
        if (seqTimer) { clearInterval(seqTimer); seqTimer = null; }
        if (menuOscillators.length) {
            menuOscillators.forEach(function (o) { try { o.stop(); } catch (e) {} });
            menuOscillators = [];
        }
        if (menuFilter) { try { menuFilter.disconnect(); } catch (e) {} menuFilter = null; }
    }

    /* ------------------------------- API ------------------------------- */
    window.AUDIO_FX = {
        unlock: unlock,
        start: startMenu,
        stopMenu: stopMenu,
        click:    function () { unlock(); sfx.click(); },
        hover:    function () { if (unlocked) sfx.hover(); },
        success:  function () { if (unlocked) sfx.success(); },
        info:     function () { if (unlocked) sfx.info(); },
        error:    function () { if (unlocked) sfx.error(); },
        setSfxEnabled: function (on) { sfxEnabled = !!on; },
        setMusicEnabled: function (on) {
            musicEnabled = !!on;
            if (musicEnabled) startMenu(); else stopMenu();
        },
        setVolume: setVolume,
        getVolume: getVolume
    };
})();