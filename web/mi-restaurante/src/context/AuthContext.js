// src/context/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import * as api from '../services/api';

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

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [esClienteQR, setEsClienteQR] = useState(false);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    verificarSesion();
  }, []);

  const verificarSesion = () => {
    try {
      // Cliente QR (parámetro ?mesa=X en URL)
      const params = new URLSearchParams(window.location.search);
      const mesaUrl = params.get('mesa');

      if (mesaUrl) {
        setEsClienteQR(true);
        setUsuario({
          rol: 'cliente',
          nombre: 'Cliente',
          mesa: parseInt(mesaUrl, 10),
        });
        setCargando(false);
        return;
      }

      // Sesión guardada
      const usuarioGuardado = localStorage.getItem('usuario');
      const tokenGuardado = localStorage.getItem('token');

      if (usuarioGuardado && tokenGuardado) {
        const user = JSON.parse(usuarioGuardado);
        const rol = user.rol?.toLowerCase();

        // Bloquear roles no permitidos en sesión persistida
        if (!ROLES_WEB_PERMITIDOS.includes(rol)) {
          console.log(`⛔ Rol no permitido en sesión persistida: ${rol} - cerrando`);
          localStorage.removeItem('usuario');
          localStorage.removeItem('token');
          setUsuario(null);
        } else {
          setUsuario(user);
        }
      }
    } catch (error) {
      console.error('Error al verificar sesión:', error);
      localStorage.removeItem('usuario');
      localStorage.removeItem('token');
    } finally {
      setCargando(false);
    }
  };

  const login = async (credenciales) => {
    const { username, password } = credenciales;

    try {
      console.log('🔐 Intentando login con:', username);

      const response = await api.login(username, password);
      console.log('✅ Respuesta de la API:', response);

      const rol = response.rol?.toLowerCase();

      // Bloquear meseros: deben usar la app móvil
      if (rol === 'mesero') {
        throw new Error(
          'Los meseros deben usar la aplicación móvil. Por favor, descarga la app en tu dispositivo móvil.'
        );
      }

      // Validar que el rol esté permitido en la web
      if (!ROLES_WEB_PERMITIDOS.includes(rol)) {
        throw new Error('No tienes permisos para acceder al sistema web');
      }

      const datosUsuario = {
        id: response.id,
        username: response.nombreUsuario,
        rol,
        nombre: response.nombre,
      };

      console.log('✅ Usuario autenticado:', datosUsuario);

      setUsuario(datosUsuario);
      setEsClienteQR(false);

      localStorage.setItem('usuario', JSON.stringify(datosUsuario));
      if (response.token) {
        localStorage.setItem('token', response.token);
      }

      return datosUsuario;
    } catch (error) {
      console.error('❌ Error en login:', error);
      throw new Error(error.message || 'Error al iniciar sesión');
    }
  };

  const logout = () => {
    console.log('🚪 Cerrando sesión...');
    setUsuario(null);
    setEsClienteQR(false);
    localStorage.removeItem('usuario');
    localStorage.removeItem('token');
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
