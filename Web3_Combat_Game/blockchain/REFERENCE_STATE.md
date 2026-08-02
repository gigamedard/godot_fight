# Référence balances wallet — pour comparaison post-test

Date: 2026-08-02T09:27:13.420Z
Block: 8
Contrat: 0x5FbDB2315678afecb367f032d93F642f64180aa3 (redeployé)
owner: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
treasuryBalances(owner) = 1.25 ETH

## Soldes wallet natifs (avant les tests)

| Joueur | Wallet | ETH natif |
|--------|--------|-----------|
| P0 | 0x15d34A...a2c6a65 | 10009.749769867941760559 |
| P1 | 0x3C44Cd...f4293bc | 9989.749912393957321673 |
| P2 | 0x90F79b...e93b906 | 10000.0 |

userBalances (duels) = 0 pour les 3.

## Escrow poules
- Pool #1 : total=0, settled=true (E2E précédent)
- Pool #33 : total=0, settled=true (test précédent : 3 dépôts, champion a retiré 20)

## Points d'attention pour l'analyse après test
- Le créateur de poule doit désormais DÉPOSER dans l'escrow (fix confirmCreatePool) -> pot = N x mise.
- Champion doit retirer TOUT le pot en une seule signature -> winners take it all.
- Les éliminés doivent finir à 0.
- treasury doit augmenter de 0.25 x N à chaque poule remplie.