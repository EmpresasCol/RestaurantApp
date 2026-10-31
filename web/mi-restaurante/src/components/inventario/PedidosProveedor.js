// Pedidos a proveedores: el sistema sugiere qué pedir (lo que bajó de su nivel), el encargado
// ajusta, crea la orden y la envía por WhatsApp; luego la recibe escaneando.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, MessageCircle, PackageCheck, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { compras, getAlmacenes, getProveedores, mensajeError } from '../../services/inventarioApi';
import {
  enlaceWhatsApp, fechaISO, formatearCantidad, formatearCOP, formatearFecha, textoPedidoProveedor,
} from '../../utils/inventario';
import BuscadorInsumo from './BuscadorInsumo';
import { Boton, BotonConfirmar, Campo, Cargando, Chip, ChipEstado, Lista, Panel, Selector, useAviso, Vacio } from './ui';

const ESTADO_ORDEN = {
  Pendiente: { tono: 'neutro', texto: 'Por enviar' },
  Aprobada: { tono: 'info', texto: 'Enviada' },
  EnTransito: { tono: 'aviso', texto: 'Llegó una parte' },
  Recibida: { tono: 'ok', texto: 'Recibida' },
  Cancelada: { tono: 'neutro', texto: 'Cancelada' },
};
const abierta = (estado) => ['Pendiente', 'Aprobada', 'EnTransito'].includes(estado);

/** Abre WhatsApp con la orden completa (en cajas cuando la cantidad cuadra) y la marca como enviada. */
async function enviarPorWhatsApp(ordenId) {
  // La pestaña se abre antes de esperar a la API: si no, el navegador la bloquea como emergente.
  const ventana = window.open('', '_blank');
  try {
    const url = await textoYEnlace(ordenId);
    if (ventana) ventana.location.href = url;
    else window.location.href = url;
  } catch (e) {
    ventana?.close();
    throw e;
  }
}

async function textoYEnlace(ordenId) {
  const o = await compras.orden(ordenId);
  const lineas = o.detalles.map((d) => {
    const pres = d.presentaciones?.find((p) => p.factor > 1 && d.cantidad % p.factor === 0);
    return pres
      ? { insumo: d.insumo, presentacion: pres.nombre, paquetes: d.cantidad / pres.factor }
      : { insumo: d.insumo, cantidad: d.cantidad, unidad: d.unidadMedida };
  });
  const texto = textoPedidoProveedor({ numeroOrden: o.numeroOrden, proveedor: o.proveedor, fechaEntrega: o.fechaEntregaEstimada, lineas });
  if (o.estado === 'Pendiente') await compras.estadoOrden(o.id, 'Aprobada');
  return enlaceWhatsApp(o.proveedorTelefono, texto);
}

function GrupoSugerido({ grupo, proveedores, almacenId, onCreada, onAbrirInsumo, mostrar }) {
  const [incluidos, setIncluidos] = useState(() => Object.fromEntries(grupo.insumos.map((s) => [s.id, true])));
  const [cantidades, setCantidades] = useState(() =>
    Object.fromEntries(grupo.insumos.map((s) => [s.id, s.presentacion ? s.presentacion.paquetes : s.cantidad])));
  const [proveedorId, setProveedorId] = useState(grupo.proveedorId ? String(grupo.proveedorId) : '');
  const [entrega, setEntrega] = useState(fechaISO(1));
  const [creando, setCreando] = useState(false);

  const base = (s) => (s.presentacion ? Number(cantidades[s.id]) * s.presentacion.factor : Number(cantidades[s.id])) || 0;
  const elegidos = grupo.insumos.filter((s) => incluidos[s.id] && base(s) > 0);
  const total = elegidos.reduce((t, s) => t + base(s) * s.precioUnitario, 0);

  const crear = async () => {
    if (!proveedorId) return mostrar('Elige a qué proveedor se le pide', 'error');
    setCreando(true);
    try {
      const r = await compras.crearOrden({
        proveedorId: Number(proveedorId),
        almacenDestinoId: Number(almacenId),
        fechaEntregaEstimada: entrega || null,
        lineas: elegidos.map((s) => ({ productoId: s.id, cantidad: base(s), precioUnitario: s.precioUnitario })),
      });
      onCreada(r);
    } catch (e) {
      mostrar(mensajeError(e, 'No se pudo crear la orden'), 'error');
    } finally {
      setCreando(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
        <div>
          <h3 className="text-[17px] font-extrabold text-espresso">{grupo.proveedor}</h3>
          <p className="text-[13px] text-gray-500">{grupo.insumos.length} insumo{grupo.insumos.length === 1 ? '' : 's'} por pedir</p>
        </div>
        {!grupo.proveedorId && (
          <Selector value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} aria-label="Proveedor" className="w-56">
            <option value="">Elige proveedor</option>
            {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </Selector>
        )}
      </header>
      <ul className="divide-y divide-gray-200">
        {grupo.insumos.map((s) => (
          <li key={s.id} className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 ${incluidos[s.id] ? '' : 'opacity-60'}`}>
            <input
              type="checkbox"
              checked={!!incluidos[s.id]}
              onChange={(e) => setIncluidos((x) => ({ ...x, [s.id]: e.target.checked }))}
              className="h-5 w-5 shrink-0 rounded accent-espresso"
              aria-label={`Incluir ${s.nombre}`}
            />
            <button type="button" onClick={() => onAbrirInsumo(s.id)} className="min-w-0 flex-1 text-left">
              <span className="flex items-center gap-2">
                <span className="truncate text-[15px] font-bold text-espresso hover:underline">{s.nombre}</span>
                <ChipEstado estado={s.estado} />
              </span>
              <span className="tabular block text-[13px] text-gray-500">
                Hay {formatearCantidad(s.stock, s.unidadMedida)} · pedir al llegar a {formatearCantidad(s.puntoReorden, s.unidadMedida)}
                {s.pedido > 0 && ` · ${formatearCantidad(s.pedido, s.unidadMedida)} ya pedidos`}
              </span>
            </button>
            <label className="flex items-center gap-2">
              <input
                type="number" min="0" step={s.presentacion ? 1 : 'any'} inputMode="decimal"
                value={cantidades[s.id]}
                onChange={(e) => setCantidades((x) => ({ ...x, [s.id]: e.target.value }))}
                className="tabular h-10 w-20 rounded-xl border border-gray-300 bg-white px-2 text-right text-[15px] font-bold text-espresso focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-100"
                aria-label={`Cantidad de ${s.nombre}`}
              />
              <span className="w-28 text-[13px] leading-tight text-gray-600">
                {s.presentacion ? <>{s.presentacion.nombre}<span className="tabular block text-gray-500">= {formatearCantidad(base(s), s.unidadMedida)}</span></> : s.unidadMedida}
              </span>
            </label>
            <span className="tabular w-24 text-right text-[14px] font-bold text-espresso">{formatearCOP(base(s) * s.precioUnitario)}</span>
          </li>
        ))}
      </ul>
      <footer className="flex flex-wrap items-end justify-between gap-3 border-t border-gray-200 bg-gray-50 px-4 py-3">
        <Campo label="Entrega esperada" type="date" min={fechaISO()} value={entrega} onChange={(e) => setEntrega(e.target.value)} className="w-44" />
        <div className="flex items-center gap-4">
          <p className="tabular text-[18px] font-extrabold text-espresso">{formatearCOP(total)}</p>
          <Boton onClick={crear} disabled={creando || elegidos.length === 0}>
            <ShoppingCart size={18} aria-hidden="true" /> {creando ? 'Creando…' : 'Crear orden'}
          </Boton>
        </div>
      </footer>
    </section>
  );
}

function OrdenManual({ abierto, onCerrar, proveedores, insumos, almacenId, productoInicial, onCreada, mostrar }) {
  const [proveedorId, setProveedorId] = useState('');
  const [entrega, setEntrega] = useState(fechaISO(1));
  const [lineas, setLineas] = useState([]);
  const [creando, setCreando] = useState(false);

  const agregar = useCallback((i) => {
    setLineas((ls) => (ls.some((l) => l.id === i.id) ? ls : [...ls, { id: i.id, nombre: i.nombre, unidad: i.unidadMedida, cantidad: 1, precio: i.precioCosto ?? 0 }]));
    if (i.proveedorId) setProveedorId((p) => p || String(i.proveedorId));
  }, []);

  useEffect(() => {
    if (!abierto) return;
    setLineas([]);
    setProveedorId('');
    setEntrega(fechaISO(1));
    const i = insumos.find((x) => x.id === productoInicial);
    if (i) agregar(i);
  }, [abierto, productoInicial, insumos, agregar]);

  const total = lineas.reduce((t, l) => t + (Number(l.cantidad) || 0) * (Number(l.precio) || 0), 0);

  const crear = async () => {
    if (!proveedorId) return mostrar('Elige el proveedor', 'error');
    setCreando(true);
    try {
      const r = await compras.crearOrden({
        proveedorId: Number(proveedorId), almacenDestinoId: Number(almacenId), fechaEntregaEstimada: entrega || null,
        lineas: lineas.map((l) => ({ productoId: l.id, cantidad: Number(l.cantidad), precioUnitario: Number(l.precio) || 0 })),
      });
      onCreada(r);
    } catch (e) {
      mostrar(mensajeError(e, 'No se pudo crear la orden'), 'error');
    } finally {
      setCreando(false);
    }
  };

  return (
    <Panel
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Nueva orden de compra"
      subtitulo="Para pedidos que no salen de las sugerencias: un evento, una promoción o un proveedor nuevo."
      pie={
        <div className="flex items-center gap-3">
          <p className="tabular flex-1 text-[20px] font-extrabold text-espresso">{formatearCOP(total)}</p>
          <Boton tamano="lg" onClick={crear} disabled={creando || lineas.length === 0}>{creando ? 'Creando…' : 'Crear orden'}</Boton>
        </div>
      }
    >
      <div className="space-y-4 p-5">
        <div className="grid grid-cols-2 gap-3">
          <Selector label="Proveedor" value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
            <option value="">Elige proveedor</option>
            {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </Selector>
          <Campo label="Entrega esperada" type="date" min={fechaISO()} value={entrega} onChange={(e) => setEntrega(e.target.value)} />
        </div>
        <BuscadorInsumo insumos={insumos} onElegir={agregar} placeholder="Agregar insumo a la orden" />
        {lineas.length > 0 && (
          <Lista>
            {lineas.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
                <span className="min-w-0 flex-1 truncate text-[15px] font-bold text-espresso">{l.nombre}</span>
                <label className="flex items-center gap-1.5 text-[13px] text-gray-600">
                  <input type="number" min="0" step="any" value={l.cantidad} onChange={(e) => setLineas((ls) => ls.map((x) => (x.id === l.id ? { ...x, cantidad: e.target.value } : x)))} className="tabular h-10 w-20 rounded-xl border border-gray-300 px-2 text-right font-bold text-espresso" aria-label={`Cantidad de ${l.nombre}`} />
                  {l.unidad}
                </label>
                <label className="flex items-center gap-1.5 text-[13px] text-gray-600">
                  $<input type="number" min="0" step="any" value={l.precio} onChange={(e) => setLineas((ls) => ls.map((x) => (x.id === l.id ? { ...x, precio: e.target.value } : x)))} className="tabular h-10 w-24 rounded-xl border border-gray-300 px-2 text-right font-bold text-espresso" aria-label={`Precio por ${l.unidad} de ${l.nombre}`} />
                  /{l.unidad}
                </label>
                <button type="button" onClick={() => setLineas((ls) => ls.filter((x) => x.id !== l.id))} className="grid h-9 w-9 place-items-center rounded-full text-gray-500 hover:bg-red-50 hover:text-red-700" aria-label={`Quitar ${l.nombre}`}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </Lista>
        )}
      </div>
    </Panel>
  );
}

export default function PedidosProveedor({ onRecibirOrden, onAbrirInsumo, productoFoco, onFocoUsado, version }) {
  const [sugerencias, setSugerencias] = useState(null);
  const [ordenes, setOrdenes] = useState(null);
  const [proveedores, setProveedores] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [almacenId, setAlmacenId] = useState('');
  const [manual, setManual] = useState(false);
  const [recienCreada, setRecienCreada] = useState(null);
  const [verTodas, setVerTodas] = useState(false);
  const [aviso, mostrar] = useAviso();

  const cargar = useCallback(() => {
    compras.reposicion().then(setSugerencias).catch((e) => mostrar(mensajeError(e, 'No se pudieron cargar las sugerencias'), 'error'));
    compras.ordenes().then(setOrdenes).catch((e) => mostrar(mensajeError(e, 'No se pudieron cargar las órdenes'), 'error'));
  }, [mostrar]);

  useEffect(() => { cargar(); }, [cargar, version]);
  useEffect(() => {
    Promise.all([getProveedores(), compras.insumos(), getAlmacenes()])
      .then(([p, i, a]) => {
        setProveedores(p.filter((x) => x.activo !== false));
        setInsumos(i);
        const activos = a.filter((x) => x.activo !== false);
        setAlmacenId(String((activos.find((x) => x.tipo === 'Principal') ?? activos[0])?.id ?? ''));
      })
      .catch(() => {});
  }, []);

  // "Pedir" desde la ficha de un insumo que no aparece en las sugerencias abre una orden manual con él.
  useEffect(() => {
    if (!productoFoco || !sugerencias) return;
    const sugerido = sugerencias.some((g) => g.insumos.some((s) => s.id === productoFoco));
    if (!sugerido) setManual(true);
    else onFocoUsado?.();
  }, [productoFoco, sugerencias, onFocoUsado]);

  const alCrear = (r) => {
    setManual(false);
    onFocoUsado?.();
    setRecienCreada(r);
    cargar();
  };

  const enviar = async (id) => {
    try {
      await enviarPorWhatsApp(id);
      cargar();
    } catch (e) {
      mostrar(mensajeError(e, 'No se pudo preparar el mensaje'), 'error');
    }
  };

  const cancelar = async (o) => {
    try {
      await compras.estadoOrden(o.id, 'Cancelada');
      mostrar(`Orden ${o.numeroOrden} cancelada`);
      cargar();
    } catch (e) {
      mostrar(mensajeError(e, 'No se pudo cancelar'), 'error');
    }
  };

  const ordenesVisibles = useMemo(() => (ordenes ?? []).filter((o) => verTodas || abierta(o.estado)), [ordenes, verTodas]);

  return (
    <div className="space-y-8">
      {recienCreada && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-green-200 bg-green-50 px-4 py-3">
          <CheckCircle2 size={22} className="shrink-0 text-green-700" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-[14px] text-green-800">
            Orden <span className="tabular font-bold">{recienCreada.numeroOrden}</span> creada por {formatearCOP(recienCreada.total)}. Envíala al proveedor.
          </p>
          <Boton onClick={() => { enviar(recienCreada.id); setRecienCreada(null); }}><MessageCircle size={18} aria-hidden="true" /> Enviar por WhatsApp</Boton>
          <Boton variante="fantasma" onClick={() => setRecienCreada(null)}>Después</Boton>
        </div>
      )}

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[20px] font-extrabold tracking-[-0.02em] text-espresso">Qué pedir</h2>
            <p className="text-[13px] text-gray-500">Insumos que llegaron a su nivel de pedido, menos lo que ya está pedido. Se completa hasta el nivel “llenar hasta”.</p>
          </div>
          <Boton variante="secundario" onClick={() => setManual(true)}><Plus size={18} aria-hidden="true" /> Orden manual</Boton>
        </div>
        {!sugerencias ? <Cargando /> : sugerencias.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white">
            <Vacio icono={CheckCircle2} titulo="No hay nada por pedir" texto="Ningún insumo está bajo su nivel de pedido. Ajusta los niveles en la ficha de cada insumo." />
          </div>
        ) : (
          <div className="space-y-4">
            {sugerencias.map((g) => (
              <GrupoSugerido
                key={`${g.proveedorId ?? 'sin'}-${g.insumos.map((s) => s.id).join('.')}`}
                grupo={g}
                proveedores={proveedores}
                almacenId={almacenId}
                onCreada={alCrear}
                onAbrirInsumo={onAbrirInsumo}
                mostrar={mostrar}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-[20px] font-extrabold tracking-[-0.02em] text-espresso">Órdenes</h2>
          <label className="flex items-center gap-2 text-[14px] font-semibold text-espresso">
            <input type="checkbox" checked={verTodas} onChange={(e) => setVerTodas(e.target.checked)} className="h-5 w-5 rounded accent-espresso" />
            Ver también recibidas y canceladas
          </label>
        </div>
        {!ordenes ? <Cargando filas={3} /> : ordenesVisibles.length === 0 ? (
          <p className="rounded-2xl border border-gray-200 bg-white px-4 py-5 text-[14px] text-gray-500">No hay órdenes abiertas.</p>
        ) : (
          <Lista>
            {ordenesVisibles.map((o) => {
              const e = ESTADO_ORDEN[o.estado] ?? { tono: 'neutro', texto: o.estado };
              const avance = o.pedido > 0 ? Math.min(100, Math.round((o.recibido / o.pedido) * 100)) : 0;
              return (
                <div key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="tabular text-[15px] font-extrabold text-espresso">{o.numeroOrden}</span>
                      <span className="text-[15px] font-semibold text-espresso">{o.proveedor}</span>
                      <Chip tono={e.tono}>{e.texto}</Chip>
                    </p>
                    <p className="tabular text-[13px] text-gray-500">
                      {o.items} insumo{o.items === 1 ? '' : 's'} · pedida {formatearFecha(o.fechaOrden)}
                      {o.fechaEntregaEstimada && ` · llega ${formatearFecha(o.fechaEntregaEstimada)}`}
                      {o.estado === 'EnTransito' && ` · ${avance} % recibido`}
                    </p>
                  </div>
                  <span className="tabular text-[15px] font-bold text-espresso">{formatearCOP(o.total)}</span>
                  {abierta(o.estado) && (
                    <div className="flex flex-wrap gap-2">
                      {o.estado === 'Pendiente' && <Boton variante="secundario" tamano="sm" onClick={() => enviar(o.id)}><MessageCircle size={15} aria-hidden="true" /> Enviar</Boton>}
                      {o.estado !== 'Pendiente' && <Boton variante="secundario" tamano="sm" onClick={() => enviar(o.id)}><MessageCircle size={15} aria-hidden="true" /> Reenviar</Boton>}
                      <Boton tamano="sm" onClick={() => onRecibirOrden(o.id)}><PackageCheck size={15} aria-hidden="true" /> Recibir</Boton>
                      <BotonConfirmar onConfirmar={() => cancelar(o)}>Cancelar</BotonConfirmar>
                    </div>
                  )}
                </div>
              );
            })}
          </Lista>
        )}
      </section>

      <OrdenManual
        abierto={manual}
        onCerrar={() => { setManual(false); onFocoUsado?.(); }}
        proveedores={proveedores}
        insumos={insumos}
        almacenId={almacenId}
        productoInicial={productoFoco}
        onCreada={alCrear}
        mostrar={mostrar}
      />
      {aviso}
    </div>
  );
}

