// Caja y Reportes con la API simulada: lo que ve el cajero y lo que se envía.
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import * as api from '../services/api';
import * as domiciliosApi from '../services/domiciliosApi';
import Facturacion from '../Facturacion';
import Reportes from '../Reportes';

jest.mock('../services/api');
jest.mock('../services/domiciliosApi');
jest.mock('../services/realtime', () => ({ useCambios: () => {} }));
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ usuario: { nombre: 'Caja', rol: 'Caja' } }) }));

// jsdom no trae ResizeObserver; los gráficos de recharts lo usan para medir su contenedor.
global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

const plato = (platilloId, platilloNombre, precio, cantidad) => ({ platilloId, platilloNombre, precio, cantidad });
const pedido = (id, estado, detalles, mesa = 4) => ({
  id, mesaId: mesa * 10, mesaNumero: mesa, estado, fecha: `2026-11-02T1${id}:00:00Z`, meseroNombre: 'Cliente QR', detalles,
});

beforeEach(() => {
  jest.clearAllMocks();
  domiciliosApi.getDomiciliosActivos.mockResolvedValue([]);
  domiciliosApi.getLiquidaciones.mockResolvedValue([]);
  api.getSolicitudesCuenta.mockResolvedValue([]);
});

describe('Caja', () => {
  const pedidos = [
    pedido(1, 'Entregado', [plato(1, 'Hamburguesa', 25000, 2)]),
    pedido(2, 'Listo', [plato(3, 'Limonada', 6000, 1)]),
    pedido(3, 'EnProceso', [plato(3, 'Limonada', 6000, 1)]),
  ];

  test('la mesa con tres envíos aparece como una sola cuenta', async () => {
    api.getPedidosActivos.mockResolvedValue(pedidos);
    render(<Facturacion />);

    await screen.findByRole('heading', { name: 'Mesa 4' });
    const tarjeta = screen.getAllByRole('listitem').find((li) => within(li).queryByRole('heading', { name: 'Mesa 4' }));
    expect(within(tarjeta).getByText(/3 pedidos/)).toBeInTheDocument();
    expect(within(tarjeta).getByText('1 pedido en cocina')).toBeInTheDocument();
    // Lo cobrable deja por fuera lo que sigue en cocina: 50.000 + 6.000
    expect(within(tarjeta).getByRole('button', { name: /Cobrar \$\s?56\.000/ })).toBeInTheDocument();
  });

  test('cobrar con propina del 10 % y efectivo exacto envía un solo cobro y muestra el cambio', async () => {
    api.getPedidosActivos.mockResolvedValue(pedidos);
    api.cobrarCuenta.mockResolvedValue({
      factura: { numeroFactura: 'FV-00000007', total: 61600, items: [] }, recibido: 70000, cambio: 8400,
    });
    render(<Facturacion />);

    fireEvent.click(await screen.findByRole('button', { name: /Cobrar \$\s?56\.000/ }));
    const panel = await screen.findByRole('dialog');

    expect(within(panel).getByRole('checkbox', { name: 'Cobrar el pedido 3' })).toBeDisabled();
    fireEvent.click(within(panel).getByRole('radio', { name: /10 %/ }));
    fireEvent.click(within(panel).getByRole('button', { name: /70\.000/ }));
    expect(within(panel).getByText(/Cambio: \$\s?8\.400/)).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole('button', { name: /Cobrar \$\s?61\.600/ }));

    await waitFor(() => expect(api.cobrarCuenta).toHaveBeenCalledWith({
      pedidoIds: [1, 2], propina: 5600, pagos: [{ metodoPago: 'Efectivo', monto: 61600, recibido: 70000 }], nitCliente: null, nombreCliente: null,
    }));
    expect(await within(panel).findByText('Cambio a entregar')).toBeInTheDocument();
    expect(within(panel).getByText(/FV-00000007/)).toBeInTheDocument();
  });

  test('desmarcar un pedido divide la cuenta y con tarjeta no se pide efectivo', async () => {
    api.getPedidosActivos.mockResolvedValue(pedidos);
    api.cobrarCuenta.mockResolvedValue({ factura: { numeroFactura: 'FV-1', total: 6000, items: [] }, recibido: null, cambio: 0 });
    render(<Facturacion />);

    fireEvent.click(await screen.findByRole('button', { name: /Cobrar \$\s?56\.000/ }));
    const panel = await screen.findByRole('dialog');
    fireEvent.click(within(panel).getByRole('checkbox', { name: 'Cobrar el pedido 1' }));
    fireEvent.click(within(panel).getByRole('radio', { name: 'Tarjeta' }));
    expect(within(panel).queryByLabelText(/Recibido del cliente/)).not.toBeInTheDocument();
    fireEvent.click(within(panel).getByRole('button', { name: /Cobrar \$\s?6\.000/ }));

    await waitFor(() => expect(api.cobrarCuenta).toHaveBeenCalledWith(expect.objectContaining({
      pedidoIds: [2], pagos: [{ metodoPago: 'Tarjeta', monto: 6000, recibido: null }],
    })));
  });

  test('cada quien lo suyo: cobra una de dos hamburguesas y deja el resto en la mesa', async () => {
    const conIds = [pedido(1, 'Entregado', [{ ...plato(1, 'Hamburguesa', 25000, 2), id: 51 }])];
    api.getPedidosActivos.mockResolvedValue(conIds);
    api.cobrarCuenta.mockResolvedValue({
      factura: { numeroFactura: 'FV-2', total: 25000, items: [] }, recibido: null, cambio: 0, cuentaSaldada: false, pendiente: 25000,
    });
    render(<Facturacion />);

    fireEvent.click(await screen.findByRole('button', { name: /Cobrar \$\s?50\.000/ }));
    const panel = await screen.findByRole('dialog');
    fireEvent.click(within(panel).getByRole('radio', { name: 'Cada quien lo suyo' }));
    fireEvent.click(within(panel).getByRole('button', { name: 'Agregar Hamburguesa' }));
    fireEvent.click(within(panel).getByRole('radio', { name: 'Tarjeta' }));
    fireEvent.click(within(panel).getByRole('button', { name: /Cobrar \$\s?25\.000/ }));

    await waitFor(() => expect(api.cobrarCuenta).toHaveBeenCalledWith(expect.objectContaining({
      lineas: [{ detalleId: 51, cantidad: 1 }], pagos: [{ metodoPago: 'Tarjeta', monto: 25000, recibido: null }],
    })));
    expect(await within(panel).findByText(/La mesa todavía debe \$\s?25\.000/)).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Cobrar lo que falta' })).toBeInTheDocument();
  });

  test('pago mixto: parte en efectivo y el resto con tarjeta', async () => {
    api.getPedidosActivos.mockResolvedValue([pedidos[0]]);
    api.cobrarCuenta.mockResolvedValue({ factura: { numeroFactura: 'FV-3', total: 50000, items: [] }, recibido: null, cambio: 0, cuentaSaldada: true });
    render(<Facturacion />);

    fireEvent.click(await screen.findByRole('button', { name: /Cobrar \$\s?50\.000/ }));
    const panel = await screen.findByRole('dialog');
    fireEvent.click(within(panel).getByRole('button', { name: /Agregar otro pago/ }));
    fireEvent.change(within(panel).getAllByLabelText('Valor de este pago')[0], { target: { value: '30000' } });
    fireEvent.click(within(within(panel).getByRole('radiogroup', { name: 'Método del pago 2' })).getByRole('radio', { name: 'Tarjeta' }));
    expect(within(panel).getByText(/Pagado \$\s?50\.000 de \$\s?50\.000 · completo/)).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole('button', { name: /Cobrar \$\s?50\.000/ }));

    await waitFor(() => expect(api.cobrarCuenta).toHaveBeenCalledWith(expect.objectContaining({
      pagos: [{ metodoPago: 'Efectivo', monto: 30000, recibido: null }, { metodoPago: 'Tarjeta', monto: 20000, recibido: null }],
    })));
  });

  test('si el mesero ya cobró toda la cuenta, la tarjeta va en verde y la caja solo confirma', async () => {
    api.getPedidosActivos.mockResolvedValue([pedidos[0]]);
    api.getSolicitudesCuenta.mockResolvedValue([{
      id: 9, mesaId: 40, mesaNumero: 4, meseroNombre: 'Juan', fecha: '2026-11-02T18:00:00Z', fechaPago: '2026-11-02T18:05:00Z',
      metodoPago: 'Mixto', tieneComprobante: true, propina: 5000, totalAvisado: 55000, porCobrar: 50000, cuadra: true,
      pagos: [{ id: 1, metodoPago: 'QR', monto: 30000, tieneComprobante: true }, { id: 2, metodoPago: 'QR', monto: 25000, tieneComprobante: true }],
    }]);
    api.getComprobantePagoAvisado.mockImplementation((id) => Promise.resolve(`data:image/jpeg;base64,FOTO${id}`));
    api.cobrarCuenta.mockResolvedValue({ factura: { numeroFactura: 'FV-4', total: 55000, items: [] }, recibido: null, cambio: 0, cuentaSaldada: true });
    render(<Facturacion />);

    expect(await screen.findByText('Ya pagó: confirma el cobro')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Cobrar \$\s?50\.000/ }));
    const panel = await screen.findByRole('dialog');

    expect(await within(panel).findByAltText(/Foto de la transferencia de \$\s?30\.000/)).toHaveAttribute('src', 'data:image/jpeg;base64,FOTO1');
    expect(await within(panel).findByAltText(/Foto de la transferencia de \$\s?25\.000/)).toBeInTheDocument();
    expect(within(panel).getByRole('radio', { name: 'Sin propina' })).toBeDisabled();
    expect(within(panel).getByRole('checkbox', { name: 'Cobrar el pedido 1' })).toBeDisabled();
    expect(within(panel).queryByRole('button', { name: /Agregar otro pago/ })).not.toBeInTheDocument();
    fireEvent.click(within(panel).getByRole('button', { name: /Confirmar cobro de \$\s?55\.000/ }));

    await waitFor(() => expect(api.cobrarCuenta).toHaveBeenCalledWith(expect.objectContaining({
      propina: 5000,
      pagos: [{ metodoPago: 'QR', monto: 30000, avisoId: 1 }, { metodoPago: 'QR', monto: 25000, avisoId: 2 }],
    })));
  });

  test('la cuenta que pidió el mesero por transferencia llega con el método y la foto', async () => {
    api.getPedidosActivos.mockResolvedValue([pedidos[0]]);
    api.getSolicitudesCuenta.mockResolvedValue([
      { id: 9, mesaId: 40, mesaNumero: 4, meseroNombre: 'Juan', fecha: '2026-11-02T18:00:00Z', metodoPago: 'QR', fechaPago: '2026-11-02T18:05:00Z', tieneComprobante: true },
    ]);
    api.getComprobanteCuenta.mockResolvedValue('data:image/jpeg;base64,AAAA');
    render(<Facturacion />);

    expect(await screen.findByText('Pagó por transferencia')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Cobrar \$\s?50\.000/ }));
    const panel = await screen.findByRole('dialog');

    expect(within(panel).getByRole('radio', { name: 'Transferencia o QR' })).toHaveAttribute('aria-checked', 'true');
    expect(await within(panel).findByAltText(/Foto de la transferencia/)).toHaveAttribute('src', 'data:image/jpeg;base64,AAAA');
    expect(api.getComprobanteCuenta).toHaveBeenCalledWith(9);
  });

  test('si el efectivo no alcanza no deja cobrar', async () => {
    api.getPedidosActivos.mockResolvedValue([pedidos[0]]);
    render(<Facturacion />);

    fireEvent.click(await screen.findByRole('button', { name: /Cobrar \$\s?50\.000/ }));
    const panel = await screen.findByRole('dialog');
    fireEvent.change(within(panel).getByLabelText(/Recibido del cliente/), { target: { value: '40000' } });

    expect(within(panel).getAllByText(/Faltan \$\s?10\.000/).length).toBeGreaterThan(0);
    expect(within(panel).getByRole('button', { name: /Cobrar \$\s?50\.000/ })).toBeDisabled();
  });

  test('el cierre del día suma por método y cuadra el efectivo contado', async () => {
    api.getPedidosActivos.mockResolvedValue([]);
    api.getFacturas.mockResolvedValue([]);
    const cierre = {
      fecha: '2026-11-02', esHoy: true, ventasMesa: 100000, propinas: 5000, ventasDomicilio: 25000, envios: 3000, totalRecaudado: 133000,
      cuentasMesa: 3, domicilios: 1, facturasEmitidas: 3, primeraFactura: 'FV-00000001', ultimaFactura: 'FV-00000003',
      pedidosAnulados: 0, valorAnulado: 0, cuentasAbiertas: 1, valorAbierto: 12000, domiciliosEnCurso: 0,
      base: 0, baseRegistrada: false, efectivoMesa: 65000, propinasEfectivo: 5000, efectivoDomicilios: 28000,
      efectivoEnDomiciliarios: [{ domiciliarioId: 3, nombre: 'Pedro', entregas: 1, total: 20000, domicilios: [8] }],
      propinasPagadas: 0, retiros: 0, tarjeta: 40000, transferencias: 0, cerrada: false,
      porMetodo: [{ metodo: 'Efectivo', mesa: 60000, propinas: 5000, domicilios: 28000, total: 93000, cobros: 3 }],
    };
    api.getCierreCaja.mockResolvedValue(cierre);
    api.abrirCaja.mockResolvedValue({ ...cierre, base: 50000, baseRegistrada: true });
    api.cerrarCaja.mockResolvedValue({ ...cierre, base: 50000, baseRegistrada: true, cerrada: true, efectivoContado: 142000 });
    render(<Facturacion />);

    fireEvent.click(await screen.findByRole('button', { name: /Cierre del día/ }));
    expect(await screen.findByText(/Quedan 1 mesa sin cobrar/)).toBeInTheDocument();
    expect(screen.getByText(/Pedro tiene \$\s?20\.000 en efectivo/)).toBeInTheDocument();
    // 50.000 de base + 65.000 de mesa + 28.000 de domiciliarios = 143.000; se cuentan 142.000.
    fireEvent.change(screen.getByLabelText(/Base con que se abrió/), { target: { value: '50000' } });
    fireEvent.change(screen.getByLabelText('Efectivo contado'), { target: { value: '142000' } });
    expect(screen.getByText(/Faltan \$\s?1\.000/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Total del cierre del datáfono'), { target: { value: '40000' } });
    expect(screen.getByText('Cuadra')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar la caja' }));
    fireEvent.click(screen.getByRole('button', { name: /Toca otra vez: cerrar la caja/ }));
    await waitFor(() => expect(api.cerrarCaja).toHaveBeenCalledWith(expect.objectContaining({
      fecha: expect.any(String), efectivoContado: 142000, propinasPagadas: 0, retiros: 0, tarjetaDatafono: 40000, transferenciasBanco: null,
    })));
    expect(api.abrirCaja).toHaveBeenCalledWith(expect.any(String), 50000);
    expect(await screen.findByText('Caja cerrada')).toBeInTheDocument();
  });
});

describe('Reportes', () => {
  const reporte = {
    desde: '2026-11-02', hasta: '2026-11-02', ventas: 70000, propinas: 2000, envios: 3000, numeroVentas: 3, ticketPromedio: 23333,
    pedidosAnulados: 1, valorAnulado: 6000,
    porDia: [{ fecha: '2026-11-02', mesa: 45000, domicilios: 25000, total: 70000, ventas: 3 }],
    porHora: Array.from({ length: 24 }, (_, h) => ({ hora: h, total: h === 13 ? 70000 : 0, ventas: h === 13 ? 3 : 0 })),
    porMetodo: [{ metodo: 'Efectivo', mesa: 45000, propinas: 2000, domicilios: 28000, total: 75000, cobros: 3 }],
    platillos: [{ platilloId: 1, nombre: 'Hamburguesa', categoria: 'Platos', cantidad: 2, ingresos: 50000 }],
    canales: [{ canal: 'Mesero', ventas: 1, total: 20000 }, { canal: 'QR de la mesa', ventas: 1, total: 25000 }, { canal: 'Domicilio', ventas: 1, total: 25000 }],
    meseros: [{ usuarioId: 2, nombre: 'Juan Pérez', pedidos: 1, mesas: 1, ventas: 20000, propinas: 2000 }],
  };

  test('muestra el resumen, los platillos, los meseros y lo que no se vendió', async () => {
    api.getReporteVentas.mockResolvedValue(reporte);
    api.getPlatillos.mockResolvedValue([{ id: 1, nombre: 'Hamburguesa' }, { id: 9, nombre: 'Sopa del día' }]);
    render(<Reportes />);

    expect(await screen.findByText('Ticket promedio')).toBeInTheDocument();
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    expect(screen.getByText('Sopa del día')).toBeInTheDocument();
    expect(api.getPlatillos).toHaveBeenCalledWith(true);
  });

  test('cambiar el periodo pide el rango a la API', async () => {
    api.getReporteVentas.mockResolvedValue(reporte);
    api.getPlatillos.mockResolvedValue([]);
    render(<Reportes />);
    await screen.findByText('Ticket promedio');

    fireEvent.click(screen.getByRole('button', { name: 'Últimos 7 días' }));

    await waitFor(() => expect(api.getReporteVentas).toHaveBeenCalledTimes(2));
    const [desde, hasta] = api.getReporteVentas.mock.calls[1];
    expect((new Date(hasta) - new Date(desde)) / 86400000).toBe(6);
  });

  test('sin ventas muestra un estado vacío', async () => {
    api.getReporteVentas.mockResolvedValue({ ...reporte, numeroVentas: 0 });
    api.getPlatillos.mockResolvedValue([]);
    render(<Reportes />);

    expect(await screen.findByText('No hay ventas en este periodo')).toBeInTheDocument();
  });
});
