// "Hoy": lo que el encargado debe atender al llegar, con acceso directo a cada tarea.
import React, { useEffect, useState } from 'react';
import { CalendarClock, ClipboardCheck, PackagePlus, ShoppingCart, ChevronRight, CheckCircle2 } from 'lucide-react';
import { compras, mensajeError } from '../../services/inventarioApi';
import { formatearCantidad, formatearCOP, nivelVencimiento, textoCobertura, textoVencimiento } from '../../utils/inventario';
import { Boton, Cargando, Chip, ChipEstado, Lista, Vacio } from './ui';

function Indicador({ valor, etiqueta, tono, onClick }) {
  const color = valor > 0 ? (tono === 'peligro' ? 'text-red-700' : tono === 'aviso' ? 'text-amber-700' : 'text-espresso') : 'text-gray-400';
  return (
    <button type="button" onClick={onClick} className="group flex min-w-0 flex-col items-start bg-white px-4 py-3.5 text-left transition-colors last:col-span-2 hover:bg-gray-50 sm:last:col-span-1">
      <span className={`tabular text-[28px] font-extrabold leading-none tracking-[-0.03em] ${color}`}>{valor}</span>
      <span className="mt-1.5 flex items-center gap-0.5 text-[13px] font-semibold text-gray-600 group-hover:text-espresso">
        {etiqueta} <ChevronRight size={14} className="opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
      </span>
    </button>
  );
}

export default function HoyInventario({ onIr, onAbrirInsumo, version }) {
  const [r, setR] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    compras.resumen().then(setR).catch((e) => setError(mensajeError(e, 'No se pudo cargar el resumen')));
  }, [version]);

  if (error) return <p className="rounded-2xl bg-red-50 px-4 py-3 text-[14px] font-semibold text-red-800" role="alert">{error}</p>;
  if (!r) return <Cargando filas={6} />;

  const todoBien = r.agotados + r.porPedir + r.porVencer + r.vencidos === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Boton tamano="lg" onClick={() => onIr('recibir')}><PackagePlus size={20} aria-hidden="true" /> Recibir mercancía</Boton>
        <Boton tamano="lg" variante="secundario" onClick={() => onIr('pedidos')}><ShoppingCart size={20} aria-hidden="true" /> Hacer pedido</Boton>
        <Boton tamano="lg" variante="secundario" onClick={() => onIr('conteo')}><ClipboardCheck size={20} aria-hidden="true" /> Contar inventario</Boton>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-gray-200 bg-gray-200 sm:grid-cols-5">
        <Indicador valor={r.agotados} etiqueta="Agotados" tono="peligro" onClick={() => onIr('insumos', 'Agotado')} />
        <Indicador valor={r.porPedir} etiqueta="Por pedir" tono="aviso" onClick={() => onIr('pedidos')} />
        <Indicador valor={r.porVencer} etiqueta="Vencen esta semana" tono="aviso" onClick={() => onIr('vencimientos')} />
        <Indicador valor={r.vencidos} etiqueta="Vencidos" tono="peligro" onClick={() => onIr('vencimientos')} />
        <Indicador valor={r.ordenesAbiertas} etiqueta="Pedidos por llegar" onClick={() => onIr('pedidos')} />
      </div>
      <p className="-mt-3 text-[13px] text-gray-500">
        <span className="tabular font-semibold text-espresso">{r.totalInsumos}</span> insumos activos · valor en bodega <span className="tabular font-semibold text-espresso">{formatearCOP(r.valorInventario)}</span>
      </p>

      {todoBien ? (
        <div className="rounded-2xl border border-gray-200 bg-white">
          <Vacio icono={CheckCircle2} titulo="Todo en orden" texto="No hay insumos agotados, por pedir ni por vencer. Revisa de nuevo después del servicio." />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <section aria-labelledby="hoy-acabando">
            <div className="mb-3 flex items-end justify-between">
              <h2 id="hoy-acabando" className="text-[20px] font-extrabold tracking-[-0.02em] text-espresso">Se están acabando</h2>
              {r.criticos.length > 0 && <Boton variante="fantasma" tamano="sm" onClick={() => onIr('pedidos')}>Armar pedido</Boton>}
            </div>
            {r.criticos.length === 0 ? (
              <p className="rounded-2xl border border-gray-200 bg-white px-4 py-5 text-[14px] text-gray-500">Ningún insumo bajo su nivel de pedido.</p>
            ) : (
              <Lista>
                {r.criticos.map((c) => (
                  <button key={c.id} type="button" onClick={() => onAbrirInsumo(c.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-bold text-espresso">{c.nombre}</span>
                      <span className="tabular block text-[13px] text-gray-500">
                        Quedan {formatearCantidad(c.stock, c.unidadMedida)} · se pide al llegar a {formatearCantidad(c.puntoReorden)} · {textoCobertura(c.diasCobertura)}
                        {c.pedido > 0 && ` · ${formatearCantidad(c.pedido, c.unidadMedida)} en camino`}
                      </span>
                    </span>
                    <ChipEstado estado={c.estado} />
                  </button>
                ))}
              </Lista>
            )}
          </section>

          <section aria-labelledby="hoy-vence">
            <div className="mb-3 flex items-end justify-between">
              <h2 id="hoy-vence" className="text-[20px] font-extrabold tracking-[-0.02em] text-espresso">Próximos a vencer</h2>
              {r.vencimientos.length > 0 && <Boton variante="fantasma" tamano="sm" onClick={() => onIr('vencimientos')}>Ver todos</Boton>}
            </div>
            {r.vencimientos.length === 0 ? (
              <p className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-5 text-[14px] text-gray-500">
                <CalendarClock size={18} aria-hidden="true" /> Nada vence en los próximos 7 días.
              </p>
            ) : (
              <Lista>
                {r.vencimientos.map((l) => {
                  const nivel = nivelVencimiento(l.diasParaVencer);
                  return (
                    <button key={l.id} type="button" onClick={() => onAbrirInsumo(l.productoId)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-bold text-espresso">{l.insumo}</span>
                        <span className="tabular block text-[13px] text-gray-500">{formatearCantidad(l.cantidadActual, l.unidadMedida)} · lote {l.numeroLote} · {formatearCOP(l.valor)}</span>
                      </span>
                      <Chip tono={nivel === 'normal' ? 'neutro' : nivel === 'aviso' ? 'aviso' : 'peligro'}>{textoVencimiento(l.diasParaVencer)}</Chip>
                    </button>
                  );
                })}
              </Lista>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
