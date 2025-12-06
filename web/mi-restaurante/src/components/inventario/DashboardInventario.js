import React, { useState, useEffect } from 'react';
import { DollarSign, AlertTriangle, Package, TrendingUp, AlertCircle, RefreshCw } from 'lucide-react';
import { getReporteStockGeneral, getAlertasStock, getReporteProductosVencimiento } from '../../services/inventarioApi';

function DashboardInventario() {
  const [stats, setStats] = useState({
    valorTotal: 0,
    productosBajoStock: 0,
    productosVencidos: 0,
    totalProductos: 0
  });
  const [alertas, setAlertas] = useState([]);
  const [vencimientos, setVencimientos] = useState([]);
  const [loading, setLoading] = useState(true);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [reporteStock, productosAlertas, productosVencimiento] = await Promise.all([
        getReporteStockGeneral(),
        getAlertasStock(),
        getReporteProductosVencimiento()
      ]);

      const valorTotal = reporteStock.reduce((sum, item) => sum + item.valorInventario, 0);
      const totalProductos = reporteStock.length;

      setStats({
        valorTotal,
        productosBajoStock: productosAlertas.length,
        productosVencidos: productosVencimiento.filter(p => p.nivelAlerta === 'Vencido').length,
        totalProductos
      });

      setAlertas(productosAlertas.slice(0, 5));
      setVencimientos(productosVencimiento.slice(0, 5));
    } catch (error) {
      console.error('Error al cargar dashboard de inventario:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const formatearMoneda = (valor) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(valor);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card: Valor Total */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm font-medium">Valor del Inventario</p>
              <h3 className="text-2xl font-bold text-gray-800 mt-1">{formatearMoneda(stats.valorTotal)}</h3>
            </div>
            <div className="bg-green-100 p-3 rounded-lg text-green-600">
              <DollarSign size={24} />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-green-600">
            <TrendingUp size={16} className="mr-1" />
            <span>Actualizado hoy</span>
          </div>
        </div>

        {/* Card: Productos Bajo Stock */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm font-medium">Alertas de Stock</p>
              <h3 className="text-2xl font-bold text-gray-800 mt-1">{stats.productosBajoStock}</h3>
            </div>
            <div className={`p-3 rounded-lg ${stats.productosBajoStock > 0 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
              <AlertTriangle size={24} />
            </div>
          </div>
          <p className="mt-4 text-sm text-gray-500">Productos con stock crítico o bajo</p>
        </div>

        {/* Card: Próximos a Vencer */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm font-medium">Vencimientos</p>
              <h3 className="text-2xl font-bold text-gray-800 mt-1">{stats.productosVencidos}</h3>
            </div>
            <div className="bg-orange-100 p-3 rounded-lg text-orange-600">
              <AlertCircle size={24} />
            </div>
          </div>
          <p className="mt-4 text-sm text-gray-500">Lotes vencidos o por vencer</p>
        </div>

        {/* Card: Total Productos */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm font-medium">Total Productos</p>
              <h3 className="text-2xl font-bold text-gray-800 mt-1">{stats.totalProductos}</h3>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg text-blue-600">
              <Package size={24} />
            </div>
          </div>
          <p className="mt-4 text-sm text-gray-500">Items registrados en el sistema</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tabla: Alertas de Stock */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-800">Alertas de Stock Bajo</h3>
            <button onClick={cargarDatos} className="text-gray-400 hover:text-blue-600">
              <RefreshCw size={18} />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-gray-700 font-medium">
                <tr>
                  <th className="px-6 py-3">Producto</th>
                  <th className="px-6 py-3">Actual</th>
                  <th className="px-6 py-3">Mínimo</th>
                  <th className="px-6 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {alertas.length > 0 ? (
                  alertas.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50/50">
                      <td className="px-6 py-3 font-medium text-gray-900">{item.productoNombre}</td>
                      <td className="px-6 py-3">{item.stockTotal} {item.unidadMedida}</td>
                      <td className="px-6 py-3">{item.stockMinimo} {item.unidadMedida}</td>
                      <td className="px-6 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${item.estadoStock === 'Agotado' ? 'bg-red-100 text-red-700' :
                            item.estadoStock === 'Critico' ? 'bg-red-50 text-red-600' :
                              'bg-yellow-100 text-yellow-700'
                          }`}>
                          {item.estadoStock}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="px-6 py-8 text-center text-gray-400">
                      No hay alertas de stock pendientes
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tabla: Próximos Vencimientos */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-800">Próximos Vencimientos</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-gray-700 font-medium">
                <tr>
                  <th className="px-6 py-3">Lote / Producto</th>
                  <th className="px-6 py-3">Fecha Venc.</th>
                  <th className="px-6 py-3">Días</th>
                  <th className="px-6 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {vencimientos.length > 0 ? (
                  vencimientos.map((item) => (
                    <tr key={item.loteId} className="hover:bg-gray-50/50">
                      <td className="px-6 py-3">
                        <div className="font-medium text-gray-900">{item.productoNombre}</div>
                        <div className="text-xs text-gray-400">Lote: {item.numeroLote}</div>
                      </td>
                      <td className="px-6 py-3">{new Date(item.fechaVencimiento).toLocaleDateString()}</td>
                      <td className="px-6 py-3">{item.diasParaVencer}</td>
                      <td className="px-6 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${item.nivelAlerta === 'Vencido' ? 'bg-gray-800 text-white' :
                            item.nivelAlerta === 'Critico' ? 'bg-red-100 text-red-700' :
                              'bg-orange-100 text-orange-700'
                          }`}>
                          {item.nivelAlerta}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="px-6 py-8 text-center text-gray-400">
                      No hay vencimientos próximos
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardInventario;
