import axios from 'axios';
import { getApiBaseUrl, encabezadosAuth, manejarNoAutorizado } from './sesion';

const API_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': '69420'
  }
});

// JWT en cada petición; un 401 cierra la sesión vencida.
api.interceptors.request.use((config) => {
  Object.assign(config.headers, encabezadosAuth());
  return config;
});
api.interceptors.response.use(
  (response) => response,
  (error) => {
    manejarNoAutorizado(error.response?.status);
    return Promise.reject(error);
  }
);

// ==================== PLATILLOS (Para vinculación con recetas) ====================
export const getPlatillos = async () => {
  const response = await api.get('/platillos');
  return response.data;
};

// ==================== CATEGORÍAS ====================
export const getCategorias = async () => {
  const response = await api.get('/inventario/categorias');
  return response.data;
};
export const getCategoriasInventario = getCategorias;

export const createCategoria = async (categoria) => {
  const response = await api.post('/inventario/categorias', categoria);
  return response.data;
};
export const createCategoriaInventario = createCategoria;

export const updateCategoria = async (id, categoria) => {
  const response = await api.put(`/inventario/categorias/${id}`, categoria);
  return response.data;
};
export const updateCategoriaInventario = updateCategoria;

export const deleteCategoria = async (id) => {
  const response = await api.delete(`/inventario/categorias/${id}`);
  return response.data;
};
export const deleteCategoriaInventario = deleteCategoria;

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

export const getStockPorProducto = async (productoId) => {
  const response = await api.get(`/inventario/stock/producto/${productoId}`);
  return response.data;
};

export const getMovimientos = async (filtros = {}) => {
  const response = await api.get('/inventario/movimientos', { params: filtros });
  return response.data;
};

export const createMovimiento = async (movimiento) => {
  const response = await api.post('/inventario/movimientos', movimiento);
  return response.data;
};

// ==================== RECETAS / FICHAS TÉCNICAS ====================
export const getRecetas = async () => {
  const response = await api.get('/inventario/recetas');
  return response.data;
};

export const getRecetasPorPlatillo = async (platilloId) => {
  const response = await api.get(`/inventario/recetas/platillo/${platilloId}`);
  return response.data;
};

export const createReceta = async (receta) => {
  const response = await api.post('/inventario/recetas', receta);
  return response.data;
};

export const updateReceta = async (id, receta) => {
  const response = await api.put(`/inventario/recetas/${id}`, receta);
  return response.data;
};

export const deleteReceta = async (id) => {
  const response = await api.delete(`/inventario/recetas/${id}`);
  return response.data;
};

export const inicializarRecetas = async () => {
  const response = await api.post('/inventario/recetas/inicializar');
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

// ==================== COMPRAS (trabajo diario del encargado) ====================
const datos = (promesa) => promesa.then((r) => r.data);

/** Mensaje legible de un error de la API ({ message }, texto o ModelState). */
export const mensajeError = (error, respaldo = 'No se pudo completar la operación') => {
  const d = error?.response?.data;
  if (typeof d === 'string' && d) return d;
  if (d?.message) return d.message;
  if (d?.errors) return Object.values(d.errors).flat()[0] || respaldo;
  return respaldo;
};

export const compras = {
  resumen: () => datos(api.get('/compras/resumen')),
  insumos: () => datos(api.get('/compras/insumos')),
  ficha: (id) => datos(api.get(`/compras/insumos/${id}/ficha`)),
  resolverCodigo: (codigo) => datos(api.get(`/compras/codigo/${encodeURIComponent(codigo)}`)),
  presentaciones: (productoId) => datos(api.get('/compras/presentaciones', { params: { productoId } })),
  crearPresentacion: (p) => datos(api.post('/compras/presentaciones', p)),
  editarPresentacion: (id, p) => datos(api.put(`/compras/presentaciones/${id}`, p)),
  eliminarPresentacion: (id) => datos(api.delete(`/compras/presentaciones/${id}`)),
  recibir: (recepcion) => datos(api.post('/compras/recepciones', recepcion)),
  reposicion: () => datos(api.get('/compras/reposicion')),
  ordenes: (soloAbiertas = false) => datos(api.get('/compras/ordenes', { params: { soloAbiertas } })),
  orden: (id) => datos(api.get(`/compras/ordenes/${id}`)),
  crearOrden: (orden) => datos(api.post('/compras/ordenes', orden)),
  estadoOrden: (id, estado) => datos(api.put(`/compras/ordenes/${id}/estado`, { estado })),
  vencimientos: (dias = 30) => datos(api.get('/compras/vencimientos', { params: { dias } })),
  darDeBaja: (loteId, motivo) => datos(api.post(`/compras/lotes/${loteId}/baja`, { motivo })),
  editarLote: (loteId, lote) => datos(api.put(`/compras/lotes/${loteId}`, lote)),
  trasladar: (traslado) => datos(api.post('/compras/traslados', traslado)),
  conteo: (conteo) => datos(api.post('/compras/conteos', conteo)),
};

export default api;
