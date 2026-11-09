// src/services/domiciliosApi.js
// Clientes, direcciones y domicilios: lo que usan Domicilios, Cocina y Caja.
import { getApiBaseUrl, encabezadosAuth, manejarNoAutorizado } from './sesion';

const API_URL = getApiBaseUrl();

const fetchWithHeaders = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': '69420',
      ...encabezadosAuth(),
      ...options.headers,
    },
  });
  manejarNoAutorizado(response.status);
  return response;
};

// La API responde { message }, un texto o un ProblemDetails; se devuelve un Error legible.
const errorDe = async (response, respaldo) => {
  const texto = await response.text().catch(() => '');
  try {
    const json = JSON.parse(texto);
    if (typeof json === 'string') return new Error(json);
    return new Error(json.message || Object.values(json.errors ?? {}).flat()[0] || json.title || respaldo);
  } catch {
    return new Error(texto || respaldo);
  }
};

const pedir = async (ruta, respaldo, opciones) => {
  const response = await fetchWithHeaders(`${API_URL}${ruta}`, opciones);
  if (!response.ok) throw await errorDe(response, respaldo);
  const texto = await response.text();
  return texto ? JSON.parse(texto) : null;
};

const enviar = (ruta, respaldo, metodo, cuerpo) =>
  pedir(ruta, respaldo, { method: metodo, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });

// ==================== CLIENTES Y DIRECCIONES ====================
/** Cliente por teléfono, o null si no existe. */
export const buscarClientePorTelefono = async (telefono) => {
  const response = await fetchWithHeaders(`${API_URL}/clientes/telefono/${encodeURIComponent(telefono)}`);
  if (response.status === 404) return null;
  if (!response.ok) throw await errorDe(response, 'No se pudo buscar el cliente');
  return response.json();
};

export const createClienteConDireccion = (data) => enviar('/clientes/con-direccion', 'No se pudo crear el cliente', 'POST', data);

export const getDireccionesCliente = (clienteId) => pedir(`/direcciones/cliente/${clienteId}`, 'No se pudieron cargar las direcciones');

export const createDireccion = (clienteId, direccion) =>
  enviar(`/direcciones?clienteId=${clienteId}`, 'No se pudo guardar la dirección', 'POST', direccion);

// ==================== DOMICILIOS ====================
export const getDomicilios = () => pedir('/domicilios', 'No se pudieron cargar los domicilios');

/** En cocina, listos, recogidos o en camino. */
export const getDomiciliosActivos = () => pedir('/domicilios/activos', 'No se pudieron cargar los domicilios');

/** Los del día (hora de Colombia) más los que siguen en curso de días anteriores. */
export const getDomiciliosHoy = () => pedir('/domicilios/hoy', 'No se pudieron cargar los domicilios');

export const getDomicilio = (id) => pedir(`/domicilios/${id}`, 'No se pudo cargar el domicilio');

export const createDomicilio = (domicilio) => enviar('/domicilios', 'No se pudo crear el domicilio', 'POST', domicilio);

/** La cocina empieza el domicilio: desde ahí el cliente ya no lo cambia. */
export const prepararDomicilio = (id) => enviar(`/domicilios/${id}/preparar`, 'No se pudo empezar el domicilio', 'PUT');

/**
 * Cambia el estado. extra: { metodoPago } al entregar (cómo pagó de verdad) o { motivo } al cancelar.
 */
export const actualizarEstadoDomicilio = (id, estado, extra = {}) =>
  enviar(`/domicilios/${id}/estado`, 'No se pudo actualizar el domicilio', 'PUT', { estado, ...extra });

export const actualizarMetodoPagoDomicilio = (id, metodoPago, pagadoAnticipado, pagaCon = null) =>
  enviar(`/domicilios/${id}/metodo-pago`, 'No se pudo cambiar el pago', 'PUT', { metodoPago, pagadoAnticipado, pagaCon });

/** null devuelve el domicilio a la bolsa común de "para recoger". */
export const asignarDomiciliario = (id, domiciliarioId) =>
  enviar(`/domicilios/${id}/domiciliario`, 'No se pudo asignar el domiciliario', 'PUT', { domiciliarioId });

export const getDomiciliarios = () => pedir('/domicilios/domiciliarios', 'No se pudieron cargar los domiciliarios');

export const getComprobanteDomicilio = async (id) =>
  (await pedir(`/domicilios/${id}/comprobante`, 'No se pudo cargar el comprobante')).comprobante;

// ==================== EFECTIVO DE LOS DOMICILIARIOS ====================
/** Efectivo que cada domiciliario cobró y no ha entregado en caja. */
export const getLiquidaciones = () => pedir('/domicilios/liquidaciones', 'No se pudo cargar el efectivo de los domiciliarios');

/** La caja recibe el efectivo del domiciliario. */
export const liquidarDomiciliario = (domiciliarioId) =>
  enviar(`/domicilios/liquidaciones/${domiciliarioId}`, 'No se pudo registrar el efectivo recibido', 'POST');

// ==================== ESTADÍSTICAS ====================
export const getEstadisticasDomicilios = () => pedir('/domicilios/estadisticas/hoy', 'No se pudieron cargar las estadísticas');
