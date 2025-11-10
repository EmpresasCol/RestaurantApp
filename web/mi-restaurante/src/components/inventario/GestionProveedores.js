// src/components/inventario/GestionProveedores.js
import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, X, Users, CheckCircle, AlertCircle, Search, Mail, Phone, MapPin } from 'lucide-react';
import * as inventarioApi from '../../services/inventarioApi';

function GestionProveedores() {
  const [proveedores, setProveedores] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [proveedorEditando, setProveedorEditando] = useState(null);
  const [modalAlerta, setModalAlerta] = useState(null);
  const [modalConfirmacion, setModalConfirmacion] = useState(null);
  const [busqueda, setBusqueda] = useState('');

  const [formData, setFormData] = useState({
    nombre: '',
    contacto: '',
    telefono: '',
    email: '',
    direccion: '',
    ciudad: '',
    tipoProductos: '',
    activo: true
  });

  useEffect(() => {
    cargarProveedores();
  }, []);

  const cargarProveedores = async () => {
    setCargando(true);
    try {
      const data = await inventarioApi.getProveedores();
      setProveedores(data);
    } catch (error) {
      console.error('Error:', error);
      setModalAlerta({ tipo: 'error', titulo: 'Error', mensaje: 'No se pudieron cargar los proveedores' });
    } finally {
      setCargando(false);
    }
  };

  const abrirModalNuevo = () => {
    setModoEdicion(false);
    setProveedorEditando(null);
    setFormData({ nombre: '', contacto: '', telefono: '', email: '', direccion: '', ciudad: '', tipoProductos: '', activo: true });
    setModalAbierto(true);
  };

  const abrirModalEditar = (proveedor) => {
    setModoEdicion(true);
    setProveedorEditando(proveedor);
    setFormData({
      nombre: proveedor.nombre,
      contacto: proveedor.contacto || '',
      telefono: proveedor.telefono || '',
      email: proveedor.email || '',
      direccion: proveedor.direccion || '',
      ciudad: proveedor.ciudad || '',
      tipoProductos: proveedor.tipoProductos || '',
      activo: proveedor.activo
    });
    setModalAbierto(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nombre.trim()) {
      setModalAlerta({ tipo: 'error', titulo: 'Error', mensaje: 'El nombre es obligatorio' });
      return;
    }

    setCargando(true);
    try {
      if (modoEdicion) {
        await inventarioApi.updateProveedor(proveedorEditando.id, formData);
        setModalAlerta({ tipo: 'success', titulo: 'Éxito', mensaje: 'Proveedor actualizado' });
      } else {
        await inventarioApi.createProveedor(formData);
        setModalAlerta({ tipo: 'success', titulo: 'Éxito', mensaje: 'Proveedor creado' });
      }
      await cargarProveedores();
      setModalAbierto(false);
    } catch (error) {
      setModalAlerta({ tipo: 'error', titulo: 'Error', mensaje: error.message });
    } finally {
      setCargando(false);
    }
  };

  const eliminarProveedor = async (id) => {
    setCargando(true);
    try {
      await inventarioApi.deleteProveedor(id);
      setModalAlerta({ tipo: 'success', titulo: 'Éxito', mensaje: 'Proveedor eliminado' });
      await cargarProveedores();
      setModalConfirmacion(null);
    } catch (error) {
      setModalAlerta({ tipo: 'error', titulo: 'Error', mensaje: error.message });
    } finally {
      setCargando(false);
    }
  };

  const proveedoresFiltrados = proveedores.filter(p =>
    p.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.ciudad?.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
              <Users className="h-7 w-7 text-green-500" />
              <span>Gestión de Proveedores</span>
            </h2>
            <p className="text-gray-600 mt-1">{proveedoresFiltrados.length} proveedor{proveedoresFiltrados.length !== 1 ? 'es' : ''}</p>
          </div>
          <button onClick={abrirModalNuevo} className="flex items-center space-x-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all shadow-md">
            <Plus className="h-5 w-5" />
            <span className="font-semibold">Nuevo Proveedor</span>
          </button>
        </div>
        <div className="mt-6 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input type="text" placeholder="Buscar proveedor..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {proveedoresFiltrados.map((proveedor) => (
          <div key={proveedor.id} className="bg-white rounded-xl shadow-md p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Users className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{proveedor.nombre}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full ${proveedor.activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {proveedor.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2 text-sm mb-4">
              {proveedor.contacto && (
                <div className="flex items-center text-gray-600">
                  <Users className="h-4 w-4 mr-2" />
                  <span>{proveedor.contacto}</span>
                </div>
              )}
              {proveedor.telefono && (
                <div className="flex items-center text-gray-600">
                  <Phone className="h-4 w-4 mr-2" />
                  <span>{proveedor.telefono}</span>
                </div>
              )}
              {proveedor.email && (
                <div className="flex items-center text-gray-600">
                  <Mail className="h-4 w-4 mr-2" />
                  <span className="truncate">{proveedor.email}</span>
                </div>
              )}
              {proveedor.ciudad && (
                <div className="flex items-center text-gray-600">
                  <MapPin className="h-4 w-4 mr-2" />
                  <span>{proveedor.ciudad}</span>
                </div>
              )}
            </div>

            <div className="flex space-x-2 pt-4 border-t">
              <button onClick={() => abrirModalEditar(proveedor)} className="flex-1 flex items-center justify-center space-x-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors">
                <Edit className="h-4 w-4" />
                <span>Editar</span>
              </button>
              <button onClick={() => setModalConfirmacion({ titulo: '¿Eliminar?', mensaje: `¿Eliminar "${proveedor.nombre}"?`, onConfirmar: () => eliminarProveedor(proveedor.id) })} className="flex-1 flex items-center justify-center space-x-2 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors">
                <Trash2 className="h-4 w-4" />
                <span>Eliminar</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Formulario */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">{modoEdicion ? 'Editar' : 'Nuevo'} Proveedor</h3>
              <button onClick={() => setModalAbierto(false)} className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg">
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nombre *</label>
                  <input type="text" value={formData.nombre} onChange={(e) => setFormData({...formData, nombre: e.target.value})} required className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Contacto</label>
                  <input type="text" value={formData.contacto} onChange={(e) => setFormData({...formData, contacto: e.target.value})} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Teléfono</label>
                  <input type="tel" value={formData.telefono} onChange={(e) => setFormData({...formData, telefono: e.target.value})} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ciudad</label>
                  <input type="text" value={formData.ciudad} onChange={(e) => setFormData({...formData, ciudad: e.target.value})} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Productos</label>
                  <input type="text" value={formData.tipoProductos} onChange={(e) => setFormData({...formData, tipoProductos: e.target.value})} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500" placeholder="Ej: Carnes, Lácteos" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Dirección</label>
                <textarea value={formData.direccion} onChange={(e) => setFormData({...formData, direccion: e.target.value})} rows="2" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500" />
              </div>
              <div className="flex items-center space-x-2">
                <input type="checkbox" id="activo" checked={formData.activo} onChange={(e) => setFormData({...formData, activo: e.target.checked})} className="w-5 h-5 text-green-500 rounded" />
                <label htmlFor="activo" className="text-sm font-medium text-gray-700">Proveedor activo</label>
              </div>
              <div className="flex space-x-3 pt-4 border-t">
                <button type="button" onClick={() => setModalAbierto(false)} className="flex-1 px-6 py-3 border text-gray-700 rounded-lg hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={cargando} className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-lg hover:from-green-600 hover:to-emerald-700">
                  {cargando ? 'Guardando...' : (modoEdicion ? 'Actualizar' : 'Crear')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modales de Alerta y Confirmación (igual que en Categorías) */}
      {modalAlerta && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center space-x-3 mb-4">
              {modalAlerta.tipo === 'success' ? <CheckCircle className="h-8 w-8 text-green-500" /> : <AlertCircle className="h-8 w-8 text-red-500" />}
              <h3 className="text-xl font-bold">{modalAlerta.titulo}</h3>
            </div>
            <p className="text-gray-600 mb-6">{modalAlerta.mensaje}</p>
            <button onClick={() => setModalAlerta(null)} className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 rounded-lg">Aceptar</button>
          </div>
        </div>
      )}

      {modalConfirmacion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">{modalConfirmacion.titulo}</h3>
            <p className="text-gray-600 mb-6">{modalConfirmacion.mensaje}</p>
            <div className="flex space-x-3">
              <button onClick={() => setModalConfirmacion(null)} className="flex-1 px-6 py-3 border rounded-lg">Cancelar</button>
              <button onClick={modalConfirmacion.onConfirmar} className="flex-1 bg-red-500 text-white px-6 py-3 rounded-lg">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GestionProveedores;
