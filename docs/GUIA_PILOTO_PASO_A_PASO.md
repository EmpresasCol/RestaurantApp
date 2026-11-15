# Qpro: qué falta para venderlo al restaurante piloto

Estado: 14/11/2026. Complementa `docs/GUIA_PARA_VENDER_QPRO.md` (el detalle legal y técnico está
allá; aquí va solo el orden de trabajo).

> No es asesoría legal ni tributaria. Lo marcado con ⚖️ lo decide un contador o un abogado.

## Dónde estamos

| Listo | Falta |
| --- | --- |
| Facturación electrónica programada, probada y desplegada (apagada) | Proveedor tecnológico DIAN conectado |
| Datos fiscales, numeraciones, anulación, cierre de caja | Decisiones del contador ⚖️ |
| API 309/309, web 178/178, app 58/58 | Autorización de datos personales en domicilios |
| Migración aplicada en TiDB, rama desplegada en Render | Render de pago, respaldos, monitoreo |
| | Contrato firmado y capacitación |

La facturación electrónica **no se puede encender** hasta el paso 3. Mientras tanto Qpro sigue
emitiendo el consecutivo interno `FV-`, sin validez ante la DIAN.

## Camino crítico (en este orden)

Tiempo total estimado: 6 a 9 semanas con 2 personas. Los pasos 1, 2 y 4 se hacen al mismo tiempo.

### Paso 1. Elegir y contratar el proveedor tecnológico DIAN (tú, 1 a 2 semanas)

Es lo único que bloquea todo lo demás. Empieza hoy.

- [ ] Pedir demostración a 3 proveedores **habilitados por la DIAN** y especializados en
      facturación electrónica. No usar un competidor directo de Qpro (un POS de restaurantes).
- [ ] Preguntar a cada uno, por escrito:
  1. ¿Emiten **documento equivalente POS electrónico** por API REST? (Muchos solo emiten factura.)
  2. ¿Emiten nota de ajuste del POS y nota crédito de la factura por API?
  3. ¿Tienen ambiente de pruebas (sandbox) con credenciales propias?
  4. ¿La API es idempotente? (Reenviar el mismo documento no crea dos.)
  5. ¿Devuelven CUFE/CUDE, PDF y QR en la respuesta o por webhook?
  6. Precio por documento para unos cientos de documentos al día.
  7. Horario de soporte: noches y fines de semana.
- [ ] Firmar contrato y recibir las credenciales del sandbox.

Si ninguno emite POS electrónico por API: Qpro ya puede emitir **factura electrónica al consumidor
final** (opción "Documento del consumidor final" en Datos fiscales). ⚖️ Lo aprueba el contador.

### Paso 2. Reunión con el contador del restaurante ⚖️ (tú, 1 reunión)

Llevar estas preguntas y anotar la respuesta en `docs/GUIA_PARA_VENDER_QPRO.md`, sección 8:

- [ ] ¿INC del 8 %, IVA del 19 % o no responsable? (Se configura en Datos fiscales.)
- [ ] ¿Desde qué fecha está obligado el restaurante al POS electrónico?
- [ ] ¿POS electrónico o factura electrónica para el consumidor final?
- [ ] ¿El costo del envío del domicilio entra en la base del impuesto? (Hoy sí entra.)
- [ ] ¿La propina tiene tope del 10 % o solo la sugerida? (Hoy la API no pone tope.)
- [ ] ¿Cómo se reporta la propina en el documento electrónico?

Si alguna respuesta cambia lo que hace Qpro hoy, es un cambio de código de menos de 1 día cada uno.

### Paso 3. Conectar el proveedor a Qpro (desarrollo, 3 a 5 días)

Depende del paso 1.

- [ ] Escribir el adaptador: una clase que implemente `IProveedorFacturacion.EnviarAsync`
      (`api/RestaurantApi/Services/DocumentosDian.cs`) y traduzca `DocumentoParaEnviar` al formato
      del proveedor.
- [ ] Registrarlo en `api/RestaurantApi/Program.cs`, donde hoy está `ProveedorSinConfigurar`.
      Credenciales en variables de entorno de Render, nunca en el repositorio.
- [ ] Probar en el sandbox: un POS, una factura con NIT, una nota de ajuste y una nota crédito,
      con su PDF y su QR consultable.
- [ ] Simulacro de contingencia: apagar el proveedor, cobrar 5 cuentas, restablecer y confirmar que
      todo se transmite sin duplicados.

### Paso 4. Trámites del restaurante ante la DIAN (el restaurante, Qpro acompaña, 1 a 3 semanas)

- [ ] RUT actualizado con la responsabilidad de facturador electrónico.
- [ ] Habilitarse como facturador electrónico y asociar el proveedor elegido.
- [ ] Superar el set de pruebas (el proveedor lo guía).
- [ ] Pedir la **autorización de numeración**: una para el POS electrónico y otra para la factura
      electrónica (prefijo, rango y vigencia).

### Paso 5. Encender la facturación en Qpro (30 minutos, con el administrador del restaurante)

Depende de los pasos 2, 3 y 4.

1. Caja → **Datos fiscales**: razón social, NIT, dirección, municipio, régimen e impuesto.
2. Registrar las dos numeraciones tal como aparecen en la resolución.
3. Marcar "Facturación electrónica activa" y guardar.
4. Cobrar una cuenta de prueba y confirmar en **Facturas** que queda "Validada por la DIAN".
5. Imprimir la tirilla y escanear el QR.

### Paso 6. Legal mínimo antes de cobrar (2 a 3 semanas, en paralelo)

- [ ] ⚖️ Contrato de servicio y contrato de transmisión de datos entre Qpro y el restaurante.
- [ ] Política de tratamiento de datos del restaurante, enlazada desde el menú QR y los domicilios.
- [ ] **Código:** casilla de autorización (sin marcar) al registrar un cliente de domicilio, con
      registro de fecha y versión de la política. Hoy los datos se guardan sin esa autorización.
- [ ] **Código:** datos del vendedor y canal de quejas en la página pública de domicilios.
- [ ] ⚖️ Aviso de propina voluntaria con el texto de la SIC en el menú QR, la pre-cuenta y la tirilla.
- [ ] ⚖️ Propiedad del software frente a CECAR antes de facturar a nombre de la empresa.

### Paso 7. Producción técnica (1 a 2 semanas, en paralelo)

- [ ] Render en plan de pago (hoy el servicio se duerme sin tráfico).
- [ ] TiDB con respaldos automáticos y una prueba de restauración escrita.
- [ ] Cambiar las claves `123` de la semilla y obligar el cambio en el primer ingreso.
- [ ] Monitor de `/api/health` con alerta al celular.
- [ ] Dominio propio con HTTPS (el QR impreso no debe depender del subdominio de Render).
- [ ] PR de `RestaurantApp/AppMovil` a `main` y rama `main` protegida.
- [ ] Compilar el APK con Flutter 3.50 e instalarlo en los celulares de los meseros.

### Paso 8. Equipos y arranque (1 semana)

- [ ] Impresora térmica de 80 mm en caja: **imprimir una tirilla real** (no se ha probado).
- [ ] Datos móviles de respaldo en caja para cuando se caiga internet.
- [ ] Cargar carta, recetas, inventario inicial, mesas y usuarios con el restaurante.
- [ ] Capacitar por rol con un manual corto.
- [ ] Marcha blanca de una semana: Qpro en paralelo con el sistema actual, comparando cierres.
- [ ] Salida en vivo con el equipo de Qpro presente en el primer servicio completo.

## Criterio de "listo para cobrarle al restaurante"

- Todos los documentos de venta del mes están validados por la DIAN y el cierre cuadra.
- Cero incidentes que hayan parado el servicio en las últimas 2 semanas.
- Respaldos probados y alertas funcionando.
- Contratos firmados y políticas publicadas.

## Lo que no está verificado hoy

- Ningún documento se ha transmitido a la DIAN ni a un proveedor real: solo al proveedor simulado.
- No se probó un cobro real en producción después del despliegue del 14/11.
- La tirilla no se ha impreso en una impresora térmica.
- La app no se ha probado en celulares reales con este despliegue.

## Qué hacer mañana

1. Escribir a 3 proveedores tecnológicos con las 7 preguntas del paso 1.
2. Pedir la reunión con el contador (paso 2).
3. Pedirle al restaurante que actualice su RUT (paso 4).
