import React, { useState, useEffect } from 'react';
import { Search, Plus, Trash2, Edit2, X, Phone, Mail, MapPin } from 'lucide-react';
import { getProveedores, createProveedor, updateProveedor, deleteProveedor } from '../../services/inventarioApi';

function Proveedores() {
    const [proveedores, setProveedores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filtro, setFiltro] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [proveedorEditando, setProveedorEditando] = useState(null);

    const [formData, setFormData] = useState({
        nombre: '',
        contacto: '',
        telefono: '',
        email: '',
        direccion: '',
        ciudad: '',
        tipoProductos: ''
    });

    const cargarDatos = async () => {
        setLoading(true);
        try {
            const data = await getProveedores();
            setProveedores(data);
        } catch (error) {
            console.error('Error al cargar proveedores:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargarDatos();
    }, []);

    const handleOpenModal = (proveedor = null) => {
        if (proveedor) {
            setProveedorEditando(proveedor);
            setFormData({
                nombre: proveedor.nombre,
                contacto: proveedor.contacto || '',
                telefono: proveedor.telefono,
                email: proveedor.email,
                direccion: proveedor.direccion,
                ciudad: proveedor.ciudad || '',
                tipoProductos: proveedor.tipoProductos || ''
            });
        } else {
            setProveedorEditando(null);
            setFormData({
                nombre: '',
                contacto: '',
                telefono: '',
                email: '',
                direccion: '',
                ciudad: '',
                tipoProductos: ''
            });
        }
        setModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const data = { ...formData, activo: true };
            if (proveedorEditando) {
                await updateProveedor(proveedorEditando.id, data);
            } else {
                await createProveedor(data);
            }
            setModalOpen(false);
            cargarDatos();
        } catch (error) {
            console.error('Error al guardar proveedor:', error);
            alert('Error al guardar proveedor. Revisa los datos.');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('¿Seguro que deseas eliminar este proveedor?')) {
            try {
                await deleteProveedor(id);
                cargarDatos();
            } catch (error) {
                alert('No se puede eliminar el proveedor, posiblemente tiene productos asociados.');
            }
        }
    };

    const proveedoresFiltrados = proveedores.filter(p =>
        p.nombre.toLowerCase().includes(filtro.toLowerCase()) ||
        p.contacto?.toLowerCase().includes(filtro.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar proveedores..."
                        value={filtro}
                        onChange={(e) => setFiltro(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium"
                >
                    <Plus size={18} />
                    Nuevo Proveedor
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {proveedoresFiltrados.map((prov) => (
                    <div key={prov.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800">{prov.nombre}</h3>
                                <p className="text-sm text-gray-500">{prov.contacto}</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => handleOpenModal(prov)} className="text-gray-400 hover:text-blue-600">
                                    <Edit2 size={16} />
                                </button>
                                <button onClick={() => handleDelete(prov.id)} className="text-gray-400 hover:text-red-600">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2 text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                                <Phone size={14} className="text-gray-400" />
                                <span>{prov.telefono}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Mail size={14} className="text-gray-400" />
                                <span className="truncate">{prov.email}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <MapPin size={14} className="text-gray-400" />
                                <span className="truncate">{prov.direccion}, {prov.ciudad}</span>
                            </div>
                        </div>

                        {prov.tipoProductos && (
                            <div className="mt-4 pt-4 border-t border-gray-100">
                                <span className="inline-block px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-lg">
                                    {prov.tipoProductos}
                                </span>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {modalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-gray-800">
                                {proveedorEditando ? 'Editar Proveedor' : 'Nuevo Proveedor'}
                            </h3>
                            <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Empresa</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-blue-500"
                                    value={formData.nombre}
                                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Contacto</label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-blue-500"
                                        value={formData.contacto}
                                        onChange={(e) => setFormData({ ...formData, contacto: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-blue-500"
                                        value={formData.telefono}
                                        onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                <input
                                    type="email"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-blue-500"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-blue-500"
                                        value={formData.ciudad}
                                        onChange={(e) => setFormData({ ...formData, ciudad: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Productos</label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-blue-500"
                                        placeholder="Ej. Bebidas, Carnes"
                                        value={formData.tipoProductos}
                                        onChange={(e) => setFormData({ ...formData, tipoProductos: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-blue-500"
                                    value={formData.direccion}
                                    onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                                />
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setModalOpen(false)}
                                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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

export default Proveedores;
