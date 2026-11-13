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

describe('reintentoSinFin', () => {
  const { reintentoSinFin } = require('../services/realtime');
  test('nunca se rinde y espera como mucho 30 s entre intentos', () => {
    const espera = (n) => reintentoSinFin.nextRetryDelayInMilliseconds({ previousRetryCount: n });
    expect(espera(0)).toBe(1000);
    expect(espera(3)).toBe(8000);
    // La política por defecto devuelve null desde el 5.º intento: la conexión moría.
    expect(espera(5)).toBe(30000);
    expect(espera(500)).toBe(30000);
  });
});
