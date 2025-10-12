// src/Facturacion.js
import React, { useState, useEffect } from 'react';
import { Search, FileText, Calendar, DollarSign, Download, Receipt, ChevronDown, ChevronUp, Printer, Check } from 'lucide-react';
import * as api from './services/api';

function Facturacion() {
  const [filtroFecha, setFiltroFecha] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todas');
  const [busqueda, setBusqueda] = useState('');
  const [facturaExpandida, setFacturaExpandida] = useState(null);
  const [menuAbierto, setMenuAbierto] = useState(null);
  const [modalPago, setModalPago] = useState(null);
  const [pedidos, setPedidos] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [cargando, setCargando] = useState(false);

  // Cargar pedidos al iniciar y cada 30 segundos
  useEffect(() => {
    cargarDatos();
    const interval = setInterval(cargarDatos, 30000);
    return () => clearInterval(interval);
  }, []);

  const cargarDatos = async () => {
    try {
      const [pedidosData, pagosData] = await Promise.all([
        api.getPedidos(),
        api.getPagos()
      ]);
      
      // ⭐ Incluir también los pedidos Cancelados
      const pedidosFiltrados = pedidosData.filter(pedido => 
      pedido.estado === 'Entregado' || 
      pedido.estado === 'Pagado' || 
      pedido.estado === 'Cancelado'
  );

      
      console.log(`📋 Total pedidos: ${pedidosData.length}, Para facturar: ${pedidosFiltrados.length}`);
      
      setPedidos(pedidosFiltrados);
      setPagos(pagosData);
    } catch (error) {
      console.error('Error al cargar datos:', error);
    }
  };

  // Transformar pedidos a formato de facturas
  const facturas = pedidos.map(pedido => {
    // Calcular totales
    const subtotal = pedido.detalles.reduce((sum, d) => sum + (d.precio * d.cantidad), 0);
    const impuestos = Math.round(subtotal * 0.19);
    const total = subtotal + impuestos;

    // Buscar si existe un pago para este pedido
    const pago = pagos.find(p => p.pedidoId === pedido.id);

    // Determinar estado
    let estado = 'pendiente';
    if (pedido.estado === 'Pagado') {
      estado = 'pagada';
    } else if (pedido.estado === 'Cancelado') {
      estado = 'cancelada';
    }

    // Determinar método de pago de forma segura
    let metodoPago = 'pendiente';
    if (pago && pago.metodoPago) {
      metodoPago = String(pago.metodoPago).toLowerCase();
    }

    return {
      id: `Mesa ${pedido.mesaNumero}`,
      numeroFactura: `#${pedido.id.toString().padStart(6, '0')}`,
      pedidoId: pedido.id,
      mesa: pedido.mesaNumero,
      fecha: new Date(pedido.fecha),
      cliente: {
        nombre: `Cliente Mesa ${pedido.mesaNumero}`,
        documento: '00000000',
        telefono: '3000000000',
        email: 'cliente@email.com'
      },
      items: pedido.detalles.map(d => ({
        nombre: d.platilloNombre,
        cantidad: d.cantidad,
        precio: d.precio,
        total: d.precio * d.cantidad
      })),
      subtotal: subtotal,
      impuestos: impuestos,
      total: total,
      estado: estado,
      metodoPago: metodoPago,
      pagoId: pago?.id
    };
  });

  const formatearPrecio = (precio) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(precio);
  };

  const formatearFecha = (fecha) => {
    return new Intl.DateTimeFormat('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(fecha);
  };

  const facturasFiltradas = facturas
  .filter(factura => {
    const cumpleBusqueda =
      factura.id.toLowerCase().includes(busqueda.toLowerCase()) ||
      factura.numeroFactura.toLowerCase().includes(busqueda.toLowerCase()) ||
      factura.cliente.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      factura.mesa.toString().includes(busqueda) ||
      factura.pedidoId.toString().includes(busqueda);

    const estadoFactura = factura.estado?.toLowerCase();
    const filtro = filtroEstado.toLowerCase();

    let cumpleEstado = false;

    // 🔥 Lógica de filtrado corregida:
    if (filtro === 'todas') {
      // En "todas" mostramos todo excepto canceladas
      cumpleEstado = estadoFactura !== 'cancelada';
    } else {
      // En filtros específicos solo mostramos coincidencias exactas
      cumpleEstado = estadoFactura === filtro;
    }

    const cumpleFecha =
      !filtroFecha ||
      factura.fecha.toISOString().split('T')[0] === filtroFecha;

    return cumpleBusqueda && cumpleEstado && cumpleFecha;
  })
  .sort((a, b) => b.fecha - a.fecha);

  
  const totalesDelDia = {
    ventasTotal: facturas.filter(f => f.estado === 'pagada').reduce((sum, f) => sum + f.total, 0),
    transacciones: facturas.filter(f => f.estado === 'pagada').length,
    impuestosTotal: facturas.filter(f => f.estado === 'pagada').reduce((sum, f) => sum + f.impuestos, 0)
  };

  const confirmarPago = async (metodoPago) => {
    if (!modalPago) return;
    
    setCargando(true);
    try {
      console.log('💳 Procesando pago...', {
        pedidoId: modalPago.pedidoId,
        subtotal: modalPago.subtotal,
        metodoPago: metodoPago
      });

      // Crear el pago en la API
      await api.createPago(
        modalPago.pedidoId,
        modalPago.subtotal,
        metodoPago,
        0
      );

      // Actualizar el estado del pedido a Pagado
      await api.updatePedido(modalPago.pedidoId, 'Pagado');

      // Recargar los datos
      await cargarDatos();
      
      setModalPago(null);
      alert('¡Pago registrado exitosamente!');
    } catch (error) {
      console.error('Error al registrar pago:', error);
      alert('Error al registrar el pago. Por favor intenta de nuevo.');
    } finally {
      setCargando(false);
    }
  };

  const cambiarEstado = async (factura, nuevoEstado) => {
    // 🚫 Evita cualquier cambio si ya está pagada
    if (factura.estado === 'pagada') {
      alert('❌ Esta factura ya fue pagada y no se puede modificar.');
      setMenuAbierto(null);
      return;
    }
  
    setCargando(true);
    try {
      if (nuevoEstado === 'pagada') {
        setModalPago(factura);
      } else if (nuevoEstado === 'cancelada') {
        await api.updatePedido(factura.pedidoId, 'Cancelado');
        await cargarDatos();
      } else if (nuevoEstado === 'pendiente') {
        await api.updatePedido(factura.pedidoId, 'EnProceso');
        await cargarDatos();
      }
      setMenuAbierto(null);
    } catch (error) {
      console.error('Error al cambiar estado:', error);
      alert('Error al cambiar el estado. Por favor intenta de nuevo.');
    } finally {
      setCargando(false);
    }
  };

  const toggleMenu = (facturaId) => {
    setMenuAbierto(menuAbierto === facturaId ? null : facturaId);
  };

  const toggleExpandir = (facturaId) => {
    setFacturaExpandida(facturaExpandida === facturaId ? null : facturaId);
  };

  const marcarComoPagada = (factura) => {
    if (factura.estado !== 'pagada') {
      setModalPago(factura);
    }
  };

  const imprimirFactura = (factura) => {
    const ventanaImpresion = window.open('', '_blank');
    
    const contenidoHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Factura ${factura.numeroFactura}</title>
          <meta charset="UTF-8">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Courier New', monospace; 
              padding: 20px;
              max-width: 800px;
              margin: 0 auto;
            }
            .factura { background: white; }
            .header { 
              text-align: center; 
              border-bottom: 2px solid #000; 
              padding-bottom: 15px; 
              margin-bottom: 20px;
            }
            .header h2 { font-size: 24px; margin-bottom: 8px; }
            .header p { font-size: 12px; color: #333; margin: 3px 0; }
            .header .factura-id { 
              font-size: 14px; 
              font-weight: bold; 
              margin-top: 10px; 
              padding: 5px;
              background: #f0f0f0;
            }
            .info-section {
              margin-bottom: 20px;
            }
            .info-section h4 { 
              font-size: 12px; 
              font-weight: bold; 
              margin-bottom: 8px;
              border-bottom: 1px solid #ccc;
              padding-bottom: 4px;
            }
            .info-section p { 
              font-size: 11px; 
              margin: 4px 0;
              line-height: 1.4;
            }
            .info-section span { font-weight: bold; }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin: 20px 0;
            }
            th, td { 
              border: 1px solid #000; 
              padding: 8px; 
              text-align: left;
              font-size: 11px;
            }
            th { 
              background: #f0f0f0; 
              font-weight: bold;
            }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .totales { 
              margin-top: 20px;
              border-top: 2px solid #000;
              padding-top: 15px;
            }
            .totales-grid {
              display: flex;
              justify-content: flex-end;
            }
            .totales-content {
              width: 300px;
            }
            .total-row { 
              display: flex;
              justify-content: space-between;
              padding: 6px 0;
              font-size: 12px;
            }
            .total-row.final { 
              border-top: 2px solid #000;
              font-weight: bold;
              font-size: 14px;
              padding-top: 10px;
              margin-top: 6px;
            }
            .footer { 
              margin-top: 30px; 
              padding-top: 15px;
              border-top: 1px dashed #999;
              text-align: center;
            }
            .footer p { 
              font-size: 10px; 
              color: #666; 
              margin: 4px 0;
            }
            @media print {
              body { padding: 10px; }
            }
          </style>
        </head>
        <body>
          <div class="factura">
            <div class="header">
              <h2>RESTAURANTE DÉLICE</h2>
              <p>NIT: 900.123.456-7</p>
              <p>Calle 123 #45-67, Bogotá D.C., Colombia</p>
              <p>Tel: (601) 234-5678 | info@restaurantedelice.com</p>
              <div class="factura-id">
                <div>FACTURA DE VENTA</div>
                <div>${factura.numeroFactura} - Pedido #${factura.pedidoId}</div>
              </div>
            </div>

            <div class="info-section">
              <h4>DATOS DE LA VENTA</h4>
              <p><span>Fecha:</span> ${formatearFecha(factura.fecha)}</p>
              <p><span>Mesa:</span> ${factura.mesa}</p>
              <p><span>Pedido:</span> #${factura.pedidoId}</p>
              <p><span>Método de pago:</span> ${factura.metodoPago}</p>
              <p><span>Estado:</span> <strong>${factura.estado.toUpperCase()}</strong></p>
            </div>

            <div>
              <h4 style="font-size: 12px; margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 5px;">DETALLE DE PRODUCTOS</h4>
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th class="text-center" style="width: 80px;">Cant.</th>
                    <th class="text-right" style="width: 120px;">Precio Unit.</th>
                    <th class="text-right" style="width: 120px;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${factura.items.map(item => `
                    <tr>
                      <td>${item.nombre}</td>
                      <td class="text-center">${item.cantidad}</td>
                      <td class="text-right">${formatearPrecio(item.precio)}</td>
                      <td class="text-right">${formatearPrecio(item.total)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

            <div class="totales">
              <div class="totales-grid">
                <div class="totales-content">
                  <div class="total-row">
                    <span>Subtotal:</span>
                    <span>${formatearPrecio(factura.subtotal)}</span>
                  </div>
                  <div class="total-row">
                    <span>IVA (19%):</span>
                    <span>${formatearPrecio(factura.impuestos)}</span>
                  </div>
                  <div class="total-row final">
                    <span>TOTAL A PAGAR:</span>
                    <span>${formatearPrecio(factura.total)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="footer">
              <p><strong>¡Gracias por visitarnos!</strong></p>
              <p>Esta es su factura de venta</p>
              <p>Para dudas o reclamos: info@restaurantedelice.com</p>
              <p>Resolución DIAN No. 18764003241789 del 15/03/2024</p>
              <p>Rango autorizado: INV-1000000 al INV-2000000</p>
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `;
    
    ventanaImpresion.document.write(contenidoHTML);
    ventanaImpresion.document.close();
  };

  const exportarExcel = () => {
    const csvData = [
      ['Factura', 'Mesa', 'Pedido ID', 'Fecha', 'Cliente', 'Subtotal', 'Impuestos', 'Total', 'Estado', 'Método Pago'],
      ...facturasFiltradas.map(f => [
        f.numeroFactura,
        f.mesa,
        f.pedidoId,
        formatearFecha(f.fecha),
        f.cliente.nombre,
        f.subtotal,
        f.impuestos,
        f.total,
        f.estado,
        f.metodoPago
      ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob(['\uFEFF' + csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `facturas_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Receipt className="text-blue-600" size={32} />
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Sistema de Facturación</h1>
                <p className="text-gray-600">Restaurante Délice</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={cargarDatos}
                disabled={cargando}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
              >
                {cargando ? 'Actualizando...' : 'Actualizar'}
              </button>
              {facturas.length > 0 && (
                <button
                  onClick={exportarExcel}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Download size={20} />
                  Exportar CSV
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Ventas del Día</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatearPrecio(totalesDelDia.ventasTotal)}
                </p>
              </div>
              <DollarSign className="text-green-600" size={32} />
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Transacciones</p>
                <p className="text-2xl font-bold text-blue-600">{totalesDelDia.transacciones}</p>
              </div>
              <FileText className="text-blue-600" size={32} />
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Impuestos</p>
                <p className="text-2xl font-bold text-orange-600">
                  {formatearPrecio(totalesDelDia.impuestosTotal)}
                </p>
              </div>
              <Calendar className="text-orange-600" size={32} />
            </div>
          </div>
        </div>

        {facturas.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <Receipt className="mx-auto text-gray-400 mb-4" size={64} />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">No hay pedidos listos para facturar</h3>
            <p className="text-gray-500 mb-4">
              Los pedidos aparecerán aquí cuando sean marcados como <strong>"Entregado"</strong> en la cocina
            </p>
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 max-w-md mx-auto">
              <p className="text-sm text-blue-800">
                💡 <strong>Flujo:</strong><br/>
                1️⃣ Cliente hace pedido<br/>
                2️⃣ Cocina prepara<br/>
                3️⃣ <strong>Cocina marca "Entregado"</strong><br/>
                4️⃣ Aparece aquí para facturar
              </p>
            </div>
            <button
              onClick={cargarDatos}
              className="mt-6 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              Recargar
            </button>
          </div>
        ) : (
          <>
            <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Buscar por ID, cliente o mesa..."
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <select
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="todas">Todos los estados</option>
                  <option value="pagada">Pagadas</option>
                  <option value="pendiente">Pendientes</option>
                  <option value="cancelada">Canceladas</option>
                </select>
                
                <input
                  type="date"
                  value={filtroFecha}
                  onChange={(e) => setFiltroFecha(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                
                <button
                  onClick={() => {
                    setBusqueda('');
                    setFiltroEstado('todas');
                    setFiltroFecha('');
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Limpiar Filtros
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {facturasFiltradas.map((factura) => (
                <div 
                  key={factura.id} 
                  className={`bg-white rounded-lg shadow-sm overflow-hidden transition-all ${
                    factura.estado === 'pagada' 
                      ? 'border-2 border-green-500 shadow-green-100' 
                      : factura.estado === 'cancelada'
                      ? 'border-2 border-red-500 shadow-red-100'
                      : factura.estado === 'pendiente'
                      ? 'border-2 border-yellow-500 shadow-yellow-100'
                      : 'border border-gray-200'
                  }`}
                >
                  <div className={`p-4 ${
                    factura.estado === 'pagada' ? 'bg-green-50' : 
                    factura.estado === 'cancelada' ? 'bg-red-50' :
                    factura.estado === 'pendiente' ? 'bg-yellow-50' :
                    'bg-gray-50'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-bold text-gray-900">Mesa {factura.mesa}</h3>
                            <p className="text-sm text-gray-600 mt-1">
                              Factura {factura.numeroFactura}
                            </p>
                            <span className="text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-medium ml-2">
                              Pedido #{factura.pedidoId}
                            </span>

                            <span className={`px-3 py-1 text-xs font-semibold rounded-full flex items-center gap-1 ${
                              factura.estado === 'pagada' ? 'bg-green-100 text-green-800' :
                              factura.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {factura.estado === 'pagada' && <Check size={14} />}
                              {factura.estado.charAt(0).toUpperCase() + factura.estado.slice(1)}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span className="font-medium">{factura.cliente.nombre}</span>
                            <span>•</span>
                            <span>{formatearFecha(factura.fecha)}</span>
                            <span>•</span>
                            <span className="font-bold text-green-600 text-base">{formatearPrecio(factura.total)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleExpandir(factura.id)}
                          className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          {facturaExpandida === factura.id ? (
                            <>
                              <ChevronUp size={18} />
                              <span className="text-sm font-medium">Ocultar</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown size={18} />
                              <span className="text-sm font-medium">Ver Detalles</span>
                            </>
                          )}
                        </button>
                        
                        <button
                          onClick={() => imprimirFactura(factura)}
                          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <Printer size={16} />
                          <span className="text-sm font-medium">Imprimir</span>
                        </button>
                        
                        <div className="relative" id={`menu-container-${factura.id}`}>
                          <div className="flex">
                            <button
                              onClick={() => marcarComoPagada(factura)}
                              disabled={factura.estado === 'pagada' || cargando}
                              className={`flex items-center gap-2 px-4 py-2 rounded-l-lg font-medium text-sm transition-colors ${
                                factura.estado === 'pagada'
                                  ? 'bg-green-600 text-white cursor-not-allowed'
                                  : 'bg-green-500 text-white hover:bg-green-600'
                              }`}
                            >
                              <Check size={16} />
                              {factura.estado === 'pagada' ? 'Pagada' : 'Marcar Pagada'}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleMenu(factura.id);
                              }}
                              disabled={cargando}
                              className={`px-2 py-2 rounded-r-lg border-l border-white/30 transition-colors ${
                                factura.estado === 'pagada'
                                  ? 'bg-green-600 text-white hover:bg-green-700'
                                  : 'bg-green-500 text-white hover:bg-green-600'
                              }`}
                            >
                              <ChevronDown size={16} />
                            </button>
                          </div>
                          
                          {menuAbierto === factura.id && (
                            <>
                              <div 
                                className="fixed inset-0 z-30"
                                onClick={() => setMenuAbierto(null)}
                              />
                              <div className="fixed w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-40"
                                style={{
                                  top: `${document.getElementById(`menu-container-${factura.id}`)?.getBoundingClientRect().bottom + 8}px`,
                                  left: `${document.getElementById(`menu-container-${factura.id}`)?.getBoundingClientRect().right - 192}px`
                                }}
                              >
                                <button
                                  onClick={() => cambiarEstado(factura, 'pendiente')}
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                                >
                                  <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                                  Pendiente
                                </button>
                                <button
                                  onClick={() => cambiarEstado(factura, 'pagada')}
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                                >
                                  <span className="w-3 h-3 rounded-full bg-green-500"></span>
                                  Pagada
                                </button>
                                <button
                                  onClick={() => cambiarEstado(factura, 'cancelada')}
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                                >
                                  <span className="w-3 h-3 rounded-full bg-red-500"></span>
                                  Cancelada
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {facturaExpandida === factura.id && (
                    <div className="p-6 bg-white border-t-2 border-gray-200">
                      <div className="grid grid-cols-1 gap-6 mb-6">
                        <div className="bg-gradient-to-br from-green-50 to-white p-5 rounded-lg border border-green-100">
                          <h4 className="font-bold text-gray-800 mb-4 text-sm uppercase flex items-center gap-2">
                            <span className="w-2 h-2 bg-green-600 rounded-full"></span>
                            Información de la Venta
                          </h4>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">Mesa:</span>
                              <span className="font-semibold text-gray-900">Mesa {factura.mesa}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">Fecha:</span>
                              <span className="font-medium text-gray-800 text-xs">{formatearFecha(factura.fecha)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">Método de pago:</span>
                              <span className="font-medium text-gray-800 capitalize">{factura.metodoPago}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">Estado:</span>
                              <span className={`font-semibold capitalize ${
                                factura.estado === 'pagada' ? 'text-green-600' :
                                factura.estado === 'pendiente' ? 'text-yellow-600' :
                                'text-red-600'
                              }`}>
                                {factura.estado}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-orange-50 to-white p-5 rounded-lg border border-orange-100 mb-4">
                        <h4 className="font-bold text-gray-800 mb-4 text-sm uppercase flex items-center gap-2">
                          <span className="w-2 h-2 bg-orange-600 rounded-full"></span>
                          Detalle de Productos Ordenados
                        </h4>
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="bg-orange-100 border-b-2 border-orange-200">
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Producto</th>
                                <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Cantidad</th>
                                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Precio Unit.</th>
                                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {factura.items.map((item, index) => (
                                <tr key={index} className="border-b border-gray-200 hover:bg-orange-50 transition-colors">
                                  <td className="px-4 py-3 text-sm font-medium text-gray-800">{item.nombre}</td>
                                  <td className="px-4 py-3 text-sm text-center">
                                    <span className="inline-flex items-center justify-center w-8 h-8 bg-orange-600 text-white font-bold rounded-full">
                                      {item.cantidad}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-right text-gray-700">{formatearPrecio(item.precio)}</td>
                                  <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">{formatearPrecio(item.total)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-gray-50 to-white p-5 rounded-lg border-2 border-gray-300">
                        <div className="flex justify-end">
                          <div className="w-full md:w-96">
                            <h4 className="font-bold text-gray-800 mb-4 text-sm uppercase">Resumen de Factura</h4>
                            <div className="space-y-3">
                              <div className="flex justify-between text-sm py-2 border-b border-gray-200">
                                <span className="text-gray-600 font-medium">Subtotal:</span>
                                <span className="font-semibold text-gray-900">{formatearPrecio(factura.subtotal)}</span>
                              </div>
                              <div className="flex justify-between text-sm py-2 border-b border-gray-200">
                                <span className="text-gray-600 font-medium">IVA (19%):</span>
                                <span className="font-semibold text-orange-600">{formatearPrecio(factura.impuestos)}</span>
                              </div>
                              <div className="flex justify-between pt-3 border-t-2 border-gray-900">
                                <span className="text-lg font-bold text-gray-900">TOTAL A PAGAR:</span>
                                <span className="text-xl font-bold text-green-600">{formatearPrecio(factura.total)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modal de Método de Pago */}
      {modalPago && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-scale-in">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <DollarSign className="text-green-600" size={32} />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Método de Pago</h3>
              <p className="text-gray-600">Selecciona cómo pagó el cliente</p>
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">Factura:</span> {modalPago.id}
                </p>
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">Mesa:</span> {modalPago.mesa}
                </p>
                <p className="text-lg font-bold text-green-600 mt-2">
                  {formatearPrecio(modalPago.total)}
                </p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <button
                onClick={() => confirmarPago('Efectivo')}
                disabled={cargando}
                className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all transform hover:scale-105 shadow-lg disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                    <span className="text-2xl">💵</span>
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-lg">Efectivo</p>
                    <p className="text-sm text-green-100">Pago en efectivo</p>
                  </div>
                </div>
                <ChevronDown className="rotate-[-90deg]" size={24} />
              </button>

              <button
                onClick={() => confirmarPago('Tarjeta')}
                disabled={cargando}
                className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all transform hover:scale-105 shadow-lg disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                    <span className="text-2xl">💳</span>
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-lg">Tarjeta</p>
                    <p className="text-sm text-blue-100">Débito o crédito</p>
                  </div>
                </div>
                <ChevronDown className="rotate-[-90deg]" size={24} />
              </button>

              <button
                onClick={() => confirmarPago('QR')}
                disabled={cargando}
                className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all transform hover:scale-105 shadow-lg disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                    <span className="text-2xl">📱</span>
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-lg">QR / Transferencia</p>
                    <p className="text-sm text-purple-100">Pago digital</p>
                  </div>
                </div>
                <ChevronDown className="rotate-[-90deg]" size={24} />
              </button>
            </div>

            <button
              onClick={() => setModalPago(null)}
              disabled={cargando}
              className="w-full py-3 px-4 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Facturacion;