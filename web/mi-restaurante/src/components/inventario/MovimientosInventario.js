import React, { useState, useEffect } from 'react';
import { Search, ArrowUpCircle, ArrowDownCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { getMovimientos } from '../../services/inventarioApi';

function MovimientosInventario() {
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('');

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const data = await getMovimientos();
      setMovimientos(data);
    } catch (error) {
      console.error('Error al cargar movimientos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const movimientosFiltrados = movimientos.filter(m =>
    m.productoNombre.toLowerCase().includes(filtro.toLowerCase()) ||
    m.tipoMovimiento.toLowerCase().includes(filtro.toLowerCase())
  );

  const getIconoTipo = (tipo) => {
    switch (tipo) {
      case 'Entrada': return <ArrowUpCircle className="text-green-500" size={20} />;
      case 'Salida': return <ArrowDownCircle className="text-blue-500" size={20} />;
      case 'Ajuste': return <RefreshCw className="text-orange-500" size={20} />;
      case 'Merma': return <AlertCircle className="text-red-500" size={20} />;
      default: return <RefreshCw className="text-gray-500" size={20} />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Buscar..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <button
          onClick={cargarDatos}
          className="text-blue-600 hover:text-blue-800 font-medium text-sm flex items-center gap-2"
        >
          <RefreshCw size={16} /> Actualizar
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-gray-50 text-gray-700 font-medium">
            <tr>
              <th className="px-6 py-3">Fecha</th>
              <th className="px-6 py-3">Tipo</th>
              <th className="px-6 py-3">Producto</th>
              <th className="px-6 py-3">Almacén</th>
              <th className="px-6 py-3 text-right">Cantidad</th>
              <th className="px-6 py-3 text-right">Costo Total</th>
              <th className="px-6 py-3">Motivo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {movimientosFiltrados.map((mov) => (
              <tr key={mov.id} className="hover:bg-gray-50/50">
                <td className="px-6 py-3 text-gray-500">
                  {new Date(mov.fecha).toLocaleString()}
                </td>
                <td className="px-6 py-3 flex items-center gap-2 font-medium">
                  {getIconoTipo(mov.tipoMovimiento)}
                  {mov.tipoMovimiento}
                </td>
                <td className="px-6 py-3 font-medium text-gray-900">{mov.productoNombre}</td>
                <td className="px-6 py-3">{mov.almacenNombre}</td>
                <td className={`px-6 py-3 text-right font-bold ${mov.tipoMovimiento === 'Entrada' ? 'text-green-600' :
                    mov.tipoMovimiento === 'Salida' ? 'text-blue-600' : 'text-gray-700'
                  }`}>
                  {mov.tipoMovimiento === 'Salida' || mov.tipoMovimiento === 'Merma' ? '-' : '+'}
                  {mov.cantidad}
                </td>
                <td className="px-6 py-3 text-right">${mov.costoTotal?.toLocaleString()}</td>
                <td className="px-6 py-3 text-xs text-gray-500 max-w-xs truncate" title={mov.motivo}>
                  {mov.motivo}
                </td>
              </tr>
            ))}
            {movimientosFiltrados.length === 0 && (
              <tr>
                <td colSpan="7" className="px-6 py-8 text-center text-gray-400">
                  No se encontraron movimientos
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default MovimientosInventario;