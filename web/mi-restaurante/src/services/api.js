// src/services/api.js
const API_URL = process.env.REACT_APP_API_URL || 'https://705e32771f5f.ngrok-free.app/api'; 
console.log('🌐 API URL configurada:', API_URL);

// ✅ Función auxiliar para hacer fetch con headers de ngrok
const fetchWithHeaders = async (url, options = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': '69420', // ✅ CRÍTICO: Evita la página de advertencia de ngrok
    'User-Agent': 'RestaurantApp',
    ...options.headers
  };

  return fetch(url, {
    ...options,
    headers
  });
};

// ==================== AUTENTICACIÓN ====================
export const login = async (usuario, clave) => {
  try {
    console.log('🔐 Intentando login con:', { usuario });
    
    const response = await fetchWithHeaders(`${API_URL}/usuarios/login`, {
      method: 'POST',
      body: JSON.stringify({ usuario, clave })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Credenciales inválidas' }));
      throw new Error(errorData.message || 'Credenciales inválidas');
    }

    const data = await response.json();
    console.log('✅ Login exitoso:', data);
    return data;
  } catch (error) {
    console.error('❌ Error en login:', error);
    throw error;
  }
};

// ==================== PLATILLOS ====================
export const getPlatillos = async () => {
  try {
    const response = await fetchWithHeaders(`${API_URL}/platillos`);
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
  try {
    console.log('📤 Creando platillo:', platilloData);
    
    const response = await fetchWithHeaders(`${API_URL}/platillos`, {
      method: 'POST',
      body: JSON.stringify(platilloData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error al crear platillo: ${errorText}`);
    }

    const resultado = await response.json();
    console.log('✅ Platillo creado:', resultado);
    return resultado;
  } catch (error) {
    console.error('❌ Error en createPlatillo:', error);
    throw error;
  }
};

export const updatePlatillo = async (id, platilloData) => {
  try {
    console.log('🔄 Actualizando platillo:', { id, ...platilloData });
    
    const response = await fetchWithHeaders(`${API_URL}/platillos/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ id, ...platilloData })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error del servidor:', errorText);
      throw new Error(errorText || 'Error al actualizar platillo');
    }

    console.log('✅ Platillo actualizado exitosamente');
    return { success: true };
  } catch (error) {
    console.error('❌ Error en updatePlatillo:', error);
    throw error;
  }
};

export const deletePlatillo = async (id) => {
  try {
    console.log('🗑️ Eliminando platillo:', id);
    
    const response = await fetchWithHeaders(`${API_URL}/platillos/${id}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error del servidor:', errorText);
      throw new Error(errorText || 'Error al eliminar platillo');
    }

    console.log('✅ Platillo eliminado exitosamente');
    return { success: true };
  } catch (error) {
    console.error('❌ Error en deletePlatillo:', error);
    throw error;
  }
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

export const createPedido = async (mesaId, items) => {
  try {
    const pedidoData = {
      mesaId: mesaId,
      detalles: items.map(item => ({
        platilloId: item.id,
        cantidad: item.cantidad,
        nota: item.notas || ""
      }))
    };

    console.log('📤 Enviando pedido:', pedidoData);

    const response = await fetchWithHeaders(`${API_URL}/pedidos`, {
      method: 'POST',
      body: JSON.stringify(pedidoData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error al crear pedido: ${errorText}`);
    }

    const resultado = await response.json();
    console.log('✅ Pedido creado:', resultado);
    return resultado;
  } catch (error) {
    console.error('❌ Error en createPedido:', error);
    throw error;
  }
};

export const updatePedido = async (id, estado) => {
  try {
    console.log('🔄 Actualizando pedido:', { id, estado });

    const response = await fetchWithHeaders(`${API_URL}/pedidos/${id}`, {
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
  try {
    console.log('📤 Creando usuario:', usuarioData);
    
    // ✅ MAPEAR ROL DE STRING A NÚMERO
    const rolMap = {
      'Administrador': 0,
      'Mesero': 1,
      'Cocina': 2,
      'Caja': 3
    };
    
    const dataBackend = {
      NombreUsuario: usuarioData.nombreUsuario,
      ClaveHash: usuarioData.clave,
      Nombre: usuarioData.nombre,
      Rol: rolMap[usuarioData.rol]
    };

    console.log('📤 Enviando al backend:', dataBackend);

    const response = await fetchWithHeaders(`${API_URL}/usuarios`, {
      method: 'POST',
      body: JSON.stringify(dataBackend)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error al crear usuario: ${errorText}`);
    }

    const resultado = await response.json();
    console.log('✅ Usuario creado:', resultado);
    return resultado;
  } catch (error) {
    console.error('❌ Error en createUsuario:', error);
    throw error;
  }
};

export const updateUsuario = async (id, usuarioData) => {
  try {
    console.log('🔄 Actualizando usuario:', { id, ...usuarioData });
    
    // ✅ MAPEAR ROL DE STRING A NÚMERO
    const rolMap = {
      'Administrador': 0,
      'Mesero': 1,
      'Cocina': 2,
      'Caja': 3
    };
    
    const dataBackend = {
      Id: id,
      NombreUsuario: usuarioData.nombreUsuario,
      Nombre: usuarioData.nombre,
      Rol: rolMap[usuarioData.rol]
    };

    if (usuarioData.clave) {
      dataBackend.ClaveHash = usuarioData.clave;
    }

    console.log('📤 Enviando al backend:', dataBackend);

    const response = await fetchWithHeaders(`${API_URL}/usuarios/${id}`, {
      method: 'PUT',
      body: JSON.stringify(dataBackend)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error del servidor:', errorText);
      throw new Error(errorText || 'Error al actualizar usuario');
    }

    console.log('✅ Usuario actualizado exitosamente');
    return { success: true };
  } catch (error) {
    console.error('❌ Error en updateUsuario:', error);
    throw error;
  }
};

export const deleteUsuario = async (id) => {
  try {
    console.log('🗑️ Eliminando usuario:', id);
    
    const response = await fetchWithHeaders(`${API_URL}/usuarios/${id}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error del servidor:', errorText);
      throw new Error(errorText || 'Error al eliminar usuario');
    }

    console.log('✅ Usuario eliminado exitosamente');
    return { success: true };
  } catch (error) {
    console.error('❌ Error en deleteUsuario:', error);
    throw error;
  }
};

//estado pedido cocina

export const actualizarEstadoPedido = async (pedidoId, nuevoEstado) => {
  const response = await fetch(`${API_URL}/pedidos/${pedidoId}/estado`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ estado: nuevoEstado })
  });

  if (!response.ok) {
    throw new Error('Error al actualizar estado del pedido');
  }

  return await response.json();
};