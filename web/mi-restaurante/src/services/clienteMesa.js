// src/services/clienteMesa.js
// Lo que hace el comensal desde el QR sin iniciar sesión: llamar al mesero, seguir los pedidos
// de su visita y recibir avisos. El servidor es la fuente de verdad: el navegador solo guarda la
// llave de la visita (para recuperarla al recargar o reabrir) y la clave de su última llamada.
import { useCallback, useEffect, useRef, useState } from 'react';
import { HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { getApiBaseUrl } from './sesion';
import { reintentoSinFin } from './realtime';

const API = () => getApiBaseUrl();
const claveLlave = (codigo) => `qpro:seguimiento:${codigo}`;
const claveLlamada = (codigo) => `qpro:llamada:${codigo}`;

const leer = (clave) => {
  try { return localStorage.getItem(clave); } catch { return null; }
};
const escribir = (clave, valor) => {
  try {
    if (valor) localStorage.setItem(clave, valor);
    else localStorage.removeItem(clave);
  } catch { /* modo privado: dura lo que dure la página */ }
};

export const leerLlave = (codigo) => (codigo ? leer(claveLlave(codigo)) : null);
export const guardarLlave = (codigo, llave) => codigo && escribir(claveLlave(codigo), llave);
export const leerLlamada = (codigo) => (codigo ? leer(claveLlamada(codigo)) : null);
export const guardarLlamada = (codigo, clave) => codigo && escribir(claveLlamada(codigo), clave);

const mensaje = async (r, respaldo) => {
  try {
    const json = await r.json();
    return json?.message || respaldo;
  } catch {
    return respaldo;
  }
};

const pedir = (ruta, { codigo, llave, ...opciones } = {}) => fetch(`${API()}${ruta}`, {
  ...opciones,
  headers: {
    'Content-Type': 'application/json',
    ...(codigo ? { 'X-Mesa': codigo } : {}),
    ...(llave ? { 'X-Seguimiento': llave } : {}),
    ...opciones.headers,
  },
});

/**
 * Seguimiento de la visita: { estado: 'activo', datos } | { estado: 'cerrada', pagada, mensaje }
 * | { estado: 'sin-llave' }. Lanza Error si no hay conexión (se reintenta luego).
 */
export async function getSeguimiento(codigo, llave) {
  if (!codigo || !llave) return { estado: 'sin-llave' };
  const r = await pedir('/cliente-mesa/seguimiento', { codigo, llave });
  if (r.ok) return { estado: 'activo', datos: await r.json() };
  if (r.status === 410) {
    const j = await r.json().catch(() => ({}));
    return { estado: 'cerrada', pagada: !!j.pagada, mensaje: j.message };
  }
  if (r.status === 404) return { estado: 'sin-llave' };
  throw new Error(await mensaje(r, 'No pudimos actualizar tu pedido.'));
}

export async function unirse(codigo, pin) {
  const r = await pedir('/cliente-mesa/unirse', { method: 'POST', body: JSON.stringify({ codigoMesa: codigo, pin }) });
  if (!r.ok) throw new Error(await mensaje(r, 'No pudimos unirte a la mesa.'));
  return (await r.json()).seguimiento;
}

/** Registra la llamada; la API devuelve la que ya esté viva si alguien de la mesa llamó antes. */
export async function llamarMesero(codigo) {
  const r = await pedir('/cliente-mesa/llamadas', { method: 'POST', codigo, body: JSON.stringify({ codigoMesa: codigo }) });
  if (!r.ok) throw new Error(await mensaje(r, 'No pudimos avisar al mesero. Intenta de nuevo.'));
  return r.json();
}

export async function getLlamada(clave) {
  const r = await pedir(`/cliente-mesa/llamadas/${encodeURIComponent(clave)}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('Sin conexión');
  return r.json();
}

const LLAMADA_VIVA = ['Pendiente', 'EnCamino'];
const LLAMADA_MS = 15000;

/**
 * Estado de la llamada al mesero de esta mesa, recuperable tras recargar (la clave queda en el
 * navegador). Estados: idle | enviando | Pendiente | EnCamino | Atendida | error.
 * Solo muestra "recibida" cuando la API respondió: nunca antes.
 */
export function useLlamada(codigo, estadoServidor) {
  const [llamada, setLlamada] = useState({ estado: 'idle', error: null });
  const enviando = useRef(false);

  const consultar = useCallback(async () => {
    const clave = leerLlamada(codigo);
    if (!clave) return;
    try {
      const l = await getLlamada(clave);
      if (!l) {
        guardarLlamada(codigo, null);
        setLlamada({ estado: 'idle', error: null });
        return;
      }
      // Una llamada resuelta se muestra una vez y luego se olvida.
      if (!LLAMADA_VIVA.includes(l.estado)) guardarLlamada(codigo, null);
      setLlamada((a) => (a.estado === 'enviando' ? a : { estado: l.estado === 'Cerrada' ? 'Atendida' : l.estado, error: null }));
    } catch { /* sin red: se conserva lo último visto */ }
  }, [codigo]);

  useEffect(() => { consultar(); }, [consultar, estadoServidor]);

  const viva = LLAMADA_VIVA.includes(llamada.estado);
  useEffect(() => {
    if (!viva) return undefined;
    const t = setInterval(consultar, LLAMADA_MS);
    const alVolver = () => document.visibilityState === 'visible' && consultar();
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [viva, consultar]);

  const llamar = useCallback(async () => {
    if (!codigo || enviando.current) return;
    enviando.current = true;
    setLlamada({ estado: 'enviando', error: null });
    try {
      const l = await llamarMesero(codigo);
      guardarLlamada(codigo, l.clave);
      setLlamada({ estado: l.estado, error: null });
    } catch (e) {
      setLlamada({ estado: 'error', error: e.message || 'No pudimos avisar al mesero. Intenta de nuevo.' });
    } finally {
      enviando.current = false;
    }
  }, [codigo]);

  const descartar = useCallback(() => setLlamada({ estado: 'idle', error: null }), []);
  return { ...llamada, llamar, descartar };
}

/** La respuesta más nueva gana: una petición que vuelve tarde no pisa a una posterior. */
export function ultimaGana() {
  let turno = 0;
  return (promesa) => {
    const mio = ++turno;
    return promesa.then((valor) => (mio === turno ? { vigente: true, valor } : { vigente: false }));
  };
}

const RESPALDO_MS = 30000;

/**
 * Mantiene el seguimiento al día: SignalR al grupo de la visita mientras la página está abierta,
 * recarga al reconectar, al volver a la pestaña, al recuperar la red o al llegar un aviso del
 * service worker, y un respaldo cada 30 s. Nunca muestra datos de una respuesta atrasada.
 */
export function useSeguimiento(codigo, llave) {
  const [estado, setEstado] = useState({ estado: llave ? 'cargando' : 'sin-llave', datos: null, error: null });
  const turno = useRef(ultimaGana());

  const recargar = useCallback(async () => {
    if (!codigo || !llave) {
      setEstado({ estado: 'sin-llave', datos: null, error: null });
      return;
    }
    try {
      const r = await turno.current(getSeguimiento(codigo, llave));
      if (!r.vigente) return;
      setEstado((anterior) => ({ ...r.valor, datos: r.valor.datos ?? null, error: null, previo: anterior.estado }));
    } catch (e) {
      // Sin red se conserva lo último que se vio y se avisa; el respaldo vuelve a intentar.
      setEstado((anterior) => ({ ...anterior, error: e.message || 'Sin conexión' }));
    }
  }, [codigo, llave]);

  useEffect(() => {
    recargar();
    if (!codigo || !llave) return undefined;

    const conexion = new HubConnectionBuilder()
      .withUrl(`${API()}/hubs/mesa?mesa=${encodeURIComponent(codigo)}`)
      .withAutomaticReconnect(reintentoSinFin)
      .configureLogging(LogLevel.Warning)
      .build();
    const seguir = () => conexion.invoke('Seguir', codigo, llave).catch(() => {});
    conexion.on('cambio', recargar);
    conexion.onreconnected(() => { seguir(); recargar(); });
    conexion.start().then(seguir).catch(() => { /* queda el respaldo */ });

    const alVolver = () => document.visibilityState === 'visible' && recargar();
    const alAviso = (e) => e.data?.tipo === 'qpro:cambio' && recargar();
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('online', recargar);
    navigator.serviceWorker?.addEventListener?.('message', alAviso);
    const t = setInterval(recargar, RESPALDO_MS);

    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('online', recargar);
      navigator.serviceWorker?.removeEventListener?.('message', alAviso);
      conexion.off('cambio');
      if (conexion.state !== HubConnectionState.Disconnected) conexion.stop();
    };
  }, [codigo, llave, recargar]);

  return [estado, recargar];
}

// ── Avisos con la página cerrada (Web Push) ─────────────────────────────

export const pushSoportado = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/** iOS solo permite Web Push si la página se agregó a la pantalla de inicio (16.4 o posterior). */
export const necesitaInstalar = () => {
  if (typeof navigator === 'undefined') return false;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const instalada = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
  return ios && !instalada;
};

const deBase64Url = (texto) => {
  const b64 = texto.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(texto.length / 4) * 4, '=');
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
};

/**
 * Pide permiso (solo tras un toque del comensal) y suscribe este navegador a su visita.
 * Devuelve 'activados' | 'denegado' | 'no-disponible'. Si falla, el seguimiento sigue igual.
 */
export async function activarAvisos(codigo, llave, numeroMesa) {
  if (!pushSoportado()) return 'no-disponible';
  const clave = await pedir('/cliente-mesa/push');
  if (!clave.ok) return 'no-disponible';
  const { clavePublica } = await clave.json();

  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') return 'denegado';

  await navigator.serviceWorker.register(`${process.env.PUBLIC_URL || ''}/sw-qpro.js`);
  const registro = await navigator.serviceWorker.ready;
  // El service worker necesita saber qué visita leer cuando llegue un aviso sin contenido.
  registro.active?.postMessage({ tipo: 'qpro:visita', api: API(), codigo, llave, mesa: numeroMesa, url: window.location.href });

  let sub = await registro.pushManager.getSubscription();
  if (!sub) sub = await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: deBase64Url(clavePublica) });
  const r = await pedir('/cliente-mesa/push', { method: 'POST', codigo, llave, body: JSON.stringify({ endpoint: sub.endpoint }) });
  return r.ok ? 'activados' : 'no-disponible';
}

/** Al cerrar la visita el navegador deja de estar ligado a esta mesa. */
export async function olvidarVisita() {
  if (!pushSoportado()) return;
  try {
    const registro = await navigator.serviceWorker.getRegistration();
    registro?.active?.postMessage({ tipo: 'qpro:olvidar' });
  } catch { /* nada que olvidar */ }
}
