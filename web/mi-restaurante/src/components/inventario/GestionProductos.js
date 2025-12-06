import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, X, Filter } from 'lucide-react';
import { getProductos, createProducto, updateProducto, deleteProducto, getCategorias, getProveedores } from '../../services/inventarioApi';

function GestionProductos() {
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [productoEditando, setProductoEditando] = useState(null);

  // Estado del formulario
  const [formData, setFormData] = useState({
    codigo: '',
    nombre: '',
    descripcion: '',
    categoriaId: '',
    proveedorId: '',
    unidadMedida: 'Unidad',
    precioCosto: 0,
    stockMinimo: 5,
    stockMaximo: 100,
    requiereCaducidad: false,
    esIngrediente: true
  });

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [productosData, categoriasData, proveedoresData] = await Promise.all([
        getProductos(),
        getCategorias(),
        getProveedores()
      ]);
      setProductos(productosData);
      setCategorias(categoriasData);
      setProveedores(proveedoresData);
    } catch (error) {
      console.error('Error al cargar datos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const handleOpenModal = (producto = null) => {
    if (producto) {
      setProductoEditando(producto);
      setFormData({
        codigo: producto.codigo,
        nombre: producto.nombre,
        descripcion: producto.descripcion || '',
        categoriaId: producto.categoriaId,
        proveedorId: producto.proveedorId || '',
        unidadMedida: producto.unidadMedida,
        precioCosto: producto.precioCosto,
        stockMinimo: producto.stockMinimo,
        stockMaximo: producto.stockMaximo || 100,
        requiereCaducidad: producto.requiereCaducidad,
        esIngrediente: true // Asumimos true por defecto o deberíamos traerlo del backend si existe field
      });
    } else {
      setProductoEditando(null);
      setFormData({
        codigo: '',
        nombre: '',
        descripcion: '',
        categoriaId: categorias.length > 0 ? categorias[0].id : '',
        proveedorId: '',
        unidadMedida: 'Unidad',
        precioCosto: 0,
        stockMinimo: 5,
        stockMaximo: 100,
        requiereCaducidad: false,
        esIngrediente: true
      });
    }
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        categoriaId: parseInt(formData.categoriaId),
        proveedorId: formData.proveedorId ? parseInt(formData.proveedorId) : null,
        precioCosto: parseFloat(formData.precioCosto),
        stockMinimo: parseFloat(formData.stockMinimo),
        stockMaximo: parseFloat(formData.stockMaximo),
        activo: true
      };

      if (productoEditando) {
        await updateProducto(productoEditando.id, data);
      } else {
        await createProducto(data);
      }
      setModalOpen(false);
      cargarDatos();
    } catch (error) {
      console.error('Error al guardar producto:', error);
      alert('Error al guardar producto. Verifica los datos.');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('¿Estás seguro de eliminar este producto?')) {
      try {
        await deleteProducto(id);
        cargarDatos();
      } catch (error) {
        console.error('Error al eliminar:', error);
        alert('No se pudo eliminar el producto. Verifica que no tenga stock o movimientos.');
      }
    }
  };

  const productosFiltrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(filtro.toLowerCase()) ||
    p.codigo.toLowerCase().includes(filtro.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Buscar productos..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium"
        >
          <Plus size={18} />
          Nuevo Producto
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-gray-50 text-gray-700 font-medium">
            <tr>
              <th className="px-6 py-3">Código</th>
              <th className="px-6 py-3">Producto</th>
              <th className="px-6 py-3">Categoría</th>
              <th className="px-6 py-3">Unidad</th>
              <th className="px-6 py-3">Costo Prom.</th>
              <th className="px-6 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {productosFiltrados.map((producto) => (
              <tr key={producto.id} className="hover:bg-gray-50/50">
                <td className="px-6 py-3 font-mono text-gray-500">{producto.codigo}</td>
                <td className="px-6 py-3 font-medium text-gray-900">{producto.nombre}</td>
                <td className="px-6 py-3">
                  <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-full text-xs">
                    {producto.categoriaNombre}
                  </span>
                </td>
                <td className="px-6 py-3">{producto.unidadMedida}</td>
                <td className="px-6 py-3">${producto.precioCosto}</td>
                <td className="px-6 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => handleOpenModal(producto)}
                      className="text-gray-400 hover:text-blue-600 transition-colors"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(producto.id)}
                      className="text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {productosFiltrados.length === 0 && (
              <tr>
                <td colSpan="6" className="px-6 py-8 text-center text-gray-400">
                  No se encontraron productos
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="text-xl font-bold text-gray-800">
                {productoEditando ? 'Editar Producto' : 'Nuevo Producto'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Código</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.codigo}
                    onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  rows="2"
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                ></textarea>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.categoriaId}
                    onChange={(e) => setFormData({ ...formData, categoriaId: e.target.value })}
                    required
                  >
                    <option value="">Seleccionar...</option>
                    {categorias.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.proveedorId}
                    onChange={(e) => setFormData({ ...formData, proveedorId: e.target.value })}
                  >
                    <option value="">Ninguno</option>
                    {proveedores.map(prov => (
                      <option key={prov.id} value={prov.id}>{prov.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unidad de Medida</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.unidadMedida}
                    onChange={(e) => setFormData({ ...formData, unidadMedida: e.target.value })}
                  >
                    <option value="Unidad">Unidad</option>
                    <option value="Kg">Kilogramos</option>
                    <option value="Gramos">Gramos</option>
                    <option value="Litro">Litro</option>
                    <option value="Paquete">Paquete</option>
                    <option value="Caja">Caja</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Costo Estimado</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.precioCosto}
                    onChange={(e) => setFormData({ ...formData, precioCosto: e.target.value })}
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 mt-8">
                    <input
                      type="checkbox"
                      checked={formData.requiereCaducidad}
                      onChange={(e) => setFormData({ ...formData, requiereCaducidad: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Controla Vencimiento</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock Mínimo (Alerta)</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.stockMinimo}
                    onChange={(e) => setFormData({ ...formData, stockMinimo: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock Máximo</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.stockMaximo}
                    onChange={(e) => setFormData({ ...formData, stockMaximo: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default GestionProductos;
