// Reglas de caja (sin React, para poder probarlas): cuentas por mesa, propina, cambio y cuadre.
// Los montos replican lo que valida la API en POST /pagos/cobro; el servidor tiene la última palabra.

const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
export const pesos = (valor) => cop.format(Math.round(Number(valor) || 0));

export const METODOS = [
  { id: 'Efectivo', label: 'Efectivo' },
  { id: 'Tarjeta', label: 'Tarjeta' },
  { id: 'QR', label: 'Transferencia o QR', ayuda: 'Nequi, Daviplata, Bancolombia' },
  { id: 'Otro', label: 'Otro' },
];

/** Precio por lo que se pidió (la API congela el precio al pedir). */
export const consumoPedido = (pedido) =>
  (pedido?.detalles ?? []).reduce((t, d) => t + (Number(d.precio) || 0) * (Number(d.cantidad) || 0), 0);

/** Un pedido que sigue en cocina no se cobra: desaparecería de la comanda. */
export const cobrable = (pedido) => pedido?.estado === 'Listo' || pedido?.estado === 'Entregado';

const ESTADOS = {
  EnProceso: { texto: 'En cocina', tono: 'aviso' },
  Listo: { texto: 'Listo para servir', tono: 'info' },
  Entregado: { texto: 'Servido', tono: 'ok' },
};
export const estadoPedido = (estado) => ESTADOS[estado] ?? { texto: estado, tono: 'neutro' };

/**
 * Cuentas abiertas por mesa: cada envío del QR o del mesero es un pedido aparte,
 * pero la mesa paga una sola cuenta.
 */
export const agruparCuentas = (pedidos = []) => {
  const porMesa = new Map();
  pedidos
    .filter((p) => ['EnProceso', 'Listo', 'Entregado'].includes(p.estado))
    .forEach((p) => {
      const clave = p.mesaId ?? p.mesaNumero;
      if (!porMesa.has(clave)) porMesa.set(clave, { mesaId: p.mesaId, mesaNumero: p.mesaNumero, pedidos: [] });
      porMesa.get(clave).pedidos.push(p);
    });

  return [...porMesa.values()]
    .map((c) => {
      const pedidosOrdenados = [...c.pedidos].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
      const cobrables = pedidosOrdenados.filter(cobrable);
      return {
        ...c,
        pedidos: pedidosOrdenados,
        desde: pedidosOrdenados[0]?.fecha,
        total: pedidosOrdenados.reduce((t, p) => t + consumoPedido(p), 0),
        totalCobrable: cobrables.reduce((t, p) => t + consumoPedido(p), 0),
        enCocina: pedidosOrdenados.length - cobrables.length,
        platos: pedidosOrdenados.reduce((t, p) => t + p.detalles.reduce((s, d) => s + d.cantidad, 0), 0),
      };
    })
    .sort((a, b) => a.mesaNumero - b.mesaNumero);
};

/** Mismo plato al mismo precio en varios pedidos: una sola línea, como en la factura. */
export const lineasCuenta = (pedidos = []) => {
  const lineas = new Map();
  pedidos.forEach((p) => p.detalles.forEach((d) => {
    const clave = `${d.platilloId}-${d.precio}`;
    const l = lineas.get(clave) ?? { nombre: d.platilloNombre, precio: d.precio, cantidad: 0 };
    l.cantidad += d.cantidad;
    lineas.set(clave, l);
  }));
  return [...lineas.values()].map((l) => ({ ...l, total: l.precio * l.cantidad }));
};

/** Propina voluntaria sugerida (10 % en Colombia), redondeada a centenas como se paga en efectivo. */
export const propinaSugerida = (consumo, tasa = 0.1) => Math.round((consumo * tasa) / 100) * 100;

/** Botones de efectivo: el valor exacto y los billetes con que suele pagar el cliente. */
export const billetesSugeridos = (total) => {
  if (!(total > 0)) return [];
  const opciones = [total];
  [10000, 20000, 50000, 100000].forEach((b) => {
    const redondo = Math.ceil(total / b) * b;
    if (redondo > total) opciones.push(redondo);
  });
  return [...new Set(opciones)].sort((a, b) => a - b).slice(0, 4);
};

/** Cambio a entregar; negativo = lo que falta. */
export const cambio = (recibido, total) => (Number(recibido) || 0) - total;

/** Cuadre del cajón: base con que se abrió + efectivo cobrado frente a lo que se contó. */
export const cuadreEfectivo = ({ base = 0, efectivo = 0, contado }) => {
  const esperado = (Number(base) || 0) + (Number(efectivo) || 0);
  const hayConteo = contado !== '' && contado != null && !Number.isNaN(Number(contado));
  const diferencia = hayConteo ? Number(contado) - esperado : null;
  return {
    esperado,
    diferencia,
    estado: diferencia == null ? 'sin-contar' : diferencia === 0 ? 'cuadra' : diferencia > 0 ? 'sobra' : 'falta',
  };
};

/** Cédula o NIT: igual que la API (dígitos y guion opcional del dígito de verificación). */
export const validarNit = (nit) => !String(nit ?? '').trim() || /^\d{5,15}(-\d)?$/.test(String(nit).trim());

/** Fecha local de Colombia yyyy-mm-dd (los cortes del día los hace la API en esa hora). */
export const hoyLocal = () => {
  const f = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${f.getFullYear()}-${p(f.getMonth() + 1)}-${p(f.getDate())}`;
};

export const hora = (fecha) => new Date(fecha).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
