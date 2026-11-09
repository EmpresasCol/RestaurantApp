// Busca un insumo por nombre o código interno y lo entrega al elegirlo.
import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { formatearCantidad } from '../../utils/inventario';
import { ChipEstado } from './ui';

const normalizar = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function BuscadorInsumo({ insumos, onElegir, placeholder = 'Buscar insumo por nombre o código', autoFocus = false }) {
  const [q, setQ] = useState('');

  const resultados = useMemo(() => {
    const t = normalizar(q.trim());
    if (!t) return [];
    return insumos.filter((i) => normalizar(i.nombre).includes(t) || normalizar(i.codigo).includes(t)).slice(0, 8);
  }, [q, insumos]);

  const elegir = (insumo) => {
    onElegir(insumo);
    setQ('');
  };

  return (
    <div className="relative">
      <label className="relative block">
        <span className="sr-only">{placeholder}</span>
        <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" aria-hidden="true" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && resultados[0]) { e.preventDefault(); elegir(resultados[0]); } }}
          autoFocus={autoFocus}
          placeholder={placeholder}
          className="h-11 w-full rounded-xl border border-gray-300 bg-white pl-10 pr-3.5 text-[15px] text-espresso placeholder:text-gray-500 focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-100"
        />
      </label>
      {q.trim() && (
        <ul className="absolute inset-x-0 top-full z-20 mt-1.5 max-h-80 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-1.5 shadow-lift" role="listbox">
          {resultados.length === 0 && <li className="px-3 py-3 text-[14px] text-gray-500">Ningún insumo coincide con “{q.trim()}”.</li>}
          {resultados.map((i) => (
            <li key={i.id}>
              <button
                type="button"
                onClick={() => elegir(i)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-gray-100"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold text-espresso">{i.nombre}</span>
                  <span className="tabular block text-[12px] text-gray-500">
                    {i.codigo ? `${i.codigo} · ` : ''}{formatearCantidad(i.stock, i.unidadMedida)} en stock
                  </span>
                </span>
                {i.estado && <ChipEstado estado={i.estado} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
