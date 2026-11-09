// src/utils/kds.js
// Reglas del KDS (pantalla de cocina).

// Respaldo: los cambios llegan por SignalR; el polling cubre la conexión caída.
export const POLLING_DOMICILIOS_MS = 60000;

// Cada plato de la comanda suma este peso (≈ minutos extra de preparación).
export const PESO_POR_PLATO = 1;

const totalPlatos = (pedido) => (pedido.items || []).reduce((suma, i) => suma + (i.cantidad || 0), 0);

/**
 * Prioridad de una comanda = minutos de espera + PESO_POR_PLATO × platos.
 * Las comandas grandes empiezan antes porque tardan más, y la espera evita que una
 * comanda pequeña quede relegada indefinidamente. Las "Listo" van al final.
 */
export const prioridadComanda = (pedido, ahora = new Date()) => {
  const minutos = Math.max(0, (ahora - new Date(pedido.hora)) / 60000);
  return minutos + PESO_POR_PLATO * totalPlatos(pedido);
};

export const ordenarPorPrioridad = (pedidos, ahora = new Date()) =>
  [...pedidos].sort((a, b) => {
    const listoA = a.estado === 'Listo' ? 1 : 0;
    const listoB = b.estado === 'Listo' ? 1 : 0;
    if (listoA !== listoB) return listoA - listoB;
    const diferencia = prioridadComanda(b, ahora) - prioridadComanda(a, ahora);
    return diferencia !== 0 ? diferencia : new Date(a.hora) - new Date(b.hora);
  });

/**
 * La cocina trabaja lo que está por preparar; lo listo se aparta hasta que el mesero lo
 * sirve (o el domiciliario lo recoge), para no confundirlo con lo que está en el fuego.
 */
export const separarListos = (pedidos) => ({
  enCocina: pedidos.filter((p) => p.estado !== 'Listo'),
  listos: [...pedidos.filter((p) => p.estado === 'Listo')].sort((a, b) => new Date(a.listoDesde ?? a.hora) - new Date(b.listoDesde ?? b.hora)),
});

/** Domicilios en cocina o listos para salir, con la misma forma que los pedidos de mesa. */
export const transformarDomicilios = (domiciliosData) => {
  if (!Array.isArray(domiciliosData)) return [];
  return domiciliosData
    .filter((d) => d.estado === 'EnPreparacion' || d.estado === 'Listo')
    .map((d) => ({
      id: `D${d.id}`,
      domicilioId: d.id,
      mesa: `Domicilio #${d.id}`,
      cliente: d.clienteNombre,
      telefono: d.clienteTelefono,
      direccion: d.direccionCompleta,
      domiciliario: d.domiciliarioNombre,
      items: d.detalles.map((det) => ({
        id: det.id,
        nombre: det.platilloNombre,
        cantidad: det.cantidad,
        notas: det.nota || '',
      })),
      hora: new Date(d.fechaPedido),
      estado: d.estado,
      // Hasta que la cocina lo empieza, el cliente todavía puede cambiarlo desde su enlace.
      empezado: !!d.cocinaEmpezo,
      tipo: 'domicilio',
      notasCliente: d.notasCliente,
    }));
};
