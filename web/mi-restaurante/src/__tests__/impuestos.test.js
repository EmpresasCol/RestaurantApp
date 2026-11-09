import { impuestoIncluido, etiquetaImpuesto } from '../utils/impuestos';

test('el impuesto se desglosa del precio, no se suma', () => {
  // 54.000 con impoconsumo 8 % incluido = 50.000 de base + 4.000 de impuesto
  expect(impuestoIncluido(54000)).toBe(4000);
});

test('la etiqueta deja claro que el impuesto está incluido', () => {
  expect(etiquetaImpuesto()).toBe('Impoconsumo (8%) incluido');
});
