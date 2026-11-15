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

### iPhone físico (iOS 15 o posterior)

1. Conecta el iPhone al Mac por USB, desbloquéalo y acepta confiar en el Mac.
   Activa **Ajustes → Privacidad y seguridad → Modo desarrollador** en el iPhone.
2. En **Xcode → Settings → Accounts**, agrega tu cuenta de Apple.
   Si Xcode indica que iOS no está instalado, descarga la versión que solicita en
   **Settings → Components**. Es un componente del Mac, no una actualización del
   sistema del iPhone. También puedes iniciar la descarga desde Terminal con
   `xcodebuild -downloadPlatform iOS`.
3. Abre `ios/Runner.xcworkspace`. Selecciona el proyecto **Runner**, el target
   **Runner** y **Signing & Capabilities**. Activa **Automatically manage signing**
   y selecciona tu **Team** (puedes usar tu Personal Team para pruebas).
   Si Apple indica que `com.example.restaurantApp` ya está registrado, cambia el
   **Bundle Identifier** por uno único de tu organización o cuenta.
4. Desde esta carpeta, ejecuta:

   ```bash
   export PATH="/Users/danielchavezb/development/flutter/bin:$PATH"
   flutter devices
   flutter run -d <ID_DEL_IPHONE>
   ```

   Reemplaza `<ID_DEL_IPHONE>` por el identificador que muestra `flutter devices`.
   Este proyecto usa Swift Package Manager para las dependencias nativas de iOS;
   la primera compilación puede tardar mientras Xcode las descarga.
5. Si iOS pide confiar en el desarrollador, hazlo en **Ajustes → General → VPN y
   gestión de dispositivos** y vuelve a ejecutar el comando.

La configuración predeterminada conecta con la API publicada. `10.0.2.2` es la
dirección del emulador Android; para usar un backend local desde el iPhone,
configura la dirección de red del Mac y conecta ambos equipos a la misma red.

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
