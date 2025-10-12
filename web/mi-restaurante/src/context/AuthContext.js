// src/context/AuthContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';
import * as api from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [esClienteQR, setEsClienteQR] = useState(false);

  // Verificar si hay sesión guardada al cargar
  useEffect(() => {
    const usuarioGuardado = localStorage.getItem('usuario');
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
    } else if (usuarioGuardado) {
      // Usuario tiene sesión guardada
      setUsuario(JSON.parse(usuarioGuardado));
    }
    
    setCargando(false);
  }, []);

  const login = async (credenciales) => {
    const { username, password } = credenciales;

    try {
      console.log('🔐 Intentando login con:', username);
      
      // Llamar a la API para validar credenciales
      const response = await api.login(username, password);
      
      console.log('✅ Respuesta de la API:', response);

      // Validar que mesero NO puede acceder a la web
      if (response.rol.toLowerCase() === 'mesero') {
        throw new Error('Los meseros solo pueden acceder desde la aplicación móvil');
      }

      // Crear objeto de usuario con los datos de la API
      const datosUsuario = {
        id: response.id,
        username: response.nombreUsuario,
        rol: response.rol.toLowerCase(),
        nombre: response.nombre
      };

      console.log('✅ Usuario autenticado:', datosUsuario);

      setUsuario(datosUsuario);
      localStorage.setItem('usuario', JSON.stringify(datosUsuario));
      
      return datosUsuario;
    } catch (error) {
      console.error('❌ Error en login:', error);
      throw error;
    }
  };

  const logout = () => {
    console.log('🚪 Cerrando sesión...');
    setUsuario(null);
    setEsClienteQR(false);
    localStorage.removeItem('usuario');
    // Limpiar parámetros de URL
    window.history.replaceState({}, document.title, window.location.pathname);
  };

  const tienePermiso = (permisos) => {
    if (!usuario) return false;
    
    // Cliente QR solo puede ver el menú
    if (esClienteQR) {
      return permisos.includes('cliente');
    }
    
    // Rol de caja tiene acceso a todo
    if (usuario.rol === 'caja') {
      return true;
    }
    
    // Verificar permisos específicos
    return permisos.includes(usuario.rol);
  };

  const value = {
    usuario,
    esClienteQR,
    cargando,
    login,
    logout,
    tienePermiso,
    estaAutenticado: !!usuario
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};