import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  Calendar,
  Download,
  ChevronDown,
  ChevronUp,
  Users,
  ShoppingBag,
  Target,
  Award,
  Clock,
  Percent,
  RefreshCw,
  UserCheck,
  Trophy
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
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
  Area,
  AreaChart
} from 'recharts';
import * as api from './services/api';

function ReportesFinancieros() {
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState('mes');
  const [datosVentas, setDatosVentas] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [seccionExpandida, setSeccionExpandida] = useState('ventas');
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, [periodoSeleccionado]);

  const cargarDatos = async () => {
    setCargando(true);
    try {
      const [pedidosData, pagosData] = await Promise.all([
        api.getPedidos(),
        api.getPagos()
      ]);

      console.log('📊 Datos cargados:', { 
        pedidos: pedidosData.length, 
        pagos: pagosData.length
      });

      setPedidos(pedidosData);
      setPagos(pagosData);
      
      procesarDatosVentas(pedidosData, pagosData);
    } catch (error) {
      console.error('Error al cargar datos:', error);
    } finally {
      setCargando(false);
    }
  };

  const filtrarPorPeriodo = (fecha) => {
    const hoy = new Date();
    const fechaPedido = new Date(fecha);
    
    switch (periodoSeleccionado) {
      case 'hoy':
        return fechaPedido.toDateString() === hoy.toDateString();
      
      case 'ayer':
        const ayer = new Date(hoy);
        ayer.setDate(ayer.getDate() - 1);
        return fechaPedido.toDateString() === ayer.toDateString();
      
      case 'semana':
        const inicioDeSemana = new Date(hoy);
        inicioDeSemana.setDate(hoy.getDate() - hoy.getDay());
        return fechaPedido >= inicioDeSemana;
      
      case 'mes':
        return fechaPedido.getMonth() === hoy.getMonth() && 
               fechaPedido.getFullYear() === hoy.getFullYear();
      
      case 'trimestre':
        const inicioTrimestre = new Date(hoy);
        inicioTrimestre.setMonth(Math.floor(hoy.getMonth() / 3) * 3, 1);
        return fechaPedido >= inicioTrimestre;
      
      case 'año':
        return fechaPedido.getFullYear() === hoy.getFullYear();
      
      default:
        return true;
    }
  };

  const procesarDatosVentas = (pedidosData, pagosData) => {
    const pedidosPagados = pedidosData.filter(p => 
      p.estado === 'Pagado' && filtrarPorPeriodo(p.fecha)
    );

    const ventasPorFecha = {};
    
    pedidosPagados.forEach(pedido => {
      const fecha = new Date(pedido.fecha).toISOString().split('T')[0];
      
      if (!ventasPorFecha[fecha]) {
        ventasPorFecha[fecha] = {
          fecha,
          ventas: 0,
          ordenes: 0,
          propinas: 0
        };
      }
      
      const totalPedido = pedido.detalles.reduce((sum, d) => sum + (d.precio * d.cantidad), 0);
      ventasPorFecha[fecha].ventas += totalPedido;
      ventasPorFecha[fecha].ordenes += 1;
      
      const pago = pagosData.find(p => p.pedidoId === pedido.id);
      if (pago && pago.montoPropina) {
        ventasPorFecha[fecha].propinas += pago.montoPropina;
      }
    });

    const datosOrdenados = Object.values(ventasPorFecha).sort((a, b) => 
      new Date(a.fecha) - new Date(b.fecha)
    );

    setDatosVentas(datosOrdenados);
  };

  const calcularEstadisticasMeseros = () => {
    const pedidosPagados = pedidos.filter(p => 
      p.estado === 'Pagado' && filtrarPorPeriodo(p.fecha)
    );

    // Lista de nombres/roles a excluir de las estadísticas de meseros
    const rolesExcluidos = ['admin', 'administrador', 'caja', 'sistema', 'sin asignar'];
    
    const estadisticasPorMesero = {};

    pedidosPagados.forEach(pedido => {
      const meseroKey = pedido.usuarioId || 0;
      const meseroNombre = pedido.meseroNombre || 'Sin asignar';
      
      // ⛔ EXCLUIR pedidos de Admin, Caja o Sin asignar
      const nombreLower = meseroNombre.toLowerCase();
      const esRolExcluido = rolesExcluidos.some(rol => nombreLower.includes(rol));
      
      if (esRolExcluido) {
        return; // Saltar este pedido
      }
      
      if (!estadisticasPorMesero[meseroKey]) {
        estadisticasPorMesero[meseroKey] = {
          usuarioId: meseroKey,
          nombre: meseroNombre,
          pedidosAtendidos: 0,
          ventasTotales: 0,
          propinas: 0,
          mesasAtendidas: new Set()
        };
      }
      
      const totalPedido = pedido.detalles.reduce((sum, d) => sum + (d.precio * d.cantidad), 0);
      estadisticasPorMesero[meseroKey].pedidosAtendidos += 1;
      estadisticasPorMesero[meseroKey].ventasTotales += totalPedido;
      estadisticasPorMesero[meseroKey].mesasAtendidas.add(pedido.mesaNumero);
      
      const pago = pagos.find(p => p.pedidoId === pedido.id);
      if (pago && pago.montoPropina) {
        estadisticasPorMesero[meseroKey].propinas += pago.montoPropina;
      }
    });

    const meserosOrdenados = Object.values(estadisticasPorMesero)
      .map(m => ({
        ...m,
        mesasAtendidas: m.mesasAtendidas.size,
        ticketPromedio: m.pedidosAtendidos > 0 ? m.ventasTotales / m.pedidosAtendidos : 0,
        propinaPromedio: m.pedidosAtendidos > 0 ? m.propinas / m.pedidosAtendidos : 0
      }))
      .sort((a, b) => b.ventasTotales - a.ventasTotales);

    return meserosOrdenados;
  };

  const calcularPlatillosMasVendidos = () => {
    const pedidosPagados = pedidos.filter(p => 
      p.estado === 'Pagado' && filtrarPorPeriodo(p.fecha)
    );

    const ventasPorPlatillo = {};

    pedidosPagados.forEach(pedido => {
      pedido.detalles.forEach(detalle => {
        const key = detalle.platilloNombre;
        
        if (!ventasPorPlatillo[key]) {
          ventasPorPlatillo[key] = {
            nombre: detalle.platilloNombre,
            cantidad: 0,
            ingresos: 0
          };
        }
        
        ventasPorPlatillo[key].cantidad += detalle.cantidad;
        ventasPorPlatillo[key].ingresos += detalle.precio * detalle.cantidad;
      });
    });

    const platillosOrdenados = Object.values(ventasPorPlatillo)
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 6);

    const totalVentas = platillosOrdenados.reduce((sum, p) => sum + p.ingresos, 0);
    return platillosOrdenados.map(p => ({
      ...p,
      porcentaje: totalVentas > 0 ? Math.round((p.ingresos / totalVentas) * 100) : 0
    }));
  };

  const calcularVentasPorMetodoPago = () => {
    const pagosFiltrados = pagos.filter(pago => {
      const pedido = pedidos.find(p => p.id === pago.pedidoId);
      return pedido && filtrarPorPeriodo(pedido.fecha);
    });

    const ventasPorMetodo = {
      'Efectivo': 0,
      'Tarjeta': 0,
      'QR': 0
    };

    pagosFiltrados.forEach(pago => {
      const metodo = pago.metodoPago || 'Efectivo';
      if (ventasPorMetodo.hasOwnProperty(metodo)) {
        ventasPorMetodo[metodo] += pago.monto;
      } else {
        ventasPorMetodo['QR'] += pago.monto;
      }
    });

    const total = Object.values(ventasPorMetodo).reduce((sum, v) => sum + v, 0);

    return [
      { 
        metodo: 'Efectivo', 
        valor: ventasPorMetodo.Efectivo, 
        porcentaje: total > 0 ? Math.round((ventasPorMetodo.Efectivo / total) * 100) : 0,
        color: '#10b981' 
      },
      { 
        metodo: 'Tarjeta', 
        valor: ventasPorMetodo.Tarjeta, 
        porcentaje: total > 0 ? Math.round((ventasPorMetodo.Tarjeta / total) * 100) : 0,
        color: '#3b82f6' 
      },
      { 
        metodo: 'QR/Transfer', 
        valor: ventasPorMetodo.QR, 
        porcentaje: total > 0 ? Math.round((ventasPorMetodo.QR / total) * 100) : 0,
        color: '#8b5cf6' 
      }
    ];
  };

  const calcularVentasPorHora = () => {
    const pedidosPagados = pedidos.filter(p => 
      p.estado === 'Pagado' && filtrarPorPeriodo(p.fecha)
    );

    const ventasPorHora = {};
    
    for (let i = 8; i <= 22; i++) {
      const hora = `${i.toString().padStart(2, '0')}:00`;
      ventasPorHora[hora] = 0;
    }

    pedidosPagados.forEach(pedido => {
      const fecha = new Date(pedido.fecha);
      const hora = `${fecha.getHours().toString().padStart(2, '0')}:00`;
      
      if (ventasPorHora.hasOwnProperty(hora)) {
        const totalPedido = pedido.detalles.reduce((sum, d) => sum + (d.precio * d.cantidad), 0);
        ventasPorHora[hora] += totalPedido;
      }
    });

    return Object.entries(ventasPorHora).map(([hora, ventas]) => ({
      hora,
      ventas
    }));
  };

  const formatearPrecio = (precio) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(precio);
  };

  const calcularMetricas = () => {
    const pedidosPagados = pedidos.filter(p => 
      p.estado === 'Pagado' && filtrarPorPeriodo(p.fecha)
    );

    const totalVentas = pedidosPagados.reduce((sum, pedido) => {
      return sum + pedido.detalles.reduce((s, d) => s + (d.precio * d.cantidad), 0);
    }, 0);

    const totalOrdenes = pedidosPagados.length;

    const pagosFiltrados = pagos.filter(pago => {
      const pedido = pedidos.find(p => p.id === pago.pedidoId);
      return pedido && filtrarPorPeriodo(pedido.fecha);
    });

    const totalPropinas = pagosFiltrados.reduce((sum, p) => sum + (p.montoPropina || 0), 0);

    const mesasUnicas = new Set(pedidosPagados.map(p => p.mesaNumero));
    const totalClientes = mesasUnicas.size;

    const promedioVenta = datosVentas.length > 0 ? totalVentas / datosVentas.length : 0;
    const ticketPromedio = totalOrdenes > 0 ? totalVentas / totalOrdenes : 0;

    const mitad = Math.floor(datosVentas.length / 2);
    const ventasPeriodoActual = datosVentas.slice(mitad).reduce((sum, d) => sum + d.ventas, 0);
    const ventasPeriodoAnterior = datosVentas.slice(0, mitad).reduce((sum, d) => sum + d.ventas, 0);
    const crecimiento = ventasPeriodoAnterior > 0 
      ? ((ventasPeriodoActual - ventasPeriodoAnterior) / ventasPeriodoAnterior) * 100 
      : 0;

    return {
      totalVentas,
      totalOrdenes,
      totalPropinas,
      totalClientes,
      promedioVenta,
      ticketPromedio,
      crecimiento
    };
  };

  const metricas = calcularMetricas();
  const platillosMasVendidos = calcularPlatillosMasVendidos();
  const ventasPorMetodoPago = calcularVentasPorMetodoPago();
  const ventasPorHora = calcularVentasPorHora();
  const estadisticasMeseros = calcularEstadisticasMeseros();

  const exportarExcel = () => {
    const csvData = [
      ['Reporte Financiero - Restaurante Délice'],
      ['Período:', periodoSeleccionado],
      ['Fecha de generación:', new Date().toLocaleString('es-CO')],
      [''],
      ['Métricas Generales'],
      ['Total Ventas', metricas.totalVentas],
      ['Total Órdenes', metricas.totalOrdenes],
      ['Total Propinas', metricas.totalPropinas],
      ['Clientes Atendidos', metricas.totalClientes],
      ['Ticket Promedio', metricas.ticketPromedio.toFixed(0)],
      ['Crecimiento', `${metricas.crecimiento.toFixed(1)}%`],
      [''],
      ['Ventas Diarias'],
      ['Fecha', 'Ventas', 'Órdenes', 'Propinas'],
      ...datosVentas.map(d => [d.fecha, d.ventas, d.ordenes, d.propinas]),
      [''],
      ['Platillos Más Vendidos'],
      ['Platillo', 'Cantidad', 'Ingresos'],
      ...platillosMasVendidos.map(p => [p.nombre, p.cantidad, p.ingresos]),
      [''],
      ['Estadísticas por Mesero'],
      ['Mesero', 'Pedidos', 'Ventas Totales', 'Ticket Promedio', 'Propinas', 'Mesas'],
      ...estadisticasMeseros.map(m => [
        m.nombre, 
        m.pedidosAtendidos, 
        m.ventasTotales, 
        m.ticketPromedio.toFixed(0),
        m.propinas,
        m.mesasAtendidas
      ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob(['\uFEFF' + csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-financiero-${periodoSeleccionado}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSeccion = (seccion) => {
    setSeccionExpandida(seccionExpandida === seccion ? null : seccion);
  };

  const horaPico = ventasPorHora.reduce((max, v) => v.ventas > max.ventas ? v : max, { hora: '-', ventas: 0 });
  const horaBaja = ventasPorHora.reduce((min, v) => v.ventas < min.ventas && v.ventas > 0 ? v : min, { hora: '-', ventas: Infinity });
  const promedioHora = ventasPorHora.reduce((sum, v) => sum + v.ventas, 0) / ventasPorHora.length;

  const COLORES_MESEROS = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-white shadow-lg border-b-4 border-orange-500">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
                <TrendingUp className="text-white" size={28} />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Reportes Financieros</h1>
                <p className="text-gray-600">Análisis detallado del rendimiento del restaurante</p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={cargarDatos}
                disabled={cargando}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <RefreshCw size={20} className={cargando ? 'animate-spin' : ''} />
                {cargando ? 'Cargando...' : 'Actualizar'}
              </button>

              <select
                value={periodoSeleccionado}
                onChange={(e) => setPeriodoSeleccionado(e.target.value)}
                className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-medium"
              >
                <option value="hoy">Hoy</option>
                <option value="ayer">Ayer</option>
                <option value="semana">Esta Semana</option>
                <option value="mes">Este Mes</option>
                <option value="trimestre">Este Trimestre</option>
                <option value="año">Este Año</option>
              </select>
              
              <button
                onClick={exportarExcel}
                disabled={datosVentas.length === 0}
                className="flex items-center gap-2 bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium shadow-lg disabled:opacity-50"
              >
                <Download size={20} />
                Exportar
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {cargando ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Cargando datos...</p>
            </div>
          </div>
        ) : datosVentas.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
            <TrendingUp className="mx-auto text-gray-400 mb-4" size={64} />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">No hay datos para este período</h3>
            <p className="text-gray-500">Intenta seleccionar un período diferente</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-xl p-6 text-white transform hover:scale-105 transition-transform">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <DollarSign size={24} />
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                    metricas.crecimiento >= 0 ? 'bg-green-700' : 'bg-red-700'
                  }`}>
                    {metricas.crecimiento >= 0 ? '↑' : '↓'} {Math.abs(metricas.crecimiento).toFixed(1)}%
                  </div>
                </div>
                <p className="text-green-100 text-sm mb-1">Ventas Totales</p>
                <p className="text-3xl font-bold">{formatearPrecio(metricas.totalVentas)}</p>
              </div>

              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-xl p-6 text-white transform hover:scale-105 transition-transform">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <ShoppingBag size={24} />
                  </div>
                  <Target size={20} className="text-blue-200" />
                </div>
                <p className="text-blue-100 text-sm mb-1">Total de Órdenes</p>
                <p className="text-3xl font-bold">{metricas.totalOrdenes}</p>
              </div>

              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-xl p-6 text-white transform hover:scale-105 transition-transform">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <Users size={24} />
                  </div>
                  <Award size={20} className="text-purple-200" />
                </div>
                <p className="text-purple-100 text-sm mb-1">Mesas Atendidas</p>
                <p className="text-3xl font-bold">{metricas.totalClientes}</p>
              </div>

              <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl shadow-xl p-6 text-white transform hover:scale-105 transition-transform">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <Percent size={24} />
                  </div>
                  <Clock size={20} className="text-orange-200" />
                </div>
                <p className="text-orange-100 text-sm mb-1">Ticket Promedio</p>
                <p className="text-3xl font-bold">{formatearPrecio(metricas.ticketPromedio)}</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Tendencia de Ventas</h2>
                  <p className="text-gray-600 text-sm">Evolución de las ventas en el período seleccionado</p>
                </div>
                <button
                  onClick={() => toggleSeccion('ventas')}
                  className="text-gray-500 hover:text-gray-700"
                >
                  {seccionExpandida === 'ventas' ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                </button>
              </div>
              
              {seccionExpandida === 'ventas' && (
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={datosVentas}>
                    <defs>
                      <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="fecha" 
                      stroke="#6b7280"
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis 
                      stroke="#6b7280"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#fff', 
                        border: '2px solid #f97316',
                        borderRadius: '12px',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                      }}
                      formatter={(value) => [formatearPrecio(value), 'Ventas']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="ventas" 
                      stroke="#f97316" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorVentas)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* NUEVA SECCIÓN: ESTADÍSTICAS POR MESERO */}
            <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Rendimiento por Mesero</h2>
                  <p className="text-gray-600 text-sm">Ranking de meseros por ventas atendidas</p>
                </div>
                <UserCheck className="text-orange-500" size={28} />
              </div>
              
              {estadisticasMeseros.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={estadisticasMeseros.slice(0, 6)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="nombre" 
                        stroke="#6b7280"
                        tick={{ fontSize: 11 }}
                        angle={-45}
                        textAnchor="end"
                        height={100}
                      />
                      <YAxis 
                        stroke="#6b7280" 
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#fff', 
                          border: '2px solid #f97316',
                          borderRadius: '12px'
                        }}
                        formatter={(value) => [formatearPrecio(value), 'Ventas']}
                      />
                      <Bar dataKey="ventasTotales" radius={[8, 8, 0, 0]}>
                        {estadisticasMeseros.slice(0, 6).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORES_MESEROS[index % COLORES_MESEROS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>

                  <div className="mt-6 overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b-2 border-gray-200">
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Posición</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Mesero</th>
                          <th className="text-center py-3 px-4 font-semibold text-gray-700">Pedidos</th>
                          <th className="text-right py-3 px-4 font-semibold text-gray-700">Ventas</th>
                          <th className="text-right py-3 px-4 font-semibold text-gray-700">Ticket Prom.</th>
                          <th className="text-right py-3 px-4 font-semibold text-gray-700">Propinas</th>
                          <th className="text-center py-3 px-4 font-semibold text-gray-700">Mesas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {estadisticasMeseros.map((mesero, index) => (
                          <tr 
                            key={mesero.usuarioId} 
                            className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                          >
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                {index < 3 ? (
                                  <Trophy 
                                    size={20} 
                                    className={
                                      index === 0 ? 'text-yellow-500' : 
                                      index === 1 ? 'text-gray-400' : 
                                      'text-orange-600'
                                    }
                                  />
                                ) : (
                                  <span className="w-5 text-center font-semibold text-gray-500">
                                    {index + 1}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div 
                                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                                  style={{ backgroundColor: COLORES_MESEROS[index % COLORES_MESEROS.length] }}
                                >
                                  {mesero.nombre.charAt(0).toUpperCase()}
                                </div>
                                <span className="font-medium text-gray-900">{mesero.nombre}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-semibold">
                                {mesero.pedidosAtendidos}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-green-600">
                              {formatearPrecio(mesero.ventasTotales)}
                            </td>
                            <td className="py-3 px-4 text-right text-gray-700">
                              {formatearPrecio(mesero.ticketPromedio)}
                            </td>
                            <td className="py-3 px-4 text-right font-semibold text-purple-600">
                              {formatearPrecio(mesero.propinas)}
                            </td>
                            <td className="py-3 px-4 text-center text-gray-700">
                              {mesero.mesasAtendidas}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <UserCheck className="mx-auto mb-2" size={48} />
                  <p>No hay datos de meseros</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              <div className="bg-white rounded-2xl shadow-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Top Productos</h2>
                    <p className="text-gray-600 text-sm">Platillos más populares</p>
                  </div>
                  <Award className="text-orange-500" size={24} />
                </div>
                
                {platillosMasVendidos.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={platillosMasVendidos}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis 
                          dataKey="nombre" 
                          stroke="#6b7280"
                          tick={{ fontSize: 11 }}
                          angle={-45}
                          textAnchor="end"
                          height={100}
                        />
                        <YAxis stroke="#6b7280" tick={{ fontSize: 12 }} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#fff', 
                            border: '2px solid #f97316',
                            borderRadius: '12px'
                          }}
                          formatter={(value, name) => {
                            if (name === 'cantidad') return [value, 'Unidades'];
                            if (name === 'ingresos') return [formatearPrecio(value), 'Ingresos'];
                          }}
                        />
                        <Bar dataKey="cantidad" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>

                    <div className="mt-6 space-y-2">
                      {platillosMasVendidos.slice(0, 3).map((platillo, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${
                              index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-orange-600'
                            }`}>
                              {index + 1}
                            </div>
                            <span className="font-semibold text-gray-900">{platillo.nombre}</span>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-gray-900">{platillo.cantidad} unidades</p>
                            <p className="text-sm text-green-600">{formatearPrecio(platillo.ingresos)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <ShoppingBag className="mx-auto mb-2" size={48} />
                    <p>No hay datos de ventas</p>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl shadow-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Métodos de Pago</h2>
                    <p className="text-gray-600 text-sm">Distribución de ventas por método</p>
                  </div>
                  <DollarSign className="text-green-500" size={24} />
                </div>
                
                {ventasPorMetodoPago.some(m => m.valor > 0) ? (
                  <>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={ventasPorMetodoPago.filter(m => m.valor > 0)}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ porcentaje }) => `${porcentaje}%`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="valor"
                        >
                          {ventasPorMetodoPago.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#fff', 
                            border: '2px solid #f97316',
                            borderRadius: '12px'
                          }}
                          formatter={(value) => formatearPrecio(value)}
                        />
                      </PieChart>
                    </ResponsiveContainer>

                    <div className="space-y-3 mt-4">
                      {ventasPorMetodoPago.filter(m => m.valor > 0).map((metodo, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-4 h-4 rounded-full" 
                              style={{ backgroundColor: metodo.color }}
                            />
                            <span className="font-medium text-gray-900">{metodo.metodo}</span>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-gray-900">{formatearPrecio(metodo.valor)}</p>
                            <p className="text-sm text-gray-600">{metodo.porcentaje}%</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <DollarSign className="mx-auto mb-2" size={48} />
                    <p>No hay datos de pagos</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Ventas por Hora</h2>
                  <p className="text-gray-600 text-sm">Distribución de ventas durante el día</p>
                </div>
                <Clock className="text-blue-500" size={24} />
              </div>
              
              {ventasPorHora.some(v => v.ventas > 0) ? (
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={ventasPorHora}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="hora" 
                        stroke="#6b7280"
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis 
                        stroke="#6b7280"
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#fff', 
                          border: '2px solid #3b82f6',
                          borderRadius: '12px'
                        }}
                        formatter={(value) => [formatearPrecio(value), 'Ventas']}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="ventas" 
                        stroke="#3b82f6" 
                        strokeWidth={3}
                        dot={{ fill: '#3b82f6', r: 5 }}
                        activeDot={{ r: 8 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>

                  <div className="mt-6 grid grid-cols-3 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4 text-center">
                      <p className="text-sm text-blue-600 mb-1">Hora Pico</p>
                      <p className="text-2xl font-bold text-blue-900">{horaPico.hora}</p>
                      <p className="text-xs text-blue-600 mt-1">{formatearPrecio(horaPico.ventas)}</p>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-4 text-center">
                      <p className="text-sm text-orange-600 mb-1">Hora Baja</p>
                      <p className="text-2xl font-bold text-orange-900">
                        {horaBaja.ventas !== Infinity ? horaBaja.hora : '-'}
                      </p>
                      <p className="text-xs text-orange-600 mt-1">
                        {horaBaja.ventas !== Infinity ? formatearPrecio(horaBaja.ventas) : '-'}
                      </p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4 text-center">
                      <p className="text-sm text-green-600 mb-1">Promedio/Hora</p>
                      <p className="text-2xl font-bold text-green-900">
                        {formatearPrecio(promedioHora)}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Clock className="mx-auto mb-2" size={48} />
                  <p>No hay datos de ventas por hora</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-2xl shadow-xl p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                    <TrendingUp className="text-orange-600" size={24} />
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Crecimiento</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {metricas.crecimiento >= 0 ? '+' : ''}{metricas.crecimiento.toFixed(1)}%
                    </p>
                  </div>
                </div>
                <p className="text-sm text-gray-600">
                  vs. período anterior
                </p>
              </div>

              <div className="bg-white rounded-2xl shadow-xl p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <DollarSign className="text-green-600" size={24} />
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Propinas Totales</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatearPrecio(metricas.totalPropinas)}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-gray-600">
                  {metricas.totalVentas > 0 
                    ? `${((metricas.totalPropinas / metricas.totalVentas) * 100).toFixed(1)}% de las ventas`
                    : '0% de las ventas'}
                </p>
              </div>

              <div className="bg-white rounded-2xl shadow-xl p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Calendar className="text-blue-600" size={24} />
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Promedio Diario</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatearPrecio(metricas.promedioVenta)}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-gray-600">
                  En {datosVentas.length} {datosVentas.length === 1 ? 'día' : 'días'}
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ReportesFinancieros;