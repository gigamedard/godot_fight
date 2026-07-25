# Script pour réinitialiser complètement l'environnement de test
# - Purge la base de données
# - Purge la blockchain et redéploie le contrat
# - Redémarre l'API, Reverb et l'Indexeur avec les paramètres d'origine

Write-Host "Arrêt de tous les conteneurs et suppression des volumes (purge de la BDD et blockchain)..." -ForegroundColor Yellow
docker-compose down -v

Write-Host "Recompilation et démarrage de la blockchain en premier..." -ForegroundColor Yellow
docker-compose build blockchain
docker-compose up -d blockchain

Write-Host "Attente de l'initialisation de la blockchain et du déploiement du contrat (15 secondes)..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

Write-Host "Recompilation et démarrage des autres services (API, Reverb, Indexeur, Frontend)..." -ForegroundColor Yellow
docker-compose build indexer api
docker-compose up -d

Write-Host "--------------------------------------------------------" -ForegroundColor Green
Write-Host "Le système a été complètement réinitialisé avec succès !" -ForegroundColor Green
Write-Host "Attention : La base de données et le serveur WebSocket (Reverb) " -ForegroundColor Cyan
Write-Host "prennent encore environ 15 à 20 secondes pour démarrer." -ForegroundColor Cyan
Write-Host "Veuillez patienter avant d'ouvrir http://localhost:8080." -ForegroundColor Cyan
Write-Host "--------------------------------------------------------" -ForegroundColor Green
