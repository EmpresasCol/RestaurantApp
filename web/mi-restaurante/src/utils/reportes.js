// Periodos y exportación de los reportes (sin React, para poder probarlos).
// Los cortes por día los hace la API en hora de Colombia; aquí solo se arman las fechas.

// Colores validados con el validador de paleta (CVD y contraste sobre blanco).
export const COLOR_MESA = '#C4762B';
export const COLOR_DOMICILIO = '#00809A';

const iso = (f) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${f.getFullYear()}-${p(f.getMonth() + 1)}-${p(f.getDate())}`;
};

export const PERIODOS = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'ayer', label: 'Ayer' },
  { id: '7dias', label: 'Últimos 7 días' },
  { id: 'mes', label: 'Este mes' },
  { id: 'mesPasado', label: 'Mes pasado' },
  { id: 'rango', label: 'Otras fechas' },
];

/** Desde y hasta (yyyy-mm-dd, ambos incluidos) de un periodo, contado desde `hoy`. */
export const rangoPeriodo = (periodo, hoy = new Date()) => {
  const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  switch (periodo) {
    case 'ayer': {
      const a = new Date(d); a.setDate(d.getDate() - 1);
      return { desde: iso(a), hasta: iso(a) };
    }
    case '7dias': {
      const a = new Date(d); a.setDate(d.getDate() - 6);
      return { desde: iso(a), hasta: iso(d) };
    }
    case 'mes':
      return { desde: iso(new Date(d.getFullYear(), d.getMonth(), 1)), hasta: iso(d) };
    case 'mesPasado':
      return { desde: iso(new Date(d.getFullYear(), d.getMonth() - 1, 1)), hasta: iso(new Date(d.getFullYear(), d.getMonth(), 0)) };
    default:
      return { desde: iso(d), hasta: iso(d) };
  }
};

/** "2026-10-05" → "5 oct" para los ejes y tablas. */
export const diaCorto = (fecha) => {
  const [a, m, dd] = fecha.split('-').map(Number);
  return new Date(a, m - 1, dd).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
};

/** Horas con ventas, con al menos la franja de 11 a 22 para que el día se lea completo. */
export const horasVisibles = (porHora = []) => {
  const conVentas = porHora.filter((h) => h.total > 0).map((h) => h.hora);
  const desde = Math.min(11, ...conVentas);
  const hasta = Math.max(22, ...conVentas);
  return porHora.filter((h) => h.hora >= desde && h.hora <= hasta);
};

export const etiquetaHora = (h) => (h === 0 ? '12 a. m.' : h < 12 ? `${h} a. m.` : h === 12 ? '12 m.' : `${h - 12} p. m.`);

/** Platillos de la carta que no se vendieron en el periodo (para revisar el menú). */
export const sinVentas = (carta = [], vendidos = []) => {
  const ids = new Set(vendidos.map((v) => v.platilloId));
  return carta.filter((p) => !ids.has(p.id) && p.activo !== false).map((p) => p.nombre).sort((a, b) => a.localeCompare(b, 'es'));
};

export const porcentaje = (parte, total) => (total > 0 ? Math.round((parte / total) * 100) : 0);

/** CSV del reporte (separado por ; para que Excel en español lo abra en columnas). */
export const csvReporte = (r) => {
  const celda = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const fila = (...v) => v.map(celda).join(';');
  return [
    fila('Reporte de ventas', `${r.desde} a ${r.hasta}`),
    fila('Ventas (impuesto incluido)', r.ventas),
    fila('Propinas', r.propinas),
    fila('Envíos', r.envios),
    fila('Cuentas y domicilios', r.numeroVentas),
    fila('Ticket promedio', r.ticketPromedio),
    fila('Pedidos anulados', r.pedidosAnulados, r.valorAnulado),
    '',
    fila('Día', 'Mesa', 'Domicilios', 'Total', 'Ventas'),
    ...r.porDia.map((d) => fila(d.fecha, d.mesa, d.domicilios, d.total, d.ventas)),
    '',
    fila('Método', 'Mesa', 'Propinas', 'Domicilios', 'Total', 'Cobros'),
    ...r.porMetodo.map((m) => fila(m.metodo, m.mesa, m.propinas, m.domicilios, m.total, m.cobros)),
    '',
    fila('Platillo', 'Categoría', 'Cantidad', 'Ingresos'),
    ...r.platillos.map((p) => fila(p.nombre, p.categoria, p.cantidad, p.ingresos)),
    '',
    fila('Mesero', 'Pedidos', 'Mesas', 'Ventas', 'Propinas'),
    ...r.meseros.map((m) => fila(m.nombre, m.pedidos, m.mesas, m.ventas, m.propinas)),
  ].join('\n');
};
