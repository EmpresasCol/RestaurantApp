// src/Domicilios.js
import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Package, 
  Truck, 
  CheckCircle, 
  XCircle, 
  MapPin, 
  Phone, 
  User, 
  DollarSign, 
  Clock,
  Plus,
  RefreshCw,
  Edit2,
  Save
} from 'lucide-react';
import { 
  getDomicilios, 
  getDomiciliosActivos, 
  getEstadisticasDomicilios,
  actualizarEstadoDomicilio,
  actualizarMetodoPagoDomicilio
} from './services/domiciliosApi';

// ✅ SIN "EnPreparacion"
const ESTADOS = {
  EnProceso: { color: 'bg-yellow-100 text-yellow-800', icon: Package, label: 'En Proceso' },
  EnCamino: { color: 'bg-purple-100 text-purple-800', icon: Truck, label: 'En Camino' },
  Entregado: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Entregado' },
  Cancelado: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Cancelado' }
};

function Domicilios({ onNuevoDomicilio }) {
  const [domicilios, setDomicilios] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState('activos');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [estadisticas, setEstadisticas] = useState(null);
  const [refrescando, setRefrescando] = useState(false);
  
  const [editandoPago, setEditandoPago] = useState(null);
  const [nuevoMetodoPago, setNuevoMetodoPago] = useState('');
  const [nuevoPagadoAnticipado, setNuevoPagadoAnticipado] = useState(false);

  useEffect(() => {
    cargarDatos();
    
    const interval = setInterval(() => {
      cargarDatos(true);
    }, 30000);
    
    return () => clearInterval(interval);
  }, [filtroEstado]);

  const cargarDatos = async (silencioso = false) => {
    try {
      if (!silencioso) {
        setLoading(true);
      } else {
        setRefrescando(true);
      }

      const [domiciliosData, estadisticasData] = await Promise.all([
        filtroEstado === 'activos' ? getDomiciliosActivos() : getDomicilios(),
        getEstadisticasDomicilios()
      ]);

      setDomicilios(Array.isArray(domiciliosData) ? domiciliosData : []);
      setEstadisticas(estadisticasData);
      setError(null);
    } catch (err) {
      console.error('Error al cargar datos:', err);
      setDomicilios([]);
      setError('Error al cargar domicilios: ' + err.message);
    } finally {
      setLoading(false);
      setRefrescando(false);
    }
  };

  const cambiarEstado = async (domicilioId, nuevoEstado) => {
    try {
      await actualizarEstadoDomicilio(domicilioId, nuevoEstado);
      await cargarDatos(true);
    } catch (err) {
      alert('Error al cambiar estado: ' + err.message);
    }
  };

  const iniciarEdicionPago = (domicilio) => {
    setEditandoPago(domicilio.id);
    setNuevoMetodoPago(domicilio.metodoPago);
    setNuevoPagadoAnticipado(domicilio.pagadoAnticipado);
  };

  const guardarMetodoPago = async (domicilioId) => {
    try {
      await actualizarMetodoPagoDomicilio(domicilioId, nuevoMetodoPago, nuevoPagadoAnticipado);
      setEditandoPago(null);
      await cargarDatos(true);
    } catch (err) {
      alert('Error al actualizar método de pago: ' + err.message);
    }
  };

  const cancelarEdicionPago = () => {
    setEditandoPago(null);
    setNuevoMetodoPago('');
    setNuevoPagadoAnticipado(false);
  };

  // ✅ Filtro sin "EnPreparacion"
  const domiciliosFiltrados = domicilios.filter(d => {
    if (filtroEstado === 'todos') return true;
    if (filtroEstado === 'activos') {
      return ['EnProceso', 'EnCamino'].includes(d.estado);
    }
    return d.estado === filtroEstado;
  });

  const formatearFecha = (fecha) => {
    return new Date(fecha).toLocaleString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatearMoneda = (valor) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(valor);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <div className="text-xl text-gray-600">Cargando domicilios...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">🚲 Domicilios QPro</h1>
              <p className="text-gray-600">Gestión de pedidos a domicilio</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => cargarDatos()}
                disabled={refrescando}
                className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-5 h-5 ${refrescando ? 'animate-spin' : ''}`} />
                Refrescar
              </button>
              <button
                onClick={onNuevoDomicilio}
                className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-lg"
              >
                <Plus className="w-5 h-5" />
                Nuevo Domicilio
              </button>
            </div>
          </div>
        </div>

        {/* Estadísticas */}
        {estadisticas && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Hoy</p>
                  <p className="text-2xl font-bold text-gray-900">{estadisticas.totalDomicilios}</p>
                </div>
                <Package className="w-8 h-8 text-blue-500" />
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">En Proceso</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {estadisticas.enPreparacion + estadisticas.enCamino}
                  </p>
                </div>
                <Bell className="w-8 h-8 text-yellow-500" />
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Entregados</p>
                  <p className="text-2xl font-bold text-green-600">{estadisticas.entregados}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Ventas Hoy</p>
                  <p className="text-xl font-bold text-blue-600">{formatearMoneda(estadisticas.totalVentas)}</p>
                </div>
                <DollarSign className="w-8 h-8 text-blue-500" />
              </div>
            </div>
          </div>
        )}

        {/* Filtros - ✅ SIN "EnPreparacion" */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap gap-2">
            {['activos', 'todos', 'EnProceso', 'EnCamino', 'Entregado', 'Cancelado'].map(estado => (
              <button
                key={estado}
                onClick={() => setFiltroEstado(estado)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filtroEstado === estado
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {estado === 'todos' ? 'Todos' : estado === 'activos' ? 'Activos' : ESTADOS[estado]?.label || estado}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Lista de Domicilios */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {domiciliosFiltrados.map(domicilio => {
            const EstadoConfig = ESTADOS[domicilio.estado];
            const IconoEstado = EstadoConfig?.icon || Bell;
            
            return (
              <div key={domicilio.id} className="bg-white rounded-lg shadow-lg overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-600 to-orange-500 text-white p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold">#{domicilio.id}</span>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${EstadoConfig?.color || ''}`}>
                        <IconoEstado className="w-4 h-4 inline mr-1" />
                        {EstadoConfig?.label || domicilio.estado}
                      </span>
                      <span className="bg-purple-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                        🚲 DOMICILIO
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm opacity-90">Pedido</div>
                      <div className="text-xs">{formatearFecha(domicilio.fechaPedido)}</div>
                    </div>
                  </div>
                </div>

                {/* Contenido */}
                <div className="p-4">
                  {/* Cliente */}
                  <div className="mb-4">
                    <div className="flex items-start gap-2 mb-2">
                      <User className="w-5 h-5 text-gray-500 mt-0.5" />
                      <div>
                        <p className="font-semibold text-gray-900">{domicilio.clienteNombre}</p>
                        <p className="text-sm text-gray-600 flex items-center gap-1">
                          <Phone className="w-4 h-4" />
                          {domicilio.clienteTelefono}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Dirección */}
                  <div className="mb-4 bg-gray-50 p-3 rounded-lg">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-5 h-5 text-red-500 mt-0.5" />
                      <div>
                        <p className="font-medium text-gray-900">{domicilio.direccionCompleta}</p>
                        {domicilio.barrio && (
                          <p className="text-sm text-gray-600">Barrio: {domicilio.barrio}</p>
                        )}
                        {domicilio.referenciasAdicionales && (
                          <p className="text-sm text-gray-600 italic mt-1">
                            📍 {domicilio.referenciasAdicionales}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Detalles del pedido */}
                  <div className="mb-4">
                    <h4 className="font-semibold text-gray-900 mb-2">Pedido:</h4>
                    <div className="space-y-1">
                      {domicilio.detalles.map(detalle => (
                        <div key={detalle.id} className="flex justify-between text-sm">
                          <span className="text-gray-700">
                            <span className="font-medium">{detalle.cantidad}x</span> {detalle.platilloNombre}
                          </span>
                          <span className="text-gray-900 font-medium">
                            {formatearMoneda(detalle.subtotal)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Totales */}
                  <div className="border-t pt-3 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Subtotal:</span>
                      <span className="text-gray-900">{formatearMoneda(domicilio.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Envío:</span>
                      <span className="text-gray-900">{formatearMoneda(domicilio.costoEnvio)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold border-t pt-2">
                      <span className="text-gray-900">Total:</span>
                      <span className="text-green-600">{formatearMoneda(domicilio.total)}</span>
                    </div>
                    
                    {/* Método de pago editable */}
                    <div className="border-t pt-2 mt-2">
                      {editandoPago === domicilio.id ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">💳</span>
                            <select
                              value={nuevoMetodoPago}
                              onChange={(e) => setNuevoMetodoPago(e.target.value)}
                              className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                            >
                              <option value="Efectivo">Efectivo</option>
                              <option value="Transferencia">Transferencia</option>
                              <option value="Tarjeta">Tarjeta</option>
                              <option value="Nequi">Nequi</option>
                              <option value="Daviplata">Daviplata</option>
                            </select>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`pagado-${domicilio.id}`}
                              checked={nuevoPagadoAnticipado}
                              onChange={(e) => setNuevoPagadoAnticipado(e.target.checked)}
                              className="w-4 h-4"
                            />
                            <label htmlFor={`pagado-${domicilio.id}`} className="text-xs text-gray-600">
                              Pagado anticipadamente
                            </label>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => guardarMetodoPago(domicilio.id)}
                              className="flex-1 bg-green-600 hover:bg-green-700 text-white py-1 px-3 rounded text-sm flex items-center justify-center gap-1"
                            >
                              <Save className="w-3 h-3" />
                              Guardar
                            </button>
                            <button
                              onClick={cancelarEdicionPago}
                              className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-1 px-3 rounded text-sm"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-gray-600">
                            💳 {domicilio.metodoPago} {domicilio.pagadoAnticipado && '(Pagado)'}
                          </div>
                          <button
                            onClick={() => iniciarEdicionPago(domicilio)}
                            className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-xs"
                          >
                            <Edit2 className="w-3 h-3" />
                            Editar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Notas */}
                  {domicilio.notasCliente && (
                    <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
                      <span className="font-medium">Notas: </span>
                      {domicilio.notasCliente}
                    </div>
                  )}

                  {/* Domiciliario */}
                  {domicilio.domiciliarioNombre && (
                    <div className="mt-3 text-sm text-gray-600">
                      🚴 Domiciliario: <span className="font-medium">{domicilio.domiciliarioNombre}</span>
                    </div>
                  )}

                  {/* Tiempo estimado */}
                  {domicilio.fechaEstimadaEntrega && domicilio.estado !== 'Entregado' && (
                    <div className="mt-2 flex items-center gap-1 text-sm text-blue-600">
                      <Clock className="w-4 h-4" />
                      Entrega estimada: {formatearFecha(domicilio.fechaEstimadaEntrega)}
                    </div>
                  )}
                </div>

                {/* Acciones - ✅ SOLO CANCELAR */}
                <div className="bg-gray-50 px-4 py-3 flex gap-2">
                  {domicilio.estado === 'EnCamino' && (
                    <button
                      onClick={() => cambiarEstado(domicilio.id, 'Entregado')}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
                    >
                      Marcar Entregado
                    </button>
                  )}
                  
                  {['EnProceso', 'EnCamino'].includes(domicilio.estado) && (
                    <button
                      onClick={() => {
                        if (window.confirm('¿Seguro que deseas cancelar este domicilio?')) {
                          cambiarEstado(domicilio.id, 'Cancelado');
                        }
                      }}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {domiciliosFiltrados.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <div className="text-gray-400 mb-4">
              <Package className="w-16 h-16 mx-auto" />
            </div>
            <p className="text-xl text-gray-600 mb-2">No hay domicilios para mostrar</p>
            <p className="text-gray-500">Los domicilios aparecerán aquí cuando se creen</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Domicilios;