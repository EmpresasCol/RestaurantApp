import React, { useState } from 'react';
import { ShoppingCart, Plus, Minus, X, ChefHat, Receipt, Menu as MenuIcon } from 'lucide-react';
import Facturacion from './Facturacion';  


console.log('API URL:', process.env.REACT_APP_API_URL);


// Datos del menú
const platillos = [
  {
    id: 1,
    nombre: "Hamburguesa Clásica",
    descripcion: "Carne de res, lechuga, tomate, cebolla y salsa especial",
    precio: 15000,
    imagen: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop",
    categoria: "Hamburguesas"
  },
  {
    id: 2,
    nombre: "Pizza Margherita",
    descripcion: "Salsa de tomate, mozzarella fresca, albahaca y aceite de oliva",
    precio: 22000,
    imagen: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=300&fit=crop",
    categoria: "Pizzas"
  },
  {
    id: 3,
    nombre: "Ensalada César",
    descripcion: "Lechuga romana, pollo grillado, crutones, parmesano y aderezo césar",
    precio: 12000,
    imagen: "https://images.unsplash.com/photo-1546793665-c74683f339c1?w=400&h=300&fit=crop",
    categoria: "Ensaladas"
  },
  {
    id: 4,
    nombre: "Pasta Alfredo",
    descripcion: "Fettuccine en salsa cremosa de queso parmesano con pollo",
    precio: 18000,
    imagen: "https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5?w=400&h=300&fit=crop",
    categoria: "Pastas"
  },
  {
    id: 5,
    nombre: "Tacos de Carnitas",
    descripcion: "Tortillas de maíz con carnitas, cebolla, cilantro y salsa verde",
    precio: 14000,
    imagen: "https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=300&fit=crop",
    categoria: "Mexicano"
  },
  {
    id: 6,
    nombre: "Salmón Grillado",
    descripcion: "Filete de salmón con vegetales asados y salsa de limón",
    precio: 28000,
    imagen: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400&h=300&fit=crop",
    categoria: "Pescados"
  }
];

function App() {
  const [vistaActual, setVistaActual] = useState('menu');
  const [carrito, setCarrito] = useState([]);
  const [mostrarCarrito, setMostrarCarrito] = useState(false);
  const [pedidos, setPedidos] = useState([]);
  const [facturas, setFacturas] = useState([]);
  const [mesaSeleccionada, setMesaSeleccionada] = useState(null);
  const [mostrarSelectorMesa, setMostrarSelectorMesa] = useState(true);

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

  const confirmarPedido = () => {
    if (carrito.length > 0 && mesaSeleccionada) {
      const nuevoPedido = {
        id: Date.now(),
        mesa: mesaSeleccionada,
        items: carrito.map(item => ({
          id: item.id,
          nombre: item.nombre,
          cantidad: item.cantidad,
          notas: ""
        })),
        hora: new Date(),
        tiempoEstimado: 15,
        prioridad: 'normal'
      };
      setPedidos(prev => [...prev, nuevoPedido]);

      const subtotal = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
      const impuestos = Math.round(subtotal * 0.19);

      const nuevaFactura = {
        id: `INV-${Date.now()}`,
        mesa: mesaSeleccionada,
        fecha: new Date(),
        cliente: { 
          nombre: `Cliente Mesa ${mesaSeleccionada}`, 
          documento: '00000000', 
          telefono: '3000000000', 
          email: 'cliente@email.com' 
        },
        items: carrito.map(item => ({ 
          nombre: item.nombre, 
          cantidad: item.cantidad, 
          precio: item.precio, 
          total: item.precio * item.cantidad 
        })),
        subtotal: subtotal,
        impuestos: impuestos,
        total: subtotal + impuestos,
        estado: 'pendiente',
        metodoPago: 'pendiente'
      };

      setFacturas(prev => [...prev, nuevaFactura]);
      setCarrito([]);
      setMostrarCarrito(false);
      alert('Pedido confirmado y enviado a cocina!');
    }
  };

  // Cambiar estados
  const cambiarEstadoFactura = (facturaId, nuevoEstado, metodoPago = 'efectivo') => {
    setFacturas(facturas.map(f => f.id === facturaId
      ? { ...f, estado: nuevoEstado, metodoPago: nuevoEstado === 'pagada' ? metodoPago : 'pendiente' }
      : f
    ));
  };

  // Totales
  const total = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
  const totalItems = carrito.reduce((sum, item) => sum + item.cantidad, 0);

  // Selector de Mesa (solo una vez)
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
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {platillos.map(platillo => (
            <div key={platillo.id} className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              <div className="aspect-video overflow-hidden">
                <img 
                  src={platillo.imagen} 
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
                  className="w-full bg-orange-500 text-white py-3 rounded-lg font-semibold hover:bg-orange-600 transition-colors"
                >
                  Confirmar Pedido
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  // Cocina (Solo visualización)
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

  // Facturación
  const renderFacturacion = () => {
    return (
      <Facturacion 
        facturas={facturas} 
        onCambiarEstadoFactura={cambiarEstadoFactura}
      />
    );
  };

  // Vista actual
  const renderVistaActual = () => {
    switch (vistaActual) {
      case 'menu': return renderMenuCliente();
      case 'cocina': return renderCocina();
      case 'facturacion': return renderFacturacion();
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
              {facturas.filter(f => f.estado === 'pendiente').length > 0 && (
                <span className="bg-yellow-500 text-white text-xs rounded-full px-2 py-1 ml-1">
                  {facturas.filter(f => f.estado === 'pendiente').length}
                </span>
              )}
            </button>
          </div>
        </div>
      </nav>

      {renderVistaActual()}
    </div>
  );
}

export default App;