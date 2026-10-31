// Cuentas abiertas: una tarjeta por mesa (todos sus pedidos) y los domicilios en camino.
import React from 'react';
import { Receipt, Truck } from 'lucide-react';
import { BotonConfirmar, Chip, Lista, Vacio } from '../inventario/ui';
import { hora, lineasCuenta, pesos } from '../../utils/caja';

const ESTADO_DOMICILIO = { EnPreparacion: 'En cocina', Listo: 'Listo para salir', Recogido: 'Recogido', EnCamino: 'En camino' };

function TarjetaMesa({ cuenta, onCobrar }) {
  const lineas = lineasCuenta(cuenta.pedidos);
  const visibles = lineas.slice(0, 4);
  const todoEnCocina = cuenta.totalCobrable === 0;
  return (
    <li className="flex flex-col rounded-2xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-espresso">Mesa {cuenta.mesaNumero}</h3>
          <p className="tabular text-[13px] text-gray-500">
            {cuenta.pedidos.length} pedido{cuenta.pedidos.length === 1 ? '' : 's'} · {cuenta.platos} plato{cuenta.platos === 1 ? '' : 's'} · desde {hora(cuenta.desde)}
          </p>
        </div>
        <p className="tabular text-[22px] font-extrabold tracking-[-0.02em] text-espresso">{pesos(cuenta.total)}</p>
      </div>
      {cuenta.enCocina > 0 && (
        <p className="mt-2"><Chip tono="aviso">{cuenta.enCocina === cuenta.pedidos.length ? 'Todo en cocina' : `${cuenta.enCocina} pedido${cuenta.enCocina === 1 ? '' : 's'} en cocina`}</Chip></p>
      )}
      <ul className="tabular mt-3 flex-1 space-y-1 text-[14px] text-gray-600">
        {visibles.map((l) => (
          <li key={`${l.nombre}-${l.precio}`} className="flex justify-between gap-3">
            <span className="truncate">{l.cantidad} × {l.nombre}</span>
            <span className="shrink-0">{pesos(l.total)}</span>
          </li>
        ))}
        {lineas.length > visibles.length && <li className="text-gray-500">y {lineas.length - visibles.length} más</li>}
      </ul>
      <button
        type="button"
        onClick={onCobrar}
        disabled={todoEnCocina}
        className="mt-4 h-12 w-full rounded-xl bg-espresso text-[15px] font-bold text-white transition-colors hover:bg-gray-900 disabled:bg-gray-200 disabled:text-gray-500"
      >
        {todoEnCocina ? 'Esperando a cocina' : `Cobrar ${pesos(cuenta.totalCobrable)}`}
      </button>
    </li>
  );
}

export default function PorCobrar({ cuentas, domicilios, onCobrar, onDomicilioCobrado }) {
  if (cuentas.length === 0 && domicilios.length === 0) {
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

      {domicilios.length > 0 && (
        <section aria-label="Domicilios por cobrar">
          <h2 className="mb-1 text-[20px] font-extrabold tracking-[-0.02em] text-espresso">Domicilios en curso</h2>
          <p className="mb-3 text-[13px] text-gray-500">Márcalos cuando el domiciliario entregue y traiga el pago. Los pagados por anticipado ya están cobrados.</p>
          <Lista>
            {domicilios.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-purple-50 text-purple-700" aria-hidden="true"><Truck size={20} /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="tabular text-[15px] font-bold text-espresso">Domicilio #{d.id}</span>
                    <Chip tono={d.estado === 'EnPreparacion' ? 'aviso' : 'info'}>{ESTADO_DOMICILIO[d.estado] ?? d.estado}</Chip>
                    {d.pagadoAnticipado && <Chip tono="ok">Pagado por anticipado</Chip>}
                  </span>
                  <span className="block truncate text-[13px] text-gray-500">
                    {d.clienteNombre}{d.barrio ? ` · ${d.barrio}` : ''} · {d.metodoPago}{d.domiciliarioNombre ? ` · lo lleva ${d.domiciliarioNombre}` : ''}
                  </span>
                </span>
                <span className="tabular text-[17px] font-extrabold text-espresso">{pesos(d.total)}</span>
                {d.estado !== 'EnPreparacion' && (
                  <BotonConfirmar confirmar="Toca otra vez: entregado y cobrado" onConfirmar={() => onDomicilioCobrado(d)} varianteInicial="secundario">
                    Entregado y cobrado
                  </BotonConfirmar>
                )}
              </div>
            ))}
          </Lista>
        </section>
      )}
    </div>
  );
}
