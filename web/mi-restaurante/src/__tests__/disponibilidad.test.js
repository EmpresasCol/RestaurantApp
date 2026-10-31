import { agotado, topePorciones } from '../components/menu/MenuQR';

describe('disponibilidad de platillos en la carta', () => {
  test('sin ingredientes el platillo está agotado y no se puede pedir', () => {
    const p = { id: 1, disponible: false, porcionesDisponibles: 0 };
    expect(agotado(p)).toBe(true);
    expect(topePorciones(p)).toBe(0);
  });

  test('con stock se puede pedir hasta las porciones que alcanzan', () => {
    expect(topePorciones({ disponible: true, porcionesDisponibles: 3 })).toBe(3);
  });

  test('sin control de inventario (null) o API antigua usa el máximo por plato', () => {
    expect(topePorciones({ disponible: true, porcionesDisponibles: null })).toBe(50);
    expect(topePorciones({ id: 1 })).toBe(50);
    expect(agotado({ id: 1 })).toBe(false);
  });

  test('nunca supera el máximo por plato', () => {
    expect(topePorciones({ disponible: true, porcionesDisponibles: 999 })).toBe(50);
  });
});
