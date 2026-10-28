// src/Facturacion.js - CON SOPORTE PARA DOMICILIOS
import React, { useState, useEffect, useCallback } from 'react';
import { Search, Download, Receipt, ChevronDown, ChevronUp, Printer, Check, X, CheckCircle, AlertCircle, Users, Truck, Banknote, CreditCard, QrCode, Calendar } from 'lucide-react';
import CountUp from './components/reactbits/CountUp/CountUp';
import * as api from './services/api';
import { getDomicilios, actualizarEstadoDomicilio } from './services/domiciliosApi';
import { etiquetaImpuesto, impuestoIncluido } from './utils/impuestos';

// Componente de Notificación Toast
function Toast({ mensaje, tipo, onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-in">
      <div className={`flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-lift ${
        tipo === 'success' ? 'bg-green-700 text-white' :
        tipo === 'error' ? 'bg-red-700 text-white' :
        'bg-espresso text-white'
      }`}>
        {tipo === 'success' ? (
          <CheckCircle size={24} />
        ) : tipo === 'error' ? (
          <AlertCircle size={24} />
        ) : (
          <AlertCircle size={24} />
        )}
        <p className="font-medium">{mensaje}</p>
        <button 
          onClick={onClose}
          className="ml-2 hover:bg-white/20 rounded p-1 transition-colors"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}

function Facturacion() {
  // Cargar filtros desde localStorage
  const [filtroFecha, setFiltroFecha] = useState(() => {
    return localStorage.getItem('filtroFechaFacturacion') || '';
  });

  const [filtroEstado, setFiltroEstado] = useState(() => {
    return localStorage.getItem('filtroEstadoFacturacion') || 'todas';
  });

  const [busqueda, setBusqueda] = useState(() => {
    return localStorage.getItem('busquedaFacturacion') || '';
  });

  const [facturaExpandida, setFacturaExpandida] = useState(null);
  const [menuAbierto, setMenuAbierto] = useState(null);
  const [menuPosicion, setMenuPosicion] = useState({ top: 0, right: 0 });
  const [modalPago, setModalPago] = useState(null);
  const [pedidos, setPedidos] = useState([]);
  const [domicilios, setDomicilios] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [facturasApi, setFacturasApi] = useState([]); // facturas persistidas (consecutivo FV-…)
  const [cargando, setCargando] = useState(false);
  const [notificacion, setNotificacion] = useState(null);

  // Función para mostrar notificaciones
  const mostrarNotificacion = (mensaje, tipo = 'success') => {
    setNotificacion({ mensaje, tipo });
  };

  // Guardar filtros en localStorage cuando cambian
  useEffect(() => {
    localStorage.setItem('filtroEstadoFacturacion', filtroEstado);
  }, [filtroEstado]);

  useEffect(() => {
    localStorage.setItem('filtroFechaFacturacion', filtroFecha);
  }, [filtroFecha]);

  useEffect(() => {
    localStorage.setItem('busquedaFacturacion', busqueda);
  }, [busqueda]);

  // ✅ Cargar datos: pedidos normales + domicilios
  const cargarDatos = useCallback(async (mostrarMensaje = false) => {
    try {
      const [pedidosData, pagosData, domiciliosData, facturasData] = await Promise.all([
        api.getPedidos(),
        api.getPagos(),
        getDomicilios(),
        api.getFacturas()
      ]);
      setFacturasApi(Array.isArray(facturasData) ? facturasData : []);

      // Filtrar solo pedidos listos para facturar (mesas)
      const pedidosFiltrados = pedidosData.filter(pedido => 
        pedido.estado === 'Entregado' || 
        pedido.estado === 'Pagado' || 
        pedido.estado === 'Cancelado'
      );

      // ✅ Filtrar domicilios listos para facturar (EnCamino, Entregado, Cancelado)
      const domiciliosFiltrados = Array.isArray(domiciliosData) 
        ? domiciliosData.filter(d => ['EnCamino', 'Entregado', 'Cancelado'].includes(d.estado))
        : [];

      console.log(`Pedidos para facturar: ${pedidosFiltrados.length}`);
      console.log(`Domicilios para facturar: ${domiciliosFiltrados.length}`);

      setPedidos(pedidosFiltrados);
      setDomicilios(domiciliosFiltrados);
      setPagos(pagosData);

      if (mostrarMensaje) {
        mostrarNotificacion('Datos actualizados correctamente', 'success');
      }
    } catch (error) {
      console.error('Error al cargar datos:', error);
      if (mostrarMensaje) {
        mostrarNotificacion('Error al cargar datos', 'error');
      }
    }
  }, []);

  // Cargar datos al iniciar y actualización automática cada 15 segundos
  useEffect(() => {
    console.log('🔄 Iniciando actualización automática de datos');
    cargarDatos();
    
    const interval = setInterval(() => {
      console.log('⏰ Actualización automática...');
      cargarDatos(false);
    }, 15000);
    
    return () => {
      console.log('🛑 Deteniendo actualización automática');
      clearInterval(interval);
    };
  }, [cargarDatos]);

  // ✅ Transformar pedidos de mesas a formato de facturas
  const facturasPedidos = pedidos.map(pedido => {
    const subtotal = pedido.detalles.reduce((sum, d) => sum + (d.precio * d.cantidad), 0);
    // Precios con impuesto incluido: el total es el consumo (lo mismo que cobra la API).
    const impuestos = impuestoIncluido(subtotal);
    const total = subtotal;

    const pago = pagos.find(p => p.pedidoId === pedido.id);
    const facturaEmitida = pago && facturasApi.find(f => f.pagoId === pago.id);

    let estado = 'pendiente';
    if (pedido.estado === 'Pagado') {
      estado = 'pagada';
    } else if (pedido.estado === 'Cancelado') {
      estado = 'cancelada';
    }

    let metodoPago = 'pendiente';
    if (pago && pago.metodoPago) {
      metodoPago = String(pago.metodoPago).toLowerCase();
    }

    return {
      id: `P${pedido.id}`,
      pedidoId: pedido.id,
      numeroFactura: facturaEmitida?.numeroFactura ?? `#${pedido.id.toString().padStart(6, '0')}`,
      mesa: pedido.mesaNumero,
      fecha: new Date(pedido.fecha),
      cliente: {
        nombre: facturaEmitida?.nombreCliente ?? 'Consumidor final',
        documento: facturaEmitida?.nitCliente ?? '222222222222',
        telefono: '',
        email: ''
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
      pagoId: pago?.id,
      tipo: 'mesa'
    };
  });

  // ✅ Transformar domicilios a formato de facturas
  const facturasDomicilios = domicilios.map(domicilio => {
    let estado = 'pendiente';
    if (domicilio.estado === 'Entregado') {
      estado = 'pagada'; // ✅ Domicilio entregado = factura pagada
    } else if (domicilio.estado === 'Cancelado') {
      estado = 'cancelada';
    }

    return {
      id: `D${domicilio.id}`,
      domicilioId: domicilio.id,
      numeroFactura: `#D${domicilio.id.toString().padStart(6, '0')}`,
      mesa: `Domicilio #${domicilio.id}`,
      fecha: new Date(domicilio.fechaPedido),
      cliente: {
        nombre: domicilio.clienteNombre,
        documento: '222222222222',
        telefono: domicilio.clienteTelefono,
        email: ''
      },
      direccion: domicilio.direccionCompleta,
      barrio: domicilio.barrio,
      items: domicilio.detalles.map(d => ({
        nombre: d.platilloNombre,
        cantidad: d.cantidad,
        precio: d.precioUnitario,
        total: d.subtotal
      })),
      subtotal: domicilio.subtotal,
      costoEnvio: domicilio.costoEnvio,
      impuestos: impuestoIncluido(domicilio.subtotal),
      total: domicilio.total,
      estado: estado,
      metodoPago: domicilio.metodoPago.toLowerCase(),
      pagadoAnticipado: domicilio.pagadoAnticipado,
      notasCliente: domicilio.notasCliente,
      tipo: 'domicilio'
    };
  });

  // ✅ Combinar facturas de pedidos y domicilios
  const facturas = [...facturasPedidos, ...facturasDomicilios];

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
        factura.numeroFactura.toLowerCase().includes(busqueda.toLowerCase()) ||
        factura.cliente.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        factura.mesa.toString().includes(busqueda) ||
        (factura.pedidoId && factura.pedidoId.toString().includes(busqueda)) ||
        (factura.domicilioId && factura.domicilioId.toString().includes(busqueda));

      const estadoFactura = factura.estado?.toLowerCase();
      const filtro = filtroEstado.toLowerCase();

      let cumpleEstado = false;
      if (filtro === 'todas') {
        cumpleEstado = true;
      } else {
        cumpleEstado = estadoFactura === filtro;
      }

      const cumpleFecha =
        !filtroFecha ||
        factura.fecha.toLocaleDateString('en-CA') === filtroFecha; // fecha local YYYY-MM-DD

      return cumpleBusqueda && cumpleEstado && cumpleFecha;
    })
    .sort((a, b) => b.fecha - a.fecha);

  console.log('Facturas filtradas:', facturasFiltradas.length, 'de', facturas.length);

  const totalesDelDia = {
    ventasTotal: facturas.filter(f => f.estado === 'pagada').reduce((sum, f) => sum + f.total, 0),
    transacciones: facturas.filter(f => f.estado === 'pagada').length,
    impuestosTotal: facturas.filter(f => f.estado === 'pagada').reduce((sum, f) => sum + f.impuestos, 0)
  };

  // ✅ Confirmar pago para pedidos de mesa
  const confirmarPago = async (metodoPago) => {
    if (!modalPago) return;
    
    setCargando(true);
    try {
      if (modalPago.tipo === 'domicilio') {
        // ✅ Marcar domicilio como Entregado
        await actualizarEstadoDomicilio(modalPago.domicilioId, 'Entregado');
        console.log(`✅ Domicilio ${modalPago.domicilioId} marcado como Entregado`);
      } else {
        // Pago de mesa: la API valida el monto, cierra el pedido y libera la mesa
        // en una sola transacción; luego se emite la factura con su consecutivo.
        const pago = await api.createPago(
          modalPago.pedidoId,
          modalPago.total,
          metodoPago,
          0
        );
        await api.createFactura(pago.id);
      }

      setModalPago(null);
      await cargarDatos(false);
      
      mostrarNotificacion('Pago registrado exitosamente!', 'success');
    } catch (error) {
      console.error('Error al registrar pago:', error);
      mostrarNotificacion('Error al registrar el pago. Intenta de nuevo.', 'error');
    } finally {
      setCargando(false);
    }
  };

  // ✅ Cambiar estado de factura
  const cambiarEstado = async (factura, nuevoEstado) => {
    if (factura.estado === 'pagada') {
      mostrarNotificacion('Esta factura ya fue pagada y no se puede modificar', 'error');
      setMenuAbierto(null);
      return;
    }

    setCargando(true);
    try {
      if (nuevoEstado === 'pagada') {
        setMenuAbierto(null);
        setModalPago(factura);
      } else if (nuevoEstado === 'cancelada') {
        if (factura.tipo === 'domicilio') {
          await actualizarEstadoDomicilio(factura.domicilioId, 'Cancelado');
        } else {
          await api.updatePedido(factura.pedidoId, 'Cancelado');
        }
        
        await cargarDatos(false);
        mostrarNotificacion('Pedido cancelado correctamente', 'success');
        setMenuAbierto(null);
      } else if (nuevoEstado === 'pendiente') {
        if (factura.tipo === 'domicilio') {
          await actualizarEstadoDomicilio(factura.domicilioId, 'EnCamino');
        } else {
          await api.updatePedido(factura.pedidoId, 'EnProceso');
        }
        
        await cargarDatos(false);
        mostrarNotificacion('Pedido marcado como pendiente', 'success');
        setMenuAbierto(null);
      }
    } catch (error) {
      console.error('Error al cambiar estado:', error);
      mostrarNotificacion(`Error al cambiar el estado: ${error.message}`, 'error');
    } finally {
      setCargando(false);
    }
  };

  const toggleMenu = (facturaId, event) => {
    if (menuAbierto === facturaId) {
      setMenuAbierto(null);
    } else {
      const button = event.currentTarget;
      const rect = button.getBoundingClientRect();
      setMenuPosicion({
        top: rect.bottom + window.scrollY + 8,
        right: window.innerWidth - rect.right + window.scrollX
      });
      setMenuAbierto(facturaId);
    }
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
            ${factura.tipo === 'domicilio' ? `
            .domicilio-badge {
              background: #9333ea;
              color: white;
              padding: 5px 10px;
              border-radius: 5px;
              display: inline-block;
              margin: 10px 0;
              font-weight: bold;
            }
            ` : ''}
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
              <h2>RESTAURANTE QPRO</h2>
              <p>NIT: 900.123.456-7</p>
              <p>Sincelejo, Sucre, Colombia</p>
              <p>Tel: (601) 234-5678 | info@qpro.com</p>
              <div class="factura-id">
                <div>FACTURA DE VENTA</div>
                <div>${factura.numeroFactura}${factura.tipo === 'mesa' ? ` - Pedido #${factura.pedidoId}` : ''}</div>
              </div>
              ${factura.tipo === 'domicilio' ? '<div class="domicilio-badge">🚲 DOMICILIO</div>' : ''}
            </div>

            <div class="info-section">
              <h4>DATOS ${factura.tipo === 'domicilio' ? 'DEL DOMICILIO' : 'DE LA VENTA'}</h4>
              <p><span>Fecha:</span> ${formatearFecha(factura.fecha)}</p>
              <p><span>${factura.tipo === 'domicilio' ? 'Cliente' : 'Mesa'}:</span> ${factura.tipo === 'domicilio' ? factura.cliente.nombre : factura.mesa}</p>
              ${factura.tipo === 'domicilio' ? `
                <p><span>Teléfono:</span> ${factura.cliente.telefono}</p>
                <p><span>Dirección:</span> ${factura.direccion}</p>
                ${factura.barrio ? `<p><span>Barrio:</span> ${factura.barrio}</p>` : ''}
              ` : `<p><span>Pedido:</span> #${factura.pedidoId}</p>`}
              <p><span>Método de pago:</span> ${factura.metodoPago}</p>
              <p><span>Estado:</span> <strong>${factura.estado.toUpperCase()}</strong></p>
            </div>

            ${factura.notasCliente ? `
            <div class="info-section">
              <h4>NOTAS DEL CLIENTE</h4>
              <p>${factura.notasCliente}</p>
            </div>
            ` : ''}

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
                  ${factura.tipo === 'domicilio' && factura.costoEnvio ? `
                  <div class="total-row">
                    <span>Costo de Envío:</span>
                    <span>${formatearPrecio(factura.costoEnvio)}</span>
                  </div>
                  ` : ''}
                  <div class="total-row">
                    <span>${etiquetaImpuesto()}:</span>
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
              <p><strong>¡Gracias por su preferencia!</strong></p>
              <p>Esta es su factura de venta</p>
              <p>Para dudas o reclamos: info@qpro.com</p>
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
      ['Tipo', 'Factura', 'Mesa/Domicilio', 'ID', 'Fecha', 'Cliente', 'Subtotal', 'Envío', 'Impuestos', 'Total', 'Estado', 'Método Pago'],
      ...facturasFiltradas.map(f => [
        f.tipo === 'domicilio' ? 'Domicilio' : 'Mesa',
        f.numeroFactura,
        f.mesa,
        f.tipo === 'domicilio' ? f.domicilioId : f.pedidoId,
        formatearFecha(f.fecha),
        f.cliente.nombre,
        f.subtotal,
        f.costoEnvio || 0,
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
      {/* Notificaciones Toast */}
      {notificacion && (
        <Toast 
          mensaje={notificacion.mensaje}
          tipo={notificacion.tipo}
          onClose={() => setNotificacion(null)}
        />
      )}

      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-4 px-4 py-6 lg:px-6">
          <div>
            <h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-espresso">Caja</h1>
            <p className="mt-1 text-[14px] text-gray-500">Cobros de mesas y domicilios · se actualiza cada 15 s</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => cargarDatos(true)}
              disabled={cargando}
              className="h-10 rounded-xl border border-gray-300 bg-white px-4 text-[14px] font-semibold text-espresso transition-colors hover:bg-gray-50 disabled:text-gray-400"
            >
              {cargando ? 'Actualizando…' : 'Actualizar'}
            </button>
            {facturas.length > 0 && (
              <button
                onClick={exportarExcel}
                className="flex h-10 items-center gap-2 rounded-xl bg-espresso px-4 text-[14px] font-semibold text-white transition-colors hover:bg-gray-900"
              >
                <Download size={16} />
                Exportar CSV
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
        <dl className="mb-6 grid grid-cols-1 divide-y divide-gray-200 overflow-hidden rounded-2xl border border-gray-200 bg-white sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="p-5">
            <dt className="text-[13px] font-semibold text-gray-500">Ventas cobradas</dt>
            <dd className="tabular mt-1 text-[26px] font-extrabold tracking-[-0.02em] text-espresso">
              $<CountUp to={totalesDelDia.ventasTotal} separator="." duration={0.8} trigger="load" />
            </dd>
          </div>
          <div className="p-5">
            <dt className="text-[13px] font-semibold text-gray-500">Transacciones</dt>
            <dd className="tabular mt-1 text-[26px] font-extrabold tracking-[-0.02em] text-espresso">
              <CountUp to={totalesDelDia.transacciones} duration={0.8} trigger="load" />
            </dd>
          </div>
          <div className="p-5">
            <dt className="text-[13px] font-semibold text-gray-500">{etiquetaImpuesto()}</dt>
            <dd className="tabular mt-1 text-[26px] font-extrabold tracking-[-0.02em] text-espresso">
              $<CountUp to={totalesDelDia.impuestosTotal} separator="." duration={0.8} trigger="load" />
            </dd>
          </div>
        </dl>

        {facturas.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center">
            <Receipt className="mx-auto text-gray-300" size={44} strokeWidth={1.5} />
            <h3 className="mt-4 text-[18px] font-bold text-espresso">No hay cuentas por cobrar</h3>
            <p className="mx-auto mt-2 max-w-sm text-[14px] leading-relaxed text-gray-500">
              Las mesas aparecen aquí cuando el mesero las marca como entregadas, y los domicilios cuando salen en camino.
            </p>
            <button
              onClick={() => cargarDatos(true)}
              className="mt-6 h-10 rounded-xl bg-espresso px-5 text-[14px] font-semibold text-white hover:bg-gray-900"
            >
              Recargar
            </button>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    placeholder="Buscar mesa, cliente o factura"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    className="h-10 w-full rounded-xl border border-gray-300 bg-white pl-10 pr-4 text-[14px] placeholder:text-gray-500 focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-100"
                  />
                </div>

                <select
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                  className="h-10 rounded-xl border border-gray-300 bg-white px-3 text-[14px] focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-100"
                >
                  <option value="todas">Todos los estados</option>
                  <option value="pagada">Pagadas</option>
                  <option value="pendiente">Pendientes</option>
                  <option value="cancelada">Canceladas</option>
                </select>
                
                {/* El selector nativo queda invisible encima: abre el calendario del sistema,
                    pero la fecha se muestra en español sin depender del idioma del navegador. */}
                <label className="relative flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 text-[14px] focus-within:border-orange-500 focus-within:ring-4 focus-within:ring-orange-100">
                  <Calendar size={16} className="shrink-0 text-gray-500" aria-hidden="true" />
                  <span className={filtroFecha ? 'text-espresso' : 'text-gray-500'}>
                    {filtroFecha
                      ? new Date(`${filtroFecha}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
                      : 'Todas las fechas'}
                  </span>
                  <input
                    type="date"
                    value={filtroFecha}
                    onChange={(e) => setFiltroFecha(e.target.value)}
                    aria-label="Filtrar por fecha"
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                </label>
                
                <button
                  onClick={() => {
                    setBusqueda('');
                    setFiltroEstado('todas');
                    setFiltroFecha('');
                    localStorage.removeItem('busquedaFacturacion');
                    localStorage.setItem('filtroEstadoFacturacion', 'todas');
                    localStorage.removeItem('filtroFechaFacturacion');
                  }}
                  className="h-10 rounded-xl px-4 text-[14px] font-semibold text-gray-600 transition-colors hover:bg-gray-100 hover:text-espresso"
                >
                  Limpiar filtros
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {facturasFiltradas.map((factura) => (
                <div
                  key={factura.id}
                  className={`overflow-hidden rounded-2xl border bg-white transition-shadow hover:shadow-card ${
                    factura.estado === 'pendiente' ? 'border-amber-300' : 'border-gray-200'
                  }`}
                >
                  <div className="p-4 lg:px-5">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex min-w-0 flex-1 items-center gap-4">
                        <span
                          className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${
                            factura.tipo === 'domicilio' ? 'bg-purple-50 text-purple-700' : 'bg-orange-50 text-orange-700'
                          }`}
                          aria-label={factura.tipo === 'domicilio' ? 'Domicilio' : 'Mesa'}
                        >
                          {factura.tipo === 'domicilio' ? <Truck size={20} /> : <Users size={20} />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <h3 className="text-[17px] font-extrabold text-espresso">
                              {factura.tipo === 'domicilio' ? factura.mesa : `Mesa ${factura.mesa}`}
                            </h3>
                            <span className="tabular text-[13px] font-semibold text-gray-500">{factura.numeroFactura}</span>
                            <span className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-bold ${
                              factura.estado === 'pagada' ? 'bg-green-50 text-green-800' :
                              factura.estado === 'pendiente' ? 'bg-amber-50 text-amber-800' :
                              'bg-red-50 text-red-800'
                            }`}>
                              {factura.estado === 'pagada' && <Check size={12} strokeWidth={3} />}
                              {factura.estado.charAt(0).toUpperCase() + factura.estado.slice(1)}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-gray-500">
                            <span className="font-semibold text-gray-700">{factura.cliente.nombre}</span>
                            {factura.tipo === 'domicilio' && factura.cliente.telefono && (
                              <span className="tabular">{factura.cliente.telefono}</span>
                            )}
                            <span className="tabular">{formatearFecha(factura.fecha)}</span>
                          </div>
                        </div>
                        <span className="tabular shrink-0 text-[18px] font-extrabold text-espresso">{formatearPrecio(factura.total)}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleExpandir(factura.id)}
                          className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-[14px] font-semibold text-gray-600 transition-colors hover:bg-gray-100 hover:text-espresso"
                        >
                          {facturaExpandida === factura.id ? (
                            <>
                              <ChevronUp size={18} />
                              <span className="text-sm font-medium">Ocultar</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown size={18} />
                              <span className="text-sm font-medium">Detalles</span>
                            </>
                          )}
                        </button>
                        
                        <button
                          onClick={() => imprimirFactura(factura)}
                          className="flex h-10 items-center gap-2 rounded-xl border border-gray-300 bg-white px-3.5 text-espresso transition-colors hover:bg-gray-50"
                        >
                          <Printer size={16} />
                          <span className="text-sm font-medium">Imprimir</span>
                        </button>
                        
                        <div className="relative">
                          <div className="flex">
                            <button
                              onClick={() => marcarComoPagada(factura)}
                              disabled={factura.estado === 'pagada' || cargando}
                              className={`flex h-10 items-center gap-2 rounded-l-xl px-4 text-sm font-semibold transition-colors ${
                                factura.estado === 'pagada'
                                  ? 'cursor-not-allowed bg-green-50 text-green-800'
                                  : 'bg-espresso text-white hover:bg-gray-900'
                              }`}
                            >
                              <Check size={16} />
                              {factura.estado === 'pagada' ? 'Pagada' : 'Cobrar'}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleMenu(factura.id, e);
                              }}
                              disabled={cargando}
                              aria-label="Más acciones"
                              className={`h-10 rounded-r-xl border-l px-2 transition-colors ${
                                factura.estado === 'pagada'
                                  ? 'border-green-200 bg-green-50 text-green-800 hover:bg-green-100'
                                  : 'border-white/20 bg-espresso text-white hover:bg-gray-900'
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
                              <div 
                                className="fixed w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50"
                                style={{
                                  top: `${menuPosicion.top}px`,
                                  right: `${menuPosicion.right}px`
                                }}
                              >
                                <button
                                  onClick={() => cambiarEstado(factura, 'pendiente')}
                                  disabled={cargando}
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                                  Pendiente
                                </button>
                                <button
                                  onClick={() => cambiarEstado(factura, 'pagada')}
                                  disabled={cargando}
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <span className="w-3 h-3 rounded-full bg-green-500"></span>
                                  Pagada
                                </button>
                                <button
                                  onClick={() => cambiarEstado(factura, 'cancelada')}
                                  disabled={cargando}
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
                    <div className="border-t border-gray-200 bg-white p-5 lg:p-6">
                      <div className="grid grid-cols-1 gap-6 mb-6">
                        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                          <h4 className="mb-4 text-[15px] font-bold text-espresso">
                            Información de la venta
                          </h4>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">{factura.tipo === 'domicilio' ? 'Domicilio:' : 'Mesa:'}</span>
                              <span className="font-semibold text-gray-900">{factura.mesa}</span>
                            </div>
                            {factura.tipo === 'domicilio' && factura.direccion && (
                              <div className="flex justify-between items-center col-span-2">
                                <span className="text-gray-600">Dirección:</span>
                                <span className="font-medium text-gray-800 text-xs">{factura.direccion}</span>
                              </div>
                            )}
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
                                factura.estado === 'pagada' ? 'text-green-700' :
                                factura.estado === 'pendiente' ? 'text-amber-700' :
                                'text-red-600'
                              }`}>
                                {factura.estado}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {factura.notasCliente && (
                        <div className="mb-4 rounded-2xl bg-amber-50 p-4">
                          <h4 className="mb-1 text-[14px] font-bold text-espresso">Notas del cliente</h4>
                          <p className="text-sm text-gray-700">{factura.notasCliente}</p>
                        </div>
                      )}

                      <div className="mb-4 rounded-2xl border border-gray-200 bg-gray-50 p-5">
                        <h4 className="mb-4 text-[15px] font-bold text-espresso">
                          Detalle de productos
                        </h4>
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b border-gray-200">
                                <th className="px-4 py-3 text-left text-[13px] font-semibold text-gray-500">Producto</th>
                                <th className="px-4 py-3 text-center text-[13px] font-semibold text-gray-500">Cantidad</th>
                                <th className="px-4 py-3 text-right text-[13px] font-semibold text-gray-500">Precio unit.</th>
                                <th className="px-4 py-3 text-right text-[13px] font-semibold text-gray-500">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {factura.items.map((item, index) => (
                                <tr key={index} className="border-b border-gray-200 last:border-0">
                                  <td className="px-4 py-3 text-sm font-medium text-gray-800">{item.nombre}</td>
                                  <td className="px-4 py-3 text-sm text-center">
                                    <span className="tabular inline-grid h-8 min-w-[2rem] place-items-center rounded-lg bg-orange-500 px-1.5 font-bold text-espresso">
                                      {item.cantidad}
                                    </span>
                                  </td>
                                  <td className="tabular px-4 py-3 text-right text-sm text-gray-700">{formatearPrecio(item.precio)}</td>
                                  <td className="tabular px-4 py-3 text-right text-sm font-bold text-espresso">{formatearPrecio(item.total)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-gray-200 bg-white p-5">
                        <div className="flex justify-end">
                          <div className="w-full md:w-96">
                            <h4 className="mb-4 text-[15px] font-bold text-espresso">Resumen</h4>
                            <div className="space-y-3">
                              <div className="flex justify-between text-sm py-2 border-b border-gray-200">
                                <span className="text-gray-600 font-medium">Subtotal:</span>
                                <span className="tabular font-semibold text-espresso">{formatearPrecio(factura.subtotal)}</span>
                              </div>
                              {factura.tipo === 'domicilio' && factura.costoEnvio > 0 && (
                                <div className="flex justify-between text-sm py-2 border-b border-gray-200">
                                  <span className="text-gray-600 font-medium">Envío:</span>
                                  <span className="tabular font-semibold text-espresso">{formatearPrecio(factura.costoEnvio)}</span>
                                </div>
                              )}
                              <div className="flex justify-between text-sm py-2 border-b border-gray-200">
                                <span className="text-gray-600 font-medium">{etiquetaImpuesto()}:</span>
                                <span className="tabular font-semibold text-gray-600">{formatearPrecio(factura.impuestos)}</span>
                              </div>
                              <div className="flex items-baseline justify-between pt-3">
                                <span className="text-[16px] font-bold text-espresso">Total</span>
                                <span className="tabular text-[22px] font-extrabold text-espresso">{formatearPrecio(factura.total)}</span>
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
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-espresso/55 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="titulo-cobro">
          <div className="animate-scale-in w-full max-w-md rounded-3xl bg-white p-6 shadow-lift">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="titulo-cobro" className="text-[22px] font-extrabold tracking-[-0.02em] text-espresso">
                  {modalPago.tipo === 'domicilio' ? 'Confirmar entrega y pago' : 'Cobrar'}
                </h3>
                <p className="mt-1 text-[14px] text-gray-500">
                  {modalPago.tipo === 'domicilio'
                    ? `Domicilio #${modalPago.domicilioId} · ${modalPago.cliente.nombre}`
                    : `Mesa ${modalPago.mesa} · Pedido #${modalPago.pedidoId}`}
                </p>
              </div>
              <button
                onClick={() => setModalPago(null)}
                disabled={cargando}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
                aria-label="Cancelar"
              >
                <X size={18} />
              </button>
            </div>

            <p className="tabular mt-5 text-[40px] font-extrabold leading-none tracking-[-0.03em] text-espresso">
              {formatearPrecio(modalPago.total)}
            </p>
            <p className="mt-1 text-[13px] text-gray-500">{etiquetaImpuesto()}</p>

            <div className="mt-6 space-y-2">
              {modalPago.tipo === 'domicilio' ? (
                <button
                  onClick={() => confirmarPago(modalPago.metodoPago)}
                  disabled={cargando}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-espresso text-[15px] font-bold text-white transition-colors hover:bg-gray-900 disabled:bg-gray-300"
                >
                  <CheckCircle size={20} />
                  Confirmar entrega y pago
                </button>
              ) : (
                [
                  { metodo: 'Efectivo', icono: Banknote, texto: 'Efectivo' },
                  { metodo: 'Tarjeta', icono: CreditCard, texto: 'Tarjeta débito o crédito' },
                  { metodo: 'QR', icono: QrCode, texto: 'QR o transferencia' }
                ].map(({ metodo, icono: Icono, texto }) => (
                  <button
                    key={metodo}
                    onClick={() => confirmarPago(metodo)}
                    disabled={cargando}
                    className="group flex h-14 w-full items-center gap-3 rounded-2xl border border-gray-200 px-4 text-left transition-colors hover:border-espresso hover:bg-espresso hover:text-white disabled:opacity-50"
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-orange-50 text-orange-700 transition-colors group-hover:bg-white/10 group-hover:text-orange-200">
                      <Icono size={18} />
                    </span>
                    <span className="flex-1 text-[15px] font-bold">{texto}</span>
                    <ChevronDown className="-rotate-90 text-gray-400 group-hover:text-white" size={18} />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }

        @keyframes scale-in {
          from {
            transform: scale(0.9);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        
        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}

export default Facturacion;