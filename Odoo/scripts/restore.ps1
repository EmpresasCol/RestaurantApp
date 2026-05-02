# ============================================================
# QPro - Script de Restauración de BD y Filestore
# ============================================================
# Uso: .\scripts\restore.ps1
#
# Restaura la BD y el filestore desde db_backups/.
#
# ADVERTENCIA: ESTO BORRA TU BD LOCAL ACTUAL.
# Si tienes cambios sin sincronizar, hazles backup ANTES.
#
# DEBE ejecutarse desde la carpeta Odoo/.
# ============================================================

$ErrorActionPreference = "Stop"

if (-not (Test-Path "docker-compose.yml")) {
    Write-Host "ERROR: este script debe ejecutarse desde la carpeta Odoo/" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path "db_backups/qpro_dev_latest.sql")) {
    Write-Host "ERROR: no se encontró db_backups/qpro_dev_latest.sql" -ForegroundColor Red
    Write-Host "       Asegúrate de haber hecho 'git pull' y de tener Git LFS instalado." -ForegroundColor Red
    exit 1
}

# Verifica que el SQL no sea un puntero LFS sin contenido real
$firstLine = Get-Content "db_backups/qpro_dev_latest.sql" -TotalCount 1
if ($firstLine -match "^version https://git-lfs") {
    Write-Host "ERROR: el archivo SQL es un puntero de Git LFS sin contenido." -ForegroundColor Red
    Write-Host "       Ejecuta: git lfs pull" -ForegroundColor Yellow
    exit 1
}

Write-Host "ADVERTENCIA: esto va a BORRAR tu BD 'qpro_dev' local y restaurar el backup." -ForegroundColor Yellow
$confirm = Read-Host "¿Continuar? (escribe 'si' para confirmar)"
if ($confirm -ne "si") {
    Write-Host "Cancelado." -ForegroundColor Yellow
    exit 0
}

Write-Host "==> Deteniendo Odoo (la BD sigue arriba)..." -ForegroundColor Cyan
docker compose stop odoo

Write-Host "==> Eliminando sesiones activas en qpro_dev..." -ForegroundColor Cyan
docker compose exec -T db psql -U odoo -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'qpro_dev' AND pid <> pg_backend_pid();" | Out-Null

Write-Host "==> Recreando la BD qpro_dev..." -ForegroundColor Cyan
docker compose exec -T db psql -U odoo -d postgres -c "DROP DATABASE IF EXISTS qpro_dev;"
docker compose exec -T db psql -U odoo -d postgres -c "CREATE DATABASE qpro_dev OWNER odoo;"

Write-Host "==> Restaurando el dump SQL..." -ForegroundColor Cyan
Get-Content "db_backups/qpro_dev_latest.sql" | docker compose exec -T db psql -U odoo -d qpro_dev | Out-Null

Write-Host "==> Restaurando el filestore..." -ForegroundColor Cyan
docker compose cp "db_backups/filestore_latest.tar.gz" odoo:/tmp/filestore.tar.gz
docker compose exec -T odoo sh -c "rm -rf /var/lib/odoo/filestore && tar -xzf /tmp/filestore.tar.gz -C /var/lib/odoo && rm /tmp/filestore.tar.gz"

Write-Host "==> Reiniciando Odoo..." -ForegroundColor Cyan
docker compose start odoo

Write-Host ""
Write-Host "==> Restauración completada." -ForegroundColor Green
Write-Host "    Espera 20 segundos y abre http://localhost:8069" -ForegroundColor Yellow