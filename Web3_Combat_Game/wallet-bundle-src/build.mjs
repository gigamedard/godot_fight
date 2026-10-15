// Bundle IIFE de la couche wallet pour le front statique App 2.
// Entrée : entry.js (importe web3-core.js). Sortie : ../web3.iife.js
// Committé dans le repo (comme ethers.min.js / echo.iife.js). Pas de CDN.
import { build } from 'esbuild';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

await build({
    entryPoints: [path.join(__dirname, 'entry.js')],
    bundle: true,
    format: 'iife',
    outfile: path.join(__dirname, '..', 'frontend', 'web3.iife.js'),
    platform: 'browser',
    target: ['es2020'],
    minify: true,
    sourcemap: false,
    legalComments: 'none',
    // AppKit / WalletConnect s'attendent à un environnement de prod.
    define: { 'process.env.NODE_ENV': '"production"' },
    // Shims navigateur : certaines libs référencent `process`/`global` sans garde.
    banner: {
        js: 'var global=typeof global!=="undefined"?global:window;'
          + 'var process=typeof process!=="undefined"?process:{env:{NODE_ENV:"production"}};'
    },
    logLevel: 'info',
});

console.log('[build] frontend/web3.iife.js écrit.');
