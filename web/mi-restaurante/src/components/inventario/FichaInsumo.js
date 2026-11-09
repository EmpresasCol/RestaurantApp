// Ficha de un insumo: todo lo que el encargado necesita al tocarlo en cualquier lista.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeftRight, Barcode, ChefHat, PackagePlus, Pencil, Scale, ShoppingCart, Trash2 } from 'lucide-react';
import { compras, getProducto, mensajeError, updateProducto } from '../../services/inventarioApi';
import {
  formatearCantidad, formatearCOP, formatearFecha, nivelVencimiento, signoMovimiento, textoCobertura, textoVencimiento,
} from '../../utils/inventario';
import AsociarCodigo from './AsociarCodigo';
import EditorLote from './EditorLote';
import RegistrarMovimiento from './RegistrarMovimiento';
import { Boton, BotonConfirmar, Campo, Chip, ChipEstado, Cargando, Lista, Panel, useAviso } from './ui';

const TONO_VENCE = { vencido: 'peligro', pronto: 'peligro', aviso: 'aviso', normal: 'neutro' };
const TONO_MOV = { Entrada: 'ok', Salida: 'neutro', Merma: 'peligro', Ajuste: 'info', Transferencia: 'info' };
const TEXTO_MOV = { Transferencia: 'Traslado' };

function Bloque({ titulo, accion, children }) {
  return (
    <section className="px-5 py-4">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <h3 className="text-[15px] font-extrabold text-espresso">{titulo}</h3>
        {accion}
      </div>
      {children}
    </section>
  );
}

function EditarNiveles({ ficha, onGuardado, onCancelar }) {
  const i = ficha.insumo;
  const [valores, setValores] = useState({
    stockMinimo: i.stockMinimo ?? 0,
    puntoReorden: i.puntoReorden ?? '',
    stockMaximo: i.stockMaximo ?? '',
    diasVencimiento: i.diasVencimiento ?? '',
    requiereCaducidad: !!i.requiereCaducidad,
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setValores((v) => ({ ...v, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const numero = (v) => (v === '' || v == null ? null : Number(v));

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    try {
      // El PUT reemplaza el producto entero: se parte del registro completo para no perder la imagen ni el código.
      const p = await getProducto(i.id);
      await updateProducto(i.id, {
        id: p.id, codigo: p.codigo ?? '', nombre: p.nombre, descripcion: p.descripcion ?? '',
        categoriaId: p.categoriaId, categoriaNombre: '', proveedorId: p.proveedorId, proveedorNombre: '',
        unidadMedida: p.unidadMedida, precioCosto: p.precioCosto > 0 ? p.precioCosto : 0.01,
        stockMinimo: numero(valores.stockMinimo) ?? 0, puntoReorden: numero(valores.puntoReorden), stockMaximo: numero(valores.stockMaximo),
        requiereCaducidad: valores.requiereCaducidad, diasVencimiento: numero(valores.diasVencimiento),
        codigoBarras: p.codigoBarras ?? '', imagenUrl: p.imagenUrl ?? '', activo: p.activo,
      });
      onGuardado();
    } catch (e) {
      setError(mensajeError(e, 'No se pudieron guardar los niveles'));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <div className="grid grid-cols-3 gap-2">
        <Campo label="Mínimo" type="number" min="0" step="any" value={valores.stockMinimo} onChange={set('stockMinimo')} />
        <Campo label="Pedir al llegar a" type="number" min="0" step="any" value={valores.puntoReorden} onChange={set('puntoReorden')} placeholder="= mínimo" />
        <Campo label="Llenar hasta" type="number" min="0" step="any" value={valores.stockMaximo} onChange={set('stockMaximo')} placeholder="2 × punto" />
      </div>
      <label className="flex items-center gap-3 text-[14px] font-semibold text-espresso">
        <input type="checkbox" checked={valores.requiereCaducidad} onChange={set('requiereCaducidad')} className="h-5 w-5 rounded accent-espresso" />
        Es perecedero: pedir fecha de vencimiento al recibir
      </label>
      <Campo label="Dura (días) desde que llega" type="number" min="0" step="1" value={valores.diasVencimiento} onChange={set('diasVencimiento')} ayuda="Sirve para sugerir la fecha de vencimiento al escanear." placeholder="Opcional" />
      {error && <p className="text-[13px] font-semibold text-red-700" role="alert">{error}</p>}
      <div className="flex justify-end gap-2">
        <Boton variante="fantasma" tamano="sm" onClick={onCancelar}>Cancelar</Boton>
        <Boton tamano="sm" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar niveles'}</Boton>
      </div>
    </div>
  );
}

export default function FichaInsumo({ productoId, onCerrar, onRecibir, onPedir, onCambio, proveedores = [] }) {
  const [ficha, setFicha] = useState(null);
  const [error, setError] = useState(null);
  const [editando, setEditando] = useState(false);
  const [agregandoCodigo, setAgregandoCodigo] = useState(false);
  const [loteEditando, setLoteEditando] = useState(null);
  const [movimiento, setMovimiento] = useState(null);
  const [aviso, mostrar] = useAviso();

  const cargar = useCallback(() => {
    if (!productoId) return;
    setError(null);
    compras.ficha(productoId).then(setFicha).catch((e) => setError(mensajeError(e, 'No se pudo cargar el insumo')));
  }, [productoId]);

  useEffect(() => {
    setFicha(null);
    setEditando(false);
    cargar();
  }, [cargar]);

  const refrescar = () => { cargar(); onCambio?.(); };

  const darDeBaja = async (lote) => {
    try {
      const r = await compras.darDeBaja(lote.id);
      mostrar(r.message);
      refrescar();
    } catch (e) {
      mostrar(mensajeError(e, 'No se pudo dar de baja'), 'error');
    }
  };

  const quitarPresentacion = async (p) => {
    try {
      await compras.eliminarPresentacion(p.id);
      mostrar('Presentación eliminada');
      cargar();
    } catch (e) {
      mostrar(mensajeError(e, 'No se pudo eliminar'), 'error');
    }
  };

  const i = ficha?.insumo;
  const u = i?.unidadMedida;
  // Estable entre renders: el panel de movimiento se reinicia cuando cambia.
  const insumoMov = useMemo(() => (i ? { id: i.id, nombre: i.nombre, unidadMedida: u } : null), [i, u]);

  return (
    <Panel
      abierto={!!productoId}
      onCerrar={onCerrar}
      titulo={i?.nombre ?? 'Insumo'}
      subtitulo={i && (
        <span className="flex flex-wrap items-center gap-2">
          <ChipEstado estado={ficha.estado} />
          <span className="tabular">{[i.codigo, i.categoria, i.proveedor].filter(Boolean).join(' · ')}</span>
          {!i.activo && <Chip tono="neutro">Inactivo</Chip>}
        </span>
      )}
      pie={i && (
        <div className="flex gap-2">
          <Boton variante="secundario" tamano="lg" className="flex-1" onClick={() => onPedir?.(i.id)}>
            <ShoppingCart size={18} aria-hidden="true" /> Pedir
          </Boton>
          <Boton tamano="lg" className="flex-1" onClick={() => onRecibir?.(i.id)}>
            <PackagePlus size={18} aria-hidden="true" /> Recibir
          </Boton>
        </div>
      )}
    >
      {error && <p className="m-5 rounded-xl bg-red-50 px-4 py-3 text-[14px] font-semibold text-red-800" role="alert">{error}</p>}
      {!ficha && !error && <div className="p-5"><Cargando filas={5} /></div>}

      {ficha && (
        <div className="divide-y divide-gray-200">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-5 py-4">
            <div className="col-span-2">
              <p className="text-[13px] text-gray-500">En stock</p>
              <p className="tabular text-[34px] font-extrabold leading-none tracking-[-0.03em] text-espresso">{formatearCantidad(ficha.stock, u)}</p>
              <p className={`mt-1 text-[14px] font-semibold ${ficha.estado === 'OK' ? 'text-gray-600' : 'text-amber-800'}`}>{textoCobertura(ficha.diasCobertura)}</p>
            </div>
            <div>
              <p className="text-[13px] text-gray-500">Gasto diario (14 días)</p>
              <p className="tabular text-[16px] font-bold text-espresso">{formatearCantidad(ficha.consumoDiario, u)}</p>
            </div>
            <div>
              <p className="text-[13px] text-gray-500">Valor en bodega</p>
              <p className="tabular text-[16px] font-bold text-espresso">{formatearCOP(ficha.valor)}</p>
            </div>
            {ficha.vencido > 0 && (
              <div className="col-span-2 flex items-start gap-2.5 rounded-xl bg-red-50 px-3.5 py-2.5 text-[14px] text-red-800">
                <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>
                  Además hay <span className="tabular font-bold">{formatearCantidad(ficha.vencido, u)}</span> vencidos que no se usan en recetas ni cuentan para la venta. Dalos de baja abajo, en Lotes.
                </span>
              </div>
            )}
            {ficha.pedido > 0 && (
              <div className="col-span-2 rounded-xl bg-purple-50 px-3.5 py-2.5 text-[14px] text-purple-800">
                Ya hay <span className="tabular font-bold">{formatearCantidad(ficha.pedido, u)}</span> pedidos en {ficha.ordenesAbiertas.map((o) => o.numeroOrden).join(', ')}.
              </div>
            )}
          </div>

          <Bloque
            titulo="Cuándo pedir"
            accion={!editando && <Boton variante="fantasma" tamano="sm" onClick={() => setEditando(true)}><Pencil size={15} aria-hidden="true" /> Ajustar</Boton>}
          >
            {editando ? (
              <EditarNiveles ficha={ficha} onCancelar={() => setEditando(false)} onGuardado={() => { setEditando(false); mostrar('Niveles guardados'); refrescar(); }} />
            ) : (
              <dl className="grid grid-cols-3 gap-2 text-center">
                {[
                  ['Mínimo', i.stockMinimo],
                  ['Pedir al llegar a', i.puntoReorden ?? i.stockMinimo],
                  ['Llenar hasta', i.stockMaximo ?? '—'],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-gray-50 px-2 py-2.5">
                    <dt className="text-[12px] text-gray-500">{k}</dt>
                    <dd className="tabular text-[16px] font-extrabold text-espresso">{typeof v === 'number' ? formatearCantidad(v, u) : v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </Bloque>

          <Bloque
            titulo="Dónde está"
            accion={
              <span className="flex gap-1">
                <Boton variante="fantasma" tamano="sm" onClick={() => setMovimiento('Ajuste')}><Scale size={15} aria-hidden="true" /> Ajustar</Boton>
                <Boton variante="fantasma" tamano="sm" onClick={() => setMovimiento('Merma')}><Trash2 size={15} aria-hidden="true" /> Merma</Boton>
                <Boton variante="fantasma" tamano="sm" onClick={() => setMovimiento('Traslado')}><ArrowLeftRight size={15} aria-hidden="true" /> Trasladar</Boton>
              </span>
            }
          >
            {ficha.porAlmacen.length === 0 ? (
              <p className="text-[14px] text-gray-500">No hay existencias en ningún almacén.</p>
            ) : (
              <Lista>
                {ficha.porAlmacen.map((a) => (
                  <div key={a.almacenId} className="flex items-center justify-between px-4 py-3 text-[14px]">
                    <span className="font-semibold text-espresso">{a.almacen}</span>
                    <span className="tabular font-bold text-espresso">{formatearCantidad(a.cantidad, u)}</span>
                  </div>
                ))}
              </Lista>
            )}
          </Bloque>

          <Bloque titulo="Lotes y vencimientos">
            {ficha.lotes.length === 0 ? (
              <p className="text-[14px] text-gray-500">No hay lotes con existencias. Al recibir mercancía se crea un lote con su fecha.</p>
            ) : (
              <Lista>
                {ficha.lotes.map((l) => {
                  const nivel = nivelVencimiento(l.diasParaVencer);
                  if (loteEditando === l.id) {
                    return (
                      <div key={l.id} className="px-4 py-3">
                        <EditorLote lote={l} onCancelar={() => setLoteEditando(null)} onGuardado={() => { setLoteEditando(null); mostrar('Lote corregido'); refrescar(); }} />
                      </div>
                    );
                  }
                  return (
                    <div key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="tabular text-[14px] font-bold text-espresso">{formatearCantidad(l.cantidadActual, u)} <span className="font-medium text-gray-500">· lote {l.numeroLote}</span></p>
                        <p className="text-[12px] text-gray-500">Llegó {formatearFecha(l.fechaIngreso)}{l.fechaVencimiento ? ` · vence ${formatearFecha(l.fechaVencimiento)}` : ''}</p>
                      </div>
                      <Chip tono={TONO_VENCE[nivel]}>{textoVencimiento(l.diasParaVencer)}</Chip>
                      <button type="button" onClick={() => setLoteEditando(l.id)} className="grid h-9 w-9 place-items-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-espresso" aria-label={`Corregir lote ${l.numeroLote}`}>
                        <Pencil size={15} />
                      </button>
                      {nivel === 'vencido' && <BotonConfirmar onConfirmar={() => darDeBaja(l)}>Dar de baja</BotonConfirmar>}
                    </div>
                  );
                })}
              </Lista>
            )}
          </Bloque>

          <Bloque
            titulo="Cómo se compra"
            accion={<Boton variante="fantasma" tamano="sm" onClick={() => setAgregandoCodigo(true)}><Barcode size={15} aria-hidden="true" /> Agregar código</Boton>}
          >
            {ficha.presentaciones.length === 0 ? (
              <p className="text-[14px] text-gray-500">Sin presentaciones. Agrega el código de la caja o de la unidad para recibirlo escaneando.</p>
            ) : (
              <Lista>
                {ficha.presentaciones.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-bold text-espresso">{p.nombre} <span className="tabular font-medium text-gray-500">= {formatearCantidad(p.factor, u)}</span></p>
                      <p className="tabular text-[12px] text-gray-500">{[p.codigo ?? 'Sin código', p.proveedor, p.costoReferencia ? formatearCOP(p.costoReferencia) : null].filter(Boolean).join(' · ')}</p>
                    </div>
                    <button type="button" onClick={() => quitarPresentacion(p)} className="grid h-9 w-9 place-items-center rounded-full text-gray-500 hover:bg-red-50 hover:text-red-700" aria-label={`Eliminar ${p.nombre}`}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </Lista>
            )}
          </Bloque>

          {ficha.usadoEn.length > 0 && (
            <Bloque titulo="Se usa en">
              <ul className="flex flex-wrap gap-2">
                {ficha.usadoEn.map((r) => (
                  <li key={r.platilloId} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-[13px] font-semibold text-espresso">
                    <ChefHat size={14} className="text-orange-700" aria-hidden="true" />
                    {r.platillo} <span className="tabular text-gray-500">{formatearCantidad(r.cantidadRequerida, u)}</span>
                  </li>
                ))}
              </ul>
            </Bloque>
          )}

          <Bloque titulo="Últimos movimientos">
            {ficha.movimientos.length === 0 ? (
              <p className="text-[14px] text-gray-500">Todavía no hay movimientos.</p>
            ) : (
              <ol className="space-y-2.5">
                {ficha.movimientos.map((m) => (
                  <li key={m.id} className="flex items-start gap-3 text-[13px]">
                    <Chip tono={TONO_MOV[m.tipoMovimiento] ?? 'neutro'} className="w-[72px] justify-center">{TEXTO_MOV[m.tipoMovimiento] ?? m.tipoMovimiento}</Chip>
                    <span className="min-w-0 flex-1 text-gray-600">
                      <span className="block truncate font-semibold text-espresso">{m.motivo || m.referencia || '—'}</span>
                      {new Date(m.fecha).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })} · {m.almacen}
                    </span>
                    <span className={`tabular shrink-0 font-bold ${signoMovimiento(m) === '+' ? 'text-green-700' : 'text-espresso'}`}>
                      {signoMovimiento(m)}{formatearCantidad(m.cantidad, u)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Bloque>
        </div>
      )}

      {i && (
        <AsociarCodigo
          abierto={agregandoCodigo}
          insumos={[]}
          insumoFijo={{ id: i.id, nombre: i.nombre, unidadMedida: u, proveedorId: i.proveedorId }}
          proveedores={proveedores}
          onCerrar={() => setAgregandoCodigo(false)}
          onAsociado={() => { setAgregandoCodigo(false); mostrar('Presentación agregada'); cargar(); }}
        />
      )}
      {i && (
        <RegistrarMovimiento
          abierto={!!movimiento}
          tipoInicial={movimiento ?? 'Merma'}
          insumoInicial={insumoMov}
          onCerrar={() => setMovimiento(null)}
          onHecho={(msg) => { setMovimiento(null); mostrar(msg); refrescar(); }}
        />
      )}
      {aviso}
    </Panel>
  );
}
