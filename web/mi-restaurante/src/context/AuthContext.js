// src/context/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import * as api from '../services/api';
import {
  EVENTO_SESION_EXPIRADA,
  borrarSesion,
  guardarSesion,
  leerToken,
  obtenerToken,
  obtenerUsuarioGuardado,
} from '../services/sesion';

const AuthContext = createContext();

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
}

// Roles permitidos en la web. Mesero está bloqueado: usa la app móvil.
const ROLES_WEB_PERMITIDOS = ['administrador', 'caja', 'cocina'];

// El QR trae ?m=<código secreto de la mesa>. El número lo da la API a partir del código,
// así el comensal no puede cambiar el enlace para pedir a nombre de otra mesa.
// Un QR viejo (?mesa=<id>) abre la carta en modo consulta, sin poder pedir.
export const leerMesaDeUrl = () => {
  const params = new URLSearchParams(window.location.search);
  const codigo = params.get('m');
  if (codigo && /^[a-z0-9]{8,64}$/i.test(codigo)) return { codigoMesa: codigo };
  if (codigo || params.has('mesa')) return { codigoMesa: null };
  return null;
};

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [esClienteQR, setEsClienteQR] = useState(false);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    verificarSesion();
    const alExpirar = () => {
      setUsuario(null);
      setEsClienteQR(false);
    };
    window.addEventListener(EVENTO_SESION_EXPIRADA, alExpirar);
    return () => window.removeEventListener(EVENTO_SESION_EXPIRADA, alExpirar);
  }, []);

  const verificarSesion = () => {
    try {
      // Comensal que entra por el QR de su mesa
      const mesaQR = leerMesaDeUrl();
      if (mesaQR) {
        setEsClienteQR(true);
        setUsuario({ rol: 'cliente', nombre: 'Cliente', codigoMesa: mesaQR.codigoMesa });
        return;
      }

      // Sesión guardada: el rol sale del JWT vigente, no de lo que diga localStorage.
      const payload = leerToken(obtenerToken());
      const rol = payload?.role?.toLowerCase();
      if (!payload || !ROLES_WEB_PERMITIDOS.includes(rol)) {
        borrarSesion();
        return;
      }

      const guardado = obtenerUsuarioGuardado() || {};
      setUsuario({ ...guardado, id: Number(payload.sub), rol });
    } finally {
      setCargando(false);
    }
  };

  const login = async (credenciales) => {
    const { username, password } = credenciales;

    try {
      const response = await api.login(username, password);
      const rol = response.rol?.toLowerCase();

      // Bloquear meseros: deben usar la aplicación móvil
      if (rol === 'mesero') {
        throw new Error(
          'Los meseros deben usar la aplicación móvil. Por favor, descarga la app en tu dispositivo móvil.'
        );
      }

      if (!ROLES_WEB_PERMITIDOS.includes(rol)) {
        throw new Error('No tienes permisos para acceder al sistema web');
      }

      if (!leerToken(response.token)) {
        throw new Error('El servidor no devolvió una sesión válida. Intenta de nuevo.');
      }

      const datosUsuario = {
        id: response.id,
        username: response.nombreUsuario,
        rol,
        nombre: response.nombre,
      };

      guardarSesion(datosUsuario, response.token);
      setUsuario(datosUsuario);
      setEsClienteQR(false);

      return datosUsuario;
    } catch (error) {
      throw new Error(error.message || 'Error al iniciar sesión');
    }
  };

  const logout = () => {
    setUsuario(null);
    setEsClienteQR(false);
    borrarSesion();
    window.history.replaceState({}, document.title, window.location.pathname);
    window.location.reload();
  };

  const tienePermiso = (permisosRequeridos) => {
    if (!usuario) return false;

    if (esClienteQR) {
      return permisosRequeridos.includes('cliente');
    }

    const rol = usuario.rol?.toLowerCase();

    // ADMINISTRADOR: acceso total
    if (rol === 'administrador') return true;

    // CAJA: solo lo permitido por la lista
    if (rol === 'caja') return permisosRequeridos.includes('caja');

    // COCINA: solo la sección de cocina
    if (rol === 'cocina') return permisosRequeridos.includes('cocina');

    // MESERO u otros: bloqueado
    return false;
  };

  const estaAutenticado = !!usuario;

  return (
    <AuthContext.Provider
      value={{
        usuario,
        esClienteQR,
        estaAutenticado,
        cargando,
        login,
        logout,
        tienePermiso,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
