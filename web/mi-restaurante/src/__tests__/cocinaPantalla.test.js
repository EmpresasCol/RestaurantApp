// Cocina: empezar un pedido (desde ahí el mesero ya no lo cambia) y luego marcarlo listo.
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as api from '../services/api';
import * as domiciliosApi from '../services/domiciliosApi';
import CocinaView from '../CocinaView';

jest.mock('../services/api');
jest.mock('../services/domiciliosApi');
jest.mock('../services/realtime', () => ({ useCambios: () => {} }));
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ usuario: { nombre: 'Cocina' }, logout: jest.fn() }) }));

const comanda = (empezado) => ({
  id: 7, mesa: 3, estado: 'EnProceso', empezado, hora: new Date(), items: [{ id: 1, nombre: 'Hamburguesa', cantidad: 2, notas: '' }],
});

beforeEach(() => {
  jest.clearAllMocks();
  domiciliosApi.getDomiciliosActivos.mockResolvedValue([]);
  api.prepararPedido.mockResolvedValue();
  api.actualizarEstadoPedido.mockResolvedValue({});
});

test('un pedido sin empezar se empieza con un toque', async () => {
  const recargar = jest.fn();
  render(<CocinaView pedidos={[comanda(false)]} onActualizarPedidos={recargar} />);

  fireEvent.click(screen.getByRole('button', { name: 'Empezar a preparar la orden 7' }));

  await waitFor(() => expect(api.prepararPedido).toHaveBeenCalledWith(7));
  expect(recargar).toHaveBeenCalled();
  expect(api.actualizarEstadoPedido).not.toHaveBeenCalled();
});

test('un pedido empezado se marca listo con dos toques', async () => {
  render(<CocinaView pedidos={[comanda(true)]} onActualizarPedidos={jest.fn()} />);

  fireEvent.click(screen.getByRole('button', { name: 'Marcar orden 7 como listo' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar orden 7 como listo' }));

  await waitFor(() => expect(api.actualizarEstadoPedido).toHaveBeenCalledWith(7, 'Listo'));
  expect(api.prepararPedido).not.toHaveBeenCalled();
});
