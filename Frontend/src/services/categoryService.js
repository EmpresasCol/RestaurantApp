import api from './api';

const categoryService = {
  // Obtener todas las categorías
  getAllCategories: async () => {
    const response = await api.get('/categories');
    return response.data;
  },

  // Obtener una categoría por ID
  getCategoryById: async (id) => {
    const response = await api.get(`/categories/${id}`);
    return response.data;
  },

  // Crear una nueva categoría
  createCategory: async (categoryData) => {
    const response = await api.post('/categories', categoryData);
    return response.data;
  },

  // Actualizar una categoría
  updateCategory: async (id, categoryData) => {
    const response = await api.put(`/categories/${id}`, categoryData);
    return response.data;
  },

  // Eliminar una categoría
  deleteCategory: async (id) => {
    await api.delete(`/categories/${id}`);
  },
};

export default categoryService;
