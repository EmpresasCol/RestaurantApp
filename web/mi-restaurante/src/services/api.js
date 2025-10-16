// src/services/api.js
const API_URL = process.env.REACT_APP_API_URL || 'https://localhost:7137/api';

// ==================== AUTENTICACIÓN ====================
export const login = async (usuario, clave) => {
  try {
    console.log('🔐 Intentando login con:', { usuario });
    
    const response = await fetch(`${API_URL}/usuarios/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    const response = await fetch(`${API_URL}/platillos`);
    if (!response.ok) throw new Error('Error al obtener platillos');
    return await response.json();
  } catch (error) {
    console.error('Error en getPlatillos:', error);
    throw error;
  }
};

export const getPlatillo = async (id) => {
  try {
    const response = await fetch(`${API_URL}/platillos/${id}`);
    if (!response.ok) throw new Error('Error al obtener platillo');
    return await response.json();
  } catch (error) {
    console.error('Error en getPlatillo:', error);
    throw error;
  }
};

// ✅ NUEVO: Crear platillo
export const createPlatillo = async (platilloData) => {
  try {
    console.log('📤 Creando platillo:', platilloData);
    
    const response = await fetch(`${API_URL}/platillos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

// ✅ MEJORADO: Actualizar platillo
export const updatePlatillo = async (id, platilloData) => {
  try {
    console.log('🔄 Actualizando platillo:', { id, ...platilloData });
    
    const response = await fetch(`${API_URL}/platillos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
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

// ✅ MEJORADO: Eliminar platillo
export const deletePlatillo = async (id) => {
  try {
    console.log('🗑️ Eliminando platillo:', id);
    
    const response = await fetch(`${API_URL}/platillos/${id}`, {
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
    const response = await fetch(`${API_URL}/mesas`);
    if (!response.ok) throw new Error('Error al obtener mesas');
    return await response.json();
  } catch (error) {
    console.error('Error en getMesas:', error);
    throw error;
  }
};

export const updateEstadoMesa = async (id, estado) => {
  try {
    const response = await fetch(`${API_URL}/mesas/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
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
    const response = await fetch(`${API_URL}/pedidos`);
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

    const response = await fetch(`${API_URL}/pedidos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

    const response = await fetch(`${API_URL}/pedidos/${id}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
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

    const response = await fetch(`${API_URL}/pagos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    const response = await fetch(`${API_URL}/pagos`);
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
    const response = await fetch(`${API_URL}/facturas`);
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

    const response = await fetch(`${API_URL}/facturas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(facturaData)
    });

    if (!response.ok) throw new Error('Error al crear factura');
    return await response.json();
  } catch (error) {
    console.error('Error en createFactura:', error);
    throw error;
  }
};