// src/components/inventario/ControlStock.js
import React, { useState, useEffect } from 'react';
import { Boxes, Search, Plus, Minus, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import * as inventarioApi from '../../services/inventarioApi';

function ControlStock() {
  const [stock, setStock] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [modalAlerta, setModalAlerta] = useState(null);
  const [filtroAlmacen, setFiltroAlmacen] = useState('todos');
  const [almacenes, setAlmacenes] = useState([]);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setCargando(true);
    try {
      const [stockData, almacenesData] = await Promise.all([
        inventarioApi.getStock(),
        inventarioApi.getAlmacenes()
      ]);
      setStock(stockData);
      setAlmacenes(almacenesData);
    } catch (error) {
      console.error('Error:', error);
      setModalAlerta({ tipo: 'error', titulo: 'Error', mensaje: 'No se pudieron cargar los datos' });
    } finally {
      setCargando(false);
    }
  };

  const stockFiltrado = stock.filter(item => {
    const cumpleBusqueda = item.productoNombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
                          item.productoCodigo?.toLowerCase().includes(busqueda.toLowerCase());
    const cumpleAlmacen = filtroAlmacen === 'todos' || item.almacenId === parseInt(filtroAlmacen);
    return cumpleBusqueda && cumpleAlmacen;
  });

  const getEstadoStock = (item) => {
    if (item.cantidad === 0) return { texto: 'Agotado', color: 'bg-red-100 text-red-800' };
    if (item.cantidad <= item.stockMinimo) return { texto: 'Crítico', color: 'bg-orange-100 text-orange-800' };
    if (item.cantidad <= (item.puntoReorden || item.stockMinimo)) return { texto: 'Bajo', color: 'bg-yellow-100 text-yellow-800' };
    return { texto: 'Normal', color: 'bg-green-100 text-green-800' };
  };

  if (cargando && stock.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando stock...</p>
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
              <Boxes className="h-7 w-7 text-blue-500" />
              <span>Control de Stock</span>
            </h2>
            <p className="text-gray-600 mt-1">{stockFiltrado.length} registro{stockFiltrado.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={cargarDatos} disabled={cargando} className="flex items-center space-x-2 bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors shadow-md disabled:opacity-50">
            <RefreshCw className={`h-5 w-5 ${cargando ? 'animate-spin' : ''}`} />
            <span className="font-semibold">Actualizar</span>
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input type="text" placeholder="Buscar producto..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>
          <select value={filtroAlmacen} onChange={(e) => setFiltroAlmacen(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
            <option value="todos">Todos los almacenes</option>
            {almacenes.map(alm => (
              <option key={alm.id} value={alm.id}>{alm.nombre}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Producto</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Almacén</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Stock Actual</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Mínimo</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {stockFiltrado.map((item) => {
                const estado = getEstadoStock(item);
                return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{item.productoNombre}</div>
                        <div className="text-xs text-gray-500">{item.productoCodigo}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.almacenNombre}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="text-lg font-bold text-gray-900">{item.cantidad}</span>
                      <span className="text-xs text-gray-500 ml-1">{item.unidadMedida}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                      {item.stockMinimo}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${estado.color}`}>
                        {estado.texto}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium text-gray-900">
                      ${(item.costoTotal || 0).toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {stockFiltrado.length === 0 && (
          <div className="text-center py-12">
            <Boxes className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No se encontraron registros de stock</p>
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
            <button onClick={() => setModalAlerta(null)} className="w-full bg-blue-500 text-white py-3 rounded-lg hover:bg-blue-600">Aceptar</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ControlStock;