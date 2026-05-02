# ============================================================
# QPro - Script de Backup de BD y Filestore
# ============================================================
# Uso: .\scripts\backup.ps1
#
# Genera dos archivos en Odoo/db_backups/:
#   - qpro_dev_latest.sql       (estructura + datos de PostgreSQL)
#   - filestore_latest.tar.gz   (imágenes y adjuntos del filestore)
#
# DEBE ejecutarse desde la carpeta Odoo/.
# ============================================================

$ErrorActionPreference = "Stop"

# Verifica que estamos en la carpeta correcta
if (-not (Test-Path "docker-compose.yml")) {
    Write-Host "ERROR: este script debe ejecutarse desde la carpeta Odoo/" -ForegroundColor Red
    exit 1
}

# Verifica que los contenedores estén corriendo
$dbStatus = docker compose ps db --format json 2>$null
if (-not $dbStatus) {
    Write-Host "ERROR: el contenedor de BD no está corriendo. Ejecuta primero: docker compose up -d" -ForegroundColor Red
    exit 1
}

# Crear carpeta si no existe
if (-not (Test-Path "db_backups")) {
    New-Item -ItemType Directory -Path "db_backups" | Out-Null
}

Write-Host "==> Generando backup de PostgreSQL..." -ForegroundColor Cyan
docker compose exec -T db pg_dump -U odoo -Fp --clean --if-exists qpro_dev > "db_backups/qpro_dev_latest.sql"

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: pg_dump falló" -ForegroundColor Red
    exit 1
}

$sqlSize = (Get-Item "db_backups/qpro_dev_latest.sql").Length / 1MB
Write-Host "    OK: qpro_dev_latest.sql ($([math]::Round($sqlSize, 2)) MB)" -ForegroundColor Green

Write-Host "==> Generando backup del filestore..." -ForegroundColor Cyan
docker compose exec -T odoo tar -czf /tmp/filestore.tar.gz -C /var/lib/odoo filestore
docker compose cp odoo:/tmp/filestore.tar.gz "db_backups/filestore_latest.tar.gz"
docker compose exec -T odoo rm /tmp/filestore.tar.gz

if (-not (Test-Path "db_backups/filestore_latest.tar.gz")) {
    Write-Host "ERROR: el filestore no se generó" -ForegroundColor Red
    exit 1
}

$fsSize = (Get-Item "db_backups/filestore_latest.tar.gz").Length / 1MB
Write-Host "    OK: filestore_latest.tar.gz ($([math]::Round($fsSize, 2)) MB)" -ForegroundColor Green

Write-Host ""
Write-Host "==> Backup completado." -ForegroundColor Green
Write-Host ""
Write-Host "Próximos pasos:" -ForegroundColor Yellow
Write-Host "  1. Edita 'Odoo/db_backups/README.md' añadiendo una entrada con tu nombre, fecha y resumen de cambios."
Write-Host "  2. git add Odoo/db_backups/"
Write-Host "  3. git commit -m 'backup: <tu nombre> - <descripción>'"
Write-Host "  4. git push"