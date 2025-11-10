import React, { useState, useEffect } from 'react';
import { Users, ChefHat, Clock, CheckCircle, Package } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import * as api from './services/api';
import VoiceControlCocina from './components/VoiceControlCocina'; 

function Cocina({ pedidos = [], onActualizarPedidos }) {
  const { usuario } = useAuth();
  const [filtroMesa, setFiltroMesa] = useState('todas');
  const [cargandoEstado, setCargandoEstado] = useState(null);
  const [modalConfirmacion, setModalConfirmacion] = useState(null);

  useEffect(() => {
    const interval = setInterval(() => {
      // Actualizar reloj cada minuto
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const calcularTiempoTranscurrido = (horaInicio) => {
    const ahora = new Date();
    return Math.floor((ahora - horaInicio) / 60000);
  };

  // Verificar si el usuario puede cambiar estados
  const puedeModificarEstados = () => {
    if (!usuario) return false;
    const rol = usuario.rol?.toLowerCase();
    return rol === 'administrador' || rol === 'caja';
  };

  // Verificar si el usuario puede filtrar por mesas
  const puedeFiltrarMesas = () => {
    if (!usuario) return false;
    const rol = usuario.rol?.toLowerCase();
    return rol === 'administrador' || rol === 'caja';
  };

  const cambiarEstadoPedido = async (pedidoId, nuevoEstado) => {
    setCargandoEstado(pedidoId);
    try {
      await api.actualizarEstadoPedido(pedidoId, nuevoEstado);
      
      // Recargar los pedidos después de actualizar
      if (onActualizarPedidos) {
        await onActualizarPedidos();
      }
      
      setModalConfirmacion({
        tipo: 'exito',
        mensaje: `Pedido marcado como ${nuevoEstado === 'Listo' ? 'Listo' : 'Entregado'}`
      });
      
      setTimeout(() => setModalConfirmacion(null), 2000);
    } catch (error) {
      console.error('Error al actualizar estado:', error);
      setModalConfirmacion({
        tipo: 'error',
        mensaje: 'Error al actualizar el estado del pedido'
      });
    } finally {
      setCargandoEstado(null);
    }
  };

  // ✅ NUEVA FUNCIÓN: Marcar pedido como listo (para control por voz)
  const marcarPedidoListoPorVoz = async (pedidoId) => {
    console.log(`🎤 Control por voz: Marcando pedido ${pedidoId} como listo`);
    await cambiarEstadoPedido(pedidoId, 'Listo');
  };

  const confirmarCambioEstado = (pedidoId, nuevoEstado, numeroMesa) => {
    setModalConfirmacion({
      tipo: 'confirmar',
      titulo: `¿Marcar como ${nuevoEstado}?`,
      mensaje: `Mesa ${numeroMesa} - Pedido #${pedidoId}`,
      pedidoId,
      nuevoEstado,
      onConfirmar: () => {
        cambiarEstadoPedido(pedidoId, nuevoEstado);
        setModalConfirmacion(null);
      },
      onCancelar: () => setModalConfirmacion(null)
    });
  };

  const mesasUnicas = [...new Set(pedidos.map(p => p.mesa))].sort((a, b) => a - b);

  const pedidosFiltrados = pedidos
    .filter(pedido => pedido.estado !== 'Pagado' && pedido.estado !== 'Cancelado')
    .filter(pedido => {
      if (!puedeFiltrarMesas()) return true;
      if (filtroMesa === 'todas') return true;
      return pedido.mesa.toString() === filtroMesa;
    })
    .sort((a, b) => new Date(a.hora) - new Date(b.hora));

  const getEstadoColor = (estado) => {
    switch (estado) {
      case 'EnProceso':
        return 'border-yellow-500 bg-yellow-900/20';
      case 'Listo':
        return 'border-green-500 bg-green-900/20';
      default:
        return 'border-gray-500';
    }
  };

  const getEstadoTexto = (estado) => {
    switch (estado) {
      case 'EnProceso':
        return { texto: 'En Proceso', color: 'text-yellow-400' };
      case 'Listo':
        return { texto: 'Listo para Entregar', color: 'text-green-400' };
      default:
        return { texto: estado, color: 'text-gray-400' };
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ChefHat className="text-orange-500" size={32} />
              <div>
                <h1 className="text-2xl font-bold">Órdenes de Cocina</h1>
                <p className="text-gray-400">Restaurante Délice</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold">{new Date().toLocaleTimeString()}</p>
              <p className="text-gray-400">{new Date().toLocaleDateString()}</p>
              {usuario && (
                <p className="text-xs text-gray-500 mt-1">
                  {usuario.nombre} ({usuario.rol})
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {puedeFiltrarMesas() && mesasUnicas.length > 0 && (
          <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setFiltroMesa('todas')}
              className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap ${
                filtroMesa === 'todas'
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Todas las Mesas ({pedidos.filter(p => p.estado !== 'Pagado' && p.estado !== 'Cancelado').length})
            </button>
            {mesasUnicas.map(mesa => {
              const pedidosMesa = pedidos.filter(p => 
                p.mesa === mesa && 
                p.estado !== 'Pagado' && 
                p.estado !== 'Cancelado'
              );
              return (
                <button
                  key={mesa}
                  onClick={() => setFiltroMesa(mesa.toString())}
                  className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap ${
                    filtroMesa === mesa.toString()
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Mesa {mesa} ({pedidosMesa.length})
                </button>
              );
            })}
          </div>
        )}

        {pedidosFiltrados.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-12 text-center">
            <ChefHat className="mx-auto text-gray-500 mb-4" size={64} />
            <h3 className="text-xl font-semibold text-gray-400 mb-2">
              {pedidos.length === 0 ? 'No hay órdenes' : puedeFiltrarMesas() ? 'No hay órdenes para esta mesa' : 'No hay órdenes'}
            </h3>
            <p className="text-gray-500">
              {pedidos.length === 0 
                ? 'Las órdenes aparecerán aquí cuando los clientes hagan pedidos'
                : puedeFiltrarMesas() 
                  ? 'Selecciona otra mesa para ver sus órdenes'
                  : 'Las órdenes aparecerán aquí cuando los clientes hagan pedidos'
              }
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {pedidosFiltrados.map(pedido => {
              const estadoInfo = getEstadoTexto(pedido.estado);
              
              return (
                <div 
                  key={pedido.id} 
                  className={`bg-gray-800 rounded-lg border-2 overflow-hidden transition-all ${getEstadoColor(pedido.estado)}`}
                >
                  <div className="p-4 bg-gray-700 border-b border-gray-600">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-xl font-bold text-white">Orden #{pedido.id}</h3>
                        <p className="text-gray-300 flex items-center gap-2 mt-1">
                          <Users size={16} />
                          Mesa {pedido.mesa}
                        </p>
                        <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold ${estadoInfo.color} bg-gray-800`}>
                          {estadoInfo.texto}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2 text-gray-300">
                          <Clock size={16} />
                          <span>Hace {calcularTiempoTranscurrido(pedido.hora)} min</span>
                        </div>
                        <p className="text-sm text-gray-400">{pedido.hora.toLocaleTimeString()}</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4">
                    <h4 className="text-lg font-semibold text-orange-400 mb-3">Platos:</h4>
                    <div className="space-y-3">
                      {pedido.items.map((item, index) => (
                        <div key={index} className="bg-gray-700 p-3 rounded-lg">
                          <div className="flex items-center gap-3">
                            <span className="bg-orange-500 text-white px-2 py-1 rounded-full text-sm font-bold min-w-[2rem] text-center">
                              {item.cantidad}
                            </span>
                            <span className="font-medium text-white text-lg">{item.nombre}</span>
                          </div>
                          {item.notas && (
                            <div className="mt-2 ml-11 p-2 bg-yellow-800 border-l-4 border-yellow-500 rounded">
                              <p className="text-sm text-yellow-200">📝 Nota: {item.notas}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* BOTONES DE ACCIÓN - Solo para Administrador y Caja */}
                  {puedeModificarEstados() && (
                    <div className="px-4 pb-4 pt-2 border-t border-gray-600">
                      <div className="flex gap-3">
                        {pedido.estado === 'EnProceso' && (
                          <button
                            onClick={() => confirmarCambioEstado(pedido.id, 'Listo', pedido.mesa)}
                            disabled={cargandoEstado === pedido.id}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            <Package size={20} />
                            {cargandoEstado === pedido.id ? 'Procesando...' : 'Marcar Listo'}
                          </button>
                        )}
                        {pedido.estado === 'Listo' && (
                          <button
                            onClick={() => confirmarCambioEstado(pedido.id, 'Entregado', pedido.mesa)}
                            disabled={cargandoEstado === pedido.id}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            <CheckCircle size={20} />
                            {cargandoEstado === pedido.id ? 'Procesando...' : 'Marcar Entregado'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Información adicional */}
                  <div className="px-4 pb-4 pt-2 border-t border-gray-600">
                    <div className="flex justify-between items-center text-sm text-gray-400">
                      <span>Total items: {pedido.items.reduce((sum, item) => sum + item.cantidad, 0)}</span>
                      {pedido.tiempoEstimado && (
                        <span>Tiempo est.: {pedido.tiempoEstimado} min</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ✅ NUEVO: Componente de Control por Voz */}
      <VoiceControlCocina 
        pedidos={pedidosFiltrados}
        onMarcarListo={marcarPedidoListoPorVoz}
      />

      {/* Modal de Confirmación */}
      {modalConfirmacion && modalConfirmacion.tipo === 'confirmar' && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-2xl max-w-md w-full p-6 border-2 border-gray-600">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">❓</span>
              </div>
              <h3 className="text-2xl font-bold mb-2 text-white">{modalConfirmacion.titulo}</h3>
              <p className="text-gray-300">{modalConfirmacion.mensaje}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={modalConfirmacion.onCancelar}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-lg font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={modalConfirmacion.onConfirmar}
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-lg font-semibold transition-colors"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Alerta */}
      {modalConfirmacion && (modalConfirmacion.tipo === 'exito' || modalConfirmacion.tipo === 'error') && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-2xl max-w-md w-full p-6 border-2 border-gray-600">
            <div className="text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                modalConfirmacion.tipo === 'exito' ? 'bg-green-600' : 'bg-red-600'
              }`}>
                <span className="text-4xl">{modalConfirmacion.tipo === 'exito' ? '✅' : '❌'}</span>
              </div>
              <p className="text-white text-lg font-semibold">{modalConfirmacion.mensaje}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Cocina;