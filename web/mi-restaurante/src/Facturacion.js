import React, { useState, useRef } from 'react';
import { Search, Print, FileText, Calendar, DollarSign, Users, Download, Receipt } from 'lucide-react';

function Facturacion({ facturas = [], onCambiarEstadoFactura }) {
  const [facturaSeleccionada, setFacturaSeleccionada] = useState(null);
  const [mostrarDetalle, setMostrarDetalle] = useState(false);
  const [filtroFecha, setFiltroFecha] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todas');
  const [busqueda, setBusqueda] = useState('');
  const impresionRef = useRef();

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

  const facturasFiltradas = facturas.filter(factura => {
    const cumpleBusqueda = factura.id.toLowerCase().includes(busqueda.toLowerCase()) ||
                          factura.cliente.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
                          factura.mesa.toString().includes(busqueda);
    
    const cumpleEstado = filtroEstado === 'todas' || factura.estado === filtroEstado;
    
    const cumpleFecha = !filtroFecha || 
                       factura.fecha.toISOString().split('T')[0] === filtroFecha;
    
    return cumpleBusqueda && cumpleEstado && cumpleFecha;
  });

  const totalesDelDia = {
    ventasTotal: facturas.filter(f => f.estado === 'pagada').reduce((sum, f) => sum + f.total, 0),
    transacciones: facturas.filter(f => f.estado === 'pagada').length,
    impuestosTotal: facturas.filter(f => f.estado === 'pagada').reduce((sum, f) => sum + f.impuestos, 0)
  };

  const imprimirFactura = () => {
    if (!facturaSeleccionada) return;
    
    const ventanaImpresion = window.open('', '_blank');
    const contenido = impresionRef.current.innerHTML;
    
    ventanaImpresion.document.write(`
      <html>
        <head>
          <title>Factura ${facturaSeleccionada.id}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .factura { max-width: 400px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; }
            .item { display: flex; justify-content: space-between; margin: 5px 0; }
            .total { border-top: 2px solid #000; padding-top: 10px; font-weight: bold; }
            @media print { 
              body { margin: 0; } 
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          ${contenido}
        </body>
      </html>
    `);
    
    ventanaImpresion.document.close();
    ventanaImpresion.print();
  };

  const exportarExcel = () => {
    const csvData = [
      ['ID', 'Mesa', 'Fecha', 'Cliente', 'Subtotal', 'Impuestos', 'Total', 'Estado', 'Método Pago'],
      ...facturasFiltradas.map(f => [
        f.id,
        f.mesa,
        formatearFecha(f.fecha),
        f.cliente.nombre,
        f.subtotal,
        f.impuestos,
        f.total,
        f.estado,
        f.metodoPago
      ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'facturas.csv';
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
            {facturas.length > 0 && (
              <button
                onClick={exportarExcel}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download size={20} />
                Exportar Excel
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600">Ventas del Día</p>
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
                <p className="text-gray-600">Transacciones</p>
                <p className="text-2xl font-bold text-blue-600">{totalesDelDia.transacciones}</p>
              </div>
              <FileText className="text-blue-600" size={32} />
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600">Impuestos</p>
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
            <h3 className="text-xl font-semibold text-gray-600 mb-2">No hay facturas aún</h3>
            <p className="text-gray-500">Las facturas aparecerán aquí cuando los clientes hagan pedidos</p>
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

            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ID Factura
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Mesa
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cliente
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fecha
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Estado
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {facturasFiltradas.map((factura) => (
                      <tr key={factura.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {factura.id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          Mesa {factura.mesa}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {factura.cliente.nombre}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatearFecha(factura.fecha)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                          {formatearPrecio(factura.total)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <select
                            value={factura.estado}
                            onChange={(e) => {
                              const nuevoEstado = e.target.value;
                              let metodoPago = factura.metodoPago;
                              
                              if (nuevoEstado === 'pagada' && factura.estado === 'pendiente') {
                                metodoPago = prompt('Método de pago (efectivo/tarjeta/transferencia):', 'efectivo') || 'efectivo';
                              }
                              
                              if (onCambiarEstadoFactura) {
                                onCambiarEstadoFactura(factura.id, nuevoEstado, metodoPago);
                              }
                            }}
                            className={`px-2 py-1 text-xs font-semibold rounded-full border-none cursor-pointer ${
                              factura.estado === 'pagada'
                                ? 'bg-green-100 text-green-800'
                                : factura.estado === 'pendiente'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            <option value="pendiente">Pendiente</option>
                            <option value="pagada">Pagada</option>
                            <option value="cancelada">Cancelada</option>
                          </select>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex gap-3">
                            <button
                              onClick={() => {
                                setFacturaSeleccionada(factura);
                                setMostrarDetalle(true);
                              }}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              Ver Detalle
                            </button>
                            <button
                              onClick={() => {
                                setFacturaSeleccionada(factura);
                                setTimeout(imprimirFactura, 100);
                              }}
                              className="text-green-600 hover:text-green-900"
                            >
                              <Print size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {mostrarDetalle && facturaSeleccionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-semibold">Detalle de Factura {facturaSeleccionada.id}</h3>
              <div className="flex gap-2">
                <button
                  onClick={imprimirFactura}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Print size={16} />
                  Imprimir
                </button>
                <button
                  onClick={() => setMostrarDetalle(false)}
                  className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>

            <div ref={impresionRef} className="factura p-6">
              <div className="header text-center border-b-2 border-gray-800 pb-4 mb-6">
                <h2 className="text-2xl font-bold">RESTAURANTE DÉLICE</h2>
                <p className="text-sm text-gray-600">NIT: 900.123.456-7</p>
                <p className="text-sm text-gray-600">Calle 123 #45-67, Bogotá</p>
                <p className="text-sm text-gray-600">Tel: (01) 234-5678</p>
                <div className="mt-4">
                  <h3 className="text-lg font-semibold">FACTURA DE VENTA</h3>
                  <p className="font-bold">{facturaSeleccionada.id}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <h4 className="font-semibold mb-2">DATOS DEL CLIENTE:</h4>
                  <p><span className="font-medium">Nombre:</span> {facturaSeleccionada.cliente.nombre}</p>
                  <p><span className="font-medium">Documento:</span> {facturaSeleccionada.cliente.documento}</p>
                  <p><span className="font-medium">Teléfono:</span> {facturaSeleccionada.cliente.telefono}</p>
                  <p><span className="font-medium">Email:</span> {facturaSeleccionada.cliente.email}</p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">DATOS DE LA VENTA:</h4>
                  <p><span className="font-medium">Fecha:</span> {formatearFecha(facturaSeleccionada.fecha)}</p>
                  <p><span className="font-medium">Mesa:</span> {facturaSeleccionada.mesa}</p>
                  <p><span className="font-medium">Método de pago:</span> {facturaSeleccionada.metodoPago}</p>
                  <p><span className="font-medium">Estado:</span> {facturaSeleccionada.estado}</p>
                </div>
              </div>

              <div className="mb-6">
                <h4 className="font-semibold mb-4">DETALLE DE PRODUCTOS:</h4>
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-3 py-2 text-left">Producto</th>
                      <th className="border border-gray-300 px-3 py-2 text-center">Cant.</th>
                      <th className="border border-gray-300 px-3 py-2 text-right">Precio Unit.</th>
                      <th className="border border-gray-300 px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facturaSeleccionada.items.map((item, index) => (
                      <tr key={index}>
                        <td className="border border-gray-300 px-3 py-2">{item.nombre}</td>
                        <td className="border border-gray-300 px-3 py-2 text-center">{item.cantidad}</td>
                        <td className="border border-gray-300 px-3 py-2 text-right">{formatearPrecio(item.precio)}</td>
                        <td className="border border-gray-300 px-3 py-2 text-right">{formatearPrecio(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border-t-2 border-gray-800 pt-4">
                <div className="flex justify-end">
                  <div className="w-64">
                    <div className="flex justify-between py-1">
                      <span>Subtotal:</span>
                      <span>{formatearPrecio(facturaSeleccionada.subtotal)}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span>IVA (19%):</span>
                      <span>{formatearPrecio(facturaSeleccionada.impuestos)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-t border-gray-400 font-bold text-lg">
                      <span>TOTAL:</span>
                      <span>{formatearPrecio(facturaSeleccionada.total)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t text-center text-sm text-gray-600">
                <p>¡Gracias por visitarnos!</p>
                <p>Esta es su factura de venta</p>
                <p>Para dudas o reclamos: info@restaurantedelice.com</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Facturacion;