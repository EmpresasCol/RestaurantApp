# Qpro: contexto del proyecto (03/11/2026)

Resumen para retomar el trabajo sin leer todo el repositorio. Para detalles de un módulo
concreto, consulta primero el grafo (`graphify-out/GRAPH_REPORT.md` o `/graphify query "..."`).

## 1. Qué es

Proyecto de grado (CECAR). Sistema para restaurante: pedido por QR o mesero, comandas en
cocina, caja y facturación, domicilios e inventario que se descuenta por recetas.
Contexto de producto en `PRODUCT.md`; sistema visual en `DESIGN.md` (los dos son la fuente de verdad).

| Capa | Tecnología | Carpeta |
| --- | --- | --- |
| API | .NET 8, EF Core (Pomelo MySQL), JWT, SignalR | `api/RestaurantApi/` |
| Web | React 19 (CRA), Tailwind por CDN, `motion`, `lucide-react` | `web/mi-restaurante/` |
| App móvil | Flutter (meseros y domiciliarios) | `app/restaurant_app/` |
| Base de datos | MySQL local para desarrollo; TiDB Cloud en producción | `restaurantebd.sql`, `migraciones/` |
| Pruebas | xUnit (API), Jest (web), flutter_test (app) | `tests/`, `web/mi-restaurante/src/__tests__/`, `app/restaurant_app/test/` |

## 2. Dónde está corriendo

- **Rama de trabajo:** `RestaurantApp/AppMovil` (todo subido a `origin`). Rama principal: `main`.
- **API:** https://qpro-api-oi8l.onrender.com · **Web:** https://qpro-web.onrender.com (Render).
- **Base de producción:** TiDB Cloud, cluster `Qpro`, base `restaurantebd` (TiDB v8.5.3).
  Las tres migraciones de `migraciones/` (`2026-10-31_presentaciones_compra`, `2026-11-01_activos_y_codigo_qr`, `2026-11-02_caja_cuentas`) **ya están aplicadas** en TiDB y en el MySQL local.
  `2026-11-03_solicitudes_cuenta` también está aplicada en TiDB y en el MySQL local (03/11/2026).
  **`2026-11-04_cuentas_compartidas_domicilios` y `2026-11-05_recepciones_fotos` están aplicadas solo en el MySQL local: falta correrlas en TiDB antes de desplegar la API.**
  Regla: toda migración nueva se corre en TiDB **antes** de desplegar la API que la usa (si no, la API falla al leer la columna).
- **Local:** MySQL 9.6 en `localhost:3306` (cadena en `api/RestaurantApi/appsettings.Development.json`).
  `.claude/launch.json` (no está en git) arranca la API en `:5000` y la web en `:3000`.
  - `dotnet run --environment X` no sirve: `dotnet run` se queda con esa opción. Usa la variable `ASPNETCORE_ENVIRONMENT=Development` y `--contentRoot` con ruta absoluta.
  - Usuario de prueba de la semilla: `admin` (Administrador); su clave está en `restaurantebd.sql`.
  - Sin `Jwt__Key` la API usa una clave temporal: cada reinicio cierra la sesión de la web.

## 3. Últimos commits (de más nuevo a más viejo)

| Commit | Qué hizo |
| --- | --- |
| `1418ad6` | Docs: la app móvil en DESIGN.md y plan de pruebas en celular |
| `30e683a` | App móvil rehecha: sistema de la web, salón del mesero, carta con inventario, cuenta pedida a caja con foto, domiciliario; Gradle/AGP/Kotlin al mínimo de Flutter 3.47 |
| `373783d` | Web: cocina "Empezar a preparar"; caja ve la cuenta pedida, imprime la pre-cuenta y muestra la foto de la transferencia |
| `bcb8ab1` | API: solicitudes de cuenta, solo caja cobra, el mesero edita hasta que cocina empieza |
| `8da7608` | Caja por cuenta de mesa (una factura, propina, cambio, cliente), cierre de caja, precio congelado y Reportes reales |
| `19aecf8` | Seguridad: QR con código secreto, platillos ocultables y usuarios desactivables |
| `7ad44a3` | Platillos, Usuarios y Códigos QR rediseñados e integrados con inventario y mesas |
| `e099c3f` | Inventario: Movimientos y Configuración rediseñados, corregir lote, traslados y reglas de la vida real |
| `7d25582` | Inventario: operación diaria con escáner, compras (órdenes) y vencimientos |
| `6a25438` | Bloquear pedidos sin ingredientes; la carta marca "No disponible por el momento" |
| `db60959` | Tiempo real con SignalR (cocina, caja, domicilios) |
| `896d44f` | CORS para el frontend de Render |
| `9e76b4b` | Rediseño web: menú QR, login, cocina y caja |
| `a123ddc` | Plan de auditoría técnica (seguridad, inventario, caja, estados) |

Pruebas al cierre: **API 214/214**, **web 135/135**, **app 51/51** (`flutter analyze` sin avisos).
Trabajo del 04/11/2026 (sin commit todavía): cuentas compartidas, pagos avisados con varias fotos, domicilios con
factura y liquidación, cierre de caja con arqueo, cocina con listos aparte y el arreglo del cierre de sesión de la app.

## 4. Arquitectura que conviene saber

### API
- **Seguridad:** JWT en todos los logins; `[Authorize(Roles=…)]` y política por defecto que exige token. Solo son anónimos el login, la carta (`GET /api/platillos`), el pedido por QR, `GET /api/mesas/qr/{codigo}` y la página pública de domicilios. Cada petición con token comprueba que el usuario siga activo (`OnTokenValidated` en `Program.cs`).
- **Caja:** se cobra por **cuenta de mesa** (`POST api/pagos/cobro`): uno o varios pedidos abiertos de la misma mesa en una sola factura; elegir algunos divide la cuenta. Un pedido en cocina (`EnProceso`) no se cobra. Cada pedido tiene su `Pago` (la propina va en el primero) y todos llevan `Pagos.FacturaId`. El precio de cada plato se congela al pedirlo (`PedidoDetalles.PrecioUnitario`, lo fija `RestauranteContext.CongelarPrecios`); cálculos compartidos en `Services/Cuentas.cs` y `Services/Facturacion.cs`.
- **Cierre y reportes:** `GET api/reportes/cierre?fecha=` (caja y admin) y `GET api/reportes/ventas?desde=&hasta=` (admin), en `Services/ReportesVentas.cs`. Cuentan lo cobrado (fecha del pago o de la entrega del domicilio) en hora de Colombia; los pedidos del usuario `cliente_qr` son el canal "QR", no un mesero.
- **QR de mesa:** el enlace es `?m=<CodigoQR>` (24 caracteres hexadecimales al azar). El pedido anónimo se acepta solo con ese código y la API ignora cualquier `MesaId`; con token (mesero) sigue yendo por `MesaId`. El administrador puede cambiar todos los códigos (`POST api/mesas/codigos`).
- **Estados:** las transiciones permitidas de pedidos y domicilios están en `Services/EstadosPedido.cs`.
- **Fechas:** se guardan en UTC; los cortes de "hoy" se calculan en hora de Colombia (`Services/HoraLocal.cs`). Las columnas DATE (vencimiento, fecha de orden) no se convierten.
- **Tiempo real:** hub `Hubs/QproHub.cs` en `/api/hubs/qpro`. Un middleware de `Program.cs` emite `cambio` con un tema (`pedidos`, `mesas`, `domicilios`, `inventario` para `api/compras` y `api/inventario`) tras cada escritura 2xx; el mapeo ruta → tema está en `Services/TemaRealtime.cs`. La web escucha con `useCambios(tema, recargar)` (`src/services/realtime.js`) y además hace polling cada 60 s como respaldo.
- **Respuestas comprimidas:** `UseResponseCompression` (Brotli/gzip, nivel rápido); el JSON de inventario viaja ~5 veces más liviano.
- **Esquema:** no hay migraciones de EF; los cambios se hacen con SQL a mano en `migraciones/` (idempotente) y también se copian a `restaurantebd.sql`. TiDB no tiene triggers y tiene `tidb_enable_check_constraint` apagado (los CHECK se ignoran).

### Inventario (lo más trabajado)
- **Insumo vs producto de compra:** el insumo es `ProductoInventario`, lo que gasta la receta en su `UnidadMedida`. El producto de compra es `PresentacionCompra` (tabla `PresentacionesCompra`): "Caja 10 kg" equivale a factor 10 del insumo, con su código de barras opcional y único. Un insumo puede tener varias presentaciones, así que varios códigos llevan al mismo insumo.
- **Stock y lotes:** `Stock` guarda la cantidad por (insumo, almacén). `Lote` guarda la cantidad con vencimiento. Movimientos en `MovimientosInventario` (kárdex).
- **Descuento por recetas** (`Services/InventarioService.cs`): compara el consumo esperado según recetas con lo ya descontado y aplica solo la diferencia. Las referencias usan prefijos exactos ("Pedido #N - "). El stock nunca queda negativo.
- **Antes de guardar** un pedido o domicilio (mesa, QR, mesero, domicilio interno o público, edición): `VerificarStockPedidoAsync` / `VerificarStockDomicilioAsync`. Sin insumos responde 400 con "Platillo no disponible por el momento…".
- **Carta:** `PlatilloDto` trae `disponible` y `porcionesDisponibles`. Los insumos opcionales no bloquean; un insumo inactivo o vencido cuenta como 0.
- **Recepción** (tabla `Recepciones` + `RecepcionFotos`): guarda proveedor, orden, factura, total y hasta 10 fotos (JPEG reducido a 1280 px en el navegador, `utils/imagenes.js`). Cada línea puede ir a otro almacén (`AlmacenId` por línea; si no, el general). `NoVence` en una línea la deja sin fecha y apaga `RequiereCaducidad`/`DiasVencimiento` del insumo. Lotes `R{recepción}-{n}` y referencia `Recepción R-{id} · OC-… · factura`. Todo en una transacción con un solo viaje por el stock.
- **Lo vencido** (`LotesInventario.VencidoAsync`): sigue en bodega hasta darlo de baja, pero no se vende ni se gasta en recetas.
- **Endpoints de la operación diaria** (`Controllers/ComprasController.cs`, ruta `api/compras`): `resumen`, `insumos`, `insumos/{id}/ficha`, `codigo/{codigo}`, `presentaciones`, `recepciones` (POST registra; GET lista con Id de fotos), `recepciones/fotos/{id}`, `recepciones/{id}/fotos` (sumar fotos), `reposicion`, `ordenes`, `ordenes/{id}/estado`, `vencimientos`, `lotes/{id}` (PUT, corregir), `lotes/{id}/baja`, `traslados`, `conteos`.
- **Catálogo y CRUD clásico:** `Controllers/InventarioController.cs` (`api/inventario/...`). El código interno se genera solo (PROD-021) y el código de barras es único entre insumos y presentaciones. Los niveles admiten decimales. Una receta siempre usa la unidad de su insumo. Un ajuste guarda la diferencia en el kárdex. Un almacén o proveedor con historial se desactiva en lugar de eliminarse.

### Web: inventario (`src/Inventario.js` + `src/components/inventario/`)
- **Pestañas por tarea:** Hoy, Recibir, Pedidos, Vencimientos, Conteo, Insumos, Movimientos y Configuración (catálogo, recetas, categorías, almacenes, proveedores).
- **Piezas compartidas:** `ui.js` (Boton, Campo, Selector, Panel, Chip, useAviso, BotonConfirmar de dos toques), `ListaConfig.js` (CRUD genérico), `EscanerCodigo.js` (lector de mano o cámara con `@zxing/browser`; la cámara exige https o localhost), `FichaInsumo.js` (panel al tocar un insumo), `RegistrarMovimiento.js`, `EditorLote.js`, `FormularioInsumo.js`.
- **Utilidades puras con prueba:** `src/utils/inventario.js` (formatos, vencimientos, WhatsApp, signo del kárdex).
- **Cliente:** `src/services/inventarioApi.js`, con el objeto `compras` y `mensajeError`.

### App móvil (`app/restaurant_app/`)
- **Un solo login** para meseros y domiciliarios: prueba `usuarios/login-mobile` y, si el usuario no es mesero, `domiciliarios/login`. Otros roles ven "entra por la web".
- **Capas:** `services/api.dart` (único cliente HTTP: JWT, UTF-8, 40 s, mensajes legibles; un 401 cierra la sesión), `services/realtime.dart` (cliente mínimo de SignalR por WebSocket, sin paquete; mismo evento `cambio` que la web, recarga cada 60 s de respaldo), `providers/` (`AuthProvider`, `SalonProvider` del mesero, `DomiciliarioProvider`, `NotificacionProvider`), `screens/mesero/` y `screens/domiciliario/`. Tema y piezas en `theme/qpro_theme.dart` y `widgets/q.dart`.
- **Mesero:** salón por mesas con "para servir" primero; carta con disponibilidad del inventario (`disponible`, `porcionesDisponibles`, tope 50 como la web); edita o cancela un pedido solo mientras la cocina no lo empieza (`PedidoDto.cocinaEmpezo`); lo que se pide después va como pedido nuevo de la mesa; sirve (Entregado) con doble toque. **No cobra:** pide la cuenta a caja (`POST api/cuentas/solicitudes`) y luego avisa cómo pagó la mesa: propina y uno o varios pagos (partes iguales, efectivo + tarjeta, una transferencia por persona, cada una con su foto). Lo ya cobrado de una cuenta dividida se ve apagado.
- **Domiciliario:** para recoger / mis entregas (incluye lo que le asignaron aún en cocina), llamar, WhatsApp (+57), mapa, cambio a llevar, recoger → salir → "Entregar y cobrar" (método real; foto si transfirió) y el efectivo que debe entregar en caja.
- **Sesión:** cada sesión monta su propio `Navigator` (`_App` en `main.dart`); antes, al salir, el Navigator viejo seguía vivo y sus pantallas fallaban con `ProviderNotFoundException`. Prueba en `test/sesion_test.dart`.
- **Push:** Firebase es opcional (sin `GoogleService-Info.plist` en iOS la app funciona con el tiempo real). El sonido de "pedido listo" va dentro de la app (`assets/sounds/listo.wav`). La API sigue enviando a tokens de registro (`getToken`, marcado obsoleto en firebase_messaging 17).
- **API por defecto:** Render. Otra con `--dart-define=API_BASE_URL=...`. Vista previa web: `flutter build web --dart-define=API_BASE_URL=http://localhost:5000` y la configuración `app-movil` de `.claude/launch.json` (puerto 3001, permitido por CORS).

### Cuentas de mesa (mesero → caja)
- `SolicitudesCuenta` (una pendiente por mesa) con sus `PagosAvisados` (método, monto, foto si es `QR`, `FacturaId` cuando la caja lo usa) y `Propina`. Avisar otra vez reemplaza los avisos que la caja no ha usado. `Cuadra` = lo avisado cubre exacto lo que debe la mesa + la propina (`Cuentas.AvisoCuadra`). Al saldar la cuenta queda `Cobrada`; si se cancelan todos los pedidos, `Anulada`. Endpoints en `Controllers/CuentasController.cs` (`GET cuentas/pagos/{id}/comprobante` trae la foto de cada pago); tema realtime `pedidos`.
- **Cobro (`POST api/pagos/cobro`):** por pedidos (`pedidoIds`) o por platos (`lineas: [{detalleId, cantidad}]`, cada quien lo suyo, incluso 1 de 2 unidades: la parte cobrada queda en su propia línea con `PedidoDetalles.FacturaId`). Uno o varios `pagos` (método, monto con propina, recibido en efectivo, `avisoId`); deben sumar exacto el consumo + la propina, que se reparte en proporción (`Cuentas.RepartirPropina`). Cada pago es una fila de `Pagos` ligada a la factura (su `PedidoId` es el primer pedido cobrado). Un pedido queda `Pagado` cuando ya no le quedan platos por cobrar. Si el aviso del mesero cuadra, el cobro debe ser toda la cuenta, con esa propina y esos mismos pagos (409 si no); si no cuadra, lo avisado queda fijo y la caja completa el resto. Lo ya cobrado de un pedido no se cancela ni se edita.
- **Caja web:** tarjeta coloreada según el aviso (petróleo: pidió la cuenta; ámbar: pagó una parte; verde: ya pagó todo). El panel tiene "Toda la cuenta" / "Cada quien lo suyo", partes iguales, varios pagos y las fotos; si cuadra solo se confirma. Reglas puras en `utils/caja.js`.
- **Cocina web:** "Empezar a preparar" (`PUT api/pedidos/{id}/preparar` o `PUT api/domicilios/{id}/preparar`, Cocina/Admin). Lo listo pasa a la columna "Listos para entregar" sin botones: la cocina no marca entregado (403 para el rol Cocina); desaparece cuando el mesero sirve o el domiciliario recoge. Un pedido que editó el mesero (`Pedidos.FechaEdicion`) sale con franja ámbar.
- **Solo Caja o Administrador** ponen un pedido en `Pagado` (403 para el mesero).

### Domicilios
- Etapas: recibido (`EnPreparacion` sin `InicioPreparacion`; el cliente aún lo edita), en cocina, listo, en camino (`Recogido`/`EnCamino`), entregado. No se tocó el ENUM de `Estado`.
- Caja o administrador asignan domiciliario (`PUT api/domicilios/{id}/domiciliario`); el asignado lo ve en la app desde la cocina. `PagaCon` guarda el billete y la API calcula el `Cambio`.
- Al entregar (app: `PUT domiciliarios/{id}/pedidos/{d}/entregar` con `metodoPago` y foto si transfirió; caja: `PUT api/domicilios/{id}/estado` con `metodoPago`) se emite la factura (`Facturas.DomicilioId`, `PagoId` nulo). Reglas en `Services/Entregas.cs`.
- Efectivo del domiciliario: queda "por liquidar" hasta que la caja lo recibe (`POST api/domicilios/liquidaciones/{domiciliarioId}` → `FechaLiquidacion`). La caja lo entrega en caja sin liquidación aparte.
- Web: `Domicilios.js` (tablero por etapas y detalle) y `NuevoDomicilio.js` (una pantalla: teléfono → direcciones guardadas → carta con inventario → pago y billete). La caja también entra a Domicilios.

### Cierre de caja
- `CierresCaja` (una fila por día): base al abrir (`PUT api/reportes/cierre/apertura`) y arqueo al cerrar (`POST api/reportes/cierre`); el administrador reabre (`DELETE api/reportes/cierre?fecha=`).
- Esperado en el cajón = base + cobros de mesa en efectivo (con su propina) + efectivo que entregaron los domiciliarios − propinas pagadas al equipo − gastos o retiros. Tarjeta y transferencias se comparan con el datáfono y el banco. Lo que falta resolver (mesas abiertas, domicilios en curso, efectivo en domiciliarios) sale arriba.
- Error corregido: el `[Authorize(Roles = "Administrador")]` de la clase dejaba al cajero sin cierre (403) aunque el método dijera "Administrador,Caja": los atributos se suman con Y.

### Diseño
- Sistema "La carta a un toque": espresso `#2A1D15` para acciones, caramelo `#C8955E` para marca y conteos, piedra cálida para lo demás. Manrope con `.tabular` en cifras; solo sombras `card` y `lift`.
- Tailwind se carga por CDN con un remapeo de paleta en `public/index.html`: `orange` es caramelo, `gray` es piedra y `purple` es petróleo.
- Ya siguen el sistema: menú QR, login, cocina, caja (por cobrar, facturas y cierre), inventario completo, Platillos, Usuarios, Códigos QR, Reportes, Domicilios, NuevoDomicilio y la app móvil.
- **Caja web:** `Facturacion.js` + `components/caja/` (`PorCobrar`, `CobroPanel`, `FacturasDia`, `CierreCaja`); reglas en `utils/caja.js`, tirilla de 80 mm en `utils/recibo.js`. **Reportes:** `Reportes.js` + `utils/reportes.js` (colores de gráficos validados: mesa `#C4762B`, domicilio `#00809A`).

### Web: módulos del administrador (Platillos, Usuarios, Códigos QR)
- **Platillos** (`GestionPlatillos.js`): tarjetas con el estado que calcula el inventario (agotado, quedan N, sin receta) y el costo de la receta en % del precio. La ficha lateral edita el platillo y su receta con `EditorReceta` (exportado de `components/inventario/RecetasConfig.js`, el mismo de Configuración > Recetas). La foto se reduce a 1000 px antes de guardarse en Base64.
- **Usuarios** (`GestionUsuarios.js`): cada rol dice qué hace y si entra por la web o la app móvil. El usuario en sesión no puede eliminarse ni cambiar su rol.
- **Códigos QR** (`GeneradorQR.js`): un solo diseño de tarjeta; el número de la mesa va dentro del QR (insignia con corrección H). El administrador fija el número de mesas con `PUT api/mesas/cantidad` (crea 1..N y retira las sobrantes si están libres y sin pedidos).
- **Reglas compartidas con prueba:** `src/utils/administracion.js` (mismas validaciones que la API).

## 5. Decisiones tomadas (no reabrir sin motivo)

| Decisión | Motivo |
| --- | --- |
| Sin stock no se vende (rechazo antes de guardar) | Lo pidió el usuario; antes se vendía y se alertaba |
| Lo vencido no cuenta como disponible | En cocina real no se usa |
| Insumo separado de la presentación de compra (multi-código) | El proveedor vende en cajas o bultos y cada marca trae su propio código |
| Inventario sin columnas `PedidoId`; se usan referencias con prefijo | Evita migrar TiDB |
| Precios con impoconsumo del 8 % incluido (`src/utils/impuestos.js`) | Pendiente de confirmar con el asesor |
| SignalR solo avisa qué cambió; los datos se recargan por REST | Sin DTOs duplicados y los permisos se quedan en los endpoints |
| Commits en Conventional Commits, cuerpo en español, **sin coautor** | Preferencia del usuario |
| Gerente de inventario = rol Administrador | No hay rol "Inventario" (requeriría un ALTER del ENUM) |
| Platillo o usuario con historial no se elimina (409): se oculta o se desactiva (`Activo`) | Pedidos y domicilios los referencian |
| Una factura por cuenta de mesa; lo que sigue en cocina no se cobra | Cada envío del QR es un pedido; cobrar en cocina borraba la comanda |
| El precio se congela al pedir el plato | Cambiar un precio no debe alterar cuentas abiertas ni reportes |
| La propina de un pago facturado no se edita; borrar un pago reabre la cuenta | Una factura emitida no se reescribe |
| El comensal pide con el código secreto del QR, nunca con el Id de la mesa | Con `?mesa=<id>` cualquiera podía editar el enlace y pedir a nombre de otra mesa |
| Siempre queda al menos un Administrador | Evita dejar el sistema sin quien lo gestione |
| El mesero no cobra: pide la cuenta y avisa el método; la caja cobra y factura | Así trabaja el salón real (cuenta impresa, efectivo a caja, datáfono, foto de la transferencia) |
| El mesero edita o cancela solo hasta que la cocina empieza el pedido | Lo que ya se cocina no se cambia; lo nuevo va como otro pedido |
| Una cuenta dividida es una factura por persona; partes iguales o pago mixto es una factura con varios pagos | Cada quien puede pedir su factura; los pagos de una misma factura se cuadran por método |
| Si el aviso del mesero cubre toda la cuenta, la caja no cambia montos, métodos ni propina | La mesa ya pagó (comprobantes); si no cubre, lo avisado queda fijo y la caja cobra el resto |
| Servir es del mesero: la cocina solo marca listo | Lo listo se aparta en cocina hasta que llega a la mesa |
| El domicilio se factura al entregarlo y cobrarlo; el efectivo del domiciliario entra al cajón al liquidarlo | Así el cuadre del cajón cuenta solo el dinero que de verdad está en caja |

## 6. Pendientes

### Configuración y operación
- [ ] `Jwt__Key` fija en Render (32 caracteres o más) y revisar que `EnableSwagger` esté en `false` en producción.
- [ ] Revisar desde qué rama despliega Render; si es `main`, falta el merge de `RestaurantApp/AppMovil`.
- [ ] La URL de ngrok sigue como valor por defecto en `.env.production` (la app ya usa Render).
- [ ] Las claves de la semilla SQL siguen en `123`.
- [ ] Confirmar con el asesor si aplica impoconsumo o IVA.

### Técnicos
- [ ] **Concurrencia de stock:** dos pedidos simultáneos por la última porción pueden pasar la validación; además, sin token de concurrencia en `Stock` se pueden perder actualizaciones.
- [ ] **Unidades:** la receta no convierte unidades; se fuerza la del insumo.
- [ ] El menú QR no se actualiza en tiempo real (el hub exige sesión); se refresca al abrirlo y al enviar.
- [ ] Imágenes de platos en Base64 dentro de la base de datos; conviene moverlas a almacenamiento de archivos.
- [ ] Métodos de pago no unificados entre Pagos y Domicilios (requiere ALTER del ENUM).
- [ ] Tailwind por CDN (aviso en consola de producción); instalarlo con PostCSS.
- [ ] iOS: falta `ios/Runner/GoogleService-Info.plist` para el push; compilar y probar en un Mac.
- [ ] Sin probar en equipo real: la cámara del celular (foto de la transferencia), el push con la app cerrada y una pistola de códigos física. Casos en `tests/PLAN_PRUEBAS_MOVIL.md`.

### Diseño
- [x] Domicilios y NuevoDomicilio rediseñados (04/11/2026).
- [ ] Caja nueva no tiene "cancelar pedido" (la anterior sí); hoy se cancela desde Cocina o la app.

### Producto (caja y QR)
- [ ] Reimprimir los QR de las mesas (los viejos con `?mesa=` ya no permiten pedir).
- [x] Pago mixto, partes iguales y cuenta dividida por consumo (04/11/2026).
- [ ] Anulación de facturas con nota crédito; hoy un pago facturado no se anula.
- [x] Domicilios con factura consecutiva al entregarlos (04/11/2026).
- [ ] Domicilio que no se pudo entregar: hoy se cancela con motivo desde la web; falta el regreso del domiciliario desde la app.
- [ ] `.impeccable/design.json` está desactualizado frente a `DESIGN.md`; se regenera con `/impeccable document`.

## 7. Cómo verificar

```bash
dotnet test tests/RestaurantApi.Tests
```

```bash
cd web/mi-restaurante && npm test -- --watchAll=false
```

```bash
cd web/mi-restaurante && npm run build
```

```bash
cd app/restaurant_app && flutter test && flutter analyze
```

- **App en el celular:** `flutter build apk --release --split-per-abi` (Gradle 8.14.3; el Flutter local es 3.47).

- **Planes de prueba manual:** `tests/PLAN_PRUEBAS_INVENTARIO.md` (casos INV-, OPE- y REAL-) y `tests/README.md`.
- **Navegador integrado:** si el panel está oculto, las animaciones de `motion` se quedan congeladas y los clics fallan; usar `form_input` y JS para operar, y capturas solo cuando el panel esté visible.
- **Pruebas de API en memoria:** EF InMemory no detecta columnas inexistentes. `CajaCuentasTests.El_modelo_no_inventa_columnas_que_no_existen` protege contra FKs fantasma (p. ej. `PagoId1`); tras cambiar el modelo, probar también contra MySQL local.
- **Reiniciar la API** invalida el JWT (clave temporal): cerrar sesión y volver a entrar en la web.

## 8. Avisos del entorno (Windows)

- El MySQL local ya no tiene triggers, igual que TiDB (se quitaron con `migraciones/local_quitar_triggers_mysql.sql`; respaldo en `.claude/respaldo_triggers_local.sql`). Los procedimientos `sp_*` viejos siguen en la base pero nada los llama.

- Hay un `inspect.py` suelto en `C:\Users\Abraham\AppData\Local\Temp\` que reemplaza al módulo estándar. Ejecuta los scripts de Python con `-I` y nunca desde esa carpeta.
- La consola usa cp1252: al pasar texto con `→` o tildes por stdin, codificarlo en UTF-8 (`input=...encode('utf-8')`).
- Dejar fuera de git a propósito: `.claude/`, `graphify-out/`, `.impeccable/` y `app/restaurant_app/analysis_options.yaml`. `.impeccable/` y `graphify-out/` aparecen agregados al índice sin haberse commiteado; revisar antes de cada commit y hacer commit solo de rutas explícitas.
- El grafo (`graphify-out/`) se actualizó el 03/11/2026 (commit `1418ad6`): 3.551 nodos, 8.137 aristas y 213 comunidades (código, CONTEXTO_PROYECTO.md, DESIGN.md y planes de prueba). `.graphifyignore` excluye imágenes, sonidos (`*.wav`), `.impeccable/` y `.claude/`. Para refrescarlo: `/graphify --update`. Si un documento se vuelve a extraer y sus nodos cambian de ID, el guardián de `to_json` se niega a escribir; se fuerza solo cuando los nodos perdidos son de esos mismos documentos.
