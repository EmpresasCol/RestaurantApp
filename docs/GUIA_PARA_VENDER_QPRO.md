# Guía para dejar Qpro listo para vender

Estado de partida: 13/11/2026. Normas consultadas en fuentes oficiales ese día (lista al final).

Esta guía dice qué falta para que Qpro opere **un restaurante real, cobrando, dentro de la ley
colombiana**, y después qué falta para venderlo como SaaS a muchos restaurantes. Está escrita
para el equipo de desarrollo; cada tarea dice dónde se toca el código y cómo se comprueba.

> **No es asesoría legal ni tributaria.** Las reglas de abajo salen de la norma vigente, pero las
> decisiones marcadas con ⚖️ las debe firmar un contador público o un abogado antes de salir a
> producción. La DIAN y la SIC cambian resoluciones con frecuencia: revisar las fuentes antes de
> cada fase.

---

## 1. El plan en una página

| Fase | Qué se logra | Tiempo estimado (2 a 3 personas) | Bloquea vender a 1 restaurante |
| --- | --- | --- | --- |
| 1. Facturación electrónica DIAN | El restaurante emite documento POS electrónico y factura electrónica válidos | 4 a 6 semanas | **Sí** |
| 2. Legal del restaurante y del producto | Datos personales, consumidor y propinas en regla; contrato firmado | 2 a 3 semanas (paralelo a la fase 1) | Sí |
| 3. Producción técnica | Servidores que no se duermen, respaldos, monitoreo, pruebas automáticas | 2 a 3 semanas (paralelo) | Sí |
| 4. Piloto en un restaurante | Un mes operando de verdad, con soporte | 4 a 8 semanas | — |
| 5. SaaS multi-restaurante | Muchos restaurantes en un solo sistema, registro y cobro automático | 2 a 4 meses | No (solo para escalar) |

Modelo recomendado para el primer cliente: **una instalación dedicada por restaurante** (su propia
base de datos y su propio despliegue). Evita la fase 5 hasta que haya 2 o 3 clientes pagando.


## 3. Fase 1: facturación electrónica DIAN (lo más importante)

Hoy Qpro emite un consecutivo interno `FV-00000001` (`api/RestaurantApi/Services/Facturacion.cs`).
**No tiene validez fiscal.** Un restaurante no puede operar solo con eso.

### 3.1 Qué documento se emite en cada caso

Resolución DIAN 000165 de 2023, compilada y vigente:

| Situación en el restaurante | Documento | Notas |
| --- | --- | --- |
| Consumidor final que no pide factura a su nombre | **Documento equivalente electrónico tiquete POS** | El POS electrónico se puede expedir "independientemente del valor de la operación". El tope de 5 UVT aplica al tiquete POS **no electrónico**. Si no pide factura a su nombre, no se le piden datos. |
| El cliente pide factura a su nombre (empresa, persona que quiere deducir) | **Factura electrónica de venta** | Hay que pedir tipo y número de identificación, nombre o razón social y correo. Debe existir un canal presencial para darlos verbalmente o por escrito. |
| Un POS electrónico que hay que anular o corregir | **Nota de ajuste** | El número anulado no se vuelve a usar. |
| Una factura electrónica que hay que anular o corregir | **Nota crédito** (o nota débito) | Lleva el CUFE y la fecha de la factura que corrige. |
| Se cae internet o el proveedor en el restaurante | **Contingencia**: factura de talonario o de papel | Al volver el servicio se transcriben como "factura tipo 3" y se transmiten dentro de las **48 horas** siguientes. |
| La DIAN no puede validar (caída de la DIAN) | Se sigue facturando electrónicamente sin validación previa | Se transmite dentro de las 48 horas siguientes al restablecimiento. |

Cada documento validado lleva su código único (**CUFE** para la factura, **CUDE** para el POS y
las notas), fecha y hora de validación y un **código QR** con la dirección de consulta.

⚖️ Confirmar con el contador la fecha desde la que el restaurante cliente está obligado según el
calendario de la Resolución 165 y sus modificaciones (Resolución 000188 de 2024).

### 3.2 Impuesto que lleva la venta

| Caso | Impuesto | Base |
| --- | --- | --- |
| Restaurante (no franquicia) | **Impuesto nacional al consumo (INC) del 8 %** (Estatuto Tributario arts. 426 y 512-1); el servicio de restaurante está excluido de IVA | Precio total del consumo (art. 512-9) |
| Restaurante que opera bajo **franquicia** | IVA del 19 % | Precio del consumo |
| Persona natural **no responsable** del INC (art. 512-13: ingresos del año anterior menores a 3.500 UVT y un solo establecimiento) | No cobra INC | — |
| Restaurante en el Régimen Simple | ⚖️ Las fuentes no coinciden en si cobra el INC o lo paga dentro de la tarifa simple. Lo define el contador. | — |
| **Propina** | No lleva impuesto: **no hace parte de la base del INC** (DIAN, Oficio 5032 de 2017) | Va separada, como ingreso de terceros (los trabajadores) |

Hoy el impuesto está fijo en el código (`web/mi-restaurante/src/utils/impuestos.js`:
`TASA_IMPUESTO = 0.08`). Tiene que pasar a **configuración del restaurante**.

### 3.3 Cómo integrarse: proveedor tecnológico, no software propio

Construir el XML UBL, firmarlo con certificado digital y pasar la habilitación como "software
propio" es posible, pero lleva meses y obliga a mantenerse al día con cada anexo técnico.
**Recomendación: contratar un proveedor tecnológico habilitado por la DIAN** que reciba los datos
de la venta por API y se encargue del XML, la firma, la validación, el PDF, el QR y el correo.

Criterios para elegirlo (pedir demostración y contrato por escrito):
- [ ] Emite **documento equivalente POS electrónico**, factura electrónica, notas de ajuste y notas crédito por API REST documentada.
- [ ] Ambiente de pruebas (sandbox) y acompañamiento en la habilitación.
- [ ] Respuesta síncrona con CUFE/CUDE o webhook al validar, y estados claros de rechazo con el motivo DIAN.
- [ ] Idempotencia: reenviar el mismo documento no crea dos.
- [ ] Representación gráfica para tirilla de 80 mm y envío automático por correo.
- [ ] Manejo de contingencia y reenvío dentro de las 48 horas.
- [ ] Precio por documento o por paquete adecuado para un restaurante (cientos de documentos al día).
- [ ] Acuerdo de nivel de servicio y soporte en horario de restaurante (noches y fines de semana).
- [ ] Contrato de encargo de datos (ver 4.1).

Opciones del mercado a evaluar: proveedores de facturación conocidos en Colombia (Siigo, Alegra,
Sovos y otros listados por la DIAN como proveedores tecnológicos). La lista oficial está en el
sitio de la DIAN; verificar que el elegido siga habilitado.

pero no elegir nuestra competencia directa, usar uno especializado en facturacion electronica avalado por la dian

### 3.4 Trámites del restaurante ante la DIAN (los hace el restaurante, Qpro acompaña)
1. [ ] RUT del restaurante actualizado con la responsabilidad de facturador electrónico.
2. [ ] Inscribirse en el servicio de facturación electrónica de la DIAN y escoger el proveedor tecnológico (o "software de un proveedor") con su identificador.
3. [ ] Superar el **set de pruebas** de habilitación (el proveedor lo guía).
4. [ ] Solicitar la **autorización de numeración** en el portal de la DIAN (prefijo, rango desde/hasta, vigencia) para factura electrónica y, aparte, para el documento equivalente POS electrónico. Si había numeración del POS físico, se inhabilita y se pide una nueva.
5. [ ] Asociar los rangos al proveedor y cargarlos en Qpro.

### 3.5 Cambios en el código

**Modelo y base de datos** (migración nueva en `migraciones/`, idempotente, y copia en `restaurantebd.sql`):
- [ ] Tabla `DocumentosElectronicos`: `Id`, `FacturaId`, `Tipo` (POS, FEV, NotaAjuste, NotaCredito), `Prefijo`, `Numero`, `Cufe`/`Cude`, `Estado` (Pendiente, Enviado, Validado, Rechazado, Contingencia), `MensajeDian`, `UrlPdf`, `UrlXml`, `QrUrl`, `Intentos`, `FechaGeneracion`, `FechaValidacion`, `DocumentoReferenciaId` (para notas), `ClaveIdempotencia` (única).
- [ ] Tabla `NumeracionesDian`: tipo de documento, número de resolución, prefijo, rango desde/hasta, fecha desde/hasta, siguiente número, activa. Alerta cuando quede el 10 % del rango o 30 días de vigencia.
- [ ] Tabla `ConfiguracionFiscal` (una fila por restaurante): razón social, NIT y dígito de verificación, dirección, municipio, régimen, responsabilidades fiscales, tipo de impuesto (INC 8 %, IVA 19 %, no responsable), credenciales del proveedor (en variables de entorno, no en la base).
- [ ] `Facturas`: agregar tipo de identificación del adquirente, dígito de verificación, correo y el desglose de impuesto (base, tarifa, valor). Hoy solo hay `NitCliente`, `NombreCliente`, `Subtotal`, `Propina` y `Total`.

**API** (`Services/Facturacion.cs`, `Controllers/PagosController.cs`, `Controllers/FacturasController.cs`, `Services/Entregas.cs`):
- [ ] Reemplazar el consecutivo `FV-` por la numeración DIAN del tipo de documento que corresponda.
- [ ] Al cobrar (`POST api/pagos/cobro`) y al entregar un domicilio: guardar el cobro **y** dejar el documento en estado `Pendiente` en la **misma transacción** (patrón *outbox*). Nunca llamar al proveedor dentro de la transacción del cobro.
- [ ] Un servicio en segundo plano (`BackgroundService`) envía los pendientes al proveedor, con reintentos con espera creciente y la `ClaveIdempotencia` para que un reintento no duplique el documento. Si no responde en el tiempo de la operación, el documento pasa a `Contingencia` y la caja sigue cobrando.
- [ ] Endpoint de **anulación**: `POST api/facturas/{id}/anular` (solo Caja y Administrador, con motivo obligatorio) que emite la nota de ajuste o la nota crédito y deja el registro. Cubre el pendiente "anular facturas" del contexto.
- [ ] Endpoint para reimprimir y reenviar por correo la representación gráfica.
- [ ] Reporte de conciliación: documentos del día por estado, para revisar rechazos antes del cierre.
- [ ] Bloquear el cierre de caja del día si hay documentos `Rechazado` sin resolver o en `Contingencia` con más de 48 horas.

**Web** (`components/caja/CobroPanel.js`, `utils/recibo.js`, `utils/impuestos.js`):
- [ ] En el cobro: "¿Factura a nombre de alguien?". Si sí, pedir tipo y número de documento, nombre y correo (validar NIT con dígito de verificación; `utils/caja.js` ya tiene `validarNit`). Si no, se emite POS sin pedir datos.
- [ ] La tirilla (`utils/recibo.js`) debe llevar los datos del **vendedor** (razón social, NIT, dirección, régimen), la resolución de numeración, el CUFE/CUDE, el QR, el impuesto discriminado y la propina aparte. Hoy solo imprime el CC/NIT del cliente.
- [ ] Mientras el documento no esté validado, la tirilla dice "documento en proceso de validación" y se reimprime cuando llegue el CUFE/CUDE.
- [ ] Pantalla de administración "Datos fiscales" para `ConfiguracionFiscal` y las numeraciones.
- [ ] Facturas del día (`FacturasDia.js`): mostrar el estado DIAN, el motivo de rechazo y las acciones reenviar, anular y descargar PDF.

**Compras a proveedores informales** (fase 1.5) ⚖️: cuando el restaurante le compra a alguien no obligado a facturar (plaza de mercado), debe emitir el **documento soporte en adquisiciones a no obligados a facturar** para poder deducir el costo. El módulo de recepciones (`api/compras/recepciones`) es el lugar natural; el mismo proveedor tecnológico suele emitirlo.

**Fuera del alcance de Qpro:** la nómina electrónica del restaurante. Que la lleve su contador o su proveedor de nómina.

### 3.6 Pruebas de la fase 1
- [ ] Pruebas unitarias del cálculo de impuesto: el total cobrado no cambia; el INC se discrimina del precio con impuesto incluido; la propina queda fuera de la base.
- [ ] Pruebas de integración con el proveedor **simulado**: validado, rechazado, tiempo de espera, respuesta duplicada y reintento idempotente.
- [ ] Pruebas contra el **ambiente de habilitación** del proveedor: un POS, una factura con NIT, una nota de ajuste y una nota crédito, con su PDF y su QR consultable.
- [ ] Simulacro de contingencia: apagar el proveedor, cobrar 5 cuentas, restablecer y verificar que todo se transmitió dentro de las 48 horas.
- [ ] Cierre de caja que cuadre con la suma de documentos validados del día.

---

## 4. Fase 2: legal del restaurante y del producto

### 4.1 Datos personales (Ley 1581 de 2012 y Decreto 1377 de 2013, compilado en el Decreto 1074 de 2015)

Qpro guarda datos personales: clientes de domicilio (nombre, teléfono, direcciones), datos del
adquirente de la factura, empleados (usuarios) y fotos de comprobantes de pago.

- [ ] **Roles:** el restaurante es el **Responsable** del tratamiento; Qpro es el **Encargado** (trata los datos por cuenta del restaurante). Firmar un **contrato de transmisión de datos** entre los dos ⚖️.
- [ ] **Política de tratamiento de datos del restaurante**, publicada y enlazada desde el menú QR, la página pública de domicilios y la tirilla. Qpro puede entregar una plantilla, pero la firma el restaurante.
- [ ] **Autorización previa, expresa e informada** antes de guardar los datos de un cliente de domicilio: casilla que no venga marcada, enlace a la política y registro de la autorización (fecha, hora, versión de la política, canal). Hoy `NuevoDomicilio.js` y la página pública de domicilios guardan datos sin esa autorización.
- [ ] Para la factura a nombre del cliente: los datos se piden para cumplir la obligación de facturar; informar la finalidad en el momento.
- [ ] **Derechos del titular**: un canal (correo del restaurante) y un procedimiento interno para consultas (respuesta en 10 días hábiles) y reclamos (15 días hábiles). En Qpro: buscar un cliente por teléfono, exportar sus datos, corregirlos y anonimizarlo (no se puede borrar lo que está en una factura: se conserva por la obligación tributaria).
- [ ] **Minimización y retención**: el comensal del QR ya es anónimo (bien). Definir cuánto tiempo se guardan las fotos de comprobantes y los datos de domicilio y borrar lo vencido con una tarea programada.
- [ ] **Transferencia internacional**: la base de datos de producción está en TiDB Cloud en una región de AWS fuera de Colombia y la API en Render. ⚖️ Verificar que los países tengan nivel adecuado de protección según la SIC o que el contrato con el proveedor lo cubra, y decirlo en la política.
- [ ] **Registro Nacional de Bases de Datos (RNBD)**: obligatorio para sociedades con activos totales superiores a 100.000 UVT. Un restaurante pequeño normalmente no está obligado; ⚖️ confirmar con sus activos. La exención del registro **no** exime de cumplir la ley.
- [ ] **Incidentes de seguridad**: procedimiento escrito para informar a la SIC y al restaurante si hay una fuga de datos.

### 4.2 Consumidor (Ley 1480 de 2011)
- [ ] Precios de la carta con **impuestos incluidos** (Qpro ya lo hace: "Total · impuestos incluidos"). Mantenerlo al hacer configurable el impuesto.
- [ ] Domicilios por la web es **comercio electrónico**: mostrar razón social, NIT, dirección, teléfono, precio total, costo del domicilio, medios de pago y un canal de peticiones, quejas y reclamos en la página pública de domicilios.
- [ ] Si el restaurante hará mensajes promocionales por WhatsApp o llamadas: respetar los canales y horarios de la Ley 2300 de 2023 y la autorización del titular ⚖️.

### 4.3 Propina (Ley 1935 de 2018)
La ley dice: la propina es **voluntaria**, el establecimiento la puede sugerir, quien atiende
debe **preguntar** si se incluye en la factura o cuánto quiere dar el cliente, **nunca supera el
10 %**, se reparte entre **todos** los trabajadores que atienden al cliente (no solo meseros) y no
se le puede retener al trabajador. La SIC vigila y da instrucciones sobre cómo informarla.

Qpro ya separa la propina y la reparte en proporción entre pagos (`Cuentas.RepartirPropina`).
Falta:
- [ ] Tope de **10 %** del consumo en la API (`PagosController.Cobrar` y el aviso del mesero en `CuentasController`): hoy solo se valida que no sea negativa ni mayor que el consumo completo.
- [ ] En la caja y en la app del mesero: la propina sugerida (`propinaSugerida`, 10 %) empieza como sugerencia y el flujo **obliga a preguntar** (botones "Incluir propina sugerida", "Otro valor", "Sin propina"), sin marcar ninguno por defecto.
- [ ] Aviso visible de voluntariedad en el menú QR, en la pre-cuenta y en la tirilla. ⚖️ Usar el texto exacto de la instrucción vigente de la SIC.
- [ ] Reporte de propinas por día y por turno para repartir entre todo el personal de servicio (el cierre ya resta "propinas pagadas"; falta el detalle).

### 4.4 Contratos y documentos de Qpro
- [ ] **Contrato de servicio (SaaS) con el restaurante** ⚖️: objeto, precio y forma de pago, nivel de servicio (disponibilidad, horario de soporte, tiempos de respuesta), mantenimiento programado, encargo de datos (4.1), **los datos son del restaurante** y se entregan exportados al terminar, responsabilidad tributaria del restaurante (Qpro emite por cuenta del restaurante; declarar y pagar es del restaurante), límite de responsabilidad, confidencialidad, duración y terminación.
- [ ] Revisar con abogado los términos y la política de privacidad que ya publica la landing (`landing/dist/terminos.html`, `landing/dist/privacidad.html`) para que hablen de Qpro como Encargado.
- [ ] Manual de usuario corto por rol y acta de capacitación firmada.

---

## 5. Fase 3: producción técnica para un restaurante

### 5.1 Infraestructura
- [ ] Render en **plan pago** para API y web (hoy se duerme sin tráfico y el primer arranque tarda: inaceptable con clientes en la mesa).
- [ ] TiDB Cloud en un plan con **respaldos automáticos** y retención conocida. Además, un volcado diario propio a otro proveedor de almacenamiento.
- [ ] **Prueba de restauración** mensual escrita: restaurar el respaldo en una base aparte y correr el recorrido básico. Definir cuánto se puede perder (por ejemplo, 24 h) y en cuánto se vuelve a operar (por ejemplo, 4 h).
- [ ] Ambiente de **pruebas (staging)** con su propia base: nada se prueba contra producción.
- [ ] **Dominio propio** con HTTPS para la web y la API (el QR impreso no debe depender de un subdominio de Render).
- [ ] Mover las fotos (platillos, comprobantes, recepciones) de Base64 en la base a almacenamiento de objetos con URL firmada.
- [ ] Instalar Tailwind con el build (hoy se carga por CDN y avisa en la consola de producción).

### 5.2 Calidad y despliegue
- [ ] **Integración continua** (GitHub Actions): en cada PR correr `dotnet test`, `npm test`, `npm run build`, `flutter test` y `flutter analyze`. Hoy no hay ningún flujo en `.github/workflows`.
- [ ] Rama `main` protegida (PR y pruebas verdes para fusionar). Render debe desplegar desde `main`; hoy despliega desde `RestaurantApp/AppMovil`.
- [ ] Pruebas de los casos con candado (cobro duplicado, última porción, pedido durante el cobro) contra MySQL en la integración continua, no solo en EF InMemory.
- [ ] Prueba de carga de un servicio real (por ejemplo, 30 mesas, 5 meseros, 2 cajas, cocina y domicilios durante 3 horas) con k6 o similar.

### 5.3 Seguridad
- [ ] Cambiar todas las claves de la semilla (`123`) y obligar a cambiar la clave en el primer ingreso.
- [ ] Recuperación de contraseña y política de claves (longitud mínima, bloqueo tras intentos: el límite por IP ya existe).
- [ ] **Bitácora de auditoría**: la tabla `AuditLog` existe en la base pero la API no la usa. Registrar quién anula, cancela, cambia precios, da descuentos, reabre cierres y cambia datos fiscales.
- [ ] Revisión de seguridad tipo OWASP ASVS nivel 1 y una prueba de penetración básica antes del piloto.
- [ ] Actualizaciones automáticas de dependencias (Dependabot) y revisión mensual.
- [ ] Comprobar en producción que el límite de peticiones por cliente funciona detrás de Render (`CF-Connecting-IP`; ver `HANDOFF.md`).

### 5.4 Monitoreo y soporte
- [ ] Monitor externo de `/api/health` cada minuto con alerta al celular del equipo.
- [ ] Registro de errores de API, web y app (Sentry o similar), sin datos personales en los mensajes.
- [ ] Panel con lo que importa en servicio: errores, tiempo de respuesta, documentos DIAN rechazados o en contingencia.
- [ ] Canal de soporte con horario del restaurante y un procedimiento de guardia para noches y fines de semana.

### 5.5 Equipos del restaurante
- [ ] Impresora térmica de 80 mm en caja (tirilla y pre-cuenta) y, si la cocina lo pide, impresora de comandas (ESC/POS) además de la pantalla.
- [ ] Pistola de códigos física para inventario (pendiente de probar).
- [ ] Celulares de meseros: Android con la app instalada desde Play Store, push probado con la app cerrada y en ahorro de batería.
- [ ] Plan si se cae internet en el local: datos móviles de respaldo en caja y el procedimiento de contingencia de facturación (3.1).

### 5.6 App móvil
- [ ] Compilar y probar con Flutter 3.47 (las últimas pruebas se corrieron con 3.44).
- [ ] Publicar en **Google Play**: cuenta de desarrollador de la empresa, llave de firma guardada fuera del repositorio, política de privacidad y formulario de seguridad de datos.
- [ ] iPhone solo si el restaurante lo necesita (requiere `GoogleService-Info.plist`, Mac y cuenta de Apple).
- [ ] Casos MOV-19 a MOV-22 y "Celular real" de `tests/PLAN_PRUEBAS_MOVIL.md` en equipos reales, con modelo y versión anotados.

---

## 6. Fase 4: el piloto en un restaurante

### 6.1 Pendientes de producto que el piloto va a notar
- [ ] Pantalla "Datos del restaurante": nombre comercial, razón social, NIT, dirección, teléfono, horario y logo (hoy varias cosas están fijas en el código).
- [ ] Anular factura (fase 1) y **cancelar pedido desde la caja nueva**.
- [ ] Domicilio que no se pudo entregar: regreso del domiciliario desde la app.
- [ ] Reimprimir los QR de las mesas (los viejos con `?mesa=` ya no sirven).
- [ ] Conversión de unidades en recetas (hoy se fuerza la unidad del insumo).
- [ ] Exportación para el contador: ventas por día con INC discriminado, propinas, medios de pago y documentos DIAN (CSV o Excel).

### 6.2 Arranque
1. [ ] Cargar carta, recetas, inventario inicial, mesas y usuarios con el restaurante.
2. [ ] Capacitar por rol (caja, cocina, meseros, administrador) con el manual.
3. [ ] **Marcha blanca** de una semana: Qpro en paralelo con el sistema actual, comparando cierres de caja.
4. [ ] Salida en vivo con el equipo de Qpro presente en el primer servicio completo.
5. [ ] Reunión semanal durante el primer mes: errores, pedidos de cambio, cuadre de caja y documentos DIAN.

### 6.3 Criterio de "listo para vender" a un restaurante
- Todos los documentos de venta del mes están **validados por la DIAN** y el cierre cuadra.
- Cero incidentes que hayan parado el servicio en las últimas 2 semanas.
- Respaldos probados y monitoreo con alertas funcionando.
- Contrato de servicio y contrato de transmisión de datos firmados; políticas publicadas.
- El restaurante paga la mensualidad y Qpro le factura electrónicamente.

---

## 7. Fase 5: de un restaurante a SaaS

Solo cuando haya demanda probada (2 a 3 restaurantes pagando con instalaciones dedicadas).

- [ ] **Multi-restaurante**: agregar `RestauranteId` a todas las tablas de negocio, filtros globales de EF Core por restaurante, el `RestauranteId` dentro del JWT, índices únicos por restaurante (número de mesa, consecutivos, códigos de barras) y pruebas que demuestren que un restaurante nunca ve datos de otro. Hoy ninguna tabla tiene esa columna: es el cambio más grande del proyecto.
- [ ] Configuración fiscal, numeraciones DIAN, proveedor tecnológico y tema visual **por restaurante**.
- [ ] Registro autoservicio: crear el restaurante, asistente de configuración inicial (datos fiscales, mesas, carta, usuarios) e impresión de QR.
- [ ] Suscripciones y cobro recurrente con una pasarela colombiana (por ejemplo, Wompi o Mercado Pago), planes, periodo de prueba, suspensión por falta de pago y factura electrónica automática de Qpro.
- [ ] Panel interno de Qpro: restaurantes, estado de pago, uso, documentos DIAN fallidos y soporte.
- [ ] Exportación completa de datos por restaurante y borrado al terminar el contrato (lo exige el encargo de datos).
- [ ] Términos de servicio y contrato tipo de adhesión revisados por abogado.

---

## 8. Decisiones que debe firmar un profesional ⚖️

| Decisión | Quién |
| --- | --- |
| INC 8 %, IVA 19 % (franquicia) o no responsable para cada restaurante; tratamiento en el Régimen Simple | Contador del restaurante |
| Fecha de obligatoriedad del POS electrónico para el cliente | Contador del restaurante |
| Campo y forma de reportar la propina en el documento electrónico | Contador y proveedor tecnológico |
| IVA e ICA de la suscripción de Qpro; CIIU de la SAS | Contador de Qpro |
| Propiedad del software frente a CECAR; cesión de derechos a la SAS | Abogado |
| Contrato SaaS, contrato de transmisión de datos, términos y políticas | Abogado |
| Transferencia internacional de datos (servidores fuera de Colombia) | Abogado |
| Texto del aviso de propina voluntaria según la instrucción de la SIC | Abogado o asesor del restaurante |

---

## 9. Fuentes consultadas (13/11/2026)

- DIAN, Resolución 000165 de 2023 (compilada y vigente): POS electrónico sin tope de valor, tope de 5 UVT del POS no electrónico, datos del adquirente, nota de ajuste, contingencia y 48 horas. https://normograma.dian.gov.co/dian/compilacion/docs/resolucion_dian_0165_2023.htm
- DIAN, Anexo técnico del documento equivalente electrónico. https://www.dian.gov.co/impuestos/factura-electronica/Documents/Anexo-Tecnico-Documento-Equivalente-Electronico-V1-0-final.pdf
- DIAN, Oficio 5032 de 2017: la propina no hace parte de la base del INC. https://normograma.dian.gov.co/dian/compilacion/docs/oficio_dian_5032_2017.htm
- Ley 1935 de 2018 (propinas). https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=87873
- Impuesto al consumo en restaurantes (resumen de los arts. 426, 512-1, 512-9 y 512-13 del Estatuto Tributario). https://www.gerencie.com/servicio-de-restaurante-frente-al-iva.html — verificar contra el Estatuto Tributario en el normograma de la DIAN.
- Ley 1581 de 2012 y Registro Nacional de Bases de Datos (umbral de 100.000 UVT, Decreto 90 de 2018). https://www.funcionpublica.gov.co/eva/gestornormativo/norma_pdf.php?i=85039

Lo que **no** se verificó en fuente oficial y queda marcado ⚖️: el valor de la UVT de 2026, el
tratamiento del Régimen Simple frente al INC, el calendario final de obligatoriedad del POS
electrónico y el texto exacto de la instrucción de la SIC sobre la propina.
