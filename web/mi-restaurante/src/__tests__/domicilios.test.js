// Domicilios: etapas reales, cambio que lleva el domiciliario, y la pantalla con la API simulada.
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import * as domiciliosApi from '../services/domiciliosApi';
import Domicilios from '../Domicilios';
import { cambioDomicilio, cargaDomiciliarios, etapaDomicilio, reasignable, telefonoValido, totalDomicilio } from '../utils/domicilios';
import { htmlDomicilio } from '../utils/recibo';

jest.mock('../services/domiciliosApi');
jest.mock('../services/realtime', () => ({ useCambios: () => {} }));

describe('reglas', () => {
  test('la etapa sigue el camino real del pedido', () => {
    expect(etapaDomicilio({ estado: 'EnPreparacion', cocinaEmpezo: false })).toBe('recibido');
    expect(etapaDomicilio({ estado: 'EnPreparacion', cocinaEmpezo: true })).toBe('cocina');
    expect(etapaDomicilio({ estado: 'Listo' })).toBe('listo');
    expect(etapaDomicilio({ estado: 'Recogido' })).toBe('camino');
    expect(etapaDomicilio({ estado: 'Entregado' })).toBe('entregado');
    expect(reasignable({ estado: 'EnCamino' })).toBe(false);
    expect(reasignable({ estado: 'Listo' })).toBe(true);
  });

  test('el cambio sale del billete del cliente y no aplica si no alcanza', () => {
    expect(cambioDomicilio(28000, '50000')).toBe(22000);
    expect(cambioDomicilio(28000, '20000')).toBeNull();
    expect(cambioDomicilio(28000, '')).toBeNull();
    expect(totalDomicilio([{ precio: 25000, cantidad: 2 }], 3000)).toBe(53000);
  });

  test('teléfono colombiano de 10 dígitos', () => {
    expect(telefonoValido('300 123 4567')).toBe(true);
    expect(telefonoValido('6017654321')).toBe(true);
    expect(telefonoValido('12345')).toBe(false);
  });

  test('cada domiciliario muestra cuántos domicilios lleva en curso', () => {
    const carga = cargaDomiciliarios([{ id: 3, nombre: 'Pedro' }], [
      { domiciliarioId: 3, estado: 'EnCamino' }, { domiciliarioId: 3, estado: 'Entregado' },
    ]);
    expect(carga).toEqual([{ id: 3, nombre: 'Pedro', enCurso: 1 }]);
  });

  test('la comanda de la bolsa dice cuánto cobrar y el cambio', () => {
    const html = htmlDomicilio({
      id: 8, clienteNombre: 'Laura', clienteTelefono: '3001234567', direccionCompleta: 'Cra 1 # 2-3', fechaPedido: '2026-11-02T18:00:00Z',
      detalles: [{ cantidad: 1, platilloNombre: 'Hamburguesa', subtotal: 25000 }], subtotal: 25000, costoEnvio: 3000, total: 28000,
      metodoPago: 'Efectivo', pagaCon: 50000, cambio: 22000,
    });
    expect(html).toContain('Domicilio #8');
    expect(html).toMatch(/Llevar cambio.*\$\s?22\.000/s);
  });
});

describe('pantalla', () => {
  const domicilio = (id, estado, extra = {}) => ({
    id, estado, cocinaEmpezo: estado !== 'EnPreparacion', fechaPedido: new Date().toISOString(), clienteNombre: `Cliente ${id}`,
    clienteTelefono: '3001234567', direccionCompleta: 'Cra 1 # 2-3', barrio: 'Centro', detalles: [{ id: 1, platilloNombre: 'Hamburguesa', cantidad: 1, subtotal: 25000 }],
    subtotal: 25000, costoEnvio: 3000, total: 28000, metodoPago: 'Efectivo', pagadoAnticipado: false, domiciliarioId: null, ...extra,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    domiciliosApi.getDomiciliarios.mockResolvedValue([{ id: 3, nombre: 'Pedro' }]);
    domiciliosApi.getEstadisticasDomicilios.mockResolvedValue({ totalDomicilios: 3, totalVentas: 28000, efectivoPorLiquidar: 28000 });
    domiciliosApi.asignarDomiciliario.mockResolvedValue(null);
    domiciliosApi.actualizarEstadoDomicilio.mockResolvedValue(null);
  });

  test('cada domicilio va en la columna de su etapa', async () => {
    domiciliosApi.getDomiciliosHoy.mockResolvedValue([domicilio(1, 'EnPreparacion'), domicilio(2, 'Listo'), domicilio(3, 'EnCamino', { domiciliarioNombre: 'Pedro' })]);
    render(<Domicilios onNuevoDomicilio={jest.fn()} />);

    const recibidos = await screen.findByRole('region', { name: 'Recibidos' });
    expect(within(recibidos).getByText('Cliente 1')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Listos para salir' })).getByText('Cliente 2')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'En camino' })).getByText('Cliente 3')).toBeInTheDocument();
  });

  test('desde el detalle se asigna el domiciliario y se cancela con motivo', async () => {
    domiciliosApi.getDomiciliosHoy.mockResolvedValue([domicilio(2, 'Listo')]);
    render(<Domicilios onNuevoDomicilio={jest.fn()} />);

    fireEvent.click(await screen.findByText('Cliente 2'));
    const panel = await screen.findByRole('dialog');
    fireEvent.change(within(panel).getByLabelText('Domiciliario'), { target: { value: '3' } });
    await waitFor(() => expect(domiciliosApi.asignarDomiciliario).toHaveBeenCalledWith(2, 3));

    const cancelar = within(panel).getByRole('button', { name: 'Cancelar domicilio' });
    expect(cancelar).toBeDisabled();
    fireEvent.change(within(panel).getByLabelText('Motivo'), { target: { value: 'No contestó' } });
    fireEvent.click(cancelar);
    fireEvent.click(within(panel).getByRole('button', { name: 'Toca otra vez para cancelar' }));
    await waitFor(() => expect(domiciliosApi.actualizarEstadoDomicilio).toHaveBeenCalledWith(2, 'Cancelado', { motivo: 'No contestó' }));
  });
});
