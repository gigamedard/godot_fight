// ============================================================================
// WEB3 COMBAT GAME — Service Worker (PWA)
// Portée : "/" (racine, origine App2). Objectif : servir depuis le cache, sans
// réseau, tous les assets d'App2 après la 1ʳᵉ visite — y compris les images/2D
// (qui n'étaient couverts que par le cache HTTP auparavant).
//
// Stratégies :
//   - cache-first  : /godot/* + assets statiques (images, sprites, libs, css,
//                    js versionnés ?v=, polices, json d'app).
//   - network-first: HTML (index) + config.js (fraîcheur), repli cache hors-ligne.
//   - JAMAIS intercepté : /api/* (Laravel), /app/* (Reverb), cross-origin
//                    (RPC Pingala, WalletConnect), /sw.js (maj SW), /speedtest.bin.
//
// IMPORTANT : tout nouveau jeu.pck/wasm ou changement d'asset versionné →
// incrémenter CACHE (les fichiers à ?v= se renouvellent tout seuls).
// ============================================================================
const CACHE = 'w3c-app2-20261016-11';
const GODOT_PRECACHE = ['/godot/jeu.js', '/godot/jeu.wasm', '/godot/jeu.pck'];

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
    e.waitUntil(self.clients.claim());
    // Pré-cache des fichiers Godot : après le 1er chargement ils sont déjà dans
    // le cache HTTP du navigateur → fetch quasi gratuit (304) ; on remplit le
    // cache du SW pour que les chargements SUIVANTS n'aient plus besoin du réseau.
    e.waitUntil((async () => {
        try {
            const cache = await caches.open(CACHE);
            for (const url of GODOT_PRECACHE) {
                try {
                    const res = await fetch(url, { cache: 'no-cache' });
                    if (res && res.ok) await cache.put(url, res.clone());
                } catch (err) { /* ignore: retenté au prochain chargement */ }
            }
        } catch (err) { /* ignore */ }
    })());
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    let url;
    try { url = new URL(req.url); } catch (e) { return; }

    // Cross-origin (RPC Pingala, WalletConnect, CDN…) : laissé au réseau/CORS.
    if (url.origin !== self.location.origin) return;

    const p = url.pathname;

    // Ne jamais intercepter :
    if (p.startsWith('/api/') || p.startsWith('/app/')) return;   // API Laravel + Reverb
    if (p === '/sw.js') return;                                   // maj du SW (navigateur)
    if (p.endsWith('/speedtest.bin')) return;                    // test de débit = réseau

    // Fraîcheur : HTML + config.js (network-first, repli cache hors-ligne).
    const networkFirst = (p === '/' || p.endsWith('.html') || p === '/config.js' || p === '/manifest.json');
    if (networkFirst) {
        event.respondWith((async () => {
            try {
                const res = await fetch(req);
                if (res && res.ok && res.type === 'basic') {
                    const c = await caches.open(CACHE);
                    c.put(req, res.clone());
                }
                return res;
            } catch (err) {
                const c = await caches.open(CACHE);
                const hit = await c.match(req, { ignoreSearch: true });
                if (hit) return hit;
                throw err;
            }
        })());
        return;
    }

    // Cache-first : assets Godot + assets statiques d'App2.
    const cacheablePrefix =
        p.startsWith('/godot/') || p.startsWith('/anim2d/') ||
        p.startsWith('/characters/') || p.startsWith('/bg/') ||
        p.startsWith('/pwa_icon');
    const cacheableExt = /\.(png|jpe?g|gif|svg|webp|ico|woff2?|ttf|otf|css|js|json|wasm|pck)$/i.test(p);
    if (!cacheablePrefix && !cacheableExt) return; // le reste : cache HTTP normal

    event.respondWith((async () => {
        const c = await caches.open(CACHE);
        const hit = await c.match(req, { ignoreSearch: true });
        if (hit) return hit;
        const res = await fetch(req);
        if (res && res.ok && res.type === 'basic') c.put(req, res.clone());
        return res;
    })());
});
