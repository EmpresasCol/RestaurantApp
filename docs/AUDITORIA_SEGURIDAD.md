# Auditoría de seguridad: 15 pruebas

**Fecha:** 26/11/2026 · **Alcance:** API ASP.NET Core, web React, app Flutter, Docker, historial de Git.
**Método:** revisión del código y, sobre un stack local (MySQL 8 + API + Nginx), cada ataque
ejecutado de verdad. Nada se probó contra producción.

Un punto queda **protegido** solo si el servidor lo bloquea. Lo que se ve en pantalla no cuenta.

## Resultado

| # | Prueba | Categoría | Resultado | Evidencia (stack local) | Prioridad |
|---|--------|-----------|-----------|-------------------------|-----------|
| 7 | Editar el precio | Dinero | Protegido | Pedido con `precio: 1` en el cuerpo → total 25.000 (precio de la base). Cantidades 0, −5 y 1000 → 400. Domicilio público 0, −5 y 101 → 400 (**corregido**: antes no tenía tope). | Alta |
| 8 | Webhook de pago falso | Dinero | No aplica | No hay pasarela ni webhooks: el cobro lo registra la caja autenticada. | — |
| 9 | Cupón en paralelo | Dinero | No aplica / protegido | No hay cupones. Prueba equivalente: 20 cobros simultáneos del mismo pedido → un 200 y 19 × 409. | Alta |
| 1 | Cambiar el ID en la URL | Acceso | Protegido | Mesero `GET /usuarios/1` → 403. Domiciliario pide pedidos de otro → 403. Comensal: seguimiento exige código QR + llave. | Alta |
| 13 | Inyección SQL | Entrada de datos | Protegido | `' OR '1'='1` en login, teléfono, token de seguimiento y código QR → 401/404/400, sin detalles de la base. Todo usa EF Core parametrizado; el único SQL crudo arma `IN (...)` con enteros del servidor. | Alta |
| 2 | Registrarse con `role: admin` | Acceso | Protegido | No hay registro público. `POST /usuarios` sin sesión → 401, con mesero → 403. El domicilio público ignora `rol`/`isAdmin`. | Alta |
| 3 | Entrar a `/admin` | Acceso | Protegido | Rutas de administración sin sesión → 401, con mesero → 403. Swagger apagado en producción. **Corregido:** un cambio de rol ahora quita los permisos al instante (antes duraban hasta 12 h con el token viejo). | Alta |
| 4 | Fuerza bruta | Acceso | **Corregido** | Antes solo había cupo por IP (10/min): desde muchas IP no se agotaba. Ahora 5 claves erradas bloquean la cuenta 15 min (6.º intento → 429, aun con la clave correcta). El PIN de 6 dígitos de la mesa ya tenía tope (15) y rotación. **Hallazgo grave corregido:** la semilla creaba `cliente_qr` con clave `123` y rol Mesero; cualquiera entraba a la app como mesero. | Crítica |
| 5 | API key en el navegador | Secretos | Protegido | El bundle solo lleva `REACT_APP_API_URL`; ninguna llave. La clave de Firebase de `google-services.json` es pública por diseño (ver pendientes). Se apagan los source maps publicados. | Media |
| 6 | `.env` en el historial | Secretos | Protegido | Barrido de todo el historial (`git log -p --all`) por llaves AWS/Google/Stripe/GitHub, claves privadas, JWT y cadenas de conexión: solo placeholders de ejemplo y un falso positivo en un bundle minificado. No hay credenciales que rotar. | Media |
| 11 | Script en el perfil (XSS) | Entrada de datos | Protegido | Cliente llamado `<img src=x onerror=…>` y nota `<script>`: en el panel se ven como texto y no corren. React escapa; las tirillas impresas usan `escapar()`. **Agregado:** CSP en la web y cabeceras en Nginx y API. | Alta |
| 12 | Web shell como foto | Entrada de datos | **Corregido** | Antes bastaba el prefijo `data:image/`. Ahora se validan los bytes reales (JPEG, PNG, WebP, HEIC): PHP declarado como JPEG → 400, SVG → 400. Las fotos viven en la base, se devuelven como JSON y nunca se ejecutan. | Alta |
| 10 | Inyección al chatbot | IA | No aplica | La app no tiene asistente ni llamadas a modelos de IA. | — |
| 14 | Backups sin probar | Impacto | **Corregido en local** | No había respaldos ni prueba de restauración. `scripts/respaldo-bd.sh` + `scripts/probar-restauracion.sh`: respaldo, restauración en un MySQL aparte y rechazo de un archivo alterado, todo probado. Falta en producción (ver pendientes). | Alta |
| 15 | Logs y alertas | Impacto | **Corregido en la API** | No se registraban ingresos ni cambios de rol. Ahora existe la categoría `Qpro.Auditoria` con EventId fijos. Faltan el envío fuera del servidor y las alertas (ver pendientes). | Alta |

## Cambios aplicados

| Commit | Qué arregla |
|--------|-------------|
| `fix(seguridad): bloqueo por cuenta, usuarios técnicos sin login y rol vigente en cada token` | #3, #4 |
| `fix(seguridad): validar el contenido real de las fotos y topes en el domicilio público` | #7, #12 |
| `feat(auditoria): rastro de seguridad con eventos identificables` | #15 |
| `fix(web): política de contenido (CSP) y cabeceras de seguridad en web, Nginx y API` | #11 y el proxy `/api` de Nginx, que faltaba |
| `fix(deps): MySqlConnector 2.6.1, axios 1.21 y react-router 7.18` | Clave de la base expuesta antes de validar TLS (GHSA-473q-m89c-ghf8) |
| `fix(login): avisar el bloqueo por intentos en vez de culpar a la clave` | El usuario bloqueado veía «Credenciales inválidas» |
| `feat(operacion): Docker con mínimo privilegio y respaldos con prueba de restauración` | #14, API sin root, base solo local |

Pruebas: API 321 (antes 309), web 182, app con un caso nuevo de 429 (Flutter no se pudo correr en este equipo).

## Eventos de auditoría

Todos salen en la categoría `Qpro.Auditoria`. Para las alertas, filtra por EventId:

| EventId | Evento | ¿Alerta? |
|---------|--------|----------|
| 9001 | Ingreso correcto (usuario, rol, canal) | No |
| 9002 | Clave errada (usuario, si existe, número de intento) | Si pasan de 20 en 10 min |
| 9003 | Cuenta bloqueada | **Sí, siempre** |
| 9010 | Usuario creado, cambio de rol o clave, activado, desactivado o borrado | **Sí, siempre** |
| 9020 | Escritura del personal (usuario, rol, ruta, estado, IP) | No: es el rastro |
| 9030 | Acceso denegado 401/403/429 | Si pasan de 50 en 10 min |
| 9040 | Usuarios activos con la clave de la semilla, al arrancar | **Sí, siempre** |

Nunca se registran claves ni la query string (SignalR manda ahí el JWT).

## Pendientes (fuera del código)

Ordenados por riesgo. Ninguno se puede resolver desde el repositorio.

1. **Producción, hoy:** correr `migraciones/2026-11-26_usuarios_tecnicos_sin_login.sql` en TiDB y cambiar
   toda clave `123` de la semilla. El `SELECT` final de esa migración lista los usuarios pendientes, y el
   evento 9040 los repite en cada arranque.
2. **Respaldos de TiDB:** activar los respaldos automáticos del plan, guardar una copia semanal con
   `scripts/respaldo-bd.sh` (`DB_SSL=REQUIRED`) en otra cuenta o almacenamiento, y correr
   `scripts/probar-restauracion.sh` una vez al mes, anotando fecha y resultado.
3. **Logs fuera del servidor:** en Render, *Log Streams* hacia un servicio externo (Better Stack, Grafana
   Cloud o Datadog) con alertas por los EventId de la tabla, y un monitor de `/api/health`.
4. **Firebase:** en Google Cloud Console, restringir la llave de `google-services.json` al paquete Android y
   a las APIs de Firebase que usa la app.
5. **App móvil:** el JWT se guarda en `SharedPreferences` (texto plano en el teléfono). Conviene
   `flutter_secure_storage` (Keychain/Keystore). No se cambió porque aquí no se puede compilar ni probar la app.
6. **Dominio propio con HTTPS y HSTS:** la API responde por Render; HSTS debe ir en el dominio definitivo.
7. **Toolchain web:** quedan avisos de `npm audit` en `react-scripts` (webpack-dev-server, svgo...). Solo
   corren al compilar, no se publican. Se eliminan migrando de Create React App a Vite.
8. **Varias instancias de la API:** el bloqueo por cuenta y el tope del PIN viven en la memoria del proceso.
   Con más de una instancia hay que moverlos a la base o a Redis (está marcado en el código).

## Cómo repetir la auditoría

```bash
cp .env.example .env    # completa DB_ROOT_PASSWORD, DB_PASSWORD y JWT_KEY
docker compose up -d --build
```

Luego repite los ataques de la tabla contra `http://localhost:3001/api` y respalda y restaura con:

```bash
DB_HOST=restaurant-db DB_PORT=3306 RED_DOCKER=restaurant-network MYSQL_PWD="$DB_PASSWORD" scripts/respaldo-bd.sh
```

```bash
scripts/probar-restauracion.sh respaldos/<archivo>.sql.gz
```
