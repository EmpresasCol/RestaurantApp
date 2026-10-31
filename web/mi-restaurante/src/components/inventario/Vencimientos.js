// Lotes por vencer y vencidos: usar primero lo que vence antes y sacar del stock lo vencido.
import React, { useEffect, useMemo, useState } from 'react';
import { CalendarCheck, Pencil } from 'lucide-react';
import { compras, mensajeError } from '../../services/inventarioApi';
import { formatearCantidad, formatearCOP, formatearFecha, nivelVencimiento, textoVencimiento } from '../../utils/inventario';
import EditorLote from './EditorLote';
import { BotonConfirmar, Cargando, Chip, Lista, useAviso, Vacio } from './ui';

const RANGOS = [
  { dias: 0, label: 'Vencidos y hoy' },
  { dias: 3, label: '3 días' },
  { dias: 7, label: '7 días' },
  { dias: 30, label: '30 días' },
];

export default function Vencimientos({ onAbrirInsumo, onCambio, version }) {
  const [dias, setDias] = useState(7);
  const [lotes, setLotes] = useState(null);
  const [error, setError] = useState(null);
  const [editando, setEditando] = useState(null);
  const [aviso, mostrar] = useAviso();

  const cargar = () => compras.vencimientos(dias).then(setLotes).catch((e) => setError(mensajeError(e, 'No se pudieron cargar los vencimientos')));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setLotes(null); cargar(); }, [dias, version]);

  const vencidos = useMemo(() => (lotes ?? []).filter((l) => l.diasParaVencer < 0), [lotes]);
  const enRiesgo = useMemo(() => (lotes ?? []).reduce((s, l) => s + l.valor, 0), [lotes]);

  const darDeBaja = async (l) => {
    try {
      const r = await compras.darDeBaja(l.id);
      mostrar(r.message);
      cargar();
      onCambio?.();
    } catch (e) {
      mostrar(mensajeError(e, 'No se pudo dar de baja'), 'error');
    }
  };

  if (error) return <p className="rounded-2xl bg-red-50 px-4 py-3 text-[14px] font-semibold text-red-800" role="alert">{error}</p>;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="qp-rail -mx-1 flex gap-1 overflow-x-auto px-1" role="group" aria-label="Rango de días">
          {RANGOS.map((r) => (
            <button
              key={r.dias}
              type="button"
              aria-pressed={dias === r.dias}
              onClick={() => setDias(r.dias)}
              className={`h-10 shrink-0 rounded-full px-4 text-[14px] font-bold transition-colors ${dias === r.dias ? 'bg-espresso text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-espresso'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
        {lotes && lotes.length > 0 && (
          <p className="text-[14px] text-gray-600">
            <span className="tabular font-bold text-espresso">{formatearCOP(enRiesgo)}</span> en riesgo
            {vencidos.length > 0 && <> · <span className="font-bold text-red-700">{vencidos.length} vencido{vencidos.length === 1 ? '' : 's'}</span></>}
          </p>
        )}
      </div>

      <div className="mt-4">
        {!lotes ? <Cargando /> : lotes.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white">
            <Vacio icono={CalendarCheck} titulo="Nada por vencer en este rango" texto="Los lotes se crean al recibir mercancía con su fecha de vencimiento." />
          </div>
        ) : (
          <Lista>
            {lotes.map((l) => {
              const nivel = nivelVencimiento(l.diasParaVencer);
              if (editando === l.id) {
                return (
                  <div key={l.id} className="px-4 py-3">
                    <p className="mb-2 text-[14px] font-bold text-espresso">{l.insumo} · lote {l.numeroLote}</p>
                    <EditorLote lote={l} onCancelar={() => setEditando(null)} onGuardado={() => { setEditando(null); mostrar('Lote corregido'); cargar(); onCambio?.(); }} />
                  </div>
                );
              }
              return (
                <div key={l.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5">
                  <button type="button" onClick={() => onAbrirInsumo(l.productoId)} className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-[15px] font-bold text-espresso hover:underline">{l.insumo}</span>
                    <span className="tabular block text-[13px] text-gray-500">
                      {formatearCantidad(l.cantidadActual, l.unidadMedida)} · lote {l.numeroLote} · {l.almacen} · {formatearFecha(l.fechaVencimiento)}
                    </span>
                  </button>
                  <span className="tabular w-24 text-right text-[14px] font-bold text-espresso">{formatearCOP(l.valor)}</span>
                  <Chip tono={nivel === 'normal' ? 'neutro' : nivel === 'aviso' ? 'aviso' : 'peligro'}>{textoVencimiento(l.diasParaVencer)}</Chip>
                  <button type="button" onClick={() => setEditando(l.id)} className="grid h-9 w-9 place-items-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-espresso" aria-label={`Corregir fecha del lote ${l.numeroLote}`}>
                    <Pencil size={15} />
                  </button>
                  {l.diasParaVencer < 0 && <BotonConfirmar onConfirmar={() => darDeBaja(l)}>Dar de baja</BotonConfirmar>}
                </div>
              );
            })}
          </Lista>
        )}
      </div>
      {aviso}
    </div>
  );
}
