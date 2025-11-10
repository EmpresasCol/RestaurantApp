// src/components/inventario/GestionAlmacenes.js
import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Warehouse, CheckCircle, AlertCircle, Search, MapPin, X } from 'lucide-react';
import * as inventarioApi from '../../services/inventarioApi';

function GestionAlmacenes() {
  const [almacenes, setAlmacenes] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [almacenEditando, setAlmacenEditando] = useState(null);
  const [modalAlerta, setModalAlerta] = useState(null);
  const [busqueda, setBusqueda] = useState('');

  const [formData, setFormData] = useState({
    codigo: '',
    nombre: '',
    descripcion: '',
    ubicacion: '',
    tipo: 'Principal',
    activo: true
  });

  const tipos = ['Principal', 'Secundario', 'Cocina', 'Bar', 'Refrigerado', 'Congelado'];

  useEffect(() => {
    cargarAlmacenes();
  }, []);

  const cargarAlmacenes = async () => {
    setCargando(true);
    try {
      const data = await inventarioApi.getAlmacenes();
      setAlmacenes(data);
    } catch (error) {
      console.error('Error:', error);
      setModalAlerta({ tipo: 'error', titulo: 'Error', mensaje: 'No se pudieron cargar los almacenes' });
    } finally {
      setCargando(false);
    }
  };

  const abrirModalNuevo = () => {
    setModoEdicion(false);
    setAlmacenEditando(null);
    setFormData({ codigo: '', nombre: '', descripcion: '', ubicacion: '', tipo: 'Principal', activo: true });
    setModalAbierto(true);
  };

  const abrirModalEditar = (almacen) => {
    setModoEdicion(true);
    setAlmacenEditando(almacen);
    setFormData({
      codigo: almacen.codigo,
      nombre: almacen.nombre,
      descripcion: almacen.descripcion || '',
      ubicacion: almacen.ubicacion || '',
      tipo: almacen.tipo,
      activo: almacen.activo
    });
    setModalAbierto(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.codigo.trim() || !formData.nombre.trim()) {
      setModalAlerta({ tipo: 'error', titulo: 'Error', mensaje: 'Código y nombre son obligatorios' });
      return;
    }

    setCargando(true);
    try {
      if (modoEdicion) {
        await inventarioApi.updateAlmacen(almacenEditando.id, formData);
        setModalAlerta({ tipo: 'success', titulo: 'Éxito', mensaje: 'Almacén actualizado' });
      } else {
        await inventarioApi.createAlmacen(formData);
        setModalAlerta({ tipo: 'success', titulo: 'Éxito', mensaje: 'Almacén creado' });
      }
      await cargarAlmacenes();
      setModalAbierto(false);
    } catch (error) {
      setModalAlerta({ tipo: 'error', titulo: 'Error', mensaje: error.message });
    } finally {
      setCargando(false);
    }
  };

  const almacenesFiltrados = almacenes.filter(a =>
    a.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    a.codigo?.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
              <Warehouse className="h-7 w-7 text-indigo-500" />
              <span>Gestión de Almacenes</span>
            </h2>
            <p className="text-gray-600 mt-1">{almacenesFiltrados.length} almacén{almacenesFiltrados.length !== 1 ? 'es' : ''}</p>
          </div>
          <button onClick={abrirModalNuevo} className="flex items-center space-x-2 bg-gradient-to-r from-indigo-500 to-blue-600 text-white px-6 py-3 rounded-lg hover:from-indigo-600 hover:to-blue-700 transition-all shadow-md">
            <Plus className="h-5 w-5" />
            <span className="font-semibold">Nuevo Almacén</span>
          </button>
        </div>
        <div className="mt-6 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input type="text" placeholder="Buscar almacén..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {almacenesFiltrados.map((almacen) => (
          <div key={almacen.id} className="bg-white rounded-xl shadow-md p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <Warehouse className="h-6 w-6 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{almacen.nombre}</h3>
                  <span className="text-xs text-gray-500">{almacen.codigo}</span>
                </div>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${almacen.activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {almacen.activo ? 'Activo' : 'Inactivo'}
              </span>
            </div>

            <div className="space-y-2 text-sm mb-4">
              <div className="flex items-center text-gray-600">
                <span className="font-semibold mr-2">Tipo:</span>
                <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded">{almacen.tipo}</span>
              </div>
              {almacen.ubicacion && (
                <div className="flex items-center text-gray-600">
                  <MapPin className="h-4 w-4 mr-2" />
                  <span>{almacen.ubicacion}</span>
                </div>
              )}
              {almacen.descripcion && (
                <p className="text-gray-600 text-sm">{almacen.descripcion}</p>
              )}
            </div>

            <div className="flex space-x-2 pt-4 border-t">
              <button onClick={() => abrirModalEditar(almacen)} className="flex-1 flex items-center justify-center space-x-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors">
                <Edit className="h-4 w-4" />
                <span>Editar</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Formulario */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-indigo-500 to-blue-600 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">{modoEdicion ? 'Editar' : 'Nuevo'} Almacén</h3>
              <button onClick={() => setModalAbierto(false)} className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg">
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Código *</label>
                  <input type="text" value={formData.codigo} onChange={(e) => setFormData({...formData, codigo: e.target.value})} required className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="ALM-001" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nombre *</label>
                  <input type="text" value={formData.nombre} onChange={(e) => setFormData({...formData, nombre: e.target.value})} required className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tipo *</label>
                  <select value={formData.tipo} onChange={(e) => setFormData({...formData, tipo: e.target.value})} required className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500">
                    {tipos.map(tipo => <option key={tipo} value={tipo}>{tipo}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ubicación</label>
                  <input type="text" value={formData.ubicacion} onChange={(e) => setFormData({...formData, ubicacion: e.target.value})} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Descripción</label>
                <textarea value={formData.descripcion} onChange={(e) => setFormData({...formData, descripcion: e.target.value})} rows="2" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="flex items-center space-x-2">
                <input type="checkbox" id="activo" checked={formData.activo} onChange={(e) => setFormData({...formData, activo: e.target.checked})} className="w-5 h-5 text-indigo-500 rounded" />
                <label htmlFor="activo" className="text-sm font-medium text-gray-700">Almacén activo</label>
              </div>
              <div className="flex space-x-3 pt-4 border-t">
                <button type="button" onClick={() => setModalAbierto(false)} className="flex-1 px-6 py-3 border text-gray-700 rounded-lg hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={cargando} className="flex-1 bg-gradient-to-r from-indigo-500 to-blue-600 text-white px-6 py-3 rounded-lg hover:from-indigo-600 hover:to-blue-700">
                  {cargando ? 'Guardando...' : (modoEdicion ? 'Actualizar' : 'Crear')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Alerta */}
      {modalAlerta && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center space-x-3 mb-4">
              {modalAlerta.tipo === 'success' ? <CheckCircle className="h-8 w-8 text-green-500" /> : <AlertCircle className="h-8 w-8 text-red-500" />}
              <h3 className="text-xl font-bold">{modalAlerta.titulo}</h3>
            </div>
            <p className="text-gray-600 mb-6">{modalAlerta.mensaje}</p>
            <button onClick={() => setModalAlerta(null)} className="w-full bg-gradient-to-r from-indigo-500 to-blue-600 text-white py-3 rounded-lg">Aceptar</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default GestionAlmacenes;