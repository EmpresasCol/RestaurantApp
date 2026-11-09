// Regla de prioridad del KDS: espera + volumen de la comanda.
import { ordenarPorPrioridad, prioridadComanda, separarListos, transformarDomicilios } from '../utils/kds';

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

test('los domicilios en cocina y los listos llegan a cocina; los que salieron no', () => {
  const datos = [
    { id: 1, estado: 'EnPreparacion', cocinaEmpezo: false, fechaPedido: ahora.toISOString(), detalles: [{ id: 9, platilloNombre: 'X', cantidad: 2 }] },
    { id: 2, estado: 'Listo', cocinaEmpezo: true, domiciliarioNombre: 'Juan', fechaPedido: ahora.toISOString(), detalles: [] },
    { id: 3, estado: 'EnCamino', fechaPedido: ahora.toISOString(), detalles: [] },
  ];
  const r = transformarDomicilios(datos);
  expect(r.map((d) => d.id)).toEqual(['D1', 'D2']);
  expect(r[0]).toMatchObject({ tipo: 'domicilio', empezado: false, items: [{ cantidad: 2, notas: '' }] });
  expect(r[1]).toMatchObject({ estado: 'Listo', empezado: true, domiciliario: 'Juan' });
});

test('lo listo se aparta de lo que se está preparando', () => {
  const { enCocina, listos } = separarListos([comanda('a', 5, 1), comanda('b', 9, 1, 'Listo'), comanda('c', 20, 1, 'Listo')]);
  expect(enCocina.map((p) => p.id)).toEqual(['a']);
  expect(listos.map((p) => p.id)).toEqual(['c', 'b']);
});
