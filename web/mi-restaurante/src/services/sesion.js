// src/services/sesion.js
// Sesión del personal: token JWT emitido por la API y datos de usuario en localStorage.

const CLAVE_TOKEN = 'token';
const CLAVE_USUARIO = 'usuario';
export const EVENTO_SESION_EXPIRADA = 'qpro:sesion-expirada';

export const getApiBaseUrl = () => {
  if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      // Puerto 3001 = Nginx en Docker, que proxia /api
      if (window.location.port === '3001') return '/api';
      return 'http://localhost:5000/api';
    }
    // En producción REACT_APP_API_URL debe estar configurada; si falta, mismo origen.
    return `${window.location.protocol}//${window.location.host}/api`;
  }
  return '/api';
};

const leer = (clave) => {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
};

export const obtenerToken = () => leer(CLAVE_TOKEN);

export const obtenerUsuarioGuardado = () => {
  try {
    return JSON.parse(leer(CLAVE_USUARIO)) || null;
  } catch {
    return null;
  }
};

/**
 * Lee el payload de un JWT vigente. No verifica la firma (eso lo hace la API en cada
 * petición); sirve para que la interfaz no confíe en un rol escrito a mano en localStorage.
 * Devuelve null si no es un JWT o ya expiró.
 */
export const leerToken = (token) => {
  const partes = typeof token === 'string' ? token.split('.') : [];
  if (partes.length !== 3) return null;
  try {
    const base64 = partes[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(json);
    if (!payload.exp || payload.exp * 1000 <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
};

export const guardarSesion = (usuario, token) => {
  try {
    localStorage.setItem(CLAVE_USUARIO, JSON.stringify(usuario));
    localStorage.setItem(CLAVE_TOKEN, token);
  } catch {
    // Sin almacenamiento (modo privado): la sesión dura hasta recargar.
  }
};

export const borrarSesion = () => {
  try {
    localStorage.removeItem(CLAVE_USUARIO);
    localStorage.removeItem(CLAVE_TOKEN);
  } catch {
    // nada que borrar
  }
};

export const encabezadosAuth = () => {
  const token = obtenerToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/** Un 401 con token guardado = sesión vencida o inválida: se cierra y se avisa a la app. */
export const manejarNoAutorizado = (status) => {
  if (status === 401 && obtenerToken()) {
    borrarSesion();
    window.dispatchEvent(new Event(EVENTO_SESION_EXPIRADA));
  }
};
