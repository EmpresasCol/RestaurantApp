import React, { useState, useEffect } from 'react';
import { Users, ChefHat, Clock } from 'lucide-react';

function Cocina({ pedidos = [] }) {
  const [filtroMesa, setFiltroMesa] = useState('todas');

  useEffect(() => {
    const interval = setInterval(() => {
      // Actualizar reloj cada minuto
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const calcularTiempoTranscurrido = (horaInicio) => {
    const ahora = new Date();
    return Math.floor((ahora - horaInicio) / 60000);
  };

  const mesasUnicas = [...new Set(pedidos.map(p => p.mesa))].sort((a, b) => a - b);

  const pedidosFiltrados = pedidos
  .filter(pedido => pedido.estado !== 'Pagado' && pedido.estado !== 'Cancelado')
  // 🔥 aplicar el filtro de mesa
  .filter(pedido => {
    if (filtroMesa === 'todas') return true;
    return pedido.mesa.toString() === filtroMesa;
  });
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ChefHat className="text-orange-500" size={32} />
              <div>
                <h1 className="text-2xl font-bold">Órdenes de Cocina</h1>
                <p className="text-gray-400">Restaurante Délice</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold">{new Date().toLocaleTimeString()}</p>
              <p className="text-gray-400">{new Date().toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-gray-800 p-6 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-300">Total de Órdenes</p>
                <p className="text-3xl font-bold text-white">{pedidos.length}</p>
              </div>
              <ChefHat className="text-orange-500" size={32} />
            </div>
          </div>
          
          <div className="bg-gray-800 p-6 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-300">Mesas Activas</p>
                <p className="text-3xl font-bold text-white">{mesasUnicas.length}</p>
              </div>
              <Users className="text-blue-500" size={32} />
            </div>
          </div>
        </div>

        {pedidos.length > 0 && (
          <div className="flex gap-2 mb-6 overflow-x-auto">
            <button
              onClick={() => setFiltroMesa('todas')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filtroMesa === 'todas' ? 'bg-orange-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Todas las Mesas
            </button>
            {mesasUnicas.map(mesa => (
              <button key={mesa} onClick={() => setFiltroMesa(mesa.toString())}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filtroMesa === mesa.toString() ? 'bg-orange-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Mesa {mesa}
              </button>
            ))}
          </div>
        )}

        {pedidos.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-12 text-center">
            <ChefHat className="mx-auto text-gray-500 mb-4" size={64} />
            <h3 className="text-xl font-semibold text-gray-400 mb-2">No hay órdenes</h3>
            <p className="text-gray-500">Las órdenes aparecerán aquí cuando los clientes hagan pedidos</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {pedidosFiltrados.map(pedido => (
              <div key={pedido.id} className="bg-gray-800 rounded-lg border border-gray-600 overflow-hidden">
                <div className="p-4 bg-gray-700 border-b border-gray-600">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-xl font-bold text-white">Orden #{pedido.id}</h3>
                      <p className="text-gray-300 flex items-center gap-2">
                        <Users size={16} />
                        Mesa {pedido.mesa}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2 text-gray-300">
                        <Clock size={16} />
                        <span>Hace {calcularTiempoTranscurrido(pedido.hora)} min</span>
                      </div>
                      <p className="text-sm text-gray-400">{pedido.hora.toLocaleTimeString()}</p>
                    </div>
                  </div>
                </div>

                <div className="p-4">
                  <h4 className="text-lg font-semibold text-orange-400 mb-3">Platos:</h4>
                  <div className="space-y-3">
                    {pedido.items.map((item, index) => (
                      <div key={index} className="bg-gray-700 p-3 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="bg-orange-500 text-white px-2 py-1 rounded-full text-sm font-bold">
                            {item.cantidad}
                          </span>
                          <span className="font-medium text-white text-lg">{item.nombre}</span>
                        </div>
                        {item.notas && (
                          <div className="mt-2 ml-11 p-2 bg-yellow-800 border-l-4 border-yellow-500 rounded">
                            <p className="text-sm text-yellow-200">Nota: {item.notas}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="px-4 pb-4 pt-2 border-t border-gray-600">
                  <div className="flex justify-between items-center text-sm text-gray-400">
                    <span>Tiempo estimado: {pedido.tiempoEstimado} minutos</span>
                    <span>Total items: {pedido.items.reduce((sum, item) => sum + item.cantidad, 0)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Cocina;