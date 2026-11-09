# Landing comercial de Qpro

Página para conseguir restaurantes clientes. Es independiente de la web de la app (`web/mi-restaurante`) y se publica en GitHub Pages en:

**https://empresascol.github.io/RestaurantApp/landing/**

## Antes de publicar

Edita `site.config.json`. Es el único lugar con datos públicos:

- `contacto`: WhatsApp (solo números, con 57), WhatsApp visible, correo, Instagram y ciudad.
- `responsable`: nombre, NIT o cédula y dirección que aparecen en la política de datos.
- `legalActualizado`: fecha que muestran la política y los términos.

Los textos de `public/privacidad.html` y `public/terminos.html` son una base. Revísalos con un asesor antes de usarlos con clientes.

## Comandos

```bash
npm install        # una vez
npm run build      # compila en dist/
npm start          # sirve dist/ en http://127.0.0.1:4388/RestaurantApp/landing/
npm test           # pruebas en el navegador (con npm start corriendo)
npm run deploy     # compila y publica en la rama gh-pages
```

`npm start` usa la misma ruta que GitHub Pages, así que enlaces, 404 y recursos se prueban como quedan publicados. Usa `PORT=4390 npm start` si el puerto está ocupado.

## Cómo convive con la app en GitHub Pages

Las dos se publican en la rama `gh-pages`:

| Ruta | Quién la publica | Comando |
|---|---|---|
| `/RestaurantApp/` (app web) | `web/mi-restaurante` | `npm run deploy` |
| `/RestaurantApp/landing/` y `/RestaurantApp/404.html` | `landing` | `npm run deploy` |

Cada deploy borra solo sus propios archivos: la landing reemplaza `404.html` y `landing/**`; la app reemplaza `index.html`, `*.json`, `*.ico`, `*.png`, `*.txt` y `static/**`. Por eso pueden publicarse en cualquier orden sin pisarse.

## Estructura

```
landing/
├── site.config.json   datos de contacto y legales
├── src/App.jsx        la página (React + Motion + Phosphor)
├── src/main.jsx       entrada del navegador: hidrata el HTML prerenderizado
├── src/images.json    anchos en WebP que se generan de cada imagen
├── src/icons.js       íconos de Phosphor importados uno por uno
├── src/style.css      estilos de la landing, páginas legales y 404
├── public/            index, 404, privacidad, términos, sitemap, manifest, imágenes y fuente
├── build.cjs          prerenderiza el HTML, genera WebP, minifica CSS y reemplaza {{marcadores}}
├── serve.cjs          servidor local con la ruta de GitHub Pages
├── deploy.cjs         publica en gh-pages sin tocar la app
└── verify.cjs         pruebas con Playwright
```

## Rendimiento

- El HTML llega ya renderizado: el inicio se ve sin esperar al JavaScript, que solo lo hidrata.
- Las imágenes se publican en WebP con varios anchos (`src/images.json`) y el navegador elige la que necesita. Para cambiar una captura, reemplaza el PNG en `public/assets/` con el mismo nombre.
- La fuente Manrope está en `public/assets/fonts/` (licencia OFL incluida); no se carga nada de Google.

Las capturas usan datos de demostración. `public/assets/og.png` es la imagen que se ve al compartir el enlace. Las decisiones de diseño están en `DESIGN.md`.
