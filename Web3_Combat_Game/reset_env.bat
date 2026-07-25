@echo off
echo.
echo ========================================================
echo   REINITIALISATION COMPLETE DE L'ENVIRONNEMENT DE TEST
echo ========================================================
echo.

echo [1/4] Arret de tous les conteneurs et suppression des volumes (purge de la BDD et blockchain)...
docker-compose down -v
echo.

echo [2/4] Demarrage de la blockchain et deploiment automatique du contrat...
docker-compose up -d blockchain
echo.

echo [3/4] Attente de 15 secondes pour le deploiment du contrat...
timeout /t 15 /nobreak
echo.

echo [4/4] Demarrage des autres services (API, Reverb, Indexeur, Frontend)...
docker-compose up -d
echo.

echo ========================================================
echo Le systeme a ete completement reinitialise avec succes !
echo.
echo ATTENTION : La base de donnees et le serveur WebSocket (Reverb)
echo prennent encore environ 15 a 20 secondes pour demarrer.
echo Veuillez patienter avant d'ouvrir http://localhost:8080.
echo ========================================================
pause
