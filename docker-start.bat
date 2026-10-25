@echo off
echo ====================================================
echo   Levantando la infraestructura Docker de RestaurantApp
echo ====================================================
docker compose up -d --build
echo.
echo ====================================================
echo   Estado de los Contenedores:
echo ====================================================
docker compose ps
echo.
echo [WEB]       Frontend: http://localhost:3001
echo [API]       Backend : http://localhost:5000/swagger
echo [HEALTH]    Health  : http://localhost:5000/health
echo [DATABASE]  MySQL   : localhost:3307
echo ====================================================
pause
