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
  LogLevel: { Warning: 3, None: 6 },
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

describe('token rechazado por el hub', () => {
  afterEach(() => localStorage.clear());

  test('un 401 al negociar cierra la sesión como en el REST, sin errores en consola', async () => {
    const { EVENTO_SESION_EXPIRADA } = require('../services/sesion');
    localStorage.setItem('token', 'jwt-vencido');
    mockConexion.state = 'Disconnected';
    const original = mockConexion.start;
    mockConexion.start = () => Promise.reject(new Error("Failed to complete negotiation with the server: Error: : Status code '401'"));
    const expirada = jest.fn();
    window.addEventListener(EVENTO_SESION_EXPIRADA, expirada);
    const aviso = jest.spyOn(console, 'warn').mockImplementation(() => {});

    render(<Pantalla tema="pedidos" recargar={() => {}} />);
    await new Promise((r) => setTimeout(r, 0));

    expect(localStorage.getItem('token')).toBeNull();
    expect(expirada).toHaveBeenCalledTimes(1);
    expect(aviso).not.toHaveBeenCalled();
    window.removeEventListener(EVENTO_SESION_EXPIRADA, expirada);
    mockConexion.start = original;
    aviso.mockRestore();
  });

  test('esNoAutorizado no confunde otros fallos con un 401', () => {
    const { esNoAutorizado } = require('../services/realtime');
    expect(esNoAutorizado({ statusCode: 401 })).toBe(true);
    expect(esNoAutorizado(new Error("Status code '503'"))).toBe(false);
    expect(esNoAutorizado(new Error('Failed to fetch'))).toBe(false);
    expect(esNoAutorizado(undefined)).toBe(false);
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
