// Inventario organizado por lo que hace el encargado en el día: revisar, recibir, pedir,
// controlar vencimientos y contar. El catálogo (recetas, categorías, almacenes, proveedores)
// queda en Configuración. Tocar un insumo en cualquier pantalla abre su ficha.
import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  CalendarClock, ClipboardCheck, History, Home, Package, PackagePlus, Settings, ShoppingCart,
} from 'lucide-react';
import { getProveedores } from './services/inventarioApi';
import ConteoFisico from './components/inventario/ConteoFisico';
import FichaInsumo from './components/inventario/FichaInsumo';
import GestionAlmacenes from './components/inventario/GestionAlmacenes';
import GestionCategorias from './components/inventario/GestionCategorias';
import GestionProductos from './components/inventario/GestionProductos';
import GestionProveedores from './components/inventario/GestionProveedores';
import GestionRecetas from './components/inventario/GestionRecetas';
import HoyInventario from './components/inventario/HoyInventario';
import ListaInsumos from './components/inventario/ListaInsumos';
import MovimientosInventario from './components/inventario/MovimientosInventario';
import PedidosProveedor from './components/inventario/PedidosProveedor';
import RecibirMercancia from './components/inventario/RecibirMercancia';
import Vencimientos from './components/inventario/Vencimientos';
import { ease } from './components/inventario/ui';

const TAREAS = [
  { id: 'hoy', label: 'Hoy', icon: Home },
  { id: 'recibir', label: 'Recibir', icon: PackagePlus },
  { id: 'pedidos', label: 'Pedidos', icon: ShoppingCart },
  { id: 'vencimientos', label: 'Vencimientos', icon: CalendarClock },
  { id: 'conteo', label: 'Conteo', icon: ClipboardCheck },
  { id: 'insumos', label: 'Insumos', icon: Package },
  { id: 'movimientos', label: 'Movimientos', icon: History },
  { id: 'configuracion', label: 'Configuración', icon: Settings },
];

const TITULOS = {
  hoy: ['Inventario de hoy', 'Lo que hay que atender: agotados, por pedir y por vencer.'],
  recibir: ['Recibir mercancía', 'Registra lo que llegó del proveedor, con su precio y vencimiento.'],
  pedidos: ['Pedidos a proveedores', 'Qué pedir, órdenes enviadas y lo que falta por llegar.'],
  vencimientos: ['Vencimientos', 'Usa primero lo que vence antes y saca del stock lo vencido.'],
  conteo: ['Conteo físico', 'Cuenta lo que hay y el sistema ajusta las diferencias.'],
  insumos: ['Insumos', 'Todo lo que se compra y se gasta en las recetas.'],
  movimientos: ['Movimientos', 'Historial de entradas, salidas, mermas y ajustes.'],
  configuracion: ['Configuración', 'Catálogo de insumos, recetas, categorías, almacenes y proveedores.'],
};

const CONFIGURACION = [
  { id: 'catalogo', label: 'Catálogo de insumos', componente: GestionProductos },
  { id: 'recetas', label: 'Recetas', componente: GestionRecetas },
  { id: 'categorias', label: 'Categorías', componente: GestionCategorias },
  { id: 'almacenes', label: 'Almacenes', componente: GestionAlmacenes },
  { id: 'proveedores', label: 'Proveedores', componente: GestionProveedores },
];

function Inventario() {
  const [tarea, setTarea] = useState('hoy');
  const [filtroInsumos, setFiltroInsumos] = useState('todos');
  const [seccionConfig, setSeccionConfig] = useState('catalogo');
  const [fichaId, setFichaId] = useState(null);
  const [ordenARecibir, setOrdenARecibir] = useState(null);
  const [productoARecibir, setProductoARecibir] = useState(null);
  const [productoAPedir, setProductoAPedir] = useState(null);
  const [proveedores, setProveedores] = useState([]);
  // Sube cada vez que algo cambia el stock para que las demás vistas recarguen.
  const [version, setVersion] = useState(0);
  const cambio = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    getProveedores().then((p) => setProveedores(p.filter((x) => x.activo !== false))).catch(() => {});
  }, []);

  const ir = (id, filtro) => {
    if (id === 'insumos') setFiltroInsumos(filtro ?? 'todos');
    setTarea(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const recibir = (productoId) => {
    setFichaId(null);
    setOrdenARecibir(null);
    setProductoARecibir(productoId ?? null);
    ir('recibir');
  };

  const pedir = (productoId) => {
    setFichaId(null);
    setProductoAPedir(productoId ?? null);
    ir('pedidos');
  };

  const recibirOrden = (ordenId) => {
    setProductoARecibir(null);
    setOrdenARecibir(ordenId);
    ir('recibir');
  };

  const [titulo, detalle] = TITULOS[tarea];
  const Config = CONFIGURACION.find((c) => c.id === seccionConfig)?.componente ?? GestionProductos;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-16 z-20 border-b border-gray-200 bg-white/95 backdrop-blur">
        <nav className="qp-rail mx-auto flex max-w-[1440px] gap-1 overflow-x-auto px-4 py-2 lg:px-6" aria-label="Tareas de inventario">
          {TAREAS.map(({ id, label, icon: Icono }) => {
            const activa = tarea === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => ir(id)}
                aria-current={activa ? 'page' : undefined}
                className={`relative flex h-10 shrink-0 items-center gap-2 rounded-full px-3.5 text-[14px] font-semibold transition-colors ${activa ? 'text-espresso' : 'text-gray-500 hover:text-espresso'}`}
              >
                {activa && <motion.span layoutId="tarea-inventario" className="absolute inset-0 rounded-full bg-orange-100" transition={{ duration: 0.4, ease }} />}
                <Icono size={17} className="relative" aria-hidden="true" />
                <span className="relative">{label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <main className="mx-auto max-w-[1440px] px-4 py-6 lg:px-6 lg:py-8">
        <header className="mb-6">
          <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.02em] text-espresso">{titulo}</h1>
          <p className="mt-1 text-[15px] text-gray-500">{detalle}</p>
        </header>

        {tarea === 'hoy' && <HoyInventario onIr={ir} onAbrirInsumo={setFichaId} version={version} />}
        {tarea === 'recibir' && (
          <RecibirMercancia
            ordenId={ordenARecibir}
            productoInicial={productoARecibir}
            onSalirDeOrden={() => setOrdenARecibir(null)}
            onAbrirInsumo={setFichaId}
            onListo={() => { setProductoARecibir(null); cambio(); }}
          />
        )}
        {tarea === 'pedidos' && (
          <PedidosProveedor
            onRecibirOrden={recibirOrden}
            onAbrirInsumo={setFichaId}
            productoFoco={productoAPedir}
            onFocoUsado={() => setProductoAPedir(null)}
            version={version}
          />
        )}
        {tarea === 'vencimientos' && <Vencimientos onAbrirInsumo={setFichaId} onCambio={cambio} version={version} />}
        {tarea === 'conteo' && <ConteoFisico onAbrirInsumo={setFichaId} onCambio={cambio} />}
        {tarea === 'insumos' && <ListaInsumos onAbrirInsumo={setFichaId} filtroInicial={filtroInsumos} version={version} />}
        {tarea === 'movimientos' && <MovimientosInventario key={version} />}
        {tarea === 'configuracion' && (
          <div>
            <div className="qp-rail -mx-1 mb-5 flex gap-1 overflow-x-auto px-1" role="tablist" aria-label="Configuración">
              {CONFIGURACION.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="tab"
                  aria-selected={seccionConfig === c.id}
                  onClick={() => setSeccionConfig(c.id)}
                  className={`h-10 shrink-0 rounded-full px-4 text-[14px] font-bold transition-colors ${seccionConfig === c.id ? 'bg-espresso text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-espresso'}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <Config />
          </div>
        )}
      </main>

      <FichaInsumo
        productoId={fichaId}
        onCerrar={() => setFichaId(null)}
        onRecibir={recibir}
        onPedir={pedir}
        onCambio={cambio}
        proveedores={proveedores}
      />
    </div>
  );
}

export default Inventario;
