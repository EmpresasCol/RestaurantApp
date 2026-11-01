// Caja organizada por lo que hace el cajero: cobrar las cuentas abiertas, revisar o reimprimir
// las facturas del día y cerrar la caja. Se actualiza en tiempo real (SignalR) con respaldo cada 60 s.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Calculator, FileText, Receipt } from 'lucide-react';
import * as api from './services/api';
import { useCambios } from './services/realtime';
import { actualizarEstadoDomicilio, getDomiciliosActivos, getLiquidaciones, liquidarDomiciliario } from './services/domiciliosApi';
import { ease, useAviso } from './components/inventario/ui';
import PorCobrar from './components/caja/PorCobrar';
import CobroPanel from './components/caja/CobroPanel';
import FacturasDia from './components/caja/FacturasDia';
import CierreCaja from './components/caja/CierreCaja';
import { agruparCuentas, hoyLocal, pesos } from './utils/caja';

const TITULOS = {
  cobrar: ['Caja', 'Cuentas abiertas por mesa, domicilios en curso y el efectivo de los domiciliarios.'],
  facturas: ['Facturas', 'Lo cobrado en el día (mesas y domicilios), con su detalle para reimprimir.'],
  cierre: ['Cierre de caja', 'Abre con la base, cuenta el cajón al final y compáralo con lo que dice el sistema.'],
};

function Facturacion() {
  const [vista, setVista] = useState('cobrar');
  const [pedidos, setPedidos] = useState([]);
  const [domicilios, setDomicilios] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [liquidaciones, setLiquidaciones] = useState([]);
  const [mesaEnCobro, setMesaEnCobro] = useState(null);
  const [fecha, setFecha] = useState(hoyLocal);
  const [version, setVersion] = useState(0);
  const [aviso, mostrar] = useAviso();

  const cargar = useCallback(async () => {
    try {
      const [p, d, s, l] = await Promise.all([
        api.getPedidosActivos(),
        getDomiciliosActivos().catch(() => []),
        api.getSolicitudesCuenta().catch(() => []),
        getLiquidaciones().catch(() => []),
      ]);
      setPedidos(p);
      setSolicitudes(s);
      setLiquidaciones(Array.isArray(l) ? l : []);
      setDomicilios(Array.isArray(d) ? d.filter((x) => !['Entregado', 'Cancelado'].includes(x.estado)) : []);
    } catch {
      mostrar('No se pudieron cargar las cuentas', 'error');
    }
    setVersion((v) => v + 1);
  }, [mostrar]);

  useCambios('pedidos', cargar);
  useCambios('domicilios', cargar);
  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 60000);
    return () => clearInterval(t);
  }, [cargar]);

  const cuentas = useMemo(() => agruparCuentas(pedidos, solicitudes), [pedidos, solicitudes]);
  // La cuenta en cobro se lee de lo último cargado: así el panel ve lo que queda tras un cobro parcial.
  const cuentaEnCobro = cuentas.find((c) => c.mesaId === mesaEnCobro) ?? null;
  const porCobrar = cuentas.reduce((t, c) => t + c.total, 0) + domicilios.filter((d) => !d.pagadoAnticipado).reduce((t, d) => t + d.total, 0);

  const domicilioCobrado = async (d, metodoPago) => {
    try {
      await actualizarEstadoDomicilio(d.id, 'Entregado', { metodoPago });
      mostrar(`Domicilio #${d.id} entregado y facturado`);
      cargar();
    } catch (e) {
      mostrar(e.message, 'error');
    }
  };

  const liquidar = async (l) => {
    try {
      const r = await liquidarDomiciliario(l.domiciliarioId);
      mostrar(`Recibiste ${pesos(r.total)} de ${l.nombre}`);
      cargar();
    } catch (e) {
      mostrar(e.message, 'error');
    }
  };

  const vistas = [
    { id: 'cobrar', label: 'Por cobrar', icon: Receipt, contador: cuentas.length + domicilios.length + liquidaciones.length },
    { id: 'facturas', label: 'Facturas', icon: FileText },
    { id: 'cierre', label: 'Cierre del día', icon: Calculator },
  ];
  const [titulo, detalle] = TITULOS[vista];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-16 z-20 border-b border-gray-200 bg-white/95 backdrop-blur">
        <nav className="qp-rail mx-auto flex max-w-[1280px] gap-1 overflow-x-auto px-4 py-2 lg:px-6" aria-label="Caja">
          {vistas.map(({ id, label, icon: Icono, contador }) => {
            const activa = vista === id;
            return (
              <button
                key={id} type="button" onClick={() => setVista(id)} aria-current={activa ? 'page' : undefined}
                className={`relative flex h-10 shrink-0 items-center gap-2 rounded-full px-3.5 text-[14px] font-semibold transition-colors ${activa ? 'text-espresso' : 'text-gray-500 hover:text-espresso'}`}
              >
                {activa && <motion.span layoutId="vista-caja" className="absolute inset-0 rounded-full bg-orange-100" transition={{ duration: 0.4, ease }} />}
                <Icono size={17} className="relative" aria-hidden="true" />
                <span className="relative">{label}</span>
                {contador > 0 && (
                  <span className="tabular relative grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-espresso px-1.5 text-[11px] font-bold text-white">{contador}</span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <main className="mx-auto max-w-[1280px] px-4 py-6 lg:px-6 lg:py-8">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.02em] text-espresso">{titulo}</h1>
            <p className="mt-1 text-[15px] text-gray-500">{detalle}</p>
          </div>
          {vista === 'cobrar' && porCobrar > 0 && (
            <p className="tabular text-right text-[13px] text-gray-500">
              Por cobrar<span className="block text-[22px] font-extrabold text-espresso">{pesos(porCobrar)}</span>
            </p>
          )}
        </header>

        {vista === 'cobrar' && (
          <PorCobrar
            cuentas={cuentas} domicilios={domicilios} liquidaciones={liquidaciones}
            onCobrar={(c) => setMesaEnCobro(c.mesaId)} onDomicilioCobrado={domicilioCobrado} onLiquidar={liquidar}
          />
        )}
        {vista === 'facturas' && <FacturasDia fecha={fecha} onFecha={setFecha} version={version} mostrar={mostrar} />}
        {vista === 'cierre' && <CierreCaja fecha={fecha} onFecha={setFecha} version={version} mostrar={mostrar} onLiquidar={liquidar} />}
      </main>

      <CobroPanel cuenta={cuentaEnCobro} onCerrar={() => setMesaEnCobro(null)} onCobrado={cargar} mostrar={mostrar} />
      {aviso}
    </div>
  );
}

export default Facturacion;
