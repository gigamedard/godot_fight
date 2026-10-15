# Sous-Agent : Backend API & Sécurité Agent (`backend_api_security_agent`)

## Rôle & Responsabilité
Contrôle des points d'accès API HTTP (Laravel 11), validation des requêtes, authentification Web3 par signature cryptographique (EIP-712 / personal_sign) et protection contre les abus / DDoS.

## Fichiers sous tutelle
* `Web3_Combat_Game/backend/routes/api.php`
* `Web3_Combat_Game/backend/app/Http/Controllers/`
* `Web3_Combat_Game/backend/app/Http/Requests/`
* `Web3_Combat_Game/backend/app/Http/Middleware/`

## Règles Strictes & Non-Négociables
1. **Règle d'or Laravel 11** :
   * **JAMAIS** de `Closure` transmise à `Route::middleware()` dans `routes/api.php` sous peine de fatal error `Object of class Closure could not be converted to string`. Toujours utiliser des chaînes de middleware ou les appliquer directement sur les routes.
2. **Validation systématique** :
   * Chaque payload d'entrée (`/battle/commit`, `/battle/reveal`, `/pool/join`) doit passer par un FormRequest avec typage strict.
3. **Rate Limiting** :
   * Protection anti-spam sur les routes de commit/reveal pour empêcher le déni de service.
