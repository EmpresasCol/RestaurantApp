// src/components/inventario/MovimientosInventario.js
import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Search, RefreshCw, Filter, Calendar, AlertCircle, CheckCircle } from 'lucide-react';
import * as inventarioApi from '../../services/inventarioApi';

function MovimientosInventario() {
  const [movimientos, setMovimientos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [modalAlerta, setModalAlerta] = useState(null);

  const tiposMovimiento = ['Entrada', 'Salida', 'Ajuste', 'Transferencia', 'Merma', 'Devolucion', 'ConsumoProduccion'];

  useEffect(() => {
    cargarMovimientos();
  }, []);

  const cargarMovimientos = async () => {
    setCargando(true);
    try {
      const data = await inventarioApi.getMovimientos();
      setMovimientos(data);
    } catch (error) {
      console.error('Error:', error);
      setModalAlerta({ tipo: 'error', titulo: 'Error', mensaje: 'No se pudieron cargar los movimientos' });
    } finally {
      setCargando(false);
    }
  };

  const movimientosFiltrados = movimientos.filter(mov => {
    const cumpleBusqueda = mov.productoNombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
                          mov.productoCodigo?.toLowerCase().includes(busqueda.toLowerCase());
    const cumpleTipo = filtroTipo === 'todos' || mov.tipoMovimiento === filtroTipo;
    return cumpleBusqueda && cumpleTipo;
  });

  const getIconoTipo = (tipo) => {
    const esEntrada = tipo === 'Entrada' || tipo === 'Devolucion';
    return esEntrada ? <TrendingUp className="h-5 w-5 text-green-500" /> : <TrendingDown className="h-5 w-5 text-red-500" />;
  };

  const getColorTipo = (tipo) => {
    switch (tipo) {
      case 'Entrada': return 'bg-green-100 text-green-800';
      case 'Salida': return 'bg-red-100 text-red-800';
      case 'Ajuste': return 'bg-blue-100 text-blue-800';
      case 'Transferencia': return 'bg-purple-100 text-purple-800';
      case 'Merma': return 'bg-orange-100 text-orange-800';
      case 'Devolucion': return 'bg-teal-100 text-teal-800';
      case 'ConsumoProduccion': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatearFecha = (fecha) => {
    return new Date(fecha).toLocaleString('es-CO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (cargando && movimientos.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando movimientos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
              <TrendingUp className="h-7 w-7 text-purple-500" />
              <span>Movimientos de Inventario</span>
            </h2>
            <p className="text-gray-600 mt-1">{movimientosFiltrados.length} movimiento{movimientosFiltrados.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={cargarMovimientos} disabled={cargando} className="flex items-center space-x-2 bg-purple-500 text-white px-6 py-3 rounded-lg hover:bg-purple-600 transition-colors shadow-md disabled:opacity-50">
            <RefreshCw className={`h-5 w-5 ${cargando ? 'animate-spin' : ''}`} />
            <span className="font-semibold">Actualizar</span>
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input type="text" placeholder="Buscar producto..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500">
              <option value="todos">Todos los tipos</option>
              {tiposMovimiento.map(tipo => (
                <option key={tipo} value={tipo}>{tipo}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Producto</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Almacén</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Motivo</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {movimientosFiltrados.map((mov) => (
                <tr key={mov.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4" />
                      <span>{formatearFecha(mov.fecha)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{mov.productoNombre}</div>
                      <div className="text-xs text-gray-500">{mov.productoCodigo}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {mov.almacenNombre}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      {getIconoTipo(mov.tipoMovimiento)}
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getColorTipo(mov.tipoMovimiento)}`}>
                        {mov.tipoMovimiento}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className="text-lg font-bold text-gray-900">{mov.cantidad}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {mov.motivo || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {movimientosFiltrados.length === 0 && (
          <div className="text-center py-12">
            <TrendingUp className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No se encontraron movimientos</p>
          </div>
        )}
      </div>

      {/* Modal Alerta */}
      {modalAlerta && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center space-x-3 mb-4">
              {modalAlerta.tipo === 'success' ? <CheckCircle className="h-8 w-8 text-green-500" /> : <AlertCircle className="h-8 w-8 text-red-500" />}
              <h3 className="text-xl font-bold">{modalAlerta.titulo}</h3>
            </div>
            <p className="text-gray-600 mb-6">{modalAlerta.mensaje}</p>
            <button onClick={() => setModalAlerta(null)} className="w-full bg-purple-500 text-white py-3 rounded-lg hover:bg-purple-600">Aceptar</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default MovimientosInventario;