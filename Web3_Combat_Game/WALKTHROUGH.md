# Architecture Web2.5 Gasless & Trustless

Le projet Web3 Combat Game a subi une transformation majeure pour offrir une expérience utilisateur totalement fluide (sans pop-up MetaMask intempestifs ni frais de gaz à chaque action) tout en préservant la sécurité de l'écosystème blockchain.

## 1. La Clé de Session Locale (Session Key)

Le plus gros point de friction des jeux Web3 est la signature constante de transactions. Nous avons résolu cela avec une approche **Session Key** :
- À la connexion, le Frontend génère une clé privée aléatoire jetable (Session Key) via `ethers.Wallet.createRandom()`.
- L'utilisateur signe **un seul message** avec MetaMask : "J'autorise cette Session Key à agir en mon nom".
- Le Frontend envoie la signature au Backend via `POST /api/auth/session-key`.
- Le Backend vérifie cryptographiquement (ECDSA) que la signature provient bien du portefeuille de l'utilisateur, et enregistre la Session Key.

Désormais, **toutes les requêtes de jeu (Combat, Mouvement, Création de poule) sont signées localement par la Session Key en arrière-plan.** Le Backend accepte ces requêtes sans que MetaMask ne s'ouvre, offrant une expérience 100% sans friction (Gasless).

## 2. Le Backend Laravel (Autorité Absolue)

L'architecture est passée d'un modèle "Blockchain-First" (où le Smart Contract était l'arbitre) à un modèle "Backend-First" :
- **Création & Rejoindre (Poules)** : Le Smart Contract ne gère plus la création des poules. Les poules (publiques ou privées) sont créées et stockées dans la base de données (SQLite/MySQL) de Laravel via les routes `/api/pools`.
- **Matchmaking & Duels Rapides** : Les joueurs se voient sur le Frontend grâce à la Presence Channel de Laravel Reverb. Les défis sont envoyés et acceptés en temps réel (via WebSockets), sans délai de bloc.
- **Combat (Commit/Reveal)** : 
  - Les joueurs n'envoient plus leurs coups sur IPFS ou la Blockchain.
  - Le frontend envoie le `Commit` et le `Reveal` directement à l'API Laravel, signés par la Session Key.
  - Le Backend vérifie les signatures, stocke les hachages en base de données, joue le rôle d'arbitre, résout les matchs, et utilise Reverb pour notifier Godot instantanément. Le jeu 3D peut ainsi déclencher ses animations (Attaque, Parade, Dégâts) **sans aucune latence**.

## 3. L'Escrow Blockchain (Paiement Final Uniquement)

L'aspect Web3 n'est pas abandonné, il est relégué à sa fonction la plus utile : le transfert sécurisé des valeurs.
- La blockchain sert uniquement d'**Escrow** (Coffre-fort).
- Le backend Laravel garde un historique complet des hachages de tous les coups joués dans la base de données.
- À la fin d'une poule, au lieu que la blockchain doive vérifier tous les mouvements, c'est le Backend qui calcule les gains et génère une **Signature de Retrait (Claim Signature)**.
- Le vainqueur soumet cette signature au Smart Contract pour retirer son prix, garantissant un système **Trustless** en cas de litige.

> [!TIP]
> **Résultat :** L'utilisateur profite de la fluidité et de la rapidité d'un jeu classique (zéro frais de gaz pendant la partie, pas de MetaMask) tout en ayant la garantie que les gains (tokens) sont verrouillés et sécurisés par la Blockchain !
