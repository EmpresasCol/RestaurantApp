// Catálogo de insumos: alta, edición y baja (activos e inactivos).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Barcode, Package, Plus, Search } from 'lucide-react';
import { getProductos, mensajeError } from '../../services/inventarioApi';
import { formatearCantidad, formatearCOP } from '../../utils/inventario';
import FormularioInsumo from './FormularioInsumo';
import { Boton, Cargando, Chip, useAviso, Vacio } from './ui';

const normalizar = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function CatalogoInsumos({ onCambio }) {
  const [productos, setProductos] = useState(null);
  const [q, setQ] = useState('');
  const [verInactivos, setVerInactivos] = useState(false);
  const [editando, setEditando] = useState(undefined); // undefined: cerrado; null: nuevo; id: edición
  const [aviso, mostrar] = useAviso();

  const cargar = useCallback(() => {
    getProductos().then(setProductos).catch((e) => { setProductos([]); mostrar(mensajeError(e, 'No se pudo cargar el catálogo'), 'error'); });
  }, [mostrar]);
  useEffect(() => { cargar(); }, [cargar]);

  const visibles = useMemo(() => {
    const t = normalizar(q.trim());
    return (productos ?? []).filter((p) => (verInactivos || p.activo !== false)
      && (!t || [p.nombre, p.codigo, p.codigoBarras, p.categoriaNombre].some((x) => normalizar(x).includes(t))));
  }, [productos, q, verInactivos]);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[220px] flex-1">
          <span className="sr-only">Buscar insumo</span>
          <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" aria-hidden="true" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nombre, código o código de barras"
            className="h-11 w-full rounded-xl border border-gray-300 bg-white pl-10 pr-3.5 text-[15px] text-espresso placeholder:text-gray-500 focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-100"
          />
        </label>
        <label className="flex h-11 items-center gap-2 text-[14px] font-semibold text-espresso">
          <input type="checkbox" checked={verInactivos} onChange={(e) => setVerInactivos(e.target.checked)} className="h-5 w-5 rounded accent-espresso" />
          Ver inactivos
        </label>
        <Boton onClick={() => setEditando(null)} className="h-11"><Plus size={18} aria-hidden="true" /> Nuevo insumo</Boton>
      </div>

      <div className="mt-4">
        {!productos ? <Cargando filas={8} /> : visibles.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white">
            <Vacio icono={Package} titulo="Ningún insumo coincide" texto="Crea el insumo o cambia la búsqueda." />
          </div>
        ) : (
          <ul className="divide-y divide-gray-200 overflow-hidden rounded-2xl border border-gray-200 bg-white">
            {visibles.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => setEditando(p.id)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left transition-colors hover:bg-gray-50">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold text-espresso">{p.nombre}</span>
                    <span className="tabular flex flex-wrap items-center gap-x-2 text-[13px] text-gray-500">
                      <span>{p.codigo}</span>
                      {p.codigoBarras && <span className="inline-flex items-center gap-1"><Barcode size={13} aria-hidden="true" />{p.codigoBarras}</span>}
                      <span>{p.categoriaNombre}</span>
                      {p.proveedorNombre && <span>{p.proveedorNombre}</span>}
                    </span>
                  </span>
                  <span className="tabular text-right text-[13px] text-gray-600">
                    <span className="block font-bold text-espresso">{formatearCOP(p.precioCosto)} / {p.unidadMedida}</span>
                    pedir al llegar a {formatearCantidad(p.puntoReorden ?? p.stockMinimo, p.unidadMedida)}
                  </span>
                  {p.requiereCaducidad && <Chip tono="aviso">Perecedero</Chip>}
                  {p.activo === false && <Chip>Inactivo</Chip>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <FormularioInsumo
        abierto={editando !== undefined}
        productoId={editando ?? null}
        onCerrar={() => setEditando(undefined)}
        onGuardado={(msg) => { setEditando(undefined); mostrar(msg); cargar(); onCambio?.(); }}
      />
      {aviso}
    </div>
  );
}
