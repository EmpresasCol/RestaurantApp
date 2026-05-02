#!/bin/bash
# QPro - Script de Backup (Mac/Linux)
# Uso: ./scripts/backup.sh

set -e

if [ ! -f "docker-compose.yml" ]; then
    echo "ERROR: este script debe ejecutarse desde la carpeta Odoo/"
    exit 1
fi

mkdir -p db_backups

echo "==> Generando backup de PostgreSQL..."
docker compose exec -T db pg_dump -U odoo -Fp --clean --if-exists qpro_dev > db_backups/qpro_dev_latest.sql
echo "    OK: $(du -h db_backups/qpro_dev_latest.sql | cut -f1)"

echo "==> Generando backup del filestore..."
docker compose exec -T odoo tar -czf /tmp/filestore.tar.gz -C /var/lib/odoo filestore
docker compose cp odoo:/tmp/filestore.tar.gz db_backups/filestore_latest.tar.gz
docker compose exec -T odoo rm /tmp/filestore.tar.gz
echo "    OK: $(du -h db_backups/filestore_latest.tar.gz | cut -f1)"

echo ""
echo "==> Backup completado."
echo ""
echo "Próximos pasos:"
echo "  1. Edita 'db_backups/README.md' con tu entrada de relevo."
echo "  2. git add db_backups/"
echo "  3. git commit -m 'backup: <tu nombre> - <descripción>'"
echo "  4. git push"