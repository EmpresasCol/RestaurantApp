const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5176/api';

// Platillos
export const getPlatillos = async () => {
  const response = await fetch(`${API_URL}/platillos`);
  if (!response.ok) throw new Error('Error al obtener platillos');
  return response.json();
};

export const getPlatillo = async (id) => {
  const response = await fetch(`${API_URL}/platillos/${id}`);
  if (!response.ok) throw new Error('Error al obtener platillo');
  return response.json();
};

// Mesas
export const getMesas = async () => {
  const response = await fetch(`${API_URL}/mesas`);
  if (!response.ok) throw new Error('Error al obtener mesas');
  return response.json();
};

export const updateMesa = async (id, mesa) => {
  const response = await fetch(`${API_URL}/mesas/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mesa)
  });
  if (!response.ok) throw new Error('Error al actualizar mesa');
  return response;
};

// Pedidos
export const getPedidos = async () => {
  const response = await fetch(`${API_URL}/pedidos`);
  if (!response.ok) throw new Error('Error al obtener pedidos');
  return response.json();
};

export const createPedido = async (pedido) => {
  const response = await fetch(`${API_URL}/pedidos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pedido)
  });
  if (!response.ok) throw new Error('Error al crear pedido');
  return response.json();
};

export const updatePedido = async (id, pedido) => {
  const response = await fetch(`${API_URL}/pedidos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pedido)
  });
  if (!response.ok) throw new Error('Error al actualizar pedido');
  return response;
};

// Pedido Detalles
export const createPedidoDetalle = async (detalle) => {
  const response = await fetch(`${API_URL}/pedidodetalles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(detalle)
  });
  if (!response.ok) throw new Error('Error al crear detalle');
  return response.json();
};

// Pagos
export const createPago = async (pago) => {
  const response = await fetch(`${API_URL}/pagos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pago)
  });
  if (!response.ok) throw new Error('Error al crear pago');
  return response.json();
};

export const getPagos = async () => {
  const response = await fetch(`${API_URL}/pagos`);
  if (!response.ok) throw new Error('Error al obtener pagos');
  return response.json();
};