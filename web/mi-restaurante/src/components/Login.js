// src/components/Login.js
import React, { useState } from 'react';
import { LogIn, Lock, User, AlertCircle, Smartphone, ChefHat, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import logo from './logo.jpg';


function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [mostrarModalMesero, setMostrarModalMesero] = useState(false);
  const [mostrarModalCocina, setMostrarModalCocina] = useState(false);
  const [mostrarPassword, setMostrarPassword] = useState(false); // ✅ NUEVO ESTADO
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);

    try {
      await login({ username, password });
    } catch (err) {
      if (err.message === 'COCINA_URL_DIRECTA') {
        setMostrarModalCocina(true);
      }
      else if (err.message.includes('mesero') || err.message.includes('móvil')) {
        setMostrarModalMesero(true);
      } else {
        setError(err.message);
      }
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-500 via-orange-600 to-red-600 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-full shadow-lg mb-4">
          <img
            src={logo}
            alt="Logo del restaurante"
            className="w-16 h-16 object-contain rounded-full"/>

          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Restaurante Délice</h1>
          <p className="text-orange-100">Sistema de Gestión</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
            Iniciar Sesión
          </h2>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <p className="text-red-800 font-medium text-sm">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Campo Usuario */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                Usuario
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="text-gray-400" size={20} />
                </div>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Ingrese su usuario"
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Campo Contraseña con Ojo */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="text-gray-400" size={20} />
                </div>
                <input
                  id="password"
                  type={mostrarPassword ? "text" : "password"} // ✅ TOGGLE TIPO
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Ingrese su contraseña"
                  required
                  autoComplete="current-password"
                />
                {/* ✅ BOTÓN PARA MOSTRAR/OCULTAR CONTRASEÑA */}
                <button
                  type="button"
                  onClick={() => setMostrarPassword(!mostrarPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {mostrarPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Botón Submit */}
            <button
              type="submit"
              disabled={cargando}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cargando ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Iniciando sesión...</span>
                </>
              ) : (
                <>
                  <LogIn size={20} />
                  <span>Iniciar Sesión</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              Acceso disponible para Administrador, Caja y Cocina
            </p>
            <p className="text-xs text-blue-600 text-center mt-2 font-medium">
              📱 Meseros: Usar aplicación móvil
            </p>
          </div>
        </div>

        <p className="text-center text-white text-sm mt-6 opacity-90">
          © 2024 Restaurante Délice. Todos los derechos reservados.
        </p>
      </div>

      {/* Modal para Meseros */}
      {mostrarModalMesero && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Smartphone className="text-blue-600" size={32} />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Acceso para Meseros
              </h3>
              <p className="text-gray-600">
                Los usuarios con rol de <strong>Mesero</strong> deben usar la aplicación móvil
              </p>
            </div>

            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-800 text-center">
                📱 Descarga la app móvil para acceder con tu cuenta de mesero
              </p>
            </div>

            <button
              onClick={() => {
                setMostrarModalMesero(false);
                setUsername('');
                setPassword('');
              }}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg font-semibold transition-colors"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* Modal para Cocina */}
      {mostrarModalCocina && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ChefHat className="text-orange-600" size={32} />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Pantalla de Cocina
              </h3>
              <p className="text-gray-600">
                El personal de <strong>Cocina</strong> debe acceder a través del enlace directo
              </p>
            </div>

            <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-orange-800 text-center font-medium mb-2">
                🔗 Usa este enlace en la tablet/pantalla de cocina:
              </p>
              <div className="bg-white border border-orange-300 rounded-lg p-3 mb-2">
              <code className="text-xs text-gray-700 break-all">
                {`${window.location.origin}/RestaurantApp/?cocina=true`}
              </code>

              </div>
              <button
                onClick={() => {
                  const enlace = `${window.location.origin}/RestaurantApp/?cocina=true`;
                  navigator.clipboard.writeText(enlace);
                  alert('✅ Enlace copiado al portapapeles');
                }}
                className="w-full text-xs bg-orange-100 hover:bg-orange-200 text-orange-800 py-2 rounded-lg font-medium transition-colors"
              >
                📋 Copiar enlace
              </button>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-6">
              <p className="text-xs text-green-800 text-center">
                💡 <strong>Tip:</strong> Guarda el enlace como favorito o inicio automático en el dispositivo de cocina
              </p>
            </div>

            <button
              onClick={() => {
                setMostrarModalCocina(false);
                setUsername('');
                setPassword('');
              }}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-semibold transition-colors"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Login;