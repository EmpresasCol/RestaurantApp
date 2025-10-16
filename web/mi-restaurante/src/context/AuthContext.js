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

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [esClienteQR, setEsClienteQR] = useState(false);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    verificarSesion();
  }, []);

  const verificarSesion = () => {
    try {
      // Verificar si es cliente QR (tiene parámetro ?mesa=X en URL)
      const params = new URLSearchParams(window.location.search);
      const mesaUrl = params.get('mesa');
      
      if (mesaUrl) {
        // Usuario viene del QR - es un cliente
        setEsClienteQR(true);
        setUsuario({
          rol: 'cliente',
          nombre: 'Cliente',
          mesa: parseInt(mesaUrl)
        });
        setCargando(false);
        return;
      }

      // Verificar sesión guardada
      const usuarioGuardado = localStorage.getItem('usuario');
      const tokenGuardado = localStorage.getItem('token');

      if (usuarioGuardado && tokenGuardado) {
        const user = JSON.parse(usuarioGuardado);
        
        // ⛔ Verificar que no sea mesero
        if (user.rol?.toLowerCase() === 'mesero') {
          console.log('⛔ Mesero detectado en sesión guardada - cerrando');
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
      
      // Llamar a la API para validar credenciales
      const response = await api.login(username, password);
      
      console.log('✅ Respuesta de la API:', response);

      const rol = response.rol?.toLowerCase();

      // ⛔ BLOQUEAR ACCESO A MESEROS
      if (rol === 'mesero') {
        throw new Error('Los meseros deben usar la aplicación móvil. Por favor, descarga la app en tu dispositivo móvil.');
      }

      // 🍳 BLOQUEAR LOGIN DE COCINA - DEBEN USAR URL DIRECTA
      if (rol === 'cocina') {
        throw new Error('COCINA_URL_DIRECTA');
      }

      // ✅ Permitir solo: administrador, caja
      if (!['administrador', 'caja'].includes(rol)) {
        throw new Error('No tienes permisos para acceder al sistema web');
      }

      // Crear objeto de usuario con los datos de la API
      const datosUsuario = {
        id: response.id,
        username: response.nombreUsuario,
        rol: rol,
        nombre: response.nombre
      };

      console.log('✅ Usuario autenticado:', datosUsuario);

      setUsuario(datosUsuario);
      setEsClienteQR(false);
      
      // Guardar en localStorage
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
    // Limpiar parámetros de URL
    window.history.replaceState({}, document.title, window.location.pathname);
    window.location.reload();
  };

  const tienePermiso = (permisosRequeridos) => {
    if (!usuario) return false;
    
    // Cliente QR solo puede ver el menú
    if (esClienteQR) {
      return permisosRequeridos.includes('cliente');
    }

    const rol = usuario.rol?.toLowerCase();

    // ✅ ADMINISTRADOR: Acceso total a TODAS las secciones
    if (rol === 'administrador') {
      return true;
    }

    // ✅ CAJA: Solo Facturación
    if (rol === 'caja') {
      return permisosRequeridos.includes('caja');
    }

    // ✅ COCINA: Solo la sección de cocina
    if (rol === 'cocina') {
      return permisosRequeridos.includes('cocina');
    }

    // ⛔ MESERO: Bloqueado (no debería llegar aquí)
    if (rol === 'mesero') {
      return false;
    }

    // Cualquier otro rol no tiene acceso
    return false;
  };

  const estaAutenticado = !!usuario;

  return (
    <AuthContext.Provider value={{
      usuario,
      esClienteQR,
      estaAutenticado,
      cargando,
      login,
      logout,
      tienePermiso
    }}>
      {children}
    </AuthContext.Provider>
  );
}