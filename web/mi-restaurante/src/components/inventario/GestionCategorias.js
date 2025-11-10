// src/components/inventario/GestionCategorias.js
import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  Tag,
  CheckCircle,
  AlertCircle,
  Search
} from 'lucide-react';
import * as inventarioApi from '../../services/inventarioApi';

function GestionCategorias() {
  const [categorias, setCategorias] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [categoriaEditando, setCategoriaEditando] = useState(null);
  const [modalAlerta, setModalAlerta] = useState(null);
  const [modalConfirmacion, setModalConfirmacion] = useState(null);
  const [busqueda, setBusqueda] = useState('');

  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    tipo: 'Ingrediente',
    color: '#3b82f6',
    activo: true
  });

  const tipos = ['Ingrediente', 'Bebida', 'MaterialLimpieza', 'ProductoTerminado', 'Otro'];

  const coloresDisponibles = [
    { nombre: 'Azul', valor: '#3b82f6' },
    { nombre: 'Rojo', valor: '#ef4444' },
    { nombre: 'Verde', valor: '#10b981' },
    { nombre: 'Naranja', valor: '#f59e0b' },
    { nombre: 'Púrpura', valor: '#8b5cf6' },
    { nombre: 'Rosa', valor: '#ec4899' },
    { nombre: 'Amarillo', valor: '#eab308' },
    { nombre: 'Gris', valor: '#6b7280' }
  ];

  useEffect(() => {
    cargarCategorias();
  }, []);

  const cargarCategorias = async () => {
    setCargando(true);
    try {
      const data = await inventarioApi.getCategoriasInventario();
      setCategorias(data);
    } catch (error) {
      console.error('Error al cargar categorías:', error);
      setModalAlerta({
        tipo: 'error',
        titulo: 'Error',
        mensaje: 'No se pudieron cargar las categorías'
      });
    } finally {
      setCargando(false);
    }
  };

  const abrirModalNuevo = () => {
    setModoEdicion(false);
    setCategoriaEditando(null);
    setFormData({
      nombre: '',
      descripcion: '',
      tipo: 'Ingrediente',
      color: '#3b82f6',
      activo: true
    });
    setModalAbierto(true);
  };

  const abrirModalEditar = (categoria) => {
    setModoEdicion(true);
    setCategoriaEditando(categoria);
    setFormData({
      nombre: categoria.nombre,
      descripcion: categoria.descripcion || '',
      tipo: categoria.tipo,
      color: categoria.color || '#3b82f6',
      activo: categoria.activo
    });
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setModoEdicion(false);
    setCategoriaEditando(null);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const validarFormulario = () => {
    if (!formData.nombre.trim()) {
      setModalAlerta({
        tipo: 'error',
        titulo: 'Error de validación',
        mensaje: 'El nombre de la categoría es obligatorio'
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
        await inventarioApi.updateCategoriaInventario(categoriaEditando.id, formData);
        setModalAlerta({
          tipo: 'success',
          titulo: 'Éxito',
          mensaje: 'Categoría actualizada correctamente'
        });
      } else {
        await inventarioApi.createCategoriaInventario(formData);
        setModalAlerta({
          tipo: 'success',
          titulo: 'Éxito',
          mensaje: 'Categoría creada correctamente'
        });
      }
      
      await cargarCategorias();
      cerrarModal();
    } catch (error) {
      console.error('Error al guardar categoría:', error);
      setModalAlerta({
        tipo: 'error',
        titulo: 'Error',
        mensaje: error.message || 'Error al guardar la categoría'
      });
    } finally {
      setCargando(false);
    }
  };

  const confirmarEliminar = (categoria) => {
    setModalConfirmacion({
      titulo: '¿Eliminar categoría?',
      mensaje: `¿Estás seguro de eliminar "${categoria.nombre}"? Esta acción no se puede deshacer.`,
      onConfirmar: () => eliminarCategoria(categoria.id)
    });
  };

  const eliminarCategoria = async (id) => {
    setCargando(true);
    try {
      await inventarioApi.deleteCategoriaInventario(id);
      setModalAlerta({
        tipo: 'success',
        titulo: 'Éxito',
        mensaje: 'Categoría eliminada correctamente'
      });
      await cargarCategorias();
      setModalConfirmacion(null);
    } catch (error) {
      console.error('Error al eliminar categoría:', error);
      setModalAlerta({
        tipo: 'error',
        titulo: 'Error',
        mensaje: error.message || 'Error al eliminar la categoría'
      });
    } finally {
      setCargando(false);
    }
  };

  const categoriasFiltradas = categorias.filter(cat => 
    cat.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    cat.tipo.toLowerCase().includes(busqueda.toLowerCase())
  );

  if (cargando && categorias.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando categorías...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
              <Tag className="h-7 w-7 text-purple-500" />
              <span>Categorías de Inventario</span>
            </h2>
            <p className="text-gray-600 mt-1">
              {categoriasFiltradas.length} categoría{categoriasFiltradas.length !== 1 ? 's' : ''} encontrada{categoriasFiltradas.length !== 1 ? 's' : ''}
            </p>
          </div>
          
          <button
            onClick={abrirModalNuevo}
            disabled={cargando}
            className="flex items-center space-x-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white px-6 py-3 rounded-lg hover:from-purple-600 hover:to-pink-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50"
          >
            <Plus className="h-5 w-5" />
            <span className="font-semibold">Nueva Categoría</span>
          </button>
        </div>

        {/* Búsqueda */}
        <div className="mt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o tipo..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Lista de Categorías */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categoriasFiltradas.map((categoria) => (
          <div
            key={categoria.id}
            className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow border-l-4"
            style={{ borderLeftColor: categoria.color }}
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${categoria.color}20` }}
                  >
                    <Tag className="h-6 w-6" style={{ color: categoria.color }} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">{categoria.nombre}</h3>
                    <span className="text-sm text-gray-500">{categoria.tipo}</span>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                  categoria.activo
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {categoria.activo ? 'Activo' : 'Inactivo'}
                </span>
              </div>

              {categoria.descripcion && (
                <p className="text-sm text-gray-600 mb-4">
                  {categoria.descripcion}
                </p>
              )}

              {/* Acciones */}
              <div className="flex space-x-2 pt-4 border-t border-gray-200">
                <button
                  onClick={() => abrirModalEditar(categoria)}
                  disabled={cargando}
                  className="flex-1 flex items-center justify-center space-x-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                >
                  <Edit className="h-4 w-4" />
                  <span>Editar</span>
                </button>
                
                <button
                  onClick={() => confirmarEliminar(categoria)}
                  disabled={cargando}
                  className="flex-1 flex items-center justify-center space-x-2 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Eliminar</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {categoriasFiltradas.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl shadow-md">
          <Tag className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">No se encontraron categorías</p>
        </div>
      )}

      {/* Modal de Formulario */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-purple-500 to-pink-600 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white flex items-center space-x-2">
                <Tag className="h-6 w-6" />
                <span>{modoEdicion ? 'Editar Categoría' : 'Nueva Categoría'}</span>
              </h3>
              <button
                onClick={cerrarModal}
                className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Nombre */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre de la Categoría *
                </label>
                <input
                  type="text"
                  name="nombre"
                  value={formData.nombre}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Ej: Carnes Rojas"
                />
              </div>

              {/* Tipo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo *
                </label>
                <select
                  name="tipo"
                  value={formData.tipo}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  {tipos.map(tipo => (
                    <option key={tipo} value={tipo}>{tipo}</option>
                  ))}
                </select>
              </div>

              {/* Color */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color
                </label>
                <div className="grid grid-cols-4 gap-3">
                  {coloresDisponibles.map(color => (
                    <button
                      key={color.valor}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, color: color.valor }))}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        formData.color === color.valor
                          ? 'border-gray-900 ring-2 ring-gray-900'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                      style={{ backgroundColor: color.valor }}                    >
                      <span className="sr-only">{color.nombre}</span>
                    </button>
                  ))}
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  placeholder="Descripción opcional de la categoría..."
                />
              </div>

              {/* Estado Activo */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  name="activo"
                  id="activo"
                  checked={formData.activo}
                  onChange={handleInputChange}
                  className="w-5 h-5 text-purple-500 border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                />
                <label htmlFor="activo" className="text-sm font-medium text-gray-700">
                  Categoría activa
                </label>
              </div>

              {/* Botones */}
              <div className="flex space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={cerrarModal}
                  disabled={cargando}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={cargando}
                  className="flex-1 flex items-center justify-center space-x-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white px-6 py-3 rounded-lg hover:from-purple-600 hover:to-pink-700 font-semibold transition-all shadow-md hover:shadow-lg disabled:opacity-50"
                >
                  {cargando ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-5 w-5" />
                      <span>{modoEdicion ? 'Actualizar' : 'Crear'} Categoría</span>
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
              className="w-full bg-gradient-to-r from-purple-500 to-pink-600 text-white py-3 rounded-lg hover:from-purple-600 hover:to-pink-700 font-semibold transition-all"
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
              <AlertCircle className="h-8 w-8 text-orange-500" />
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

export default GestionCategorias;
