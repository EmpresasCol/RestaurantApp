#!/bin/bash
# QPro - Script de Restauración (Mac/Linux)
# Uso: ./scripts/restore.sh

set -e

if [ ! -f "docker-compose.yml" ]; then
    echo "ERROR: este script debe ejecutarse desde la carpeta Odoo/"
    exit 1
fi

if [ ! -f "db_backups/qpro_dev_latest.sql" ]; then
    echo "ERROR: no se encontró db_backups/qpro_dev_latest.sql"
    echo "       Ejecuta: git pull && git lfs pull"
    exit 1
fi

if head -n 1 db_backups/qpro_dev_latest.sql | grep -q "^version https://git-lfs"; then
    echo "ERROR: el archivo SQL es un puntero de Git LFS."
    echo "       Ejecuta: git lfs pull"
    exit 1
fi

echo "ADVERTENCIA: esto va a BORRAR tu BD 'qpro_dev' local."
read -p "¿Continuar? (escribe 'si' para confirmar): " confirm
if [ "$confirm" != "si" ]; then
    echo "Cancelado."
    exit 0
fi

echo "==> Deteniendo Odoo..."
docker compose stop odoo

echo "==> Eliminando sesiones activas..."
docker compose exec -T db psql -U odoo -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'qpro_dev' AND pid <> pg_backend_pid();" > /dev/null

echo "==> Recreando la BD qpro_dev..."
docker compose exec -T db psql -U odoo -d postgres -c "DROP DATABASE IF EXISTS qpro_dev;"
docker compose exec -T db psql -U odoo -d postgres -c "CREATE DATABASE qpro_dev OWNER odoo;"

echo "==> Restaurando el dump SQL..."
cat db_backups/qpro_dev_latest.sql | docker compose exec -T db psql -U odoo -d qpro_dev > /dev/null

echo "==> Restaurando el filestore..."
docker compose cp db_backups/filestore_latest.tar.gz odoo:/tmp/filestore.tar.gz
docker compose exec -T odoo sh -c "rm -rf /var/lib/odoo/filestore && tar -xzf /tmp/filestore.tar.gz -C /var/lib/odoo && rm /tmp/filestore.tar.gz"

echo "==> Reiniciando Odoo..."
docker compose start odoo

echo ""
echo "==> Restauración completada."
echo "    Espera 20 segundos y abre http://localhost:8069"