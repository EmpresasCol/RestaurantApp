// Sirve dist/ bajo la misma ruta que GitHub Pages (site.config.json → base) para probar rutas y el 404 tal como quedan publicados.
const http = require('http'), fs = require('fs'), path = require('path');
const {base} = require('./site.config.json');
const root = path.join(__dirname, 'dist');
const port = Number(process.env.PORT) || 4388;
const types = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain'};
const notFound = res => res.writeHead(404, {'Content-Type': types['.html']}).end(fs.readFileSync(path.join(root, '404.html')));

http.createServer((req, res) => {
  let route;
  try {route = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);} catch {res.writeHead(400).end(); return;}
  if (route === '/' || route === base.slice(0, -1)) {res.writeHead(302, {Location: base}).end(); return;}
  if (!route.startsWith(base)) return notFound(res);
  let file = path.resolve(root, '.' + route.slice(base.length - 1));
  if (!file.startsWith(root)) {res.writeHead(403).end(); return;}
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) return notFound(res);
  res.writeHead(200, {'Content-Type': types[path.extname(file)] || 'application/octet-stream'});
  fs.createReadStream(file).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`Qpro landing: http://127.0.0.1:${port}${base}`));
