// src/App.js 
import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Minus, X, ChefHat, Receipt, Menu as MenuIcon, QrCode, LogOut, BarChart3, Utensils } from 'lucide-react';
import * as api from './services/api';
import Facturacion from './Facturacion';
import GeneradorQR from './GeneradorQR';
import Login from './components/Login';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider, useAuth } from './context/AuthContext';
import Reportes from './Reportes';
import GestionPlatillos from './GestionPlatillos';

function AppContent() {
  const { usuario, esClienteQR, estaAutenticado, logout, cargando: cargandoAuth } = useAuth();
  const [vistaActual, setVistaActual] = useState('menu');
  const [carrito, setCarrito] = useState([]);
  const [mostrarCarrito, setMostrarCarrito] = useState(false);
  const [pedidos, setPedidos] = useState([]);
  const [platillos, setPlatillos] = useState([]);
  const [mesaSeleccionada, setMesaSeleccionada] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [modalNota, setModalNota] = useState(null);
  const [notaTemp, setNotaTemp] = useState('');
  const [modalConfirmacion, setModalConfirmacion] = useState(null);
  const [modalAlerta, setModalAlerta] = useState(null);
  const [pedidosAnteriores, setPedidosAnteriores] = useState(0);
  const [pedidosNuevos, setPedidosNuevos] = useState([]);

  // ✅ VERIFICAR SI ES RUTA PÚBLICA DE COCINA
  const [esPantallaCocina, setEsPantallaCocina] = useState(false);

  useEffect(() => {
    // Detectar si la URL es /cocina o ?cocina=true
    const params = new URLSearchParams(window.location.search);
    const esCocina = window.location.pathname.includes('/cocina') || params.get('cocina') === 'true';
    
    if (esCocina) {
      setEsPantallaCocina(true);
      setVistaActual('cocina');
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mesaUrl = params.get('mesa');
    
    if (mesaUrl) {
      const numeroMesa = parseInt(mesaUrl);
      if (numeroMesa >= 1 && numeroMesa <= 12) {
        setMesaSeleccionada(numeroMesa);
      }
    }
  }, []);

  useEffect(() => {
    cargarPlatillos();
    // Inicializar pedidos para tener referencia inicial
    if (vistaActual === 'cocina' || esPantallaCocina) {
      cargarPedidos();
    }
  }, []);

  useEffect(() => {
    if ((vistaActual === 'cocina' || esPantallaCocina) && !esClienteQR) {
      cargarPedidos();
      // ⚡ Actualización cada 1 segundo
      const interval = setInterval(cargarPedidos, 1000);
      return () => clearInterval(interval);
    }
  }, [vistaActual, esPantallaCocina, esClienteQR]);

  useEffect(() => {
    if (usuario && !esPantallaCocina) {
      const rol = usuario.rol?.toLowerCase();
      if (rol === 'cocina' && vistaActual !== 'cocina') {
        setVistaActual('cocina');
      } else if (rol === 'caja' && vistaActual !== 'facturacion') {
        setVistaActual('facturacion');
      }
    }
  }, [usuario, vistaActual, esPantallaCocina]);

  const cargarPlatillos = async () => {
    try {
      const data = await api.getPlatillos();
      setPlatillos(data);
    } catch (error) {
      console.error('Error al cargar platillos:', error);
      setPlatillos([]);
    }
  };

  const cargarPedidos = async () => {
    try {
      const data = await api.getPedidos();
      const pedidosTransformados = data
        .filter(p => p.estado !== 'Entregado' && p.estado !== 'Pagado' && p.estado !== 'Cancelado')
        .map(p => ({
          id: p.id,
          mesa: p.mesaNumero,
          items: p.detalles.map(d => ({
            id: d.id,
            nombre: d.platilloNombre,
            cantidad: d.cantidad,
            notas: d.nota || ""
          })),
          hora: new Date(p.fecha),
          estado: p.estado
        }));
      
      // 💥 Detectar nuevos pedidos comparando IDs
      if (pedidos.length > 0) {
        const idsAnteriores = pedidos.map(p => p.id);
        const nuevos = pedidosTransformados.filter(p => !idsAnteriores.includes(p.id));
        
        if (nuevos.length > 0) {
          console.log('🔔 Nuevos pedidos detectados:', nuevos.length);
          
          // Marcar como nuevos temporalmente
          setPedidosNuevos(nuevos.map(p => p.id));
          
          // Quitar la marca después de 10 segundos
          setTimeout(() => {
            setPedidosNuevos([]);
          }, 10000);
        }
      }
      
      setPedidosAnteriores(pedidosTransformados.length);
      setPedidos(pedidosTransformados);
    } catch (error) {
      console.error('Error al cargar pedidos:', error);
    }
  };

  const formatearPrecio = (precio) =>
    new Intl.NumberFormat('es-CO', { 
      style: 'currency', 
      currency: 'COP', 
      minimumFractionDigits: 0 
    }).format(precio);

  const abrirModalNota = (platillo) => {
    setModalNota(platillo);
    setNotaTemp('');
  };

  const agregarAlCarritoConNota = () => {
    if (modalNota) {
      const itemExistente = carrito.find(item => item.id === modalNota.id && item.nota === notaTemp);
      
      if (itemExistente) {
        setCarrito(carrito.map(item =>
          item.id === modalNota.id && item.nota === notaTemp
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        ));
      } else {
        setCarrito([...carrito, { ...modalNota, cantidad: 1, nota: notaTemp }]);
      }
      
      setModalNota(null);
      setNotaTemp('');
    }
  };

  const agregarAlCarrito = (platillo) => {
    abrirModalNota(platillo);
  };

  const actualizarCantidad = (id, nota, nuevaCantidad) => {
    if (nuevaCantidad === 0) {
      setCarrito(carrito.filter(item => !(item.id === id && item.nota === nota)));
    } else {
      setCarrito(carrito.map(item =>
        item.id === id && item.nota === nota ? { ...item, cantidad: nuevaCantidad } : item
      ));
    }
  };

  const confirmarPedido = async () => {
    if (carrito.length > 0 && mesaSeleccionada) {
      setModalConfirmacion({
        titulo: '¿Confirmar pedido?',
        mensaje: `¿Está seguro de enviar el pedido a cocina?\n\nMesa: ${mesaSeleccionada}\nCantidad de items: ${totalItems}\nTotal: ${formatearPrecio(total)}`,
        onConfirmar: async () => {
          setModalConfirmacion(null);
          setCargando(true);
          try {
            const carritoConNotas = carrito.map(item => ({
              ...item,
              notas: item.nota || ""
            }));
            
            await api.createPedido(mesaSeleccionada, carritoConNotas);
            
            setModalAlerta({
              tipo: 'exito',
              titulo: '¡Éxito!',
              mensaje: '¡Pedido confirmado y enviado a cocina!'
            });
            
            setCarrito([]);
            setMostrarCarrito(false);
            
            if (vistaActual === 'cocina') {
              await cargarPedidos();
            }
          } catch (error) {
            console.error('Error al confirmar pedido:', error);
            setModalAlerta({
              tipo: 'error',
              titulo: 'Error',
              mensaje: 'Error al enviar el pedido. Por favor intenta de nuevo.'
            });
          } finally {
            setCargando(false);
          }
        },
        onCancelar: () => setModalConfirmacion(null)
      });
    }
  };

  const total = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
  const totalItems = carrito.reduce((sum, item) => sum + item.cantidad, 0);

  const renderMenuCliente = () => {
    const platillosPorCategoria = platillos.reduce((acc, platillo) => {
      const categoria = platillo.categoria || 'General';
      if (!acc[categoria]) {
        acc[categoria] = [];
      }
      acc[categoria].push(platillo);
      return acc;
    }, {});

    const ordenCategorias = [
      'Entradas',
      'Platos Principales', 
      'Ensaladas',
      'Sopas',
      'Postres',
      'Bebidas'
    ];

    const categoriasConPlatillos = ordenCategorias.filter(cat => 
      platillosPorCategoria[cat] && platillosPorCategoria[cat].length > 0
    );

    Object.keys(platillosPorCategoria).forEach(cat => {
      if (!ordenCategorias.includes(cat)) {
        categoriasConPlatillos.push(cat);
      }
    });

    const getColorCategoria = (categoria) => {
      const colores = {
        'Entradas': 'text-green-600 border-green-600',
        'Platos Principales': 'text-orange-600 border-orange-600',
        'Postres': 'text-pink-600 border-pink-600',
        'Bebidas': 'text-blue-600 border-blue-600',
        'Ensaladas': 'text-lime-600 border-lime-600',
        'Sopas': 'text-amber-600 border-amber-600'
      };
      return colores[categoria] || 'text-gray-600 border-gray-600';
    };

    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm sticky top-0 z-40">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Restaurante Délice</h1>
                {mesaSeleccionada ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                    ✓ Mesa #{mesaSeleccionada}
                  </span>
                ) : (
                  <p className="text-sm text-red-600">⚠️ Escanea el QR de tu mesa</p>
                )}
              </div>
              <button 
                onClick={() => setMostrarCarrito(true)} 
                className="relative bg-orange-500 text-white p-3 rounded-full shadow-lg hover:bg-orange-600"
              >
                <ShoppingCart size={24} />
                {totalItems > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center font-bold">
                    {totalItems}
                  </span>
                )}
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-6">
          {!mesaSeleccionada && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg mb-6">
              <p className="text-sm text-yellow-700 font-medium">
                Para hacer un pedido, escanea el código QR de tu mesa
              </p>
            </div>
          )}

          {categoriasConPlatillos.map(categoria => (
            <div key={categoria} className="mb-8">
              <div className={`flex items-center gap-3 mb-4 pb-2 border-b-2 ${getColorCategoria(categoria)}`}>
                <h2 className="text-2xl font-bold">{categoria}</h2>
                <span className="text-sm bg-gray-100 px-2 py-1 rounded-full">
                  {platillosPorCategoria[categoria].length} platillos
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {platillosPorCategoria[categoria].map(platillo => (
                  <div key={platillo.id} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow">
                    <div className="h-48 overflow-hidden">
                      <img 
                        src={platillo.imagenUrl} 
                        alt={platillo.nombre} 
                        className="w-full h-full object-cover hover:scale-110 transition-transform duration-300"
                      />
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-lg text-gray-800 mb-1">{platillo.nombre}</h3>
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{platillo.descripcion}</p>
                      <div className="flex justify-between items-center">
                        <span className="text-xl font-bold text-orange-600">{formatearPrecio(platillo.precio)}</span>
                        <button 
                          onClick={() => agregarAlCarrito(platillo)}
                          disabled={!mesaSeleccionada}
                          className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Plus size={18} />
                          Agregar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {platillos.length === 0 && (
            <div className="text-center py-12">
              <ChefHat className="mx-auto text-gray-300 mb-4" size={64} />
              <p className="text-gray-500 text-lg">No hay platillos disponibles</p>
            </div>
          )}
        </main>

        {mostrarCarrito && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
            <div className="bg-white w-full max-w-lg rounded-2xl max-h-[90vh] overflow-hidden flex flex-col">
              <div className="p-4 border-b flex justify-between items-center">
                <h3 className="text-xl font-bold">Tu Pedido</h3>
                <button onClick={() => setMostrarCarrito(false)}>
                  <X size={24} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {carrito.length === 0 ? (
                  <div className="text-center py-12">
                    <ShoppingCart className="mx-auto text-gray-300 mb-3" size={48} />
                    <p className="text-gray-500">Tu carrito está vacío</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {carrito.map((item, index) => (
                      <div key={`${item.id}-${index}`} className="bg-gray-50 p-3 rounded-lg">
                        <div className="flex justify-between mb-2">
                          <h4 className="font-semibold">{item.nombre}</h4>
                          <span className="font-bold text-orange-600">{formatearPrecio(item.precio * item.cantidad)}</span>
                        </div>
                        {item.nota && <p className="text-xs text-gray-600 italic mb-2">{item.nota}</p>}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => actualizarCantidad(item.id, item.nota, item.cantidad - 1)}
                            className="bg-gray-200 hover:bg-gray-300 p-1 rounded"
                          >
                            <Minus size={16} />
                          </button>
                          <span className="font-semibold w-8 text-center">{item.cantidad}</span>
                          <button
                            onClick={() => actualizarCantidad(item.id, item.nota, item.cantidad + 1)}
                            className="bg-gray-200 hover:bg-gray-300 p-1 rounded"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {carrito.length > 0 && (
                <div className="p-4 border-t">
                  <div className="flex justify-between mb-4">
                    <span className="text-lg font-bold">Total:</span>
                    <span className="text-2xl font-bold text-orange-600">{formatearPrecio(total)}</span>
                  </div>
                  <button
                    onClick={confirmarPedido}
                    disabled={cargando || !mesaSeleccionada}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50"
                  >
                    {cargando ? 'Procesando...' : 'Confirmar Pedido'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {modalNota && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6">
              <h3 className="text-xl font-bold mb-4">{modalNota.nombre}</h3>
              <label className="block text-sm font-medium mb-2">Nota para cocina (opcional)</label>
              <textarea
                value={notaTemp}
                onChange={(e) => setNotaTemp(e.target.value)}
                placeholder="Ej: Sin cebolla"
                className="w-full border rounded-lg p-3 resize-none"
                rows="3"
              />
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setModalNota(null)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 py-2 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button
                  onClick={agregarAlCarritoConNota}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg font-semibold"
                >
                  Agregar
                </button>
              </div>
            </div>
          </div>
        )}

        {modalConfirmacion && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-4xl">❓</span>
                </div>
                <h3 className="text-2xl font-bold mb-2">{modalConfirmacion.titulo}</h3>
                <p className="text-gray-600 whitespace-pre-line">{modalConfirmacion.mensaje}</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={modalConfirmacion.onCancelar}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 py-3 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button
                  onClick={modalConfirmacion.onConfirmar}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-semibold"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}

        {modalAlerta && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6">
              <div className="text-center mb-6">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                  modalAlerta.tipo === 'exito' ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  <span className="text-4xl">{modalAlerta.tipo === 'exito' ? '✅' : '❌'}</span>
                </div>
                <h3 className="text-2xl font-bold mb-2">{modalAlerta.titulo}</h3>
                <p className="text-gray-600">{modalAlerta.mensaje}</p>
              </div>
              <button
                onClick={() => setModalAlerta(null)}
                className={`w-full py-3 rounded-lg font-semibold ${
                  modalAlerta.tipo === 'exito' 
                    ? 'bg-green-500 hover:bg-green-600 text-white' 
                    : 'bg-red-500 hover:bg-red-600 text-white'
                }`}
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderCocina = () => {
    console.log('🍳 Renderizando cocina - Pedidos:', pedidos.length, 'Nuevos:', pedidosNuevos.length);
    
    return (
      <div className="min-h-screen bg-gray-900 text-white pb-8">
        {/* 📊 Contador de Pedidos Flotante */}
        {pedidos.length > 0 && (
          <div className="fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-full shadow-2xl z-50 animate-bounce">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{pedidos.length}</span>
              <span className="text-sm font-semibold">Órdenes Activas</span>
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold">Órdenes de Cocina</h2>
            <span className="text-sm bg-green-600 px-4 py-2 rounded-lg flex items-center gap-2">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
              Actualización en tiempo real
            </span>
          </div>
          {pedidos.length === 0 ? (
            <div className="bg-gray-800 rounded-xl p-12 text-center">
              <ChefHat className="mx-auto text-gray-600 mb-4" size={64} />
              <p className="text-xl text-gray-400">No hay pedidos pendientes</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pedidos.map(pedido => {
                const esNuevo = pedidosNuevos.includes(pedido.id);
                console.log(`Pedido ${pedido.id} - Es nuevo:`, esNuevo);
                
                return (
                  <div 
                    key={pedido.id} 
                    className={`bg-gray-800 rounded-xl overflow-hidden border-l-4 transition-all ${
                      esNuevo 
                        ? 'border-red-500 animate-pulse ring-4 ring-red-500 ring-opacity-75 shadow-2xl shadow-red-500/50' 
                        : 'border-orange-500'
                    }`}
                  >
                    <div className={`p-5 border-b border-gray-600 ${
                      esNuevo ? 'bg-red-700' : 'bg-gray-700'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold">Mesa {pedido.mesa}</span>
                        {esNuevo && (
                          <span className="bg-red-500 text-white text-xs px-3 py-1 rounded-full font-bold animate-pulse">
                            🔔 NUEVO
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400 mt-1">
                        {pedido.hora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="p-5">
                      <h4 className="font-semibold mb-3">Platillos:</h4>
                      <div className="space-y-2">
                        {pedido.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between bg-gray-700 p-3 rounded">
                            <div>
                              <span className="font-medium">{item.nombre}</span>
                              {item.notas && <p className="text-xs text-orange-300 mt-1">📝 {item.notas}</p>}
                            </div>
                            <span className="bg-orange-500 px-2 py-1 rounded text-sm font-bold">x{item.cantidad}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderVistaActual = () => {
    switch (vistaActual) {
      case 'menu':
        return renderMenuCliente();
      case 'cocina':
        return <ProtectedRoute permisos={['administrador', 'cocina']}>{renderCocina()}</ProtectedRoute>;
      case 'facturacion':
        return <ProtectedRoute permisos={['administrador', 'caja']}><Facturacion /></ProtectedRoute>;
      case 'qr':
        return <ProtectedRoute permisos={['administrador']}><GeneradorQR /></ProtectedRoute>;
      case 'reportes':
        return <ProtectedRoute permisos={['administrador']}><Reportes /></ProtectedRoute>;
      case 'gestion-platillos':
        return <ProtectedRoute permisos={['administrador']}><GestionPlatillos /></ProtectedRoute>;
      default:
        return renderMenuCliente();
    }
  };

  // ✅ SI ES PANTALLA DE COCINA PÚBLICA, MOSTRAR DIRECTAMENTE
  if (esPantallaCocina) {
    return renderCocina();
  }

  if (cargandoAuth) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!estaAutenticado && !esClienteQR) {
    return <Login />;
  }

  if (esClienteQR) {
    return renderMenuCliente();
  }

  const rol = usuario?.rol?.toLowerCase();

  return (
    <div className="min-h-screen">
      <nav className="bg-gray-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between">
            <div className="flex space-x-0">
              {rol === 'administrador' && (
                <>
                  <button onClick={() => setVistaActual('menu')} className={`px-6 py-4 text-sm font-medium border-b-2 flex items-center gap-2 ${vistaActual === 'menu' ? 'border-orange-500 text-orange-500 bg-gray-700' : 'border-transparent hover:bg-gray-700'}`}>
                    <MenuIcon size={18} />Menú Cliente
                  </button>
                  <button onClick={() => setVistaActual('cocina')} className={`px-6 py-4 text-sm font-medium border-b-2 flex items-center gap-2 ${vistaActual === 'cocina' ? 'border-orange-500 text-orange-500 bg-gray-700' : 'border-transparent hover:bg-gray-700'}`}>
                    <ChefHat size={18} />Cocina
                    {pedidos.length > 0 && <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1">{pedidos.length}</span>}
                  </button>
                  <button onClick={() => setVistaActual('facturacion')} className={`px-6 py-4 text-sm font-medium border-b-2 flex items-center gap-2 ${vistaActual === 'facturacion' ? 'border-orange-500 text-orange-500 bg-gray-700' : 'border-transparent hover:bg-gray-700'}`}>
                    <Receipt size={18} />Facturación
                  </button>
                  <button onClick={() => setVistaActual('gestion-platillos')} className={`px-6 py-4 text-sm font-medium border-b-2 flex items-center gap-2 ${vistaActual === 'gestion-platillos' ? 'border-orange-500 text-orange-500 bg-gray-700' : 'border-transparent hover:bg-gray-700'}`}>
                    <Utensils size={18} />Platillos
                  </button>
                  <button onClick={() => setVistaActual('qr')} className={`px-6 py-4 text-sm font-medium border-b-2 flex items-center gap-2 ${vistaActual === 'qr' ? 'border-orange-500 text-orange-500 bg-gray-700' : 'border-transparent hover:bg-gray-700'}`}>
                    <QrCode size={18} />Generar QR
                  </button>
                  <button onClick={() => setVistaActual('reportes')} className={`px-6 py-4 text-sm font-medium border-b-2 flex items-center gap-2 ${vistaActual === 'reportes' ? 'border-orange-500 text-orange-500 bg-gray-700' : 'border-transparent hover:bg-gray-700'}`}>
                    <BarChart3 size={18} />Reportes
                  </button>
                </>
              )}
              
              {rol === 'cocina' && (
                <button onClick={() => setVistaActual('cocina')} className={`px-6 py-4 text-sm font-medium border-b-2 flex items-center gap-2 ${vistaActual === 'cocina' ? 'border-orange-500 text-orange-500 bg-gray-700' : 'border-transparent hover:bg-gray-700'}`}>
                  <ChefHat size={18} />Cocina
                  {pedidos.length > 0 && <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1">{pedidos.length}</span>}
                </button>
              )}

              {rol === 'caja' && (
                <button onClick={() => setVistaActual('facturacion')} className={`px-6 py-4 text-sm font-medium border-b-2 flex items-center gap-2 ${vistaActual === 'facturacion' ? 'border-orange-500 text-orange-500 bg-gray-700' : 'border-transparent hover:bg-gray-700'}`}>
                  <Receipt size={18} />Facturación
                </button>
              )}
            </div>
            <div className="flex items-center gap-4 px-4">
              <div className="text-right">
                <p className="text-sm font-semibold">{usuario?.nombre}</p>
                <p className="text-xs text-gray-400">Rol: {usuario?.rol}</p>
              </div>
              <button onClick={logout} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                <LogOut size={18} />
                Salir
              </button>
            </div>
          </div>
        </div>
      </nav>
      {renderVistaActual()}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;