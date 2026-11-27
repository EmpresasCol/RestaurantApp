/**
 * Reduce una foto a `maximo` px por lado y la devuelve como data URI JPEG: una foto del celular
 * (3-5 MB) queda en ~150-300 KB, así sube rápido y no llena la base de datos.
 */
export const reducirImagen = (archivo, maximo = 1000, calidad = 0.82) =>
  new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onerror = reject;
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => resolve(lector.result);
      img.onload = () => {
        const escala = Math.min(1, maximo / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * escala);
        canvas.height = Math.round(img.height * escala);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff'; // una PNG transparente no queda con fondo negro en JPEG
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', calidad));
      };
      img.src = lector.result;
    };
    lector.readAsDataURL(archivo);
  });

/**
 * Reduce el logo a `maximo` px por lado conservando la transparencia (PNG). Si aun así pesa más de
 * lo que acepta la API (~300 kB), lo intenta en WebP y luego en JPEG con fondo blanco.
 */
export const reducirLogo = (archivo, maximo = 512, limite = 400000) =>
  new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onerror = reject;
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Ese archivo no es una imagen que el navegador pueda abrir'));
      img.onload = () => {
        const escala = Math.min(1, maximo / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * escala));
        canvas.height = Math.max(1, Math.round(img.height * escala));
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const png = canvas.toDataURL('image/png');
        if (png.length <= limite) return resolve(png);
        const webp = canvas.toDataURL('image/webp', 0.9);
        if (webp.startsWith('data:image/webp') && webp.length <= limite) return resolve(webp);
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        return resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = lector.result;
    };
    lector.readAsDataURL(archivo);
  });
