// src/services/domiciliosApi.js
const API_URL = process.env.REACT_APP_API_URL || 'https://80a0101f93ae.ngrok-free.app/api';

const fetchWithHeaders = async (url, options = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': '69420',
    'User-Agent': 'RestaurantApp',
    ...options.headers
  };

  return fetch(url, {
    ...options,
    headers
  });
};

// ==================== CLIENTES ====================
export const buscarClientePorTelefono = async (telefono) => {
  try {
    console.log(`🔍 Buscando cliente con teléfono: ${telefono}`);
    const response = await fetchWithHeaders(`${API_URL}/clientes/telefono/${telefono}`);
    
    if (response.status === 404) {
      console.log('⚠️ Cliente no encontrado (404)');
      return null;
    }
    
    if (!response.ok) {
      throw new Error('Error al buscar cliente');
    }
    
    const cliente = await response.json();
    console.log('✅ Cliente encontrado:', cliente);
    return cliente;
  } catch (error) {
    console.error('❌ Error al buscar cliente:', error);
    throw error;
  }
};

export const createClienteConDireccion = async (data) => {
  try {
    console.log('📤 Creando cliente con dirección:', data);
    
    const response = await fetchWithHeaders(`${API_URL}/clientes/con-direccion`, {
      method: 'POST',
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error al crear cliente: ${errorText}`);
    }

    const resultado = await response.json();
    console.log('✅ Cliente y dirección creados:', resultado);
    return resultado;
  } catch (error) {
    console.error('❌ Error al crear cliente con dirección:', error);
    throw error;
  }
};

// ==================== DIRECCIONES ====================
export const getDireccionesCliente = async (clienteId) => {
  try {
    console.log(`🔍 Obteniendo direcciones del cliente ${clienteId}`);
    const response = await fetchWithHeaders(`${API_URL}/direcciones/cliente/${clienteId}`);
    
    if (!response.ok) {
      throw new Error('Error al obtener direcciones');
    }
    
    const direcciones = await response.json();
    console.log(`✅ Direcciones obtenidas: ${direcciones.length}`);
    return direcciones;
  } catch (error) {
    console.error('❌ Error al obtener direcciones:', error);
    throw error;
  }
};

export const createDireccion = async (clienteId, direccionData) => {
  try {
    console.log(`📤 Creando dirección para cliente ${clienteId}:`, direccionData);
    
    const response = await fetchWithHeaders(`${API_URL}/direcciones?clienteId=${clienteId}`, {
      method: 'POST',
      body: JSON.stringify(direccionData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error al crear dirección: ${errorText}`);
    }

    const resultado = await response.json();
    console.log('✅ Dirección creada:', resultado);
    return resultado;
  } catch (error) {
    console.error('❌ Error al crear dirección:', error);
    throw error;
  }
};

// ==================== DOMICILIOS ====================
export const getDomicilios = async () => {
  try {
    console.log('🔍 Obteniendo todos los domicilios');
    const response = await fetchWithHeaders(`${API_URL}/domicilios`);
    
    if (!response.ok) {
      throw new Error('Error al obtener domicilios');
    }
    
    const domicilios = await response.json();
    console.log(`✅ Domicilios obtenidos: ${domicilios.length}`);
    return domicilios;
  } catch (error) {
    console.error('❌ Error al obtener domicilios:', error);
    throw error;
  }
};



export const getDomiciliosActivos = async () => {
  try {
    console.log('🔍 Obteniendo domicilios activos');
    const response = await fetchWithHeaders(`${API_URL}/domicilios/activos`);
    
    if (!response.ok) {
      throw new Error('Error al obtener domicilios activos');
    }
    
    const domicilios = await response.json();
    console.log(`✅ Domicilios activos obtenidos: ${domicilios.length}`);
    return domicilios;
  } catch (error) {
    console.error('❌ Error al obtener domicilios activos:', error);
    throw error;
  }
};

export const getDomicilio = async (id) => {
  try {
    console.log(`🔍 Obteniendo domicilio ${id}`);
    const response = await fetchWithHeaders(`${API_URL}/domicilios/${id}`);
    
    if (!response.ok) {
      throw new Error('Error al obtener domicilio');
    }
    
    const domicilio = await response.json();
    console.log('✅ Domicilio obtenido:', domicilio);
    return domicilio;
  } catch (error) {
    console.error('❌ Error al obtener domicilio:', error);
    throw error;
  }
};

export const createDomicilio = async (domicilioData) => {
  try {
    console.log('📤 Creando domicilio:', domicilioData);
    
    // ✅ Forzar estado inicial a "EnPreparacion" para que aparezca en cocina igual que pedidos de mesa
    const datosConEstado = {
      ...domicilioData,
      estado: 'EnPreparacion'
    };
    
    console.log('📤 Datos a enviar al backend:', JSON.stringify(datosConEstado, null, 2));
    
    const response = await fetchWithHeaders(`${API_URL}/domicilios`, {
      method: 'POST',
      body: JSON.stringify(datosConEstado)
    });

    console.log('📡 Status de respuesta:', response.status);
    console.log('📡 Headers de respuesta:', [...response.headers.entries()]);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error del servidor:', errorText);
      throw new Error(`Error al crear domicilio: ${errorText}`);
    }

    // ✅ Verificar si hay contenido en la respuesta
    const contentType = response.headers.get('content-type');
    console.log('📡 Content-Type:', contentType);

    // Si la respuesta es 201 Created sin contenido JSON, devolver un objeto simple
    if (response.status === 201) {
      const text = await response.text();
      console.log('📡 Respuesta raw:', text);
      
      if (!text || text.trim() === '') {
        console.log('✅ Domicilio creado exitosamente (sin cuerpo de respuesta)');
        return { success: true, message: 'Domicilio creado exitosamente' };
      }
      
      try {
        const resultado = JSON.parse(text);
        console.log('✅ Domicilio creado:', resultado);
        return resultado;
      } catch (parseError) {
        console.log('⚠️ No se pudo parsear la respuesta como JSON, pero el domicilio fue creado');
        return { success: true, message: 'Domicilio creado exitosamente' };
      }
    }

    // Para otros códigos de estado, intentar parsear JSON
    const resultado = await response.json();
    console.log('✅ Domicilio creado:', resultado);
    return resultado;
    
  } catch (error) {
    console.error('❌ Error al crear domicilio:', error);
    throw error;
  }
};

export const actualizarEstadoDomicilio = async (domicilioId, nuevoEstado) => {
  try {
    console.log(`🔄 Actualizando estado del domicilio ${domicilioId} → ${nuevoEstado}`);
    
    const response = await fetchWithHeaders(`${API_URL}/domicilios/${domicilioId}/estado`, {
      method: 'PUT',
      body: JSON.stringify({ estado: nuevoEstado })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error al actualizar estado: ${errorText}`);
    }

    // ✅ Manejar respuesta 204 No Content
    if (response.status === 204) {
      console.log('✅ Estado del domicilio actualizado (204 No Content)');
      return { success: true };
    }

    // Intentar parsear JSON si hay contenido
    const text = await response.text();
    if (!text || text.trim() === '') {
      console.log('✅ Estado del domicilio actualizado (sin cuerpo de respuesta)');
      return { success: true };
    }

    try {
      const resultado = JSON.parse(text);
      console.log('✅ Estado del domicilio actualizado:', resultado);
      return resultado;
    } catch (parseError) {
      console.log('✅ Estado actualizado (respuesta no JSON)');
      return { success: true };
    }
  } catch (error) {
    console.error('❌ Error al actualizar estado del domicilio:', error);
    throw error;
  }
};

export const actualizarMetodoPagoDomicilio = async (domicilioId, metodoPago, pagadoAnticipado) => {
  try {
    console.log(`💳 Actualizando método de pago del domicilio ${domicilioId}`);
    
    const response = await fetchWithHeaders(`${API_URL}/domicilios/${domicilioId}/metodo-pago`, {
      method: 'PUT',
      body: JSON.stringify({ metodoPago, pagadoAnticipado })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error al actualizar método de pago: ${errorText}`);
    }

    // ✅ Manejar respuesta 204 No Content
    if (response.status === 204) {
      console.log('✅ Método de pago actualizado (204 No Content)');
      return { success: true };
    }

    // Intentar parsear JSON si hay contenido
    const text = await response.text();
    if (!text || text.trim() === '') {
      console.log('✅ Método de pago actualizado (sin cuerpo de respuesta)');
      return { success: true };
    }

    try {
      const resultado = JSON.parse(text);
      console.log('✅ Método de pago actualizado:', resultado);
      return resultado;
    } catch (parseError) {
      console.log('✅ Método de pago actualizado (respuesta no JSON)');
      return { success: true };
    }
  } catch (error) {
    console.error('❌ Error al actualizar método de pago:', error);
    throw error;
  }
};

// ==================== ESTADÍSTICAS ====================
export const getEstadisticasDomicilios = async () => {
  try {
    console.log('📊 Obteniendo estadísticas de domicilios');
    const response = await fetchWithHeaders(`${API_URL}/domicilios/estadisticas/hoy`);
    
    if (!response.ok) {
      throw new Error('Error al obtener estadísticas');
    }
    
    const estadisticas = await response.json();
    console.log('✅ Estadísticas obtenidas:', estadisticas);
    return estadisticas;
  } catch (error) {
    console.error('❌ Error al obtener estadísticas:', error);
    throw error;
  }
};

export default {
  buscarClientePorTelefono,
  createClienteConDireccion,
  getDireccionesCliente,
  createDireccion,
  getDomicilios,
  getDomiciliosActivos,
  getDomicilio,
  createDomicilio,
  actualizarEstadoDomicilio,
  actualizarMetodoPagoDomicilio,
  getEstadisticasDomicilios
};