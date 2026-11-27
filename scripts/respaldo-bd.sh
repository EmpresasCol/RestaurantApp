#!/usr/bin/env bash
# Respaldo lógico de la base de Qpro (MySQL local, Docker o TiDB Cloud) en un .sql.gz con su
# suma SHA-256. Usa el mysqldump instalado o, si no hay, el de la imagen mysql:8.0.
#
# Variables (la clave va por entorno, nunca por argumento: así no queda en el historial ni en `ps`):
#   DB_HOST       servidor (por defecto 127.0.0.1)
#   DB_PORT       puerto (por defecto 3307, el del docker-compose)
#   DB_USER       usuario (por defecto restaurant_user)
#   DB_NAME       base (por defecto restaurantebd)
#   MYSQL_PWD     clave del usuario
#   DB_SSL        REQUIRED para TiDB Cloud u otro servidor remoto (por defecto PREFERRED)
#   DESTINO       carpeta de salida (por defecto ./respaldos)
#   RETENER_DIAS  borra respaldos más viejos que esto (por defecto 14; 0 = no borrar)
#   RED_DOCKER    red del contenedor de mysqldump cuando no está instalado (por defecto host).
#                 Con el docker-compose sin exponer el puerto:
#                 DB_HOST=restaurant-db DB_PORT=3306 RED_DOCKER=restaurant-network
#
# Ejemplo TiDB:
#   DB_HOST=gateway01.us-east-1.prod.aws.tidbcloud.com DB_PORT=4000 DB_USER=xxxx.root \
#   DB_SSL=REQUIRED MYSQL_PWD='...' scripts/respaldo-bd.sh
#
# Una copia en este mismo servidor no protege de un ransomware ni de perder la máquina: sube el
# archivo a un almacenamiento aparte (otra cuenta en la nube, disco desconectado) y prueba la
# restauración con scripts/probar-restauracion.sh al menos una vez al mes.
set -euo pipefail

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3307}"
DB_USER="${DB_USER:-restaurant_user}"
DB_NAME="${DB_NAME:-restaurantebd}"
DB_SSL="${DB_SSL:-PREFERRED}"
DESTINO="${DESTINO:-./respaldos}"
RETENER_DIAS="${RETENER_DIAS:-14}"

if [[ -z "${MYSQL_PWD:-}" ]]; then
  echo "Falta MYSQL_PWD con la clave de ${DB_USER}." >&2
  exit 1
fi

mkdir -p "$DESTINO"
archivo="$DESTINO/qpro-${DB_NAME}-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"

# --single-transaction: copia consistente sin bloquear el servicio (InnoDB/TiDB).
# --set-gtid-purged y --column-statistics: compatibilidad con TiDB y servidores administrados.
opciones=(--host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" --ssl-mode="$DB_SSL"
  --single-transaction --quick --routines --triggers --no-tablespaces
  --set-gtid-purged=OFF --column-statistics=0 --default-character-set=utf8mb4 "$DB_NAME")

if command -v mysqldump >/dev/null 2>&1; then
  mysqldump "${opciones[@]}" | gzip -9 > "$archivo"
else
  # 127.0.0.1 dentro del contenedor no es este equipo: por defecto se usa la red del host.
  docker run --rm -i --network "${RED_DOCKER:-host}" -e MYSQL_PWD mysql:8.0 mysqldump "${opciones[@]}" | gzip -9 > "$archivo"
fi

# Un volcado que no terminó no trae la marca final de mysqldump: se descarta.
if ! gzip -dc "$archivo" | tail -n 1 | grep -q '^-- Dump completed'; then
  rm -f "$archivo"
  echo "El respaldo quedó incompleto y se borró." >&2
  exit 1
fi

sha256sum "$archivo" > "$archivo.sha256"
echo "Respaldo listo: $archivo ($(du -h "$archivo" | cut -f1))"

if [[ "$RETENER_DIAS" -gt 0 ]]; then
  find "$DESTINO" -name 'qpro-*.sql.gz*' -type f -mtime +"$RETENER_DIAS" -print -delete
fi
