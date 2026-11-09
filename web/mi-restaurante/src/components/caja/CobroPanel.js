// Cobro de la cuenta de una mesa como en la vida real: toda la cuenta o cada quien lo suyo
// (plato por plato, incluso 1 de 2), propina voluntaria y uno o varios pagos (efectivo + tarjeta,
// partes iguales, varias transferencias). Lo que avisó el mesero desde la app no se cambia; si
// cubre toda la cuenta, la caja solo confirma y emite la factura.
import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Lock, Minus, Plus, Printer, Trash2, Users } from 'lucide-react';
import * as api from '../../services/api';
import { Boton, Campo, Chip, Panel } from '../inventario/ui';
import {
  billetesSugeridos, cobrable, consumoElegido, consumoPedido, estadoPedido, estadoSolicitud, hora, METODOS, montosPagos,
  nombreMetodo, partesIguales, pesos, platosPorCobrar, propinaSugerida, resumenPagos, validarNit,
} from '../../utils/caja';
import { etiquetaImpuesto, impuestoIncluido } from '../../utils/impuestos';
import { htmlFactura, imprimirHtml } from '../../utils/recibo';

const opcion = (activa) =>
  `h-11 rounded-xl border px-3 text-[14px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${activa ? 'border-espresso bg-espresso text-white' : 'border-gray-300 bg-white text-espresso hover:border-gray-400'}`;

let siguienteClave = 1;
const pagoLibre = (metodo = 'Efectivo', monto = '') => ({ clave: siguienteClave++, metodo, monto, recibido: '' });

function Resultado({ cobro, onListo, onSeguir }) {
  const { factura } = cobro;
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center" role="status">
      <span className="grid h-20 w-20 place-items-center rounded-full bg-green-50 text-green-700">
        <CheckCircle2 size={40} aria-hidden="true" />
      </span>
      <p className="mt-4 text-[24px] font-extrabold tracking-[-0.02em] text-espresso">Cobrado</p>
      <p className="tabular mt-1 text-[15px] text-gray-500">
        Factura {factura.numeroFactura} · {pesos(factura.total)}
      </p>
      {cobro.recibido != null && (
        <div className="mt-6 w-full rounded-2xl bg-gray-100 px-5 py-4">
          <p className="text-[14px] font-semibold text-gray-600">Cambio a entregar</p>
          <p className="tabular text-[40px] font-extrabold leading-tight tracking-[-0.03em] text-espresso">{pesos(cobro.cambio)}</p>
          <p className="tabular text-[13px] text-gray-500">Recibido {pesos(cobro.recibido)}</p>
        </div>
      )}
      {cobro.cuentaSaldada === false && (
        <p className="tabular mt-4 w-full rounded-2xl bg-amber-50 px-4 py-3 text-[15px] font-bold text-amber-900">
          La mesa todavía debe {pesos(cobro.pendiente)}
        </p>
      )}
      <div className="mt-6 flex w-full flex-wrap gap-2">
        <Boton variante="secundario" tamano="lg" className="flex-1" onClick={() => imprimirHtml(htmlFactura(factura, cobro))}>
          <Printer size={18} aria-hidden="true" />Imprimir factura
        </Boton>
        {cobro.cuentaSaldada === false
          ? <Boton tamano="lg" className="flex-1" onClick={onSeguir}>Cobrar lo que falta</Boton>
          : <Boton tamano="lg" className="flex-1" onClick={onListo}>Listo</Boton>}
      </div>
    </div>
  );
}

/** Pago que avisó el mesero: fijo, con la foto de la transferencia si la tiene. */
function PagoAvisado({ pago, foto }) {
  return (
    <li className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
      <div className="flex items-center gap-2">
        <Lock size={15} className="text-gray-500" aria-hidden="true" />
        <span className="text-[15px] font-bold text-espresso">{nombreMetodo(pago.metodoPago)}</span>
        <span className="text-[12px] text-gray-500">avisado por el mesero</span>
        <span className="tabular ml-auto text-[17px] font-extrabold text-espresso">{pesos(pago.monto)}</span>
      </div>
      {pago.tieneComprobante && (
        <figure className="mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white">
          {foto ? (
            <a href={foto} target="_blank" rel="noreferrer" title="Abrir la foto en grande">
              <img src={foto} alt={`Foto de la transferencia de ${pesos(pago.monto)}`} className="max-h-64 w-full object-contain" />
            </a>
          ) : (
            <div className="h-32 animate-pulse bg-gray-100" aria-label="Cargando la foto" />
          )}
        </figure>
      )}
    </li>
  );
}

export default function CobroPanel({ cuenta, onCerrar, onCobrado, mostrar }) {
  const [modo, setModo] = useState('todo');
  const [seleccion, setSeleccion] = useState([]);
  const [elegidos, setElegidos] = useState({});
  const [propinaModo, setPropinaModo] = useState('ninguna');
  const [propinaOtra, setPropinaOtra] = useState('');
  const [pagos, setPagos] = useState([pagoLibre()]);
  const [personas, setPersonas] = useState('2');
  const [conDatos, setConDatos] = useState(false);
  const [nit, setNit] = useState('');
  const [nombre, setNombre] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [fotos, setFotos] = useState({});
  const [ronda, setRonda] = useState(0);
  const [ultima, setUltima] = useState(null);

  useEffect(() => { if (cuenta) setUltima(cuenta); }, [cuenta]);
  const vista = cuenta ?? ultima;

  const solicitud = cuenta?.solicitud ?? null;
  const avisos = useMemo(() => solicitud?.pagos ?? [], [solicitud]);
  const estadoAviso = estadoSolicitud(solicitud);
  // El mesero ya cobró toda la cuenta: la caja no cambia platos, propina ni pagos.
  const bloqueado = estadoAviso === 'pagada';

  // Al abrir otra mesa (o seguir cobrando la misma) se arranca con lo que avisó el mesero.
  const mesaId = cuenta?.mesaId;
  useEffect(() => {
    if (!cuenta) return;
    setModo('todo');
    setSeleccion(cuenta.pedidos.filter(cobrable).map((p) => p.id));
    setElegidos({});
    const propinaAvisada = solicitud?.propina ?? 0;
    setPropinaModo(propinaAvisada > 0 ? 'otra' : 'ninguna');
    setPropinaOtra(propinaAvisada > 0 ? String(propinaAvisada) : '');
    // Versión anterior de la app: un solo método sin monto.
    const metodoAnterior = avisos.length === 0 ? solicitud?.metodoPago : null;
    setPagos(bloqueado ? [] : [pagoLibre(METODOS.some((m) => m.id === metodoAnterior) ? metodoAnterior : 'Efectivo')]);
    setConDatos(false); setNit(''); setNombre(''); setResultado(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesaId, ronda]);

  // Las fotos de las transferencias se piden al abrir: la caja las revisa antes de cobrar.
  const conFoto = avisos.filter((p) => p.tieneComprobante).map((p) => p.id).join(',');
  const fotoAnterior = avisos.length === 0 && solicitud?.tieneComprobante ? solicitud.id : null;
  useEffect(() => {
    setFotos({});
    let vigente = true;
    const ids = conFoto ? conFoto.split(',').map(Number) : [];
    ids.forEach((id) => api.getComprobantePagoAvisado(id)
      .then((foto) => vigente && setFotos((f) => ({ ...f, [id]: foto })))
      .catch(() => vigente && mostrar('No se pudo cargar la foto de una transferencia', 'error')));
    if (fotoAnterior) {
      api.getComprobanteCuenta(fotoAnterior)
        .then((foto) => vigente && setFotos((f) => ({ ...f, anterior: foto })))
        .catch(() => vigente && mostrar('No se pudo cargar la foto de la transferencia', 'error'));
    }
    return () => { vigente = false; };
  }, [conFoto, fotoAnterior, mostrar]);

  const pedidos = useMemo(() => cuenta?.pedidos ?? [], [cuenta]);
  const platos = useMemo(() => platosPorCobrar(pedidos), [pedidos]);
  const elegidosPedidos = pedidos.filter((p) => seleccion.includes(p.id) && cobrable(p));
  const consumo = modo === 'consumo'
    ? consumoElegido(platos, elegidos)
    : elegidosPedidos.reduce((t, p) => t + consumoPedido(p), 0);
  const sugerida = propinaSugerida(consumo);
  const propina = propinaModo === 'sugerida' ? sugerida : propinaModo === 'otra' ? Math.max(0, Math.round(Number(propinaOtra) || 0)) : 0;
  const total = consumo + propina;

  const fijos = avisos.reduce((t, p) => t + p.monto, 0);
  const montos = montosPagos(pagos, Math.max(0, total - fijos));
  const { pagado, falta, sobra } = resumenPagos([fijos, ...montos], total);
  const vuelto = pagos.reduce((t, p, i) => (p.metodo === 'Efectivo' && p.recibido !== '' ? t + (Number(p.recibido) || 0) - montos[i] : t), 0);
  const cortoEfectivo = pagos.some((p, i) => p.metodo === 'Efectivo' && p.recibido !== '' && (Number(p.recibido) || 0) < montos[i]);
  const unSoloPago = avisos.length === 0 && pagos.length === 1;

  const error =
    bloqueado && cuenta?.enCocina > 0 ? 'El mesero ya cobró toda la cuenta: confírmala cuando cocina termine'
    : consumo <= 0 ? (modo === 'consumo' ? 'Elige qué paga esta persona' : 'Marca al menos un pedido')
      : propina > consumo ? 'La propina no puede ser mayor que el consumo'
        : cortoEfectivo ? `Faltan ${pesos(-vuelto)}`
          : sobra > 0 ? `Los pagos se pasan por ${pesos(sobra)}`
            : falta > 0 ? `Faltan ${pesos(falta)} por pagar`
              : montos.some((m) => m <= 0) ? 'Quita el pago que quedó en cero'
                : conDatos && !validarNit(nit) ? 'La cédula o NIT solo lleva números'
                  : null;

  const alternar = (id) => setSeleccion((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const unidades = (detalleId, delta, maximo) =>
    setElegidos((e) => ({ ...e, [detalleId]: Math.max(0, Math.min(maximo, (e[detalleId] ?? 0) + delta)) }));
  const cambiarPago = (clave, cambios) => setPagos((ps) => ps.map((p) => (p.clave === clave ? { ...p, ...cambios } : p)));
  const dividir = () => {
    const partes = partesIguales(Math.max(0, total - fijos), Number(personas));
    if (partes.length) setPagos(partes.map((m) => pagoLibre('Efectivo', String(m))));
  };

  const cobrar = async () => {
    if (error || enviando) return;
    setEnviando(true);
    try {
      const res = await api.cobrarCuenta({
        ...(modo === 'consumo'
          ? { lineas: Object.entries(elegidos).filter(([, n]) => n > 0).map(([detalleId, cantidad]) => ({ detalleId: Number(detalleId), cantidad })) }
          : { pedidoIds: elegidosPedidos.map((p) => p.id) }),
        propina,
        pagos: [
          ...avisos.map((p) => ({ metodoPago: p.metodoPago, monto: p.monto, avisoId: p.id })),
          ...pagos.map((p, i) => ({
            metodoPago: p.metodo,
            monto: montos[i],
            recibido: p.metodo === 'Efectivo' && p.recibido !== '' ? Number(p.recibido) : null,
          })),
        ],
        nitCliente: conDatos ? nit.trim() : null,
        nombreCliente: conDatos ? nombre.trim() : null,
      });
      setResultado(res);
      onCobrado?.();
    } catch (e) {
      mostrar(e.message, 'error');
    } finally {
      setEnviando(false);
    }
  };

  const restantes = pedidos.length - elegidosPedidos.length;
  // Al cerrar se olvida el resultado: si la mesa quedó saldada, el panel no debe seguir abierto.
  const cerrar = () => { setResultado(null); onCerrar(); };

  return (
    <Panel
      abierto={!!cuenta || !!resultado}
      onCerrar={cerrar}
      titulo={vista ? `Cobrar mesa ${vista.mesaNumero}` : ''}
      subtitulo={vista && `${vista.pedidos.length} pedido${vista.pedidos.length === 1 ? '' : 's'} · desde las ${hora(vista.desde)}`}
      ancho="md:w-[600px]"
      pie={!resultado && cuenta && (
        <div>
          {error && consumo > 0 && <p className="mb-2 text-center text-[13px] font-semibold text-red-700" role="alert">{error}</p>}
          <Boton tamano="lg" className="w-full" onClick={cobrar} disabled={!!error || enviando}>
            {enviando ? 'Cobrando…' : bloqueado ? `Confirmar cobro de ${pesos(total)}` : `Cobrar ${pesos(total)}`}
          </Boton>
        </div>
      )}
    >
      {resultado ? (
        <Resultado cobro={resultado} onListo={cerrar} onSeguir={() => { setResultado(null); setRonda((r) => r + 1); }} />
      ) : cuenta && (
        <div className="space-y-6 p-5">
          {solicitud && estadoAviso !== 'pedida' && (
            <p className={`rounded-2xl px-4 py-3 text-[14px] ${bloqueado ? 'bg-green-50 text-green-900' : 'bg-amber-50 text-amber-900'}`} role="status">
              <strong className="block text-[15px]">
                {bloqueado ? 'La mesa ya pagó todo lo que se le cobra' : 'El mesero avisó una parte del pago'}
              </strong>
              {bloqueado
                ? `${solicitud.meseroNombre || 'El mesero'} registró los pagos y la propina desde la app. Revisa los comprobantes y confirma: no se pueden cambiar.`
                : 'Lo avisado queda fijo; cobra aquí lo que falta.'}
            </p>
          )}

          {!bloqueado && (
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Qué se cobra">
              <button type="button" role="radio" aria-checked={modo === 'todo'} className={opcion(modo === 'todo')} onClick={() => setModo('todo')}>Toda la cuenta</button>
              <button type="button" role="radio" aria-checked={modo === 'consumo'} className={opcion(modo === 'consumo')} onClick={() => setModo('consumo')}>Cada quien lo suyo</button>
            </div>
          )}

          {modo === 'todo' ? (
            <section aria-label="Pedidos de la mesa">
              <h3 className="mb-2 text-[15px] font-bold text-espresso">Qué se cobra</h3>
              <ul className="divide-y divide-gray-200 overflow-hidden rounded-2xl border border-gray-200">
                {pedidos.map((p) => {
                  const puede = cobrable(p) && !bloqueado;
                  const estado = estadoPedido(p.estado);
                  const debe = p.detalles.filter((d) => !d.pagado);
                  return (
                    <li key={p.id} className={cobrable(p) ? '' : 'bg-gray-50'}>
                      <label className={`flex gap-3 px-4 py-3 ${puede ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                        <input
                          type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-espresso"
                          checked={cobrable(p) && seleccion.includes(p.id)} disabled={!puede}
                          onChange={() => alternar(p.id)}
                          aria-label={`Cobrar el pedido ${p.id}`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="tabular text-[15px] font-bold text-espresso">Pedido #{p.id}</span>
                            <span className="tabular text-[13px] text-gray-500">{hora(p.fecha)} · {p.meseroNombre === 'Cliente QR' ? 'por QR' : p.meseroNombre}</span>
                            <Chip tono={estado.tono}>{estado.texto}</Chip>
                            {debe.length < p.detalles.length && <Chip tono="ok">Parte pagada</Chip>}
                          </span>
                          <span className="mt-1 block text-[14px] text-gray-600">
                            {debe.map((d) => `${d.cantidad} × ${d.platilloNombre}`).join(' · ')}
                          </span>
                        </span>
                        <span className="tabular shrink-0 text-[15px] font-bold text-espresso">{pesos(consumoPedido(p))}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              {cuenta.enCocina > 0 && (
                <p className="mt-2 text-[13px] text-amber-800">Lo que sigue en cocina se cobra cuando esté listo; así no desaparece de la comanda.</p>
              )}
              {!bloqueado && restantes > 0 && elegidosPedidos.length > 0 && cuenta.enCocina < restantes && (
                <p className="mt-2 text-[13px] text-gray-500">Los pedidos sin marcar quedan en la cuenta de la mesa.</p>
              )}
            </section>
          ) : (
            <section aria-label="Platos de esta persona">
              <h3 className="text-[15px] font-bold text-espresso">Qué paga esta persona</h3>
              <p className="mb-2 text-[13px] text-gray-500">Marca sus platos; lo demás queda en la cuenta para el siguiente.</p>
              <ul className="divide-y divide-gray-200 overflow-hidden rounded-2xl border border-gray-200">
                {platos.map((p) => {
                  const n = elegidos[p.detalleId] ?? 0;
                  return (
                    <li key={p.detalleId} className="flex items-center gap-3 px-4 py-3">
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-bold text-espresso">{p.nombre}</span>
                        <span className="tabular block text-[13px] text-gray-500">{pesos(p.precio)} · quedan {p.cantidad}{p.nota ? ` · ${p.nota}` : ''}</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <button type="button" onClick={() => unidades(p.detalleId, -1, p.cantidad)} disabled={n === 0} className="grid h-10 w-10 place-items-center rounded-full border border-gray-300 text-espresso disabled:opacity-40" aria-label={`Quitar ${p.nombre}`}>
                          <Minus size={16} />
                        </button>
                        <span className="tabular w-6 text-center text-[17px] font-extrabold text-espresso" aria-live="polite">{n}</span>
                        <button type="button" onClick={() => unidades(p.detalleId, 1, p.cantidad)} disabled={n >= p.cantidad} className="grid h-10 w-10 place-items-center rounded-full border border-gray-300 text-espresso disabled:opacity-40" aria-label={`Agregar ${p.nombre}`}>
                          <Plus size={16} />
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
              {platos.length === 0 && <p className="mt-2 text-[13px] text-amber-800">No hay platos listos para cobrar.</p>}
            </section>
          )}

          <section aria-label="Propina">
            <h3 className="mb-2 text-[15px] font-bold text-espresso">Propina voluntaria</h3>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Propina">
              <button type="button" role="radio" disabled={bloqueado} aria-checked={propinaModo === 'ninguna'} className={opcion(propinaModo === 'ninguna')} onClick={() => setPropinaModo('ninguna')}>Sin propina</button>
              <button type="button" role="radio" disabled={bloqueado} aria-checked={propinaModo === 'sugerida'} className={opcion(propinaModo === 'sugerida')} onClick={() => setPropinaModo('sugerida')}>
                10 % <span className="tabular font-semibold opacity-80">{pesos(sugerida)}</span>
              </button>
              <button type="button" role="radio" disabled={bloqueado} aria-checked={propinaModo === 'otra'} className={opcion(propinaModo === 'otra')} onClick={() => setPropinaModo('otra')}>Otro valor</button>
            </div>
            {propinaModo === 'otra' && (
              <Campo className="mt-2" label="Valor de la propina" type="number" min="0" step="100" inputMode="numeric" value={propinaOtra} disabled={bloqueado} onChange={(e) => setPropinaOtra(e.target.value)} />
            )}
            {!bloqueado && <p className="mt-1.5 text-[12px] text-gray-500">Pregúntale al cliente: la propina es opcional.</p>}
          </section>

          <section aria-label="Pagos">
            <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
              <h3 className="text-[15px] font-bold text-espresso">Cómo paga</h3>
              {!bloqueado && (
                <div className="flex items-end gap-2">
                  <label className="flex items-center gap-2 text-[13px] font-semibold text-gray-600">
                    <Users size={16} aria-hidden="true" />
                    Partes iguales entre
                    <input type="number" min="2" max="20" value={personas} onChange={(e) => setPersonas(e.target.value)} className="tabular h-9 w-14 rounded-lg border border-gray-300 px-2 text-center text-[14px] text-espresso" aria-label="Número de personas" />
                  </label>
                  <Boton variante="secundario" tamano="sm" onClick={dividir} disabled={!(Number(personas) >= 2)}>Dividir</Boton>
                </div>
              )}
            </div>

            {avisos.length > 0 && (
              <ul className="mb-3 space-y-2" aria-label="Pagos que avisó el mesero">
                {avisos.map((p) => <PagoAvisado key={p.id} pago={p} foto={fotos[p.id]} />)}
              </ul>
            )}

            <ul className="space-y-3">
              {pagos.map((p, i) => {
                const efectivo = p.metodo === 'Efectivo';
                const recibido = Number(p.recibido) || 0;
                return (
                  <li key={p.clave} className={unSoloPago ? '' : 'rounded-2xl border border-gray-200 p-3'}>
                    {!unSoloPago && (
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-[13px] font-bold text-gray-600">Pago {avisos.length + i + 1}</span>
                        <button type="button" onClick={() => setPagos((ps) => ps.filter((x) => x.clave !== p.clave))} className="grid h-9 w-9 place-items-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-red-700" aria-label={`Quitar el pago ${avisos.length + i + 1}`}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={unSoloPago ? 'Método de pago' : `Método del pago ${avisos.length + i + 1}`}>
                      {METODOS.map((m) => (
                        <button key={m.id} type="button" role="radio" aria-checked={p.metodo === m.id} className={opcion(p.metodo === m.id)} onClick={() => cambiarPago(p.clave, { metodo: m.id })}>
                          {m.label}
                        </button>
                      ))}
                    </div>
                    {!unSoloPago && (
                      <Campo className="mt-2" label="Valor de este pago" type="number" min="0" step="100" inputMode="numeric" value={p.monto} placeholder={String(montos[i])} onChange={(e) => cambiarPago(p.clave, { monto: e.target.value })} />
                    )}
                    {efectivo && (
                      <div className="mt-3 rounded-2xl bg-gray-100 p-4">
                        <Campo label="Recibido del cliente" type="number" min="0" step="100" inputMode="numeric" value={p.recibido} onChange={(e) => cambiarPago(p.clave, { recibido: e.target.value })} placeholder={String(montos[i])} />
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {billetesSugeridos(montos[i]).map((b) => (
                            <button key={b} type="button" onClick={() => cambiarPago(p.clave, { recibido: String(b) })} className="tabular h-9 rounded-full border border-gray-300 bg-white px-3 text-[13px] font-bold text-espresso hover:border-gray-400">
                              {b === montos[i] ? 'Exacto' : pesos(b)}
                            </button>
                          ))}
                        </div>
                        {p.recibido !== '' && (
                          <p className={`tabular mt-3 text-[15px] font-bold ${recibido < montos[i] ? 'text-red-700' : 'text-espresso'}`}>
                            {recibido < montos[i] ? `Faltan ${pesos(montos[i] - recibido)}` : `Cambio: ${pesos(recibido - montos[i])}`}
                          </p>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            {fotos.anterior && (
              <figure className="mt-3 overflow-hidden rounded-2xl border border-gray-200 bg-gray-100">
                <a href={fotos.anterior} target="_blank" rel="noreferrer" title="Abrir la foto en grande">
                  <img src={fotos.anterior} alt="Foto de la transferencia que tomó el mesero" className="max-h-80 w-full object-contain" />
                </a>
                <figcaption className="border-t border-gray-200 bg-white px-3 py-2 text-[12px] text-gray-500">
                  Revisa que el valor y la cuenta de destino coincidan antes de cobrar.
                </figcaption>
              </figure>
            )}

            {!bloqueado && (
              <Boton variante="secundario" tamano="sm" className="mt-3" onClick={() => setPagos((ps) => [...ps, pagoLibre()])}>
                <Plus size={15} aria-hidden="true" />Agregar otro pago
              </Boton>
            )}
            {!unSoloPago && (
              <p className={`tabular mt-2 text-[13px] font-semibold ${falta || sobra ? 'text-amber-800' : 'text-green-700'}`}>
                Pagado {pesos(pagado)} de {pesos(total)}{falta ? ` · faltan ${pesos(falta)}` : sobra ? ` · se pasa por ${pesos(sobra)}` : ' · completo'}
              </p>
            )}
          </section>

          <section aria-label="Factura">
            <label className="flex cursor-pointer items-center gap-3">
              <input type="checkbox" className="h-5 w-5 accent-espresso" checked={conDatos} onChange={(e) => setConDatos(e.target.checked)} />
              <span>
                <span className="block text-[15px] font-bold text-espresso">Factura con datos del cliente</span>
                <span className="block text-[13px] text-gray-500">Si no, sale a nombre de consumidor final.</span>
              </span>
            </label>
            {conDatos && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Campo label="Cédula o NIT" inputMode="numeric" value={nit} onChange={(e) => setNit(e.target.value)} placeholder="900123456-7" />
                <Campo label="Nombre o razón social" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={150} />
              </div>
            )}
          </section>

          <section aria-label="Total" className="rounded-2xl border border-gray-200 p-4">
            <dl className="tabular space-y-1 text-[14px]">
              <div className="flex justify-between"><dt className="text-gray-600">Consumo</dt><dd className="font-semibold text-espresso">{pesos(consumo)}</dd></div>
              <div className="flex justify-between text-[13px] text-gray-500"><dt>{etiquetaImpuesto()}</dt><dd>{pesos(impuestoIncluido(consumo))}</dd></div>
              {propina > 0 && <div className="flex justify-between"><dt className="text-gray-600">Propina</dt><dd className="font-semibold text-espresso">{pesos(propina)}</dd></div>}
              <div className="flex items-baseline justify-between border-t border-gray-200 pt-2">
                <dt className="text-[15px] font-bold text-espresso">Total a pagar</dt>
                <dd className="text-[32px] font-extrabold tracking-[-0.03em] text-espresso">{pesos(total)}</dd>
              </div>
            </dl>
          </section>
        </div>
      )}
    </Panel>
  );
}
