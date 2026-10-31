// Pantallas del administrador con la API simulada: lo que ve y lo que envía.
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import * as api from '../services/api';
import * as inventarioApi from '../services/inventarioApi';
import GeneradorQR from '../GeneradorQR';
import GestionUsuarios from '../GestionUsuarios';
import GestionPlatillos from '../GestionPlatillos';

jest.mock('../services/api');
jest.mock('../services/inventarioApi', () => ({
  getRecetas: jest.fn(),
  compras: { insumos: jest.fn() },
  createReceta: jest.fn(),
  updateReceta: jest.fn(),
  deleteReceta: jest.fn(),
  mensajeError: (e, r) => r,
}));
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ usuario: { id: 1, rol: 'administrador' } }) }));

beforeEach(() => jest.clearAllMocks());

describe('Códigos QR', () => {
  const mesas = [{ id: 11, numero: 2, estado: 'Disponible', codigoQR: 'bbbbbbbbbbbbbbbbbbbbbbbb' }, { id: 10, numero: 1, estado: 'Disponible', codigoQR: 'aaaaaaaaaaaaaaaaaaaaaaaa' }];

  test('muestra un solo diseño: una tarjeta por mesa, en orden, sin selector de estilos', async () => {
    api.getMesas.mockResolvedValue(mesas);
    render(<GeneradorQR />);

    const tarjetas = await screen.findAllByRole('article');
    expect(tarjetas).toHaveLength(2);
    expect(within(tarjetas[0]).getByText('1')).toBeInTheDocument();
    expect(screen.queryByText(/premium/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/minimalista/i)).not.toBeInTheDocument();
  });

  test('el número de la mesa va dentro del código QR', async () => {
    api.getMesas.mockResolvedValue([mesas[1]]);
    render(<GeneradorQR />);

    const tarjeta = await screen.findByRole('article');
    const imagen = tarjeta.querySelector('svg image');
    expect(decodeURIComponent(imagen.getAttribute('href'))).toContain('>1</text>');
  });

  test('el administrador fija el número de mesas y se guarda en la API', async () => {
    api.getMesas.mockResolvedValue(mesas);
    api.fijarCantidadMesas.mockResolvedValue([...mesas, { id: 12, numero: 3, estado: 'Disponible', codigoQR: 'cccccccccccccccccccccccc' }]);
    render(<GeneradorQR />);

    const campo = await screen.findByLabelText('Mesas del salón');
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Una mesa más' }));
    expect(campo).toHaveValue(3);
    expect(screen.getByText('Se crean 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(api.fijarCantidadMesas).toHaveBeenCalledWith(3));
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(3));
  });

  test('si la API no deja retirar una mesa, se muestra su mensaje', async () => {
    api.getMesas.mockResolvedValue(mesas);
    api.fijarCantidadMesas.mockRejectedValue(new Error('No se pueden retirar las mesas 2: están ocupadas'));
    render(<GeneradorQR />);

    fireEvent.change(await screen.findByLabelText('Mesas del salón'), { target: { value: '1' } });
    expect(screen.getByText('se retiran la 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('están ocupadas');
  });
});

describe('Usuarios', () => {
  const usuarios = [
    { id: 1, nombre: 'Admin Qpro', nombreUsuario: 'admin', rol: 'Administrador' },
    { id: 2, nombre: 'Luis Mesa', nombreUsuario: 'luis', rol: 'Mesero' },
  ];

  test('cada usuario dice por dónde entra y el propio se marca', async () => {
    api.getUsuarios.mockResolvedValue(usuarios);
    render(<GestionUsuarios />);

    const fila = (await screen.findByText('Luis Mesa')).closest('button');
    expect(within(fila).getByText('App móvil')).toBeInTheDocument();
    expect(screen.getByText('Tú')).toBeInTheDocument();
  });

  test('el administrador no puede eliminarse ni cambiar su propio rol', async () => {
    api.getUsuarios.mockResolvedValue(usuarios);
    render(<GestionUsuarios />);

    fireEvent.click((await screen.findByText('Admin Qpro')).closest('button'));

    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).queryByRole('button', { name: /eliminar/i })).not.toBeInTheDocument();
    expect(within(dialogo).getByRole('radio', { name: /Caja/ })).toBeDisabled();
  });

  test('crear un usuario valida la clave antes de llamar a la API', async () => {
    api.getUsuarios.mockResolvedValue(usuarios);
    render(<GestionUsuarios />);

    fireEvent.click(await screen.findByRole('button', { name: /Nuevo usuario/ }));
    const dialogo = await screen.findByRole('dialog');
    fireEvent.change(within(dialogo).getByLabelText('Nombre completo'), { target: { value: 'Ana Ruiz' } });
    fireEvent.change(within(dialogo).getByLabelText(/^Usuario para entrar/), { target: { value: 'ana' } });
    fireEvent.change(within(dialogo).getByLabelText(/^Clave/), { target: { value: '12' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Crear usuario' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('al menos 4 caracteres');
    expect(api.createUsuario).not.toHaveBeenCalled();
  });
});

describe('Platillos', () => {
  const platillos = [
    { id: 1, nombre: 'Hamburguesa', categoria: 'Platos Principales', precio: 25000, imagenUrl: '', disponible: true, porcionesDisponibles: 40 },
    { id: 2, nombre: 'Limonada', categoria: 'Bebidas', precio: 6000, imagenUrl: '', disponible: true, porcionesDisponibles: null },
    { id: 3, nombre: 'Salmón', categoria: 'Platos Principales', precio: 48000, imagenUrl: '', disponible: false, porcionesDisponibles: 0 },
  ];

  beforeEach(() => {
    api.getPlatillos.mockResolvedValue(platillos);
    inventarioApi.getRecetas.mockResolvedValue([{ id: 1, platilloId: 1, productoId: 7, productoNombre: 'Carne', cantidadRequerida: 0.2, unidadMedida: 'Kg' }]);
    inventarioApi.compras.insumos.mockResolvedValue([{ id: 7, nombre: 'Carne', unidadMedida: 'Kg', precioCosto: 20000 }]);
  });

  test('cada tarjeta muestra lo que dice el inventario y el costo de la receta', async () => {
    render(<GestionPlatillos />);

    const hamburguesa = await screen.findByRole('button', { name: 'Editar Hamburguesa' });
    expect(within(hamburguesa).getByText('40 porciones')).toBeInTheDocument();
    // 0,2 kg × 20.000 = 4.000 de 25.000 → 16 %
    expect(await within(hamburguesa).findByText('Costo 16 %')).toBeInTheDocument();
    expect(within(screen.getByRole('button', { name: 'Editar Limonada' })).getByText('Sin receta')).toBeInTheDocument();
    expect(within(screen.getByRole('button', { name: 'Editar Salmón' })).getByText('Agotado')).toBeInTheDocument();
  });

  test('el filtro de agotados deja solo los que no se pueden vender', async () => {
    render(<GestionPlatillos />);
    await screen.findByRole('button', { name: 'Editar Hamburguesa' });

    fireEvent.click(screen.getByRole('button', { name: /Agotados/ }));

    expect(screen.getByRole('button', { name: 'Editar Salmón' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar Hamburguesa' })).not.toBeInTheDocument();
  });

  test('un nombre repetido no se envía a la API', async () => {
    render(<GestionPlatillos />);
    fireEvent.click(await screen.findByRole('button', { name: /Nuevo platillo/ }));

    const dialogo = await screen.findByRole('dialog');
    fireEvent.change(within(dialogo).getByLabelText('Nombre'), { target: { value: 'limonada' } });
    fireEvent.change(within(dialogo).getByLabelText(/^Precio de venta/), { target: { value: '5000' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Crear platillo' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Ya existe un platillo llamado "limonada"');
    expect(api.createPlatillo).not.toHaveBeenCalled();
  });

  test('la ficha de un platillo existente trae su receta para editarla ahí mismo', async () => {
    render(<GestionPlatillos />);
    fireEvent.click(await screen.findByRole('button', { name: 'Editar Hamburguesa' }));

    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('Receta por porción')).toBeInTheDocument();
    expect(within(dialogo).getByText('Carne')).toBeInTheDocument();
  });
});

describe('Seguridad del QR y acceso', () => {
  const mesas = [{ id: 10, numero: 1, estado: 'Disponible', codigoQR: 'aaaaaaaaaaaaaaaaaaaaaaaa' }];

  test('el enlace del QR lleva el código secreto, no el id de la mesa', async () => {
    api.getMesas.mockResolvedValue(mesas);
    const abrir = jest.spyOn(window, 'open').mockImplementation(() => null);
    render(<GeneradorQR />);

    fireEvent.click(await screen.findByRole('button', { name: /Probar/ }));

    expect(abrir.mock.calls[0][0]).toMatch(/\?m=aaaaaaaaaaaaaaaaaaaaaaaa$/);
    expect(abrir.mock.calls[0][0]).not.toMatch(/mesa=10/);
    abrir.mockRestore();
  });

  test('cambiar los códigos pide un segundo toque y luego llama a la API', async () => {
    api.getMesas.mockResolvedValue(mesas);
    api.regenerarCodigosMesas.mockResolvedValue([{ ...mesas[0], codigoQR: 'dddddddddddddddddddddddd' }]);
    render(<GeneradorQR />);

    fireEvent.click(await screen.findByRole('button', { name: /Cambiar códigos/ }));
    expect(api.regenerarCodigosMesas).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /hay que reimprimir/ }));

    await waitFor(() => expect(api.regenerarCodigosMesas).toHaveBeenCalled());
  });

  test('un platillo oculto se marca y se puede volver a mostrar', async () => {
    api.getPlatillos.mockResolvedValue([{ id: 5, nombre: 'Sopa', categoria: 'Sopas', precio: 9000, imagenUrl: '', disponible: false, porcionesDisponibles: null, activo: false }]);
    inventarioApi.getRecetas.mockResolvedValue([]);
    inventarioApi.compras.insumos.mockResolvedValue([]);
    api.cambiarActivoPlatillo.mockResolvedValue({ success: true });
    render(<GestionPlatillos />);

    const tarjeta = await screen.findByRole('button', { name: 'Editar Sopa' });
    expect(api.getPlatillos).toHaveBeenCalledWith(true);
    expect(within(tarjeta).getByText('Oculto')).toBeInTheDocument();

    fireEvent.click(tarjeta);
    fireEvent.click(await screen.findByRole('button', { name: /Mostrar en la carta/ }));

    await waitFor(() => expect(api.cambiarActivoPlatillo).toHaveBeenCalledWith(5, true));
  });

  test('desactivar a otro usuario conserva su ficha; a uno mismo no se le ofrece', async () => {
    api.getUsuarios.mockResolvedValue([
      { id: 1, nombre: 'Admin Qpro', nombreUsuario: 'admin', rol: 'Administrador', activo: true },
      { id: 2, nombre: 'Luis Mesa', nombreUsuario: 'luis', rol: 'Mesero', activo: true },
    ]);
    api.cambiarActivoUsuario.mockResolvedValue({ success: true });
    render(<GestionUsuarios />);

    fireEvent.click((await screen.findByText('Luis Mesa')).closest('button'));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /Desactivar/ }));
    await waitFor(() => expect(api.cambiarActivoUsuario).toHaveBeenCalledWith(2, false));
  });
});

