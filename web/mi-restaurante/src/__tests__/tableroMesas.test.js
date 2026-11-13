// Tablero de mesas de caja y administración con la API simulada.
import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import * as api from '../services/api';
import * as domiciliosApi from '../services/domiciliosApi';
import Facturacion from '../Facturacion';
import { estadoTablero } from '../utils/caja';

jest.mock('../services/api');
jest.mock('../services/domiciliosApi');
jest.mock('../services/realtime', () => ({ useCambios: () => {} }));

const plato = (id, platilloNombre, precio, cantidad, extra = {}) => ({ id, platilloId: id, platilloNombre, precio, cantidad, ...extra });
const pedido = (id, estado, detalles, mesaId) => ({
  id, mesaId, mesaNumero: mesaId, estado, fecha: `2026-11-13T1${id}:00:00Z`, meseroNombre: 'Cliente QR', detalles,
});
const mesas = [
  { id: 1, numero: 1, estado: 'Disponible' },
  { id: 2, numero: 2, estado: 'Ocupada', pinSeguimiento: '482913' },
  { id: 3, numero: 3, estado: 'EsperandoPago' },
  { id: 4, numero: 4, estado: 'Ocupada' },
];

beforeEach(() => {
  jest.clearAllMocks();
  window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
  domiciliosApi.getDomiciliosActivos.mockResolvedValue([]);
  domiciliosApi.getLiquidaciones.mockResolvedValue([]);
  api.getSolicitudesCuenta.mockResolvedValue([{ id: 7, mesaId: 3, mesaNumero: 3, pagos: [], porCobrar: 30000 }]);
  api.getMesas.mockResolvedValue(mesas);
  api.getLlamadas.mockResolvedValue([{ id: 9, mesaId: 2, mesaNumero: 2, fecha: '2026-11-13T20:00:00Z', estado: 'Pendiente' }]);
  api.getPedidosActivos.mockResolvedValue([
    pedido(1, 'Listo', [plato(1, 'Bandeja', 20000, 2, { nota: 'Sin cebolla' })], 2),
    pedido(2, 'EnProceso', [plato(2, 'Jugo', 5000, 1)], 2),
    pedido(3, 'Entregado', [plato(3, 'Sopa', 30000, 1)], 3),
  ]);
});

const abrirTablero = async () => {
  render(<Facturacion />);
  fireEvent.click(screen.getByRole('button', { name: 'Mesas' }));
  return screen.findByRole('button', { name: /Mesa 2: Ocupada/ });
};

describe('estadoTablero', () => {
  test('lo abierto manda: una mesa con pedidos nunca se ve libre ni se libera', () => {
    const cuenta = { pedidos: [{ estado: 'Listo' }], solicitud: null };
    expect(estadoTablero({ estado: 'Disponible' }, cuenta)).toMatchObject({ estado: 'ocupada', listos: 1, puedeLiberar: false });
    expect(estadoTablero({ estado: 'Ocupada' }, { ...cuenta, solicitud: { id: 1 } }).estado).toBe('pago');
    expect(estadoTablero({ estado: 'EsperandoPago' }, null)).toMatchObject({ estado: 'pago', puedeLiberar: true });
    expect(estadoTablero({ estado: 'Disponible' }, null)).toMatchObject({ estado: 'libre', puedeLiberar: false });
  });
});

describe('Tablero de mesas', () => {
  test('cada mesa muestra su estado con texto e indicadores aparte', async () => {
    await abrirTablero();
    expect(screen.getByRole('button', { name: 'Mesa 1: Libre' })).toBeInTheDocument();
    const mesa2 = screen.getByRole('button', { name: /Mesa 2: Ocupada, llama al mesero, 1 para servir/ });
    expect(within(mesa2).getByText('Llama')).toBeInTheDocument();
    expect(within(mesa2).getByText(/\$\s?45\.000/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mesa 3: Esperando pago/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mesa 4: Ocupada/ })).toHaveTextContent('Sin pedidos abiertos');
    expect(screen.getByRole('button', { name: /Esperando pago 1/ })).toBeInTheDocument();
  });

  test('el detalle trae pedidos, notas, la llamada y cobra con el panel de la caja', async () => {
    api.atenderLlamada.mockResolvedValue({});
    (await abrirTablero()).click();
    const panel = await screen.findByRole('dialog', { name: 'Mesa 2' });
    expect(within(panel).getByText('Sin cebolla')).toBeInTheDocument();
    expect(within(panel).getByText('482913')).toBeInTheDocument();
    expect(within(panel).getByText(/Esperando mesero/)).toBeInTheDocument();

    await act(async () => { fireEvent.click(within(panel).getByRole('button', { name: 'Marcar atendida' })); });
    expect(api.atenderLlamada).toHaveBeenCalledWith(9);
    expect(api.getLlamadas.mock.calls.length).toBeGreaterThan(1);

    // Lo que sigue en cocina no se cobra todavía: 40.000 de 45.000.
    fireEvent.click(within(panel).getByRole('button', { name: /Cobrar \$\s?40\.000/ }));
    expect(await screen.findByRole('dialog', { name: 'Cobrar mesa 2' })).toBeInTheDocument();
  });

  test('una mesa sin pedidos se libera con doble toque; si la API se niega, muestra el motivo', async () => {
    api.liberarMesa.mockRejectedValue(new Error('La mesa 4 tiene 1 pedido(s) abierto(s) por 9.000 pesos. Cóbralos o cancélalos antes de liberarla.'));
    await abrirTablero();
    fireEvent.click(screen.getByRole('button', { name: /Mesa 4: Ocupada/ }));
    const panel = await screen.findByRole('dialog', { name: 'Mesa 4' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Liberar mesa' }));
    expect(api.liberarMesa).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(within(panel).getByRole('button', { name: /otra vez/ })); });
    expect(api.liberarMesa).toHaveBeenCalledWith(4);
    expect(await screen.findByText(/Cóbralos o cancélalos/)).toBeInTheDocument();
  });

  test('la mesa con consumo no ofrece liberar', async () => {
    (await abrirTablero()).click();
    const panel = await screen.findByRole('dialog', { name: 'Mesa 2' });
    expect(within(panel).queryByRole('button', { name: 'Liberar mesa' })).toBeNull();
  });

  test('si no cargan las mesas lo dice y deja reintentar', async () => {
    api.getMesas.mockRejectedValueOnce(new Error('Failed to fetch'));
    render(<Facturacion />);
    fireEvent.click(screen.getByRole('button', { name: 'Mesas' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar las mesas');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Reintentar' })); });
    expect(await screen.findByRole('button', { name: 'Mesa 1: Libre' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
