import {
  agruparCuentas, arqueo, billetesSugeridos, cambio, cobrable, consumoElegido, consumoPedido, contarBilletes, estadoSolicitud,
  lineasCuenta, montosPagos, partesIguales, platosPorCobrar, propinaSugerida, resumenPagos, textoSolicitud, validarNit,
} from '../utils/caja';
import { htmlCierre, htmlCuenta, htmlFactura } from '../utils/recibo';
import { csvReporte, horasVisibles, rangoPeriodo, sinVentas } from '../utils/reportes';

const pedido = (id, mesa, estado, detalles, fecha = `2026-11-02T1${id}:00:00Z`) => ({
  id, mesaId: mesa * 10, mesaNumero: mesa, estado, fecha, meseroNombre: 'Cliente QR', detalles,
});
const plato = (platilloId, platilloNombre, precio, cantidad) => ({ platilloId, platilloNombre, precio, cantidad });

describe('cuentas por mesa', () => {
  const pedidos = [
    pedido(2, 4, 'Entregado', [plato(1, 'Hamburguesa', 25000, 1)]),
    pedido(1, 4, 'Listo', [plato(1, 'Hamburguesa', 25000, 2), plato(3, 'Limonada', 6000, 1)]),
    pedido(3, 4, 'EnProceso', [plato(3, 'Limonada', 6000, 2)]),
    pedido(4, 1, 'Entregado', [plato(3, 'Limonada', 6000, 1)]),
    pedido(5, 2, 'Pagado', [plato(3, 'Limonada', 6000, 1)]),
  ];

  test('una mesa con varios envíos del QR es una sola cuenta', () => {
    const [mesa1, mesa4] = agruparCuentas(pedidos);
    expect(mesa1.mesaNumero).toBe(1);
    expect(mesa4.pedidos.map((p) => p.id)).toEqual([1, 2, 3]);
    expect(mesa4.total).toBe(25000 * 3 + 6000 * 3);
  });

  test('lo que sigue en cocina no entra en lo cobrable', () => {
    const mesa4 = agruparCuentas(pedidos).find((c) => c.mesaNumero === 4);
    expect(mesa4.enCocina).toBe(1);
    expect(mesa4.totalCobrable).toBe(25000 * 3 + 6000);
    expect(cobrable({ estado: 'EnProceso' })).toBe(false);
  });

  test('las cuentas pagadas no aparecen', () => {
    expect(agruparCuentas(pedidos).some((c) => c.mesaNumero === 2)).toBe(false);
  });

  test('la mesa que pidió la cuenta desde la app va primero y lleva su solicitud', () => {
    const solicitud = { id: 3, mesaId: 40, metodoPago: null };
    const [primera, segunda] = agruparCuentas(pedidos, [solicitud]);
    expect(primera.mesaNumero).toBe(4);
    expect(primera.solicitud).toBe(solicitud);
    expect(segunda.solicitud).toBeNull();
    expect(textoSolicitud(solicitud)).toBe('Pidió la cuenta');
    expect(textoSolicitud({ metodoPago: 'Tarjeta' })).toBe('Pagó con tarjeta en el datáfono');
    expect(textoSolicitud(null)).toBeNull();
  });

  test('el mismo plato al mismo precio en varios pedidos va en una línea', () => {
    const lineas = lineasCuenta(pedidos.filter((p) => p.mesaNumero === 4));
    expect(lineas.find((l) => l.nombre === 'Hamburguesa')).toEqual({ nombre: 'Hamburguesa', precio: 25000, cantidad: 3, total: 75000 });
  });
});

describe('cobro', () => {
  test('la propina sugerida es el 10 % redondeado a centenas', () => {
    expect(propinaSugerida(87350)).toBe(8700);
    expect(propinaSugerida(0)).toBe(0);
  });

  test('los billetes sugeridos empiezan por el valor exacto', () => {
    expect(billetesSugeridos(43500)).toEqual([43500, 50000, 60000, 100000]);
    expect(billetesSugeridos(50000)).toEqual([50000, 60000, 100000]);
  });

  test('el cambio negativo es lo que falta', () => {
    expect(cambio('50000', 43500)).toBe(6500);
    expect(cambio('40000', 43500)).toBe(-3500);
  });

  test('la cédula o NIT acepta el dígito de verificación', () => {
    expect(validarNit('900123456-7')).toBe(true);
    expect(validarNit('')).toBe(true);
    expect(validarNit('12ab')).toBe(false);
  });
});

describe('cuentas compartidas', () => {
  const pedidos = [
    { id: 1, estado: 'Entregado', detalles: [{ id: 10, platilloNombre: 'Cerveza', precio: 8000, cantidad: 2 }, { id: 11, platilloNombre: 'Arepa', precio: 6000, cantidad: 1, pagado: true }] },
    { id: 2, estado: 'EnProceso', detalles: [{ id: 12, platilloNombre: 'Sopa', precio: 15000, cantidad: 1 }] },
  ];

  test('lo ya pagado de un pedido no se vuelve a cobrar ni se cuenta en la mesa', () => {
    expect(consumoPedido(pedidos[0])).toBe(16000);
    expect(lineasCuenta(pedidos).map((l) => l.nombre)).toEqual(['Cerveza', 'Sopa']);
    const [mesa] = agruparCuentas(pedidos.map((p) => ({ ...p, mesaId: 1, mesaNumero: 1, fecha: '2026-11-02T12:00:00Z' })));
    expect(mesa.pagadoParcial).toBe(true);
    expect(mesa.platos).toBe(3);
  });

  test('cada quien paga lo suyo: solo platos listos y las unidades que elija', () => {
    const platos = platosPorCobrar(pedidos);
    expect(platos).toEqual([{ detalleId: 10, pedidoId: 1, nombre: 'Cerveza', nota: undefined, precio: 8000, cantidad: 2 }]);
    expect(consumoElegido(platos, { 10: 1 })).toBe(8000);
    expect(consumoElegido(platos, { 10: 5 })).toBe(16000); // no cobra más de lo que queda
  });

  test('partes iguales redondea a centenas y la última cuadra el total', () => {
    expect(partesIguales(50000, 3)).toEqual([16700, 16700, 16600]);
    expect(partesIguales(90000, 2)).toEqual([45000, 45000]);
    expect(partesIguales(0, 3)).toEqual([]);
    expect(partesIguales(150, 2).reduce((a, b) => a + b, 0)).toBe(150);
  });

  test('el pago sin valor se lleva lo que falta; los demás quedan como se escribieron', () => {
    const montos = montosPagos([{ monto: '30000' }, { monto: '' }, { monto: '' }], 50000);
    expect(montos).toEqual([30000, 20000, 0]);
    expect(resumenPagos(montos, 50000)).toEqual({ pagado: 50000, falta: 0, sobra: 0 });
    expect(resumenPagos([60000], 50000).sobra).toBe(10000);
  });

  test('lo que avisó el mesero: pidió la cuenta, ya pagó todo o pagó una parte', () => {
    expect(estadoSolicitud({ pagos: [] })).toBe('pedida');
    expect(estadoSolicitud({ cuadra: true, pagos: [{ monto: 1 }] })).toBe('pagada');
    expect(estadoSolicitud({ cuadra: false, pagos: [{ monto: 1 }] })).toBe('parcial');
    expect(textoSolicitud({ cuadra: true, pagos: [{ monto: 1 }] })).toBe('Ya pagó: confirma el cobro');
    expect(textoSolicitud({ cuadra: false, pagos: [{ monto: 20000 }], totalAvisado: 20000, porCobrar: 50000, propina: 0 })).toMatch(/Pagó \$\s?20\.000 de \$\s?50\.000/);
  });
});

describe('arqueo de caja', () => {
  const cierre = { base: 100000, efectivoMesa: 250000, efectivoDomicilios: 28000, tarjeta: 80000, transferencias: 40000 };

  test('esperado = base + efectivo de mesa + efectivo de domiciliarios − propinas pagadas − retiros', () => {
    const a = arqueo(cierre, { propinasPagadas: '10000', retiros: '5000', contado: '' });
    expect(a.esperado).toBe(363000);
    expect(a.efectivo).toEqual({ diferencia: null, estado: 'sin-contar' });
  });

  test('dice si el cajón, el datáfono y el banco cuadran, sobran o faltan', () => {
    const a = arqueo(cierre, { contado: '377000', datafono: '80000', banco: '39000' });
    expect(a.efectivo).toEqual({ diferencia: -1000, estado: 'falta' });
    expect(a.tarjeta.estado).toBe('cuadra');
    expect(a.transferencias).toEqual({ diferencia: -1000, estado: 'falta' });
    expect(arqueo(cierre, { contado: '378500' }).efectivo.estado).toBe('sobra');
  });

  test('contar por billetes suma cada denominación', () => {
    expect(contarBilletes({ 50000: '2', 20000: '1', 500: '3' })).toBe(121500);
    expect(contarBilletes({ 10000: '-2', 2000: 'x' })).toBe(0);
  });
});

describe('tirillas', () => {
  const factura = {
    numeroFactura: 'FV-00000012', fechaEmision: '2026-11-02T18:00:00Z', mesaNumero: 4,
    nombreCliente: '<b>Ana</b>', nitCliente: '222222222222', metodoPago: 'Efectivo',
    subtotal: 54000, propina: 5400, total: 59400,
    items: [{ nombre: 'Hamburguesa', cantidad: 2, precioUnitario: 27000, total: 54000 }],
  };

  test('la factura lleva número, platos, impuesto incluido, propina y cambio', () => {
    const html = htmlFactura(factura, { recibido: 60000, cambio: 600 });
    expect(html).toContain('FV-00000012');
    expect(html).toContain('2 × Hamburguesa');
    expect(html).toContain('Impoconsumo (8%) incluido');
    expect(html).toContain('Propina voluntaria');
    expect(html).toContain('Cambio');
  });

  test('la cuenta de la mesa lleva los platos y el total, y aclara que no es factura', () => {
    const html = htmlCuenta({ mesaNumero: 4, total: 56000 }, [{ nombre: 'Hamburguesa', cantidad: 2, total: 50000 }, { nombre: 'Limonada', cantidad: 1, total: 6000 }]);
    expect(html).toContain('Mesa 4');
    expect(html).toContain('2 × Hamburguesa');
    expect(html).toMatch(/\$\s?56\.000/);
    expect(html).toContain('no es una factura');
  });

  test('el nombre del cliente se escapa: no inyecta HTML', () => {
    expect(htmlFactura(factura)).toContain('&lt;b&gt;Ana&lt;/b&gt;');
  });

  test('el cierre lleva el rango de facturas y el cuadre', () => {
    const html = htmlCierre({
      fecha: '2026-11-02', ventasMesa: 100000, propinas: 0, ventasDomicilio: 0, envios: 0, totalRecaudado: 100000,
      porMetodo: [{ metodo: 'Efectivo', total: 100000 }], cuentasMesa: 3, domicilios: 0,
      facturasEmitidas: 3, primeraFactura: 'FV-00000010', ultimaFactura: 'FV-00000012', pedidosAnulados: 0, valorAnulado: 0,
      efectivoMesa: 100000, efectivoDomicilios: 0,
    }, { base: 50000, esperado: 150000, contado: 149000, efectivo: { diferencia: -1000, estado: 'falta' } });
    expect(html).toContain('FV-00000010 a FV-00000012');
    expect(html).toContain('Efectivo del cajón');
    expect(html).toMatch(/Faltan \$\s?1\.000/);
  });
});

describe('reportes', () => {
  const hoy = new Date(2026, 0, 15); // 15 de enero

  test('los periodos se arman en días de calendario', () => {
    expect(rangoPeriodo('hoy', hoy)).toEqual({ desde: '2026-01-15', hasta: '2026-01-15' });
    expect(rangoPeriodo('7dias', hoy)).toEqual({ desde: '2026-01-09', hasta: '2026-01-15' });
    expect(rangoPeriodo('mesPasado', hoy)).toEqual({ desde: '2025-12-01', hasta: '2025-12-31' });
    expect(rangoPeriodo('ayer', new Date(2026, 2, 1))).toEqual({ desde: '2026-02-28', hasta: '2026-02-28' });
  });

  test('las horas pico muestran al menos de 11 a 22 y cualquier hora con ventas', () => {
    const horas = Array.from({ length: 24 }, (_, h) => ({ hora: h, total: h === 7 ? 1000 : 0 }));
    const visibles = horasVisibles(horas).map((h) => h.hora);
    expect(visibles[0]).toBe(7);
    expect(visibles.at(-1)).toBe(22);
  });

  test('los platillos activos sin ventas se listan para revisar la carta', () => {
    const carta = [{ id: 1, nombre: 'Sopa' }, { id: 2, nombre: 'Arepa' }, { id: 3, nombre: 'Oculto', activo: false }];
    expect(sinVentas(carta, [{ platilloId: 1 }])).toEqual(['Arepa']);
  });

  test('el CSV usa punto y coma para Excel en español', () => {
    const csv = csvReporte({
      desde: '2026-11-01', hasta: '2026-11-02', ventas: 1, propinas: 0, envios: 0, numeroVentas: 1, ticketPromedio: 1,
      pedidosAnulados: 0, valorAnulado: 0, porDia: [], porMetodo: [], platillos: [{ nombre: 'Sopa "del día"', categoria: 'Sopas', cantidad: 1, ingresos: 1 }], meseros: [],
    });
    expect(csv).toContain('"Sopa ""del día""";"Sopas";"1";"1"');
  });
});
