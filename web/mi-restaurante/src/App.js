import React, { useState } from 'react';
import { ShoppingCart, Plus, Minus, X } from 'lucide-react';

// Datos de prueba
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
  const [carrito, setCarrito] = useState([]);
  const [mostrarCarrito, setMostrarCarrito] = useState(false);

  const agregarAlCarrito = (platillo) => {
    const itemExistente = carrito.find(item => item.id === platillo.id);
    if (itemExistente) {
      setCarrito(carrito.map(item =>
        item.id === platillo.id 
          ? { ...item, cantidad: item.cantidad + 1 }
          : item
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

  const total = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
  const totalItems = carrito.reduce((sum, item) => sum + item.cantidad, 0);

  const formatearPrecio = (precio) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(precio);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Restaurante Délice</h1>
              <p className="text-sm text-gray-600">Mesa #5</p>
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

      {/* Menú */}
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
                    <Plus size={16} />
                    Agregar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Carrito Modal */}
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
                <>
                  {carrito.map(item => (
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
                  ))}
                </>
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
                <button className="w-full bg-orange-500 text-white py-3 rounded-lg font-semibold hover:bg-orange-600 transition-colors">
                  Confirmar Pedido
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;