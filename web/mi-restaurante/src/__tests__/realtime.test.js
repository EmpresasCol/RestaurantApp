import { render } from '@testing-library/react';

const mockHandlers = {};
let mockAlReconectar;
const mockConexion = {
  state: 'Disconnected',
  on: (evento, fn) => { mockHandlers[evento] = fn; },
  onreconnected: (fn) => { mockAlReconectar = fn; },
  inicios: 0,
  start() { this.inicios += 1; return Promise.resolve(); },
  stop() {},
};

jest.mock('@microsoft/signalr', () => ({
  // Clase plana: CRA activa resetMocks y borraría la implementación de un jest.fn.
  HubConnectionBuilder: class {
    withUrl() { return this; }
    withAutomaticReconnect() { return this; }
    configureLogging() { return this; }
    build() { return mockConexion; }
  },
  HubConnectionState: { Disconnected: 'Disconnected' },
  LogLevel: { Warning: 3 },
}));

const { useCambios } = require('../services/realtime');

function Pantalla({ tema, recargar }) {
  useCambios(tema, recargar);
  return null;
}

describe('useCambios', () => {
  beforeEach(() => localStorage.setItem('token', 'jwt'));
  afterEach(() => localStorage.clear());

  test('recarga solo con su tema y deja de escuchar al desmontar', () => {
    const recargar = jest.fn();
    const { unmount } = render(<Pantalla tema="pedidos" recargar={recargar} />);

    expect(mockConexion.inicios).toBe(1);
    mockHandlers.cambio('domicilios');
    expect(recargar).not.toHaveBeenCalled();
    mockHandlers.cambio('pedidos');
    expect(recargar).toHaveBeenCalledTimes(1);

    mockAlReconectar();
    expect(recargar).toHaveBeenCalledTimes(2);

    unmount();
    mockHandlers.cambio('pedidos');
    expect(recargar).toHaveBeenCalledTimes(2);
  });
});
