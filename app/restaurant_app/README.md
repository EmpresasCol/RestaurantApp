# Qpro · app móvil

App Flutter para meseros y domiciliarios (Android e iOS). Usa la misma API y el mismo sistema
visual que la web (`DESIGN.md`): espresso para actuar, caramelo para conteos, Manrope incluida.

## Qué hace

- **Mesero:** salón por mesas, "para servir" primero, carta con disponibilidad del inventario,
  editar o cancelar mientras la cocina no empieza, agregar platos como pedido nuevo, pedir la
  cuenta a caja y avisar cómo pagó el cliente (efectivo, datáfono o transferencia con foto).
  El mesero no cobra: la caja hace el cobro y la factura.
- **Domiciliario:** domicilios para recoger, sus entregas, llamar/WhatsApp/mapa y entregar.

## Correr

```bash
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:5000
```

Sin `API_BASE_URL` usa la API publicada en Render.

## Pruebas

```bash
flutter test
```

```bash
flutter analyze
```

## Publicar

```bash
flutter build apk --release --split-per-abi
```

iOS: `flutter build ipa` en un Mac. El push en iPhone necesita `ios/Runner/GoogleService-Info.plist`;
sin él la app funciona igual con el tiempo real.

## Estructura

| Carpeta | Contenido |
| --- | --- |
| `lib/theme/` | Tokens de DESIGN.md |
| `lib/widgets/q.dart` | Botón, doble toque, chip, aviso, cantidad, foto |
| `lib/services/` | Cliente HTTP único, sesión, tiempo real (SignalR) y push |
| `lib/providers/` | Sesión, salón del mesero, domicilios y avisos |
| `lib/screens/` | Login, `mesero/` y `domiciliario/` |
| `test/` | Reglas, providers con API simulada y pantallas |
