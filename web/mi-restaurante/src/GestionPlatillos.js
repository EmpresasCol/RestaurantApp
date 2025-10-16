// src/GestionPlatillos.js
import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, X, ChefHat, DollarSign, Image as ImageIcon, Tag, Upload } from 'lucide-react';
import * as api from './services/api';

function GestionPlatillos() {
  const [platillos, setPlatillos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [platilloEditando, setPlatilloEditando] = useState(null);
  const [modalAlerta, setModalAlerta] = useState(null);
  const [modalConfirmacion, setModalConfirmacion] = useState(null);
  const [imagenPreview, setImagenPreview] = useState(null);
  const [archivoImagen, setArchivoImagen] = useState(null);

  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    precio: '',
    imagenUrl: '',
    categoria: 'Platos Principales'
  });

  const categorias = [
    'Entradas',
    'Platos Principales', 
    'Postres',
    'Bebidas',
    'Ensaladas',
    'Sopas'
  ];

  useEffect(() => {
    cargarPlatillos();
  }, []);

  const cargarPlatillos = async () => {
    setCargando(true);
    try {
      const data = await api.getPlatillos();
      setPlatillos(data);
    } catch (error) {
      console.error('Error al cargar platillos:', error);
      setModalAlerta({
        tipo: 'error',
        titulo: 'Error',
        mensaje: 'No se pudieron cargar los platillos'
      });
    } finally {
      setCargando(false);
    }
  };

  const abrirModalNuevo = () => {
    setModoEdicion(false);
    setPlatilloEditando(null);
    setImagenPreview(null);
    setArchivoImagen(null);
    setFormData({
      nombre: '',
      descripcion: '',
      precio: '',
      imagenUrl: '',
      categoria: 'Platos Principales'
    });
    setModalAbierto(true);
  };

  const abrirModalEditar = (platillo) => {
    setModoEdicion(true);
    setPlatilloEditando(platillo);
    setImagenPreview(platillo.imagenUrl);
    setArchivoImagen(null);
    setFormData({
      nombre: platillo.nombre,
      descripcion: platillo.descripcion,
      precio: platillo.precio.toString(),
      imagenUrl: platillo.imagenUrl || '',
      categoria: platillo.categoria || 'Platos Principales'
    });
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setModoEdicion(false);
    setPlatilloEditando(null);
    setImagenPreview(null);
    setArchivoImagen(null);
    setFormData({
      nombre: '',
      descripcion: '',
      precio: '',
      imagenUrl: '',
      categoria: 'Platos Principales'
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleImagenChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validar que sea una imagen
      if (!file.type.startsWith('image/')) {
        setModalAlerta({
          tipo: 'error',
          titulo: 'Error',
          mensaje: 'Por favor selecciona un archivo de imagen válido'
        });
        return;
      }

      // Validar tamaño (máximo 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setModalAlerta({
          tipo: 'error',
          titulo: 'Error',
          mensaje: 'La imagen no debe superar los 5MB'
        });
        return;
      }

      setArchivoImagen(file);

      // Crear preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagenPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const validarFormulario = () => {
    if (!formData.nombre.trim()) {
      setModalAlerta({
        tipo: 'error',
        titulo: 'Error',
        mensaje: 'El nombre es obligatorio'
      });
      return false;
    }
    if (!formData.precio || parseFloat(formData.precio) <= 0) {
      setModalAlerta({
        tipo: 'error',
        titulo: 'Error',
        mensaje: 'El precio debe ser mayor a 0'
      });
      return false;
    }
    return true;
  };

  const convertirImagenABase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validarFormulario()) return;

    setCargando(true);
    try {
      let imagenUrl = formData.imagenUrl;

      // Si se seleccionó una nueva imagen, convertirla a base64
      if (archivoImagen) {
        imagenUrl = await convertirImagenABase64(archivoImagen);
      }

      // Si no hay imagen, usar una por defecto
      if (!imagenUrl) {
        imagenUrl = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop';
      }

      const platilloData = {
        nombre: formData.nombre.trim(),
        descripcion: formData.descripcion.trim(),
        precio: parseFloat(formData.precio),
        imagenUrl: imagenUrl,
        categoria: formData.categoria
      };

      if (modoEdicion && platilloEditando) {
        await api.updatePlatillo(platilloEditando.id, platilloData);
        setModalAlerta({
          tipo: 'exito',
          titulo: '¡Actualizado!',
          mensaje: 'Platillo actualizado exitosamente'
        });
      } else {
        await api.createPlatillo(platilloData);
        setModalAlerta({
          tipo: 'exito',
          titulo: '¡Creado!',
          mensaje: 'Platillo creado exitosamente'
        });
      }

      cerrarModal();
      await cargarPlatillos();
    } catch (error) {
      console.error('Error al guardar platillo:', error);
      setModalAlerta({
        tipo: 'error',
        titulo: 'Error',
        mensaje: error.message || 'Error al guardar el platillo'
      });
    } finally {
      setCargando(false);
    }
  };

  const confirmarEliminar = (platillo) => {
    setModalConfirmacion({
      titulo: '¿Eliminar platillo?',
      mensaje: `¿Estás seguro de eliminar "${platillo.nombre}"? Esta acción no se puede deshacer.`,
      onConfirmar: () => eliminarPlatillo(platillo.id),
      onCancelar: () => setModalConfirmacion(null)
    });
  };

  const eliminarPlatillo = async (id) => {
    setModalConfirmacion(null);
    setCargando(true);
    try {
      await api.deletePlatillo(id);
      setModalAlerta({
        tipo: 'exito',
        titulo: '¡Eliminado!',
        mensaje: 'Platillo eliminado exitosamente'
      });
      await cargarPlatillos();
    } catch (error) {
      console.error('Error al eliminar platillo:', error);
      setModalAlerta({
        tipo: 'error',
        titulo: 'Error',
        mensaje: error.message || 'Error al eliminar el platillo'
      });
    } finally {
      setCargando(false);
    }
  };

  const formatearPrecio = (precio) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(precio);
  };

  const getColorCategoria = (categoria) => {
    const colores = {
      'Entradas': 'bg-green-100 text-green-700',
      'Platos Principales': 'bg-orange-100 text-orange-700',
      'Postres': 'bg-pink-100 text-pink-700',
      'Bebidas': 'bg-blue-100 text-blue-700',
      'Ensaladas': 'bg-lime-100 text-lime-700',
      'Sopas': 'bg-amber-100 text-amber-700'
    };
    return colores[categoria] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ChefHat className="text-orange-600" size={32} />
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Gestión de Platillos</h1>
                <p className="text-gray-600">Administra el menú del restaurante</p>
              </div>
            </div>
            <button
              onClick={abrirModalNuevo}
              disabled={cargando}
              className="flex items-center gap-2 bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 transition-colors font-semibold disabled:opacity-50"
            >
              <Plus size={20} />
              Nuevo Platillo
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {cargando && platillos.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Cargando platillos...</p>
            </div>
          </div>
        ) : platillos.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <ChefHat className="mx-auto text-gray-400 mb-4" size={64} />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">No hay platillos</h3>
            <p className="text-gray-500 mb-6">Comienza agregando tu primer platillo al menú</p>
            <button
              onClick={abrirModalNuevo}
              className="bg-orange-500 text-white px-6 py-2 rounded-lg hover:bg-orange-600 transition-colors"
            >
              Agregar Platillo
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {platillos.map(platillo => (
              <div key={platillo.id} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow">
                <div className="h-48 overflow-hidden bg-gray-200">
                  <img 
                    src={platillo.imagenUrl} 
                    alt={platillo.nombre}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop';
                    }}
                  />
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-bold text-lg text-gray-800 flex-1">{platillo.nombre}</h3>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${getColorCategoria(platillo.categoria)}`}>
                      {platillo.categoria}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {platillo.descripcion}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-bold text-orange-600">
                      {formatearPrecio(platillo.precio)}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => abrirModalEditar(platillo)}
                        className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                        title="Editar"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => confirmarEliminar(platillo)}
                        className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Crear/Editar */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-800">
                {modoEdicion ? 'Editar Platillo' : 'Nuevo Platillo'}
              </h2>
              <button onClick={cerrarModal} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre del Platillo *
                </label>
                <input
                  type="text"
                  name="nombre"
                  value={formData.nombre}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Ej: Hamburguesa Clásica"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descripción
                </label>
                <textarea
                  name="descripcion"
                  value={formData.descripcion}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                  rows="3"
                  placeholder="Describe los ingredientes y características del platillo"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Precio * (COP)
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="number"
                      name="precio"
                      value={formData.precio}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="15000"
                      min="0"
                      step="100"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Categoría *
                  </label>
                  <div className="relative">
                    <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <select
                      name="categoria"
                      value={formData.categoria}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent appearance-none"
                      required
                    >
                      {categorias.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Sección de imagen */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Imagen del Platillo
                </label>
                
                {/* Vista previa de la imagen */}
                {imagenPreview && (
                  <div className="mb-4 border-2 border-gray-200 rounded-lg p-2">
                    <img 
                      src={imagenPreview} 
                      alt="Vista previa"
                      className="w-full h-48 object-cover rounded-lg"
                      onError={(e) => {
                        e.target.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop';
                      }}
                    />
                  </div>
                )}

                {/* Botón para subir archivo */}
                <div className="flex items-center gap-3">
                  <label className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition-colors">
                      <Upload size={20} className="text-gray-600" />
                      <span className="text-sm font-medium text-gray-700">
                        {archivoImagen ? archivoImagen.name : 'Seleccionar imagen desde tu computadora'}
                      </span>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImagenChange}
                      className="hidden"
                    />
                  </label>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Formatos: JPG, PNG, GIF. Tamaño máximo: 5MB
                </p>
              </div>

              {/* URL alternativa */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  O proporciona una URL de imagen
                </label>
                <div className="relative">
                  <ImageIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="url"
                    name="imagenUrl"
                    value={formData.imagenUrl}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="https://ejemplo.com/imagen.jpg"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={cerrarModal}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-lg font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={cargando}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Save size={20} />
                  {modoEdicion ? 'Actualizar' : 'Crear'} Platillo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmación */}
      {modalConfirmacion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="text-red-600" size={32} />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">{modalConfirmacion.titulo}</h3>
              <p className="text-gray-600">{modalConfirmacion.mensaje}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={modalConfirmacion.onCancelar}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-lg font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={modalConfirmacion.onConfirmar}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-lg font-semibold transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Alerta */}
      {modalAlerta && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="text-center mb-6">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                modalAlerta.tipo === 'exito' ? 'bg-green-100' : 'bg-red-100'
              }`}>
                <span className="text-4xl">{modalAlerta.tipo === 'exito' ? '✅' : '❌'}</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">{modalAlerta.titulo}</h3>
              <p className="text-gray-600">{modalAlerta.mensaje}</p>
            </div>
            <button
              onClick={() => setModalAlerta(null)}
              className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                modalAlerta.tipo === 'exito' 
                  ? 'bg-green-500 hover:bg-green-600 text-white' 
                  : 'bg-red-500 hover:bg-red-600 text-white'
              }`}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default GestionPlatillos;