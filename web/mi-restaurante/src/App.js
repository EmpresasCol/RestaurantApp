// src/App.js
import React, { useState, useEffect } from 'react';
import { MotionConfig, motion } from 'motion/react';
import {
  BarChart3, ChefHat, LayoutGrid, LogOut, Package, QrCode, Receipt, Truck, Users, Utensils
} from 'lucide-react';
import * as api from './services/api';
import Facturacion from './Facturacion';
import GeneradorQR from './GeneradorQR';
import Login from './components/Login';
import ProtectedRoute from './components/ProtectedRoute';
import MenuQR from './components/menu/MenuQR';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useCambios } from './services/realtime';
import Reportes from './Reportes';
import GestionPlatillos from './GestionPlatillos';
import GestionUsuarios from './GestionUsuarios';
import CocinaView from './CocinaView';
import Inventario from './Inventario';
import Domicilios from './Domicilios';
import NuevoDomicilio from './NuevoDomicilio';
import logo from './components/logo.jpg';

// Secciones del personal por rol: id de vista, etiqueta e ícono.
const SECCIONES = {
  administrador: [
    { id: 'menu', label: 'Carta', icon: LayoutGrid },
    { id: 'cocina', label: 'Cocina', icon: ChefHat, contador: true },
    { id: 'facturacion', label: 'Caja', icon: Receipt },
    { id: 'domicilios', label: 'Domicilios', icon: Truck, incluye: ['domicilios-nuevo'] },
    { id: 'gestion-platillos', label: 'Platillos', icon: Utensils },
    { id: 'gestion-usuarios', label: 'Usuarios', icon: Users },
    { id: 'inventario', label: 'Inventario', icon: Package },
    { id: 'qr', label: 'Códigos QR', icon: QrCode },
    { id: 'reportes', label: 'Reportes', icon: BarChart3 }
  ],
  caja: [{ id: 'facturacion', label: 'Caja', icon: Receipt }]
};

function BarraPersonal({ usuario, rol, vistaActual, onCambiar, pendientes, onSalir }) {
  const secciones = SECCIONES[rol] ?? [];
  const iniciales = (usuario?.nombre ?? '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-4 px-4 lg:px-6">
        <div className="flex shrink-0 items-center gap-2.5">
          <img src={logo} alt="Qpro" className="h-9 w-9 rounded-xl object-contain ring-1 ring-gray-200" />
          <span className="hidden text-[17px] font-extrabold tracking-[-0.01em] text-espresso sm:block">Qpro</span>
        </div>

        <nav className="qp-rail -mx-1 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1" aria-label="Secciones">
          {secciones.map(({ id, label, icon: Icono, contador, incluye = [] }) => {
            const activa = vistaActual === id || incluye.includes(vistaActual);
            return (
              <button
                key={id}
                type="button"
                onClick={() => onCambiar(id)}
                aria-current={activa ? 'page' : undefined}
                className={`relative flex h-10 shrink-0 items-center gap-2 rounded-full px-3.5 text-[14px] font-semibold transition-colors ${
                  activa ? 'text-espresso' : 'text-gray-500 hover:text-espresso'
                }`}
              >
                {activa && (
                  <motion.span
                    layoutId="seccion-activa"
                    className="absolute inset-0 rounded-full bg-orange-100"
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  />
                )}
                <Icono size={17} className="relative" aria-hidden="true" />
                <span className="relative">{label}</span>
                {contador && pendientes > 0 && (
                  <span className="tabular relative grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-espresso px-1.5 text-[11px] font-bold text-white">
                    {pendientes}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden text-right md:block">
            <p className="text-[14px] font-bold leading-tight text-espresso">{usuario?.nombre}</p>
            <p className="text-[12px] font-medium capitalize text-gray-500">{usuario?.rol}</p>
          </div>
          <span className="grid h-9 w-9 place-items-center rounded-full bg-espresso text-[13px] font-bold text-white" aria-hidden="true">
            {iniciales}
          </span>
          <button
            type="button"
            onClick={onSalir}
            className="grid h-10 w-10 place-items-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-espresso"
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}

function AppContent() {
  const { usuario, esClienteQR, estaAutenticado, logout, cargando: cargandoAuth } = useAuth();
  const [vistaActual, setVistaActual] = useState('menu');
  const [pedidos, setPedidos] = useState([]);
  const [platillos, setPlatillos] = useState([]);
  const [cargandoPlatillos, setCargandoPlatillos] = useState(true);

  // El QR trae el Id de la mesa (lo que espera la API) y su número visible.
  const mesaId = esClienteQR ? usuario?.mesa ?? null : null;
  const numeroMesa = usuario?.numeroMesa ?? mesaId;

  useEffect(() => {
    cargarPlatillos();
  }, []);

  const enCocina = vistaActual === 'cocina' && !esClienteQR;
  useCambios('pedidos', () => enCocina && cargarPedidos());

  // Respaldo por si SignalR está caído.
  useEffect(() => {
    if (enCocina) {
      cargarPedidos();
      const interval = setInterval(cargarPedidos, 60000);
      return () => clearInterval(interval);
    }
  }, [enCocina]);

  useEffect(() => {
    if (usuario) {
      const rol = usuario.rol?.toLowerCase();
      if (rol === 'cocina' && vistaActual !== 'cocina') {
        setVistaActual('cocina');
      } else if (rol === 'caja' && vistaActual !== 'facturacion') {
        setVistaActual('facturacion');
      }
    }
  }, [usuario, vistaActual]);

  const cargarPlatillos = async () => {
    try {
      setPlatillos(await api.getPlatillos());
    } catch (error) {
      console.error('Error al cargar platillos:', error);
      setPlatillos([]);
    } finally {
      setCargandoPlatillos(false);
    }
  };

  const cargarPedidos = async () => {
    try {
      const data = await api.getPedidosActivos();
      setPedidos(
        data
          .filter((p) => p.estado !== 'Entregado' && p.estado !== 'Pagado' && p.estado !== 'Cancelado')
          .map((p) => ({
            id: p.id,
            mesa: p.mesaNumero,
            items: p.detalles.map((d) => ({
              id: d.id,
              nombre: d.platilloNombre,
              cantidad: d.cantidad,
              notas: d.nota || ''
            })),
            hora: new Date(p.fecha),
            estado: p.estado
          }))
      );
    } catch (error) {
      console.error('Error al cargar pedidos:', error);
    }
  };

  const renderMenu = () => (
    <MenuQR
      platillos={platillos}
      cargando={cargandoPlatillos}
      mesaId={mesaId}
      numeroMesa={numeroMesa}
      onEnviarPedido={api.createPedido}
      offsetSuperior={esClienteQR ? 0 : 64}
    />
  );

  const renderVistaActual = () => {
    switch (vistaActual) {
      case 'cocina':
        return (
          <ProtectedRoute permisos={['administrador', 'cocina']}>
            <CocinaView
              pedidos={pedidos}
              onActualizarPedidos={cargarPedidos}
              incrustada={usuario?.rol?.toLowerCase() !== 'cocina'}
            />
          </ProtectedRoute>
        );
      case 'facturacion':
        return <ProtectedRoute permisos={['administrador', 'caja']}><Facturacion /></ProtectedRoute>;
      case 'qr':
        return <ProtectedRoute permisos={['administrador']}><GeneradorQR /></ProtectedRoute>;
      case 'reportes':
        return <ProtectedRoute permisos={['administrador']}><Reportes /></ProtectedRoute>;
      case 'gestion-platillos':
        return <ProtectedRoute permisos={['administrador']}><GestionPlatillos /></ProtectedRoute>;
      case 'gestion-usuarios':
        return <ProtectedRoute permisos={['administrador']}><GestionUsuarios /></ProtectedRoute>;
      case 'inventario':
        return <ProtectedRoute permisos={['administrador']}><Inventario /></ProtectedRoute>;
      case 'domicilios':
        return (
          <ProtectedRoute permisos={['administrador']}>
            <Domicilios onNuevoDomicilio={() => setVistaActual('domicilios-nuevo')} />
          </ProtectedRoute>
        );
      case 'domicilios-nuevo':
        return (
          <ProtectedRoute permisos={['administrador']}>
            <NuevoDomicilio
              onVolver={() => setVistaActual('domicilios')}
              onDomicilioCreado={() => cargarPedidos()} // recarga para que aparezcan en cocina
            />
          </ProtectedRoute>
        );
      default:
        return renderMenu();
    }
  };

  if (cargandoAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-center">
          <img src={logo} alt="" className="mx-auto h-16 w-16 animate-pulse rounded-2xl object-contain" />
          <p className="mt-4 text-[14px] font-semibold text-gray-500">Cargando Qpro…</p>
        </div>
      </div>
    );
  }

  if (!estaAutenticado && !esClienteQR) {
    return <Login />;
  }

  if (esClienteQR) {
    return renderMenu();
  }

  const rol = usuario?.rol?.toLowerCase();

  // Cocina trabaja a pantalla completa con su propia cabecera.
  if (rol === 'cocina') {
    return <div className="min-h-screen">{renderVistaActual()}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <BarraPersonal
        usuario={usuario}
        rol={rol}
        vistaActual={vistaActual}
        onCambiar={setVistaActual}
        pendientes={pedidos.length}
        onSalir={logout}
      />
      {renderVistaActual()}
    </div>
  );
}

function App() {
  return (
    // Respeta "reducir movimiento" del sistema también en las animaciones de motion.
    <MotionConfig reducedMotion="user">
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </MotionConfig>
  );
}

export default App;
