// src/utils/impuestos.js
// Los precios de la carta ya incluyen el impuesto al consumo (restaurantes en Colombia:
// impoconsumo 8 %). La factura solo muestra cuánto del total corresponde al impuesto;
// nunca lo suma, porque la API cobra exactamente el precio de la carta.
// Si el asesor define IVA u otra tarifa, basta con cambiar estas dos constantes.
export const NOMBRE_IMPUESTO = 'Impoconsumo';
export const TASA_IMPUESTO = 0.08;

export const etiquetaImpuesto = () => `${NOMBRE_IMPUESTO} (${Math.round(TASA_IMPUESTO * 100)}%) incluido`;

/** Parte del valor (impuesto incluido) que corresponde al impuesto, redondeada a pesos. */
export const impuestoIncluido = (valorConImpuesto) =>
  Math.round(valorConImpuesto - valorConImpuesto / (1 + TASA_IMPUESTO));
