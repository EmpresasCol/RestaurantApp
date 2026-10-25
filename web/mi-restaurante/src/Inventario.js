import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  Boxes, 
  History, 
  ChefHat, 
  Tag, 
  Warehouse, 
  Truck 
} from 'lucide-react';
import DashboardInventario from './components/inventario/DashboardInventario';
import GestionProductos from './components/inventario/GestionProductos';
import ControlStock from './components/inventario/ControlStock';
import MovimientosInventario from './components/inventario/MovimientosInventario';
import GestionRecetas from './components/inventario/GestionRecetas';
import GestionCategorias from './components/inventario/GestionCategorias';
import GestionAlmacenes from './components/inventario/GestionAlmacenes';
import GestionProveedores from './components/inventario/GestionProveedores';

function Inventario() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardInventario />;
      case 'productos':
        return <GestionProductos />;
      case 'stock':
        return <ControlStock />;
      case 'movimientos':
        return <MovimientosInventario />;
      case 'recetas':
        return <GestionRecetas />;
      case 'categorias':
        return <GestionCategorias />;
      case 'almacenes':
        return <GestionAlmacenes />;
      case 'proveedores':
        return <GestionProveedores />;
      default:
        return <DashboardInventario />;
    }
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'productos', label: 'Insumos / Productos', icon: Package },
    { id: 'stock', label: 'Control de Stock', icon: Boxes },
    { id: 'movimientos', label: 'Movimientos', icon: History },
    { id: 'recetas', label: 'Recetas & Fichas Técnicas', icon: ChefHat },
    { id: 'categorias', label: 'Categorías', icon: Tag },
    { id: 'almacenes', label: 'Almacenes', icon: Warehouse },
    { id: 'proveedores', label: 'Proveedores', icon: Truck },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Package size={24} />
                </div>
                <span>Módulo de Inventario 100% Funcional</span>
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Sincronización en tiempo real con pedidos, domicilios y control de stock por recetas
              </p>
            </div>
          </div>

          <div className="flex space-x-2 sm:space-x-6 overflow-x-auto scrollbar-none pb-0.5">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 pb-3 pt-1 px-2 border-b-2 font-medium text-sm transition-all whitespace-nowrap ${
                    isActive
                      ? 'border-blue-600 text-blue-600 font-semibold'
                      : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
                  }`}
                >
                  <Icon size={17} className={isActive ? 'text-blue-600' : 'text-gray-400'} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderContent()}
      </main>
    </div>
  );
}

export default Inventario;
