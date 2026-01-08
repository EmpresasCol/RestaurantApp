// src/components/domicilios/DashboardDomicilios.js
import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Clock, 
  CheckCircle, 
  XCircle,
  DollarSign,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import * as api from '../../services/api';

function DashboardDomicilios() {
  const [estadisticas, setEstadisticas] = useState(null);
  const [domiciliosActivos, setDomiciliosActivos] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    cargarDatos();
    const interval = setInterval(cargarDatos, 30000); // Actualizar cada 30 segundos
    return () => clearInterval(interval);
  }, []);

  const cargarDatos = async () => {
    try {
      const [statsData, activosData] = await Promise.all([
        api.getDomiciliosEstadisticas(),
        api.getDomiciliosActivos()
      ]);
      
      setEstadisticas(statsData);
      setDomiciliosActivos(activosData);
    } catch (error) {
      console.error('Error al cargar datos:', error);
    } finally {
      setCargando(false);
    }
  };

  const formatearMoneda = (valor) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(valor);

  if (cargando) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-amber-700 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Hoy</p>
              <p className="text-3xl font-bold text-gray-900">
                {estadisticas?.totalDomicilios || 0}
              </p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <Package className="h-8 w-8 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">En Proceso</p>
              <p className="text-3xl font-bold text-yellow-600">
                {(estadisticas?.pendientes || 0) + 
                 (estadisticas?.enPreparacion || 0) + 
                 (estadisticas?.enCamino || 0)}
              </p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-lg">
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Entregados</p>
              <p className="text-3xl font-bold text-green-600">
                {estadisticas?.entregados || 0}
              </p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-amber-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Ventas Hoy</p>
              <p className="text-2xl font-bold text-amber-700">
                {formatearMoneda(estadisticas?.totalVentas || 0)}
              </p>
            </div>
            <div className="bg-amber-100 p-3 rounded-lg">
              <DollarSign className="h-8 w-8 text-amber-700" />
            </div>
          </div>
        </div>
      </div>

      {/* Domicilios Activos */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-amber-700 to-orange-600">
          <h2 className="text-xl font-bold text-white">
            🚲 Domicilios Activos ({domiciliosActivos.length})
          </h2>
        </div>
        
        <div className="p-6">
          {domiciliosActivos.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Package className="h-10 w-10 text-gray-400" />
              </div>
              <p className="text-gray-500 text-lg">No hay domicilios activos</p>
              <p className="text-gray-400 text-sm mt-2">Los nuevos pedidos aparecerán aquí</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {domiciliosActivos.map((domicilio) => (
                <div 
                  key={domicilio.id}
                  className="border-2 border-gray-200 rounded-lg p-4 hover:border-amber-700 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-gray-900">#{domicilio.id}</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        domicilio.estado === 'Pendiente' ? 'bg-yellow-100 text-yellow-800' :
                        domicilio.estado === 'EnPreparacion' ? 'bg-blue-100 text-blue-800' :
                        domicilio.estado === 'EnCamino' ? 'bg-purple-100 text-purple-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {domicilio.estado === 'EnPreparacion' ? 'En Preparación' :
                         domicilio.estado === 'EnCamino' ? 'En Camino' :
                         domicilio.estado}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {new Date(domicilio.fechaPedido).toLocaleTimeString('es-CO', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-700">Cliente:</span>
                      <span className="text-gray-900">{domicilio.clienteNombre}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-700">Teléfono:</span>
                      <span className="text-gray-900">{domicilio.clienteTelefono}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-semibold text-gray-700">Dirección:</span>
                      <span className="text-gray-900">{domicilio.direccionCompleta}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-700">Total:</span>
                      <span className="text-green-600 font-bold">{formatearMoneda(domicilio.total)}</span>
                    </div>
                  </div>

                  {domicilio.notasCliente && (
                    <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                      <span className="font-semibold">Notas:</span> {domicilio.notasCliente}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Información adicional */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-blue-50 rounded-xl p-6 border-2 border-blue-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            <h3 className="font-semibold text-gray-900">Ticket Promedio</h3>
          </div>
          <p className="text-3xl font-bold text-blue-600">
            {formatearMoneda(estadisticas?.ticketPromedio || 0)}
          </p>
        </div>

        <div className="bg-green-50 rounded-xl p-6 border-2 border-green-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-green-600 p-2 rounded-lg">
              <CheckCircle className="h-6 w-6 text-white" />
            </div>
            <h3 className="font-semibold text-gray-900">Tasa de Entrega</h3>
          </div>
          <p className="text-3xl font-bold text-green-600">
            {estadisticas?.totalDomicilios > 0 
              ? Math.round((estadisticas.entregados / estadisticas.totalDomicilios) * 100)
              : 0}%
          </p>
        </div>

        <div className="bg-red-50 rounded-xl p-6 border-2 border-red-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-red-600 p-2 rounded-lg">
              <XCircle className="h-6 w-6 text-white" />
            </div>
            <h3 className="font-semibold text-gray-900">Cancelados</h3>
          </div>
          <p className="text-3xl font-bold text-red-600">
            {estadisticas?.cancelados || 0}
          </p>
        </div>
      </div>
    </div>
  );
}

export default DashboardDomicilios;