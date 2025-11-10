// src/Inventario.js - Componente Principal del Módulo de Inventario
import React, { useState } from 'react';
import { 
  Package, 
  Boxes, 
  TrendingUp, 
  Users as UsersIcon, 
  Warehouse, 
  FileText,
  AlertTriangle,
  BarChart3
} from 'lucide-react';
import DashboardInventario from './components/inventario/DashboardInventario';
import GestionProductos from './components/inventario/GestionProductos';
import GestionCategorias from './components/inventario/GestionCategorias';
import GestionProveedores from './components/inventario/GestionProveedores';
import GestionAlmacenes from './components/inventario/GestionAlmacenes';
import ControlStock from './components/inventario/ControlStock';
import MovimientosInventario from './components/inventario/MovimientosInventario';

function Inventario() {
  const [tabActivo, setTabActivo] = useState('dashboard');

  const tabs = [
    { id: 'dashboard', nombre: 'Dashboard', icon: BarChart3 },
    { id: 'productos', nombre: 'Productos', icon: Package },
    { id: 'stock', nombre: 'Stock', icon: Boxes },
    { id: 'movimientos', nombre: 'Movimientos', icon: TrendingUp },
    { id: 'categorias', nombre: 'Categorías', icon: FileText },
    { id: 'proveedores', nombre: 'Proveedores', icon: UsersIcon },
    { id: 'almacenes', nombre: 'Almacenes', icon: Warehouse }
  ];

  const renderContenido = () => {
    switch (tabActivo) {
      case 'dashboard':
        return <DashboardInventario />;
      case 'productos':
        return <GestionProductos />;
      case 'stock':
        return <ControlStock />;
      case 'movimientos':
        return <MovimientosInventario />;
      case 'categorias':
        return <GestionCategorias />;
      case 'proveedores':
        return <GestionProveedores />;
      case 'almacenes':
        return <GestionAlmacenes />;
      default:
        return <DashboardInventario />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-white shadow-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-3 rounded-xl shadow-lg">
                <Package className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Módulo de Inventario
                </h1>
                <p className="text-sm text-gray-500">
                  Control completo de productos e insumos
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navegación por Tabs */}
      <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1 overflow-x-auto py-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const esActivo = tabActivo === tab.id;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setTabActivo(tab.id)}
                  className={`
                    flex items-center space-x-2 px-4 py-3 rounded-lg font-medium transition-all duration-200
                    whitespace-nowrap
                    ${esActivo
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-md'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }
                  `}
                >
                  <Icon className="h-5 w-5" />
                  <span>{tab.nombre}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Contenido Principal */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderContenido()}
      </div>
    </div>
  );
}

export default Inventario;
