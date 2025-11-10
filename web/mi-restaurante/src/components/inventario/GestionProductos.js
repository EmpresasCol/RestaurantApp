// src/components/inventario/GestionProductos.js
import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  Package, 
  DollarSign, 
  Image as ImageIcon, 
  Tag,
  AlertCircle,
  CheckCircle,
  Search,
  Filter,
  Calendar,
  TrendingDown,
  Barcode
} from 'lucide-react';
import * as inventarioApi from '../../services/inventarioApi';

function GestionProductos() {
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [productoEditando, setProductoEditando] = useState(null);
  const [modalAlerta, setModalAlerta] = useState(null);
  const [modalConfirmacion, setModalConfirmacion] = useState(null);
  const [imagenPreview, setImagenPreview] = useState(null);
  const [filtroCategoria, setFiltroCategoria] = useState('todas');
  const [busqueda, setBusqueda] = useState('');

  const [formData, setFormData] = useState({
    codigo: '',
    nombre: '',
    descripcion: '',
    categoriaId: '',
    proveedorId: '',
    unidadMedida: 'Kg',
    precioCosto: '',
    stockMinimo: '',
    stockMaximo: '',
    puntoReorden: '',
    requiereCaducidad: false,
    diasVencimiento: '',
    imagenUrl: '',
    activo: true
  });

  const unidadesMedida = ['Kg', 'Gramos', 'Litro', 'Mililitro', 'Unidad', 'Paquete', 'Caja', 'Botella', 'Lata'];

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setCargando(true);
    try {
      const [productosData, categoriasData, proveedoresData] = await Promise.all([
        inventarioApi.getProductosInventario(),
        inventarioApi.getCategoriasInventario(),
        inventarioApi.getProveedores()
      ]);

      setProductos(productosData);
      setCategorias(categoriasData);
      setProveedores(proveedoresData);
    } catch (error) {
      console.error('Error al cargar datos:', error);
      setModalAlerta({
        tipo: 'error',
        titulo: 'Error',
        mensaje: 'No se pudieron cargar los datos'
      });
    } finally {
      setCargando(false);
    }
  };

  const abrirModalNuevo = () => {
    setModoEdicion(false);
    setProductoEditando(null);
    setImagenPreview(null);
    setFormData({
      codigo: generarCodigoAutomatico(),
      nombre: '',
      descripcion: '',
      categoriaId: categorias.length > 0 ? categorias[0].id : '',
      proveedorId: '',
      unidadMedida: 'Kg',
      precioCosto: '',
      stockMinimo: '0',
      stockMaximo: '',
      puntoReorden: '',
      requiereCaducidad: false,
      diasVencimiento: '',
      imagenUrl: '',
      activo: true
    });
    setModalAbierto(true);
  };

  const generarCodigoAutomatico = () => {
    const timestamp = Date.now().toString().slice(-6);
    return `PROD-${timestamp}`;
  };

  const abrirModalEditar = (producto) => {
    setModoEdicion(true);
    setProductoEditando(producto);
    setImagenPreview(producto.imagenUrl);
    setFormData({
      codigo: producto.codigo,
      nombre: producto.nombre,
      descripcion: producto.descripcion || '',
      categoriaId: producto.categoriaId.toString(),
      proveedorId: producto.proveedorId ? producto.proveedorId.toString() : '',
      unidadMedida: producto.unidadMedida,
      precioCosto: producto.precioCosto.toString(),
      stockMinimo: producto.stockMinimo.toString(),
      stockMaximo: producto.stockMaximo ? producto.stockMaximo.toString() : '',
      puntoReorden: producto.puntoReorden ? producto.puntoReorden.toString() : '',
      requiereCaducidad: producto.requiereCaducidad,
      diasVencimiento: producto.diasVencimiento ? producto.diasVencimiento.toString() : '',
      imagenUrl: producto.imagenUrl || '',
      activo: producto.activo
    });
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setModoEdicion(false);
    setProductoEditando(null);
    setImagenPreview(null);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleImagenUrl = (e) => {
    const url = e.target.value;
    setFormData(prev => ({ ...prev, imagenUrl: url }));
    setImagenPreview(url);
  };

  const validarFormulario = () => {
    if (!formData.nombre.trim()) {
      setModalAlerta({
        tipo: 'error',
        titulo: 'Error de validación',
        mensaje: 'El nombre del producto es obligatorio'
      });
      return false;
    }

    if (!formData.codigo.trim()) {
      setModalAlerta({
        tipo: 'error',
        titulo: 'Error de validación',
        mensaje: 'El código del producto es obligatorio'
      });
      return false;
    }

    if (!formData.categoriaId) {
      setModalAlerta({
        tipo: 'error',
        titulo: 'Error de validación',
        mensaje: 'Debe seleccionar una categoría'
      });
      return false;
    }

    if (!formData.precioCosto || parseFloat(formData.precioCosto) <= 0) {
      setModalAlerta({
        tipo: 'error',
        titulo: 'Error de validación',
        mensaje: 'El precio de costo debe ser mayor a 0'
      });
      return false;
    }

    if (formData.requiereCaducidad && !formData.diasVencimiento) {
      setModalAlerta({
        tipo: 'error',
        titulo: 'Error de validación',
        mensaje: 'Debe especificar los días de vencimiento'
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validarFormulario()) return;

    setCargando(true);
    try {
      if (modoEdicion) {
        await inventarioApi.updateProductoInventario(productoEditando.id, formData);
        setModalAlerta({
          tipo: 'success',
          titulo: 'Éxito',
          mensaje: 'Producto actualizado correctamente'
        });
      } else {
        await inventarioApi.createProductoInventario(formData);
        setModalAlerta({
          tipo: 'success',
          titulo: 'Éxito',
          mensaje: 'Producto creado correctamente'
        });
      }
      
      await cargarDatos();
      cerrarModal();
    } catch (error) {
      console.error('Error al guardar producto:', error);
      setModalAlerta({
        tipo: 'error',
        titulo: 'Error',
        mensaje: error.message || 'Error al guardar el producto'
      });
    } finally {
      setCargando(false);
    }
  };

  const confirmarEliminar = (producto) => {
    setModalConfirmacion({
      titulo: '¿Eliminar producto?',
      mensaje: `¿Estás seguro de eliminar "${producto.nombre}"? Esta acción no se puede deshacer.`,
      onConfirmar: () => eliminarProducto(producto.id)
    });
  };

  const eliminarProducto = async (id) => {
    setCargando(true);
    try {
      await inventarioApi.deleteProductoInventario(id);
      setModalAlerta({
        tipo: 'success',
        titulo: 'Éxito',
        mensaje: 'Producto eliminado correctamente'
      });
      await cargarDatos();
      setModalConfirmacion(null);
    } catch (error) {
      console.error('Error al eliminar producto:', error);
      setModalAlerta({
        tipo: 'error',
        titulo: 'Error',
        mensaje: error.message || 'Error al eliminar el producto'
      });
    } finally {
      setCargando(false);
    }
  };

  const obtenerNombreCategoria = (categoriaId) => {
    const categoria = categorias.find(c => c.id === categoriaId);
    return categoria ? categoria.nombre : 'Sin categoría';
  };

  const obtenerNombreProveedor = (proveedorId) => {
    if (!proveedorId) return 'Sin proveedor';
    const proveedor = proveedores.find(p => p.id === proveedorId);
    return proveedor ? proveedor.nombre : 'Sin proveedor';
  };

  const productosFiltrados = productos.filter(producto => {
    const cumpleBusqueda = producto.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
                          producto.codigo.toLowerCase().includes(busqueda.toLowerCase());
    
    const cumpleCategoria = filtroCategoria === 'todas' || 
                           producto.categoriaId.toString() === filtroCategoria;
    
    return cumpleBusqueda && cumpleCategoria;
  });

  if (cargando && productos.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando productos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con Acciones */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
              <Package className="h-7 w-7 text-blue-500" />
              <span>Gestión de Productos</span>
            </h2>
            <p className="text-gray-600 mt-1">
              {productosFiltrados.length} producto{productosFiltrados.length !== 1 ? 's' : ''} encontrado{productosFiltrados.length !== 1 ? 's' : ''}
            </p>
          </div>
          
          <button
            onClick={abrirModalNuevo}
            disabled={cargando}
            className="flex items-center space-x-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-3 rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="h-5 w-5" />
            <span className="font-semibold">Nuevo Producto</span>
          </button>
        </div>

        {/* Filtros y Búsqueda */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Búsqueda */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o código..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Filtro por Categoría */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
            >
              <option value="todas">Todas las categorías</option>
              {categorias.map(cat => (
                <option key={cat.id} value={cat.id.toString()}>
                  {cat.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Lista de Productos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {productosFiltrados.map((producto) => (
          <div
            key={producto.id}
            className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow"
          >
            {/* Imagen del Producto */}
            <div className="h-48 bg-gray-100 flex items-center justify-center overflow-hidden">
              {producto.imagenUrl ? (
                <img
                  src={producto.imagenUrl}
                  alt={producto.nombre}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.parentElement.innerHTML = `
                      <div class="flex flex-col items-center justify-center text-gray-400">
                        <svg class="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span class="text-sm mt-2">Sin imagen</span>
                      </div>
                    `;
                  }}
                />
              ) : (
                <div className="flex flex-col items-center text-gray-400">
                  <ImageIcon className="h-16 w-16" />
                  <span className="text-sm mt-2">Sin imagen</span>
                </div>
              )}
            </div>

            {/* Información del Producto */}
            <div className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">{producto.nombre}</h3>
                  <div className="flex items-center space-x-2 mt-1">
                    <Barcode className="h-4 w-4 text-gray-400" />
                    <p className="text-sm text-gray-500">{producto.codigo}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                  producto.activo
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {producto.activo ? 'Activo' : 'Inactivo'}
                </span>
              </div>

              {producto.descripcion && (
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                  {producto.descripcion}
                </p>
              )}

              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Categoría:</span>
                  <span className="font-medium text-gray-900">
                    {obtenerNombreCategoria(producto.categoriaId)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Proveedor:</span>
                  <span className="font-medium text-gray-900">
                    {obtenerNombreProveedor(producto.proveedorId)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Unidad:</span>
                  <span className="font-medium text-gray-900">{producto.unidadMedida}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-gray-500 text-sm">Precio Costo:</span>
                  <span className="font-bold text-green-600 text-lg">
                    ${producto.precioCosto.toLocaleString('es-CO')}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Stock Mínimo:</span>
                  <span className="font-medium text-gray-900">{producto.stockMinimo}</span>
                </div>

                {producto.requiereCaducidad && (
                  <div className="flex items-center space-x-2 text-orange-600 text-sm">
                    <Calendar className="h-4 w-4" />
                    <span>Requiere control de vencimiento ({producto.diasVencimiento} días)</span>
                  </div>
                )}
              </div>

              {/* Acciones */}
              <div className="flex space-x-2">
                <button
                  onClick={() => abrirModalEditar(producto)}
                  disabled={cargando}
                  className="flex-1 flex items-center justify-center space-x-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Edit className="h-4 w-4" />
                  <span>Editar</span>
                </button>
                
                <button
                  onClick={() => confirmarEliminar(producto)}
                  disabled={cargando}
                  className="flex-1 flex items-center justify-center space-x-2 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Eliminar</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {productosFiltrados.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl shadow-md">
          <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">No se encontraron productos</p>
          <p className="text-gray-400 text-sm mt-2">
            {busqueda || filtroCategoria !== 'todas' 
              ? 'Intenta cambiar los filtros de búsqueda'
              : 'Crea tu primer producto para comenzar'
            }
          </p>
        </div>
      )}

      {/* Modal de Formulario */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header del Modal */}
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white flex items-center space-x-2">
                <Package className="h-6 w-6" />
                <span>{modoEdicion ? 'Editar Producto' : 'Nuevo Producto'}</span>
              </h3>
              <button
                onClick={cerrarModal}
                className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Código */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Código del Producto *
                  </label>
                  <input
                    type="text"
                    name="codigo"
                    value={formData.codigo}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="PROD-001"
                  />
                </div>

                {/* Nombre */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre del Producto *
                  </label>
                  <input
                    type="text"
                    name="nombre"
                    value={formData.nombre}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Lomo de res"
                  />
                </div>

                {/* Categoría */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Categoría *
                  </label>
                  <select
                    name="categoriaId"
                    value={formData.categoriaId}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Seleccionar categoría</option>
                    {categorias.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Proveedor */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Proveedor
                  </label>
                  <select
                    name="proveedorId"
                    value={formData.proveedorId}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Sin proveedor</option>
                    {proveedores.map(prov => (
                      <option key={prov.id} value={prov.id}>
                        {prov.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Unidad de Medida */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Unidad de Medida *
                  </label>
                  <select
                    name="unidadMedida"
                    value={formData.unidadMedida}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {unidadesMedida.map(unidad => (
                      <option key={unidad} value={unidad}>
                        {unidad}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Precio Costo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Precio de Costo *
                  </label>
                  <input
                    type="number"
                    name="precioCosto"
                    value={formData.precioCosto}
                    onChange={handleInputChange}
                    required
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="15000"
                  />
                </div>

                {/* Stock Mínimo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Stock Mínimo *
                  </label>
                  <input
                    type="number"
                    name="stockMinimo"
                    value={formData.stockMinimo}
                    onChange={handleInputChange}
                    required
                    min="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="10"
                  />
                </div>

                {/* Stock Máximo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Stock Máximo
                  </label>
                  <input
                    type="number"
                    name="stockMaximo"
                    value={formData.stockMaximo}
                    onChange={handleInputChange}
                    min="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="100"
                  />
                </div>

                {/* Punto de Reorden */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Punto de Reorden
                  </label>
                  <input
                    type="number"
                    name="puntoReorden"
                    value={formData.puntoReorden}
                    onChange={handleInputChange}
                    min="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="20"
                  />
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descripción
                </label>
                <textarea
                  name="descripcion"
                  value={formData.descripcion}
                  onChange={handleInputChange}
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Descripción detallada del producto..."
                />
              </div>

              {/* Control de Caducidad */}
              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center space-x-2 mb-4">
                  <input
                    type="checkbox"
                    name="requiereCaducidad"
                    id="requiereCaducidad"
                    checked={formData.requiereCaducidad}
                    onChange={handleInputChange}
                    className="w-5 h-5 text-blue-500 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <label htmlFor="requiereCaducidad" className="text-sm font-medium text-gray-700">
                    Este producto requiere control de caducidad
                  </label>
                </div>

                {formData.requiereCaducidad && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Días de Vencimiento *
                    </label>
                    <input
                      type="number"
                      name="diasVencimiento"
                      value={formData.diasVencimiento}
                      onChange={handleInputChange}
                      required={formData.requiereCaducidad}
                      min="1"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="30"
                    />
                  </div>
                )}
              </div>

              {/* URL de Imagen */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  URL de Imagen
                </label>
                <input
                  type="url"
                  name="imagenUrl"
                  value={formData.imagenUrl}
                  onChange={handleImagenUrl}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://example.com/imagen.jpg"
                />
                {imagenPreview && (
                  <div className="mt-4">
                    <p className="text-sm text-gray-600 mb-2">Vista previa:</p>
                    <img
                      src={imagenPreview}
                      alt="Preview"
                      className="w-full max-w-xs h-48 object-cover rounded-lg border border-gray-300"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Estado Activo */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  name="activo"
                  id="activo"
                  checked={formData.activo}
                  onChange={handleInputChange}
                  className="w-5 h-5 text-blue-500 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
                <label htmlFor="activo" className="text-sm font-medium text-gray-700">
                  Producto activo
                </label>
              </div>

              {/* Botones de Acción */}
              <div className="flex space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={cerrarModal}
                  disabled={cargando}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={cargando}
                  className="flex-1 flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-3 rounded-lg hover:from-blue-600 hover:to-purple-700 font-semibold transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {cargando ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-5 w-5" />
                      <span>{modoEdicion ? 'Actualizar' : 'Crear'} Producto</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Alerta */}
      {modalAlerta && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center space-x-3 mb-4">
              {modalAlerta.tipo === 'success' ? (
                <CheckCircle className="h-8 w-8 text-green-500" />
              ) : (
                <AlertCircle className="h-8 w-8 text-red-500" />
              )}
              <h3 className="text-xl font-bold text-gray-900">{modalAlerta.titulo}</h3>
            </div>
            <p className="text-gray-600 mb-6">{modalAlerta.mensaje}</p>
            <button
              onClick={() => setModalAlerta(null)}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-lg hover:from-blue-600 hover:to-purple-700 font-semibold transition-all"
            >
              Aceptar
            </button>
          </div>
        </div>
      )}

      {/* Modal de Confirmación */}
      {modalConfirmacion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center space-x-3 mb-4">
              <AlertTriangle className="h-8 w-8 text-orange-500" />
              <h3 className="text-xl font-bold text-gray-900">{modalConfirmacion.titulo}</h3>
            </div>
            <p className="text-gray-600 mb-6">{modalConfirmacion.mensaje}</p>
            <div className="flex space-x-3">
              <button
                onClick={() => setModalConfirmacion(null)}
                disabled={cargando}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={modalConfirmacion.onConfirmar}
                disabled={cargando}
                className="flex-1 bg-red-500 text-white px-6 py-3 rounded-lg hover:bg-red-600 font-semibold transition-colors disabled:opacity-50"
              >
                {cargando ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GestionProductos;
