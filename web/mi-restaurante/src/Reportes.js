// Reportes de ventas: lo cobrado en mesa y domicilio por día, hora, método, canal, platillo y
// mesero. Los cálculos los hace la API (GET /reportes/ventas) en hora de Colombia, con el precio
// con que se vendió cada plato.
import React, { useCallback, useEffect, useState } from 'react';
import { BarChart3, Download } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import * as api from './services/api';
import { Boton, Cargando, Chip, useAviso, Vacio } from './components/inventario/ui';
import { pesos } from './utils/caja';
import { etiquetaImpuesto, impuestoIncluido } from './utils/impuestos';
import {
  COLOR_DOMICILIO, COLOR_MESA, csvReporte, diaCorto, etiquetaHora, horasVisibles, PERIODOS, porcentaje, rangoPeriodo, sinVentas,
} from './utils/reportes';

const ejeMiles = (v) => (v >= 1000000 ? `${Math.round(v / 100000) / 10} M` : v >= 1000 ? `${Math.round(v / 1000)} mil` : v);

function Globo({ active, payload, label, titulo }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((t, p) => t + (p.value || 0), 0);
  return (
    <div className="tabular rounded-xl bg-white px-3.5 py-2.5 text-[13px] shadow-lift ring-1 ring-gray-200">
      <p className="font-bold text-espresso">{titulo(label)}</p>
      {payload.length > 1 && payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-gray-600">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} aria-hidden="true" />
          {p.name}: {pesos(p.value)}
        </p>
      ))}
      <p className="font-semibold text-espresso">{pesos(total)}{payload[0]?.payload?.ventas != null ? ` · ${payload[0].payload.ventas} venta${payload[0].payload.ventas === 1 ? '' : 's'}` : ''}</p>
    </div>
  );
}

function Leyenda() {
  return (
    <div className="flex gap-4 text-[13px] text-gray-600" aria-hidden="true">
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLOR_MESA }} />Mesa</span>
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLOR_DOMICILIO }} />Domicilio</span>
    </div>
  );
}

function Bloque({ titulo, detalle, extra, children }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5" aria-label={titulo}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-extrabold tracking-[-0.01em] text-espresso">{titulo}</h2>
          {detalle && <p className="mt-0.5 text-[13px] text-gray-500">{detalle}</p>}
        </div>
        {extra}
      </div>
      {children}
    </section>
  );
}

/** Lista de barras horizontales en HTML: se lee mejor que una torta y no necesita leyenda. */
function Barras({ filas, total }) {
  const max = Math.max(...filas.map((f) => f.valor), 0);
  return (
    <ul className="space-y-3">
      {filas.map((f) => (
        <li key={f.nombre}>
          <div className="tabular mb-1 flex items-baseline justify-between gap-3 text-[14px]">
            <span className="font-semibold text-espresso">{f.nombre}{f.detalle && <span className="ml-1.5 font-medium text-gray-500">{f.detalle}</span>}</span>
            <span className="text-gray-600">{pesos(f.valor)} <span className="text-gray-400">· {porcentaje(f.valor, total)} %</span></span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full" style={{ width: `${max > 0 ? (f.valor / max) * 100 : 0}%`, background: f.color ?? COLOR_MESA }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Reportes() {
  const [periodo, setPeriodo] = useState('hoy');
  const [rango, setRango] = useState(() => rangoPeriodo('7dias'));
  const [reporte, setReporte] = useState(null);
  const [carta, setCarta] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [todosPlatillos, setTodosPlatillos] = useState(false);
  const [aviso, mostrar] = useAviso();

  const { desde, hasta } = periodo === 'rango' ? rango : rangoPeriodo(periodo);

  const cargar = useCallback(async () => {
    if (!desde || !hasta) return;
    setCargando(true);
    try {
      setReporte(await api.getReporteVentas(desde, hasta));
    } catch (e) {
      mostrar(e.message, 'error');
    } finally {
      setCargando(false);
    }
  }, [desde, hasta, mostrar]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { api.getPlatillos(true).then(setCarta).catch(() => setCarta([])); }, []);

  const exportar = () => {
    const url = URL.createObjectURL(new Blob(['﻿' + csvReporte(reporte)], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte_ventas_${reporte.desde}_${reporte.hasta}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const r = reporte;
  const variosDias = r && r.porDia.length > 1;
  const recaudado = r ? r.porMetodo.reduce((t, m) => t + m.total, 0) : 0;
  const totalCanales = r ? r.canales.reduce((t, c) => t + c.total, 0) : 0;
  const platillos = r ? (todosPlatillos ? r.platillos : r.platillos.slice(0, 10)) : [];
  const noVendidos = r ? sinVentas(carta, r.platillos) : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-[1280px] px-4 py-6 lg:px-6 lg:py-8">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.02em] text-espresso">Reportes</h1>
            <p className="mt-1 text-[15px] text-gray-500">Lo cobrado en mesa y domicilio, con el precio con que se vendió cada plato.</p>
          </div>
          {r && r.numeroVentas > 0 && (
            <Boton variante="secundario" onClick={exportar}><Download size={16} aria-hidden="true" />Exportar CSV</Boton>
          )}
        </header>

        <div className="mb-6 flex flex-wrap items-end gap-3">
          <div className="qp-rail flex max-w-full gap-1 overflow-x-auto rounded-full bg-white p-1 ring-1 ring-gray-200" role="group" aria-label="Periodo">
            {PERIODOS.map((p) => (
              <button
                key={p.id} type="button" onClick={() => setPeriodo(p.id)} aria-pressed={periodo === p.id}
                className={`h-9 shrink-0 rounded-full px-3.5 text-[14px] font-bold transition-colors ${periodo === p.id ? 'bg-espresso text-white' : 'text-gray-600 hover:text-espresso'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {periodo === 'rango' && (
            <div className="flex flex-wrap items-end gap-2">
              {['desde', 'hasta'].map((k) => (
                <label key={k} className="block">
                  <span className="mb-1 block text-[13px] font-semibold capitalize text-gray-600">{k}</span>
                  <input
                    type="date" value={rango[k]} max={k === 'desde' ? rango.hasta : undefined} min={k === 'hasta' ? rango.desde : undefined}
                    onChange={(e) => e.target.value && setRango((x) => ({ ...x, [k]: e.target.value }))}
                    className="h-10 rounded-xl border border-gray-300 bg-white px-3 text-[14px] text-espresso focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-100"
                  />
                </label>
              ))}
            </div>
          )}
          {cargando && r && <span className="text-[13px] text-gray-500" role="status">Actualizando…</span>}
        </div>

        {!r ? <Cargando filas={5} /> : r.numeroVentas === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white">
            <Vacio icono={BarChart3} titulo="No hay ventas en este periodo" texto="Los reportes cuentan lo cobrado: cuentas de mesa pagadas y domicilios entregados." />
          </div>
        ) : (
          <div className="space-y-6">
            <dl className="grid grid-cols-2 overflow-hidden rounded-2xl border border-gray-200 bg-white lg:grid-cols-5">
              <div className="col-span-2 border-b border-gray-200 p-5 lg:col-span-1 lg:border-b-0 lg:border-r">
                <dt className="text-[13px] font-semibold text-gray-500">Ventas</dt>
                <dd className="tabular mt-1 text-[28px] font-extrabold tracking-[-0.02em] text-espresso">{pesos(r.ventas)}</dd>
                <dd className="tabular text-[12px] text-gray-500">{etiquetaImpuesto()}: {pesos(impuestoIncluido(r.ventas))}</dd>
              </div>
              {[
                ['Cuentas y domicilios', r.numeroVentas, null],
                ['Ticket promedio', pesos(r.ticketPromedio), null],
                ['Propinas', pesos(r.propinas), 'Aparte de las ventas'],
                ['Anulados', r.pedidosAnulados, pesos(r.valorAnulado)],
              ].map(([t, v, d], i) => (
                <div key={t} className={`p-5 ${i % 2 === 0 ? 'border-r border-gray-200' : ''} ${i < 2 ? 'border-b border-gray-200 lg:border-b-0' : ''} lg:border-r lg:last:border-r-0`}>
                  <dt className="text-[13px] font-semibold text-gray-500">{t}</dt>
                  <dd className="tabular mt-1 text-[22px] font-extrabold text-espresso">{v}</dd>
                  {d && <dd className="tabular text-[12px] text-gray-500">{d}</dd>}
                </div>
              ))}
            </dl>

            {variosDias && (
              <Bloque titulo="Ventas por día" detalle="Platos vendidos, sin propinas ni envíos" extra={<Leyenda />}>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={r.porDia} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap="20%">
                      <CartesianGrid vertical={false} stroke="#E7E5E4" />
                      <XAxis dataKey="fecha" tickFormatter={diaCorto} tick={{ fontSize: 12, fill: '#57534E' }} axisLine={false} tickLine={false} minTickGap={12} />
                      <YAxis tickFormatter={ejeMiles} tick={{ fontSize: 12, fill: '#57534E' }} axisLine={false} tickLine={false} width={52} />
                      <Tooltip content={<Globo titulo={diaCorto} />} cursor={{ fill: '#F5F5F4' }} />
                      <Bar dataKey="mesa" name="Mesa" stackId="v" fill={COLOR_MESA} stroke="#fff" strokeWidth={2} maxBarSize={36} />
                      <Bar dataKey="domicilios" name="Domicilio" stackId="v" fill={COLOR_DOMICILIO} stroke="#fff" strokeWidth={2} radius={[4, 4, 0, 0]} maxBarSize={36} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Bloque>
            )}

            <Bloque titulo="Horas pico" detalle={variosDias ? 'Ventas sumadas por hora en todo el periodo' : 'Ventas por hora del día'}>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={horasVisibles(r.porHora)} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap="20%">
                    <CartesianGrid vertical={false} stroke="#E7E5E4" />
                    <XAxis dataKey="hora" tickFormatter={etiquetaHora} tick={{ fontSize: 12, fill: '#57534E' }} axisLine={false} tickLine={false} minTickGap={8} />
                    <YAxis tickFormatter={ejeMiles} tick={{ fontSize: 12, fill: '#57534E' }} axisLine={false} tickLine={false} width={52} />
                    <Tooltip content={<Globo titulo={etiquetaHora} />} cursor={{ fill: '#F5F5F4' }} />
                    <Bar dataKey="total" name="Ventas" fill={COLOR_MESA} radius={[4, 4, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Bloque>

            <div className="grid gap-6 lg:grid-cols-2">
              <Bloque titulo="Cómo pagaron" detalle="Incluye propinas y envíos: es lo que entró a caja">
                <Barras total={recaudado} filas={r.porMetodo.filter((m) => m.total > 0).map((m) => ({ nombre: m.metodo, detalle: `${m.cobros} cobro${m.cobros === 1 ? '' : 's'}`, valor: m.total }))} />
              </Bloque>
              <Bloque titulo="Por dónde llegaron los pedidos">
                <Barras total={totalCanales} filas={r.canales.map((c) => ({
                  nombre: c.canal, detalle: `${c.ventas} pedido${c.ventas === 1 ? '' : 's'}`, valor: c.total,
                  color: c.canal === 'Domicilio' ? COLOR_DOMICILIO : COLOR_MESA,
                }))} />
              </Bloque>
            </div>

            <Bloque
              titulo="Platillos más vendidos"
              detalle="Por unidades; los ingresos usan el precio con que se vendió"
              extra={r.platillos.length > 10 && (
                <Boton variante="fantasma" tamano="sm" onClick={() => setTodosPlatillos((v) => !v)}>
                  {todosPlatillos ? 'Ver los 10 primeros' : `Ver los ${r.platillos.length}`}
                </Boton>
              )}
            >
              <div className="-mx-4 overflow-x-auto sm:-mx-5">
                <table className="tabular w-full min-w-[520px] text-[14px]">
                  <thead>
                    <tr className="text-left text-[12px] font-bold text-gray-500">
                      <th className="px-4 py-2 sm:px-5">#</th>
                      <th className="px-2 py-2">Platillo</th>
                      <th className="px-2 py-2 text-right">Unidades</th>
                      <th className="px-2 py-2 text-right">Ingresos</th>
                      <th className="px-4 py-2 text-right sm:px-5">De las ventas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {platillos.map((p, i) => (
                      <tr key={p.platilloId}>
                        <td className="px-4 py-2.5 text-gray-500 sm:px-5">{i + 1}</td>
                        <td className="px-2 py-2.5"><span className="font-bold text-espresso">{p.nombre}</span>{p.categoria && <span className="ml-2 text-[13px] text-gray-500">{p.categoria}</span>}</td>
                        <td className="px-2 py-2.5 text-right font-bold text-espresso">{p.cantidad}</td>
                        <td className="px-2 py-2.5 text-right">{pesos(p.ingresos)}</td>
                        <td className="px-4 py-2.5 text-right text-gray-600 sm:px-5">{porcentaje(p.ingresos, r.ventas)} %</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {noVendidos.length > 0 && (
                <div className="mt-4 border-t border-gray-200 pt-3">
                  <p className="text-[13px] font-semibold text-gray-600">Sin ventas en el periodo ({noVendidos.length})</p>
                  <p className="mt-2 flex flex-wrap gap-1.5">{noVendidos.map((n) => <Chip key={n}>{n}</Chip>)}</p>
                </div>
              )}
            </Bloque>

            <Bloque titulo="Meseros" detalle="Pedidos tomados con la app; los del QR y los domicilios no cuentan aquí">
              {r.meseros.length === 0 ? (
                <p className="text-[14px] text-gray-500">Ningún mesero tomó pedidos cobrados en este periodo.</p>
              ) : (
                <div className="-mx-4 overflow-x-auto sm:-mx-5">
                  <table className="tabular w-full min-w-[480px] text-[14px]">
                    <thead>
                      <tr className="text-left text-[12px] font-bold text-gray-500">
                        <th className="px-4 py-2 sm:px-5">Mesero</th>
                        <th className="px-2 py-2 text-right">Pedidos</th>
                        <th className="px-2 py-2 text-right">Mesas</th>
                        <th className="px-2 py-2 text-right">Ventas</th>
                        <th className="px-4 py-2 text-right sm:px-5">Propinas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {r.meseros.map((m) => (
                        <tr key={m.usuarioId}>
                          <td className="px-4 py-2.5 font-bold text-espresso sm:px-5">{m.nombre}</td>
                          <td className="px-2 py-2.5 text-right">{m.pedidos}</td>
                          <td className="px-2 py-2.5 text-right">{m.mesas}</td>
                          <td className="px-2 py-2.5 text-right font-bold text-espresso">{pesos(m.ventas)}</td>
                          <td className="px-4 py-2.5 text-right sm:px-5">{pesos(m.propinas)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Bloque>
          </div>
        )}
      </main>
      {aviso}
    </div>
  );
}

export default Reportes;
