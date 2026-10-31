// src/utils/inventario.js
// Formatos y textos del módulo de inventario (sin React, para poder probarlos).

const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const numero = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });

export const formatearCOP = (valor) => cop.format(Number(valor) || 0);

export const formatearCantidad = (valor, unidad) =>
  `${numero.format(Number(valor) || 0)}${unidad ? ` ${unidad}` : ''}`;

/** "2026-11-04T00:00:00" → "4 nov 2026" sin desfase de zona (las fechas de lote son de calendario). */
export const formatearFecha = (iso) => {
  if (!iso) return '—';
  const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
};

/** Fecha local de hoy (+dias) en formato yyyy-mm-dd para inputs type="date". */
export const fechaISO = (dias = 0) => {
  const f = new Date();
  f.setDate(f.getDate() + dias);
  const p = (n) => String(n).padStart(2, '0');
  return `${f.getFullYear()}-${p(f.getMonth() + 1)}-${p(f.getDate())}`;
};

export const textoVencimiento = (dias) => {
  if (dias == null) return 'Sin fecha de vencimiento';
  if (dias < -1) return `Venció hace ${-dias} días`;
  if (dias === -1) return 'Venció ayer';
  if (dias === 0) return 'Vence hoy';
  if (dias === 1) return 'Vence mañana';
  return `Vence en ${dias} días`;
};

/** Gravedad del vencimiento para el color del chip: vencido, pronto (≤3 días), aviso o normal. */
export const nivelVencimiento = (dias) => {
  if (dias == null) return 'normal';
  if (dias < 0) return 'vencido';
  if (dias <= 3) return 'pronto';
  if (dias <= 7) return 'aviso';
  return 'normal';
};

export const textoCobertura = (dias) => {
  if (dias == null) return 'Sin ventas recientes';
  if (dias < 1) return 'Alcanza para menos de un día';
  return `Alcanza para ${Math.floor(dias)} día${Math.floor(dias) === 1 ? '' : 's'}`;
};

/** Número colombiano para wa.me: solo dígitos y con indicativo 57 si viene a 10 dígitos. */
export const telefonoWhatsApp = (telefono) => {
  const digitos = String(telefono ?? '').replace(/\D/g, '');
  if (!digitos) return null;
  return digitos.length === 10 ? `57${digitos}` : digitos;
};

/**
 * Mensaje para enviar la orden al proveedor. Cada línea va en la presentación de compra
 * cuando la hay ("3 × Caja 10 kg") y si no en la unidad del insumo.
 */
export const textoPedidoProveedor = ({ numeroOrden, proveedor, fechaEntrega, lineas, restaurante = 'Qpro' }) => {
  const partes = [`Hola ${proveedor}, le escribimos de ${restaurante}.`, `Pedido ${numeroOrden}:`];
  lineas.forEach((l) => {
    partes.push(l.presentacion
      ? `• ${numero.format(l.paquetes)} × ${l.presentacion} (${l.insumo})`
      : `• ${formatearCantidad(l.cantidad, l.unidad)} de ${l.insumo}`);
  });
  if (fechaEntrega) partes.push(`Entrega: ${formatearFecha(fechaEntrega)}.`);
  partes.push('Gracias.');
  return partes.join('\n');
};

export const enlaceWhatsApp = (telefono, texto) => {
  const numeroWa = telefonoWhatsApp(telefono);
  const q = encodeURIComponent(texto);
  return numeroWa ? `https://wa.me/${numeroWa}?text=${q}` : `https://wa.me/?text=${q}`;
};

/** Paquetes enteros que cubren una cantidad en unidad base. */
export const paquetesPara = (cantidad, factor) => (factor > 0 ? Math.ceil((Number(cantidad) || 0) / factor) : 0);
