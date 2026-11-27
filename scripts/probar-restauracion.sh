#!/usr/bin/env bash
# Prueba de restauración: carga un respaldo en un MySQL desechable (contenedor aparte, sin tocar
# la base real) y comprueba que las tablas clave existan y traigan datos.
#
#   scripts/probar-restauracion.sh respaldos/qpro-restaurantebd-20261126T020000Z.sql.gz
#
# Sale con código distinto de 0 si el archivo no cuadra con su .sha256, si la carga falla o si
# falta alguna tabla. Anota la fecha y el resultado: un respaldo que nunca se restauró no cuenta.
set -euo pipefail

archivo="${1:?Uso: $0 <respaldo.sql.gz>}"
[[ -f "$archivo" ]] || { echo "No existe $archivo" >&2; exit 1; }

if [[ -f "$archivo.sha256" ]]; then
  sha256sum --quiet -c "$archivo.sha256" || { echo "El archivo no coincide con su suma SHA-256." >&2; exit 1; }
fi

nombre="qpro-restauracion-$$"
clave="$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9')"
trap 'docker rm -f "$nombre" >/dev/null 2>&1 || true' EXIT

docker run -d --name "$nombre" -e MYSQL_ROOT_PASSWORD="$clave" -e MYSQL_DATABASE=restaurantebd mysql:8.0 >/dev/null
echo "Esperando el MySQL de prueba..."
# El arranque levanta primero un servidor temporal (sin red, "port: 0") y luego el definitivo:
# se espera a este último para no cargar el respaldo en uno que se va a apagar.
listo=0
for _ in $(seq 1 90); do
  if docker logs "$nombre" 2>&1 | grep -q 'ready for connections.*port: 3306'; then listo=1; break; fi
  sleep 2
done
[[ $listo -eq 1 ]] || { echo "El MySQL de prueba no arrancó." >&2; exit 1; }

inicio=$(date +%s)
gzip -dc "$archivo" | docker exec -i -e MYSQL_PWD="$clave" "$nombre" mysql -uroot --default-character-set=utf8mb4 restaurantebd
echo "Carga terminada en $(( $(date +%s) - inicio )) s."

falla=0
for tabla in Usuarios Mesas Platillos Pedidos PedidoDetalles Pagos Facturas ProductosInventario Stock; do
  filas=$(docker exec -e MYSQL_PWD="$clave" "$nombre" mysql -uroot -N -B restaurantebd \
    -e "SELECT COUNT(*) FROM \`$tabla\`" 2>/dev/null) || { echo "FALTA la tabla $tabla"; falla=1; continue; }
  printf '  %-22s %s filas\n' "$tabla" "$filas"
done

admins=$(docker exec -e MYSQL_PWD="$clave" "$nombre" mysql -uroot -N -B restaurantebd \
  -e "SELECT COUNT(*) FROM Usuarios WHERE Rol='Administrador' AND Activo=1" 2>/dev/null || echo 0)
[[ "$admins" -ge 1 ]] || { echo "No quedó ningún administrador activo: nadie podría entrar."; falla=1; }

if [[ $falla -eq 0 ]]; then
  echo "Restauración correcta ($(date -u +%Y-%m-%dT%H:%MZ))."
else
  echo "La restauración NO es usable." >&2
  exit 1
fi
