// src/services/realtime.js
// Tiempo real por SignalR. La API solo avisa qué tema cambió ("pedidos", "mesas",
// "domicilios") y cada pantalla vuelve a pedir sus datos por REST.

import { useEffect, useRef } from 'react';
import { HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { EVENTO_SESION_EXPIRADA, getApiBaseUrl, manejarNoAutorizado, obtenerToken } from './sesion';

/**
 * La política por defecto de SignalR se rinde tras 4 intentos (unos 42 s): después de una caída
 * más larga (la API de Render arrancando en frío) el tiempo real no volvía sin recargar la página.
 * Se reintenta siempre, con espera creciente hasta 30 s.
 */
export const reintentoSinFin = {
  nextRetryDelayInMilliseconds: ({ previousRetryCount }) => Math.min(30000, 1000 * 2 ** previousRetryCount),
};

const suscriptores = new Set();
let conexion = null;

const avisar = (tema) => suscriptores.forEach((s) => (tema == null || s.tema === tema) && s.recargar());

const obtenerConexion = () => {
  if (conexion) return conexion;
  conexion = new HubConnectionBuilder()
    .withUrl(`${getApiBaseUrl()}/hubs/qpro`, { accessTokenFactory: () => obtenerToken() || '' })
    .withAutomaticReconnect(reintentoSinFin)
    // Los fallos se informan abajo, una vez y legibles; el registro propio de SignalR los repetía en rojo.
    .configureLogging(LogLevel.None)
    .build();
  conexion.on('cambio', (tema) => avisar(tema));
  // Lo que cambió mientras estaba desconectado se recupera recargando todo.
  conexion.onreconnected(() => avisar(null));
  return conexion;
};

/** La API rechazó el token (vencido, firmado con otra clave, usuario desactivado o con otro rol). */
export const esNoAutorizado = (error) =>
  error?.statusCode === 401 || /Status code '401'/.test(String(error?.message ?? ''));

const conectar = () => {
  if (!obtenerToken()) return;
  const c = obtenerConexion();
  if (c.state !== HubConnectionState.Disconnected) return;
  c.start().catch((error) => {
    // Mismo trato que un 401 del REST: la sesión ya no vale y se vuelve al ingreso.
    if (esNoAutorizado(error)) {
      manejarNoAutorizado(401);
      return;
    }
    // Otro fallo (API arrancando en frío, red): la pantalla sigue con su polling de respaldo.
    console.warn('SignalR no conectó:', error?.message || error);
  });
};

if (typeof window !== 'undefined') {
  window.addEventListener(EVENTO_SESION_EXPIRADA, () => {
    if (conexion) conexion.stop();
  });
}

/** Llama a `recargar` cada vez que la API avisa un cambio en `tema`. */
export function useCambios(tema, recargar) {
  const ref = useRef(recargar);
  ref.current = recargar;

  useEffect(() => {
    const suscriptor = { tema, recargar: () => ref.current() };
    suscriptores.add(suscriptor);
    conectar();
    return () => {
      suscriptores.delete(suscriptor);
    };
  }, [tema]);
}
