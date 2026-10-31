// src/services/api.js
import { getApiBaseUrl, encabezadosAuth, manejarNoAutorizado } from './sesion';

const API_URL = getApiBaseUrl();

// Toda petición lleva el JWT de la sesión; un 401 cierra la sesión vencida.
const fetchWithHeaders = async (url, options = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': '69420', // evita la página de advertencia si la API está tras ngrok
    ...encabezadosAuth(),
    ...options.headers
  };

  const response = await fetch(url, {
    ...options,
    headers
  });
  if (!url.endsWith('/login')) manejarNoAutorizado(response.status);
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

// ==================== AUTENTICACIÓN ====================
export const login = async (usuario, clave) => {
  try {
    const response = await fetchWithHeaders(`${API_URL}/usuarios/login`, {
      method: 'POST',
      body: JSON.stringify({ usuario, clave })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Credenciales inválidas' }));
      throw new Error(errorData.message || 'Credenciales inválidas');
    }

    return await response.json();
  } catch (error) {
    console.error('❌ Error en login:', error);
    throw error;
  }
};

// ==================== PLATILLOS ====================
/** La carta. Con todos=true el administrador recibe también los platillos ocultos. */
export const getPlatillos = async (todos = false) => {
  try {
    const response = await fetchWithHeaders(`${API_URL}/platillos${todos ? '?todos=true' : ''}`);
    if (!response.ok) throw new Error('Error al obtener platillos');
    return await response.json();
  } catch (error) {
    console.error('Error en getPlatillos:', error);
    throw error;
  }
};

export const getPlatillo = async (id) => {
  try {
    const response = await fetchWithHeaders(`${API_URL}/platillos/${id}`);
    if (!response.ok) throw new Error('Error al obtener platillo');
    return await response.json();
  } catch (error) {
    console.error('Error en getPlatillo:', error);
    throw error;
  }
};

export const createPlatillo = async (platilloData) => {
  const response = await fetchWithHeaders(`${API_URL}/platillos`, {
    method: 'POST',
    body: JSON.stringify(platilloData)
  });
  if (!response.ok) throw await errorDe(response, 'No se pudo crear el platillo');
  return await response.json();
};

export const updatePlatillo = async (id, platilloData) => {
  const response = await fetchWithHeaders(`${API_URL}/platillos/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ id, ...platilloData })
  });
  if (!response.ok) throw await errorDe(response, 'No se pudo actualizar el platillo');
  return { success: true };
};

export const cambiarActivoPlatillo = async (id, activo) => {
  const response = await fetchWithHeaders(`${API_URL}/platillos/${id}/activo`, {
    method: 'PUT',
    body: JSON.stringify({ activo })
  });
  if (!response.ok) throw await errorDe(response, 'No se pudo cambiar el platillo');
  return { success: true };
};

export const deletePlatillo = async (id) => {
  const response = await fetchWithHeaders(`${API_URL}/platillos/${id}`, { method: 'DELETE' });
  if (!response.ok) throw await errorDe(response, 'No se pudo eliminar el platillo');
  return { success: true };
};

// ==================== MESAS ====================
export const getMesas = async () => {
  try {
    const response = await fetchWithHeaders(`${API_URL}/mesas`);
    if (!response.ok) throw new Error('Error al obtener mesas');
    return await response.json();
  } catch (error) {
    console.error('Error en getMesas:', error);
    throw error;
  }
};

export const updateEstadoMesa = async (id, estado) => {
  try {
    const response = await fetchWithHeaders(`${API_URL}/mesas/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ Id: id, Numero: 0, Estado: estado })
    });
    if (!response.ok) throw new Error('Error al actualizar mesa');
    return response;
  } catch (error) {
    console.error('Error en updateEstadoMesa:', error);
    throw error;
  }
};

/** Número de la mesa a partir del código de su QR (público); null si el código no existe. */
export const getMesaPorCodigo = async (codigo) => {
  const response = await fetchWithHeaders(`${API_URL}/mesas/qr/${encodeURIComponent(codigo)}`);
  if (response.status === 404) return null;
  if (!response.ok) throw await errorDe(response, 'No se pudo leer el código de la mesa');
  return await response.json();
};

/** Cambia el código de todas las mesas: los QR impresos antes dejan de servir. */
export const regenerarCodigosMesas = async () => {
  const response = await fetchWithHeaders(`${API_URL}/mesas/codigos`, { method: 'POST' });
  if (!response.ok) throw await errorDe(response, 'No se pudieron cambiar los códigos');
  return await response.json();
};

/** Deja el salón con las mesas 1..cantidad y devuelve la lista resultante. */
export const fijarCantidadMesas = async (cantidad) => {
  const response = await fetchWithHeaders(`${API_URL}/mesas/cantidad`, {
    method: 'PUT',
    body: JSON.stringify({ cantidad })
  });
  if (!response.ok) throw await errorDe(response, 'No se pudo cambiar el número de mesas');
  return await response.json();
};

// ==================== PEDIDOS ====================
export const getPedidos = async () => {
  try {
    const response = await fetchWithHeaders(`${API_URL}/pedidos`);
    if (!response.ok) throw new Error('Error al obtener pedidos');
    return await response.json();
  } catch (error) {
    console.error('Error en getPedidos:', error);
    throw error;
  }
};

// Solo pedidos abiertos (EnProceso, Listo, Entregado): lo que cocina consulta en cada ciclo.
export const getPedidosActivos = async () => {
  const response = await fetchWithHeaders(`${API_URL}/pedidos/activos`);
  if (!response.ok) throw new Error('Error al obtener pedidos activos');
  return await response.json();
};

const detallesPedido = (items) => items.map((item) => ({
  platilloId: item.id,
  cantidad: item.cantidad,
  nota: item.nota || item.notas || ''
}));

const enviarPedido = async (cuerpo) => {
  const response = await fetchWithHeaders(`${API_URL}/pedidos`, {
    method: 'POST',
    body: JSON.stringify(cuerpo)
  });
  if (!response.ok) {
    const error = await errorDe(response, 'No se pudo enviar el pedido');
    throw new Error(`Error al crear pedido: ${error.message}`);
  }
  return await response.json();
};

/** Pedido del personal (con sesión): la mesa va por su Id. */
export const createPedido = (mesaId, items) => enviarPedido({ mesaId, detalles: detallesPedido(items) });

/** Pedido del comensal: la mesa va por el código secreto de su QR; la API ignora cualquier Id. */
export const createPedidoQR = (codigoMesa, items) => enviarPedido({ codigoMesa, detalles: detallesPedido(items) });

/**
 * Actualiza el estado de un pedido
 * @param {number} id - ID del pedido
 * @param {string} estado - Nuevo estado (Pendiente, EnPreparacion, Listo, Entregado, Pagado, Cancelado)
 * @returns {Promise} - Resultado de la actualización
 */
export const updatePedido = async (id, estado) => {
  try {
    console.log('🔄 Actualizando estado del pedido:', { id, estado });

    const response = await fetchWithHeaders(`${API_URL}/pedidos/${id}/estado`, {
      method: 'PUT',
      body: JSON.stringify({ estado: estado })
    });

    console.log('📡 Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error del servidor:', errorText);
      throw new Error(`Error al actualizar pedido: ${errorText}`);
    }

    if (response.status === 204) {
      console.log('✅ Pedido actualizado exitosamente (204 No Content)');
      return { success: true };
    }

    const data = await response.json();
    console.log('✅ Pedido actualizado:', data);
    return data;
  } catch (error) {
    console.error('❌ Error en updatePedido:', error);
    throw error;
  }
};

/**
 * Actualiza el estado de un pedido (alias para compatibilidad)
 * @param {number} pedidoId - ID del pedido
 * @param {string} nuevoEstado - Nuevo estado del pedido
 * @returns {Promise} - Resultado de la actualización
 */
export const actualizarEstadoPedido = async (pedidoId, nuevoEstado) => {
  try {
    console.log(`🔄 Actualizando pedido ${pedidoId} → ${nuevoEstado}`);
    console.log(`📍 URL: ${API_URL}/pedidos/${pedidoId}/estado`);
    
    const response = await fetchWithHeaders(`${API_URL}/pedidos/${pedidoId}/estado`, {
      method: 'PUT',
      body: JSON.stringify({ estado: nuevoEstado })
    });

    console.log(`📡 Status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Error del servidor: ${errorText}`);
      throw new Error(`Error al actualizar estado del pedido: ${errorText}`);
    }

    if (response.status === 204) {
      console.log('✅ Pedido actualizado exitosamente (204 No Content)');
      return { success: true };
    }

    const resultado = await response.json();
    console.log('✅ Pedido actualizado:', resultado);
    return resultado;
  } catch (error) {
    console.error('❌ Error en actualizarEstadoPedido:', error);
    throw error;
  }
};

// ==================== PAGOS ====================
export const createPago = async (pedidoId, monto, metodoPago, montoPropina = 0) => {
  try {
    const pagoData = {
      pedidoId: pedidoId,
      monto: monto,
      montoPropina: montoPropina,
      metodoPago: metodoPago
    };

    console.log('💳 Enviando pago:', pagoData);

    const response = await fetchWithHeaders(`${API_URL}/pagos`, {
      method: 'POST',
      body: JSON.stringify(pagoData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error al crear pago: ${errorText}`);
    }

    const resultado = await response.json();
    console.log('✅ Pago creado:', resultado);
    return resultado;
  } catch (error) {
    console.error('❌ Error en createPago:', error);
    throw error;
  }
};

export const getPagos = async () => {
  try {
    const response = await fetchWithHeaders(`${API_URL}/pagos`);
    if (!response.ok) throw new Error('Error al obtener pagos');
    return await response.json();
  } catch (error) {
    console.error('Error en getPagos:', error);
    throw error;
  }
};

// ==================== FACTURAS ====================
export const getFacturas = async () => {
  try {
    const response = await fetchWithHeaders(`${API_URL}/facturas`);
    if (!response.ok) throw new Error('Error al obtener facturas');
    return await response.json();
  } catch (error) {
    console.error('Error en getFacturas:', error);
    throw error;
  }
};

export const createFactura = async (pagoId, nitCliente = null, nombreCliente = null) => {
  try {
    const facturaData = {
      pagoId: pagoId,
      nitCliente: nitCliente,
      nombreCliente: nombreCliente
    };

    const response = await fetchWithHeaders(`${API_URL}/facturas`, {
      method: 'POST',
      body: JSON.stringify(facturaData)
    });

    if (!response.ok) throw new Error('Error al crear factura');
    return await response.json();
  } catch (error) {
    console.error('Error en createFactura:', error);
    throw error;
  }
};

// ==================== USUARIOS ====================
// Mismo orden que el enum RolUsuario de la API. Un rol desconocido se rechaza aquí:
// omitirlo haría que .NET lo lea como 0 = Administrador.
export const ROLES_USUARIO = {
  Administrador: 0,
  Mesero: 1,
  Cocina: 2,
  Caja: 3,
  Domiciliario: 4
};

const rolAEnum = (rol) => {
  const valor = ROLES_USUARIO[rol];
  if (valor === undefined) throw new Error(`Rol inválido: ${rol}`);
  return valor;
};

export const getUsuarios = async () => {
  try {
    const response = await fetchWithHeaders(`${API_URL}/usuarios`);
    if (!response.ok) throw new Error('Error al obtener usuarios');
    return await response.json();
  } catch (error) {
    console.error('Error en getUsuarios:', error);
    throw error;
  }
};

export const getUsuario = async (id) => {
  try {
    const response = await fetchWithHeaders(`${API_URL}/usuarios/${id}`);
    if (!response.ok) throw new Error('Error al obtener usuario');
    return await response.json();
  } catch (error) {
    console.error('Error en getUsuario:', error);
    throw error;
  }
};

export const createUsuario = async (usuarioData) => {
  const response = await fetchWithHeaders(`${API_URL}/usuarios`, {
    method: 'POST',
    body: JSON.stringify({
      NombreUsuario: usuarioData.nombreUsuario,
      ClaveHash: usuarioData.clave,
      Nombre: usuarioData.nombre,
      Rol: rolAEnum(usuarioData.rol)
    })
  });
  if (!response.ok) throw await errorDe(response, 'No se pudo crear el usuario');
  return await response.json();
};

export const updateUsuario = async (id, usuarioData) => {
  const dataBackend = {
    Id: id,
    NombreUsuario: usuarioData.nombreUsuario,
    Nombre: usuarioData.nombre,
    Rol: rolAEnum(usuarioData.rol)
  };
  if (usuarioData.clave) dataBackend.ClaveHash = usuarioData.clave;

  const response = await fetchWithHeaders(`${API_URL}/usuarios/${id}`, {
    method: 'PUT',
    body: JSON.stringify(dataBackend)
  });
  if (!response.ok) throw await errorDe(response, 'No se pudo actualizar el usuario');
  return { success: true };
};

export const cambiarActivoUsuario = async (id, activo) => {
  const response = await fetchWithHeaders(`${API_URL}/usuarios/${id}/activo`, {
    method: 'PUT',
    body: JSON.stringify({ activo })
  });
  if (!response.ok) throw await errorDe(response, 'No se pudo cambiar el acceso del usuario');
  return { success: true };
};

export const deleteUsuario = async (id) => {
  const response = await fetchWithHeaders(`${API_URL}/usuarios/${id}`, { method: 'DELETE' });
  if (!response.ok) throw await errorDe(response, 'No se pudo eliminar el usuario');
  return { success: true };
};
