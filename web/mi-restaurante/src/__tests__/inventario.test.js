import {
  enlaceWhatsApp, nivelVencimiento, paquetesPara, signoMovimiento, telefonoWhatsApp, textoCobertura, textoPedidoProveedor, textoVencimiento,
} from '../utils/inventario';

describe('vencimientos', () => {
  test('texto y gravedad según los días que faltan', () => {
    expect(textoVencimiento(-3)).toBe('Venció hace 3 días');
    expect(textoVencimiento(-1)).toBe('Venció ayer');
    expect(textoVencimiento(0)).toBe('Vence hoy');
    expect(textoVencimiento(1)).toBe('Vence mañana');
    expect(textoVencimiento(5)).toBe('Vence en 5 días');
    expect(nivelVencimiento(-1)).toBe('vencido');
    expect(nivelVencimiento(2)).toBe('pronto');
    expect(nivelVencimiento(6)).toBe('aviso');
    expect(nivelVencimiento(20)).toBe('normal');
    expect(nivelVencimiento(null)).toBe('normal');
  });
});

describe('cobertura', () => {
  test('días que alcanza el stock', () => {
    expect(textoCobertura(null)).toBe('Sin ventas recientes');
    expect(textoCobertura(0.4)).toBe('Alcanza para menos de un día');
    expect(textoCobertura(1.9)).toBe('Alcanza para 1 día');
    expect(textoCobertura(12.3)).toBe('Alcanza para 12 días');
  });
});

describe('pedido por WhatsApp', () => {
  test('número colombiano de 10 dígitos lleva indicativo 57', () => {
    expect(telefonoWhatsApp('300 111 2233')).toBe('573001112233');
    expect(telefonoWhatsApp('+57 300-111-2233')).toBe('573001112233');
    expect(telefonoWhatsApp('')).toBeNull();
  });

  test('el mensaje usa la presentación de compra cuando la hay', () => {
    const texto = textoPedidoProveedor({
      numeroOrden: 'OC-00001',
      proveedor: 'Carnes del Sinú',
      lineas: [
        { insumo: 'Carne de res', presentacion: 'Caja 10 kg', paquetes: 3 },
        { insumo: 'Sal', cantidad: 2, unidad: 'Kg' },
      ],
    });
    expect(texto).toContain('Pedido OC-00001');
    expect(texto).toContain('3 × Caja 10 kg (Carne de res)');
    expect(texto).toContain('2 Kg de Sal');
  });

  test('sin teléfono el enlace deja elegir el contacto', () => {
    expect(enlaceWhatsApp(null, 'hola')).toBe('https://wa.me/?text=hola');
    expect(enlaceWhatsApp('3001112233', 'a b')).toBe('https://wa.me/573001112233?text=a%20b');
  });
});

test('paquetes completos que cubren una cantidad', () => {
  expect(paquetesPara(42, 10)).toBe(5);
  expect(paquetesPara(40, 10)).toBe(4);
  expect(paquetesPara(5, 0)).toBe(0);
});

test('signo del movimiento en el kárdex', () => {
  expect(signoMovimiento({ tipoMovimiento: 'Entrada' })).toBe('+');
  expect(signoMovimiento({ tipoMovimiento: 'Merma' })).toBe('−');
  expect(signoMovimiento({ tipoMovimiento: 'Ajuste' })).toBe('±');
  expect(signoMovimiento({ tipoMovimiento: 'Transferencia', motivo: 'Traslado a Bar' })).toBe('−');
  expect(signoMovimiento({ tipoMovimiento: 'Transferencia', motivo: 'Traslado desde Bodega' })).toBe('+');
});
