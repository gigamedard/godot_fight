// ============================================================================
// WEB3 COMBAT GAME — Service Worker (PWA)
// Portée : "/" (racine). Rôle : mettre en cache les GROS fichiers du moteur
// Godot (/godot/* : jeu.pck, jeu.wasm, jeu.js…) pour un chargement instantané
// et un fonctionnement hors-ligne partiel.
// Ne touche PAS : /api/* (Laravel), /app/* (Reverb WSS), ni le cross-origin
// (RPC Pingala, WalletConnect) — laissés au réseau.
// IMPORTANT : à chaque nouveau jeu.pck/wasm, incrémenter CACHE (cache-first).
// ============================================================================
const CACHE = 'w3c-godot-20261015-2';
const GODOT_PRECACHE = ['/godot/jeu.js', '/godot/jeu.wasm', '/godot/jeu.pck'];

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
    e.waitUntil(self.clients.claim());
    // Pré-cache des fichiers Godot : après le 1er chargement, ils sont déjà dans
    // le cache HTTP du navigateur → ce fetch est quasi gratuit (revalidation 304)
    // et remplit le cache du SW. Ainsi les chargements SUIVANTS (2e+) sont servis
    // par le SW sans aucun réseau → plus de « rechargement à 100 % » dans l'iframe.
    e.waitUntil((async () => {
        try {
            const cache = await caches.open(CACHE);
            for (const url of GODOT_PRECACHE) {
                try {
                    const res = await fetch(url, { cache: 'no-cache' });
                    if (res && res.ok) await cache.put(url, res.clone());
                } catch (err) { /* ignore: fichier indisponible → tenté au prochain chargement */ }
            }
        } catch (err) { /* ignore */ }
    })());
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    let url;
    try { url = new URL(req.url); } catch (e) { return; }
    if (url.origin !== self.location.origin) return;              // cross-origin (RPC/WC)
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/app/')) return; // API + Reverb
    if (!url.pathname.startsWith('/godot/')) return;              // le reste suit le HTTP-cache

    event.respondWith((async () => {
        const cache = await caches.open(CACHE);
        const hit = await cache.match(req, { ignoreSearch: true });
        if (hit) return hit;
        const res = await fetch(req);
        if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
        return res;
    })());
});
