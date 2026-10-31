// Toma física: el encargado cuenta lo que hay en un almacén (a mano o escaneando cajas)
// y el sistema ajusta solo las diferencias.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardCheck, Search } from 'lucide-react';
import { compras, getAlmacenes, getStockPorAlmacen, mensajeError } from '../../services/inventarioApi';
import { formatearCantidad, formatearCOP } from '../../utils/inventario';
import EscanerCodigo from './EscanerCodigo';
import { Boton, Cargando, Selector, useAviso } from './ui';

const normalizar = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function ConteoFisico({ onAbrirInsumo, onCambio }) {
  const [almacenes, setAlmacenes] = useState([]);
  const [almacenId, setAlmacenId] = useState('');
  const [filas, setFilas] = useState(null);
  const [contado, setContado] = useState({});
  const [q, setQ] = useState('');
  const [soloDiferencias, setSoloDiferencias] = useState(false);
  const [resaltado, setResaltado] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [aviso, mostrar] = useAviso();
  const refs = useRef({});

  useEffect(() => {
    getAlmacenes()
      .then((a) => {
        const activos = a.filter((x) => x.activo !== false);
        setAlmacenes(activos);
        setAlmacenId(String((activos.find((x) => x.tipo === 'Principal') ?? activos[0])?.id ?? ''));
      })
      .catch((e) => mostrar(mensajeError(e, 'No se pudieron cargar los almacenes'), 'error'));
  }, [mostrar]);

  useEffect(() => {
    if (!almacenId) return;
    setFilas(null);
    setContado({});
    setResultado(null);
    Promise.all([compras.insumos(), getStockPorAlmacen(almacenId)])
      .then(([insumos, stock]) => {
        const porProducto = Object.fromEntries(stock.map((s) => [s.productoId, s.cantidad]));
        setFilas(insumos.map((i) => ({ ...i, sistema: porProducto[i.id] ?? 0 })));
      })
      .catch((e) => mostrar(mensajeError(e, 'No se pudo cargar el inventario'), 'error'));
  }, [almacenId, mostrar]);

  useEffect(() => {
    if (!resaltado) return undefined;
    const t = setTimeout(() => setResaltado(null), 1200);
    return () => clearTimeout(t);
  }, [resaltado]);

  const diferencia = (f) => (contado[f.id] === undefined || contado[f.id] === '' ? null : Number(contado[f.id]) - f.sistema);

  const visibles = useMemo(() => {
    const t = normalizar(q.trim());
    return (filas ?? []).filter((f) =>
      (!t || normalizar(f.nombre).includes(t) || normalizar(f.codigo).includes(t)) &&
      (!soloDiferencias || (diferencia(f) ?? 0) !== 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filas, q, soloDiferencias, contado]);

  const contados = Object.values(contado).filter((v) => v !== '' && v !== undefined).length;

  // Escanear una caja suma su contenido al conteo de ese insumo.
  const alEscanear = async (codigo) => {
    try {
      const r = await compras.resolverCodigo(codigo);
      const factor = r.presentacion?.factor ?? 1;
      setContado((c) => ({ ...c, [r.insumo.id]: Number(c[r.insumo.id] || 0) + factor }));
      setQ('');
      setResaltado(r.insumo.id);
      setTimeout(() => refs.current[r.insumo.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
    } catch (e) {
      mostrar(e.response?.status === 404 ? `El código ${codigo} no está asociado a ningún insumo` : mensajeError(e), 'error');
    }
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      const lineas = Object.entries(contado)
        .filter(([, v]) => v !== '' && v !== undefined)
        .map(([productoId, v]) => ({ productoId: Number(productoId), cantidadContada: Number(v) }));
      const r = await compras.conteo({ almacenId: Number(almacenId), lineas });
      setResultado(r);
      mostrar(r.message);
      setContado({});
      const stock = await getStockPorAlmacen(almacenId);
      const porProducto = Object.fromEntries(stock.map((s) => [s.productoId, s.cantidad]));
      setFilas((fs) => fs.map((f) => ({ ...f, sistema: porProducto[f.id] ?? 0 })));
      onCambio?.();
    } catch (e) {
      mostrar(mensajeError(e, 'No se pudo guardar el conteo'), 'error');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl pb-32">
      <section className="grid gap-3 rounded-2xl border border-gray-200 bg-white p-4 sm:grid-cols-[220px_1fr] sm:p-5">
        <Selector label="Almacén que cuentas" value={almacenId} onChange={(e) => setAlmacenId(e.target.value)}>
          {almacenes.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
        </Selector>
        <div>
          <span className="mb-1.5 block text-[13px] font-semibold text-gray-600">Contar escaneando (cada caja suma su contenido)</span>
          <EscanerCodigo onCodigo={alEscanear} autoFocus={false} />
        </div>
      </section>

      {resultado && resultado.diferencias.length > 0 && (
        <section className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
          <h2 className="text-[16px] font-extrabold text-espresso">Ajustes registrados</h2>
          <p className="text-[13px] text-gray-500">
            Diferencia valorizada: <span className={`tabular font-bold ${resultado.valor < 0 ? 'text-red-700' : 'text-espresso'}`}>{formatearCOP(resultado.valor)}</span>
          </p>
          <ul className="mt-2 divide-y divide-gray-200 text-[14px]">
            {resultado.diferencias.map((d) => (
              <li key={d.productoId} className="tabular flex justify-between py-2">
                <span className="font-semibold text-espresso">{d.insumo}</span>
                <span className={d.diferencia < 0 ? 'font-bold text-red-700' : 'font-bold text-green-700'}>{d.diferencia > 0 ? '+' : ''}{formatearCantidad(d.diferencia)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="relative flex-1">
          <span className="sr-only">Buscar insumo</span>
          <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" aria-hidden="true" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar insumo"
            className="h-11 w-full rounded-xl border border-gray-300 bg-white pl-10 pr-3.5 text-[15px] text-espresso placeholder:text-gray-500 focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-100"
          />
        </label>
        <label className="flex h-11 items-center gap-2 text-[14px] font-semibold text-espresso">
          <input type="checkbox" checked={soloDiferencias} onChange={(e) => setSoloDiferencias(e.target.checked)} className="h-5 w-5 rounded accent-espresso" />
          Solo con diferencia
        </label>
      </div>

      <div className="mt-3">
        {!filas ? <Cargando filas={8} /> : (
          <ul className="divide-y divide-gray-200 overflow-hidden rounded-2xl border border-gray-200 bg-white">
            {visibles.map((f) => {
              const d = diferencia(f);
              return (
                <li
                  key={f.id}
                  ref={(el) => { refs.current[f.id] = el; }}
                  className={`flex items-center gap-3 px-4 py-3 transition-colors duration-700 ${resaltado === f.id ? 'bg-orange-50' : ''}`}
                >
                  <button type="button" onClick={() => onAbrirInsumo(f.id)} className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-[15px] font-bold text-espresso hover:underline">{f.nombre}</span>
                    <span className="tabular block text-[13px] text-gray-500">Sistema: {formatearCantidad(f.sistema, f.unidadMedida)}</span>
                  </button>
                  <span className={`tabular w-20 text-right text-[14px] font-bold ${d == null || d === 0 ? 'text-gray-400' : d < 0 ? 'text-red-700' : 'text-green-700'}`}>
                    {d == null ? '' : d === 0 ? 'Cuadra' : `${d > 0 ? '+' : ''}${formatearCantidad(d)}`}
                  </span>
                  <input
                    type="number" min="0" step="any" inputMode="decimal"
                    value={contado[f.id] ?? ''}
                    onChange={(e) => setContado((c) => ({ ...c, [f.id]: e.target.value }))}
                    placeholder="Contado"
                    aria-label={`Cantidad contada de ${f.nombre} en ${f.unidadMedida}`}
                    className="tabular h-11 w-28 rounded-xl border border-gray-300 bg-white px-3 text-right text-[15px] font-bold text-espresso placeholder:font-medium placeholder:text-gray-500 focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-100"
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {contados > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <div className="mx-auto flex max-w-4xl items-center gap-4">
            <p className="flex-1 text-[14px] text-gray-600"><span className="tabular font-bold text-espresso">{contados}</span> insumo{contados === 1 ? '' : 's'} contado{contados === 1 ? '' : 's'}. Los demás no cambian.</p>
            <Boton tamano="lg" onClick={guardar} disabled={guardando}>
              <ClipboardCheck size={20} aria-hidden="true" /> {guardando ? 'Guardando…' : 'Guardar conteo'}
            </Boton>
          </div>
        </div>
      )}
      {aviso}
    </div>
  );
}
