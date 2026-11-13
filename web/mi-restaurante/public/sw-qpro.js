/* Service worker del comensal: muestra los avisos de su visita con la página cerrada.
   El push llega sin contenido; aquí se lee el estado real de la visita a la API, así un aviso
   viejo o repetido nunca muestra un estado atrasado ni el de otra visita. */
const CACHE = 'qpro-visita';
const CLAVE = '/__visita';

const guardar = async (visita) => {
  const cache = await caches.open(CACHE);
  if (visita) await cache.put(CLAVE, new Response(JSON.stringify(visita)));
  else await cache.delete(CLAVE);
};

const leer = async () => {
  const r = await (await caches.open(CACHE)).match(CLAVE);
  return r ? r.json() : null;
};

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('message', (e) => {
  if (e.data?.tipo === 'qpro:visita') e.waitUntil(guardar(e.data));
  if (e.data?.tipo === 'qpro:olvidar') e.waitUntil(guardar(null));
});

const ETIQUETAS = {
  Recibido: 'recibimos tu pedido',
  EnPreparacion: 'tu pedido se está preparando',
  Listo: 'tu pedido está listo y va para tu mesa',
  Entregado: 'tu pedido ya está en la mesa',
};

const resumen = (datos) => {
  if (datos.llamada === 'EnCamino') return 'Un mesero va para tu mesa.';
  const activos = datos.pedidos.filter((p) => ETIQUETAS[p.estado]);
  const listo = activos.find((p) => p.estado === 'Listo');
  const ultimo = listo || activos[activos.length - 1];
  return ultimo ? `Mesa ${datos.mesaNumero}: ${ETIQUETAS[ultimo.estado]}.` : `Mesa ${datos.mesaNumero}: tu cuenta se actualizó.`;
};

self.addEventListener('push', (e) => {
  e.waitUntil((async () => {
    const visita = await leer();
    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Con la página a la vista basta recargarla; la notificación es para cuando no se ve.
    ventanas.forEach((c) => c.postMessage({ tipo: 'qpro:cambio' }));
    if (ventanas.some((c) => c.visibilityState === 'visible')) return;

    let cuerpo = 'Tu pedido tiene novedades. Ábrelo para verlas.';
    if (visita) {
      try {
        const r = await fetch(`${visita.api}/cliente-mesa/seguimiento`, {
          headers: { 'X-Mesa': visita.codigo, 'X-Seguimiento': visita.llave },
        });
        if (r.status === 410) {
          const j = await r.json().catch(() => ({}));
          cuerpo = j.message || 'Tu visita terminó.';
          await guardar(null);
        } else if (r.ok) {
          cuerpo = resumen(await r.json());
        }
      } catch { /* sin red: aviso genérico, al abrir se lee el estado real */ }
    }
    // Una sola notificación por visita: la nueva reemplaza a la anterior.
    await self.registration.showNotification('Qpro', {
      body: cuerpo,
      tag: 'qpro-visita',
      renotify: true,
      icon: 'logo192.png',
      data: { url: visita?.url },
    });
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url || self.registration.scope;
  e.waitUntil((async () => {
    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const abierta = ventanas.find((c) => c.url.split('#')[0] === url.split('#')[0]);
    if (abierta) {
      abierta.postMessage({ tipo: 'qpro:cambio' });
      return abierta.focus();
    }
    return self.clients.openWindow(url);
  })());
});
