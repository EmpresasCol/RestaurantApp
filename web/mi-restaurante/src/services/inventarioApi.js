import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'https://80a0101f93ae.ngrok-free.app/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': '69420'
  }
});

// ==================== CATEGORÍAS ====================
export const getCategorias = async () => {
  const response = await api.get('/inventario/categorias');
  return response.data;
};

export const createCategoria = async (categoria) => {
  const response = await api.post('/inventario/categorias', categoria);
  return response.data;
};

export const updateCategoria = async (id, categoria) => {
  const response = await api.put(`/inventario/categorias/${id}`, categoria);
  return response.data;
};

export const deleteCategoria = async (id) => {
  const response = await api.delete(`/inventario/categorias/${id}`);
  return response.data;
};

// ==================== PROVEEDORES ====================
export const getProveedores = async () => {
  const response = await api.get('/inventario/proveedores');
  return response.data;
};

export const createProveedor = async (proveedor) => {
  const response = await api.post('/inventario/proveedores', proveedor);
  return response.data;
};

export const updateProveedor = async (id, proveedor) => {
  const response = await api.put(`/inventario/proveedores/${id}`, proveedor);
  return response.data;
};

export const deleteProveedor = async (id) => {
  const response = await api.delete(`/inventario/proveedores/${id}`);
  return response.data;
};

// ==================== ALMACENES ====================
export const getAlmacenes = async () => {
  const response = await api.get('/inventario/almacenes');
  return response.data;
};

export const createAlmacen = async (almacen) => {
  const response = await api.post('/inventario/almacenes', almacen);
  return response.data;
};

export const updateAlmacen = async (id, almacen) => {
  const response = await api.put(`/inventario/almacenes/${id}`, almacen);
  return response.data;
};

export const deleteAlmacen = async (id) => {
  const response = await api.delete(`/inventario/almacenes/${id}`);
  return response.data;
};

// ==================== PRODUCTOS ====================
export const getProductos = async () => {
  const response = await api.get('/inventario/productos');
  return response.data;
};

export const getProducto = async (id) => {
  const response = await api.get(`/inventario/productos/${id}`);
  return response.data;
};

export const createProducto = async (producto) => {
  const response = await api.post('/inventario/productos', producto);
  return response.data;
};

export const updateProducto = async (id, producto) => {
  const response = await api.put(`/inventario/productos/${id}`, producto);
  return response.data;
};

export const deleteProducto = async (id) => {
  const response = await api.delete(`/inventario/productos/${id}`);
  return response.data;
};

// ==================== STOCK Y MOVIMIENTOS ====================
export const getStock = async () => {
  const response = await api.get('/inventario/stock');
  return response.data;
};

export const getStockPorAlmacen = async (almacenId) => {
  const response = await api.get(`/inventario/stock/almacen/${almacenId}`);
  return response.data;
};

export const getMovimientos = async () => {
  const response = await api.get('/inventario/movimientos');
  return response.data;
};

export const createMovimiento = async (movimiento) => {
  const response = await api.post('/inventario/movimientos', movimiento);
  return response.data;
};

// ==================== REPORTES ====================
export const getReporteStockGeneral = async () => {
  const response = await api.get('/inventario/reportes/stock-general');
  return response.data;
};

export const getReporteProductosVencimiento = async () => {
  const response = await api.get('/inventario/reportes/productos-vencimiento');
  return response.data;
};

export const getReporteValorPorAlmacen = async () => {
  const response = await api.get('/inventario/reportes/valor-por-almacen');
  return response.data;
};

export const getAlertasStock = async () => {
  const response = await api.get('/inventario/reportes/alertas-stock');
  return response.data;
};
