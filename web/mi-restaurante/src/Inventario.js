import React, { useState } from 'react';
import { LayoutDashboard, Package, Boxes, History, Truck } from 'lucide-react';
import DashboardInventario from './components/inventario/DashboardInventario';
import GestionProductos from './components/inventario/GestionProductos';
import ControlStock from './components/inventario/ControlStock';
import MovimientosInventario from './components/inventario/MovimientosInventario';
import Proveedores from './components/inventario/Proveedores';

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
      case 'proveedores':
        return <Proveedores />;
      default:
        return <DashboardInventario />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Package className="text-blue-600" />
              Gestión de Inventario
            </h1>
          </div>
          <div className="flex space-x-8 overflow-x-auto">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2 pb-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === 'dashboard'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <LayoutDashboard size={18} />
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('productos')}
              className={`flex items-center gap-2 pb-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === 'productos'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <Package size={18} />
              Productos
            </button>
            <button
              onClick={() => setActiveTab('stock')}
              className={`flex items-center gap-2 pb-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === 'stock'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <Boxes size={18} />
              Control de Stock
            </button>
            <button
              onClick={() => setActiveTab('movimientos')}
              className={`flex items-center gap-2 pb-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === 'movimientos'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <History size={18} />
              Movimientos
            </button>
            <button
              onClick={() => setActiveTab('proveedores')}
              className={`flex items-center gap-2 pb-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === 'proveedores'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <Truck size={18} />
              Proveedores
            </button>
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
