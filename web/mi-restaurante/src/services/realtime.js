// src/services/realtime.js
// Tiempo real por SignalR. La API solo avisa qué tema cambió ("pedidos", "mesas",
// "domicilios") y cada pantalla vuelve a pedir sus datos por REST.

import { useEffect, useRef } from 'react';
import { HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { EVENTO_SESION_EXPIRADA, getApiBaseUrl, obtenerToken } from './sesion';

const suscriptores = new Set();
let conexion = null;

const avisar = (tema) => suscriptores.forEach((s) => (tema == null || s.tema === tema) && s.recargar());

const obtenerConexion = () => {
  if (conexion) return conexion;
  conexion = new HubConnectionBuilder()
    .withUrl(`${getApiBaseUrl()}/hubs/qpro`, { accessTokenFactory: () => obtenerToken() || '' })
    .withAutomaticReconnect()
    .configureLogging(LogLevel.Warning)
    .build();
  conexion.on('cambio', (tema) => avisar(tema));
  // Lo que cambió mientras estaba desconectado se recupera recargando todo.
  conexion.onreconnected(() => avisar(null));
  return conexion;
};

const conectar = () => {
  if (!obtenerToken()) return;
  const c = obtenerConexion();
  if (c.state !== HubConnectionState.Disconnected) return;
  // Si falla, la pantalla sigue con su polling de respaldo.
  c.start().catch((error) => console.warn('SignalR no conectó:', error?.message || error));
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
