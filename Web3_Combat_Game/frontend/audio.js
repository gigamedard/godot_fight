/* ==========================================================================
   BATTLEPOOL — AUDIO FRONTEND (100 % procédural, Web Audio API)
   --------------------------------------------------------------------------
   Zéro fichier MP3/WAV : tous les sons (clic UI, notifications, musique de
   menu) sont SYNTHÉTISÉS par oscillateurs / bruit blanc à l'exécution.

   API exposée sur window.AUDIO_FX :
     AUDIO_FX.unlock()            → débloque l'audio (autoplay policy browser)
     AUDIO_FX.startMenu()         → démarre la musique d'ambiance du menu (drone)
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
    // Drone néon : 4-5 oscillateurs accords (La mineur) continus + filtre LFO.
    function buildMenu() {
        if (!ctx || menuOscillators.length) return;
        menuFilter = ctx.createBiquadFilter();
        menuFilter.type = 'lowpass';
        menuFilter.frequency.value = 900;
        menuFilter.connect(musicGain);

        var notes = [110.0, 130.81, 164.81, 220.0, 329.63];   // A2 C3 E3 A3 E4
        notes.forEach(function (f) {
            var o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
            var og = ctx.createGain(); og.gain.value = 0.18 / Math.sqrt(f / 110);
            o.connect(og); og.connect(menuFilter);
            o.start();
            menuOscillators.push(o);
        });
    }

    function startMenu() {
        if (!ensure() || !musicEnabled) return;
        unlock();
        if (!menuOscillators.length) buildMenu();
        var t = ctx.currentTime;
        musicGain.gain.cancelScheduledValues(t);
        musicGain.gain.setValueAtTime(musicGain.gain.value, t);
        musicGain.gain.linearRampToValueAtTime(0.16, t + 1.2);   // fondu d'entrée
    }

    function stopMenu() {
        if (!ctx || !menuOscillators.length) return;
        var t = ctx.currentTime;
        musicGain.gain.cancelScheduledValues(t);
        musicGain.gain.setValueAtTime(musicGain.gain.value, t);
        musicGain.gain.linearRampToValueAtTime(0.0, t + 0.4);   // fondu de sortie
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