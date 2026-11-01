// Cuentas abiertas: una tarjeta por mesa (todos sus pedidos), los domicilios en curso y el
// efectivo que traen los domiciliarios. La mesa que pidió la cuenta se colorea según lo que avisó
// el mesero: pidió la cuenta, ya pagó todo o pagó una parte.
import React, { useState } from 'react';
import { BellRing, CheckCircle2, CircleDollarSign, Printer, Receipt, Truck } from 'lucide-react';
import { Boton, BotonConfirmar, Chip, Lista, Vacio } from '../inventario/ui';
import { estadoSolicitud, hora, lineasCuenta, pesos, textoSolicitud } from '../../utils/caja';
import { etapaDomicilio, METODOS_DOMICILIO } from '../../utils/domicilios';
import { htmlCuenta, imprimirHtml } from '../../utils/recibo';

const ETAPA = { recibido: 'Recibido', cocina: 'En cocina', listo: 'Listo para salir', camino: 'En camino' };

// Color de la tarjeta según lo que avisó el mesero.
const TONO_SOLICITUD = {
  pedida: { tarjeta: 'border-purple-400 bg-purple-50/70 ring-2 ring-purple-200', aviso: 'bg-purple-600 text-white', icono: BellRing },
  parcial: { tarjeta: 'border-amber-400 bg-amber-50/70 ring-2 ring-amber-200', aviso: 'bg-amber-400 text-espresso', icono: CircleDollarSign },
  pagada: { tarjeta: 'border-green-500 bg-green-50/70 ring-2 ring-green-200', aviso: 'bg-green-700 text-white', icono: CheckCircle2 },
};

function TarjetaMesa({ cuenta, onCobrar }) {
  const lineas = lineasCuenta(cuenta.pedidos);
  const visibles = lineas.slice(0, 4);
  const todoEnCocina = cuenta.totalCobrable === 0;
  const { solicitud } = cuenta;
  const tono = TONO_SOLICITUD[estadoSolicitud(solicitud)];
  const Icono = tono?.icono;
  return (
    <li className={`flex flex-col overflow-hidden rounded-2xl border transition-shadow hover:shadow-card ${tono ? tono.tarjeta : 'border-gray-200 bg-white'}`}>
      {solicitud && (
        <p className={`flex items-center gap-2 px-4 py-2 text-[14px] font-bold ${tono.aviso}`}>
          <Icono size={16} className="shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">{textoSolicitud(solicitud)}</span>
          <span className="tabular shrink-0 text-[12px] font-semibold opacity-90">{hora(solicitud.fechaPago ?? solicitud.fecha)}</span>
        </p>
      )}
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-espresso">Mesa {cuenta.mesaNumero}</h3>
            <p className="tabular text-[13px] text-gray-500">
              {cuenta.pedidos.length} pedido{cuenta.pedidos.length === 1 ? '' : 's'} · {cuenta.platos} plato{cuenta.platos === 1 ? '' : 's'} · desde {hora(cuenta.desde)}
            </p>
          </div>
          <p className="tabular text-[22px] font-extrabold tracking-[-0.02em] text-espresso">{pesos(cuenta.total)}</p>
        </div>
        {solicitud && (
          <p className="tabular mt-1 text-[13px] text-gray-600">
            {solicitud.meseroNombre || 'Mesero'}{solicitud.pagos?.length ? ` · ${solicitud.pagos.length} pago${solicitud.pagos.length === 1 ? '' : 's'}` : ''}{solicitud.tieneComprobante ? ' · con foto' : ''}
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {cuenta.enCocina > 0 && <Chip tono="aviso">{cuenta.enCocina === cuenta.pedidos.length ? 'Todo en cocina' : `${cuenta.enCocina} pedido${cuenta.enCocina === 1 ? '' : 's'} en cocina`}</Chip>}
          {cuenta.pagadoParcial && <Chip tono="ok">Parte ya pagada</Chip>}
        </div>
        <ul className="tabular mt-3 flex-1 space-y-1 text-[14px] text-gray-600">
          {visibles.map((l) => (
            <li key={`${l.nombre}-${l.precio}`} className="flex justify-between gap-3">
              <span className="truncate">{l.cantidad} × {l.nombre}</span>
              <span className="shrink-0">{pesos(l.total)}</span>
            </li>
          ))}
          {lineas.length > visibles.length && <li className="text-gray-500">y {lineas.length - visibles.length} más</li>}
        </ul>
        <div className="mt-4 flex gap-2">
          <Boton
            variante="secundario"
            tamano="lg"
            aria-label={`Imprimir la cuenta de la mesa ${cuenta.mesaNumero}`}
            title="Imprimir la cuenta para que el mesero la lleve a la mesa"
            onClick={() => imprimirHtml(htmlCuenta(cuenta, lineas))}
          >
            <Printer size={18} aria-hidden="true" />Cuenta
          </Boton>
          <button
            type="button"
            onClick={onCobrar}
            disabled={todoEnCocina}
            className="h-12 flex-1 rounded-xl bg-espresso text-[15px] font-bold text-white transition-colors hover:bg-gray-900 disabled:bg-gray-200 disabled:text-gray-500"
          >
            {todoEnCocina ? 'Esperando a cocina' : `Cobrar ${pesos(cuenta.totalCobrable)}`}
          </button>
        </div>
      </div>
    </li>
  );
}

/** Domicilio entregado sin domiciliario (lo recogió el cliente) o cobrado al volver: método real y confirmar. */
function CobrarDomicilio({ domicilio, onCobrado }) {
  const [metodo, setMetodo] = useState(domicilio.metodoPago);
  if (domicilio.pagadoAnticipado) {
    return (
      <BotonConfirmar confirmar="Toca otra vez: entregado" onConfirmar={() => onCobrado(domicilio, domicilio.metodoPago)} varianteInicial="secundario">
        Entregado
      </BotonConfirmar>
    );
  }
  return (
    <span className="flex items-center gap-2">
      <label className="sr-only" htmlFor={`metodo-domicilio-${domicilio.id}`}>Cómo pagó el domicilio {domicilio.id}</label>
      <select id={`metodo-domicilio-${domicilio.id}`} value={metodo} onChange={(e) => setMetodo(e.target.value)} className="h-9 rounded-xl border border-gray-300 bg-white px-2 text-[13px] font-semibold text-espresso">
        {METODOS_DOMICILIO.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
      </select>
      <BotonConfirmar confirmar="Toca otra vez: entregado y cobrado" onConfirmar={() => onCobrado(domicilio, metodo)} varianteInicial="secundario">
        Entregado y cobrado
      </BotonConfirmar>
    </span>
  );
}

export default function PorCobrar({ cuentas, domicilios, liquidaciones = [], onCobrar, onDomicilioCobrado, onLiquidar }) {
  if (cuentas.length === 0 && domicilios.length === 0 && liquidaciones.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white">
        <Vacio icono={Receipt} titulo="No hay cuentas por cobrar" texto="Las mesas aparecen aquí apenas piden; se cobran cuando la cocina tiene listo su pedido." />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {cuentas.length > 0 && (
        <section aria-label="Mesas por cobrar">
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {cuentas.map((c) => <TarjetaMesa key={c.mesaId ?? c.mesaNumero} cuenta={c} onCobrar={() => onCobrar(c)} />)}
          </ul>
        </section>
      )}

      {liquidaciones.length > 0 && (
        <section aria-label="Efectivo de los domiciliarios">
          <h2 className="mb-1 text-[20px] font-extrabold tracking-[-0.02em] text-espresso">Efectivo de los domiciliarios</h2>
          <p className="mb-3 text-[13px] text-gray-500">Cobraron en efectivo y aún no lo entregan. Recíbelo al contarlo: entra al cuadre del cajón.</p>
          <Lista>
            {liquidaciones.map((l) => (
              <div key={l.domiciliarioId} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-green-50 text-green-700" aria-hidden="true"><CircleDollarSign size={20} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-bold text-espresso">{l.nombre}</span>
                  <span className="tabular block text-[13px] text-gray-500">{l.entregas} entrega{l.entregas === 1 ? '' : 's'} · {l.domicilios.map((id) => `#${id}`).join(', ')}</span>
                </span>
                <span className="tabular text-[17px] font-extrabold text-espresso">{pesos(l.total)}</span>
                <BotonConfirmar confirmar={`Toca otra vez: recibí ${pesos(l.total)}`} onConfirmar={() => onLiquidar(l)} varianteInicial="secundario">
                  Recibir efectivo
                </BotonConfirmar>
              </div>
            ))}
          </Lista>
        </section>
      )}

      {domicilios.length > 0 && (
        <section aria-label="Domicilios por cobrar">
          <h2 className="mb-1 text-[20px] font-extrabold tracking-[-0.02em] text-espresso">Domicilios en curso</h2>
          <p className="mb-3 text-[13px] text-gray-500">El domiciliario los marca entregados desde la app. Márcalos aquí solo si los recogió el cliente o el pago llegó a caja.</p>
          <Lista>
            {domicilios.map((d) => {
              const etapa = etapaDomicilio(d);
              return (
                <div key={d.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-purple-50 text-purple-700" aria-hidden="true"><Truck size={20} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="tabular text-[15px] font-bold text-espresso">Domicilio #{d.id}</span>
                      <Chip tono={etapa === 'recibido' || etapa === 'cocina' ? 'aviso' : 'info'}>{ETAPA[etapa] ?? d.estado}</Chip>
                      {d.pagadoAnticipado && <Chip tono="ok">Pagado por anticipado</Chip>}
                    </span>
                    <span className="block truncate text-[13px] text-gray-500">
                      {d.clienteNombre}{d.barrio ? ` · ${d.barrio}` : ''} · {d.metodoPago}{d.domiciliarioNombre ? ` · lo lleva ${d.domiciliarioNombre}` : ''}
                    </span>
                  </span>
                  <span className="tabular text-[17px] font-extrabold text-espresso">{pesos(d.total)}</span>
                  {(etapa === 'listo' || etapa === 'camino') && <CobrarDomicilio domicilio={d} onCobrado={onDomicilioCobrado} />}
                </div>
              );
            })}
          </Lista>
        </section>
      )}
    </div>
  );
}
