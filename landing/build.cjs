// Compila la landing en dist/: app.js (React), style.css y las páginas de public/ con los datos de site.config.json.
const path = require('path'), fs = require('fs');
const webpack = require('webpack');
const site = require('./site.config.json');

const root = __dirname, dist = path.join(root, 'dist'), pub = path.join(root, 'public');
fs.rmSync(dist, {recursive: true, force: true});
fs.mkdirSync(dist, {recursive: true});

// {{clave}} o {{contacto.correo}} en los .html, .xml y .webmanifest se reemplazan por site.config.json
const value = key => key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), site);
const fill = text => text.replace(/\{\{([\w.]+)\}\}/g, (m, key) => {
  const v = value(key);
  if (v === undefined) throw new Error(`Falta "${key}" en site.config.json`);
  return v;
});
const version = Date.now().toString(36);
(function copy(from, to) {
  fs.mkdirSync(to, {recursive: true});
  for (const name of fs.readdirSync(from)) {
    const src = path.join(from, name), out = path.join(to, name);
    if (fs.statSync(src).isDirectory()) copy(src, out);
    else if (/\.(html|xml|webmanifest)$/.test(name)) fs.writeFileSync(out, fill(fs.readFileSync(src, 'utf8')).replace(/\?v=dev/g, '?v=' + version));
    else fs.copyFileSync(src, out);
  }
})(pub, dist);
fs.copyFileSync(path.join(root, 'src/style.css'), path.join(dist, 'style.css'));

webpack({
  mode: 'production',
  entry: path.join(root, 'src/App.jsx'),
  output: {path: dist, filename: 'app.js'},
  module: {rules: [{test: /\.jsx$/, exclude: /node_modules/, use: {loader: 'babel-loader', options: {cacheDirectory: false, presets: [['@babel/preset-react', {runtime: 'automatic'}]]}}}]},
  performance: {hints: false}
}, (err, stats) => {
  if (err || stats.hasErrors()) {console.error(err || stats.toString({all: false, errors: true})); process.exitCode = 1; return;}
  console.log('Landing compilada en dist/ (' + Math.round(fs.statSync(path.join(dist, 'app.js')).size / 1024) + ' KB de JS)');
});
