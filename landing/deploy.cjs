// Publica dist/ en la rama gh-pages dentro de landing/ y deja 404.html en la raíz del sitio.
// Solo reemplaza 404.html y landing/**; la app web (index.html, static/, etc.) queda intacta.
const fs = require('fs'), path = require('path');
const ghpages = require('gh-pages');
const {base, url} = require('./site.config.json');

const dist = path.join(__dirname, 'dist');
const stage = path.join(__dirname, '.deploy');
const folder = base.split('/').filter(Boolean).pop(); // "landing"
if (!fs.existsSync(path.join(dist, 'index.html'))) {console.error('Falta dist/. Ejecuta npm run build.'); process.exit(1);}

fs.rmSync(stage, {recursive: true, force: true});
fs.cpSync(dist, path.join(stage, folder), {recursive: true});
fs.copyFileSync(path.join(dist, '404.html'), path.join(stage, '404.html'));

ghpages.publish(stage, {
  branch: 'gh-pages',
  remove: `{404.html,${folder}/**}`,
  message: 'Landing: publicar versión ' + new Date().toISOString().slice(0, 10)
}, err => {
  fs.rmSync(stage, {recursive: true, force: true});
  if (err) {console.error('No se pudo publicar:', err.message); process.exit(1);}
  console.log('Publicada en ' + url + ' (GitHub Pages tarda uno o dos minutos en actualizar).');
});
