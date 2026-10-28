// Regla de prioridad del KDS: espera + volumen de la comanda.
import { ordenarPorPrioridad, prioridadComanda, transformarDomicilios } from '../utils/kds';

const ahora = new Date('2026-10-28T12:00:00Z');
const hace = (min) => new Date(ahora.getTime() - min * 60000);
const comanda = (id, minutos, platos, estado = 'EnProceso') => ({
  id,
  hora: hace(minutos),
  estado,
  items: [{ cantidad: platos }],
});

test('la prioridad suma minutos de espera y platos', () => {
  expect(prioridadComanda(comanda(1, 10, 3), ahora)).toBe(13);
});

test('una comanda grande recién llegada pasa delante de una pequeña reciente', () => {
  const orden = ordenarPorPrioridad([comanda('chica', 3, 1), comanda('grande', 2, 8)], ahora);
  expect(orden.map((p) => p.id)).toEqual(['grande', 'chica']);
});

test('la espera evita que una comanda pequeña quede relegada', () => {
  const orden = ordenarPorPrioridad([comanda('grande', 1, 6), comanda('chica', 20, 1)], ahora);
  expect(orden.map((p) => p.id)).toEqual(['chica', 'grande']);
});

test('a igual prioridad gana la más antigua y las Listo van al final', () => {
  const orden = ordenarPorPrioridad(
    [comanda('lista', 30, 5, 'Listo'), comanda('b', 4, 2), comanda('a', 5, 1)],
    ahora
  );
  expect(orden.map((p) => p.id)).toEqual(['a', 'b', 'lista']);
});

test('solo los domicilios en preparación llegan a cocina', () => {
  const datos = [
    { id: 1, estado: 'EnPreparacion', fechaPedido: ahora.toISOString(), detalles: [{ id: 9, platilloNombre: 'X', cantidad: 2 }] },
    { id: 2, estado: 'Listo', fechaPedido: ahora.toISOString(), detalles: [] },
  ];
  const r = transformarDomicilios(datos);
  expect(r).toHaveLength(1);
  expect(r[0]).toMatchObject({ id: 'D1', tipo: 'domicilio', items: [{ cantidad: 2, notas: '' }] });
});
