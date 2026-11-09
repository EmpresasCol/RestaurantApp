// Compila la landing en dist/:
// 1. Copia public/ reemplazando {{marcadores}} con site.config.json.
// 2. Convierte las capturas a WebP en los anchos de src/images.json.
// 3. Compila el JavaScript del navegador (main.jsx) y una versión para Node que prerenderiza el HTML.
// 4. Minifica style.css.
process.env.NODE_ENV = 'production'; // React del prerender en modo producción, igual que app.js
const path = require('path'), fs = require('fs');
const webpack = require('webpack');
const sharp = require('sharp');
const site = require('./site.config.json');
const images = require('./src/images.json');

const root = __dirname, dist = path.join(root, 'dist'), pub = path.join(root, 'public');
const tmp = path.join(root, '.prerender');
const version = Date.now().toString(36);

const value = key => key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), site);
const fill = text => text.replace(/\{\{([\w.]+)\}\}/g, (m, key) => {
  const v = value(key);
  if (v === undefined) throw new Error(`Falta "${key}" en site.config.json`);
  return v;
}).replace(/\?v=dev/g, '?v=' + version);

function copyPublic(from, to) {
  fs.mkdirSync(to, {recursive: true});
  for (const name of fs.readdirSync(from)) {
    const src = path.join(from, name), out = path.join(to, name);
    const base = name.replace(/\.(png|jpe?g)$/, '');
    if (fs.statSync(src).isDirectory()) copyPublic(src, out);
    else if (/\.(html|xml|webmanifest)$/.test(name)) fs.writeFileSync(out, fill(fs.readFileSync(src, 'utf8')));
    else if (images[base] && base !== 'logo') continue; // se publica solo en WebP
    else fs.copyFileSync(src, out);
  }
}

async function buildImages() {
  const dir = path.join(pub, 'assets');
  await Promise.all(Object.entries(images).flatMap(([name, {widths}]) => {
    const file = fs.readdirSync(dir).find(f => f.replace(/\.(png|jpe?g)$/, '') === name);
    if (!file) throw new Error(`No existe public/assets/${name}.png|jpg`);
    return widths.map(w => sharp(path.join(dir, file)).resize({width: w, withoutEnlargement: true}).webp({quality: 78, effort: 5})
      .toFile(path.join(dist, 'assets', `${name}-${w}.webp`)));
  }));
}

const babel = {test: /\.jsx?$/, exclude: /node_modules/, use: {loader: 'babel-loader', options: {cacheDirectory: false, presets: [['@babel/preset-react', {runtime: 'automatic'}]]}}};
const compile = config => new Promise((resolve, reject) => webpack({mode: 'production', performance: {hints: false}, resolve: {extensions: ['.js', '.jsx', '.json']}, module: {rules: [babel]}, ...config}, (err, stats) => {
  if (err || stats.hasErrors()) reject(err || new Error(stats.toString({all: false, errors: true})));
  else resolve();
}));

// Minificación conservadora: quita comentarios y espacios sobrantes, no reescribe reglas.
const minifyCss = css => css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{};,>])\s*/g, '$1').replace(/;}/g, '}').trim();

(async () => {
  fs.rmSync(dist, {recursive: true, force: true});
  copyPublic(pub, dist);
  fs.writeFileSync(path.join(dist, 'style.css'), minifyCss(fs.readFileSync(path.join(root, 'src/style.css'), 'utf8')));

  await Promise.all([
    buildImages(),
    compile({entry: path.join(root, 'src/main.jsx'), output: {path: dist, filename: 'app.js'}}),
    compile({target: 'node', entry: path.join(root, 'src/App.jsx'), output: {path: tmp, filename: 'app.cjs', library: {type: 'commonjs2'}}, externals: {react: 'commonjs react', 'react-dom/server': 'commonjs react-dom/server'}})
  ]);

  // Prerender: el HTML llega con el contenido y React lo hidrata al cargar app.js
  const React = require('react');
  const {renderToString} = require('react-dom/server');
  const App = require(path.join(tmp, 'app.cjs')).default;
  const html = renderToString(React.createElement(App));
  const indexFile = path.join(dist, 'index.html');
  const index = fs.readFileSync(indexFile, 'utf8');
  if (!index.includes('<div id="root"></div>')) throw new Error('index.html no tiene <div id="root"></div>');
  fs.writeFileSync(indexFile, index.replace('<div id="root"></div>', `<div id="root">${html}</div>`));
  fs.rmSync(tmp, {recursive: true, force: true});

  const kb = f => Math.round(fs.statSync(path.join(dist, f)).size / 1024);
  console.log(`Landing compilada en dist/ · app.js ${kb('app.js')} KB · style.css ${kb('style.css')} KB · index.html ${kb('index.html')} KB`);
})().catch(err => {console.error(err.message || err); process.exitCode = 1;});
