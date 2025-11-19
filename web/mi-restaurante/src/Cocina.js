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
      {/* Header compacto */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-full mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ChefHat className="text-orange-500" size={28} />
              <div>
                <h1 className="text-xl font-bold">Órdenes de Cocina</h1>
                <p className="text-sm text-gray-400">Restaurante Délice</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-base font-semibold">{new Date().toLocaleTimeString()}</p>
              <p className="text-xs text-gray-400">{new Date().toLocaleDateString()}</p>
              {usuario && (
                <p className="text-xs text-gray-500 mt-1">
                  {usuario.nombre} ({usuario.rol})
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-full mx-auto px-4 py-4">
        {/* Filtro de mesas compacto */}
        {puedeFiltrarMesas() && mesasUnicas.length > 0 && (
          <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setFiltroMesa('todas')}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap ${
                filtroMesa === 'todas'
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Todas ({pedidos.filter(p => p.estado !== 'Pagado' && p.estado !== 'Cancelado').length})
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
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap ${
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
          // ✅ GRID RESPONSIVE CON MÚLTIPLES COLUMNAS
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {pedidosFiltrados.map(pedido => {
              const estadoInfo = getEstadoTexto(pedido.estado);
              
              return (
                <div 
                  key={pedido.id} 
                  className={`bg-gray-800 rounded-lg border-2 overflow-hidden transition-all hover:shadow-xl ${getEstadoColor(pedido.estado)}`}
                >
                  {/* Header compacto */}
                  <div className="p-3 bg-gray-700 border-b border-gray-600">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-bold text-white">Orden #{pedido.id}</h3>
                        <p className="text-sm text-gray-300 flex items-center gap-1 mt-1">
                          <Users size={14} />
                          Mesa {pedido.mesa}
                        </p>
                        <span className={`inline-block mt-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${estadoInfo.color} bg-gray-800`}>
                          {estadoInfo.texto}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-gray-300">
                          <Clock size={14} />
                          <span className="text-xs">{calcularTiempoTranscurrido(pedido.hora)} min</span>
                        </div>
                        <p className="text-xs text-gray-400">{pedido.hora.toLocaleTimeString()}</p>
                      </div>
                    </div>
                  </div>

                  {/* Platos compactos */}
                  <div className="p-3">
                    <h4 className="text-sm font-semibold text-orange-400 mb-2">Platos:</h4>
                    <div className="space-y-2">
                      {pedido.items.map((item, index) => (
                        <div key={index} className="bg-gray-700 p-2 rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className="bg-orange-500 text-white px-1.5 py-0.5 rounded-full text-xs font-bold min-w-[1.5rem] text-center">
                              {item.cantidad}
                            </span>
                            <span className="font-medium text-white text-sm truncate">{item.nombre}</span>
                          </div>
                          {item.notas && (
                            <div className="mt-1.5 ml-7 p-1.5 bg-yellow-800 border-l-2 border-yellow-500 rounded">
                              <p className="text-xs text-yellow-200">📝 {item.notas}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* BOTONES DE ACCIÓN - Compactos */}
                  {puedeModificarEstados() && (
                    <div className="px-3 pb-3 pt-2 border-t border-gray-600">
                      <div className="flex gap-2">
                        {pedido.estado === 'EnProceso' && (
                          <button
                            onClick={() => confirmarCambioEstado(pedido.id, 'Listo', pedido.mesa)}
                            disabled={cargandoEstado === pedido.id}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                          >
                            <Package size={16} />
                            {cargandoEstado === pedido.id ? 'Procesando...' : 'Listo'}
                          </button>
                        )}
                        {pedido.estado === 'Listo' && (
                          <button
                            onClick={() => confirmarCambioEstado(pedido.id, 'Entregado', pedido.mesa)}
                            disabled={cargandoEstado === pedido.id}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                          >
                            <CheckCircle size={16} />
                            {cargandoEstado === pedido.id ? 'Procesando...' : 'Entregado'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Información adicional compacta */}
                  <div className="px-3 pb-2 pt-1.5 border-t border-gray-600">
                    <div className="flex justify-between items-center text-xs text-gray-400">
                      <span>Items: {pedido.items.reduce((sum, item) => sum + item.cantidad, 0)}</span>
                      {pedido.tiempoEstimado && (
                        <span>Est.: {pedido.tiempoEstimado} min</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ✅ Componente de Control por Voz - Sin cambios */}
      <VoiceControlCocina 
        pedidos={pedidosFiltrados}
        onMarcarListo={marcarPedidoListoPorVoz}
      />

      {/* Modal de Confirmación - Sin cambios */}
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

      {/* Modal de Alerta - Sin cambios */}
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