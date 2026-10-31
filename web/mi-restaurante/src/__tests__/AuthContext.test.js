// Pruebas de funcionamiento del contexto de autenticación (web PWA).
// Las pruebas con prefijo "[AUDITORÍA]" documentan defectos: fallan con el código
// actual y deben pasar cuando se corrijan.
import React from 'react';
import { render, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../context/AuthContext';
import * as api from '../services/api';

jest.mock('../services/api', () => ({ login: jest.fn() }));

// Componente auxiliar que expone el contexto para inspeccionarlo en las pruebas
function renderConAuth() {
  const ref = { current: null };
  function Sonda() {
    ref.current = useAuth();
    return null;
  }
  const utils = render(
    <AuthProvider>
      <Sonda />
    </AuthProvider>
  );
  return { ref, ...utils };
}

// JWT con la forma que emite la API (el cliente no verifica la firma; la API sí).
const jwtDePrueba = (rol) => {
  const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: '1', role: rol, exp })}.firma`;
};

// Respuesta real de POST /api/usuarios/login (LoginResponseDto, ahora con token)
const respuestaLoginApi = (rol) => ({ id: 1, nombre: 'Ana', nombreUsuario: 'ana', rol, token: jwtDePrueba(rol) });

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  window.history.replaceState({}, '', '/');
});

describe('Login web', () => {
  test('un administrador inicia sesión y queda autenticado', async () => {
    api.login.mockResolvedValue(respuestaLoginApi('Administrador'));
    const { ref } = renderConAuth();
    await waitFor(() => expect(ref.current.cargando).toBe(false));

    await act(() => ref.current.login({ username: 'ana', password: '123' }));

    expect(ref.current.estaAutenticado).toBe(true);
    expect(ref.current.usuario.rol).toBe('administrador');
  });

  test('un mesero es rechazado en la web', async () => {
    api.login.mockResolvedValue(respuestaLoginApi('Mesero'));
    const { ref } = renderConAuth();
    await waitFor(() => expect(ref.current.cargando).toBe(false));

    await expect(ref.current.login({ username: 'juan', password: '123' })).rejects.toThrow(/aplicación móvil/);
    expect(ref.current.estaAutenticado).toBe(false);
  });

  test('un domiciliario es rechazado en la web', async () => {
    api.login.mockResolvedValue(respuestaLoginApi('Domiciliario'));
    const { ref } = renderConAuth();
    await waitFor(() => expect(ref.current.cargando).toBe(false));

    await expect(ref.current.login({ username: 'd', password: '123' })).rejects.toThrow(/permisos/);
  });

  test('credenciales inválidas propagan el mensaje del servidor', async () => {
    api.login.mockRejectedValue(new Error('Contraseña incorrecta'));
    const { ref } = renderConAuth();
    await waitFor(() => expect(ref.current.cargando).toBe(false));

    await expect(ref.current.login({ username: 'ana', password: 'x' })).rejects.toThrow('Contraseña incorrecta');
  });
});

describe('Control de acceso por rol (tienePermiso)', () => {
  const casos = [
    // rol,            permisos requeridos, esperado
    ['Administrador', ['caja'], true],
    ['Administrador', ['cocina'], true],
    ['Caja', ['caja'], true],
    ['Caja', ['cocina'], false],
    ['Cocina', ['cocina'], true],
    ['Cocina', ['caja'], false],
    ['Cocina', ['administrador'], false],
  ];

  test.each(casos)('%s con permisos %j → %s', async (rol, permisos, esperado) => {
    api.login.mockResolvedValue(respuestaLoginApi(rol));
    const { ref } = renderConAuth();
    await waitFor(() => expect(ref.current.cargando).toBe(false));
    await act(() => ref.current.login({ username: 'x', password: 'y' }));

    expect(ref.current.tienePermiso(permisos)).toBe(esperado);
  });

  test('el comensal que entra por QR (?m=<código>) solo ve el menú', async () => {
    window.history.replaceState({}, '', '/?m=a1b2c3d4e5f6a1b2c3d4e5f6');
    const { ref } = renderConAuth();
    await waitFor(() => expect(ref.current.cargando).toBe(false));

    expect(ref.current.esClienteQR).toBe(true);
    expect(ref.current.usuario.codigoMesa).toBe('a1b2c3d4e5f6a1b2c3d4e5f6');
    expect(ref.current.tienePermiso(['cliente'])).toBe(true);
    expect(ref.current.tienePermiso(['caja'])).toBe(false);
  });

  test('un QR viejo con ?mesa=<id> abre la carta pero no lleva mesa para pedir', async () => {
    window.history.replaceState({}, '', '/?mesa=5&numero=5');
    const { ref } = renderConAuth();
    await waitFor(() => expect(ref.current.cargando).toBe(false));

    expect(ref.current.esClienteQR).toBe(true);
    expect(ref.current.usuario.codigoMesa).toBeNull();
    expect(ref.current.usuario.mesa).toBeUndefined();
  });
});

describe('[AUDITORÍA] Persistencia y seguridad de la sesión', () => {
  // La API nunca devuelve "token" y verificarSesion() exige usuario + token en
  // localStorage: al recargar la página (F5) el usuario pierde la sesión.
  test('[AUDITORÍA] la sesión sobrevive a una recarga de la página', async () => {
    api.login.mockResolvedValue(respuestaLoginApi('Caja'));
    const primera = renderConAuth();
    await waitFor(() => expect(primera.ref.current.cargando).toBe(false));
    await act(() => primera.ref.current.login({ username: 'pedro', password: '123' }));
    primera.unmount();

    // Simula F5: el proveedor se monta de nuevo y lee localStorage
    const segunda = renderConAuth();
    await waitFor(() => expect(segunda.ref.current.cargando).toBe(false));

    expect(segunda.ref.current.estaAutenticado).toBe(true);
  });

  // El rol se toma de localStorage sin verificarlo con el servidor: basta editarlo
  // en DevTools para obtener el panel de administrador (y la API no exige token).
  test('[AUDITORÍA] una sesión fabricada en localStorage no otorga rol de administrador', async () => {
    localStorage.setItem('usuario', JSON.stringify({ id: 99, nombre: 'Intruso', rol: 'administrador' }));
    localStorage.setItem('token', 'cualquier-cosa');

    const { ref } = renderConAuth();
    await waitFor(() => expect(ref.current.cargando).toBe(false));

    expect(ref.current.tienePermiso(['administrador'])).toBe(false);
  });

  test('[AUDITORÍA] un código con caracteres raros no se acepta como mesa', async () => {
    window.history.replaceState({}, '', '/?m=%3Cscript%3E');
    const { ref } = renderConAuth();
    await waitFor(() => expect(ref.current.cargando).toBe(false));

    expect(ref.current.usuario.codigoMesa).toBeNull();
  });
});
