import api from './api';

const stockService = {
  // Obtener todo el stock
  getAllStock: async () => {
    const response = await api.get('/stock');
    return response.data;
  },

  // Obtener resumen de stock por producto
  getProductStockSummary: async () => {
    const response = await api.get('/stock/summary');
    return response.data;
  },

  // Obtener stock de un producto específico
  getProductStock: async (productId) => {
    const response = await api.get(`/stock/product/${productId}`);
    return response.data;
  },

  // Obtener stock por almacén
  getStockByWarehouse: async (warehouseId) => {
    const response = await api.get(`/stock/warehouse/${warehouseId}`);
    return response.data;
  },

  // Obtener alertas de stock
  getStockAlerts: async () => {
    const response = await api.get('/stock/alerts');
    return response.data;
  },

  // Registrar movimiento de stock
  registerMovement: async (movementData) => {
    const response = await api.post('/stock/movement', movementData);
    return response.data;
  },

  // Ajustar stock
  adjustStock: async (adjustmentData) => {
    const response = await api.post('/stock/adjust', adjustmentData);
    return response.data;
  },

  // Obtener historial de movimientos
  getMovementHistory: async (productId = null, warehouseId = null) => {
    const params = {};
    if (productId) params.productId = productId;
    if (warehouseId) params.warehouseId = warehouseId;

    const response = await api.get('/stock/movements', { params });
    return response.data;
  },
};

export default stockService;
