import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Minus, X, ChefHat, Receipt, Menu as MenuIcon, QrCode, MessageSquare, Check } from 'lucide-react';
import * as api from './services/api';
import Facturacion from './Facturacion';
import GeneradorQR from './GeneradorQR';

function App() {
  const [vistaActual, setVistaActual] = useState('menu');
  const [carrito, setCarrito] = useState([]);
  const [mostrarCarrito, setMostrarCarrito] = useState(false);
  const [pedidos, setPedidos] = useState([]);
  const [platillos, setPlatillos] = useState([]);
  const [mesaSeleccionada, setMesaSeleccionada] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [modalNota, setModalNota] = useState(null);
  const [notaTemp, setNotaTemp] = useState('');

  // Detectar mesa desde la URL al iniciar
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mesaUrl = params.get('mesa');
    
    if (mesaUrl) {
      const numeroMesa = parseInt(mesaUrl);
      if (numeroMesa >= 1 && numeroMesa <= 12) {
        setMesaSeleccionada(numeroMesa);
        console.log(`✅ Mesa ${numeroMesa} detectada desde URL`);
      }
    }
  }, []);

  // Cargar platillos desde la API al iniciar
  useEffect(() => {
    cargarPlatillos();
  }, []);

  // Cargar pedidos automáticamente cada 30 segundos
  useEffect(() => {
    if (vistaActual === 'cocina') {
      cargarPedidos();
      const interval = setInterval(cargarPedidos, 30000);
      return () => clearInterval(interval);
    }
  }, [vistaActual]);

  const cargarPlatillos = async () => {
    try {
      const data = await api.getPlatillos();
      setPlatillos(data);
    } catch (error) {
      console.error('Error al cargar platillos:', error);
      // Datos de ejemplo si falla la API
      setPlatillos([
        {
          id: 1,
          nombre: "Hamburguesa Clásica",
          descripcion: "Carne de res, lechuga, tomate, cebolla y salsa especial",
          precio: 15000,
          imagenUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop",
          categoria: "Hamburguesas"
        },
        {
          id: 2,
          nombre: "Pizza Margherita",
          descripcion: "Salsa de tomate, mozzarella fresca, albahaca y aceite de oliva",
          precio: 22000,
          imagenUrl: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=300&fit=crop",
          categoria: "Pizzas"
        },
        {
          id: 3,
          nombre: "Ensalada César",
          descripcion: "Lechuga romana, pollo grillado, crutones, parmesano y aderezo césar",
          precio: 12000,
          imagenUrl: "https://images.unsplash.com/photo-1546793665-c74683f339c1?w=400&h=300&fit=crop",
          categoria: "Ensaladas"
        },
        {
          id: 4,
          nombre: "Pasta Alfredo",
          descripcion: "Fettuccine en salsa cremosa de queso parmesano con pollo",
          precio: 18000,
          imagenUrl: "https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5?w=400&h=300&fit=crop",
          categoria: "Pastas"
        },
        {
          id: 5,
          nombre: "Tacos de Carnitas",
          descripcion: "Tortillas de maíz con carnitas, cebolla, cilantro y salsa verde",
          precio: 14000,
          imagenUrl: "https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=300&fit=crop",
          categoria: "Mexicano"
        },
        {
          id: 6,
          nombre: "Salmón Grillado",
          descripcion: "Filete de salmón con vegetales asados y salsa de limón",
          precio: 28000,
          imagenUrl: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400&h=300&fit=crop",
          categoria: "Pescados"
        }
      ]);
    }
  };

  const cargarPedidos = async () => {
    try {
      const data = await api.getPedidos();
      const pedidosTransformados = data
        .filter(p => p.estado !== 'entregado') // Filtrar pedidos entregados
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
          tiempoEstimado: 15,
          prioridad: 'normal',
          estado: p.estado
        }));
      setPedidos(pedidosTransformados);
    } catch (error) {
      console.error('Error al cargar pedidos:', error);
    }
  };

  const marcarComoEntregado = async (pedidoId) => {
    try {
      await api.updatePedido(pedidoId, 'entregado');
      // Recargar pedidos para actualizar la lista
      await cargarPedidos();
    } catch (error) {
      console.error('Error al marcar como entregado:', error);
      alert('Error al actualizar el estado del pedido');
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
      setCargando(true);
      try {
        // Transformar el carrito para incluir las notas en el formato correcto
        const carritoConNotas = carrito.map(item => ({
          ...item,
          notas: item.nota || ""
        }));
        
        await api.createPedido(mesaSeleccionada, carritoConNotas);
        
        alert('¡Pedido confirmado y enviado a cocina!');
        setCarrito([]);
        setMostrarCarrito(false);
        
        if (vistaActual === 'cocina') {
          await cargarPedidos();
        }
      } catch (error) {
        console.error('Error al confirmar pedido:', error);
        alert('Error al enviar el pedido. Por favor intenta de nuevo.');
      } finally {
        setCargando(false);
      }
    }
  };

  const total = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
  const totalItems = carrito.reduce((sum, item) => sum + item.cantidad, 0);

  // Menú Cliente
  const renderMenuCliente = () => (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Restaurante Délice</h1>
              {mesaSeleccionada ? (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                    ✓ Mesa #{mesaSeleccionada}
                  </span>
                </div>
              ) : (
                <p className="text-sm text-red-600 flex items-center gap-1">
                  <span>⚠️</span>
                  Escanea el QR de tu mesa
                </p>
              )}
            </div>
            <button 
              onClick={() => setMostrarCarrito(true)} 
              className="relative bg-orange-500 text-white p-3 rounded-full shadow-lg hover:bg-orange-600 transition-colors"
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
        {!mesaSeleccionada ? (
          <div className="bg-gradient-to-br from-orange-50 to-yellow-50 border-2 border-orange-300 rounded-2xl p-8 text-center mb-6 shadow-lg">
            <div className="text-7xl mb-4 animate-bounce">📱</div>
            <h2 className="text-3xl font-bold text-gray-800 mb-3">Escanea el QR de tu mesa</h2>
            <p className="text-gray-700 mb-4 text-lg">
              Cada mesa tiene un código QR único.<br/>
              <span className="font-semibold text-orange-600">Escanéalo para comenzar a ordenar.</span>
            </p>
            <div className="bg-white rounded-lg p-4 inline-block shadow-md">
              <div className="text-5xl mb-2">👆</div>
              <p className="text-sm text-gray-600">
                Apunta tu cámara al código QR
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Nuestro Menú</h2>
              <p className="text-gray-600">Selecciona tus platillos favoritos</p>
            </div>
            
            {platillos.length === 0 ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
                <p className="text-gray-500">Cargando menú...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {platillos.map(platillo => (
                  <div key={platillo.id} className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                    <div className="aspect-video overflow-hidden">
                      <img 
                        src={platillo.imagenUrl} 
                        alt={platillo.nombre} 
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                    <div className="p-5">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-lg text-gray-800">{platillo.nombre}</h3>
                        <span className="text-sm bg-orange-100 text-orange-600 px-2 py-1 rounded-full">
                          {platillo.categoria}
                        </span>
                      </div>
                      <p className="text-gray-600 text-sm mb-4">{platillo.descripcion}</p>
                      <div className="flex justify-between items-center">
                        <span className="text-xl font-bold text-orange-600">
                          {formatearPrecio(platillo.precio)}
                        </span>
                        <button 
                          onClick={() => agregarAlCarrito(platillo)} 
                          className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-2"
                        >
                          <Plus size={16} /> Agregar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Modal de Nota */}
      {modalNota && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <MessageSquare className="text-orange-500" size={24} />
              <h3 className="text-lg font-semibold">Agregar nota (opcional)</h3>
            </div>
            
            <p className="text-gray-600 mb-4">
              <strong>{modalNota.nombre}</strong>
            </p>
            
            <textarea
              value={notaTemp}
              onChange={(e) => setNotaTemp(e.target.value)}
              placeholder="Ej: Sin cebolla, término medio, etc."
              className="w-full border border-gray-300 rounded-lg p-3 mb-4 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              rows="3"
            />
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setModalNota(null);
                  setNotaTemp('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={agregarAlCarritoConNota}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
              >
                Agregar al carrito
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal del Carrito */}
      {mostrarCarrito && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end md:items-center justify-center">
          <div className="bg-white w-full md:w-96 md:rounded-xl max-h-screen md:max-h-[80vh] overflow-hidden">
            <div className="sticky top-0 bg-white border-b px-6 py-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Tu Pedido</h3>
                <button 
                  onClick={() => setMostrarCarrito(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-96">
              {carrito.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-5xl mb-3">🛒</div>
                  <p className="text-gray-500">Tu carrito está vacío</p>
                </div>
              ) : (
                carrito.map((item, index) => (
                  <div key={`${item.id}-${index}`} className="py-3 border-b border-gray-100">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{item.nombre}</h4>
                        {item.nota && (
                          <div className="mt-1 text-xs text-gray-600 bg-yellow-50 p-2 rounded">
                            <MessageSquare size={12} className="inline mr-1" />
                            {item.nota}
                          </div>
                        )}
                        <p className="text-orange-600 font-semibold text-sm mt-1">
                          {formatearPrecio(item.precio)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-3">
                        <button 
                          onClick={() => actualizarCantidad(item.id, item.nota, item.cantidad - 1)}
                          className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full hover:bg-gray-200"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-8 text-center font-medium">{item.cantidad}</span>
                        <button 
                          onClick={() => actualizarCantidad(item.id, item.nota, item.cantidad + 1)}
                          className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full hover:bg-gray-200"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {carrito.length > 0 && (
              <div className="sticky bottom-0 bg-white border-t px-6 py-4">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-lg font-semibold">Total:</span>
                  <span className="text-xl font-bold text-orange-600">
                    {formatearPrecio(total)}
                  </span>
                </div>
                {mesaSeleccionada ? (
                  <button 
                    onClick={confirmarPedido}
                    disabled={cargando}
                    className="w-full bg-orange-500 text-white py-3 rounded-lg font-semibold hover:bg-orange-600 transition-colors disabled:bg-gray-400"
                  >
                    {cargando ? 'Enviando...' : 'Confirmar Pedido'}
                  </button>
                ) : (
                  <div className="bg-red-50 text-red-600 text-center py-3 rounded-lg text-sm border-2 border-red-200">
                    ⚠️ Escanea el QR de tu mesa para ordenar
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  // Cocina
  const renderCocina = () => {
    const calcularTiempoTranscurrido = (horaInicio) => {
      const ahora = new Date();
      return Math.floor((ahora - horaInicio) / 60000);
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
                <button 
                  onClick={cargarPedidos}
                  className="mt-2 text-sm bg-orange-500 px-3 py-1 rounded hover:bg-orange-600"
                >
                  Actualizar
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="bg-gray-800 p-6 rounded-lg mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-300">Total de Órdenes Activas</p>
                <p className="text-3xl font-bold text-white">{pedidos.length}</p>
              </div>
              <ChefHat className="text-orange-500" size={32} />
            </div>
          </div>

          {pedidos.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-12 text-center">
              <ChefHat className="mx-auto text-gray-500 mb-4" size={64} />
              <h3 className="text-xl font-semibold text-gray-400 mb-2">No hay órdenes pendientes</h3>
              <p className="text-gray-500">Las órdenes aparecerán aquí cuando los clientes hagan pedidos</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {pedidos.map(pedido => (
                <div key={pedido.id} className="bg-gray-800 rounded-lg border border-gray-600 overflow-hidden">
                  <div className="p-4 bg-gray-700 border-b border-gray-600">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-xl font-bold text-white">Orden #{pedido.id}</h3>
                        <p className="text-gray-300">Mesa {pedido.mesa}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-400">Hace {calcularTiempoTranscurrido(pedido.hora)} min</p>
                        <p className="text-xs text-gray-500">{pedido.hora.toLocaleTimeString()}</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4">
                    <h4 className="text-lg font-semibold text-orange-400 mb-3">Platos:</h4>
                    <div className="space-y-3">
                      {pedido.items.map((item, index) => (
                        <div key={index} className="bg-gray-700 p-3 rounded-lg">
                          <div className="flex items-center gap-3">
                            <span className="bg-orange-500 text-white px-2 py-1 rounded-full text-sm font-bold">
                              {item.cantidad}
                            </span>
                            <span className="font-medium text-white text-lg">{item.nombre}</span>
                          </div>
                          {item.notas && (
                            <div className="mt-2 ml-11 p-2 bg-yellow-800 border-l-4 border-yellow-500 rounded">
                              <p className="text-sm text-yellow-200">
                                <MessageSquare size={14} className="inline mr-1" />
                                Nota: {item.notas}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 border-t border-gray-600">
                    <button
                      onClick={() => marcarComoEntregado(pedido.id)}
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <Check size={20} />
                      Marcar como Entregado
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderVistaActual = () => {
    switch (vistaActual) {
      case 'menu': return renderMenuCliente();
      case 'cocina': return renderCocina();
      case 'facturacion': return <Facturacion />;
      case 'qr': return <GeneradorQR />;
      default: return renderMenuCliente();
    }
  };

  return (
    <div className="min-h-screen">
      <nav className="bg-gray-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-0">
            <button 
              onClick={() => setVistaActual('menu')} 
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                vistaActual === 'menu' 
                  ? 'border-orange-500 text-orange-500 bg-gray-700' 
                  : 'border-transparent hover:text-gray-300 hover:bg-gray-700'
              }`}
            >
              <MenuIcon size={18} />
              Menú Cliente
            </button>
            
            <button 
              onClick={() => setVistaActual('cocina')} 
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                vistaActual === 'cocina' 
                  ? 'border-orange-500 text-orange-500 bg-gray-700' 
                  : 'border-transparent hover:text-gray-300 hover:bg-gray-700'
              }`}
            >
              <ChefHat size={18} />
              Cocina
              {pedidos.length > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1 ml-1">
                  {pedidos.length}
                </span>
              )}
            </button>
            
            <button 
              onClick={() => setVistaActual('facturacion')} 
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                vistaActual === 'facturacion' 
                  ? 'border-orange-500 text-orange-500 bg-gray-700' 
                  : 'border-transparent hover:text-gray-300 hover:bg-gray-700'
              }`}
            >
              <Receipt size={18} />
              Facturación
            </button>

            <button 
              onClick={() => setVistaActual('qr')} 
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                vistaActual === 'qr' 
                  ? 'border-orange-500 text-orange-500 bg-gray-700' 
                  : 'border-transparent hover:text-gray-300 hover:bg-gray-700'
              }`}
            >
              <QrCode size={18} />
              Generar QR
            </button>
          </div>
        </div>
      </nav>

      {renderVistaActual()}
    </div>
  );
}

export default App;