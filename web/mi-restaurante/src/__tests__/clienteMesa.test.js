import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockHandlers = {};
let mockAlReconectar;
const mockConexion = {
  state: 'Disconnected',
  invocaciones: [],
  on: (evento, fn) => { mockHandlers[evento] = fn; },
  off: () => {},
  onreconnected: (fn) => { mockAlReconectar = fn; },
  start() { return Promise.resolve(); },
  invoke(...args) { this.invocaciones.push(args); return Promise.resolve(true); },
  stop() {},
};

jest.mock('@microsoft/signalr', () => ({
  HubConnectionBuilder: class {
    withUrl() { return this; }
    withAutomaticReconnect() { return this; }
    configureLogging() { return this; }
    build() { return mockConexion; }
  },
  HubConnectionState: { Disconnected: 'Disconnected' },
  LogLevel: { Warning: 3 },
}));

const {
  getSeguimiento, guardarLlamada, leerLlamada, ultimaGana, useLlamada, useSeguimiento,
} = require('../services/clienteMesa');
const { BotonLlamar, AvisoLlamada, HojaMesa, ResumenMesa, estadoResumen } = require('../components/menu/MiMesa');

const respuesta = (status, cuerpo) => Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(cuerpo) });

const datosVisita = (extra = {}) => ({
  mesaNumero: 4,
  pin: '123456',
  inicio: '2026-11-13T15:00:00Z',
  llamada: null,
  pedidos: [
    { id: 1, fecha: '2026-11-13T15:01:00Z', estado: 'Recibido', platos: [{ nombre: 'Bandeja', cantidad: 2, nota: 'Sin cebolla', precio: 20000, pagado: false }] },
    { id: 2, fecha: '2026-11-13T15:10:00Z', estado: 'EnPreparacion', platos: [{ nombre: 'Jugo', cantidad: 1, nota: null, precio: 5000, pagado: false }] },
  ],
  cuenta: { total: 45000, pagado: 0, pendiente: 45000, cuentaPedida: false, pagoPorConfirmar: false },
  ...extra,
});

beforeEach(() => {
  localStorage.clear();
  mockConexion.invocaciones = [];
  global.fetch = jest.fn();
});

describe('getSeguimiento', () => {
  test('sin llave no consulta la API', async () => {
    expect(await getSeguimiento('abc', null)).toEqual({ estado: 'sin-llave' });
    expect(fetch).not.toHaveBeenCalled();
  });

  test('envía el código y la llave en cabeceras, nunca en la URL', async () => {
    fetch.mockReturnValue(respuesta(200, datosVisita()));
    const r = await getSeguimiento('abc', 'llave-1');
    expect(r.estado).toBe('activo');
    const [url, opciones] = fetch.mock.calls[0];
    expect(url).not.toContain('llave-1');
    expect(opciones.headers['X-Mesa']).toBe('abc');
    expect(opciones.headers['X-Seguimiento']).toBe('llave-1');
  });

  test('410 es visita cerrada (pagada) y 404 es llave que ya no sirve', async () => {
    fetch.mockReturnValueOnce(respuesta(410, { cerrada: true, pagada: true, message: 'Tu cuenta quedó pagada.' }));
    expect(await getSeguimiento('abc', 'vieja')).toEqual({ estado: 'cerrada', pagada: true, mensaje: 'Tu cuenta quedó pagada.' });
    fetch.mockReturnValueOnce(respuesta(404, {}));
    expect(await getSeguimiento('abc', 'otra-mesa')).toEqual({ estado: 'sin-llave' });
  });
});

describe('ultimaGana', () => {
  test('una respuesta atrasada no pisa a una más nueva', async () => {
    const turno = ultimaGana();
    let soltarVieja;
    const vieja = turno(new Promise((r) => { soltarVieja = r; }));
    const nueva = turno(Promise.resolve('nuevo'));
    soltarVieja('viejo');
    expect(await nueva).toEqual({ vigente: true, valor: 'nuevo' });
    expect(await vieja).toEqual({ vigente: false });
  });
});

function Seguir({ codigo, llave }) {
  const [s] = useSeguimiento(codigo, llave);
  return <p data-testid="estado">{s.estado}{s.error ? ` · ${s.error}` : ''}{s.datos ? ` · ${s.datos.pedidos.length}` : ''}</p>;
}

describe('useSeguimiento', () => {
  test('se une al grupo de la visita y recarga con cada aviso y al reconectar', async () => {
    fetch.mockReturnValue(respuesta(200, datosVisita()));
    render(<Seguir codigo="abc" llave="llave-1" />);
    await waitFor(() => expect(screen.getByTestId('estado')).toHaveTextContent('activo · 2'));
    expect(mockConexion.invocaciones[0]).toEqual(['Seguir', 'abc', 'llave-1']);

    fetch.mockReturnValue(respuesta(200, datosVisita({ pedidos: [...datosVisita().pedidos, { id: 3, fecha: '', estado: 'Recibido', platos: [] }] })));
    await act(async () => { mockHandlers.cambio(); });
    await waitFor(() => expect(screen.getByTestId('estado')).toHaveTextContent('activo · 3'));

    const llamadas = fetch.mock.calls.length;
    await act(async () => { mockAlReconectar(); });
    expect(fetch.mock.calls.length).toBe(llamadas + 1);
    expect(mockConexion.invocaciones.length).toBe(2);
  });

  test('sin red conserva lo último visto y avisa', async () => {
    fetch.mockReturnValueOnce(respuesta(200, datosVisita()));
    render(<Seguir codigo="abc" llave="llave-1" />);
    await waitFor(() => expect(screen.getByTestId('estado')).toHaveTextContent('activo · 2'));
    fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await act(async () => { mockHandlers.cambio(); });
    await waitFor(() => expect(screen.getByTestId('estado')).toHaveTextContent('activo · Failed to fetch · 2'));
  });
});

function Llamada({ codigo }) {
  const llamada = useLlamada(codigo);
  return (
    <>
      <BotonLlamar llamada={llamada} />
      <AvisoLlamada llamada={llamada} />
    </>
  );
}

describe('Llamar al mesero', () => {
  test('confirma solo cuando la API registró la llamada y el doble toque envía una', async () => {
    let soltar;
    fetch.mockReturnValueOnce(new Promise((r) => { soltar = r; }));
    render(<Llamada codigo="abc" />);
    const boton = screen.getByRole('button', { name: /llamar al mesero/i });
    fireEvent.click(boton);
    fireEvent.click(boton);
    expect(screen.getByRole('status')).toHaveTextContent('Avisando al mesero');
    expect(screen.queryByText(/solicitud recibida/i)).toBeNull();
    await act(async () => { soltar(await respuesta(200, { clave: 'k1', estado: 'Pendiente', fecha: '' })); });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent('Solicitud recibida');
    expect(screen.getByRole('button', { name: /mesero avisado/i })).toBeDisabled();
    expect(leerLlamada('abc')).toBe('k1');
  });

  test('si falla muestra el motivo y deja reintentar', async () => {
    fetch.mockReturnValueOnce(respuesta(429, { message: 'Acabas de llamar al mesero. Espera un momento antes de volver a llamar.' }));
    render(<Llamada codigo="abc" />);
    fireEvent.click(screen.getByRole('button', { name: /llamar al mesero/i }));
    await screen.findByText(/acabas de llamar/i);
    fetch.mockReturnValueOnce(respuesta(200, { clave: 'k2', estado: 'Pendiente', fecha: '' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /reintentar/i })); });
    expect(screen.getByRole('status')).toHaveTextContent('Solicitud recibida');
  });

  test('al recargar recupera la llamada viva y la olvida cuando la atienden', async () => {
    guardarLlamada('abc', 'k1');
    fetch.mockReturnValueOnce(respuesta(200, { clave: 'k1', estado: 'EnCamino', fecha: '' }));
    const { unmount } = render(<Llamada codigo="abc" />);
    await screen.findByText(/un mesero va para tu mesa/i);
    unmount();

    fetch.mockReturnValueOnce(respuesta(200, { clave: 'k1', estado: 'Atendida', fecha: '' }));
    render(<Llamada codigo="abc" />);
    await screen.findByText(/ya te atendieron/i);
    expect(leerLlamada('abc')).toBeNull();
    expect(screen.getByRole('button', { name: /llamar al mesero/i })).toBeEnabled();
  });
});

describe('Vista de la mesa', () => {
  test('resume con lo más avanzado y lo que falta por pagar', () => {
    expect(estadoResumen(datosVisita().pedidos)).toBe('EnPreparacion');
    expect(estadoResumen([{ estado: 'Entregado' }, { estado: 'Listo' }])).toBe('Listo');
    render(<ResumenMesa seguimiento={{ estado: 'activo', datos: datosVisita() }} onAbrir={() => {}} />);
    expect(screen.getByRole('button', { name: /tu pedido/i })).toHaveTextContent('En preparación · por pagar');
  });

  test('la hoja muestra platos, notas, estados y la cuenta', () => {
    render(
      <HojaMesa abierta onCerrar={() => {}} codigo="abc" llave="l" numeroMesa={4}
        seguimiento={{ estado: 'activo', datos: datosVisita({ cuenta: { total: 45000, pagado: 20000, pendiente: 25000, cuentaPedida: true, pagoPorConfirmar: true } }) }}
        onLlave={() => {}} />
    );
    expect(screen.getByText('Sin cebolla')).toBeInTheDocument();
    expect(screen.getByText('Recibido')).toBeInTheDocument();
    expect(screen.getByText('En preparación')).toBeInTheDocument();
    expect(screen.getByText('Ya pagado')).toBeInTheDocument();
    expect(screen.getByText(/por confirmar en caja/i)).toBeInTheDocument();
    expect(screen.getByText('123456')).toBeInTheDocument();
  });

  test('sin llave pide el código de 6 dígitos y guarda la llave al unirse', async () => {
    const onLlave = jest.fn();
    fetch.mockReturnValueOnce(respuesta(200, { seguimiento: 'llave-2' }));
    render(<HojaMesa abierta onCerrar={() => {}} codigo="abc" llave={null} numeroMesa={4} seguimiento={{ estado: 'sin-llave' }} onLlave={onLlave} />);
    const ver = screen.getByRole('button', { name: /ver el pedido/i });
    expect(ver).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/código de la mesa/i), { target: { value: '12a3456' } });
    await act(async () => { fireEvent.click(ver); });
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ codigoMesa: 'abc', pin: '123456' });
    expect(onLlave).toHaveBeenCalledWith('llave-2');
  });

  test('al cerrar la visita muestra el cierre en lugar de los pedidos', () => {
    render(<ResumenMesa seguimiento={{ estado: 'sin-llave' }} cierre="Tu cuenta quedó pagada. ¡Gracias por tu visita!" onAbrir={() => {}} onCerrarCierre={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('Tu cuenta quedó pagada');
    expect(screen.queryByRole('button', { name: /tu pedido/i })).toBeNull();
  });
});

describe('MenuQR con seguimiento', () => {
  const MenuQR = require('../components/menu/MenuQR').default;
  const platillos = [{ id: 7, nombre: 'Bandeja', precio: 20000, categoria: 'Fuertes', disponible: true, porcionesDisponibles: 5 }];
  // jsdom no trae lo que usan las animaciones de la carta.
  beforeAll(() => {
    global.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
    window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  });

  test('el pedido por QR guarda la llave de la visita y muestra su estado del servidor', async () => {
    fetch.mockReturnValue(respuesta(200, datosVisita()));
    const onEnviarPedido = jest.fn().mockResolvedValue({ id: 1, seguimiento: 'llave-qr' });
    render(<MenuQR platillos={platillos} cargando={false} mesaId="abc" numeroMesa={4} onEnviarPedido={onEnviarPedido} />);
    expect(screen.getByRole('button', { name: /llamar al mesero/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Agregar Bandeja' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ver pedido, 1 platos' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /enviar pedido a cocina/i })); });

    expect(localStorage.getItem('qpro:seguimiento:abc')).toBe('llave-qr');
    await waitFor(() => expect(screen.getByRole('button', { name: /tu pedido/i })).toHaveTextContent('En preparación'));
    expect(fetch.mock.calls.some(([url, o]) => url.endsWith('/cliente-mesa/seguimiento') && o.headers['X-Seguimiento'] === 'llave-qr')).toBe(true);
  });

  test('una llave de una visita cerrada se olvida y no muestra pedidos de nadie', async () => {
    localStorage.setItem('qpro:seguimiento:abc', 'vieja');
    fetch.mockReturnValue(respuesta(410, { cerrada: true, pagada: true, message: 'Tu cuenta quedó pagada.' }));
    render(<MenuQR platillos={platillos} cargando={false} mesaId="abc" numeroMesa={4} onEnviarPedido={jest.fn()} />);
    await waitFor(() => expect(localStorage.getItem('qpro:seguimiento:abc')).toBeNull());
    expect(screen.queryByRole('button', { name: /tu pedido/i })).toBeNull();
    expect(await screen.findByRole('button', { name: /sigue el pedido con el código/i })).toBeInTheDocument();
  });
});
