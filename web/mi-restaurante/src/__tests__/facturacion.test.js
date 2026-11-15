// Facturación electrónica en la web: estado ante la DIAN, datos del cliente, impuesto y tirilla.
import { digitoVerificacion, documentoVenta, errorCliente, estadoDian, numeracionDe, tituloDocumento } from '../utils/facturacion';
import { etiquetaImpuesto, impuestoFactura, impuestoIncluido } from '../utils/impuestos';
import { htmlFactura } from '../utils/recibo';
import { csvFacturas } from '../components/caja/FacturasDia';

const doc = (cambios = {}) => ({ id: 1, tipo: 'POS', numero: 'POS1001', estado: 'Pendiente', enContingencia: false, cufe: null, mensaje: null, qrUrl: null, ...cambios });

const factura = (cambios = {}) => ({
  id: 7, numeroFactura: 'POS1001', fechaEmision: '2026-11-14T18:00:00Z', mesaNumero: 4,
  nombreCliente: 'Consumidor final', nitCliente: '222222222222',
  subtotal: 50000, propina: 5000, total: 55000,
  nombreImpuesto: 'Impoconsumo', tarifaImpuesto: 8, baseImpuesto: 46296.3, valorImpuesto: 3703.7,
  items: [{ nombre: 'Hamburguesa', cantidad: 2, precioUnitario: 25000, total: 50000 }],
  pagos: [{ metodoPago: 'Efectivo', monto: 55000 }], metodoPago: 'Efectivo', pedidoIds: [1],
  documentos: [doc()],
  ...cambios,
});

const fiscal = {
  config: { razonSocial: 'Restaurante de Prueba SAS', nombreComercial: 'La Fonda', nit: '900123456', digitoVerificacion: '8', direccion: 'Calle 1 # 2-3', municipio: 'Sincelejo', regimen: 'Responsable del impuesto al consumo', tipoImpuesto: 'INC', tarifaImpuesto: 8 },
  numeraciones: [{ tipoDocumento: 'POS', prefijo: 'POS', desde: 1001, hasta: 2000, resolucion: '18760000001', fechaHasta: '2027-11-01T00:00:00' }],
};

describe('estado ante la DIAN', () => {
  test('una factura anterior a la facturación electrónica no muestra estado', () => {
    expect(estadoDian(factura({ documentos: [] }))).toBeNull();
    expect(tituloDocumento(factura({ documentos: [] }))).toBe('Factura de venta');
  });

  test('en validación, sin respuesta, validada y rechazada con su motivo', () => {
    expect(estadoDian(factura()).texto).toBe('En validación');
    expect(estadoDian(factura({ documentos: [doc({ enContingencia: true, mensaje: 'Sin respuesta del proveedor' })] })))
      .toMatchObject({ tono: 'aviso', detalle: 'Sin respuesta del proveedor' });
    expect(estadoDian(factura({ documentos: [doc({ estado: 'Validado', cufe: 'abc' })] }))).toMatchObject({ texto: 'Validada por la DIAN', tono: 'ok' });
    expect(estadoDian(factura({ documentos: [doc({ estado: 'Rechazado', mensaje: 'Regla FAJ43' })] }))).toMatchObject({ tono: 'peligro', detalle: 'Regla FAJ43' });
  });

  test('una anulada dice si su nota sigue en proceso', () => {
    const anulada = { anulada: true, motivoAnulacion: 'Mesa equivocada' };
    const nota = (estado) => ({ ...doc({ estado }), id: 2, tipo: 'NotaAjuste', numero: 'NA1' });
    expect(estadoDian(factura({ ...anulada, documentos: [doc({ estado: 'Validado' }), nota('Pendiente')] })).texto).toBe('Anulada · nota en proceso');
    expect(estadoDian(factura({ ...anulada, documentos: [doc({ estado: 'Validado' }), nota('Validado')] }))).toMatchObject({ texto: 'Anulada', detalle: 'Mesa equivocada' });
    expect(documentoVenta(factura({ documentos: [nota('Validado'), doc()] })).tipo).toBe('POS');
  });
});

describe('datos de quien pide factura a su nombre', () => {
  test('dígito de verificación del NIT', () => {
    expect(digitoVerificacion('900123456')).toBe(8);
    expect(digitoVerificacion('800197268')).toBe(4);
  });

  test.each([
    [{ tipoId: 'CC', nit: '', nombre: 'Ana' }, /identificación/],
    [{ tipoId: 'CC', nit: '12ab5', nombre: 'Ana' }, /solo lleva números/],
    [{ tipoId: 'NIT', nit: '900123456-7', nombre: 'Empresa' }, /dígito de verificación/],
    [{ tipoId: 'CC', nit: '1102345678', nombre: ' ' }, /nombre/],
    [{ tipoId: 'CC', nit: '1102345678', nombre: 'Ana', correo: 'sin-arroba' }, /correo/],
    [{ tipoId: 'PA', nit: 'AB 123', nombre: 'John' }, /letras y números/],
  ])('rechaza %j', (cliente, mensaje) => expect(errorCliente(cliente)).toMatch(mensaje));

  test.each([
    [{ tipoId: 'NIT', nit: '900123456-8', nombre: 'Empresa SAS', correo: 'compras@empresa.co' }],
    [{ tipoId: 'CC', nit: '1102345678', nombre: 'Ana' }],
    [{ tipoId: 'PA', nit: 'AB123456', nombre: 'John' }],
  ])('acepta %j', (cliente) => expect(errorCliente(cliente)).toBeNull());
});

describe('impuesto', () => {
  test('la factura usa lo que guardó la API; las anteriores, el 8 % de respaldo', () => {
    expect(impuestoFactura(factura())).toEqual({ etiqueta: 'Impoconsumo (8%) incluido', valor: 3703.7, base: 46296.3 });
    expect(impuestoFactura({ subtotal: 54000 })).toEqual({ etiqueta: 'Impoconsumo (8%) incluido', valor: 4000, base: 50000 });
    expect(impuestoFactura(factura({ nombreImpuesto: null, tarifaImpuesto: 0, baseImpuesto: 50000, valorImpuesto: 0 })).etiqueta).toMatch(/Sin impuesto/);
  });

  test('antes de cobrar se calcula con los datos fiscales del restaurante', () => {
    expect(etiquetaImpuesto({ tipoImpuesto: 'IVA', tarifaImpuesto: 19 })).toBe('IVA (19%) incluido');
    expect(impuestoIncluido(119000, { tipoImpuesto: 'IVA', tarifaImpuesto: 19 })).toBe(19000);
    expect(impuestoIncluido(50000, { tipoImpuesto: 'Ninguno', tarifaImpuesto: 0 })).toBe(0);
    expect(impuestoIncluido(54000)).toBe(4000);
  });
});

describe('tirilla', () => {
  test('lleva al vendedor, la resolución y avisa que el documento sigue en validación', () => {
    const html = htmlFactura(factura(), {}, fiscal);
    expect(html).toContain('La Fonda');
    expect(html).toContain('Restaurante de Prueba SAS');
    expect(html).toContain('NIT 900123456-8');
    expect(html).toContain('Documento equivalente electrónico tiquete POS');
    expect(html).toContain('resolución DIAN 18760000001: POS1001 a POS2000, vigente hasta 01/11/2027');
    expect(html).toContain('en proceso de validación ante la DIAN');
    expect(html).toContain('Base gravable');
    expect(html).toContain('Propina voluntaria');
    expect(html).not.toContain('CUDE');
  });

  test('validada: CUDE y código QR de consulta', () => {
    const html = htmlFactura(factura({ documentos: [doc({ estado: 'Validado', cufe: 'a1b2c3', qrUrl: 'https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=a1b2c3' })] }), {}, fiscal);
    expect(html).toContain('CUDE:</strong> a1b2c3');
    expect(html).toContain('<svg');
    expect(html).not.toContain('en proceso de validación');
  });

  test('factura a nombre: tipo de identificación, correo y CUFE; anulada lo dice', () => {
    const f = factura({
      numeroFactura: 'FE1', tipoIdCliente: 'NIT', nitCliente: '900123456-8', nombreCliente: 'Empresa <SAS>', correoCliente: 'compras@empresa.co',
      anulada: true, motivoAnulacion: 'Datos errados', documentos: [doc({ tipo: 'FEV', numero: 'FE1', estado: 'Validado', cufe: 'ff00' })],
    });
    const html = htmlFactura(f, {}, fiscal);
    expect(html).toContain('Factura electrónica de venta');
    expect(html).toContain('NIT: 900123456-8');
    expect(html).toContain('Empresa &lt;SAS&gt;');
    expect(html).toContain('compras@empresa.co');
    expect(html).toContain('CUFE:</strong> ff00');
    expect(html).toContain('ANULADA');
  });

  test('sin datos fiscales sale la tirilla de antes', () => {
    const html = htmlFactura(factura({ documentos: [] }));
    expect(html).toContain('<h1>Qpro</h1>');
    expect(html).toContain('Factura de venta');
  });

  test('la numeración se busca por tipo, prefijo y rango', () => {
    expect(numeracionDe(factura(), fiscal.numeraciones).resolucion).toBe('18760000001');
    expect(numeracionDe(factura({ documentos: [doc({ numero: 'POS2001' })] }), fiscal.numeraciones)).toBeNull();
  });
});

test('el CSV para el contador trae base, impuesto, estado DIAN y código', () => {
  const [cabecera, fila] = csvFacturas([factura({ documentos: [doc({ estado: 'Validado', cufe: 'a1b2c3' })] })]).split('\n');
  expect(cabecera).toContain('Base gravable;Impuesto incluido;Propina;Total;Estado DIAN;CUFE/CUDE');
  expect(fila).toContain('"46296.3";"3703.7";"5000";"55000";"Validada por la DIAN";"a1b2c3"');
});
