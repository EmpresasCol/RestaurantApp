// Marca del restaurante para toda la web: nombre, logo, colores y ajustes de operación.
// Pinta primero lo último guardado en el navegador (sin destello de la marca de fábrica), luego
// lo confirma con la API y se actualiza solo cuando el administrador guarda (tema "configuracion").
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as api from '../services/api';
import { useCambios } from '../services/realtime';
import { CONFIG_FABRICA, aplicarMarca, normalizar } from '../utils/marca';
import logoQpro from '../components/logo.jpg';

const CLAVE = 'qpro-marca';

const leerCache = () => {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) ?? 'null');
  } catch {
    return null;
  }
};

const guardarCache = (config) => {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(config));
  } catch {
    // Sin espacio (logo grande en un navegador lleno): solo se pierde el arranque instantáneo.
  }
};

const MarcaContext = createContext({ ...CONFIG_FABRICA, logoSrc: logoQpro, recargar: async () => {}, guardar: async () => {} });

export function MarcaProvider({ children }) {
  const [config, setConfig] = useState(() => aplicarMarca(leerCache() ?? CONFIG_FABRICA));

  const usar = useCallback((c) => {
    const lista = aplicarMarca(c);
    guardarCache(lista);
    setConfig(lista);
    return lista;
  }, []);

  const recargar = useCallback(async () => {
    try {
      usar(await api.getConfiguracion());
    } catch {
      // API dormida o sin migración: se queda con lo último conocido.
    }
  }, [usar]);

  useEffect(() => { recargar(); }, [recargar]);
  useCambios('configuracion', recargar);

  const guardar = useCallback(async (c) => usar(await api.guardarConfiguracion(c)), [usar]);

  const valor = useMemo(() => ({ ...normalizar(config), logoSrc: config.logo || logoQpro, recargar, guardar }), [config, recargar, guardar]);
  return <MarcaContext.Provider value={valor}>{children}</MarcaContext.Provider>;
}

export const useMarca = () => useContext(MarcaContext);
