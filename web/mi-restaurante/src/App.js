import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Minus, X, ChefHat, Receipt, Menu as MenuIcon } from 'lucide-react';
import * as api from './services/api';
import Facturacion from './Facturacion';  // ← DEBE ESTAR ESTA LÍNEA

function App() {
  const [vistaActual, setVistaActual] = useState('menu');
  const [carrito, setCarrito] = useState([]);
  const [mostrarCarrito, setMostrarCarrito] = useState(false);
  const [pedidos, setPedidos] = useState([]);
  const [platillos, setPlatillos] = useState([]);
  const [facturas, setFacturas] = useState([]);
  const [mesaSeleccionada, setMesaSeleccionada] = useState(null);
  const [mostrarSelectorMesa, setMostrarSelectorMesa] = useState(true);
  const [cargando, setCargando] = useState(false);

  // Cargar platillos desde la API al iniciar
  useEffect(() => {
    cargarPlatillos();
  }, []);

  // Cargar pedidos automáticamente cada 30 segundos
  useEffect(() => {
    if (vistaActual === 'cocina') {
      cargarPedidos();
      const interval = setInterval(cargarPedidos, 30000); // Cada 30 segundos
      return () => clearInterval(interval);
    }
  }, [vistaActual]);

  // Cargar facturas cuando se abre la vista de facturación
  useEffect(() => {
    if (vistaActual === 'facturacion') {
      cargarFacturas();
    }
  }, [vistaActual]);

  // Funciones de carga desde API
  const cargarPlatillos = async () => {
    try {
      const data = await api.getPlatillos();
      setPlatillos(data);
    } catch (error) {
      console.error('Error al cargar platillos:', error);
      alert('Error al cargar el menú. Usando datos de ejemplo.');
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
        }
      ]);
    }
  };

  const cargarPedidos = async () => {
    try {
      const data = await api.getPedidos();
      // Transformar datos de la API al formato que usa el frontend
      const pedidosTransformados = data.map(p => ({
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

  const cargarFacturas = async () => {
    try {
      const pagos = await api.getPagos();
      
      // Transformar pagos a formato de facturas para el frontend
      const facturasTransformadas = pagos.map(pago => {
        const subtotal = pago.monto;
        const impuestos = Math.round(subtotal * 0.19);
        const total = subtotal + impuestos + pago.montoPropina;

        return {
          id: `INV-${pago.id}`,
          mesa: pago.pedido?.mesa?.numero || 0,
          fecha: new Date(pago.fecha),
          cliente: {
            nombre: `Cliente Mesa ${pago.pedido?.mesa?.numero || 0}`,
            documento: '00000000',
            telefono: '3000000000',
            email: 'cliente@email.com'
          },
          items: [], // Aquí podrías cargar los items del pedido si lo necesitas
          subtotal: subtotal,
          impuestos: impuestos,
          total: total,
          estado: pago.pedido?.estado === 'Pagado' ? 'pagada' : 'pendiente',
          metodoPago: pago.metodoPago.toLowerCase()
        };
      });

      setFacturas(facturasTransformadas);
    } catch (error) {
      console.error('Error al cargar facturas:', error);
    }
  };

  // Utilidades
  const formatearPrecio = (precio) =>
    new Intl.NumberFormat('es-CO', { 
      style: 'currency', 
      currency: 'COP', 
      minimumFractionDigits: 0 
    }).format(precio);

  // Carrito
  const agregarAlCarrito = (platillo) => {
    const itemExistente = carrito.find(item => item.id === platillo.id);
    if (itemExistente) {
      setCarrito(carrito.map(item =>
        item.id === platillo.id ? { ...item, cantidad: item.cantidad + 1 } : item
      ));
    } else {
      setCarrito([...carrito, { ...platillo, cantidad: 1 }]);
    }
  };

  const actualizarCantidad = (id, nuevaCantidad) => {
    if (nuevaCantidad === 0) {
      setCarrito(carrito.filter(item => item.id !== id));
    } else {
      setCarrito(carrito.map(item =>
        item.id === id ? { ...item, cantidad: nuevaCantidad } : item
      ));
    }
  };

  const confirmarPedido = async () => {
    if (carrito.length > 0 && mesaSeleccionada) {
      setCargando(true);
      try {
        // Crear pedido en la API
        const nuevoPedido = await api.createPedido(mesaSeleccionada, carrito);
        
        alert('¡Pedido confirmado y enviado a cocina!');
        setCarrito([]);
        setMostrarCarrito(false);
        
        // Recargar pedidos si estamos en la vista de cocina
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

  // Cambiar estados
  const cambiarEstadoFactura = async (facturaId, nuevoEstado, metodoPago = 'efectivo') => {
    try {
      // Aquí podrías llamar a la API para actualizar el estado del pago
      // Por ahora solo actualizamos localmente
      setFacturas(facturas.map(f => f.id === facturaId
        ? { ...f, estado: nuevoEstado, metodoPago: nuevoEstado === 'pagada' ? metodoPago : 'pendiente' }
        : f
      ));
    } catch (error) {
      console.error('Error al cambiar estado:', error);
    }
  };

  // Totales
  const total = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
  const totalItems = carrito.reduce((sum, item) => sum + item.cantidad, 0);

  // Selector de Mesa
  const renderSelectorMesa = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold text-center mb-6">Selecciona tu Mesa</h2>
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(numeroMesa => (
            <button 
              key={numeroMesa} 
              onClick={() => { 
                setMesaSeleccionada(numeroMesa); 
                setMostrarSelectorMesa(false); 
              }}
              className="bg-orange-500 hover:bg-orange-600 text-white py-4 px-6 rounded-lg font-semibold text-lg transition-colors"
            >
              Mesa {numeroMesa}
            </button>
          ))}
        </div>
        <p className="text-center text-gray-600 text-sm">
          Selecciona el número de mesa donde te encuentras
        </p>
      </div>
    </div>
  );

  // Menú Cliente
  const renderMenuCliente = () => (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Restaurante Délice</h1>
              <p className="text-sm text-gray-600">Mesa #{mesaSeleccionada}</p>
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
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Nuestro Menú</h2>
          <p className="text-gray-600">Selecciona tus platillos favoritos</p>
        </div>
        
        {platillos.length === 0 ? (
          <div className="text-center py-12">
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
      </main>

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
                <p className="text-gray-500 text-center py-8">Tu carrito está vacío</p>
              ) : (
                carrito.map(item => (
                  <div key={item.id} className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{item.nombre}</h4>
                      <p className="text-orange-600 font-semibold text-sm">
                        {formatearPrecio(item.precio)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => actualizarCantidad(item.id, item.cantidad - 1)}
                        className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full hover:bg-gray-200"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-8 text-center font-medium">{item.cantidad}</span>
                      <button 
                        onClick={() => actualizarCantidad(item.id, item.cantidad + 1)}
                        className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full hover:bg-gray-200"
                      >
                        <Plus size={14} />
                      </button>
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
                <button 
                  onClick={confirmarPedido}
                  disabled={cargando}
                  className="w-full bg-orange-500 text-white py-3 rounded-lg font-semibold hover:bg-orange-600 transition-colors disabled:bg-gray-400"
                >
                  {cargando ? 'Enviando...' : 'Confirmar Pedido'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  // Cocina (Con datos de la API)
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
                <p className="text-gray-300">Total de Órdenes</p>
                <p className="text-3xl font-bold text-white">{pedidos.length}</p>
              </div>
              <ChefHat className="text-orange-500" size={32} />
            </div>
          </div>

          {pedidos.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-12 text-center">
              <ChefHat className="mx-auto text-gray-500 mb-4" size={64} />
              <h3 className="text-xl font-semibold text-gray-400 mb-2">No hay órdenes</h3>
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
                              <p className="text-sm text-yellow-200">Nota: {item.notas}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Facturación (simplificado por ahora)
  const renderFacturacion = () => {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center gap-3">
              <Receipt className="text-blue-600" size={32} />
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Sistema de Facturación</h1>
                <p className="text-gray-600">Restaurante Délice</p>
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <Receipt className="mx-auto text-gray-400 mb-4" size={64} />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">Facturación conectada a API</h3>
            <p className="text-gray-500">Los pagos se registrarán en la base de datos</p>
            <button 
              onClick={cargarFacturas}
              className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              Cargar Facturas
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Vista actual
const renderVistaActual = () => {
  switch (vistaActual) {
    case 'menu': return renderMenuCliente();
    case 'cocina': return renderCocina();
    case 'facturacion': return <Facturacion />;  // ← DEBE ESTAR ASÍ
    default: return renderMenuCliente();
  }
};
  return (
    <div className="min-h-screen">
      {mostrarSelectorMesa && renderSelectorMesa()}

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
          </div>
        </div>
      </nav>

      {renderVistaActual()}
    </div>
  );
}

export default App;