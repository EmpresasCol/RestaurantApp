// src/components/inventario/GestionRecetas.js
import React, { useState, useEffect } from 'react';
import { 
  ChefHat, 
  Plus, 
  Trash2, 
  Edit2, 
  RefreshCw, 
  Search, 
  CheckCircle, 
  AlertCircle, 
  X, 
  UtensilsCrossed, 
  DollarSign, 
  Scale, 
  Sparkles,
  Info
} from 'lucide-react';
import * as inventarioApi from '../../services/inventarioApi';

function GestionRecetas() {
  const [platillos, setPlatillos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [recetas, setRecetas] = useState([]);
  const [platilloSeleccionado, setPlatilloSeleccionado] = useState(null);
  const [busquedaPlatillo, setBusquedaPlatillo] = useState('');
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [recetaEditando, setRecetaEditando] = useState(null);
  const [alerta, setAlerta] = useState(null);

  const [formData, setFormData] = useState({
    productoId: '',
    cantidadRequerida: 0.1,
    unidadMedida: 'Kg',
    notas: ''
  });

  const unidadesMedida = [
    'Kg', 'Gramos', 'Litro', 'Mililitro', 'Unidad', 
    'Paquete', 'Caja', 'Botella', 'Lata', 'Pieza', 
    'Porcion', 'Taza', 'Cucharada', 'Cucharadita'
  ];

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setCargando(true);
    try {
      const [platillosData, productosData, recetasData] = await Promise.all([
        inventarioApi.getPlatillos(),
        inventarioApi.getProductos(),
        inventarioApi.getRecetas()
      ]);

      setPlatillos(platillosData || []);
      setProductos(productosData || []);
      setRecetas(recetasData || []);

      if (platillosData && platillosData.length > 0 && !platilloSeleccionado) {
        setPlatilloSeleccionado(platillosData[0]);
      }
    } catch (error) {
      console.error('Error al cargar datos de recetas:', error);
      mostrarAlerta('error', 'Error al cargar los datos del inventario y recetas.');
    } finally {
      setCargando(false);
    }
  };

  const mostrarAlerta = (tipo, mensaje) => {
    setAlerta({ tipo, mensaje });
    setTimeout(() => setAlerta(null), 4000);
  };

  const recetasDelPlatillo = recetas.filter(
    (r) => platilloSeleccionado && r.platilloId === platilloSeleccionado.id
  );

  const costoTotalReceta = recetasDelPlatillo.reduce(
    (sum, r) => sum + (r.cantidadRequerida * (r.costoUnitario || 0)), 
    0
  );

  const margenGanancia = platilloSeleccionado && platilloSeleccionado.precio > 0
    ? (((platilloSeleccionado.precio - costoTotalReceta) / platilloSeleccionado.precio) * 100).toFixed(1)
    : 0;

  const foodCostPorcentaje = platilloSeleccionado && platilloSeleccionado.precio > 0
    ? ((costoTotalReceta / platilloSeleccionado.precio) * 100).toFixed(1)
    : 0;

  const abrirModalNuevo = () => {
    setRecetaEditando(null);
    setFormData({
      productoId: productos.length > 0 ? productos[0].id : '',
      cantidadRequerida: 0.1,
      unidadMedida: productos.length > 0 ? (productos[0].unidadMedida || 'Kg') : 'Kg',
      notas: ''
    });
    setModalAbierto(true);
  };

  const abrirModalEditar = (receta) => {
    setRecetaEditando(receta);
    setFormData({
      productoId: receta.productoId,
      cantidadRequerida: receta.cantidadRequerida,
      unidadMedida: receta.unidadMedida || 'Kg',
      notas: receta.notas || ''
    });
    setModalAbierto(true);
  };

  const handleProductoChange = (prodId) => {
    const prod = productos.find(p => p.id === parseInt(prodId));
    setFormData(prev => ({
      ...prev,
      productoId: prodId,
      unidadMedida: prod ? prod.unidadMedida : prev.unidadMedida
    }));
  };

  const handleGuardarReceta = async (e) => {
    e.preventDefault();
    if (!platilloSeleccionado) return;

    setGuardando(true);
    try {
      if (recetaEditando) {
        await inventarioApi.updateReceta(recetaEditando.id, {
          cantidadRequerida: parseFloat(formData.cantidadRequerida),
          unidadMedida: formData.unidadMedida,
          opcional: false,
          notas: formData.notas
        });
        mostrarAlerta('success', 'Ingrediente actualizado exitosamente.');
      } else {
        await inventarioApi.createReceta({
          platilloId: platilloSeleccionado.id,
          productoId: parseInt(formData.productoId),
          cantidadRequerida: parseFloat(formData.cantidadRequerida),
          unidadMedida: formData.unidadMedida,
          opcional: false,
          notas: formData.notas
        });
        mostrarAlerta('success', 'Ingrediente agregado a la receta exitosamente.');
      }

      setModalAbierto(false);
      // Recargar recetas
      const recetasData = await inventarioApi.getRecetas();
      setRecetas(recetasData || []);
    } catch (error) {
      console.error('Error al guardar ingrediente en receta:', error);
      mostrarAlerta('error', 'Error al guardar el ingrediente.');
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminarReceta = async (id) => {
    if (!window.confirm('¿Deseas remover este ingrediente de la receta?')) return;

    try {
      await inventarioApi.deleteReceta(id);
      mostrarAlerta('success', 'Ingrediente removido de la receta.');
      const recetasData = await inventarioApi.getRecetas();
      setRecetas(recetasData || []);
    } catch (error) {
      console.error('Error al eliminar ingrediente:', error);
      mostrarAlerta('error', 'No se pudo remover el ingrediente.');
    }
  };

  const handleRestablecerRecetas = async () => {
    if (!window.confirm('¿Deseas inicializar y verificar las recetas predeterminadas del restaurante?')) return;

    setCargando(true);
    try {
      await inventarioApi.inicializarRecetas();
      mostrarAlerta('success', 'Recetas predeterminadas verificadas e inicializadas.');
      await cargarDatos();
    } catch (error) {
      console.error('Error al inicializar recetas:', error);
      mostrarAlerta('error', 'Error al inicializar recetas predeterminadas.');
    } finally {
      setCargando(false);
    }
  };

  const formatearMoneda = (valor) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(valor || 0);
  };

  const platillosFiltrados = platillos.filter(p =>
    (p.nombre && p.nombre.toLowerCase().includes(busquedaPlatillo.toLowerCase())) ||
    (p.categoria && p.categoria.toLowerCase().includes(busquedaPlatillo.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Alerta flotante */}
      {alerta && (
        <div className={`p-4 rounded-xl flex items-center gap-3 transition-all ${
          alerta.tipo === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {alerta.tipo === 'success' ? <CheckCircle size={20} className="text-green-600" /> : <AlertCircle size={20} className="text-red-600" />}
          <span className="font-medium text-sm">{alerta.mensaje}</span>
        </div>
      )}

      {/* Cabecera y acciones */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <ChefHat className="text-blue-600" />
              Fichas Técnicas y Recetas
            </h2>
            <p className="text-gray-500 text-sm mt-1">
              Configura los insumos que se descuentan automáticamente del inventario cada vez que se pide un platillo.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRestablecerRecetas}
              disabled={cargando}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium text-sm flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <Sparkles size={16} className="text-amber-500" />
              Restablecer Predefinidas
            </button>
            <button
              onClick={cargarDatos}
              disabled={cargando}
              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors disabled:opacity-50"
              title="Refrescar"
            >
              <RefreshCw size={20} className={cargando ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* Layout de dos columnas: Platillos a la izquierda, Receta a la derecha */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Lista de Platillos (4 columnas) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Buscar platillo..."
                value={busquedaPlatillo}
                onChange={(e) => setBusquedaPlatillo(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="max-h-[600px] overflow-y-auto space-y-2 pr-1">
              {platillosFiltrados.map((platillo) => {
                const tieneReceta = recetas.some(r => r.platilloId === platillo.id);
                const esSeleccionado = platilloSeleccionado && platilloSeleccionado.id === platillo.id;

                return (
                  <button
                    key={platillo.id}
                    onClick={() => setPlatilloSeleccionado(platillo)}
                    className={`w-full text-left p-3 rounded-xl transition-all flex items-center justify-between border ${
                      esSeleccionado 
                        ? 'bg-blue-50/70 border-blue-300 shadow-sm' 
                        : 'bg-white hover:bg-gray-50 border-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {platillo.imagenUrl ? (
                        <img 
                          src={platillo.imagenUrl} 
                          alt={platillo.nombre} 
                          className="w-12 h-12 rounded-lg object-cover" 
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400">
                          <UtensilsCrossed size={20} />
                        </div>
                      )}
                      <div>
                        <h4 className="font-semibold text-gray-800 text-sm">{platillo.nombre}</h4>
                        <p className="text-xs text-gray-400">{platillo.categoria || 'Sin categoría'}</p>
                        <p className="text-xs font-medium text-blue-600 mt-0.5">{formatearMoneda(platillo.precio)}</p>
                      </div>
                    </div>
                    <div>
                      {tieneReceta ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700">
                          Configurado
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500">
                          Sin receta
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}

              {platillosFiltrados.length === 0 && (
                <div className="py-8 text-center text-gray-400 text-sm">
                  No se encontraron platillos.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Ficha Técnica / Receta del Platillo Seleccionado (8 columnas) */}
        <div className="lg:col-span-8">
          {platilloSeleccionado ? (
            <div className="space-y-6">
              {/* Resumen del Platillo */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    {platilloSeleccionado.imagenUrl ? (
                      <img 
                        src={platilloSeleccionado.imagenUrl} 
                        alt={platilloSeleccionado.nombre} 
                        className="w-16 h-16 rounded-xl object-cover shadow-sm" 
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                        <ChefHat size={32} />
                      </div>
                    )}
                    <div>
                      <span className="text-xs font-semibold px-2 py-0.5 bg-blue-50 text-blue-600 rounded-md">
                        {platilloSeleccionado.categoria || 'General'}
                      </span>
                      <h3 className="text-xl font-bold text-gray-900 mt-1">{platilloSeleccionado.nombre}</h3>
                      <p className="text-xs text-gray-500 line-clamp-1">{platilloSeleccionado.descripcion}</p>
                    </div>
                  </div>

                  <button
                    onClick={abrirModalNuevo}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm transition-colors self-start sm:self-auto"
                  >
                    <Plus size={18} />
                    Agregar Insumo
                  </button>
                </div>

                {/* Métricas de Costo y Margen */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-100">
                  <div className="bg-gray-50 p-3 rounded-xl">
                    <span className="text-xs text-gray-500 font-medium">Precio Venta</span>
                    <p className="text-lg font-bold text-gray-900 mt-0.5">
                      {formatearMoneda(platilloSeleccionado.precio)}
                    </p>
                  </div>
                  <div className="bg-blue-50/60 p-3 rounded-xl">
                    <span className="text-xs text-blue-700 font-medium">Costo Insumos</span>
                    <p className="text-lg font-bold text-blue-700 mt-0.5">
                      {formatearMoneda(costoTotalReceta)}
                    </p>
                  </div>
                  <div className="bg-emerald-50/60 p-3 rounded-xl">
                    <span className="text-xs text-emerald-700 font-medium">Margen Bruto</span>
                    <p className="text-lg font-bold text-emerald-700 mt-0.5">
                      {margenGanancia}%
                    </p>
                  </div>
                  <div className="bg-amber-50/60 p-3 rounded-xl">
                    <span className="text-xs text-amber-700 font-medium">Food Cost %</span>
                    <p className="text-lg font-bold text-amber-700 mt-0.5">
                      {foodCostPorcentaje}%
                    </p>
                  </div>
                </div>
              </div>

              {/* Tabla de Insumos de la Receta */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between">
                  <h4 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                    <Scale size={16} className="text-blue-600" />
                    Insumos requeridos por porción ({recetasDelPlatillo.length})
                  </h4>
                  <span className="text-xs text-gray-400">
                    Se descuentan automáticamente con cada pedido
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-600">
                    <thead className="bg-gray-50 text-gray-700 text-xs uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="px-6 py-3">Código</th>
                        <th className="px-6 py-3">Insumo / Producto</th>
                        <th className="px-6 py-3 text-center">Cant. Requerida</th>
                        <th className="px-6 py-3 text-right">Costo Unitario</th>
                        <th className="px-6 py-3 text-right">Subtotal</th>
                        <th className="px-6 py-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {recetasDelPlatillo.map((item) => {
                        const subtotal = item.cantidadRequerida * (item.costoUnitario || 0);

                        return (
                          <tr key={item.id} className="hover:bg-gray-50/60 transition-colors">
                            <td className="px-6 py-3 font-mono text-xs text-gray-500">
                              {item.productoCodigo || 'S/C'}
                            </td>
                            <td className="px-6 py-3">
                              <span className="font-semibold text-gray-900 block">{item.productoNombre}</span>
                              {item.notas && (
                                <span className="text-xs text-gray-400">{item.notas}</span>
                              )}
                            </td>
                            <td className="px-6 py-3 text-center font-bold text-gray-800">
                              {item.cantidadRequerida} <span className="text-xs font-normal text-gray-500">{item.unidadMedida}</span>
                            </td>
                            <td className="px-6 py-3 text-right text-gray-600">
                              {formatearMoneda(item.costoUnitario)}
                            </td>
                            <td className="px-6 py-3 text-right font-bold text-blue-600">
                              {formatearMoneda(subtotal)}
                            </td>
                            <td className="px-6 py-3 text-right">
                              <div className="flex justify-end items-center gap-2">
                                <button
                                  onClick={() => abrirModalEditar(item)}
                                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Editar"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button
                                  onClick={() => handleEliminarReceta(item.id)}
                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Remover"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                      {recetasDelPlatillo.length === 0 && (
                        <tr>
                          <td colSpan="6" className="px-6 py-12 text-center text-gray-400">
                            <Info size={32} className="mx-auto text-gray-300 mb-2" />
                            <p className="font-medium text-gray-600">Este platillo aún no tiene insumos configurados.</p>
                            <p className="text-xs text-gray-400 mt-1">
                              Haz clic en "Agregar Insumo" para registrar los ingredientes que se descontarán del stock con cada pedido.
                            </p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-12 text-center text-gray-400 border border-gray-100">
              <ChefHat size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="font-semibold text-gray-600">Selecciona un platillo para ver y editar su ficha técnica.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal para Agregar/Editar Insumo en Receta */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                <ChefHat size={20} className="text-blue-600" />
                {recetaEditando ? 'Editar Insumo de Receta' : 'Agregar Insumo a Receta'}
              </h3>
              <button 
                onClick={() => setModalAbierto(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleGuardarReceta} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  Producto de Inventario
                </label>
                {recetaEditando ? (
                  <input
                    type="text"
                    disabled
                    value={recetaEditando.productoNombre}
                    className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-xl text-sm font-medium text-gray-600"
                  />
                ) : (
                  <select
                    required
                    value={formData.productoId}
                    onChange={(e) => handleProductoChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {productos.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.codigo ? `[${p.codigo}] ` : ''}{p.nombre} ({p.unidadMedida}) - {formatearMoneda(p.precioCosto)}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    Cantidad Requerida
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    required
                    value={formData.cantidadRequerida}
                    onChange={(e) => setFormData({ ...formData, cantidadRequerida: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    Unidad de Medida
                  </label>
                  <select
                    value={formData.unidadMedida}
                    onChange={(e) => setFormData({ ...formData, unidadMedida: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {unidadesMedida.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  Notas o Especificación (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej: Rodajas finas, marinado, etc."
                  value={formData.notas}
                  onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors disabled:opacity-50"
                >
                  {guardando ? 'Guardando...' : (recetaEditando ? 'Actualizar Insumo' : 'Guardar Insumo')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default GestionRecetas;
