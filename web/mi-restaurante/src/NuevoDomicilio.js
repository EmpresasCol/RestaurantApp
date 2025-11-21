// src/NuevoDomicilio.js - CORREGIDO: SIEMPRE PIDE DIRECCIÓN NUEVA
import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Minus, 
  X, 
  Check, 
  Phone, 
  MapPin, 
  ShoppingBag,
  ArrowLeft,
  User
} from 'lucide-react';
import { getPlatillos } from './services/api';
import {
  buscarClientePorTelefono,
  createClienteConDireccion,
  createDireccion,
  createDomicilio
} from './services/domiciliosApi';

function NuevoDomicilio({ onVolver, onDomicilioCreado }) {
  // Estados del formulario
  const [paso, setPaso] = useState(1);
  const [telefono, setTelefono] = useState('');
  const [cliente, setCliente] = useState(null);
  const [nuevoCliente, setNuevoCliente] = useState({ nombre: '', email: '', telefono: '' });
  const [direccion, setDireccion] = useState(null);
  const [nuevaDireccion, setNuevaDireccion] = useState({
    direccionCompleta: '',
    barrio: '',
    referenciasAdicionales: ''
  });
  
  // Estados del pedido
  const [platillos, setPlatillos] = useState([]);
  const [carrito, setCarrito] = useState([]);
  const [costoEnvio, setCostoEnvio] = useState(3000);
  const [metodoPago, setMetodoPago] = useState('Efectivo');
  const [pagadoAnticipado, setPagadoAnticipado] = useState(false);
  const [notasCliente, setNotasCliente] = useState('');
  
  // Estados de UI
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [esClienteNuevo, setEsClienteNuevo] = useState(false);

  useEffect(() => {
    cargarPlatillos();
  }, []);

  const cargarPlatillos = async () => {
    try {
      const response = await getPlatillos();
      setPlatillos(response);
    } catch (err) {
      console.error('Error al cargar platillos:', err);
      setError('Error al cargar platillos');
    }
  };

  const buscarCliente = async () => {
    if (!telefono.trim()) {
      alert('Ingresa un número de teléfono');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const clienteEncontrado = await buscarClientePorTelefono(telefono);
      
      if (clienteEncontrado) {
        // ✅ Cliente existe - Solo guardamos sus datos
        console.log('✅ Cliente encontrado:', clienteEncontrado);
        setCliente(clienteEncontrado);
        setEsClienteNuevo(false);
        setNuevoCliente({ 
          nombre: clienteEncontrado.nombre,
          email: clienteEncontrado.email || '',
          telefono: clienteEncontrado.telefono
        });
      } else {
        // ✅ Cliente NO existe
        console.log('⚠️ Cliente no encontrado. Debe registrarse');
        setCliente(null);
        setEsClienteNuevo(true);
        setNuevoCliente({ nombre: '', email: '', telefono });
      }
      
      // ✅ SIEMPRE IR AL PASO 2 PARA PEDIR DIRECCIÓN
      setPaso(2);
      
    } catch (err) {
      console.error('❌ Error al buscar cliente:', err);
      
      if (err.message.includes('404') || err.message.includes('no encontrado')) {
        setCliente(null);
        setEsClienteNuevo(true);
        setNuevoCliente({ nombre: '', email: '', telefono });
        setPaso(2);
      } else {
        setError('Error al buscar cliente: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const continuarConDireccion = async () => {
    // Validar dirección
    if (!nuevaDireccion.direccionCompleta.trim()) {
      alert('Ingresa la dirección completa');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      if (esClienteNuevo) {
        // ✅ Cliente nuevo: crear cliente + dirección
        if (!nuevoCliente.nombre.trim()) {
          alert('Ingresa el nombre del cliente');
          setLoading(false);
          return;
        }

        const response = await createClienteConDireccion({
          cliente: nuevoCliente,
          direccion: nuevaDireccion
        });

        setCliente({ id: response.clienteId, ...nuevoCliente });
        setDireccion({ id: response.direccionId, ...nuevaDireccion });
      } else {
        // ✅ Cliente existente: solo crear dirección nueva
        const response = await createDireccion(cliente.id, nuevaDireccion);
        setDireccion({ id: response.id, ...nuevaDireccion });
      }
      
      setPaso(3);
    } catch (err) {
      console.error('Error al guardar dirección:', err);
      setError('Error al guardar dirección: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const agregarAlCarrito = (platillo) => {
    const existe = carrito.find(item => item.id === platillo.id);
    if (existe) {
      setCarrito(carrito.map(item =>
        item.id === platillo.id
          ? { ...item, cantidad: item.cantidad + 1 }
          : item
      ));
    } else {
      setCarrito([...carrito, { ...platillo, cantidad: 1, nota: '' }]);
    }
  };

  const actualizarCantidad = (platilloId, cantidad) => {
    if (cantidad <= 0) {
      setCarrito(carrito.filter(item => item.id !== platilloId));
    } else {
      setCarrito(carrito.map(item =>
        item.id === platilloId ? { ...item, cantidad } : item
      ));
    }
  };

  const actualizarNota = (platilloId, nota) => {
    setCarrito(carrito.map(item =>
      item.id === platilloId ? { ...item, nota } : item
    ));
  };

  const calcularSubtotal = () => {
    return carrito.reduce((total, item) => total + (item.precio * item.cantidad), 0);
  };

  const calcularTotal = () => {
    return calcularSubtotal() + costoEnvio;
  };

  const crearDomicilio = async () => {
    if (carrito.length === 0) {
      alert('Agrega al menos un platillo al pedido');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const usuarioId = parseInt(localStorage.getItem('usuarioId') || '1');

      await createDomicilio({
        clienteId: cliente.id,
        direccionId: direccion.id,
        costoEnvio: costoEnvio,
        metodoPago: metodoPago,
        pagadoAnticipado: pagadoAnticipado,
        notasCliente: notasCliente,
        notasInternas: '',
        usuarioCreadorId: usuarioId,
        detalles: carrito.map(item => ({
          platilloId: item.id,
          cantidad: item.cantidad,
          nota: item.nota
        }))
      });

      setSuccess(true);
      
      if (onDomicilioCreado) {
        onDomicilioCreado();
      }
      
      setTimeout(() => {
        if (onVolver) {
          onVolver();
        }
      }, 2000);
    } catch (err) {
      console.error('Error al crear domicilio:', err);
      setError('Error al crear domicilio: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatearMoneda = (valor) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(valor);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg text-center max-w-md">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Domicilio Creado!</h2>
          <p className="text-gray-600 mb-2">El pedido ha sido enviado a cocina</p>
          <p className="text-sm text-gray-500 mb-4">El domicilio está listo para ser preparado</p>
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600"></div>
            Redirigiendo...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={onVolver}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Volver a Domicilios
          </button>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Nuevo Domicilio</h1>
          <p className="text-gray-600">Registra un nuevo pedido a domicilio</p>
        </div>

        {/* Indicador de pasos */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {[1, 2, 3].map(num => (
              <div key={num} className="flex items-center flex-1">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                  paso >= num ? 'bg-orange-600 text-white' : 'bg-gray-300 text-gray-600'
                }`}>
                  {num}
                </div>
                {num < 3 && (
                  <div className={`flex-1 h-1 mx-2 ${paso > num ? 'bg-orange-600' : 'bg-gray-300'}`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-sm">
            <span className={paso >= 1 ? 'text-orange-600 font-medium' : 'text-gray-600'}>Teléfono</span>
            <span className={paso >= 2 ? 'text-orange-600 font-medium' : 'text-gray-600'}>Dirección</span>
            <span className={paso >= 3 ? 'text-orange-600 font-medium' : 'text-gray-600'}>Pedido</span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* PASO 1: Teléfono del Cliente */}
        {paso === 1 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Phone className="w-6 h-6 text-orange-600" />
              Teléfono del Cliente
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Número de Teléfono
                </label>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && buscarCliente()}
                    placeholder="3001234567"
                    autoFocus
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-600 focus:border-transparent text-lg"
                  />
                  <button
                    onClick={buscarCliente}
                    disabled={loading}
                    className="bg-orange-600 hover:bg-orange-700 text-white px-8 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {loading ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                      <>
                        <Phone className="w-5 h-5" />
                        Continuar
                      </>
                    )}
                  </button>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Ingresa el teléfono del cliente. En el siguiente paso registrarás la dirección de entrega.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* PASO 2: Dirección (SIEMPRE SE MUESTRA) */}
        {paso === 2 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <MapPin className="w-6 h-6 text-orange-600" />
              Dirección de Entrega
            </h2>

            {/* Mensaje informativo según el tipo de cliente */}
            <div className={`${esClienteNuevo ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'} border rounded-lg p-4 mb-6`}>
              {esClienteNuevo ? (
                <>
                  <p className="text-sm text-blue-800 font-medium mb-2">
                    📱 Cliente nuevo: {telefono}
                  </p>
                  <p className="text-xs text-blue-600">
                    Complete los datos del cliente y la dirección de entrega para este pedido
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-green-800 font-medium mb-2">
                    ✅ Cliente registrado: {nuevoCliente.nombre}
                  </p>
                  <p className="text-xs text-green-600">
                    Complete la dirección de entrega para este pedido
                  </p>
                </>
              )}
            </div>

            <div className="space-y-4">
              {/* Solo mostrar campos de cliente si es nuevo */}
              {esClienteNuevo && (
                <div className="space-y-4 pb-4 border-b">
                  <h3 className="font-semibold text-gray-900">Datos del Cliente</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nombre Completo *
                    </label>
                    <input
                      type="text"
                      value={nuevoCliente.nombre}
                      onChange={(e) => setNuevoCliente({ ...nuevoCliente, nombre: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                      placeholder="Ej: Juan Pérez"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email (opcional)
                    </label>
                    <input
                      type="email"
                      value={nuevoCliente.email}
                      onChange={(e) => setNuevoCliente({ ...nuevoCliente, email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                      placeholder="correo@ejemplo.com"
                    />
                  </div>
                </div>
              )}

              {/* FORMULARIO DE DIRECCIÓN (SIEMPRE SE MUESTRA) */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900">Dirección de Entrega</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dirección Completa *
                  </label>
                  <input
                    type="text"
                    value={nuevaDireccion.direccionCompleta}
                    onChange={(e) => setNuevaDireccion({ ...nuevaDireccion, direccionCompleta: e.target.value })}
                    placeholder="Ej: Calle 25 #15-30"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                    autoFocus={!esClienteNuevo}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Barrio
                  </label>
                  <input
                    type="text"
                    value={nuevaDireccion.barrio}
                    onChange={(e) => setNuevaDireccion({ ...nuevaDireccion, barrio: e.target.value })}
                    placeholder="Ej: Centro"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Referencias Adicionales
                  </label>
                  <textarea
                    value={nuevaDireccion.referenciasAdicionales}
                    onChange={(e) => setNuevaDireccion({ ...nuevaDireccion, referenciasAdicionales: e.target.value })}
                    placeholder="Ej: Casa color blanca, portón negro, al lado de la tienda"
                    rows="3"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-600 focus:border-transparent resize-none"
                  />
                </div>
              </div>

              {/* Botones */}
              <div className="flex gap-2 pt-4">
                <button
                  onClick={() => setPaso(1)}
                  className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Volver
                </button>
                <button
                  onClick={continuarConDireccion}
                  disabled={loading}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      Continuar al Pedido
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PASO 3: Armar Pedido */}
        {paso === 3 && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <ShoppingBag className="w-6 h-6 text-orange-600" />
                Seleccionar Platillos
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {platillos.map(platillo => (
                  <div key={platillo.id} className="border rounded-lg p-4 hover:border-orange-600 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{platillo.nombre}</h3>
                        <p className="text-sm text-gray-600 mb-2">{platillo.descripcion}</p>
                        <p className="text-lg font-bold text-green-600">
                          {formatearMoneda(platillo.precio)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => agregarAlCarrito(platillo)}
                      className="w-full bg-orange-600 hover:bg-orange-700 text-white py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Agregar
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Carrito */}
            {carrito.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  🛒 Carrito ({carrito.length} {carrito.length === 1 ? 'item' : 'items'})
                </h3>
                
                <div className="space-y-4">
                  {carrito.map(item => (
                    <div key={item.id} className="border-b pb-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{item.nombre}</h4>
                          <p className="text-sm text-gray-600">{formatearMoneda(item.precio)} c/u</p>
                        </div>
                        <button
                          onClick={() => setCarrito(carrito.filter(i => i.id !== item.id))}
                          className="text-red-600 hover:text-red-800"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => actualizarCantidad(item.id, item.cantidad - 1)}
                            className="w-8 h-8 bg-gray-200 hover:bg-gray-300 rounded flex items-center justify-center"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-12 text-center font-bold">{item.cantidad}</span>
                          <button
                            onClick={() => actualizarCantidad(item.id, item.cantidad + 1)}
                            className="w-8 h-8 bg-gray-200 hover:bg-gray-300 rounded flex items-center justify-center"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>

                        <input
                          type="text"
                          value={item.nota}
                          onChange={(e) => actualizarNota(item.id, e.target.value)}
                          placeholder="Nota (opcional)"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />

                        <span className="font-bold text-gray-900 min-w-[100px] text-right">
                          {formatearMoneda(item.precio * item.cantidad)}
                        </span>
                      </div>
                    </div>
                  ))}

                  <div className="space-y-2 pt-4">
                    <div className="flex justify-between">
                      <span className="text-gray-700">Subtotal:</span>
                      <span className="font-semibold">{formatearMoneda(calcularSubtotal())}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Costo de envío:</span>
                      <input
                        type="number"
                        value={costoEnvio}
                        onChange={(e) => setCostoEnvio(parseFloat(e.target.value) || 0)}
                        className="w-32 px-3 py-1 border border-gray-300 rounded text-right"
                      />
                    </div>
                    <div className="flex justify-between text-xl font-bold border-t pt-3">
                      <span>Total:</span>
                      <span className="text-green-600">{formatearMoneda(calcularTotal())}</span>
                    </div>
                  </div>

                  <div className="space-y-3 pt-4 border-t">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Método de Pago
                      </label>
                      <select
                        value={metodoPago}
                        onChange={(e) => setMetodoPago(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-600"
                      >
                        <option value="Efectivo">Efectivo</option>
                        <option value="Transferencia">Transferencia</option>
                        <option value="Tarjeta">Tarjeta</option>
                        <option value="Nequi">Nequi</option>
                        <option value="Daviplata">Daviplata</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="pagado"
                        checked={pagadoAnticipado}
                        onChange={(e) => setPagadoAnticipado(e.target.checked)}
                        className="w-4 h-4"
                      />
                      <label htmlFor="pagado" className="text-sm text-gray-700">
                        Pagado anticipadamente
                      </label>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Notas del Cliente (opcional)
                      </label>
                      <textarea
                        value={notasCliente}
                        onChange={(e) => setNotasCliente(e.target.value)}
                        placeholder="Indicaciones especiales del pedido..."
                        rows="3"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg resize-none"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => setPaso(2)}
                      className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                    >
                      Volver
                    </button>
                    <button
                      onClick={crearDomicilio}
                      disabled={loading}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          Creando Domicilio...
                        </>
                      ) : (
                        <>
                          <ShoppingBag className="w-5 h-5" />
                          🚲 Crear Domicilio
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {carrito.length === 0 && (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">El carrito está vacío</p>
                <p className="text-sm text-gray-500">Selecciona platillos para agregar al pedido</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default NuevoDomicilio;