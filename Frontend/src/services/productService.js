import api from './api';

const productService = {
  // Obtener todos los productos
  getAllProducts: async () => {
    const response = await api.get('/products');
    return response.data;
  },

  // Obtener un producto por ID
  getProductById: async (id) => {
    const response = await api.get(`/products/${id}`);
    return response.data;
  },

  // Obtener productos por categoría
  getProductsByCategory: async (categoryId) => {
    const response = await api.get(`/products/category/${categoryId}`);
    return response.data;
  },

  // Obtener productos con stock bajo
  getLowStockProducts: async () => {
    const response = await api.get('/products/low-stock');
    return response.data;
  },

  // Crear un nuevo producto
  createProduct: async (productData) => {
    const response = await api.post('/products', productData);
    return response.data;
  },

  // Actualizar un producto
  updateProduct: async (id, productData) => {
    const response = await api.put(`/products/${id}`, productData);
    return response.data;
  },

  // Eliminar un producto
  deleteProduct: async (id) => {
    await api.delete(`/products/${id}`);
  },
};

export default productService;
