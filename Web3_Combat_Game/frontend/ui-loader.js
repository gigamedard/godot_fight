// ============================================================================
// WEB3 COMBAT GAME — UI LOADER
//  1. Badge de progression du moteur 3D (wasm+pck), TOUJOURS visible tant que
//     le 3D n'est pas prêt — y compris sous l'overlay langue/connexion.
//  2. Loader plein écran pour toute opération > 1 s (connexion wallet,
//     signature de clé de session, validation d'une tx on-chain, claim…).
// API globale : showEngine3D / setEngine3DProgress / hideEngine3D /
//               showLoader / hideLoader.  Aucune dépendance.
// ============================================================================
(function () {
    'use strict';

    function host() { return document.body || document.documentElement; }

    function _styleOnce() {
        if (document.getElementById('ui-loader-style')) return;
        var st = document.createElement('style');
        st.id = 'ui-loader-style';
        st.textContent = '@keyframes uilsp{to{transform:rotate(360deg)}}';
        document.head.appendChild(st);
    }

    // ── 1. Badge progression moteur 3D ───────────────────────────────────────
    function ensureBadge() {
        var b = document.getElementById('engine3d-badge');
        if (b) return b;
        _styleOnce();
        b = document.createElement('div');
        b.id = 'engine3d-badge';
        b.style.cssText = [
            'position:fixed',
            'top:calc(8px + env(safe-area-inset-top))',
            'right:8px', 'z-index:150',
            'display:none', 'align-items:center', 'gap:8px',
            'padding:6px 10px', 'border-radius:10px',
            'background:rgba(6,24,36,0.92)', 'border:1px solid rgba(0,229,255,0.45)',
            'color:#aef2ff', 'font:600 12px/1.2 Rajdhani,system-ui,sans-serif',
            'max-width:66vw', 'box-shadow:0 4px 16px rgba(0,0,0,0.5)',
            'pointer-events:none'
        ].join(';');
        b.innerHTML =
            '<span style="flex:0 0 auto;width:14px;height:14px;border:2px solid rgba(0,229,255,0.35);border-top-color:#00E5FF;border-radius:50%;animation:uilsp 0.9s linear infinite"></span>' +
            '<span id="engine3d-text" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Préparation du moteur 3D…</span>' +
            '<span id="engine3d-pct" style="flex:0 0 auto;min-width:34px;text-align:right">0%</span>';
        host().appendChild(b);
        return b;
    }
    window.showEngine3D = function (label) {
        var b = ensureBadge();
        b.style.display = 'flex';
        if (label) document.getElementById('engine3d-text').textContent = label;
    };
    window.hideEngine3D = function () {
        var b = document.getElementById('engine3d-badge');
        if (b) b.style.display = 'none';
    };
    window.setEngine3DProgress = function (pct, label) {
        var b = ensureBadge();
        b.style.display = 'flex';
        if (label) document.getElementById('engine3d-text').textContent = label;
        var pctEl = document.getElementById('engine3d-pct');
        if (typeof pct === 'number' && isFinite(pct)) {
            pctEl.textContent = Math.max(0, Math.min(100, Math.round(pct))) + '%';
        } else {
            pctEl.textContent = '…'; // taux inconnu : indéterminé (spinner déjà animé)
        }
    };

    // ── 2. Loader plein écran (opérations > 1 s) ─────────────────────────────
    function ensureOverlay() {
        var o = document.getElementById('app-loader');
        if (o) return o;
        _styleOnce();
        o = document.createElement('div');
        o.id = 'app-loader';
        o.style.cssText = 'position:fixed;inset:0;z-index:160;display:none;align-items:center;justify-content:center;background:rgba(2,10,18,0.72);backdrop-filter:blur(2px)';
        o.innerHTML =
            '<div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:20px 24px;border-radius:14px;background:#0a1a28;border:1px solid rgba(0,229,255,0.4);box-shadow:0 12px 48px rgba(0,0,0,0.6)">' +
            '<span style="width:34px;height:34px;border:3px solid rgba(0,229,255,0.3);border-top-color:#00E5FF;border-radius:50%;animation:uilsp 0.9s linear infinite"></span>' +
            '<span id="app-loader-text" style="color:#aef2ff;font:600 14px Rajdhani,system-ui,sans-serif;text-align:center;max-width:72vw">Chargement…</span>' +
            '</div>';
        host().appendChild(o);
        return o;
    }
    window.showLoader = function (text) {
        var o = ensureOverlay();
        if (text) document.getElementById('app-loader-text').textContent = text;
        o.style.display = 'flex';
    };
    window.hideLoader = function () {
        var o = document.getElementById('app-loader');
        if (o) o.style.display = 'none';
    };

    // Sûreté : si un loader reste bloqué > 60 s (échec silencieux), on le retire.
    var _loaderGuard = null;
    var _origShowLoader = window.showLoader;
    window.showLoader = function (text) {
        _origShowLoader(text);
        if (_loaderGuard) clearTimeout(_loaderGuard);
        _loaderGuard = setTimeout(function () { window.hideLoader(); }, 60000);
    };
    var _origHideLoader = window.hideLoader;
    window.hideLoader = function () {
        if (_loaderGuard) { clearTimeout(_loaderGuard); _loaderGuard = null; }
        _origHideLoader();
    };

    // Affiche le badge 3D au démarrage (sauf appareil faible qui ne lancera pas Godot).
    function _weak() {
        try {
            var m = navigator.deviceMemory, c = navigator.hardwareConcurrency;
            return (m && m > 0 && m <= 2) || (c && c > 0 && c <= 2);
        } catch (e) { return false; }
    }
    window.addEventListener('load', function () {
        if (!_weak()) window.showEngine3D('Préparation du moteur 3D…');
    });
})();
