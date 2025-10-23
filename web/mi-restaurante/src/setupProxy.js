module.exports = function(app) {
  // Middleware para forzar UTF-8 en todas las respuestas
  app.use((req, res, next) => {
    // Establecer header de contenido con UTF-8
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    
    // Headers adicionales de seguridad (opcional pero recomendado)
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    
    // Log para debugging (opcional - comentar en producción)
    if (process.env.NODE_ENV === 'development') {
      console.log(`[UTF-8 Proxy] ${req.method} ${req.url} - Content-Type: text/html; charset=utf-8`);
    }
    
    next();
  });

  // Middleware adicional para archivos estáticos
  app.use((req, res, next) => {
    const url = req.url.toLowerCase();
    
    // Para archivos JavaScript
    if (url.endsWith('.js') || url.endsWith('.jsx')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    }
    
    // Para archivos CSS
    else if (url.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
    }
    
    // Para archivos JSON
    else if (url.endsWith('.json')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    
    // Para archivos HTML
    else if (url.endsWith('.html') || url.endsWith('.htm')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    }
    
    next();
  });
};

/**
 * INSTRUCCIONES DE USO:
 * 
 * 1. Copiar este archivo a la carpeta 'src/' de tu proyecto React
 * 2. Reiniciar el servidor de desarrollo: Ctrl+C y luego npm start
 * 3. Limpiar caché del navegador: Ctrl+Shift+Delete
 * 4. Refrescar la página: Ctrl+F5 (refresh forzado)
 * 
 * Si el problema persiste:
 * - Verifica que los archivos fuente estén guardados en UTF-8
 * - Verifica que public/index.html tenga: <meta charset="UTF-8">
 * - Prueba en modo incógnito del navegador
 * 
 * NOTA: Este archivo solo funciona en modo desarrollo (npm start).
 * Para producción, usa .htaccess (Apache) o nginx.conf (Nginx).
 */
