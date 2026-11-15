# Handoff Qpro (14/11/2026)

Para retomar el trabajo. Detalle de arquitectura y decisiones en `CONTEXTO_PROYECTO.md`; sistema
visual en `DESIGN.md`. Para ubicar código conviene consultar primero el grafo
(`graphify-out/GRAPH_REPORT.md`, actualizado el 13/11/2026 con todo lo de abajo). Es un artefacto
local fuera de git: en otro equipo hay que regenerarlo.

## Estado en una línea

Llamar al mesero, seguimiento del pedido para el comensal (con Web Push), visitas de mesa con
cierre consistente y tablero de mesas para caja y administración están hechos, probados contra
MySQL 8 y **desplegados en producción** (13/11/2026). Falta probar el push en celulares reales.

## Facturación electrónica (14/11/2026): hecha en local, **sin subir ni desplegar**

Plan completo para vender al primer restaurante: `docs/GUIA_PARA_VENDER_QPRO.md`.

- **Qué hay:** datos fiscales y numeraciones DIAN (pestaña Datos fiscales de Caja, solo administrador), impuesto configurable (INC, IVA o ninguno), cobro que toma el número autorizado y deja el documento en cola en la misma transacción, envío en segundo plano con reintentos idempotentes (`Services/DocumentosDian.cs`), factura a nombre del cliente con dígito de verificación, anulación con motivo (nota de ajuste o nota crédito; reversa la venta o solo corrige el cliente), cierre de caja bloqueado con rechazos por resolver y tirilla con vendedor, resolución, CUDE/CUFE y QR.
- **Va apagada.** Se enciende en Datos fiscales y la API se niega a encenderla mientras no haya proveedor tecnológico conectado (`ProveedorSinConfigurar`). Apagada, todo sigue con el consecutivo interno `FV-`.
- **Lo que falta para que sea válida ante la DIAN:** contratar un proveedor tecnológico (no la competencia directa; uno especializado y habilitado por la DIAN que emita **documento equivalente POS electrónico** por API) y escribir su adaptador: una clase que implemente `IProveedorFacturacion.EnviarAsync` y se registre en `Program.cs` (línea del `ProveedorSinConfigurar`), con las credenciales en variables de entorno. Hoy solo existe `ProveedorSimulado` (`Facturacion__Proveedor=Simulado`, nunca en producción).
- **Regla de rechazos:** un documento rechazado se corrige y se reenvía, o se anula. Anular uno rechazado no emite nota (para la DIAN no existió) y deja de bloquear el cierre; la nota rechazada de una venta validada sí bloquea y se reenvía desde Facturas (`DocumentosDian.PorResolver`).
- **Verificado el 14/11:** API 309/309 y web 178/178; `npm run build` compiló en la sesión anterior. Contra MySQL 8 desechable: 12 cobros simultáneos con consecutivos sin huecos, doble cobro (uno recibe 409), rango agotado sin pago a medias, migración idempotente, anulación de validada y de rechazada, cierre bloqueado y liberado, y dos anulaciones simultáneas con notas distintas. En el navegador: Datos fiscales, Facturas con estado DIAN y anulación con refacturación (validación del NIT incluida).
- **Sin verificar:** impresión real de la tirilla en impresora térmica; la app en celulares reales. `flutter test` (58/58) y `flutter analyze` (sin errores ni advertencias; 16 avisos informativos por `package:flutter/material.dart`, que Flutter 3.50 marca como obsoleto) sí se corrieron el 14/11 con Flutter 3.50 estable, instalado en `C:\src\flutter` y agregado al PATH del usuario.
- **Decisiones que esperan al contador o asesor:** la propina no tiene tope del 10 % en la API (se entendió que el tope de la Ley 1935 aplica a la sugerida); el envío del domicilio entra en la base del impuesto; POS electrónico o factura electrónica para el consumidor final (`DocumentoConsumidorFinal`).
- **Desplegado el 14/11:** el usuario corrió `migraciones/2026-11-14_facturacion_electronica.sql` en TiDB y la rama se subió (`7c323aa..c003cb9`). Comprobado desde fuera: `GET /api/health` 200 y `GET /api/fiscal` 401 sin sesión (la ruta nueva existe). La facturación electrónica sigue **apagada** en producción hasta tener proveedor y numeraciones reales. No se probó un cobro real en producción después del despliegue.
- **Auditoría de seguridad de esta sesión (corregida, con pruebas):** tope de intentos del código de mesa y techo por IP en las rutas del comensal; `POST api/pagos` responde 409 si el pedido ya tiene platos facturados; no se borra un pedido cobrado ni se edita un plato facturado; `PUT api/pedidos/{id}` aplica las reglas por rol.
- **Entorno de verificación:** contenedor `qpro-verif` (MySQL 8, puerto 3399, base `restaurantebd`, desechable). La API local necesita `DOTNET_ROLL_FORWARD=LatestMajor` (el equipo solo tiene el runtime de ASP.NET 10) y `ConnectionStrings__DefaultConnection`; `.claude/launch.json` levanta la web en el 3000.

## Git

- Rama: `RestaurantApp/AppMovil`, subida a `origin` con la facturación electrónica (14/11/2026). Render despliega desde esta rama.
- **`main` no tiene este trabajo**: hace falta un PR de `RestaurantApp/AppMovil` a `main` cuando el equipo lo apruebe.
- En el equipo de trabajo, `migraciones/2026-11-13_ocupaciones_llamadas_push.sql` apareció **vacío** sin commit (algo lo sobrescribió el 13/11 a las 16:57). En git está completo. Restaurarlo con `git checkout -- migraciones/2026-11-13_ocupaciones_llamadas_push.sql` y no commitear la versión vacía.
- Commits: Conventional Commits, cuerpo en español, sin coautor.
- `graphify-out/` y la configuración local del editor se dejan fuera de git a propósito.

## Lo que se hizo (13/11/2026), de más viejo a más nuevo

| Commit | Qué |
| --- | --- |
| `7d1044c` | API: permisos al cambiar pedidos y mesas (nadie deja un pedido Pagado sin caja; una mesa con pedidos no se libera), topes del pedido QR |
| `2d0d593` | API: visitas de mesa (`Ocupaciones`) con llave de seguimiento y código de 6 dígitos, candado por mesa en pedido, cobro y liberación; stock validado con candado. Migración `2026-11-13` |
| `3d728cf` | API: pedidos sin la foto Base64 del platillo en cada consulta |
| `9292cc1` | API: `api/cliente-mesa` (llamar, seguimiento, unirse, Web Push), `api/llamadas`, hub `/api/hubs/mesa` |
| `22df159` | Quitar un `.tgz` de una auditoría vieja |
| `38c4d33` | Web: "Llamar al mesero" y "Tu pedido" en el menú QR, service worker de avisos |
| `17067e6` | API: `DELETE api/usuarios/{id}/fcm-token` (al salir, el celular deja de recibir avisos) |
| `8a32f2d` | App: llamadas de mesa ("Te llaman", Voy / Atendida), push de llamada, token FCM al recuperar sesión y al renovarse |
| `eff5339` | API: `PUT api/mesas/{id}` libera con el candado de la mesa |
| `a125c5c` | Web: tablero de mesas (pestaña "Mesas" de la caja) |
| `defdb9d` | API: montos de los mensajes con punto de miles |
| `40f5354` | API: límite de peticiones por cliente real detrás de Render; hub del comensal con cupo por mesa |
| `4ef2ed6` | DB: la semilla se importa en UTF-8 |
| `37bfdf2` | Web: ajustes vistos en el navegador (etiqueta del botón en 375 px, "1 plato") |
| `2be8c88` | Web: el tiempo real se reconecta solo tras una caída larga |

## Hallazgos corregidos

| Severidad | Hallazgo | Evidencia | Corrección y regresión |
| --- | --- | --- | --- |
| Alta | En Render el límite de login (10/min) y el público (30/min) eran uno solo para todos los usuarios | No había lectura de la IP real: todo llega con la IP del proxy | `CupoPeticiones` toma `CF-Connecting-IP` en Render (no `X-Forwarded-For`, que Render conserva del cliente). `CupoPeticionesTests` |
| Alta | Cualquier mesero o la cocina podía dejar un pedido Pagado por `PUT api/pedidos/{id}`; una mesa con pedidos se liberaba cambiando el estado | Pruebas `AuditoriaSalonTests` | `7d1044c` |
| Alta | Dos pedidos simultáneos por la última porción pasaban los dos; cobro duplicado; mesa libre con un pedido recién creado | Carreras contra MySQL 8 | `2d0d593`; verificado en MySQL (ver Verificación) |
| Media | El token FCM solo se registraba al iniciar sesión: tras renovarse o al recuperar la sesión el push dejaba de llegar; al salir, el celular seguía recibiendo avisos | `auth_provider.dart` | `17067e6`, `8a32f2d`. Pruebas en `AuditoriaSalonTests` y `providers_test.dart` |
| Media | SignalR web se rendía tras ~42 s sin conexión (política por defecto): caja, cocina y comensal quedaban sin tiempo real hasta recargar | `withAutomaticReconnect()` sin política | `reintentoSinFin`. Prueba en `realtime.test.js` |
| Media | `PUT api/mesas/{id}` (admin) liberaba sin el candado de la mesa | Código | `eff5339` |
| Baja | La semilla importada con el MySQL de `docker-compose` dejaba "ClÃ¡sica" | Visto en el contenedor | `SET NAMES utf8mb4` (`4ef2ed6`); verificado en un contenedor nuevo |
| Baja | Mensajes con "25,000 pesos" | Respuesta de la API | `Cuentas.Pesos` (`defdb9d`), `FormatoPesosTests` |

## Verificación (13/11/2026, en este equipo)

- **API:** `dotnet test tests/RestaurantApi.Tests` → 270/270. Este equipo solo tiene el runtime de ASP.NET Core 10: se corrió con `DOTNET_ROLL_FORWARD=Major`. Línea base antes de los cambios del día: 261/261.
- **Web:** `npm test -- --watchAll=false` → 157/157 (línea base 135/135). `npm run build` compila (solo avisos de source maps de `@zxing`, de antes).
- **App:** `flutter test` → 58/58 y `flutter analyze` sin avisos. Flutter no está instalado en este equipo: se corrió en Docker con `ghcr.io/cirruslabs/flutter:stable` (Flutter 3.44), que resolvió algunas dependencias del SDK un poco más viejas que el `pubspec.lock` (pide 3.47). El lock no se cambió. **Repetir con Flutter 3.47.**
- **Recorrido completo contra MySQL 8.0 aislado** (contenedor desechable con `restaurantebd.sql`, API local; nada de producción), 44/44:
  llamada antes de pedir; doble toque concurrente (una sola llamada); dos meseros tomando a la vez (200 y 409 con quién va); caja no toma; atender idempotente; 429 al volver a llamar enseguida;
  pedido QR con llave; pedido del mesero visible al comensal; aviso en vivo por el hub; recibido → en preparación → listo → servido;
  mesero sin permiso para cobrar o marcar pagado; pago parcial que deja la mesa ocupada y 409 al liberarla;
  dos cobros simultáneos (pasa uno) con un pedido QR en la misma carrera (no se pierde ni deja mesa libre con consumo);
  pago total (410 "pagada", mesa libre, sin llamadas vivas, la llave ya no entra al hub);
  mesa reutilizada (la llave vieja solo ve "cerrada"); acceso cruzado entre mesas (404); unirse con el código; cancelación total.
- **Última porción:** 3 carreras de dos pedidos QR por la única porción: pasa uno, el otro recibe 400 y el stock queda en 0,00.
- **Migración `2026-11-13`:** aplicada dos veces seguidas sin error y, desde la semilla anterior (`cd94fef`), deja el mismo esquema que `restaurantebd.sql`.
- **Navegador (web local contra la API local):** menú QR en 375 px (llamar, recargar y recuperar la llamada, pedir, "Tu pedido"); tablero de mesas como cajero (estados, panel, "Marcar atendida" y el comensal viendo "ya te atendieron" sin recargar). El navegador de pruebas tenía el permiso de notificaciones bloqueado: se vio el mensaje de avisos bloqueados con el seguimiento intacto.

## Producción (13/11/2026)

- **TiDB:** el usuario aplicó las migraciones en el SQL Editor; la consulta de verificación da 1 para `2026-11-04`, `2026-11-05` y `2026-11-13`. Ojo: el SQL Editor corre solo la sentencia del cursor si no se selecciona todo (Ctrl+A y Run).
- **Render (API):** `Jwt__Key` fija, `EnableSwagger=false` y claves VAPID (`Push__ClavePublica`, `Push__ClavePrivada`) configuradas.
- **Comprobado desde fuera:** `GET /api/health` 200; `GET /api/cliente-mesa/push` devuelve la clave pública (Web Push activo); `/swagger` 401; `GET /api/llamadas` 401 sin sesión; el hub `/api/hubs/mesa` negocia; la web sirve `sw-qpro.js` y su bundle trae "Llamar al mesero" y el tablero.
- No se probó un recorrido completo en producción (pedido, llamada y cobro reales).

## Sin verificar / bloqueos

1. **Push real en dispositivos:** no hay celular conectado. No se probó FCM en Android con la app cerrada ni Web Push en Android Chrome o iPhone. Pasos en `tests/PLAN_PRUEBAS_MOVIL.md` (MOV-19 a MOV-22 y "Celular real"). Las pruebas automáticas usan servidores simulados: no cuentan como entrega real.
2. **iOS:** Web Push solo funciona con la página agregada a la pantalla de inicio (iOS 16.4 o posterior) y el permiso se pide tras un toque; la página lo explica. La app Flutter en iOS sigue sin `GoogleService-Info.plist`.
3. **Render y Cloudflare:** que `CF-Connecting-IP` llegue siempre en Render sale de la comunidad de Render, no de su documentación oficial. Sin comprobar en producción (si no llega, el cupo vuelve a ser por IP del proxy, como antes). Se puede fijar otra cabecera con `Proxy__CabeceraIp`.
4. **APK nuevo:** las pruebas de la app ya pasan con Flutter 3.50 (14/11), pero no se compiló ni se instaló el APK en celulares reales.
5. **Historial de git:** dos commits viejos ya subidos (`a123ddc`, `29034bb`) llevan una línea de coautor de un asistente. Quitarla exige reescribir `main` y forzar el push: decisión del equipo.

## Despliegue (ya hecho el 13/11; referencia para el próximo)

1. TiDB Cloud (SQL Editor), base `restaurantebd`: toda migración nueva se corre **antes** de desplegar la API que la usa. Seleccionar todo el script antes de Run.
2. Render, servicio de la API, variables:
   - `Jwt__Key` fija (32 caracteres o más) y `EnableSwagger=false`.
   - `Push__ClavePublica` y `Push__ClavePrivada`: par VAPID P-256 en base64url. Se genera una sola vez, por ejemplo con `npx web-push generate-vapid-keys`, y se guarda solo en Render. Sin ellas todo funciona menos los avisos con la página cerrada.
   - `Push__Contacto` (opcional): `mailto:` del restaurante.
   - `Proxy__CabeceraIp` solo si la IP real no llega en `CF-Connecting-IP`.
3. Web: no necesita variables nuevas. Debe servirse por HTTPS (el service worker y Web Push lo exigen).
4. App: compilar con Flutter 3.47 (`flutter build apk --release --split-per-abi`) e instalar en los celulares de los meseros; al entrar se registra el token.
5. Volver atrás: la API anterior ignora las tablas nuevas; la migración no borra datos. Desplegar el commit anterior basta.

## Grafo (código actualizado 14/11/2026)

- 4.836 nodos, 12.118 aristas, 249 comunidades (antes 4.618 / 10.946 / 235). El 14/11 se actualizó **solo el código** (`python -m graphify update .`, sin modelo): entran la facturación electrónica (`DocumentosDian`, `FiscalController`, `DatosFiscales.js`, `utils/facturacion.js`). Los documentos nuevos o cambiados (`HANDOFF.md`, `CONTEXTO_PROYECTO.md`, `docs/GUIA_PARA_VENDER_QPRO.md`, `docs/GUIA_PILOTO_PASO_A_PASO.md`) **no** se volvieron a extraer: falta `/graphify --update`. 48 comunidades quedaron con el nombre de su nodo central; `graphify label` las renombra.
- Nodos centrales: `RestauranteContext` (178 aristas), `RestaurantApi.Models`, `RestaurantApi.Dtos`, `Boton()` de la web, `RestaurantApi.Services`.
- Salud: sin aristas colgantes ni extremos faltantes; 2 auto-bucles (referencias del AST, como antes).
- Límites conocidos: los `.sql` no aportan nodos (falta el analizador `tree_sitter_sql`; `pip install "graphifyy[sql]"`), `Program.cs` no da símbolos, y la migración `2026-11-13` quedó fuera de esta actualización porque el archivo local estaba vacío (conserva sus nodos anteriores, si los tenía).
- Para refrescarlo: actualización incremental de graphify desde la raíz del repo. Si un documento se vuelve a extraer y sus nodos cambian de ID, el guardián se niega a escribir; se fuerza solo cuando los nodos perdidos son de esos mismos documentos (así se hizo esta vez: 31 nodos, todos de archivos re-extraídos).

## Cómo verificar

```bash
dotnet test tests/RestaurantApi.Tests
```

```bash
cd web/mi-restaurante && npm test -- --watchAll=false && npm run build
```

```bash
cd app/restaurant_app && flutter test && flutter analyze
```

## Avisos del entorno

- Windows, consola cp1252: codificar en UTF-8 al pasar tildes por stdin.
- Sin el runtime de ASP.NET Core 8: `DOTNET_ROLL_FORWARD=Major dotnet test ...`.
- Reiniciar la API sin `Jwt__Key` cierra la sesión de la web.
- graphify corre con `C:\Python315\python.exe` (ruta en `graphify-out/.graphify_python`).
