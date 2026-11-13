// src/components/caja/TableroMesas.js
// Todas las mesas de un vistazo para caja y administración. El estado sale de la API
// (mesa, pedidos abiertos, cuenta pedida y llamadas); cobrar usa el mismo CobroPanel de la caja.
import React, { useMemo, useState } from 'react';
import { BellRing, CheckCheck, CircleCheck, Receipt, RefreshCw, Utensils, WifiOff } from 'lucide-react';
import * as api from '../../services/api';
import { Boton, BotonConfirmar, Chip, Panel, Vacio } from '../inventario/ui';
import { estadoPedido, estadoTablero, hora, pesos, textoSolicitud } from '../../utils/caja';

export const ESTADO_MESA = {
  libre: { texto: 'Libre', icono: CircleCheck, chip: 'ok', borde: 'border-green-300' },
  ocupada: { texto: 'Ocupada', icono: Utensils, chip: 'peligro', borde: 'border-red-300' },
  pago: { texto: 'Esperando pago', icono: Receipt, chip: 'aviso', borde: 'border-amber-300' },
};

const FILTROS = [
  { id: 'todas', texto: 'Todas' },
  { id: 'ocupada', texto: 'Ocupadas' },
  { id: 'pago', texto: 'Esperando pago' },
  { id: 'libre', texto: 'Libres' },
];

const textoLlamada = (l) => (l.estado === 'EnCamino' ? `${l.meseroNombre ?? 'Un mesero'} va para la mesa` : 'Esperando mesero');

function TarjetaMesa({ mesa, cuenta, info, onAbrir }) {
  const e = ESTADO_MESA[info.estado];
  const Icono = e.icono;
  return (
    <button
      type="button"
      onClick={onAbrir}
      className={`flex min-h-[148px] flex-col rounded-2xl border-2 bg-white p-4 text-left transition-shadow hover:shadow-card ${e.borde}`}
      aria-label={`Mesa ${mesa.numero}: ${e.texto}${info.llamada ? ', llama al mesero' : ''}${info.listos ? `, ${info.listos} para servir` : ''}${cuenta ? `, por cobrar ${pesos(cuenta.total)}` : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="tabular text-[30px] font-extrabold leading-none text-espresso">{mesa.numero}</span>
        <Chip tono={e.chip}><Icono size={13} aria-hidden="true" />{e.texto}</Chip>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {info.llamada && (
          <span className="inline-flex h-6 items-center gap-1 rounded-full bg-orange-100 px-2.5 text-[12px] font-bold text-orange-900">
            <BellRing size={13} aria-hidden="true" />Llama
          </span>
        )}
        {info.listos > 0 && <Chip tono="info"><CheckCheck size={13} aria-hidden="true" />{info.listos} para servir</Chip>}
      </div>
      <div className="mt-auto pt-3">
        {cuenta ? (
          <>
            <p className="tabular text-[17px] font-extrabold text-espresso">{pesos(cuenta.total)}</p>
            <p className="tabular text-[13px] text-gray-500">
              {cuenta.platos} platos · desde {hora(cuenta.desde)}
            </p>
          </>
        ) : (
          <p className="text-[13px] text-gray-500">{info.estado === 'libre' ? 'Sin consumo' : 'Sin pedidos abiertos'}</p>
        )}
      </div>
    </button>
  );
}

function DetalleMesa({ mesa, cuenta, info, onCerrar, onCobrar, onCambio, mostrar }) {
  const [ocupado, setOcupado] = useState(null);

  const hacer = async (clave, accion, exito) => {
    setOcupado(clave);
    try {
      await accion();
      mostrar(exito);
      onCambio();
    } catch (e) {
      mostrar(e.message, 'error');
      onCambio();
    } finally {
      setOcupado(null);
    }
  };

  const e = mesa ? ESTADO_MESA[info.estado] : null;
  const soloEnCocina = cuenta && cuenta.totalCobrable === 0;
  const solicitud = textoSolicitud(cuenta?.solicitud);

  return (
    <Panel
      abierto={!!mesa}
      onCerrar={onCerrar}
      titulo={mesa ? `Mesa ${mesa.numero}` : ''}
      subtitulo={e?.texto}
      pie={mesa && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {info.puedeLiberar && (
            <BotonConfirmar
              confirmar="Toca otra vez para liberarla"
              disabled={ocupado === 'liberar'}
              onConfirmar={() => hacer('liberar', () => api.liberarMesa(mesa.id), `Mesa ${mesa.numero} libre`)}
            >
              Liberar mesa
            </BotonConfirmar>
          )}
          {cuenta && (
            <Boton onClick={() => onCobrar(mesa.id)} disabled={soloEnCocina}>
              <Receipt size={16} aria-hidden="true" /> Cobrar {pesos(cuenta.totalCobrable)}
            </Boton>
          )}
        </div>
      )}
    >
      {mesa && (
        <div className="space-y-5">
          {info.llamada && (
            <section className="flex items-center gap-3 rounded-2xl bg-orange-50 p-4">
              <BellRing size={20} className="shrink-0 text-orange-700" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-bold text-espresso">La mesa llama al mesero</p>
                <p className="tabular text-[13px] text-gray-600">{textoLlamada(info.llamada)} · {hora(info.llamada.fecha)}</p>
              </div>
              <Boton
                variante="secundario"
                tamano="sm"
                disabled={ocupado === 'llamada'}
                onClick={() => hacer('llamada', () => api.atenderLlamada(info.llamada.id), `Mesa ${mesa.numero}: llamada atendida`)}
              >
                Marcar atendida
              </Boton>
            </section>
          )}

          {cuenta ? (
            <section>
              <dl className="space-y-1.5 rounded-2xl border border-gray-200 p-4 text-[14px]">
                <div className="flex justify-between"><dt className="text-gray-600">Por cobrar</dt><dd className="tabular text-[18px] font-extrabold text-espresso">{pesos(cuenta.total)}</dd></div>
                {cuenta.enCocina > 0 && (
                  <div className="flex justify-between"><dt className="text-gray-600">Se puede cobrar ya</dt><dd className="tabular font-semibold">{pesos(cuenta.totalCobrable)}</dd></div>
                )}
                {cuenta.pagadoParcial && <p className="text-[13px] text-gray-500">Ya se cobró una parte de esta cuenta.</p>}
                {solicitud && <p className="text-[13px] font-semibold text-purple-700">{solicitud}</p>}
              </dl>
              {soloEnCocina && (
                <p className="mt-2 text-[13px] text-gray-500">Todo está en cocina: se cobra cuando esté listo.</p>
              )}
            </section>
          ) : (
            <p className="rounded-2xl bg-gray-50 p-4 text-[14px] text-gray-600">
              {info.estado === 'libre' ? 'La mesa está libre.' : 'Sin pedidos abiertos. Si ya se fueron, libera la mesa.'}
            </p>
          )}

          {cuenta?.pedidos.map((p) => {
            const est = estadoPedido(p.estado);
            return (
              <section key={p.id} className="rounded-2xl border border-gray-200 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="tabular text-[14px] font-bold text-espresso">Pedido #{p.id} · {hora(p.fecha)}</p>
                  <Chip tono={est.tono}>{est.texto}</Chip>
                </div>
                <ul className="mt-2 space-y-1.5 text-[14px]">
                  {p.detalles.map((d) => (
                    <li key={d.id} className={`flex justify-between gap-3 ${d.pagado ? 'text-gray-400 line-through' : ''}`}>
                      <span className="min-w-0">
                        <span className="tabular font-extrabold">{d.cantidad}×</span> {d.platilloNombre}
                        {d.nota && <span className="block text-[13px] text-gray-500">{d.nota}</span>}
                      </span>
                      <span className="tabular shrink-0">{pesos(d.precio * d.cantidad)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}

          {mesa.pinSeguimiento && (
            <p className="text-[13px] text-gray-600">
              Código para que el comensal siga su pedido:{' '}
              <span className="tabular text-[15px] font-extrabold tracking-[0.2em] text-espresso">{mesa.pinSeguimiento}</span>
            </p>
          )}
        </div>
      )}
    </Panel>
  );
}

export default function TableroMesas({ mesas, cuentas, llamadas, cargando, error, onReintentar, onCobrar, onCambio, mostrar }) {
  const [filtro, setFiltro] = useState('todas');
  const [abierta, setAbierta] = useState(null);

  const filas = useMemo(() => mesas.map((m) => {
    const cuenta = cuentas.find((c) => c.mesaId === m.id) ?? null;
    return { mesa: m, cuenta, info: estadoTablero(m, cuenta, llamadas.find((l) => l.mesaId === m.id)) };
  }), [mesas, cuentas, llamadas]);

  const conteo = (id) => (id === 'todas' ? filas.length : filas.filter((f) => f.info.estado === id).length);
  const visibles = filtro === 'todas' ? filas : filas.filter((f) => f.info.estado === filtro);
  const seleccion = filas.find((f) => f.mesa.id === abierta);

  if (cargando && !mesas.length) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-busy="true" aria-label="Cargando mesas">
        {Array.from({ length: 10 }).map((_, i) => <div key={i} className="h-[148px] animate-pulse rounded-2xl bg-gray-100" />)}
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-red-50 px-4 py-3 text-[14px] font-medium text-red-800">
          <WifiOff size={18} aria-hidden="true" />
          <span className="flex-1">{mesas.length ? 'Sin conexión: mostramos lo último que cargó.' : 'No pudimos cargar las mesas.'}</span>
          <Boton variante="secundario" tamano="sm" onClick={onReintentar}><RefreshCw size={14} aria-hidden="true" />Reintentar</Boton>
        </div>
      )}

      <div className="qp-rail mb-4 flex gap-1 overflow-x-auto" role="group" aria-label="Filtrar mesas">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFiltro(f.id)}
            aria-pressed={filtro === f.id}
            className={`h-10 shrink-0 rounded-full px-4 text-[14px] font-bold transition-colors ${filtro === f.id ? 'bg-espresso text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-espresso'}`}
          >
            {f.texto} <span className="tabular">{conteo(f.id)}</span>
          </button>
        ))}
      </div>

      {!mesas.length ? (
        <Vacio icono={Utensils} titulo="No hay mesas" texto="El administrador las crea desde Códigos QR." />
      ) : !visibles.length ? (
        <Vacio icono={CircleCheck} titulo="Ninguna mesa en este filtro" />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {visibles.map((f) => (
            <TarjetaMesa key={f.mesa.id} {...f} onAbrir={() => setAbierta(f.mesa.id)} />
          ))}
        </div>
      )}

      <DetalleMesa
        mesa={seleccion?.mesa ?? null}
        cuenta={seleccion?.cuenta ?? null}
        info={seleccion?.info ?? {}}
        onCerrar={() => setAbierta(null)}
        onCobrar={(id) => { setAbierta(null); onCobrar(id); }}
        onCambio={onCambio}
        mostrar={mostrar}
      />
    </div>
  );
}
