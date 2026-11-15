// src/utils/impuestos.js
// Los precios de la carta ya incluyen el impuesto. La factura solo muestra cuánto del total
// corresponde al impuesto; nunca lo suma, porque la API cobra exactamente el precio de la carta.
// El impuesto del restaurante (INC 8 %, IVA 19 % o ninguno) se define en Datos fiscales y la API
// lo guarda en cada factura. Estas constantes son el respaldo para las facturas anteriores y
// para la cuenta antes de cobrar cuando aún no se han cargado los datos fiscales.
export const NOMBRE_IMPUESTO = 'Impoconsumo';
export const TASA_IMPUESTO = 0.08;

const NOMBRES = { INC: 'Impoconsumo', IVA: 'IVA' };

/** { nombre, tasa } según los datos fiscales (config de GET api/fiscal); sin ellos, el respaldo. */
export const impuestoDe = (config) =>
  !config ? { nombre: NOMBRE_IMPUESTO, tasa: TASA_IMPUESTO }
    : config.tipoImpuesto === 'Ninguno' || !(config.tarifaImpuesto > 0) ? { nombre: null, tasa: 0 }
      : { nombre: NOMBRES[config.tipoImpuesto] ?? config.tipoImpuesto, tasa: config.tarifaImpuesto / 100 };

const porcentaje = (tasa) => String(Math.round(tasa * 10000) / 100).replace('.', ',');

export const etiquetaImpuesto = (config) => {
  const { nombre, tasa } = impuestoDe(config);
  return nombre ? `${nombre} (${porcentaje(tasa)}%) incluido` : 'Sin impuesto al consumo ni IVA';
};

/** Parte del valor (impuesto incluido) que corresponde al impuesto, redondeada a pesos. */
export const impuestoIncluido = (valorConImpuesto, config) => {
  const { tasa } = impuestoDe(config);
  return Math.round(valorConImpuesto - valorConImpuesto / (1 + tasa));
};

/**
 * Impuesto de una factura ya emitida: lo que guardó la API al cobrar; las facturas anteriores
 * (sin esos campos) usan el respaldo. Devuelve { etiqueta, valor, base }.
 */
export const impuestoFactura = (f) => {
  if (f?.valorImpuesto == null) {
    const valor = impuestoIncluido(f?.subtotal ?? 0);
    return { etiqueta: etiquetaImpuesto(), valor, base: (f?.subtotal ?? 0) - valor };
  }
  return {
    etiqueta: f.nombreImpuesto ? `${f.nombreImpuesto} (${porcentaje((f.tarifaImpuesto ?? 0) / 100)}%) incluido` : 'Sin impuesto al consumo ni IVA',
    valor: f.valorImpuesto,
    base: f.baseImpuesto ?? f.subtotal - f.valorImpuesto,
  };
};
