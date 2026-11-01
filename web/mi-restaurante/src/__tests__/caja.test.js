import {
  agruparCuentas, billetesSugeridos, cambio, cobrable, cuadreEfectivo, lineasCuenta, propinaSugerida, textoSolicitud, validarNit,
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

describe('cuadre de efectivo', () => {
  test('esperado = base + efectivo cobrado', () => {
    expect(cuadreEfectivo({ base: '100000', efectivo: 250000, contado: '' })).toEqual({ esperado: 350000, diferencia: null, estado: 'sin-contar' });
  });

  test('dice si cuadra, sobra o falta', () => {
    expect(cuadreEfectivo({ base: 0, efectivo: 1000, contado: '1000' }).estado).toBe('cuadra');
    expect(cuadreEfectivo({ base: 0, efectivo: 1000, contado: '1500' }).estado).toBe('sobra');
    expect(cuadreEfectivo({ base: 0, efectivo: 1000, contado: '700' })).toMatchObject({ estado: 'falta', diferencia: -300 });
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
    }, { base: 50000, esperado: 150000, contado: 149000, diferencia: -1000 });
    expect(html).toContain('FV-00000010 a FV-00000012');
    expect(html).toContain('Cuadre de efectivo');
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
