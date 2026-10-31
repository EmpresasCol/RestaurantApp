// Recibir mercancía: escanear (o buscar) lo que llegó, poner cantidad, precio y vencimiento,
// y registrar todo en una sola entrada. Puede venir de una orden de compra o ser compra directa.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CalendarClock, Minus, PackageCheck, Plus, Trash2, Truck, X } from 'lucide-react';
import { compras, getAlmacenes, getProveedores, mensajeError } from '../../services/inventarioApi';
import { fechaISO, formatearCantidad, formatearCOP } from '../../utils/inventario';
import AsociarCodigo from './AsociarCodigo';
import BuscadorInsumo from './BuscadorInsumo';
import EscanerCodigo from './EscanerCodigo';
import FormularioInsumo from './FormularioInsumo';
import { Boton, Campo, Chip, ease, Selector, useAviso, Vacio } from './ui';

let secuencia = 0;
const clave = () => `l${++secuencia}`;

const almacenPorDefecto = (almacenes) =>
  (almacenes.find((a) => a.tipo === 'Principal') ?? almacenes.find((a) => a.tipo === 'Cocina') ?? almacenes[0])?.id ?? '';

export default function RecibirMercancia({ ordenId = null, productoInicial = null, onSalirDeOrden, onAbrirInsumo, onListo }) {
  const [almacenes, setAlmacenes] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [almacenId, setAlmacenId] = useState('');
  const [proveedorId, setProveedorId] = useState('');
  const [documento, setDocumento] = useState('');
  const [orden, setOrden] = useState(null);
  const [lineas, setLineas] = useState([]);
  const [resaltada, setResaltada] = useState(null);
  const [codigoNuevo, setCodigoNuevo] = useState(null);
  const [creandoConCodigo, setCreandoConCodigo] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [aviso, mostrar] = useAviso();
  const productoUsado = useRef(null);

  useEffect(() => {
    Promise.all([getAlmacenes(), getProveedores(), compras.insumos()])
      .then(([a, p, i]) => {
        const activos = a.filter((x) => x.activo !== false);
        setAlmacenes(activos);
        setProveedores(p.filter((x) => x.activo !== false));
        setInsumos(i);
        setAlmacenId((actual) => actual || almacenPorDefecto(activos));
      })
      .catch((e) => mostrar(mensajeError(e, 'No se pudieron cargar los datos'), 'error'));
  }, [mostrar]);

  // Recibir contra una orden: precarga lo pendiente de cada insumo.
  useEffect(() => {
    if (!ordenId) { setOrden(null); return; }
    compras.orden(ordenId)
      .then((o) => {
        setOrden(o);
        setProveedorId(String(o.proveedorId));
        setAlmacenId(o.almacenDestinoId);
        setLineas(o.detalles.filter((d) => d.pendiente > 0).map((d) => {
          const pres = d.presentaciones?.find((p) => p.factor > 1 && d.pendiente % p.factor === 0);
          return {
            key: clave(),
            productoId: d.productoId,
            insumo: d.insumo,
            unidad: d.unidadMedida,
            presentacion: pres ? { id: pres.id, nombre: pres.nombre, factor: pres.factor } : null,
            cantidad: pres ? d.pendiente / pres.factor : d.pendiente,
            costo: pres ? d.precioUnitario * pres.factor : d.precioUnitario,
            fechaVencimiento: '',
            requiereCaducidad: d.requiereCaducidad,
            numeroLote: '',
          };
        }));
      })
      .catch((e) => mostrar(mensajeError(e, 'No se pudo abrir la orden'), 'error'));
  }, [ordenId, mostrar]);

  const agregar = useCallback((nueva) => {
    setLineas((actual) => {
      const igual = actual.find((l) => l.productoId === nueva.productoId && (l.presentacion?.id ?? null) === (nueva.presentacion?.id ?? null));
      if (igual) {
        setResaltada(igual.key);
        return actual.map((l) => (l === igual ? { ...l, cantidad: Number(l.cantidad) + 1 } : l));
      }
      setResaltada(nueva.key);
      return [nueva, ...actual];
    });
  }, []);

  const lineaDesdeInsumo = (insumo, presentacion = null, vencimientoSugerido = null) => ({
    key: clave(),
    productoId: insumo.id,
    insumo: insumo.nombre,
    unidad: insumo.unidadMedida,
    presentacion: presentacion ? { id: presentacion.id, nombre: presentacion.nombre, factor: presentacion.factor } : null,
    cantidad: 1,
    costo: presentacion?.costoReferencia ?? Math.round((insumo.precioCosto ?? 0) * (presentacion?.factor ?? 1)),
    fechaVencimiento: vencimientoSugerido ? String(vencimientoSugerido).slice(0, 10) : '',
    requiereCaducidad: insumo.requiereCaducidad,
    numeroLote: '',
  });

  // Atajo desde la ficha de un insumo: "Recibir" lo deja listo en la lista.
  useEffect(() => {
    if (!productoInicial || !insumos.length || productoUsado.current === productoInicial) return;
    const insumo = insumos.find((i) => i.id === productoInicial);
    if (insumo) {
      productoUsado.current = productoInicial;
      agregar(lineaDesdeInsumo(insumo));
    }
  }, [productoInicial, insumos, agregar]);

  const alEscanear = async (codigo) => {
    setBuscando(true);
    try {
      const r = await compras.resolverCodigo(codigo);
      if (!r.insumo.activo) mostrar(`${r.insumo.nombre} está desactivado`, 'error');
      agregar(lineaDesdeInsumo(r.insumo, r.presentacion, r.vencimientoSugerido));
    } catch (e) {
      if (e.response?.status === 404) setCodigoNuevo(codigo);
      else mostrar(mensajeError(e, 'No se pudo leer el código'), 'error');
    } finally {
      setBuscando(false);
    }
  };

  // El resaltado marca la línea recién escaneada y se apaga solo.
  useEffect(() => {
    if (!resaltada) return undefined;
    const t = setTimeout(() => setResaltada(null), 1200);
    return () => clearTimeout(t);
  }, [resaltada, lineas]);

  const cambiar = (key, campo, valor) => setLineas((ls) => ls.map((l) => (l.key === key ? { ...l, [campo]: valor } : l)));
  const quitar = (key) => setLineas((ls) => ls.filter((l) => l.key !== key));

  const total = useMemo(() => lineas.reduce((s, l) => s + (Number(l.cantidad) || 0) * (Number(l.costo) || 0), 0), [lineas]);
  const faltaFecha = lineas.some((l) => l.requiereCaducidad && !l.fechaVencimiento);

  const registrar = async () => {
    if (!almacenId) return mostrar('Elige el almacén donde se guarda', 'error');
    setGuardando(true);
    try {
      const r = await compras.recibir({
        almacenId: Number(almacenId),
        proveedorId: proveedorId ? Number(proveedorId) : null,
        ordenCompraId: orden?.id ?? null,
        documento: documento.trim() || null,
        lineas: lineas.map((l) => ({
          productoId: l.productoId,
          presentacionId: l.presentacion?.id ?? null,
          cantidad: Number(l.cantidad),
          costoUnitario: l.costo === '' ? null : Number(l.costo),
          fechaVencimiento: l.fechaVencimiento || null,
          numeroLote: l.numeroLote.trim() || null,
        })),
      });
      mostrar(r.ordenEstado === 'Recibida' ? `${r.message}. Orden completa.` : r.message);
      setLineas([]);
      setDocumento('');
      compras.insumos().then(setInsumos).catch(() => {});
      onListo?.();
      if (orden) onSalirDeOrden?.();
    } catch (e) {
      mostrar(mensajeError(e, 'No se pudo registrar la entrada'), 'error');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl pb-40">
      {orden && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-purple-200 bg-purple-50 px-4 py-3">
          <Truck size={20} className="shrink-0 text-purple-700" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-[14px] text-purple-800">
            Recibiendo la orden <span className="tabular font-bold">{orden.numeroOrden}</span> de <span className="font-bold">{orden.proveedor}</span>. Ajusta lo que realmente llegó.
          </p>
          <button type="button" onClick={onSalirDeOrden} className="grid h-9 w-9 place-items-center rounded-full text-purple-700 hover:bg-purple-100" aria-label="Recibir sin orden">
            <X size={18} />
          </button>
        </div>
      )}

      <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
        <h2 className="text-[20px] font-extrabold tracking-[-0.02em] text-espresso">Escanea lo que llegó</h2>
        <p className="mt-0.5 text-[14px] text-gray-500">Con la cámara del celular o con el lector de mano (escribe el código y presiona Enter). Escanear dos veces la misma caja suma una más.</p>
        <div className="mt-4">
          <EscanerCodigo onCodigo={alEscanear} ocupado={buscando} />
        </div>
        <div className="mt-3">
          <BuscadorInsumo insumos={insumos} onElegir={(i) => agregar(lineaDesdeInsumo(i))} placeholder="¿Sin código? Busca el insumo por nombre" />
        </div>
      </section>

      <section className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Selector label="Se guarda en" value={almacenId} onChange={(e) => setAlmacenId(e.target.value)}>
          {almacenes.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
        </Selector>
        <Selector label="Proveedor" value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} disabled={!!orden}>
          <option value="">Compra directa</option>
          {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </Selector>
        <Campo label="Factura o remisión" value={documento} onChange={(e) => setDocumento(e.target.value)} placeholder="Opcional" />
      </section>

      <section className="mt-5" aria-label="Insumos recibidos">
        {lineas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white">
            <Vacio icono={PackageCheck} titulo="Aún no hay nada en la entrada" texto="Escanea el primer producto o búscalo por nombre. Cada uno aparece aquí para revisar cantidad, precio y vencimiento." />
          </div>
        ) : (
          <ul className="space-y-3">
            <AnimatePresence initial={false}>
              {lineas.map((l) => (
                <motion.li
                  key={l.key}
                  layout
                  initial={{ opacity: 0, y: -12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.35, ease }}
                  className={`rounded-2xl border bg-white p-4 transition-colors duration-700 ${resaltada === l.key ? 'border-orange-400 bg-orange-50' : 'border-gray-200'}`}
                >
                  <div className="flex items-start gap-3">
                    <button type="button" onClick={() => onAbrirInsumo?.(l.productoId)} className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-[16px] font-bold text-espresso hover:underline">{l.insumo}</span>
                      <span className="tabular block text-[13px] text-gray-500">
                        {l.presentacion
                          ? `${l.presentacion.nombre} · ${formatearCantidad((Number(l.cantidad) || 0) * l.presentacion.factor, l.unidad)} en total`
                          : `En ${l.unidad}`}
                      </span>
                    </button>
                    <button type="button" onClick={() => quitar(l.key)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-gray-500 hover:bg-red-50 hover:text-red-700" aria-label={`Quitar ${l.insumo}`}>
                      <Trash2 size={17} />
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-[auto_1fr_1fr]">
                    <div className="col-span-2 sm:col-span-1">
                      <span className="mb-1.5 block text-[13px] font-semibold text-gray-600">{l.presentacion ? 'Cajas / paquetes' : 'Cantidad'}</span>
                      <div className="flex h-11 items-center rounded-xl border border-gray-300 bg-white">
                        <button type="button" className="grid h-11 w-11 place-items-center text-espresso disabled:text-gray-300" onClick={() => cambiar(l.key, 'cantidad', Math.max(1, Number(l.cantidad) - 1))} disabled={Number(l.cantidad) <= 1} aria-label="Uno menos">
                          <Minus size={16} />
                        </button>
                        <input
                          type="number" min="0.001" step="any" inputMode="decimal"
                          value={l.cantidad}
                          onChange={(e) => cambiar(l.key, 'cantidad', e.target.value)}
                          className="tabular h-full w-16 bg-transparent text-center text-[16px] font-extrabold text-espresso focus:outline-none"
                          aria-label={`Cantidad de ${l.insumo}`}
                        />
                        <button type="button" className="grid h-11 w-11 place-items-center text-espresso" onClick={() => cambiar(l.key, 'cantidad', Number(l.cantidad) + 1)} aria-label="Uno más">
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
                    <Campo
                      label={l.presentacion ? 'Precio por caja' : `Precio por ${l.unidad}`}
                      type="number" min="0" step="any" inputMode="decimal"
                      value={l.costo} onChange={(e) => cambiar(l.key, 'costo', e.target.value)}
                      className="tabular"
                    />
                    <Campo
                      label={<span className="inline-flex items-center gap-1.5">Vence {l.requiereCaducidad && <Chip tono="aviso">Obligatorio</Chip>}</span>}
                      type="date" min={fechaISO()}
                      value={l.fechaVencimiento} onChange={(e) => cambiar(l.key, 'fechaVencimiento', e.target.value)}
                    />
                  </div>

                  <details className="mt-2">
                    <summary className="cursor-pointer select-none text-[13px] font-bold text-orange-700">Número de lote</summary>
                    <Campo className="mt-2" value={l.numeroLote} onChange={(e) => cambiar(l.key, 'numeroLote', e.target.value)} placeholder="Se genera solo si lo dejas vacío" />
                  </details>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </section>

      {lineas.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-gray-500">{lineas.length} insumo{lineas.length === 1 ? '' : 's'}</p>
              <p className="tabular text-[22px] font-extrabold text-espresso">{formatearCOP(total)}</p>
              {faltaFecha && (
                <p className="flex items-center gap-1 text-[12px] font-semibold text-amber-800"><CalendarClock size={14} aria-hidden="true" /> Falta la fecha de vencimiento de un perecedero</p>
              )}
            </div>
            <Boton tamano="lg" onClick={registrar} disabled={guardando || faltaFecha} className="min-w-[180px]">
              <PackageCheck size={20} aria-hidden="true" /> {guardando ? 'Registrando…' : 'Registrar entrada'}
            </Boton>
          </div>
        </div>
      )}

      <AsociarCodigo
        abierto={!!codigoNuevo}
        codigo={codigoNuevo ?? ''}
        insumos={insumos}
        proveedores={proveedores}
        onCerrar={() => setCodigoNuevo(null)}
        onAsociado={(pres, insumo) => {
          setCodigoNuevo(null);
          mostrar(`Código guardado para ${insumo.nombre}`);
          agregar(lineaDesdeInsumo(insumo, pres));
        }}
        onCrearInsumo={(codigo) => { setCodigoNuevo(null); setCreandoConCodigo(codigo); }}
      />
      <FormularioInsumo
        abierto={creandoConCodigo !== null}
        codigoInicial={creandoConCodigo ?? ''}
        onCerrar={() => setCreandoConCodigo(null)}
        onGuardado={async (msg) => {
          const codigo = creandoConCodigo;
          setCreandoConCodigo(null);
          mostrar(msg);
          compras.insumos().then(setInsumos).catch(() => {});
          // El insumo recién creado ya responde a su código: se agrega a la entrada.
          if (codigo) alEscanear(codigo);
        }}
      />
      {aviso}
    </div>
  );
}
