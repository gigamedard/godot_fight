// Point d'entrée du bundle : expose la couche wallet sur window.App2Wallet.
// web3-core.js est un module ESM (export …) ; on l'agrège sous un namespace
// global, consommé par app.js (front statique, sans bundler au runtime).
import * as App2Wallet from './web3-core.js';

window.App2Wallet = App2Wallet;
