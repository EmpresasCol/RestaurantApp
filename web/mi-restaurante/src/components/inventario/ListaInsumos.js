// Todos los insumos con su estado; tocar uno abre su ficha.
import React, { useEffect, useMemo, useState } from 'react';
import { Package, Search } from 'lucide-react';
import { compras, mensajeError } from '../../services/inventarioApi';
import { formatearCantidad, formatearFecha, textoCobertura } from '../../utils/inventario';
import { Cargando, ChipEstado, Selector, Vacio } from './ui';

const FILTROS = [
  { id: 'todos', label: 'Todos' },
  { id: 'Agotado', label: 'Agotados' },
  { id: 'Bajo', label: 'Por pedir' },
  { id: 'OK', label: 'Al día' },
];

const normalizar = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function ListaInsumos({ onAbrirInsumo, filtroInicial = 'todos', version }) {
  const [insumos, setInsumos] = useState(null);
  const [error, setError] = useState(null);
  const [filtro, setFiltro] = useState(filtroInicial);
  const [categoria, setCategoria] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => setFiltro(filtroInicial), [filtroInicial]);
  useEffect(() => {
    compras.insumos().then(setInsumos).catch((e) => setError(mensajeError(e, 'No se pudieron cargar los insumos')));
  }, [version]);

  const categorias = useMemo(() => [...new Set((insumos ?? []).map((i) => i.categoria).filter(Boolean))].sort(), [insumos]);
  const conteo = useMemo(() => {
    const c = { todos: insumos?.length ?? 0 };
    (insumos ?? []).forEach((i) => { c[i.estado] = (c[i.estado] ?? 0) + 1; });
    return c;
  }, [insumos]);

  const visibles = useMemo(() => {
    const t = normalizar(q.trim());
    return (insumos ?? []).filter((i) =>
      (filtro === 'todos' || i.estado === filtro) &&
      (!categoria || i.categoria === categoria) &&
      (!t || normalizar(i.nombre).includes(t) || normalizar(i.codigo).includes(t)));
  }, [insumos, filtro, categoria, q]);

  if (error) return <p className="rounded-2xl bg-red-50 px-4 py-3 text-[14px] font-semibold text-red-800" role="alert">{error}</p>;

  return (
    <div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="qp-rail -mx-1 flex gap-1 overflow-x-auto px-1" role="group" aria-label="Filtrar por estado">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filtro === f.id}
              onClick={() => setFiltro(f.id)}
              className={`flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-[14px] font-bold transition-colors ${
                filtro === f.id ? 'bg-espresso text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-espresso'
              }`}
            >
              {f.label}
              <span className={`tabular text-[12px] ${filtro === f.id ? 'text-orange-200' : 'text-gray-500'}`}>{conteo[f.id] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-1 gap-2 lg:justify-end">
          <label className="relative flex-1 lg:max-w-xs">
            <span className="sr-only">Buscar insumo</span>
            <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" aria-hidden="true" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre o código"
              className="h-11 w-full rounded-xl border border-gray-300 bg-white pl-10 pr-3.5 text-[15px] text-espresso placeholder:text-gray-500 focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-100"
            />
          </label>
          <Selector value={categoria} onChange={(e) => setCategoria(e.target.value)} aria-label="Categoría" className="w-32 shrink-0 sm:w-40">
            <option value="">Todas</option>
            {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
          </Selector>
        </div>
      </div>

      <div className="mt-4">
        {!insumos ? <Cargando filas={8} /> : visibles.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white">
            <Vacio icono={Package} titulo="Ningún insumo coincide" texto="Prueba con otro filtro o búsqueda." />
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <table className="w-full text-left">
              <thead className="hidden border-b border-gray-200 bg-gray-50 text-[12px] font-bold text-gray-600 md:table-header-group">
                <tr>
                  <th scope="col" className="px-4 py-3">Insumo</th>
                  <th scope="col" className="px-4 py-3 text-right">En stock</th>
                  <th scope="col" className="px-4 py-3 text-right">Pedir al llegar a</th>
                  <th scope="col" className="px-4 py-3">Alcanza</th>
                  <th scope="col" className="px-4 py-3">Vence primero</th>
                  <th scope="col" className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {visibles.map((i) => (
                  <tr
                    key={i.id}
                    onClick={() => onAbrirInsumo(i.id)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onAbrirInsumo(i.id))}
                    tabIndex={0}
                    className="cursor-pointer transition-colors hover:bg-gray-50 focus:bg-orange-50 focus:outline-none max-md:flex max-md:flex-wrap max-md:items-center max-md:gap-x-3 max-md:px-4 max-md:py-3"
                  >
                    <td className="md:px-4 md:py-3 max-md:min-w-0 max-md:flex-1">
                      <span className="block text-[15px] font-bold text-espresso">{i.nombre}</span>
                      <span className="tabular block text-[12px] text-gray-500">{[i.codigo, i.categoria].filter(Boolean).join(' · ')}</span>
                    </td>
                    <td className="tabular text-[15px] font-extrabold text-espresso md:px-4 md:py-3 md:text-right max-md:order-3 max-md:w-full max-md:text-[13px] max-md:font-semibold max-md:text-gray-600">
                      {formatearCantidad(i.stock, i.unidadMedida)}
                      <span className="md:hidden"> · {textoCobertura(i.diasCobertura)}</span>
                    </td>
                    <td className="tabular hidden px-4 py-3 text-right text-[14px] text-gray-600 md:table-cell">{formatearCantidad(i.puntoReorden, i.unidadMedida)}</td>
                    <td className="hidden px-4 py-3 text-[14px] text-gray-600 md:table-cell">{textoCobertura(i.diasCobertura)}</td>
                    <td className="tabular hidden px-4 py-3 text-[14px] text-gray-600 md:table-cell">{i.proximoVencimiento ? formatearFecha(i.proximoVencimiento) : '—'}</td>
                    <td className="md:px-4 md:py-3"><ChipEstado estado={i.estado} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
