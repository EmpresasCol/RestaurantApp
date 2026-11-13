// Reglas de caja (sin React, para poder probarlas): cuentas por mesa, cuentas compartidas, pagos,
// propina, cambio y arqueo. Los montos replican lo que valida la API en POST /pagos/cobro y en el
// cierre; el servidor tiene la última palabra.

const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
export const pesos = (valor) => cop.format(Math.round(Number(valor) || 0));

export const METODOS = [
  { id: 'Efectivo', label: 'Efectivo' },
  { id: 'Tarjeta', label: 'Tarjeta' },
  { id: 'QR', label: 'Transferencia o QR', ayuda: 'Nequi, Daviplata, Bancolombia' },
  { id: 'Otro', label: 'Otro' },
];

export const nombreMetodo = (m) => METODOS.find((x) => x.id === m)?.label ?? m;

/** Un plato cobrado en una cuenta dividida ya no se debe. */
const debe = (d) => !d.pagado;

/** Lo que falta cobrar del pedido (la API congela el precio al pedir). */
export const consumoPedido = (pedido) =>
  (pedido?.detalles ?? []).filter(debe).reduce((t, d) => t + (Number(d.precio) || 0) * (Number(d.cantidad) || 0), 0);

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
 * pero la mesa paga una sola cuenta. `solicitud`: la cuenta que pidió el mesero desde la app.
 * Las que piden la cuenta van primero: el mesero está esperando en caja.
 */
export const agruparCuentas = (pedidos = [], solicitudes = []) => {
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
        platos: pedidosOrdenados.reduce((t, p) => t + p.detalles.filter(debe).reduce((s, d) => s + d.cantidad, 0), 0),
        pagadoParcial: pedidosOrdenados.some((p) => p.detalles.some((d) => d.pagado)),
        solicitud: solicitudes.find((s) => s.mesaId === c.mesaId) ?? null,
      };
    })
    .sort((a, b) => (!!b.solicitud - !!a.solicitud) || a.mesaNumero - b.mesaNumero);
};

const PAGO_AVISADO = {
  Efectivo: 'Paga en efectivo: el mesero lo trae',
  Tarjeta: 'Pagó con tarjeta en el datáfono',
  QR: 'Pagó por transferencia',
};

/**
 * Situación de la cuenta que pidió el mesero:
 * `pedida` (solo pidió la cuenta), `pagada` (sus pagos cubren todo: la caja confirma)
 * o `parcial` (pagó una parte: la caja completa el resto).
 */
export const estadoSolicitud = (solicitud) => {
  if (!solicitud) return null;
  if (solicitud.cuadra) return 'pagada';
  if ((solicitud.pagos ?? []).length > 0 || solicitud.metodoPago) return 'parcial';
  return 'pedida';
};

/** Texto de la solicitud del mesero para la tarjeta de la mesa. */
export const textoSolicitud = (solicitud) => {
  const estado = estadoSolicitud(solicitud);
  if (!estado) return null;
  if (estado === 'pedida') return 'Pidió la cuenta';
  if (estado === 'pagada') return 'Ya pagó: confirma el cobro';
  if (!(solicitud.pagos ?? []).length) return PAGO_AVISADO[solicitud.metodoPago] ?? solicitud.metodoPago;
  return `Pagó ${pesos(solicitud.totalAvisado)} de ${pesos((solicitud.porCobrar ?? 0) + (solicitud.propina ?? 0))}`;
};

/** Mismo plato al mismo precio en varios pedidos: una sola línea, como en la factura. */
export const lineasCuenta = (pedidos = []) => {
  const lineas = new Map();
  pedidos.forEach((p) => p.detalles.filter(debe).forEach((d) => {
    const clave = `${d.platilloId}-${d.precio}`;
    const l = lineas.get(clave) ?? { nombre: d.platilloNombre, precio: d.precio, cantidad: 0 };
    l.cantidad += d.cantidad;
    lineas.set(clave, l);
  }));
  return [...lineas.values()].map((l) => ({ ...l, total: l.precio * l.cantidad }));
};

/** Platos que se pueden cobrar uno a uno (cada quien paga lo suyo): solo lo que ya salió de cocina. */
export const platosPorCobrar = (pedidos = []) =>
  pedidos.filter(cobrable).flatMap((p) => p.detalles.filter(debe).map((d) => ({
    detalleId: d.id, pedidoId: p.id, nombre: d.platilloNombre, nota: d.nota, precio: Number(d.precio) || 0, cantidad: d.cantidad,
  })));

/** Consumo de lo elegido: { detalleId: unidades }. */
export const consumoElegido = (platos, elegidos) =>
  platos.reduce((t, p) => t + p.precio * Math.min(p.cantidad, Number(elegidos[p.detalleId]) || 0), 0);

/** Propina voluntaria sugerida (10 % en Colombia), redondeada a centenas como se paga en efectivo. */
export const propinaSugerida = (consumo, tasa = 0.1) => Math.round((consumo * tasa) / 100) * 100;

/**
 * Un total en n partes iguales redondeadas a centenas (como se paga de verdad);
 * la última se ajusta para que la suma sea exacta.
 */
export const partesIguales = (total, n) => {
  const partes = Math.floor(Number(n));
  if (!(partes >= 1) || !(total > 0)) return [];
  const parte = Math.round(total / partes / 100) * 100;
  const ultima = total - parte * (partes - 1);
  if (ultima <= 0) return partesIguales(total, partes - 1);
  return [...Array(partes - 1).fill(parte), ultima];
};

const vacio = (v) => v === '' || v == null;

/** Monto de cada pago; el primer renglón sin monto se lleva lo que falta para el total. */
export const montosPagos = (pagos, total) => {
  const fijos = pagos.reduce((t, p) => t + (vacio(p.monto) ? 0 : Number(p.monto) || 0), 0);
  let resto = Math.max(0, total - fijos);
  return pagos.map((p) => {
    if (!vacio(p.monto)) return Number(p.monto) || 0;
    const m = resto;
    resto = 0;
    return m;
  });
};

/** Lo pagado frente al total: { pagado, falta, sobra }. */
export const resumenPagos = (montos, total) => {
  const pagado = montos.reduce((t, m) => t + m, 0);
  return { pagado, falta: Math.max(0, total - pagado), sobra: Math.max(0, pagado - total) };
};

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

// ── Cierre de caja ─────────────────────────────────────────────────────

/** Billetes y monedas en circulación en Colombia, para contar el cajón. */
export const DENOMINACIONES = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50];

/** Total contado: { denominación: cantidad }. */
export const contarBilletes = (conteo = {}) =>
  Object.entries(conteo).reduce((t, [d, n]) => t + Number(d) * (Math.max(0, Math.floor(Number(n))) || 0), 0);

const numero = (v) => (vacio(v) || Number.isNaN(Number(v)) ? null : Number(v));

/** Diferencia entre lo real y lo que dice el sistema. Menos de un peso es redondeo. */
export const diferencia = (real, sistema) => {
  const valor = numero(real);
  if (valor == null) return { diferencia: null, estado: 'sin-contar' };
  const d = valor - sistema;
  return { diferencia: d, estado: Math.abs(d) < 1 ? 'cuadra' : d > 0 ? 'sobra' : 'falta' };
};

/**
 * Arqueo como se hace en la caja: efectivo esperado = base + cobros en efectivo (mesa y lo que
 * entregaron los domiciliarios) − propinas pagadas al equipo − gastos o retiros del cajón.
 * Tarjeta y transferencias se comparan con el cierre del datáfono y con el banco.
 */
export const arqueo = (cierre, { propinasPagadas, retiros, contado, datafono, banco } = {}) => {
  const esperado = (cierre?.base ?? 0) + (cierre?.efectivoMesa ?? 0) + (cierre?.efectivoDomicilios ?? 0)
    - (numero(propinasPagadas) ?? 0) - (numero(retiros) ?? 0);
  return {
    esperado,
    efectivo: diferencia(contado, esperado),
    tarjeta: diferencia(datafono, cierre?.tarjeta ?? 0),
    transferencias: diferencia(banco, cierre?.transferencias ?? 0),
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

/**
 * Estado de la mesa en el tablero: `libre`, `ocupada` o `pago` (pidió la cuenta o está
 * esperando pago). Lo abierto manda sobre el campo Estado: una mesa con consumo nunca se ve libre.
 * Los indicadores (llamada, platos listos) van aparte del estado.
 */
export const estadoTablero = (mesa, cuenta = null, llamada = null) => {
  const abierta = !!cuenta && cuenta.pedidos.length > 0;
  const pidioCuenta = mesa?.estado === 'EsperandoPago' || (abierta && !!cuenta.solicitud);
  const estado = pidioCuenta ? 'pago' : abierta || mesa?.estado === 'Ocupada' ? 'ocupada' : 'libre';
  return {
    estado,
    listos: cuenta ? cuenta.pedidos.filter((p) => p.estado === 'Listo').length : 0,
    llamada: llamada ?? null,
    // Solo una mesa sin pedidos abiertos se libera; la API vuelve a validarlo.
    puedeLiberar: estado !== 'libre' && !abierta,
  };
};
