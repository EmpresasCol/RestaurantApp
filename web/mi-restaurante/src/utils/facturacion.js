// Reglas de presentación de la facturación electrónica: qué documento es, en qué va ante la DIAN
// y qué se le dice al cajero. La API decide; aquí solo se traduce a texto.

export const TIPOS_ID = [
  { id: 'CC', label: 'Cédula de ciudadanía' },
  { id: 'NIT', label: 'NIT' },
  { id: 'CE', label: 'Cédula de extranjería' },
  { id: 'TI', label: 'Tarjeta de identidad' },
  { id: 'PA', label: 'Pasaporte' },
];

const TITULOS = {
  POS: 'Documento equivalente electrónico tiquete POS',
  FEV: 'Factura electrónica de venta',
  NotaAjuste: 'Nota de ajuste',
  NotaCredito: 'Nota crédito',
};

/** Documento de venta de la factura (POS o factura electrónica); null en las facturas sin DIAN. */
export const documentoVenta = (f) => (f?.documentos ?? []).find((d) => d.tipo === 'POS' || d.tipo === 'FEV') ?? null;

/** Nota que anuló el documento de venta, si la hay. */
export const notaDe = (f) => (f?.documentos ?? []).find((d) => d.tipo === 'NotaAjuste' || d.tipo === 'NotaCredito') ?? null;

export const tituloDocumento = (f) => TITULOS[documentoVenta(f)?.tipo] ?? 'Factura de venta';

export const nombreTipoDocumento = (tipo) => TITULOS[tipo] ?? tipo;

/** CUFE para la factura electrónica, CUDE para el POS y las notas. */
export const nombreCodigo = (tipo) => (tipo === 'FEV' ? 'CUFE' : 'CUDE');

/**
 * La DIAN rechazó algo que hay que reenviar antes de cerrar la caja: la venta de una factura
 * vigente o la nota de una anulada cuya venta sí validó. (Misma regla que la API.)
 */
export const rechazoPorResolver = (f) => {
  const doc = documentoVenta(f);
  if (!doc) return false;
  return f.anulada ? doc.estado === 'Validado' && notaDe(f)?.estado === 'Rechazado' : doc.estado === 'Rechazado';
};

/**
 * Estado que ve el cajero: { texto, tono, detalle }. Una factura sin documento electrónico
 * devuelve null (consecutivo interno, anterior a la facturación electrónica).
 */
export const estadoDian = (f) => {
  const doc = documentoVenta(f);
  if (!doc) return f?.anulada ? { texto: 'Anulada', tono: 'peligro', detalle: f.motivoAnulacion } : null;
  if (f.anulada) {
    const nota = notaDe(f);
    if (rechazoPorResolver(f)) return { texto: 'Anulada · nota rechazada', tono: 'peligro', detalle: `${f.motivoAnulacion} · DIAN: ${nota.mensaje ?? 'sin motivo'}` };
    // Si la DIAN nunca validó la venta, la nota no hace falta: no queda nada en proceso.
    const pendiente = nota?.estado === 'Pendiente';
    return { texto: pendiente ? 'Anulada · nota en proceso' : 'Anulada', tono: 'peligro', detalle: f.motivoAnulacion };
  }
  if (doc.estado === 'Validado') return { texto: 'Validada por la DIAN', tono: 'ok', detalle: null };
  if (doc.estado === 'Rechazado') return { texto: 'Rechazada por la DIAN', tono: 'peligro', detalle: doc.mensaje };
  return doc.enContingencia
    ? { texto: 'Sin respuesta · reintentando', tono: 'aviso', detalle: doc.mensaje }
    : { texto: 'En validación', tono: 'info', detalle: null };
};

/** Numeración de la que salió el número de la factura (para citar la resolución en la tirilla). */
export const numeracionDe = (f, numeraciones = []) => {
  const doc = documentoVenta(f);
  if (!doc) return null;
  return numeraciones.find((n) => n.tipoDocumento === doc.tipo && doc.numero.startsWith(n.prefijo)
    && Number(doc.numero.slice(n.prefijo.length)) >= n.desde && Number(doc.numero.slice(n.prefijo.length)) <= n.hasta) ?? null;
};

/** Dígito de verificación de un NIT (módulo 11 con los pesos de la DIAN). */
export const digitoVerificacion = (nit) => {
  const pesos = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
  const digitos = String(nit ?? '').replace(/\D/g, '').split('').reverse();
  const resto = digitos.reduce((s, d, i) => s + Number(d) * pesos[i], 0) % 11;
  return resto > 1 ? 11 - resto : resto;
};

/**
 * Error de los datos del cliente que pide factura a su nombre, o null. Las mismas reglas que la
 * API, para avisar antes de enviar.
 */
export const errorCliente = ({ tipoId, nit, nombre, correo }) => {
  const doc = String(nit ?? '').trim();
  if (!doc) return 'Escribe el número de identificación del cliente';
  if (tipoId === 'CE' || tipoId === 'PA') {
    if (!/^[A-Za-z0-9]{4,20}$/.test(doc)) return 'El documento solo lleva letras y números';
  } else if (!/^\d{5,15}(-\d)?$/.test(doc)) {
    return 'La identificación solo lleva números (y un guion antes del dígito de verificación)';
  } else if (tipoId === 'NIT' && doc.includes('-') && Number(doc.slice(-1)) !== digitoVerificacion(doc.slice(0, -2))) {
    return 'El dígito de verificación del NIT no coincide';
  }
  if (!String(nombre ?? '').trim()) return 'Escribe el nombre o la razón social del cliente';
  if (String(correo ?? '').trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(correo).trim())) return 'El correo del cliente no es válido';
  return null;
};
