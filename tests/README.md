# Pruebas de funcionamiento – Qpro

Creadas durante la auditoría técnica del 27/10/2026.

| Capa | Ubicación | Cómo ejecutar |
| --- | --- | --- |
| API .NET 8 (xUnit + EF Core InMemory) | `tests/RestaurantApi.Tests/` | `dotnet test tests/RestaurantApi.Tests` |
| Web React (Jest + Testing Library) | `web/mi-restaurante/src/__tests__/` | `cd web/mi-restaurante && npm test -- --watchAll=false` |
| App Flutter | `app/restaurant_app/test/models_test.dart` | `cd app/restaurant_app && flutter test test/models_test.dart` |

## Convención

- Las pruebas normales describen el comportamiento correcto que **ya funciona**.
- Las pruebas con prefijo `AUDITORIA_` (C#) o `[AUDITORÍA]` (JS/Dart) reproducen un
  defecto encontrado. **Fallan con el código actual a propósito** y deben pasar una vez
  se aplique la corrección. Cada una indica en su comentario la severidad y la causa.

## Resultados al momento de la auditoría

- Web: 24 pruebas → 19 pasan, 5 fallan (hallazgos).
- App: 14 pruebas → 10 pasan, 4 fallan (hallazgos).
- API: 44 pruebas → se esperan 20 que pasan y 24 que fallan (hallazgos). No se pudieron
  ejecutar en el entorno de la auditoría (sin acceso a NuGet); ejecútelas localmente.

Las pruebas de plantilla originales (`src/App.test.js` y `test/widget_test.dart`) fallan
porque buscan contenido del proyecto de ejemplo; se recomienda eliminarlas.

## Resultados tras aplicar el plan de corrección (28/10/2026)

Todas las pruebas `AUDITORIA_` / `[AUDITORÍA]` pasan; las de plantilla se eliminaron.

- API: 57 pruebas, 57 pasan (44 de la auditoría + 13 en `CorreccionesTests.cs`).
- Web: 31 pruebas, 31 pasan (24 de la auditoría + `kds.test.js` e `impuestos.test.js`).
- App: 14 pruebas, 14 pasan.

Notas:

- En `AuthContext.test.js` la respuesta simulada del login ahora incluye `token`,
  porque la API real lo devuelve (antes no existía).
- La API exige JWT: configure `Jwt__Key` (≥ 32 caracteres) y `Cors__Origenes` en el
  despliegue. Sin `Jwt__Key` usa una clave temporal y las sesiones caducan al reiniciar.

## Inventario y disponibilidad (30/10/2026)

Plan de pruebas de funcionamiento y fallos encontrados: `tests/PLAN_PRUEBAS_INVENTARIO.md`.

- API: 85 pruebas, 85 pasan (`DisponibilidadTests.cs` y `TemaRealtimeTests.cs` incluidas).
- Web: 36 pruebas, 36 pasan (`disponibilidad.test.js` y `realtime.test.js` incluidas).

## Operación diaria del inventario (31/10/2026)

Recepción con escáner, presentaciones de compra, órdenes, vencimientos y conteo: sección 6 de
`tests/PLAN_PRUEBAS_INVENTARIO.md`. Requiere `migraciones/2026-10-31_presentaciones_compra.sql`.

- API: 96 pruebas, 96 pasan (`ComprasTests.cs` incluida).
- Web: 42 pruebas, 42 pasan (`inventario.test.js` incluida).
