import React, { useState, useEffect, useRef } from 'react';
import { Users, ChefHat, Clock, CheckCircle, Package, Truck } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import * as api from './services/api';
import { getDomiciliosActivos, actualizarEstadoDomicilio } from './services/domiciliosApi';
import VoiceControlCocina from './components/VoiceControlCocina'; 

function Cocina({ pedidos = [], onActualizarPedidos }) {
  const { usuario } = useAuth();
  const [filtroMesa, setFiltroMesa] = useState('todas');
  const [cargandoEstado, setCargandoEstado] = useState(null);
  const [modalConfirmacion, setModalConfirmacion] = useState(null);
  const [todosLosPedidos, setTodosLosPedidos] = useState([]);
  
  // ✅ SOLUCIÓN CLOSURE: Referencia para todosLosPedidos
  const todosLosPedidosRef = useRef([]);

  // ✅ Actualizar referencia cuando cambien los pedidos
  useEffect(() => {
    todosLosPedidosRef.current = todosLosPedidos;
    console.log('🔄 Cocina.js - Actualizando referencia:', todosLosPedidos.length);
  }, [todosLosPedidos]);

  useEffect(() => {
    cargarTodosLosDatos();
  }, [pedidos]);

  useEffect(() => {
    const interval = setInterval(() => {
      cargarDomiciliosSoloActualizacion();
    }, 5000);
    return () => clearInterval(interval);
  }, [pedidos]);

  // ✅ FUNCIÓN PRINCIPAL: Cargar pedidos + domicilios
  const cargarTodosLosDatos = async () => {
    try {
      const pedidosMesas = pedidos || [];
      
      // Cargar domicilios activos
      const domiciliosData = await getDomiciliosActivos();
      
      const domiciliosTransformados = Array.isArray(domiciliosData) 
        ? domiciliosData
            .filter(d => d.estado === 'EnProceso')
            .map(d => ({
              id: `D${d.id}`,
              domicilioId: d.id,
              mesa: `Domicilio #${d.id}`,
              cliente: d.clienteNombre,
              telefono: d.clienteTelefono,
              direccion: d.direccionCompleta,
              items: d.detalles.map(det => ({
                id: det.id,
                nombre: det.platilloNombre,
                cantidad: det.cantidad,
                notas: det.nota || ""
              })),
              hora: new Date(d.fechaPedido),
              estado: 'EnProceso',
              tipo: 'domicilio',
              notasCliente: d.notasCliente
            }))
        : [];

      const pedidosMesasTransformados = pedidosMesas.map(p => ({
        ...p,
        tipo: 'mesa'
      }));

      const combinados = [...pedidosMesasTransformados, ...domiciliosTransformados];
      setTodosLosPedidos(combinados);
    } catch (error) {
      console.error('Error al cargar datos:', error);
    }
  };

  // ✅ FUNCIÓN SOLO PARA ACTUALIZACIÓN PERIÓDICA
  const cargarDomiciliosSoloActualizacion = async () => {
    try {
      const domiciliosData = await getDomiciliosActivos();
      
      const domiciliosTransformados = Array.isArray(domiciliosData) 
        ? domiciliosData
            .filter(d => d.estado === 'EnProceso')
            .map(d => ({
              id: `D${d.id}`,
              domicilioId: d.id,
              mesa: `Domicilio #${d.id}`,
              cliente: d.clienteNombre,
              telefono: d.clienteTelefono,
              direccion: d.direccionCompleta,
              items: d.detalles.map(det => ({
                id: det.id,
                nombre: det.platilloNombre,
                cantidad: det.cantidad,
                notas: det.nota || ""
              })),
              hora: new Date(d.fechaPedido),
              estado: 'EnProceso',
              tipo: 'domicilio',
              notasCliente: d.notasCliente
            }))
        : [];

      const pedidosMesasTransformados = pedidos.map(p => ({
        ...p,
        tipo: 'mesa'
      }));

      const combinados = [...pedidosMesasTransformados, ...domiciliosTransformados];
      setTodosLosPedidos(combinados);
    } catch (error) {
      console.error('Error al actualizar domicilios:', error);
    }
  };

  const calcularTiempoTranscurrido = (horaInicio) => {
    const ahora = new Date();
    return Math.floor((ahora - horaInicio) / 60000);
  };

  const puedeModificarEstados = () => {
    if (!usuario) return false;
    const rol = usuario.rol?.toLowerCase();
    return rol === 'administrador' || rol === 'caja';
  };

  const puedeFiltrarMesas = () => {
    if (!usuario) return false;
    const rol = usuario.rol?.toLowerCase();
    return rol === 'administrador' || rol === 'caja';
  };

  // ✅ FUNCIÓN ACTUALIZADA: Manejar mesas y domicilios
  const cambiarEstadoPedido = async (pedido, nuevoEstado) => {
    const pedidoId = pedido.tipo === 'domicilio' ? pedido.domicilioId : pedido.id;
    setCargandoEstado(pedidoId);
    try {
      if (pedido.tipo === 'domicilio') {
        await actualizarEstadoDomicilio(pedido.domicilioId, 'EnCamino');
      } else {
        await api.actualizarEstadoPedido(pedidoId, nuevoEstado);
      }
      
      if (onActualizarPedidos) {
        await onActualizarPedidos();
      }
      await cargarTodosLosDatos();
      
      setModalConfirmacion({
        tipo: 'exito',
        mensaje: pedido.tipo === 'domicilio' 
          ? '🚲 Domicilio listo para envío'
          : `Pedido marcado como ${nuevoEstado === 'Listo' ? 'Listo' : 'Entregado'}`
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

  // ✅ FUNCIÓN ACTUALIZADA: Marcar listo por voz (mesas y domicilios)
  const marcarPedidoListoPorVoz = async (pedidoId, tipoEspecificado = null) => {
    // ✅ USAR LA REFERENCIA ACTUALIZADA, NO EL STATE DIRECTAMENTE
    const pedidosActuales = todosLosPedidosRef.current;
    
    console.log(`🎤 Control por voz: Buscando ${tipoEspecificado || 'pedido/domicilio'} con ID ${pedidoId} (tipo: ${typeof pedidoId})`);
    console.log('📋 Pedidos disponibles:', pedidosActuales.map(p => ({
      id: p.id,
      idTipo: typeof p.id,
      domicilioId: p.domicilioId,
      domicilioIdTipo: typeof p.domicilioId,
      tipo: p.tipo,
      estado: p.estado
    })));
    
    let pedido = null;
    let tipoEncontrado = null;
    
    // ✅ SI SE ESPECIFICÓ EL TIPO, BUSCAR SOLO EN ESE TIPO
    if (tipoEspecificado === 'mesa') {
      // Buscar SOLO en pedidos de mesa
      pedido = pedidosActuales.find(p => 
        p.tipo === 'mesa' && 
        (p.id === pedidoId || p.id === String(pedidoId) || String(p.id) === String(pedidoId)) && 
        p.estado === 'EnProceso'
      );
      
      if (pedido) {
        tipoEncontrado = 'mesa';
        console.log(`✅ Pedido de mesa encontrado:`, pedido);
      } else {
        console.log(`❌ No se encontró PEDIDO de mesa con ID ${pedidoId} en estado EnProceso`);
      }
    } else if (tipoEspecificado === 'domicilio') {
      // Buscar SOLO en domicilios
      pedido = pedidosActuales.find(p => 
        p.tipo === 'domicilio' && 
        (p.domicilioId === pedidoId || p.domicilioId === String(pedidoId) || String(p.domicilioId) === String(pedidoId)) &&
        p.estado === 'EnProceso'
      );
      
      if (pedido) {
        tipoEncontrado = 'domicilio';
        console.log(`✅ Domicilio encontrado:`, pedido);
      } else {
        console.log(`❌ No se encontró DOMICILIO con ID ${pedidoId} en estado EnProceso`);
      }
    } else {
      // ✅ SI NO SE ESPECIFICÓ TIPO, BUSCAR PRIMERO EN MESAS, LUEGO EN DOMICILIOS (fallback)
      pedido = pedidosActuales.find(p => 
        p.tipo === 'mesa' && 
        (p.id === pedidoId || p.id === String(pedidoId) || String(p.id) === String(pedidoId)) && 
        p.estado === 'EnProceso'
      );
      
      if (pedido) {
        tipoEncontrado = 'mesa';
        console.log(`✅ Pedido de mesa encontrado:`, pedido);
      }
      
      // Si no se encuentra, buscar en domicilios
      if (!pedido) {
        pedido = pedidosActuales.find(p => 
          p.tipo === 'domicilio' && 
          (p.domicilioId === pedidoId || p.domicilioId === String(pedidoId) || String(p.domicilioId) === String(pedidoId)) &&
          p.estado === 'EnProceso'
        );
        if (pedido) {
          tipoEncontrado = 'domicilio';
          console.log(`✅ Domicilio encontrado:`, pedido);
        }
      }
    }
    
    if (pedido) {
      console.log(`✅ Marcando como listo - Tipo: ${tipoEncontrado}`);
      // ✅ cambiarEstadoPedido ya maneja el feedback, no duplicar aquí
      await cambiarEstadoPedido(pedido, tipoEncontrado === 'domicilio' ? 'EnCamino' : 'Listo');
    } else {
      console.error(`❌ No se encontró ${tipoEspecificado || 'pedido/domicilio'} con ID ${pedidoId}`);
      console.log('IDs disponibles:', {
        mesas: pedidosActuales.filter(p => p.tipo === 'mesa').map(p => ({ id: p.id, estado: p.estado })),
        domicilios: pedidosActuales.filter(p => p.tipo === 'domicilio').map(p => ({ domicilioId: p.domicilioId, estado: p.estado }))
      });
      
      // ✅ Mostrar error con información útil
      const tipoMensaje = tipoEspecificado === 'mesa' ? 'pedido' : tipoEspecificado === 'domicilio' ? 'domicilio' : 'pedido/domicilio';
      setModalConfirmacion({
        tipo: 'error',
        mensaje: `❌ No se encontró ${tipoMensaje} #${pedidoId} en proceso`
      });
      
      setTimeout(() => setModalConfirmacion(null), 3000);
    }
  };

  const confirmarCambioEstado = (pedido, nuevoEstado, numeroMesa) => {
    setModalConfirmacion({
      tipo: 'confirmar',
      titulo: `¿Marcar como ${nuevoEstado}?`,
      mensaje: `${numeroMesa} - ${pedido.tipo === 'domicilio' ? 'Domicilio' : 'Pedido'} #${pedido.tipo === 'domicilio' ? pedido.domicilioId : pedido.id}`,
      pedido,
      nuevoEstado,
      onConfirmar: () => {
        cambiarEstadoPedido(pedido, nuevoEstado);
        setModalConfirmacion(null);
      },
      onCancelar: () => setModalConfirmacion(null)
    });
  };

  const mesasUnicas = [...new Set(todosLosPedidos.map(p => p.mesa))].sort((a, b) => {
    const aNum = typeof a === 'number' ? a : 999;
    const bNum = typeof b === 'number' ? b : 999;
    return aNum - bNum;
  });

  const pedidosFiltrados = todosLosPedidos
    .filter(pedido => pedido.estado !== 'Pagado' && pedido.estado !== 'Cancelado')
    .filter(pedido => {
      if (!puedeFiltrarMesas()) return true;
      if (filtroMesa === 'todas') return true;
      return pedido.mesa.toString() === filtroMesa;
    })
    .sort((a, b) => new Date(a.hora) - new Date(b.hora));

  // ✅ Log para debugging
  console.log('🔍 Cocina.js - todosLosPedidos:', todosLosPedidos.length);
  console.log('🔍 Cocina.js - pedidosFiltrados:', pedidosFiltrados.length);

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
              Todas ({pedidosFiltrados.length})
            </button>
            {mesasUnicas.map(mesa => {
              const pedidosMesa = todosLosPedidos.filter(p => 
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
                  {typeof mesa === 'number' ? `Mesa ${mesa}` : mesa} ({pedidosMesa.length})
                </button>
              );
            })}
          </div>
        )}

        {pedidosFiltrados.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-12 text-center">
            <ChefHat className="mx-auto text-gray-500 mb-4" size={64} />
            <h3 className="text-xl font-semibold text-gray-400 mb-2">No hay órdenes</h3>
            <p className="text-gray-500">Las órdenes aparecerán aquí cuando se creen</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {pedidosFiltrados.map(pedido => {
              const estadoInfo = getEstadoTexto(pedido.estado);
              
              return (
                <div 
                  key={pedido.id} 
                  className={`bg-gray-800 rounded-lg border-2 overflow-hidden transition-all hover:shadow-xl ${getEstadoColor(pedido.estado)}`}
                >
                  {/* ✅ Header con identificación de domicilio */}
                  <div className={`p-3 border-b border-gray-600 ${
                    pedido.tipo === 'domicilio' ? 'bg-gradient-to-r from-purple-600 to-purple-500' : 'bg-gray-700'
                  }`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-bold text-white">
                          Orden #{pedido.tipo === 'domicilio' ? pedido.domicilioId : pedido.id}
                        </h3>
                        <p className="text-sm text-gray-300 flex items-center gap-1 mt-1">
                          {pedido.tipo === 'domicilio' ? (
                            <>
                              <Truck size={14} />
                              {pedido.mesa}
                            </>
                          ) : (
                            <>
                              <Users size={14} />
                              Mesa {pedido.mesa}
                            </>
                          )}
                        </p>
                        
                        {/* ✅ Badge de domicilio */}
                        {pedido.tipo === 'domicilio' && (
                          <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-xs font-bold bg-white text-purple-700">
                            🚲 DOMICILIO
                          </span>
                        )}
                        
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

                    {/* ✅ Info adicional para domicilios */}
                    {pedido.tipo === 'domicilio' && (
                      <div className="text-sm space-y-1 bg-white/10 rounded p-2 mt-2">
                        <p>👤 {pedido.cliente}</p>
                        <p>📱 {pedido.telefono}</p>
                        <p>📍 {pedido.direccion}</p>
                      </div>
                    )}
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

                  {/* ✅ Notas del cliente (domicilios) */}
                  {pedido.notasCliente && (
                    <div className="px-3 pb-2">
                      <div className="bg-yellow-900/30 border border-yellow-500/50 rounded p-2">
                        <p className="text-yellow-300 text-xs">
                          <strong>Notas:</strong> {pedido.notasCliente}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* BOTONES DE ACCIÓN - Compactos */}
                  {puedeModificarEstados() && (
                    <div className="px-3 pb-3 pt-2 border-t border-gray-600">
                      <div className="flex gap-2">
                        {pedido.estado === 'EnProceso' && (
                          <button
                            onClick={() => confirmarCambioEstado(pedido, pedido.tipo === 'domicilio' ? 'EnCamino' : 'Listo', pedido.mesa)}
                            disabled={cargandoEstado === (pedido.tipo === 'domicilio' ? pedido.domicilioId : pedido.id)}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                          >
                            <Package size={16} />
                            {cargandoEstado === (pedido.tipo === 'domicilio' ? pedido.domicilioId : pedido.id) ? 'Procesando...' : (pedido.tipo === 'domicilio' ? 'Listo para Envío' : 'Listo')}
                          </button>
                        )}
                        {pedido.estado === 'Listo' && pedido.tipo === 'mesa' && (
                          <button
                            onClick={() => confirmarCambioEstado(pedido, 'Entregado', pedido.mesa)}
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
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ✅ Control por voz actualizado */}
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