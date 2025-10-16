// src/GestionUsuarios.js
import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, X, Users, Shield, Eye, EyeOff, CheckCircle, AlertCircle, Lock } from 'lucide-react';
import * as api from './services/api';

function GestionUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState(null);
  const [modalAlerta, setModalAlerta] = useState(null);
  const [modalConfirmacion, setModalConfirmacion] = useState(null);
  const [mostrarPassword, setMostrarPassword] = useState(false);

  const [formData, setFormData] = useState({
    nombreUsuario: '',
    clave: '',
    confirmarClave: '',
    nombre: '',
    rol: 'Caja'
  });

  const roles = ['Administrador', 'Caja', 'Cocina', 'Mesero'];

  const getRolColor = (rol) => {
    const colores = {
      'Administrador': 'bg-purple-100 text-purple-700 border-purple-300',
      'Caja': 'bg-green-100 text-green-700 border-green-300',
      'Cocina': 'bg-orange-100 text-orange-700 border-orange-300',
      'Mesero': 'bg-blue-100 text-blue-700 border-blue-300'
    };
    return colores[rol] || 'bg-gray-100 text-gray-700 border-gray-300';
  };

  const getRolIcon = (rol) => {
    switch(rol) {
      case 'Administrador':
        return '👑';
      case 'Caja':
        return '💰';
      case 'Cocina':
        return '👨‍🍳';
      case 'Mesero':
        return '🍽️';
      default:
        return '👤';
    }
  };

  useEffect(() => {
    cargarUsuarios();
  }, []);

  const cargarUsuarios = async () => {
    setCargando(true);
    try {
      const data = await api.getUsuarios();
      setUsuarios(data);
      console.log('✅ Usuarios cargados:', data);
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
      setModalAlerta({
        tipo: 'error',
        titulo: 'Error',
        mensaje: 'No se pudieron cargar los usuarios'
      });
    } finally {
      setCargando(false);
    }
  };

  const abrirModalNuevo = () => {
    setModoEdicion(false);
    setUsuarioEditando(null);
    setFormData({
      nombreUsuario: '',
      clave: '',
      confirmarClave: '',
      nombre: '',
      rol: 'Caja'
    });
    setModalAbierto(true);
  };

  const abrirModalEditar = (usuario) => {
    setModoEdicion(true);
    setUsuarioEditando(usuario);
    setFormData({
      nombreUsuario: usuario.nombreUsuario,
      clave: '',
      confirmarClave: '',
      nombre: usuario.nombre,
      rol: usuario.rol
    });
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setModoEdicion(false);
    setUsuarioEditando(null);
    setMostrarPassword(false);
    setFormData({
      nombreUsuario: '',
      clave: '',
      confirmarClave: '',
      nombre: '',
      rol: 'Caja'
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validarFormulario = () => {
    if (!formData.nombreUsuario.trim()) {
      setModalAlerta({
        tipo: 'error',
        titulo: 'Error',
        mensaje: 'El nombre de usuario es obligatorio'
      });
      return false;
    }

    if (formData.nombreUsuario.length < 3) {
      setModalAlerta({
        tipo: 'error',
        titulo: 'Error',
        mensaje: 'El nombre de usuario debe tener al menos 3 caracteres'
      });
      return false;
    }

    if (!formData.nombre.trim()) {
      setModalAlerta({
        tipo: 'error',
        titulo: 'Error',
        mensaje: 'El nombre completo es obligatorio'
      });
      return false;
    }

    if (!modoEdicion || formData.clave) {
      if (!formData.clave) {
        setModalAlerta({
          tipo: 'error',
          titulo: 'Error',
          mensaje: 'La contraseña es obligatoria'
        });
        return false;
      }

      if (formData.clave.length < 4) {
        setModalAlerta({
          tipo: 'error',
          titulo: 'Error',
          mensaje: 'La contraseña debe tener al menos 4 caracteres'
        });
        return false;
      }

      if (formData.clave !== formData.confirmarClave) {
        setModalAlerta({
          tipo: 'error',
          titulo: 'Error',
          mensaje: 'Las contraseñas no coinciden'
        });
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validarFormulario()) return;

    setCargando(true);
    try {
      const usuarioData = {
        nombreUsuario: formData.nombreUsuario.trim(),
        nombre: formData.nombre.trim(),
        rol: formData.rol
      };

      if (formData.clave) {
        usuarioData.clave = formData.clave;
      }

      if (modoEdicion && usuarioEditando) {
        await api.updateUsuario(usuarioEditando.id, usuarioData);
        setModalAlerta({
          tipo: 'exito',
          titulo: '¡Actualizado!',
          mensaje: 'Usuario actualizado exitosamente'
        });
      } else {
        await api.createUsuario(usuarioData);
        setModalAlerta({
          tipo: 'exito',
          titulo: '¡Creado!',
          mensaje: 'Usuario creado exitosamente'
        });
      }

      cerrarModal();
      await cargarUsuarios();
    } catch (error) {
      console.error('Error al guardar usuario:', error);
      setModalAlerta({
        tipo: 'error',
        titulo: 'Error',
        mensaje: error.message || 'Error al guardar el usuario'
      });
    } finally {
      setCargando(false);
    }
  };

  const confirmarEliminar = (usuario) => {
    setModalConfirmacion({
      titulo: '¿Eliminar usuario?',
      mensaje: `¿Estás seguro de eliminar al usuario "${usuario.nombreUsuario}"? Esta acción no se puede deshacer.`,
      onConfirmar: () => eliminarUsuario(usuario.id),
      onCancelar: () => setModalConfirmacion(null)
    });
  };

  const eliminarUsuario = async (id) => {
    setModalConfirmacion(null);
    setCargando(true);
    try {
      await api.deleteUsuario(id);
      setModalAlerta({
        tipo: 'exito',
        titulo: '¡Eliminado!',
        mensaje: 'Usuario eliminado exitosamente'
      });
      await cargarUsuarios();
    } catch (error) {
      console.error('Error al eliminar usuario:', error);
      setModalAlerta({
        tipo: 'error',
        titulo: 'Error',
        mensaje: error.message || 'Error al eliminar el usuario'
      });
    } finally {
      setCargando(false);
    }
  };

  const estadisticasRoles = roles.reduce((acc, rol) => {
    acc[rol] = usuarios.filter(u => u.rol === rol).length;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="text-purple-600" size={32} />
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Gestión de Usuarios</h1>
                <p className="text-gray-600">Administra los usuarios del sistema</p>
              </div>
            </div>
            <button
              onClick={abrirModalNuevo}
              disabled={cargando}
              className="flex items-center gap-2 bg-purple-500 text-white px-6 py-3 rounded-lg hover:bg-purple-600 transition-colors font-semibold disabled:opacity-50"
            >
              <Plus size={20} />
              Nuevo Usuario
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {roles.map(rol => (
            <div key={rol} className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{rol}</p>
                  <p className="text-2xl font-bold text-gray-900">{estadisticasRoles[rol]}</p>
                </div>
                <span className="text-3xl">{getRolIcon(rol)}</span>
              </div>
            </div>
          ))}
        </div>

        {cargando && usuarios.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Cargando usuarios...</p>
            </div>
          </div>
        ) : usuarios.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <Users className="mx-auto text-gray-400 mb-4" size={64} />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">No hay usuarios</h3>
            <p className="text-gray-500 mb-6">Comienza agregando el primer usuario al sistema</p>
            <button
              onClick={abrirModalNuevo}
              className="bg-purple-500 text-white px-6 py-2 rounded-lg hover:bg-purple-600 transition-colors"
            >
              Agregar Usuario
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Usuario</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Nombre Completo</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Rol</th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {usuarios.map((usuario) => (
                    <tr key={usuario.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                            <span className="text-lg">{getRolIcon(usuario.rol)}</span>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{usuario.nombreUsuario}</p>
                            <p className="text-xs text-gray-500">ID: {usuario.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-gray-900">{usuario.nombre}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border ${getRolColor(usuario.rol)}`}>
                          <Shield size={14} />
                          {usuario.rol}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => abrirModalEditar(usuario)}
                            className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                            title="Editar"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => confirmarEliminar(usuario)}
                            className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {modalAbierto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-800">
                {modoEdicion ? 'Editar Usuario' : 'Nuevo Usuario'}
              </h2>
              <button onClick={cerrarModal} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre de Usuario *
                  </label>
                  <input
                    type="text"
                    name="nombreUsuario"
                    value={formData.nombreUsuario}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="usuario123"
                    required
                    disabled={modoEdicion}
                  />
                  {modoEdicion && (
                    <p className="text-xs text-gray-500 mt-1">El nombre de usuario no se puede cambiar</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Rol *</label>
                  <div className="relative">
                    <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <select
                      name="rol"
                      value={formData.rol}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent appearance-none"
                      required
                    >
                      {roles.map(rol => (
                        <option key={rol} value={rol}>{getRolIcon(rol)} {rol}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nombre Completo *</label>
                <input
                  type="text"
                  name="nombre"
                  value={formData.nombre}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Juan Pérez"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {modoEdicion ? 'Nueva Contraseña (dejar en blanco para no cambiar)' : 'Contraseña *'}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type={mostrarPassword ? "text" : "password"}
                      name="clave"
                      value={formData.clave}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="••••••••"
                      required={!modoEdicion}
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarPassword(!mostrarPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {mostrarPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {modoEdicion ? 'Confirmar Nueva Contraseña' : 'Confirmar Contraseña *'}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type={mostrarPassword ? "text" : "password"}
                      name="confirmarClave"
                      value={formData.confirmarClave}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="••••••••"
                      required={!modoEdicion || formData.clave}
                    />
                  </div>
                </div>
              </div>

              {modoEdicion && !formData.clave && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    💡 Si no deseas cambiar la contraseña, deja los campos en blanco
                  </p>
                </div>
              )}

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
                  className="flex-1 bg-purple-500 hover:bg-purple-600 text-white py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Save size={20} />
                  {modoEdicion ? 'Actualizar' : 'Crear'} Usuario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

      {modalAlerta && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="text-center mb-6">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                modalAlerta.tipo === 'exito' ? 'bg-green-100' : 'bg-red-100'
              }`}>
                {modalAlerta.tipo === 'exito' ? (
                  <CheckCircle className="text-green-600" size={32} />
                ) : (
                  <AlertCircle className="text-red-600" size={32} />
                )}
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

export default GestionUsuarios;