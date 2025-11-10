// src/components/inventario/DashboardInventario.js
import React, { useState, useEffect } from 'react';
import { 
  Package, 
  AlertTriangle, 
  TrendingUp, 
  DollarSign,
  Boxes,
  Calendar,
  BarChart3,
  PieChart as PieChartIcon
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import * as inventarioApi from '../../services/inventarioApi';

function DashboardInventario() {
  const [cargando, setCargando] = useState(true);
  const [stockGeneral, setStockGeneral] = useState([]);
  const [alertasStock, setAlertasStock] = useState([]);
  const [productosVencimiento, setProductosVencimiento] = useState([]);
  const [valorInventario, setValorInventario] = useState([]);
  const [estadisticas, setEstadisticas] = useState({
    totalProductos: 0,
    productosActivos: 0,
    productosStockBajo: 0,
    productosAgotados: 0,
    valorTotalInventario: 0
  });

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setCargando(true);
    try {
      const [stock, alertas, vencimiento, valor] = await Promise.all([
        inventarioApi.getStockGeneral().catch(() => []),
        inventarioApi.getAlertasStock().catch(() => []),
        inventarioApi.getProductosVencimiento().catch(() => []),
        inventarioApi.getValorInventarioPorAlmacen().catch(() => [])
      ]);

      console.log('📊 Datos del dashboard:', { stock, alertas, vencimiento, valor });

      setStockGeneral(stock);
      setAlertasStock(alertas);
      setProductosVencimiento(vencimiento);
      setValorInventario(valor);

      // Calcular estadísticas
      const stats = {
        totalProductos: stock.length,
        productosActivos: stock.filter(p => p.activo).length,
        productosStockBajo: stock.filter(p => p.estadoStock === 'Bajo' || p.estadoStock === 'Critico').length,
        productosAgotados: stock.filter(p => p.estadoStock === 'Agotado').length,
        valorTotalInventario: valor.reduce((sum, v) => sum + (v.valorTotal || 0), 0)
      };

      setEstadisticas(stats);
    } catch (error) {
      console.error('Error al cargar dashboard:', error);
    } finally {
      setCargando(false);
    }
  };

  const COLORES_ESTADO = {
    'Agotado': '#ef4444',
    'Critico': '#f59e0b',
    'Bajo': '#eab308',
    'Normal': '#22c55e',
    'Excedido': '#3b82f6'
  };

  const obtenerColorEstado = (estado) => {
    return COLORES_ESTADO[estado] || '#94a3b8';
  };

  // Datos para gráfica de distribución por estado
  const datosEstadoStock = Object.entries(
    stockGeneral.reduce((acc, item) => {
      acc[item.estadoStock] = (acc[item.estadoStock] || 0) + 1;
      return acc;
    }, {})
  ).map(([estado, cantidad]) => ({
    nombre: estado,
    valor: cantidad,
    color: obtenerColorEstado(estado)
  }));

  // Datos para gráfica de valor por almacén
  const datosValorAlmacen = valorInventario.map(v => ({
    nombre: v.almacen || 'Sin nombre',
    valor: v.valorTotal || 0
  }));

  if (cargando) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tarjetas de Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Productos */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium mb-1">Total Productos</p>
              <h3 className="text-3xl font-bold">{estadisticas.totalProductos}</h3>
            </div>
            <Package className="h-12 w-12 text-blue-200" />
          </div>
        </div>

        {/* Stock Bajo */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm font-medium mb-1">Stock Bajo</p>
              <h3 className="text-3xl font-bold">{estadisticas.productosStockBajo}</h3>
            </div>
            <AlertTriangle className="h-12 w-12 text-orange-200" />
          </div>
        </div>

        {/* Agotados */}
        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm font-medium mb-1">Agotados</p>
              <h3 className="text-3xl font-bold">{estadisticas.productosAgotados}</h3>
            </div>
            <Boxes className="h-12 w-12 text-red-200" />
          </div>
        </div>

        {/* Valor Total */}
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium mb-1">Valor Total</p>
              <h3 className="text-2xl font-bold">
                ${estadisticas.valorTotalInventario.toLocaleString('es-CO')}
              </h3>
            </div>
            <DollarSign className="h-12 w-12 text-green-200" />
          </div>
        </div>
      </div>

      {/* Gráficas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribución por Estado */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center space-x-2 mb-4">
            <PieChartIcon className="h-6 w-6 text-blue-500" />
            <h3 className="text-lg font-bold text-gray-900">Distribución por Estado</h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={datosEstadoStock}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ nombre, valor }) => `${nombre}: ${valor}`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="valor"
              >
                {datosEstadoStock.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Valor por Almacén */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center space-x-2 mb-4">
            <BarChart3 className="h-6 w-6 text-purple-500" />
            <h3 className="text-lg font-bold text-gray-900">Valor por Almacén</h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={datosValorAlmacen}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="nombre" />
              <YAxis />
              <Tooltip formatter={(value) => `$${value.toLocaleString('es-CO')}`} />
              <Bar dataKey="valor" fill="#8b5cf6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Alertas de Stock */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center space-x-2 mb-4">
          <AlertTriangle className="h-6 w-6 text-orange-500" />
          <h3 className="text-lg font-bold text-gray-900">Alertas de Stock</h3>
        </div>
        {alertasStock.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No hay alertas de stock</p>
        ) : (
          <div className="space-y-2">
            {alertasStock.slice(0, 5).map((alerta, index) => (
              <div
                key={index}
                className={`flex items-center justify-between p-4 rounded-lg border-l-4 ${
                  alerta.estadoStock === 'Critico' 
                    ? 'bg-red-50 border-red-500' 
                    : 'bg-yellow-50 border-yellow-500'
                }`}
              >
                <div>
                  <p className="font-semibold text-gray-900">{alerta.productoNombre}</p>
                  <p className="text-sm text-gray-600">
                    Stock actual: {alerta.stockTotal} {alerta.unidadMedida}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  alerta.estadoStock === 'Critico' 
                    ? 'bg-red-200 text-red-800' 
                    : 'bg-yellow-200 text-yellow-800'
                }`}>
                  {alerta.estadoStock}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Productos Próximos a Vencer */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Calendar className="h-6 w-6 text-red-500" />
          <h3 className="text-lg font-bold text-gray-900">Productos Próximos a Vencer</h3>
        </div>
        {productosVencimiento.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No hay productos próximos a vencer</p>
        ) : (
          <div className="space-y-2">
            {productosVencimiento.slice(0, 5).map((producto, index) => (
              <div
                key={index}
                className={`flex items-center justify-between p-4 rounded-lg border-l-4 ${
                  producto.nivelAlerta === 'Vencido' 
                    ? 'bg-red-50 border-red-500'
                    : producto.nivelAlerta === 'Critico'
                    ? 'bg-orange-50 border-orange-500'
                    : 'bg-yellow-50 border-yellow-500'
                }`}
              >
                <div>
                  <p className="font-semibold text-gray-900">{producto.productoNombre}</p>
                  <p className="text-sm text-gray-600">
                    Lote: {producto.numeroLote} - Almacén: {producto.almacen}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">
                    {producto.diasParaVencer === 0 
                      ? 'Vence hoy' 
                      : producto.diasParaVencer < 0
                      ? 'Vencido'
                      : `${producto.diasParaVencer} días`
                    }
                  </p>
                  <p className="text-xs text-gray-600">
                    {new Date(producto.fechaVencimiento).toLocaleDateString('es-CO')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default DashboardInventario;
