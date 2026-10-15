// ============================================================================
// WEB3 COMBAT GAME — JOURNAL VISUEL CLIENT (bouton 🐞 + modal + copie)
// ============================================================================
// Porté de BattlePool (App 1) — même principe :
//   1. capture window.showToast   (les toasts = événements métier lisibles)
//   2. capture erreurs JS globales (window.onerror / unhandledrejection)
//   3. capture console.log/warn/error/info ([Web3Mobile] [Web3Tx] [App2]…)
// Buffer ring de 300 lignes. Bouton flottant 🐞 → modal plein écran →
// [Copier les logs] (presse-papiers + fallback execCommand) → à coller.
// Aucune dépendance, script vanilla (classique). Activé par défaut (bêta).
// ============================================================================
(function () {
    'use strict';

    var MAX_LINES = 300;
    var _buf = [];

    function _ts() {
        var d = new Date();
        return d.toISOString().slice(11, 23);
    }

    function debugLog(tag, message) {
        var line = _ts() + ' [' + tag + '] ' + message;
        _buf.push(line);
        if (_buf.length > MAX_LINES) _buf.shift();
    }
    window.debugLog = debugLog;

    // ── (1) Toasts : window.showToast est défini par app.js (defer). On l'enveloppe
    //    dès qu'il existe (DOMContentLoaded), et on le ré-enveloppe une fois.
    function wrapToast() {
        if (typeof window.showToast !== 'function' || window.showToast.__debugWrapped) return;
        var orig = window.showToast;
        var wrapped = function (message, type, ms) {
            try { debugLog('TOAST', (type || 'info') + ': ' + message); } catch (e) { /* noop */ }
            return orig.apply(this, arguments);
        };
        wrapped.__debugWrapped = true;
        window.showToast = wrapped;
    }

    // ── (2) Erreurs JS globales
    window.addEventListener('error', function (ev) {
        debugLog('JS-ERR', ev.message + ' @ ' + (ev.filename ? ev.filename.split('/').pop() : '?') + ':' + ev.lineno + ':' + ev.colno);
    }, true);
    window.addEventListener('unhandledrejection', function (ev) {
        var why = '?';
        try { why = (ev.reason && (ev.reason.message || ev.reason.code)) || String(ev.reason); } catch (e) { /* noop */ }
        debugLog('PROMISE', why);
    }, true);

    // ── (3) Console — sérialiseur lisible des Error/objets ethers.
    function _str(a) {
        if (typeof a === 'string') return a;
        if (a instanceof Error || (a && typeof a === 'object' && 'message' in a)) {
            var parts = [a.name && a.name !== 'Error' ? a.name + ': ' : '', a.message || a.shortMessage || ''];
            if (a.code !== undefined) parts.push('code=' + a.code);
            if (a.reason !== undefined) parts.push('reason=' + a.reason);
            if (a.shortMessage && a.shortMessage !== a.message) parts.push('(short: ' + a.shortMessage + ')');
            if (a.data !== undefined) { try { parts.push('data=' + JSON.stringify(a.data)); } catch (e) { /* noop */ } }
            if (a.transaction) { try { parts.push('tx=' + JSON.stringify(a.transaction).slice(0, 200)); } catch (e) { /* noop */ } }
            if (a.info) { try { parts.push('info=' + JSON.stringify(a.info).slice(0, 300)); } catch (e) { /* noop */ } }
            return parts.filter(Boolean).join(' ');
        }
        try { return JSON.stringify(a); } catch (e) { return String(a); }
    }
    ['log', 'warn', 'error', 'info'].forEach(function (lvl) {
        var orig = (console[lvl] || console.log).bind(console);
        console[lvl] = function () {
            try {
                var txt = Array.prototype.map.call(arguments, _str).join(' ');
                debugLog('CONSOLE', txt.slice(0, 300));
            } catch (e) { /* noop */ }
            orig.apply(console, arguments);
        };
    });

    debugLog('BOOT', 'debug-log actif, app=v' + _appVersion() + ', UA=' + navigator.userAgent.slice(0, 120));

    // État du service worker (PWA) : utile pour vérifier le cache des fichiers Godot.
    try {
        debugLog('SW', ('serviceWorker' in navigator)
            ? (navigator.serviceWorker.controller ? 'controller=actif' : 'pas de controller (1er chargement)')
            : 'non supporté');
    } catch (e) { /* noop */ }

    // Version réelle d'app.js, lue dans le DOM (script app.js?v=…) — source unique,
    // pas de doublon à maintenir.
    function _appVersion() {
        try {
            var s = document.querySelector('script[src*="app.js"]');
            if (s) {
                var m = (s.getAttribute('src') || '').match(/[?&]v=([0-9][0-9.]*)/);
                if (m) return m[1];
            }
        } catch (e) { /* noop */ }
        return (typeof window.APP_VERSION !== 'undefined') ? window.APP_VERSION : '?';
    }

    // ── UI : bouton flottant + modal ──────────────────────────────────────────
    function ensureFab() {
        if (document.getElementById('dbg-fab')) return;
        var btn = document.createElement('button');
        btn.id = 'dbg-fab';
        btn.type = 'button';
        btn.textContent = '🐞';
        btn.setAttribute('aria-label', 'Journal de debug');
        btn.style.cssText = [
            'position:fixed',
            'bottom:calc(75px + env(safe-area-inset-bottom))',
            'right:14px',
            'z-index:999999999',
            'width:44px', 'height:44px', 'border-radius:50%',
            'border:2px solid rgba(0,229,255,0.65)',
            'background:rgba(6,24,36,0.92)',
            'color:#aef2ff', 'font-size:20px', 'line-height:1',
            'box-shadow:0 4px 16px rgba(0,0,0,0.55)',
            'pointer-events:auto', 'cursor:pointer',
            'touch-action:manipulation', 'user-select:none', '-webkit-user-select:none',
            '-webkit-tap-highlight-color:transparent'
        ].join(';');
        btn.addEventListener('click', openPanel);
        (document.body || document.documentElement).appendChild(btn);
    }

    function _payload() {
        var wc = (typeof window._bpWcDebug === 'function') ? window._bpWcDebug() : {};
        return [
            'WEB3COMBAT-DEBUG ' + new Date().toISOString(),
            'app v' + _appVersion(),
            'URL ' + location.href,
            'UA ' + navigator.userAgent,
            'WC ' + JSON.stringify(wc),
            'contract ' + (window.CONTRACT_ADDRESS || '?'),
            'chainId ' + ((window.APP_CONFIG && window.APP_CONFIG.CHAIN_ID) || '?'),
            '',
            _buf.join('\n')
        ].join('\n');
    }

    function openPanel() {
        var old = document.getElementById('dbg-panel');
        if (old) { old.remove(); return; }

        var panel = document.createElement('div');
        panel.id = 'dbg-panel';
        panel.style.cssText = 'position:fixed;inset:0;z-index:999999999;background:rgba(2,10,18,0.88);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:12px';

        var card = document.createElement('div');
        card.style.cssText = 'background:#0a1a28;border:1px solid rgba(0,229,255,0.4);border-radius:12px;width:min(760px,96vw);max-height:86vh;display:flex;flex-direction:column;box-shadow:0 12px 48px rgba(0,0,0,0.6)';

        var title = document.createElement('div');
        title.textContent = '🐞 Journal de debug — Web3 Combat Game';
        title.style.cssText = 'padding:12px 16px 6px;font-weight:700;color:#aef2ff;font-size:1rem';

        var info = document.createElement('div');
        info.textContent = 'url=' + location.href + '\nUA=' + navigator.userAgent.slice(0, 100);
        info.style.cssText = 'padding:0 16px 8px;color:#7fd6ef;font-size:0.72rem;white-space:pre-wrap;word-break:break-all';

        var pre = document.createElement('pre');
        pre.textContent = _buf.join('\n') || '(vide)';
        pre.style.cssText = 'flex:1;margin:0 16px;padding:10px;overflow:auto;-webkit-overflow-scrolling:touch;background:#050e17;border:1px solid rgba(0,229,255,0.25);border-radius:8px;color:#cde;font-size:0.68rem;line-height:1.45;white-space:pre-wrap;word-break:break-all';

        var row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:10px;padding:12px 16px';

        var copyBtn = document.createElement('button');
        copyBtn.textContent = '📋 Copier les logs';
        copyBtn.style.cssText = 'flex:1;padding:12px;border-radius:8px;border:none;background:#00b7ff;color:#04121d;font-weight:700;font-size:0.9rem';
        copyBtn.addEventListener('click', function () {
            var payload = _payload();
            function done(msg) {
                copyBtn.textContent = msg;
                setTimeout(function () { copyBtn.textContent = '📋 Copier les logs'; }, 2500);
            }
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(payload).then(function () { done('✅ Copié → colle-le ici'); })
                    .catch(function () { _fallbackCopy(payload, pre, done); });
            } else {
                _fallbackCopy(payload, pre, done);
            }
        });

        var closeBtn = document.createElement('button');
        closeBtn.textContent = '✕ Fermer';
        closeBtn.style.cssText = 'padding:12px 16px;border-radius:8px;border:1px solid rgba(0,229,255,0.5);background:transparent;color:#aef2ff;font-weight:600;font-size:0.9rem';
        closeBtn.addEventListener('click', function () { panel.remove(); });

        row.appendChild(copyBtn);

        // Bouton « Test de débit » : télécharge un petit fichier du VPS (hors
        // cache) et mesure le débit réel → permet de savoir si la lenteur vient
        // de la connexion (Mb/s bas) ou de la taille du jeu.
        var speedBtn = document.createElement('button');
        speedBtn.textContent = '🚀 Débit';
        speedBtn.style.cssText = 'padding:12px 14px;border-radius:8px;border:1px solid rgba(0,229,255,0.5);background:transparent;color:#aef2ff;font-weight:600;font-size:0.9rem';
        speedBtn.addEventListener('click', function () {
            speedBtn.textContent = '…';
            var url = 'speedtest.bin?t=' + Date.now();
            var t0 = performance.now();
            fetch(url, { cache: 'no-store' }).then(function (r) { return r.arrayBuffer(); }).then(function (buf) {
                var dt = Math.max(0.05, (performance.now() - t0) / 1000);
                var MBs = (buf.byteLength / 1048576) / dt;
                var mbps = (buf.byteLength * 8 / 1e6) / dt;
                var eta = MBs > 0 ? Math.round(114 / MBs) : -1;
                debugLog('SPEED', MBs.toFixed(2) + ' Mo/s = ' + mbps.toFixed(1) + ' Mb/s | ' + buf.byteLength + ' octets en ' + dt.toFixed(2) + 's');
                speedBtn.textContent = mbps.toFixed(0) + ' Mb/s';
                window.showToast && window.showToast('Débit ~' + mbps.toFixed(0) + ' Mb/s → jeu (~114 Mo) en ~' + eta + 's', 'info', 8000);
            }).catch(function (e) {
                speedBtn.textContent = '❌ échec';
                debugLog('SPEED', 'échec: ' + e);
            });
        });
        row.appendChild(speedBtn);

        row.appendChild(closeBtn);
        card.appendChild(title);
        card.appendChild(info);
        card.appendChild(pre);
        card.appendChild(row);
        panel.appendChild(card);
        document.body.appendChild(panel);
    }

    function _fallbackCopy(payload, pre, done) {
        var ta = document.createElement('textarea');
        ta.value = payload;
        ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
        document.body.appendChild(ta);
        ta.focus(); ta.select();
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
        ta.remove();
        if (ok) { done('✅ Copié (fallback) → colle-le ici'); return; }
        // Dernier recours (iOS récalcitrant) : sélectionner le texte à la main.
        if (pre) {
            try {
                var range = document.createRange();
                range.selectNodeContents(pre);
                var sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
            } catch (e) { /* noop */ }
        }
        done('⚠️ Appuie longuement → « Tout sélectionner » → Copier');
    }

    window.openDebugLog = openPanel;

    function boot() {
        wrapToast();
        ensureFab();
        // app.js (defer) définit showToast avant DOMContentLoaded : re-tenter un peu
        setTimeout(wrapToast, 500);
        setTimeout(wrapToast, 2000);
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }
})();
