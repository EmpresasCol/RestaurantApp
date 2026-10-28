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
