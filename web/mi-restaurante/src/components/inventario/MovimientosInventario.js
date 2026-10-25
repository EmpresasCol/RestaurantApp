import React, { useState, useEffect } from 'react';
import { 
  Search, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  AlertCircle, 
  RefreshCw, 
  Plus, 
  X, 
  CheckCircle,
  FileText,
  Filter
} from 'lucide-react';
import * as inventarioApi from '../../services/inventarioApi';

function MovimientosInventario() {
  const [movimientos, setMovimientos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [almacenes, setAlmacenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [filtro, setFiltro] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [alerta, setAlerta] = useState(null);

  const [formData, setFormData] = useState({
    productoId: '',
    almacenId: '',
    tipoMovimiento: 'Entrada',
    cantidad: 1,
    costoUnitario: 0,
    motivo: '',
    referencia: ''
  });

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [movData, prodData, almData] = await Promise.all([
        inventarioApi.getMovimientos(),
        inventarioApi.getProductos(),
        inventarioApi.getAlmacenes()
      ]);
      setMovimientos(movData || []);
      setProductos(prodData || []);
      setAlmacenes(almData || []);

      if (prodData && prodData.length > 0 && !formData.productoId) {
        setFormData(prev => ({
          ...prev,
          productoId: prodData[0].id,
          costoUnitario: prodData[0].precioCosto || 0
        }));
      }
      if (almData && almData.length > 0 && !formData.almacenId) {
        setFormData(prev => ({ ...prev, almacenId: almData[0].id }));
      }
    } catch (error) {
      console.error('Error al cargar movimientos:', error);
      mostrarAlerta('error', 'Error al cargar los movimientos del inventario.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const mostrarAlerta = (tipo, mensaje) => {
    setAlerta({ tipo, mensaje });
    setTimeout(() => setAlerta(null), 4000);
  };

  const handleProductoChange = (id) => {
    const prod = productos.find(p => p.id === parseInt(id));
    setFormData(prev => ({
      ...prev,
      productoId: id,
      costoUnitario: prod ? prod.precioCosto : prev.costoUnitario
    }));
  };

  const abrirModalNuevo = () => {
    setFormData({
      productoId: productos.length > 0 ? productos[0].id : '',
      almacenId: almacenes.length > 0 ? almacenes[0].id : '',
      tipoMovimiento: 'Entrada',
      cantidad: 1,
      costoUnitario: productos.length > 0 ? (productos[0].precioCosto || 0) : 0,
      motivo: 'Compra / Reabastecimiento de insumos',
      referencia: `Manual-${new Date().toISOString().slice(0, 10)}`
    });
    setModalAbierto(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      const payload = {
        productoId: parseInt(formData.productoId),
        almacenId: parseInt(formData.almacenId),
        tipoMovimiento: formData.tipoMovimiento,
        cantidad: parseFloat(formData.cantidad),
        costoUnitario: parseFloat(formData.costoUnitario),
        motivo: formData.motivo,
        referencia: formData.referencia || 'Registro Manual'
      };

      await inventarioApi.createMovimiento(payload);
      mostrarAlerta('success', `Movimiento de ${formData.tipoMovimiento} registrado exitosamente.`);
      setModalAbierto(false);
      await cargarDatos();
    } catch (error) {
      console.error('Error al registrar movimiento:', error);
      const msg = error.response?.data?.message || error.response?.data || 'Error al registrar el movimiento.';
      mostrarAlerta('error', typeof msg === 'string' ? msg : 'Error al registrar movimiento.');
    } finally {
      setGuardando(false);
    }
  };

  const movimientosFiltrados = movimientos.filter(m => {
    const cumpleTexto = (m.productoNombre && m.productoNombre.toLowerCase().includes(filtro.toLowerCase())) ||
                        (m.tipoMovimiento && m.tipoMovimiento.toLowerCase().includes(filtro.toLowerCase())) ||
                        (m.motivo && m.motivo.toLowerCase().includes(filtro.toLowerCase())) ||
                        (m.referencia && m.referencia.toLowerCase().includes(filtro.toLowerCase()));
    const cumpleTipo = filtroTipo === 'todos' || m.tipoMovimiento === filtroTipo;
    return cumpleTexto && cumpleTipo;
  });

  const getIconoTipo = (tipo) => {
    switch (tipo) {
      case 'Entrada': return <ArrowUpCircle className="text-green-500" size={18} />;
      case 'Salida': return <ArrowDownCircle className="text-blue-500" size={18} />;
      case 'Ajuste': return <RefreshCw className="text-orange-500" size={18} />;
      case 'Merma': return <AlertCircle className="text-red-500" size={18} />;
      default: return <RefreshCw className="text-gray-500" size={18} />;
    }
  };

  const formatearMoneda = (valor) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(valor || 0);
  };

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

      {/* Barra de control superior */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 flex-1">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por producto, motivo o ref..."
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 bg-white"
          >
            <option value="todos">Todos los tipos</option>
            <option value="Entrada">Entradas (Reabastecimiento)</option>
            <option value="Salida">Salidas (Consumo / Pedidos)</option>
            <option value="Ajuste">Ajustes</option>
            <option value="Merma">Mermas / Desperdicio</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={abrirModalNuevo}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm transition-colors"
          >
            <Plus size={18} />
            Registrar Movimiento
          </button>
          <button
            onClick={cargarDatos}
            disabled={loading}
            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors disabled:opacity-50"
            title="Refrescar"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Tabla de Movimientos */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-700 font-semibold text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3">Fecha y Hora</th>
                <th className="px-6 py-3">Tipo</th>
                <th className="px-6 py-3">Producto</th>
                <th className="px-6 py-3">Almacén</th>
                <th className="px-6 py-3 text-right">Cantidad</th>
                <th className="px-6 py-3 text-right">Costo Total</th>
                <th className="px-6 py-3">Motivo / Pedido</th>
                <th className="px-6 py-3">Referencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {movimientosFiltrados.map((mov) => (
                <tr key={mov.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-6 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {new Date(mov.fecha).toLocaleString('es-CO')}
                  </td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                      mov.tipoMovimiento === 'Entrada' ? 'bg-green-100 text-green-700' :
                      mov.tipoMovimiento === 'Salida' ? 'bg-blue-100 text-blue-700' :
                      mov.tipoMovimiento === 'Merma' ? 'bg-red-100 text-red-700' :
                      'bg-orange-100 text-orange-700'
                    }`}>
                      {getIconoTipo(mov.tipoMovimiento)}
                      {mov.tipoMovimiento}
                    </span>
                  </td>
                  <td className="px-6 py-3 font-semibold text-gray-900">{mov.productoNombre}</td>
                  <td className="px-6 py-3 text-gray-500">{mov.almacenNombre}</td>
                  <td className={`px-6 py-3 text-right font-bold text-sm ${
                    mov.tipoMovimiento === 'Entrada' ? 'text-green-600' :
                    mov.tipoMovimiento === 'Salida' || mov.tipoMovimiento === 'Merma' ? 'text-blue-600' : 
                    'text-gray-700'
                  }`}>
                    {mov.tipoMovimiento === 'Salida' || mov.tipoMovimiento === 'Merma' ? '-' : '+'}
                    {mov.cantidad}
                  </td>
                  <td className="px-6 py-3 text-right font-medium text-gray-800">
                    {formatearMoneda(mov.costoTotal)}
                  </td>
                  <td className="px-6 py-3 text-xs text-gray-600 max-w-xs truncate" title={mov.motivo}>
                    {mov.motivo}
                  </td>
                  <td className="px-6 py-3 font-mono text-xs text-gray-400">
                    {mov.referencia || '-'}
                  </td>
                </tr>
              ))}
              {movimientosFiltrados.length === 0 && (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-gray-400">
                    No se encontraron movimientos registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Registrar Movimiento */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                <FileText size={20} className="text-blue-600" />
                Registrar Movimiento de Inventario
              </h3>
              <button 
                onClick={() => setModalAbierto(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    Tipo de Movimiento
                  </label>
                  <select
                    value={formData.tipoMovimiento}
                    onChange={(e) => setFormData({ ...formData, tipoMovimiento: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  >
                    <option value="Entrada">Entrada (Compra / Abastecimiento)</option>
                    <option value="Salida">Salida (Consumo Manual)</option>
                    <option value="Ajuste">Ajuste de Conteo Físico</option>
                    <option value="Merma">Merma (Dañado / Vencido)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    Almacén Destino
                  </label>
                  <select
                    required
                    value={formData.almacenId}
                    onChange={(e) => setFormData({ ...formData, almacenId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {almacenes.map(a => (
                      <option key={a.id} value={a.id}>{a.nombre} ({a.tipo})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  Producto Insumo
                </label>
                <select
                  required
                  value={formData.productoId}
                  onChange={(e) => handleProductoChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {productos.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.codigo ? `[${p.codigo}] ` : ''}{p.nombre} ({p.unidadMedida})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    Cantidad
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={formData.cantidad}
                    onChange={(e) => setFormData({ ...formData, cantidad: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    Costo Unitario ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formData.costoUnitario}
                    onChange={(e) => setFormData({ ...formData, costoUnitario: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  Motivo de la Operación
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Factura Proveedor #4512, Conteo mensual..."
                  value={formData.motivo}
                  onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  Referencia / Folio
                </label>
                <input
                  type="text"
                  placeholder="Ej: FAC-98231 o REQ-001"
                  value={formData.referencia}
                  onChange={(e) => setFormData({ ...formData, referencia: e.target.value })}
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
                  {guardando ? 'Guardando...' : 'Registrar Movimiento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default MovimientosInventario;