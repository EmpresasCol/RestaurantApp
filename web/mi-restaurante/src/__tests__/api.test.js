// Pruebas de contrato entre la web y la API REST (services/api.js).
// Se simula fetch para verificar QUÉ se envía al backend.
import * as api from '../services/api';

const ok = (body, status = 200) =>
  Promise.resolve({
    ok: true,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });

const fallo = (status, body) =>
  Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });

const ultimaPeticion = () => {
  const [url, opciones] = global.fetch.mock.calls.at(-1);
  return { url, opciones, cuerpo: opciones?.body ? JSON.parse(opciones.body) : undefined };
};

beforeEach(() => {
  global.fetch = jest.fn();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('Autenticación', () => {
  test('login envía usuario y clave a /usuarios/login', async () => {
    global.fetch.mockReturnValue(ok({ id: 1, rol: 'Caja' }));

    await api.login('pedro.caja', '123');

    const { url, opciones, cuerpo } = ultimaPeticion();
    expect(url).toMatch(/\/usuarios\/login$/);
    expect(opciones.method).toBe('POST');
    expect(cuerpo).toEqual({ usuario: 'pedro.caja', clave: '123' });
  });

  test('login con 401 lanza el mensaje del servidor', async () => {
    global.fetch.mockReturnValue(fallo(401, { message: 'Credenciales inválidas' }));
    await expect(api.login('x', 'y')).rejects.toThrow('Credenciales inválidas');
  });
});

describe('Comandas (mesero / QR → cocina)', () => {
  test('createPedido envía mesa, platillos, cantidades y exclusiones', async () => {
    global.fetch.mockReturnValue(ok({ id: 10 }, 201));

    await api.createPedido(3, [
      { id: 1, cantidad: 2, nota: 'sin cebolla' },
      { id: 7, cantidad: 1 },
    ]);

    const { url, cuerpo } = ultimaPeticion();
    expect(url).toMatch(/\/pedidos$/);
    expect(cuerpo).toEqual({
      mesaId: 3,
      detalles: [
        { platilloId: 1, cantidad: 2, nota: 'sin cebolla' },
        { platilloId: 7, cantidad: 1, nota: '' },
      ],
    });
  });

  test('updatePedido usa el endpoint de estado', async () => {
    global.fetch.mockReturnValue(ok({ id: 10, estado: 'Pagado' }));

    await api.updatePedido(10, 'Pagado');

    const { url, opciones, cuerpo } = ultimaPeticion();
    expect(url).toMatch(/\/pedidos\/10\/estado$/);
    expect(opciones.method).toBe('PUT');
    expect(cuerpo).toEqual({ estado: 'Pagado' });
  });

  test('un error del servidor al crear pedido se propaga a la UI', async () => {
    global.fetch.mockReturnValue(fallo(400, 'Mesa 99 no existe'));
    await expect(api.createPedido(99, [{ id: 1, cantidad: 1 }])).rejects.toThrow(/Mesa 99/);
  });
});

describe('Caja', () => {
  test('createPago envía pedido, monto, método y propina', async () => {
    global.fetch.mockReturnValue(ok({ id: 1 }, 201));

    await api.createPago(10, 59500, 'Efectivo', 5000);

    expect(ultimaPeticion().cuerpo).toEqual({ pedidoId: 10, monto: 59500, montoPropina: 5000, metodoPago: 'Efectivo' });
  });
});

describe('Gestión de usuarios', () => {
  test('createUsuario traduce el rol a su valor numérico del enum', async () => {
    global.fetch.mockReturnValue(ok({ id: 9 }, 201));

    await api.createUsuario({ nombreUsuario: 'caja2', nombre: 'Caja 2', clave: '1234', rol: 'Caja' });

    expect(ultimaPeticion().cuerpo).toMatchObject({ NombreUsuario: 'caja2', Rol: 3 });
  });

  // En C#, RolUsuario = { Administrador=0, Mesero, Cocina, Caja, Domiciliario=4 }.
  // rolMap no incluye 'Domiciliario' ⇒ Rol queda undefined, JSON.stringify lo omite
  // y el backend lo deserializa como 0 = Administrador. Editar un domiciliario lo vuelve ADMIN.
  test('[AUDITORÍA] editar un usuario Domiciliario no debe convertirlo en Administrador', async () => {
    global.fetch.mockReturnValue(ok({}, 204));

    await api.updateUsuario(5, { nombreUsuario: 'domi', nombre: 'Domi', rol: 'Domiciliario', clave: 'nueva' });

    const { cuerpo } = ultimaPeticion();
    expect(cuerpo.Rol).toBe(4);
  });

  test('[AUDITORÍA] crear un usuario Domiciliario envía su rol', async () => {
    global.fetch.mockReturnValue(ok({ id: 9 }, 201));

    await api.createUsuario({ nombreUsuario: 'domi2', nombre: 'Domi 2', clave: '1234', rol: 'Domiciliario' });

    expect(ultimaPeticion().cuerpo.Rol).toBe(4);
  });
});
