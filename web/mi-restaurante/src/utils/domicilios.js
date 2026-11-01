// Reglas del módulo de domicilios (sin React, para poder probarlas): etapa de cada pedido,
// cobro al entregar, cambio que lleva el domiciliario y tiempos.

export const METODOS_DOMICILIO = [
  { id: 'Efectivo', label: 'Efectivo' },
  { id: 'Nequi', label: 'Nequi' },
  { id: 'Daviplata', label: 'Daviplata' },
  { id: 'Transferencia', label: 'Transferencia' },
  { id: 'Tarjeta', label: 'Tarjeta (datáfono)' },
];

/** Etapas en el orden real: se recibe, cocina lo prepara, sale y se entrega. */
export const ETAPAS = [
  { id: 'recibido', titulo: 'Recibidos', ayuda: 'La cocina aún no los empieza: el cliente todavía puede cambiarlos' },
  { id: 'cocina', titulo: 'En cocina', ayuda: 'Preparándose' },
  { id: 'listo', titulo: 'Listos para salir', ayuda: 'Esperan al domiciliario' },
  { id: 'camino', titulo: 'En camino', ayuda: 'Con el domiciliario' },
];

export const etapaDomicilio = (d) => {
  switch (d?.estado) {
    case 'EnPreparacion': return d.cocinaEmpezo ? 'cocina' : 'recibido';
    case 'Listo': return 'listo';
    case 'Recogido':
    case 'EnCamino': return 'camino';
    case 'Entregado': return 'entregado';
    default: return 'cancelado';
  }
};

export const activo = (d) => ['recibido', 'cocina', 'listo', 'camino'].includes(etapaDomicilio(d));

/** Se puede cancelar mientras no se haya entregado; si ya salió, el domiciliario debe volver. */
export const cancelable = (d) => activo(d);

/** Se puede reasignar mientras no haya salido del restaurante. */
export const reasignable = (d) => ['recibido', 'cocina', 'listo'].includes(etapaDomicilio(d));

/** Cambio que debe llevar el domiciliario (null si no aplica o no alcanza). */
export const cambioDomicilio = (total, pagaCon) => {
  const billete = Number(pagaCon);
  return pagaCon === '' || pagaCon == null || !(billete >= total) ? null : billete - total;
};

/** Total del domicilio: productos + envío. */
export const totalDomicilio = (lineas = [], envio = 0) =>
  lineas.reduce((t, l) => t + (Number(l.precio) || 0) * (Number(l.cantidad) || 0), 0) + (Number(envio) || 0);

export const minutosDesde = (fecha, ahora = new Date()) => Math.max(0, Math.floor((ahora - new Date(fecha)) / 60000));

/** Teléfono colombiano: 10 dígitos y empieza por 3 (celular) o 60 (fijo). */
export const telefonoValido = (telefono) => /^(3\d{9}|60\d{8})$/.test(String(telefono ?? '').replace(/\D/g, ''));

/** Resumen por domiciliario de lo que lleva en curso. */
export const cargaDomiciliarios = (domiciliarios = [], domicilios = []) =>
  domiciliarios.map((u) => ({
    ...u,
    enCurso: domicilios.filter((d) => d.domiciliarioId === u.id && activo(d)).length,
  }));
