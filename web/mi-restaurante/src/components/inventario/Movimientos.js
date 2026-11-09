// Kárdex: todo lo que entró, salió, se perdió, se ajustó o se trasladó, agrupado por día.
import React, { useEffect, useMemo, useState } from 'react';
import { History, Plus, Search } from 'lucide-react';
import { compras, getAlmacenes, getMovimientos, mensajeError } from '../../services/inventarioApi';
import { fechaISO, formatearCantidad, formatearCOP, signoMovimiento } from '../../utils/inventario';
import RegistrarMovimiento from './RegistrarMovimiento';
import { Boton, Cargando, Chip, Selector, useAviso, Vacio } from './ui';

const RANGOS = [
  { id: 'hoy', label: 'Hoy', dias: 0 },
  { id: '7', label: '7 días', dias: 7 },
  { id: '30', label: '30 días', dias: 30 },
  { id: 'todo', label: 'Todo', dias: null },
];

const TIPOS = {
  Entrada: { tono: 'ok', texto: 'Entrada' },
  Salida: { tono: 'neutro', texto: 'Salida' },
  Merma: { tono: 'peligro', texto: 'Merma' },
  Ajuste: { tono: 'info', texto: 'Ajuste' },
  Transferencia: { tono: 'info', texto: 'Traslado' },
};

const normalizar = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const dia = (iso) => new Date(iso).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });

export default function Movimientos({ onAbrirInsumo, onCambio, version }) {
  const [rango, setRango] = useState('7');
  const [tipo, setTipo] = useState('');
  const [almacenId, setAlmacenId] = useState('');
  const [q, setQ] = useState('');
  const [movs, setMovs] = useState(null);
  const [almacenes, setAlmacenes] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [registrando, setRegistrando] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [aviso, mostrar] = useAviso();

  useEffect(() => {
    getAlmacenes().then(setAlmacenes).catch(() => {});
    compras.insumos().then(setInsumos).catch(() => {});
  }, []);

  useEffect(() => {
    const dias = RANGOS.find((r) => r.id === rango)?.dias;
    setMovs(null);
    getMovimientos({
      desde: dias == null ? undefined : fechaISO(-dias),
      tipo: tipo || undefined,
      almacenId: almacenId || undefined,
    })
      .then(setMovs)
      .catch((e) => { setMovs([]); mostrar(mensajeError(e, 'No se pudieron cargar los movimientos'), 'error'); });
  }, [rango, tipo, almacenId, version, recarga, mostrar]);

  const visibles = useMemo(() => {
    const t = normalizar(q.trim());
    return (movs ?? []).filter((m) => !t || normalizar(m.productoNombre).includes(t) || normalizar(m.motivo).includes(t) || normalizar(m.referencia).includes(t));
  }, [movs, q]);

  const porDia = useMemo(() => {
    const grupos = new Map();
    visibles.forEach((m) => {
      const k = new Date(m.fecha).toDateString();
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k).push(m);
    });
    return [...grupos.values()];
  }, [visibles]);

  const totales = useMemo(() => visibles.reduce((t, m) => {
    const v = Number(m.costoTotal ?? m.cantidad * (m.costoUnitario ?? 0)) || 0;
    if (m.tipoMovimiento === 'Entrada') t.entradas += v;
    if (m.tipoMovimiento === 'Merma') t.mermas += v;
    return t;
  }, { entradas: 0, mermas: 0 }), [visibles]);

  return (
    <div>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="qp-rail -mx-1 flex gap-1 overflow-x-auto px-1" role="group" aria-label="Periodo">
          {RANGOS.map((r) => (
            <button
              key={r.id}
              type="button"
              aria-pressed={rango === r.id}
              onClick={() => setRango(r.id)}
              className={`h-10 shrink-0 rounded-full px-4 text-[14px] font-bold transition-colors ${rango === r.id ? 'bg-espresso text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-espresso'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="flex flex-1 flex-wrap gap-2 xl:justify-end">
          <label className="relative min-w-[200px] flex-1 xl:max-w-xs">
            <span className="sr-only">Buscar</span>
            <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" aria-hidden="true" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Insumo, motivo o factura"
              className="h-11 w-full rounded-xl border border-gray-300 bg-white pl-10 pr-3.5 text-[15px] text-espresso placeholder:text-gray-500 focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-100"
            />
          </label>
          <Selector value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo" className="w-36">
            <option value="">Todos</option>
            {Object.entries(TIPOS).map(([id, t]) => <option key={id} value={id}>{t.texto}</option>)}
          </Selector>
          <Selector value={almacenId} onChange={(e) => setAlmacenId(e.target.value)} aria-label="Almacén" className="w-44">
            <option value="">Todos los almacenes</option>
            {almacenes.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </Selector>
          <Boton onClick={() => setRegistrando(true)} className="h-11"><Plus size={18} aria-hidden="true" /> Registrar</Boton>
        </div>
      </div>

      {movs && movs.length > 0 && (
        <p className="mt-3 text-[13px] text-gray-600">
          <span className="tabular font-bold text-espresso">{visibles.length}</span> movimientos · compras <span className="tabular font-bold text-espresso">{formatearCOP(totales.entradas)}</span>
          {totales.mermas > 0 && <> · pérdidas por merma <span className="tabular font-bold text-red-700">{formatearCOP(totales.mermas)}</span></>}
          {movs.length === 500 && ' · se muestran los 500 más recientes'}
        </p>
      )}

      <div className="mt-4">
        {!movs ? <Cargando filas={6} /> : visibles.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white">
            <Vacio icono={History} titulo="Sin movimientos en este periodo" texto="Prueba con un periodo más largo o quita los filtros." />
          </div>
        ) : (
          <div className="space-y-5">
            {porDia.map((grupo) => (
              <section key={grupo[0].fecha} aria-label={dia(grupo[0].fecha)}>
                <h3 className="mb-2 text-[14px] font-extrabold text-espresso first-letter:uppercase">{dia(grupo[0].fecha)}</h3>
                <ul className="divide-y divide-gray-200 overflow-hidden rounded-2xl border border-gray-200 bg-white">
                  {grupo.map((m) => {
                    const t = TIPOS[m.tipoMovimiento] ?? { tono: 'neutro', texto: m.tipoMovimiento };
                    const signo = signoMovimiento(m);
                    return (
                      <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                        <span className="tabular w-12 shrink-0 text-[13px] text-gray-500">
                          {new Date(m.fecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })}
                        </span>
                        <Chip tono={t.tono} className="w-[74px] justify-center">{t.texto}</Chip>
                        <button type="button" onClick={() => onAbrirInsumo(m.productoId)} className="min-w-0 flex-1 text-left">
                          <span className="block truncate text-[15px] font-bold text-espresso hover:underline">{m.productoNombre}</span>
                          <span className="block truncate text-[13px] text-gray-500">
                            {[m.motivo || m.referencia, m.almacenNombre, m.usuarioNombre].filter(Boolean).join(' · ')}
                          </span>
                        </button>
                        <span className={`tabular w-28 text-right text-[15px] font-extrabold ${signo === '+' ? 'text-green-700' : signo === '−' ? 'text-espresso' : 'text-purple-700'}`}>
                          {signo}{formatearCantidad(m.cantidad, m.unidadMedida)}
                        </span>
                        <span className="tabular hidden w-24 text-right text-[13px] text-gray-500 sm:block">
                          {m.costoUnitario ? formatearCOP(m.cantidad * m.costoUnitario) : ''}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      <RegistrarMovimiento
        abierto={registrando}
        onCerrar={() => setRegistrando(false)}
        insumos={insumos}
        onHecho={(msg) => { setRegistrando(false); mostrar(msg); setRecarga((r) => r + 1); onCambio?.(); }}
      />
      {aviso}
    </div>
  );
}
