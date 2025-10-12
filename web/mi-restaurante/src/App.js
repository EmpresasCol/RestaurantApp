// src/App.js
import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Minus, X, ChefHat, Receipt, Menu as MenuIcon, QrCode, MessageSquare, Check, LogOut } from 'lucide-react';
import * as api from './services/api';
import Facturacion from './Facturacion';
import GeneradorQR from './GeneradorQR';
import Login from './components/Login';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider, useAuth } from './context/AuthContext';



// Componente principal con lógica de autenticación
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
    if (vistaActual === 'cocina' && estaAutenticado && !esClienteQR) {
      cargarPedidos();
      const interval = setInterval(cargarPedidos, 30000);
      return () => clearInterval(interval);
    }
  }, [vistaActual, estaAutenticado, esClienteQR]);

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
        }
      ]);
    }
  };

  const cargarPedidos = async () => {
    try {
      const data = await api.getPedidos();
      const pedidosTransformados = data
        // 🔥 Ocultar los pedidos entregados, pagados o cancelados
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
      await api.updatePedido(pedidoId, 'Entregado');
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

  // Vista de Menú Cliente
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
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
            <div className="flex items-start">
              <div className="ml-3">
                <p className="text-sm text-yellow-700 font-medium">
                  Para hacer un pedido, escanea el código QR de tu mesa
                </p>
                <p className="text-xs text-yellow-600 mt-1">
                  El código QR está ubicado en el centro de tu mesa
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6">
          {platillos.map(platillo => (
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
      </main>

      {/* Modal Carrito */}
      {mostrarCarrito && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-center sm:justify-center">
          <div className="bg-white w-full sm:max-w-lg sm:rounded-t-2xl rounded-t-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-xl font-bold text-gray-800">Tu Pedido</h3>
              <button onClick={() => setMostrarCarrito(false)} className="text-gray-500 hover:text-gray-700">
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
                    <div key={`${item.id}-${item.nota}-${index}`} className="bg-gray-50 p-3 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-800">{item.nombre}</h4>
                          {item.nota && (
                            <p className="text-xs text-gray-600 mt-1 italic">
                              <MessageSquare size={12} className="inline mr-1" />
                              {item.nota}
                            </p>
                          )}
                        </div>
                        <span className="font-bold text-orange-600">{formatearPrecio(item.precio * item.cantidad)}</span>
                      </div>
                      <div className="flex items-center justify-between">
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
                    </div>
                  ))}
                </div>
              )}
            </div>

            {carrito.length > 0 && (
              <div className="p-4 border-t border-gray-200 bg-gray-50">
                <div className="flex justify-between mb-4">
                  <span className="text-lg font-bold text-gray-800">Total:</span>
                  <span className="text-2xl font-bold text-orange-600">{formatearPrecio(total)}</span>
                </div>
                <button
                  onClick={confirmarPedido}
                  disabled={cargando || !mesaSeleccionada}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-50"
                >
                  {cargando ? 'Procesando...' : 'Confirmar Pedido'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Nota */}
      {modalNota && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">{modalNota.nombre}</h3>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nota para cocina (opcional)
            </label>
            <textarea
              value={notaTemp}
              onChange={(e) => setNotaTemp(e.target.value)}
              placeholder="Ej: Sin cebolla, término medio, etc."
              className="w-full border border-gray-300 rounded-lg p-3 text-sm resize-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              rows="3"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setModalNota(null)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 rounded-lg font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={agregarAlCarritoConNota}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg font-semibold transition-colors"
              >
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Vista de Cocina
  const renderCocina = () => (
    <div className="min-h-screen bg-gray-900 text-white pb-8">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h2 className="text-3xl font-bold mb-2">Órdenes de Cocina</h2>
          <p className="text-gray-400">Pedidos pendientes de preparación</p>
        </div>

        {pedidos.length === 0 ? (
          <div className="bg-gray-800 rounded-xl p-12 text-center">
            <ChefHat className="mx-auto text-gray-600 mb-4" size={64} />
            <p className="text-xl text-gray-400">No hay pedidos pendientes</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pedidos.map(pedido => (
              <div key={pedido.id} className="bg-gray-800 rounded-xl overflow-hidden border-l-4 border-orange-500">
                <div className="p-5 bg-gray-700 border-b border-gray-600">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="text-2xl font-bold text-white">Mesa {pedido.mesa}</span>
                      <p className="text-sm text-gray-400 mt-1">
                        {pedido.hora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <span className="bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                      {pedido.estado}
                    </span>
                  </div>
                </div>

                <div className="p-5">
                  <h4 className="font-semibold text-white mb-3">Platillos:</h4>
                  <div className="space-y-2">
                    {pedido.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-start bg-gray-700 p-3 rounded">
                        <div className="flex-1">
                          <span className="font-medium text-white">{item.nombre}</span>
                          {item.notas && (
                            <p className="text-xs text-orange-300 mt-1">
                              <MessageSquare size={12} className="inline mr-1" />
                              {item.notas}
                            </p>
                          )}
                        </div>
                        <span className="ml-2 bg-orange-500 text-white px-2 py-1 rounded text-sm font-bold">
                          x{item.cantidad}
                        </span>
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

  const renderVistaActual = () => {
    switch (vistaActual) {
      case 'menu':
        return renderMenuCliente();
      case 'cocina':
        return (
          <ProtectedRoute permisos={['caja']}>
            {renderCocina()}
          </ProtectedRoute>
        );
      case 'facturacion':
        return (
          <ProtectedRoute permisos={['caja']}>
            <Facturacion />
          </ProtectedRoute>
        );
      case 'qr':
        return (
          <ProtectedRoute permisos={['caja']}>
            <GeneradorQR />
          </ProtectedRoute>
        );
      default:
        return renderMenuCliente();
    }
  };

  // Mostrar pantalla de carga mientras se verifica la autenticación
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

  // Si no está autenticado y NO es cliente QR, mostrar login
  if (!estaAutenticado && !esClienteQR) {
    return <Login />;
  }

  // Si es cliente QR, solo mostrar el menú
  if (esClienteQR) {
    return renderMenuCliente();
  }

  // Usuario autenticado - mostrar navegación completa
  return (
    <div className="min-h-screen">
      <nav className="bg-gray-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between">
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

            {/* Usuario y Logout */}
            <div className="flex items-center gap-4 px-4">
              <div className="text-right">
                <p className="text-sm font-semibold">{usuario?.nombre}</p>
                <p className="text-xs text-gray-400">Rol: {usuario?.rol}</p>
              </div>
              <button
                onClick={logout}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
              >
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

// Wrapper principal con AuthProvider
function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;

