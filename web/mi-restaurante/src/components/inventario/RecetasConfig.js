// Recetas: qué insumos gasta cada platillo, en la unidad del insumo, y cuánto cuesta prepararlo.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChefHat, Search, Trash2 } from 'lucide-react';
import { compras, createReceta, deleteReceta, getPlatillos, getRecetas, mensajeError, updateReceta } from '../../services/inventarioApi';
import { formatearCOP } from '../../utils/inventario';
import BuscadorInsumo from './BuscadorInsumo';
import { Boton, Cargando, Chip, useAviso, Vacio } from './ui';

const normalizar = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Costo de la receta sobre el precio de venta: hasta 35 % sano, hasta 45 % ajustado, más es caro. */
export const tonoCosto = (porcentaje) => (porcentaje == null ? 'neutro' : porcentaje <= 35 ? 'ok' : porcentaje <= 45 ? 'aviso' : 'peligro');

function FilaIngrediente({ r, insumo, onCambio, onQuitar }) {
  const [cantidad, setCantidad] = useState(String(r.cantidadRequerida));
  useEffect(() => setCantidad(String(r.cantidadRequerida)), [r.cantidadRequerida]);
  const costo = (Number(cantidad) || 0) * (insumo?.precioCosto ?? 0);

  const guardarCantidad = () => {
    const n = Number(cantidad);
    if (n > 0 && n !== r.cantidadRequerida) onCambio({ cantidadRequerida: n, opcional: r.opcional, notas: r.notas });
    else setCantidad(String(r.cantidadRequerida));
  };

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold text-espresso">{r.productoNombre}</span>
        <label className="mt-0.5 inline-flex items-center gap-1.5 text-[13px] text-gray-600">
          <input type="checkbox" checked={!!r.opcional} onChange={(e) => onCambio({ cantidadRequerida: r.cantidadRequerida, opcional: e.target.checked, notas: r.notas })} className="h-4 w-4 rounded accent-espresso" />
          Opcional (si falta, el plato igual se vende)
        </label>
      </span>
      <label className="flex items-center gap-1.5 text-[13px] text-gray-600">
        <input
          type="number" min="0.001" step="any" inputMode="decimal"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          onBlur={guardarCantidad}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className="tabular h-10 w-24 rounded-xl border border-gray-300 bg-white px-2 text-right text-[15px] font-bold text-espresso focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-100"
          aria-label={`Cantidad de ${r.productoNombre} por porción`}
        />
        <span className="w-16">{insumo?.unidadMedida ?? r.unidadMedida}</span>
      </label>
      <span className="tabular w-24 text-right text-[14px] font-bold text-espresso">{formatearCOP(costo)}</span>
      <button type="button" onClick={onQuitar} className="grid h-9 w-9 place-items-center rounded-full text-gray-500 hover:bg-red-50 hover:text-red-700" aria-label={`Quitar ${r.productoNombre}`}>
        <Trash2 size={16} />
      </button>
    </li>
  );
}

export default function RecetasConfig({ onCambio }) {
  const [platillos, setPlatillos] = useState(null);
  const [recetas, setRecetas] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [seleccion, setSeleccion] = useState(null);
  const [q, setQ] = useState('');
  const [nuevo, setNuevo] = useState(null);
  const [cantidadNueva, setCantidadNueva] = useState('');
  const [aviso, mostrar] = useAviso();

  const cargar = useCallback(() => {
    Promise.all([getPlatillos(), getRecetas(), compras.insumos()])
      .then(([p, r, i]) => { setPlatillos(p); setRecetas(r); setInsumos(i); setSeleccion((s) => s ?? p[0]?.id ?? null); })
      .catch((e) => { setPlatillos([]); mostrar(mensajeError(e, 'No se pudieron cargar las recetas'), 'error'); });
  }, [mostrar]);
  useEffect(() => { cargar(); }, [cargar]);

  const porInsumo = useMemo(() => Object.fromEntries(insumos.map((i) => [i.id, i])), [insumos]);
  const resumen = useMemo(() => {
    const r = {};
    recetas.forEach((x) => {
      const s = (r[x.platilloId] ??= { items: 0, costo: 0 });
      s.items += 1;
      s.costo += x.cantidadRequerida * (porInsumo[x.productoId]?.precioCosto ?? 0);
    });
    return r;
  }, [recetas, porInsumo]);

  const visibles = useMemo(() => {
    const t = normalizar(q.trim());
    return (platillos ?? []).filter((p) => !t || normalizar(p.nombre).includes(t) || normalizar(p.categoria).includes(t));
  }, [platillos, q]);

  const platillo = platillos?.find((p) => p.id === seleccion);
  const lineas = recetas.filter((r) => r.platilloId === seleccion);
  const costo = resumen[seleccion]?.costo ?? 0;
  const porcentaje = platillo?.precio > 0 && lineas.length ? Math.round((costo / platillo.precio) * 100) : null;

  const actuar = async (promesa, ok) => {
    try {
      await promesa;
      if (ok) mostrar(ok);
      setRecetas(await getRecetas());
      onCambio?.();
    } catch (e) {
      mostrar(mensajeError(e, 'No se pudo guardar la receta'), 'error');
    }
  };

  const agregar = () => {
    const n = Number(cantidadNueva);
    if (!(n > 0)) return mostrar('Escribe cuánto lleva por porción', 'error');
    actuar(createReceta({ platilloId: seleccion, productoId: nuevo.id, cantidadRequerida: n, unidadMedida: nuevo.unidadMedida, opcional: false }), `${nuevo.nombre} agregado`);
    setNuevo(null);
    setCantidadNueva('');
  };

  if (!platillos) return <Cargando filas={6} />;

  return (
    <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
      <aside>
        <label className="relative block">
          <span className="sr-only">Buscar platillo</span>
          <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" aria-hidden="true" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar platillo"
            className="h-11 w-full rounded-xl border border-gray-300 bg-white pl-10 pr-3.5 text-[15px] text-espresso placeholder:text-gray-500 focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-100"
          />
        </label>
        <ul className="mt-3 max-h-[70vh] divide-y divide-gray-200 overflow-y-auto rounded-2xl border border-gray-200 bg-white">
          {visibles.map((p) => {
            const s = resumen[p.id];
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => { setSeleccion(p.id); setNuevo(null); }}
                  aria-current={seleccion === p.id ? 'true' : undefined}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${seleccion === p.id ? 'bg-orange-50' : 'hover:bg-gray-50'}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold text-espresso">{p.nombre}</span>
                    <span className="tabular block text-[13px] text-gray-500">{s ? `${s.items} insumo${s.items === 1 ? '' : 's'} · ${formatearCOP(s.costo)}` : 'Sin receta'}</span>
                  </span>
                  {!s && <Chip tono="aviso">Sin receta</Chip>}
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <section className="min-w-0">
        {!platillo ? (
          <div className="rounded-2xl border border-gray-200 bg-white"><Vacio icono={ChefHat} titulo="Elige un platillo" /></div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <header className="flex flex-wrap items-end justify-between gap-3 border-b border-gray-200 px-4 py-4">
              <div>
                <h2 className="text-[20px] font-extrabold tracking-[-0.02em] text-espresso">{platillo.nombre}</h2>
                <p className="tabular text-[13px] text-gray-500">Se vende a {formatearCOP(platillo.precio)}</p>
              </div>
              <div className="text-right">
                <p className="text-[13px] text-gray-500">Cuesta prepararlo</p>
                <p className="flex items-center justify-end gap-2">
                  <span className="tabular text-[22px] font-extrabold text-espresso">{formatearCOP(costo)}</span>
                  {porcentaje != null && <Chip tono={tonoCosto(porcentaje)}>{porcentaje} % del precio</Chip>}
                </p>
              </div>
            </header>

            {lineas.length === 0 ? (
              <p className="px-4 py-5 text-[14px] text-amber-800">Sin receta, este platillo no descuenta inventario. Agrega lo que lleva una porción.</p>
            ) : (
              <ul className="divide-y divide-gray-200">
                {lineas.map((r) => (
                  <FilaIngrediente
                    key={r.id}
                    r={r}
                    insumo={porInsumo[r.productoId]}
                    onCambio={(dto) => actuar(updateReceta(r.id, dto))}
                    onQuitar={() => actuar(deleteReceta(r.id), `${r.productoNombre} quitado`)}
                  />
                ))}
              </ul>
            )}

            <footer className="border-t border-gray-200 bg-gray-50 p-4">
              <p className="mb-2 text-[13px] font-semibold text-gray-600">Agregar insumo a la receta (por una porción)</p>
              {nuevo ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[15px] font-bold text-espresso">{nuevo.nombre}</span>
                  <label className="flex items-center gap-1.5 text-[13px] text-gray-600">
                    <input
                      type="number" min="0.001" step="any" inputMode="decimal" autoFocus
                      value={cantidadNueva}
                      onChange={(e) => setCantidadNueva(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && agregar()}
                      className="tabular h-10 w-24 rounded-xl border border-gray-300 bg-white px-2 text-right text-[15px] font-bold text-espresso focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-100"
                      aria-label={`Cantidad de ${nuevo.nombre} por porción en ${nuevo.unidadMedida}`}
                    />
                    {nuevo.unidadMedida}
                  </label>
                  <Boton variante="fantasma" onClick={() => setNuevo(null)}>Cancelar</Boton>
                  <Boton onClick={agregar}>Agregar</Boton>
                </div>
              ) : (
                <BuscadorInsumo insumos={insumos.filter((i) => !lineas.some((r) => r.productoId === i.id))} onElegir={setNuevo} />
              )}
            </footer>
          </div>
        )}
      </section>
      {aviso}
    </div>
  );
}
