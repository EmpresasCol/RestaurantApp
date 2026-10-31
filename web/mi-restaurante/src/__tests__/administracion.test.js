import {
  cambioMesas, categoriasDisponibles, estadoPlatillo, iniciales, insigniaMesa, limitarMesas,
  MAXIMO_MESAS, urlMesa, validarPlatillo, validarUsuario,
} from '../utils/administracion';

describe('platillos', () => {
  const carta = [{ id: 1, nombre: 'Ensalada César', categoria: 'ensaladas' }, { id: 2, nombre: 'Limonada', categoria: 'Bebidas' }];

  test('las categorías en uso se mezclan con las de base sin repetirse', () => {
    const cats = categoriasDisponibles([...carta, { id: 3, nombre: 'Pizza', categoria: 'Pizzas ' }]);
    expect(cats).toContain('Pizzas');
    expect(cats.filter((c) => c.toLowerCase() === 'ensaladas')).toHaveLength(1);
    expect(cats.filter((c) => c === 'Bebidas')).toHaveLength(1);
  });

  test('un nombre repetido se rechaza ignorando mayúsculas y tildes', () => {
    expect(validarPlatillo({ nombre: ' ensalada cesar ', precio: 1000 }, carta)).toMatch(/Ya existe/);
  });

  test('al editar, el platillo no choca con su propio nombre', () => {
    expect(validarPlatillo({ nombre: 'Ensalada César', precio: 18000 }, carta, 1)).toBeNull();
  });

  test('sin nombre o con precio cero no se guarda', () => {
    expect(validarPlatillo({ nombre: '  ', precio: 1000 })).toMatch(/nombre/);
    expect(validarPlatillo({ nombre: 'Agua', precio: '0' })).toMatch(/precio/);
  });

  test('el estado sale de las porciones que calcula el inventario', () => {
    expect(estadoPlatillo({ disponible: false, porcionesDisponibles: 0 }).clave).toBe('agotado');
    expect(estadoPlatillo({ disponible: true, porcionesDisponibles: null }).clave).toBe('sin-receta');
    expect(estadoPlatillo({ disponible: true, porcionesDisponibles: 3 }).texto).toBe('Quedan 3');
    expect(estadoPlatillo({ disponible: true, porcionesDisponibles: 40 }).tono).toBe('ok');
    expect(estadoPlatillo({ activo: false, disponible: false, porcionesDisponibles: 40 }).clave).toBe('oculto');
  });
});

describe('usuarios', () => {
  const base = { nombre: 'Ana Ruiz', nombreUsuario: 'ana', rol: 'Caja', clave: 'clave1', confirmarClave: 'clave1' };

  test('un usuario válido pasa', () => {
    expect(validarUsuario(base)).toBeNull();
  });

  test('el usuario no admite espacios ni menos de 3 letras', () => {
    expect(validarUsuario({ ...base, nombreUsuario: 'la caja' })).toMatch(/espacios/);
    expect(validarUsuario({ ...base, nombreUsuario: 'an' })).toMatch(/3 caracteres/);
  });

  test('la clave se exige al crear y debe coincidir', () => {
    expect(validarUsuario({ ...base, clave: '123', confirmarClave: '123' })).toMatch(/4 caracteres/);
    expect(validarUsuario({ ...base, confirmarClave: 'otra' })).toMatch(/no coinciden/);
  });

  test('al editar, dejar la clave vacía la conserva', () => {
    expect(validarUsuario({ ...base, clave: '', confirmarClave: '' }, { edicion: true })).toBeNull();
  });

  test('un rol que no existe se rechaza', () => {
    expect(validarUsuario({ ...base, rol: 'Gerente' })).toMatch(/rol/);
  });

  test('las iniciales salen de las dos primeras palabras', () => {
    expect(iniciales('  maría   josé pérez ')).toBe('MJ');
    expect(iniciales('')).toBe('?');
  });
});

describe('mesas y QR', () => {
  test('el QR lleva solo el código secreto, no el id ni el número que se podrían cambiar', () => {
    const url = urlMesa('https://qpro.co/', { id: 7, numero: 3, codigoQR: 'a1b2c3d4e5f6a1b2c3d4e5f6' });
    expect(url).toBe('https://qpro.co/?m=a1b2c3d4e5f6a1b2c3d4e5f6');
    expect(url).not.toMatch(/mesa=|numero=/);
  });

  test('el número de mesas se mantiene en el rango permitido', () => {
    expect(limitarMesas('0')).toBe(1);
    expect(limitarMesas('abc')).toBe(1);
    expect(limitarMesas(9999)).toBe(MAXIMO_MESAS);
    expect(limitarMesas('12')).toBe(12);
  });

  test('el resumen del cambio dice cuántas se crean y cuáles se retiran', () => {
    expect(cambioMesas([1, 2, 3, 5], 4)).toEqual({ crear: 1, retirar: [5] });
    expect(cambioMesas([1, 2], 2)).toEqual({ crear: 0, retirar: [] });
  });

  test('la insignia del centro del QR muestra el número de la mesa', () => {
    const svg = decodeURIComponent(insigniaMesa(12).replace('data:image/svg+xml,', ''));
    expect(svg).toContain('>12</text>');
    expect(svg).toContain('font-size="44"');
    expect(decodeURIComponent(insigniaMesa(120))).toContain('font-size="34"');
  });
});
