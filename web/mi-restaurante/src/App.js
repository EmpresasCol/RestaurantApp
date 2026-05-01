// src/App.js 
import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Minus, X, ChefHat, Receipt, Menu as MenuIcon, QrCode, LogOut, BarChart3, Utensils, Users, Truck } from 'lucide-react';
import * as api from './services/api';
import Facturacion from './Facturacion';
import GeneradorQR from './GeneradorQR';
import Login from './components/Login';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider, useAuth } from './context/AuthContext';
import Reportes from './Reportes';
import GestionPlatillos from './GestionPlatillos';
import GestionUsuarios from './GestionUsuarios';
import Cocina from './Cocina'; 
import CocinaView from './CocinaView'; 
import Inventario from './Inventario';
import { Package } from 'lucide-react';

// IMPORTAR COMPONENTES DE DOMICILIOS
import Domicilios from './Domicilios';
import NuevoDomicilio from './NuevoDomicilio';

function AppContent() {
  const [errorNota, setErrorNota] = useState(null);
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
    if (vistaActual === 'cocina') {
      cargarPedidos();
    }
  }, []);

  useEffect(() => {
    if (vistaActual === 'cocina' && !esClienteQR) {
      cargarPedidos();
      const interval = setInterval(cargarPedidos, 2000);
      return () => clearInterval(interval);
    }
  }, [vistaActual, esClienteQR]);

  useEffect(() => {
    if (usuario) {
      const rol = usuario.rol?.toLowerCase();
      if (rol === 'cocina' && vistaActual !== 'cocina') {
        setVistaActual('cocina');
      } else if (rol === 'caja' && vistaActual !== 'facturacion') {
        setVistaActual('facturacion');
      }
    }
  }, [usuario, vistaActual]);

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

      const idsAnteriores = pedidos.map(p => p.id);
      const nuevos = pedidosTransformados.filter(p => !idsAnteriores.includes(p.id));

      if (nuevos.length > 0) {
        console.log('🔔 Nuevos pedidos detectados:', nuevos.length);
        const ahora = Date.now();
        const nuevosConTiempo = nuevos.map(p => ({
          id: p.id,
          timestamp: ahora
        }));
        setPedidosNuevos(prev => [...prev, ...nuevosConTiempo]);
      }

      const ahora = Date.now();
      setPedidosNuevos(prev => prev.filter(p => ahora - p.timestamp < 5000));

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
        titulo: '¿Confirmar Pedido?',
        mensaje: `Mesa: ${mesaSeleccionada}\nTotal de items: ${carrito.reduce((sum, item) => sum + item.cantidad, 0)}\n\n¿Deseas enviar este pedido a la cocina?`,
        onConfirmar: async () => {
          setCargando(true);
          setModalConfirmacion(null);
          try {
            await api.createPedido(mesaSeleccionada, carrito);
            setCarrito([]);
            setMostrarCarrito(false);
            setModalAlerta({
              tipo: 'exito',
              titulo: '¡Pedido Enviado!',
              mensaje: `Tu pedido ha sido enviado a la cocina de la mesa ${mesaSeleccionada}.`
            });
          } catch (error) {
            setModalAlerta({
              tipo: 'error',
              titulo: 'Error',
              mensaje: `No se pudo enviar el pedido: ${error.message}`
            });
          } finally {
            setCargando(false);
          }
        },
        onCancelar: () => setModalConfirmacion(null)
      });
    }
  };

  const calcularTotal = () =>
    carrito.reduce((total, item) => total + item.precio * item.cantidad, 0);

  const agruparPorCategoria = (platillos) => {
    const grupos = {};
    platillos.forEach(platillo => {
      const cat = platillo.categoria || 'Sin categoría';
      if (!grupos[cat]) grupos[cat] = [];
      grupos[cat].push(platillo);
    });
    return grupos;
  };

  const renderMenuCliente = () => {
    const platillosAgrupados = agruparPorCategoria(platillos);

    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50">
        <div className="bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-xl">
          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold mb-2">🍽️ Restaurante Délice</h1>
                {mesaSeleccionada && (
                  <p className="text-orange-100 text-lg">Mesa: <span className="font-bold">{mesaSeleccionada}</span></p>
                )}
              </div>
              <button
                onClick={() => setMostrarCarrito(!mostrarCarrito)}
                className="relative bg-white text-orange-600 px-6 py-3 rounded-full shadow-lg hover:shadow-xl transition-all font-bold flex items-center gap-2"
              >
                <ShoppingCart size={24} />
                <span>Carrito</span>
                {carrito.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                    {carrito.reduce((sum, item) => sum + item.cantidad, 0)}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8">
          {Object.entries(platillosAgrupados).map(([categoria, items]) => (
            <div key={categoria} className="mb-12">
              <h2 className="text-3xl font-bold text-gray-800 mb-6 pb-2 border-b-4 border-orange-500">
                {categoria}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {items.map(platillo => (
                  <div key={platillo.id} className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all overflow-hidden group">
                    <div className="relative h-48 overflow-hidden bg-gradient-to-br from-orange-100 to-red-100">
                      {platillo.imagenUrl ? (
                        <img
                          src={platillo.imagenUrl}
                          alt={platillo.nombre}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          onError={(e) => {
                            e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"%3E%3Crect fill="%23f97316" width="200" height="200"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-size="80" fill="white"%3E🍽️%3C/text%3E%3C/svg%3E';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-6xl">
                          🍽️
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    </div>
                    <div className="p-6">
                      <h3 className="text-xl font-bold text-gray-800 mb-2">{platillo.nombre}</h3>
                      <p className="text-gray-600 text-sm mb-4 line-clamp-2">{platillo.descripcion}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold text-orange-600">
                          {formatearPrecio(platillo.precio)}
                        </span>
                        <button
                          onClick={() => agregarAlCarrito(platillo)}
                          className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-full font-semibold shadow-md hover:shadow-lg transition-all flex items-center gap-2"
                        >
                          <Plus size={20} />
                          Agregar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {mostrarCarrito && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end md:items-center justify-center p-4">
            <div className="bg-white rounded-t-3xl md:rounded-3xl w-full md:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
              <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ShoppingCart size={28} />
                  <div>
                    <h2 className="text-2xl font-bold">Tu Pedido</h2>
                    <p className="text-orange-100">Mesa {mesaSeleccionada}</p>
                  </div>
                </div>
                <button
                  onClick={() => setMostrarCarrito(false)}
                  className="bg-white/20 hover:bg-white/30 p-2 rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {carrito.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">🛒</div>
                    <p className="text-gray-500 text-lg">Tu carrito está vacío</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {carrito.map((item, index) => (
                      <div key={`${item.id}-${item.nota}-${index}`} className="bg-gray-50 rounded-xl p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h3 className="font-bold text-gray-800">{item.nombre}</h3>
                            {item.nota && (
                              <p className="text-sm text-gray-600 italic mt-1">
                                📝 Nota: {item.nota}
                              </p>
                            )}
                            <p className="text-orange-600 font-semibold mt-2">
                              {formatearPrecio(item.precio * item.cantidad)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 bg-white rounded-lg px-3 py-2 shadow-sm">
                            <button
                              onClick={() => actualizarCantidad(item.id, item.nota, item.cantidad - 1)}
                              className="w-8 h-8 bg-orange-100 hover:bg-orange-200 rounded-full flex items-center justify-center text-orange-600 font-bold"
                            >
                              <Minus size={18} />
                            </button>
                            <span className="text-lg font-bold w-8 text-center">{item.cantidad}</span>
                            <button
                              onClick={() => actualizarCantidad(item.id, item.nota, item.cantidad + 1)}
                              className="w-8 h-8 bg-orange-100 hover:bg-orange-200 rounded-full flex items-center justify-center text-orange-600 font-bold"
                            >
                              <Plus size={18} />
                            </button>
                          </div>
                          <button
                            onClick={() => actualizarCantidad(item.id, item.nota, 0)}
                            className="text-red-500 hover:text-red-700 font-semibold"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {carrito.length > 0 && (
                <div className="border-t bg-gray-50 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-xl font-semibold text-gray-700">Total:</span>
                    <span className="text-3xl font-bold text-orange-600">
                      {formatearPrecio(calcularTotal())}
                    </span>
                  </div>
                  <button
                    onClick={confirmarPedido}
                    disabled={cargando || !mesaSeleccionada}
                    className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {cargando ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Enviando...
                      </span>
                    ) : (
                      '🍽️ Confirmar Pedido'
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {modalNota && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6">
              <div className="mb-6">
                <h3 className="text-2xl font-bold mb-2">{modalNota.nombre}</h3>
                <p className="text-gray-600">{formatearPrecio(modalNota.precio)}</p>
              </div>
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  ¿Alguna indicación especial? (opcional)
                </label>
                <textarea
                  value={notaTemp}
                  onChange={(e) => setNotaTemp(e.target.value)}
                  placeholder="Ej: Sin cebolla, término medio, etc."
                  className="w-full border-2 border-gray-300 rounded-lg p-3 focus:border-orange-500 focus:outline-none"
                  rows="3"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setModalNota(null)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 py-3 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button
                  onClick={agregarAlCarritoConNota}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-semibold"
                >
                  Agregar al Carrito
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

  const renderVistaActual = () => {
    switch (vistaActual) {
      case 'menu':
        return renderMenuCliente();
      case 'cocina':
        return (
          <ProtectedRoute permisos={['administrador', 'cocina']}>
            {usuario?.rol?.toLowerCase() === 'cocina' ? (
              <CocinaView pedidos={pedidos} onActualizarPedidos={cargarPedidos} />
            ) : (
              <Cocina pedidos={pedidos} onActualizarPedidos={cargarPedidos} />
            )}
          </ProtectedRoute>
        );
      case 'facturacion':
        return <ProtectedRoute permisos={['administrador', 'caja']}><Facturacion /></ProtectedRoute>;
      case 'qr':
        return <ProtectedRoute permisos={['administrador']}><GeneradorQR /></ProtectedRoute>;
      case 'reportes':
        return <ProtectedRoute permisos={['administrador']}><Reportes /></ProtectedRoute>;
      case 'gestion-platillos':
        return <ProtectedRoute permisos={['administrador']}><GestionPlatillos /></ProtectedRoute>;
      case 'gestion-usuarios':
        return <ProtectedRoute permisos={['administrador']}><GestionUsuarios /></ProtectedRoute>;
      case 'inventario':
        return <ProtectedRoute permisos={['administrador']}><Inventario /></ProtectedRoute>;
      
      // ✅ VISTAS DE DOMICILIOS
      case 'domicilios':
        return (
          <ProtectedRoute permisos={['administrador']}>
            <Domicilios 
              onNuevoDomicilio={() => setVistaActual('domicilios-nuevo')} 
            />
          </ProtectedRoute>
        );
      case 'domicilios-nuevo':
        return (
          <ProtectedRoute permisos={['administrador']}>
            <NuevoDomicilio 
              onVolver={() => setVistaActual('domicilios')}
              onDomicilioCreado={() => cargarPedidos()} // ✅ Recargar pedidos para que aparezcan en cocina
            />
          </ProtectedRoute>
        );
      
      default:
        return renderMenuCliente();
    }
  };


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


  if (rol === 'cocina') {
    return (
      <div className="min-h-screen">
        {renderVistaActual()}
      </div>
    );
  }

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
                  
                  {/* ✅ BOTÓN DE DOMICILIOS */}
                  <button onClick={() => setVistaActual('domicilios')} className={`px-6 py-4 text-sm font-medium border-b-2 flex items-center gap-2 ${vistaActual === 'domicilios' || vistaActual === 'domicilios-nuevo' ? 'border-orange-500 text-orange-500 bg-gray-700' : 'border-transparent hover:bg-gray-700'}`}>
                    <Truck size={18} />Domicilios
                  </button>
                  
                  <button onClick={() => setVistaActual('gestion-platillos')} className={`px-6 py-4 text-sm font-medium border-b-2 flex items-center gap-2 ${vistaActual === 'gestion-platillos' ? 'border-orange-500 text-orange-500 bg-gray-700' : 'border-transparent hover:bg-gray-700'}`}>
                    <Utensils size={18} />Platillos
                  </button>
                  <button onClick={() => setVistaActual('gestion-usuarios')} className={`px-6 py-4 text-sm font-medium border-b-2 flex items-center gap-2 ${vistaActual === 'gestion-usuarios' ? 'border-orange-500 text-orange-500 bg-gray-700' : 'border-transparent hover:bg-gray-700'}`}>
                    <Users size={18} />Usuarios
                  </button>
                  
                  <button onClick={() => setVistaActual('inventario')} className={`px-6 py-4 text-sm font-medium border-b-2 flex items-center gap-2 ${vistaActual === 'inventario' ? 'border-orange-500 text-orange-500 bg-gray-700' : 'border-transparent hover:bg-gray-700'}`}>
                    <Package size={18} />Inventario
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