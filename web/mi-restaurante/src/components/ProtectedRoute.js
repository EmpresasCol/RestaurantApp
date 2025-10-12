// src/components/ProtectedRoute.js
import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, AlertTriangle } from 'lucide-react';

/**
 * Componente para proteger rutas basándose en permisos
 * 
 * @param {Object} props
 * @param {string[]} props.permisos - Array de roles permitidos
 * @param {React.ReactNode} props.children - Contenido a mostrar si tiene permisos
 * @param {React.ReactNode} props.fallback - Componente alternativo si no tiene permisos
 */
function ProtectedRoute({ permisos, children, fallback }) {
  const { tienePermiso, usuario, esClienteQR } = useAuth();

  // Si tiene permiso, mostrar el contenido
  if (tienePermiso(permisos)) {
    return children;
  }

  // Si se proporciona un fallback personalizado, usarlo
  if (fallback) {
    return fallback;
  }

  // Mensaje por defecto de acceso denegado
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-6">
            <Lock className="text-red-600" size={40} />
          </div>
          
          <h2 className="text-2xl font-bold text-gray-800 mb-3">
            Acceso Restringido
          </h2>
          
          <p className="text-gray-600 mb-6">
            {esClienteQR 
              ? 'Como cliente, solo puedes ver el menú del restaurante.'
              : 'No tienes permisos para acceder a esta sección.'}
          </p>
          
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-orange-600 flex-shrink-0 mt-0.5" size={20} />
              <div className="text-left">
                <p className="text-sm text-orange-800 font-medium mb-1">
                  Usuario actual:
                </p>
                <p className="text-sm text-orange-700">
                  {usuario?.nombre || 'Cliente'} - Rol: {usuario?.rol || 'cliente'}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2 text-xs text-gray-500">
            <p>Permisos requeridos para esta sección:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {permisos.map(permiso => (
                <span key={permiso} className="bg-gray-100 px-3 py-1 rounded-full font-medium">
                  {permiso}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProtectedRoute;