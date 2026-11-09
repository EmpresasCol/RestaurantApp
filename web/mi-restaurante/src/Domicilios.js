// Domicilios del día como se despachan en la vida real: se reciben, la cocina los prepara, salen con
// un domiciliario (asignado o el que los tome) y se entregan y cobran. Cada etapa es una columna; el
// detalle permite asignar, cambiar el pago antes de salir, imprimir la comanda de la bolsa y cancelar.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { CircleDollarSign, Clock, ExternalLink, MapPin, MessageCircle, Phone, Plus, Printer, Truck } from 'lucide-react';
import { useCambios } from './services/realtime';
import {
  actualizarEstadoDomicilio, actualizarMetodoPagoDomicilio, asignarDomiciliario, getComprobanteDomicilio,
  getDomiciliarios, getDomiciliosHoy, getEstadisticasDomicilios,
} from './services/domiciliosApi';
import { Boton, BotonConfirmar, Campo, Cargando, Chip, Lista, Panel, Selector, Vacio, ease, useAviso } from './components/inventario/ui';
import { hora, pesos } from './utils/caja';
import {
  activo, cambioDomicilio, cancelable, cargaDomiciliarios, ETAPAS, etapaDomicilio, METODOS_DOMICILIO, minutosDesde, reasignable,
} from './utils/domicilios';
import { htmlDomicilio, imprimirHtml } from './utils/recibo';

const VISTAS = [
  { id: 'curso', label: 'En curso' },
  { id: 'entregados', label: 'Entregados hoy' },
  { id: 'cancelados', label: 'Cancelados' },
];

const telefonoWhatsApp = (t) => {
  const d = String(t ?? '').replace(/\D/g, '');
  return d.length === 10 ? `57${d}` : d;
};

function Pago({ d }) {
  if (d.pagadoAnticipado) return <Chip tono="ok">Pagado</Chip>;
  if (d.metodoPago === 'Efectivo' && d.cambio != null) return <Chip tono="aviso">Efectivo · paga con {pesos(d.pagaCon)}</Chip>;
  return <Chip tono="neutro">{d.metodoPago}</Chip>;
}

function Tarjeta({ d, ahora, onAbrir }) {
  const minutos = minutosDesde(d.fechaPedido, ahora);
  const demorado = minutos >= 45;
  return (
    <motion.li layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease }}>
      <button
        type="button"
        onClick={() => onAbrir(d.id)}
        className="w-full rounded-2xl border border-gray-200 bg-white p-3.5 text-left transition-shadow hover:shadow-card focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-100"
      >
        <span className="flex items-center gap-2">
          <span className="tabular text-[16px] font-extrabold text-espresso">#{d.id}</span>
          <span className="tabular text-[13px] text-gray-500">{hora(d.fechaPedido)}</span>
          <span className={`tabular ml-auto flex items-center gap-1 text-[13px] font-bold ${demorado ? 'text-red-700' : 'text-gray-600'}`}>
            <Clock size={13} aria-hidden="true" />{minutos} min
          </span>
        </span>
        <span className="mt-1 block truncate text-[15px] font-bold text-espresso">{d.clienteNombre}</span>
        <span className="flex items-center gap-1 truncate text-[13px] text-gray-500">
          <MapPin size={13} className="shrink-0" aria-hidden="true" />{d.barrio || d.direccionCompleta}
        </span>
        <span className="mt-2 block truncate text-[13px] text-gray-600">{d.detalles.map((x) => `${x.cantidad} ${x.platilloNombre}`).join(' · ')}</span>
        <span className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="tabular text-[15px] font-extrabold text-espresso">{pesos(d.total)}</span>
          <Pago d={d} />
          {d.origenPedido === 'Publico' && <Chip tono="info">Por la web</Chip>}
        </span>
        <span className="mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-purple-700">
          <Truck size={14} aria-hidden="true" />{d.domiciliarioNombre ?? 'Sin domiciliario'}
        </span>
      </button>
    </motion.li>
  );
}

function Detalle({ d, domiciliarios, onCambio, mostrar }) {
  const [metodo, setMetodo] = useState(d.metodoPago);
  const [anticipado, setAnticipado] = useState(d.pagadoAnticipado);
  const [pagaCon, setPagaCon] = useState(d.pagaCon == null ? '' : String(d.pagaCon));
  const [metodoEntrega, setMetodoEntrega] = useState(d.metodoPago);
  const [motivo, setMotivo] = useState('');
  const [foto, setFoto] = useState(null);
  const etapa = etapaDomicilio(d);

  useEffect(() => {
    setMetodo(d.metodoPago); setAnticipado(d.pagadoAnticipado); setPagaCon(d.pagaCon == null ? '' : String(d.pagaCon));
    setMetodoEntrega(d.metodoPago); setMotivo(''); setFoto(null);
  }, [d.id, d.metodoPago, d.pagadoAnticipado, d.pagaCon]);

  const hacer = async (accion, exito) => {
    try {
      await accion();
      mostrar(exito);
      onCambio();
    } catch (e) {
      mostrar(e.message, 'error');
    }
  };

  const cambio = cambioDomicilio(d.total, pagaCon);
  const pagoCambiado = metodo !== d.metodoPago || anticipado !== d.pagadoAnticipado || String(d.pagaCon ?? '') !== pagaCon;
  const pasos = [
    ['Pedido', d.fechaPedido],
    ['Recogido', d.fechaRecogida],
    ['Entregado', d.fechaEntrega],
    ['Efectivo en caja', d.estado === 'Entregado' && d.metodoPago === 'Efectivo' && !d.pagadoAnticipado ? d.fechaLiquidacion : null],
  ].filter(([, f]) => f);

  return (
    <div className="space-y-6 p-5">
      <section>
        <h3 className="text-[13px] font-bold text-gray-500">Cliente</h3>
        <p className="mt-1 text-[17px] font-extrabold text-espresso">{d.clienteNombre}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <a href={`tel:${d.clienteTelefono}`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-300 px-3 text-[14px] font-bold text-espresso hover:bg-gray-50">
            <Phone size={16} aria-hidden="true" /><span className="tabular">{d.clienteTelefono}</span>
          </a>
          <a href={`https://wa.me/${telefonoWhatsApp(d.clienteTelefono)}`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-300 px-3 text-[14px] font-bold text-espresso hover:bg-gray-50">
            <MessageCircle size={16} aria-hidden="true" />WhatsApp
          </a>
        </div>
      </section>

      <section>
        <h3 className="text-[13px] font-bold text-gray-500">Dirección</h3>
        <p className="mt-1 text-[15px] font-bold text-espresso">{d.direccionCompleta}{d.barrio ? ` · ${d.barrio}` : ''}</p>
        {d.referenciasAdicionales && <p className="text-[14px] text-gray-600">{d.referenciasAdicionales}</p>}
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${d.direccionCompleta} ${d.barrio ?? ''}`)}`}
          target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[13px] font-bold text-purple-700 hover:underline"
        >
          Abrir en el mapa <ExternalLink size={13} aria-hidden="true" />
        </a>
      </section>

      <section>
        <h3 className="mb-2 text-[13px] font-bold text-gray-500">Pedido</h3>
        <Lista>
          {d.detalles.map((x) => (
            <div key={x.id} className="flex gap-3 px-4 py-2.5 text-[14px]">
              <span className="tabular font-bold text-orange-700">{x.cantidad}×</span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-espresso">{x.platilloNombre}</span>
                {x.nota && <span className="block text-[13px] text-gray-500">{x.nota}</span>}
              </span>
              <span className="tabular text-espresso">{pesos(x.subtotal)}</span>
            </div>
          ))}
        </Lista>
        <dl className="tabular mt-2 space-y-0.5 text-[14px]">
          <div className="flex justify-between text-gray-600"><dt>Productos</dt><dd>{pesos(d.subtotal)}</dd></div>
          <div className="flex justify-between text-gray-600"><dt>Envío</dt><dd>{pesos(d.costoEnvio)}</dd></div>
          <div className="flex justify-between text-[17px] font-extrabold text-espresso"><dt>Total</dt><dd>{pesos(d.total)}</dd></div>
        </dl>
        {d.notasCliente && <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-[14px] text-amber-900"><strong>Nota del cliente:</strong> {d.notasCliente}</p>}
        {d.notasInternas && <p className="mt-2 rounded-xl bg-gray-100 px-3 py-2 text-[13px] text-gray-700">{d.notasInternas}</p>}
      </section>

      {reasignable(d) && (
        <section>
          <Selector
            label="Domiciliario"
            value={d.domiciliarioId ?? ''}
            onChange={(e) => hacer(
              () => asignarDomiciliario(d.id, e.target.value ? Number(e.target.value) : null),
              e.target.value ? 'Domiciliario asignado' : 'Quedó libre para el que lo tome',
            )}
          >
            <option value="">El primero que lo tome</option>
            {domiciliarios.map((u) => <option key={u.id} value={u.id}>{u.nombre} · {u.enCurso} en curso</option>)}
          </Selector>
          <p className="mt-1 text-[12px] text-gray-500">El asignado lo ve en su app desde que entra a cocina.</p>
        </section>
      )}

      <section>
        <h3 className="mb-2 text-[13px] font-bold text-gray-500">Pago</h3>
        {activo(d) ? (
          <div className="space-y-3">
            <Selector label="Método" value={metodo} onChange={(e) => setMetodo(e.target.value)}>
              {METODOS_DOMICILIO.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </Selector>
            <label className="flex items-center gap-2 text-[14px] font-semibold text-espresso">
              <input type="checkbox" className="h-5 w-5 accent-espresso" checked={anticipado} onChange={(e) => setAnticipado(e.target.checked)} />
              Ya pagó por anticipado (no se cobra al entregar)
            </label>
            {metodo === 'Efectivo' && !anticipado && (
              <Campo
                label="Paga con (billete)" type="number" min="0" step="1000" inputMode="numeric" value={pagaCon} onChange={(e) => setPagaCon(e.target.value)}
                ayuda={cambio != null ? `El domiciliario lleva ${pesos(cambio)} de cambio` : pagaCon ? 'No alcanza para el total' : 'Opcional: para llevar el cambio exacto'}
              />
            )}
            {pagoCambiado && (
              <Boton variante="secundario" onClick={() => hacer(
                () => actualizarMetodoPagoDomicilio(d.id, metodo, anticipado, metodo === 'Efectivo' && !anticipado && pagaCon !== '' ? Number(pagaCon) : null),
                'Pago actualizado',
              )}>Guardar pago</Boton>
            )}
          </div>
        ) : (
          <div className="space-y-2 text-[14px]">
            <p className="flex flex-wrap items-center gap-2">
              <Pago d={d} />
              {d.numeroFactura && <Chip tono="ok">Factura {d.numeroFactura}</Chip>}
              {d.porLiquidar && <Chip tono="aviso">El domiciliario aún no entrega el efectivo</Chip>}
            </p>
            {d.tieneComprobante && (foto
              ? <a href={foto} target="_blank" rel="noreferrer"><img src={foto} alt="Comprobante de la transferencia" className="max-h-64 rounded-xl border border-gray-200" /></a>
              : <Boton variante="secundario" tamano="sm" onClick={() => getComprobanteDomicilio(d.id).then(setFoto).catch((e) => mostrar(e.message, 'error'))}>Ver comprobante</Boton>)}
          </div>
        )}
      </section>

      {pasos.length > 0 && (
        <section>
          <h3 className="mb-2 text-[13px] font-bold text-gray-500">Seguimiento</h3>
          <ol className="tabular space-y-1 text-[14px] text-gray-700">
            {pasos.map(([texto, f]) => <li key={texto} className="flex justify-between"><span>{texto}</span><span>{hora(f)}</span></li>)}
          </ol>
        </section>
      )}

      {(etapa === 'listo' || etapa === 'camino') && (
        <section className="rounded-2xl border border-gray-200 p-4">
          <h3 className="text-[15px] font-bold text-espresso">Entregado y cobrado aquí</h3>
          <p className="mb-2 text-[13px] text-gray-500">Si el cliente lo recogió o el pago llegó a caja. El domiciliario lo marca desde su app.</p>
          {!d.pagadoAnticipado && (
            <Selector label="Cómo pagó" value={metodoEntrega} onChange={(e) => setMetodoEntrega(e.target.value)}>
              {METODOS_DOMICILIO.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </Selector>
          )}
          <BotonConfirmar
            className="mt-3" varianteInicial="primario" tamano="md" confirmar="Toca otra vez: entregado"
            onConfirmar={() => hacer(() => actualizarEstadoDomicilio(d.id, 'Entregado', { metodoPago: metodoEntrega }), `Domicilio #${d.id} entregado y facturado`)}
          >
            Marcar entregado
          </BotonConfirmar>
        </section>
      )}

      {cancelable(d) && (
        <section className="rounded-2xl border border-red-200 p-4">
          <h3 className="text-[15px] font-bold text-red-800">Cancelar el domicilio</h3>
          {etapa === 'camino' && <p className="text-[13px] text-red-800">Ya salió: el domiciliario debe volver con el pedido.</p>}
          <Campo className="mt-2" label="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="El cliente no contestó, dirección errada…" maxLength={200} />
          <BotonConfirmar
            className="mt-3" confirmar="Toca otra vez para cancelar" disabled={!motivo.trim()}
            onConfirmar={() => hacer(() => actualizarEstadoDomicilio(d.id, 'Cancelado', { motivo: motivo.trim() }), `Domicilio #${d.id} cancelado`)}
          >
            Cancelar domicilio
          </BotonConfirmar>
        </section>
      )}
    </div>
  );
}

export default function Domicilios({ onNuevoDomicilio }) {
  const [domicilios, setDomicilios] = useState(null);
  const [domiciliarios, setDomiciliarios] = useState([]);
  const [estadisticas, setEstadisticas] = useState(null);
  const [vista, setVista] = useState('curso');
  const [abierto, setAbierto] = useState(null);
  const [ahora, setAhora] = useState(new Date());
  const [aviso, mostrar] = useAviso();

  const cargar = useCallback(async () => {
    try {
      const [d, u, s] = await Promise.all([
        getDomiciliosHoy(),
        getDomiciliarios().catch(() => []),
        getEstadisticasDomicilios().catch(() => null),
      ]);
      setDomicilios(Array.isArray(d) ? d : []);
      setDomiciliarios(Array.isArray(u) ? u : []);
      setEstadisticas(s);
    } catch (e) {
      setDomicilios((v) => v ?? []);
      mostrar(e.message, 'error');
    }
  }, [mostrar]);

  useCambios('domicilios', cargar);
  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 60000);
    const reloj = setInterval(() => setAhora(new Date()), 30000);
    return () => { clearInterval(t); clearInterval(reloj); };
  }, [cargar]);

  const lista = useMemo(() => domicilios ?? [], [domicilios]);
  const carga = useMemo(() => cargaDomiciliarios(domiciliarios, lista), [domiciliarios, lista]);
  const enCurso = lista.filter(activo);
  const seleccionado = lista.find((d) => d.id === abierto) ?? null;
  const filtrados = vista === 'entregados' ? lista.filter((d) => d.estado === 'Entregado') : lista.filter((d) => d.estado === 'Cancelado');

  const kpis = [
    { titulo: 'Pedidos hoy', valor: estadisticas?.totalDomicilios ?? lista.length },
    { titulo: 'En curso', valor: enCurso.length },
    { titulo: 'Vendido (entregados)', valor: pesos(estadisticas?.totalVentas ?? 0) },
    { titulo: 'Efectivo por recibir', valor: pesos(estadisticas?.efectivoPorLiquidar ?? 0), ayuda: 'Lo tienen los domiciliarios' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-[1440px] px-4 py-6 lg:px-6 lg:py-8">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.02em] text-espresso">Domicilios</h1>
            <p className="mt-1 text-[15px] text-gray-500">Recibe, despacha y sigue cada pedido hasta que se entrega y se cobra.</p>
          </div>
          <Boton tamano="lg" onClick={onNuevoDomicilio}><Plus size={18} aria-hidden="true" />Nuevo domicilio</Boton>
        </header>

        <dl className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.titulo} className="rounded-2xl border border-gray-200 bg-white p-4">
              <dt className="text-[13px] font-semibold text-gray-500">{k.titulo}</dt>
              <dd className="tabular mt-1 text-[24px] font-extrabold tracking-[-0.02em] text-espresso">{k.valor}</dd>
              {k.ayuda && <dd className="text-[12px] text-gray-500">{k.ayuda}</dd>}
            </div>
          ))}
        </dl>

        <nav className="qp-rail mb-4 flex gap-1 overflow-x-auto" aria-label="Vista">
          {VISTAS.map((v) => (
            <button
              key={v.id} type="button" onClick={() => setVista(v.id)} aria-current={vista === v.id ? 'page' : undefined}
              className={`h-10 shrink-0 rounded-full px-4 text-[14px] font-semibold transition-colors ${vista === v.id ? 'bg-orange-100 text-espresso' : 'text-gray-500 hover:text-espresso'}`}
            >
              {v.label}
            </button>
          ))}
        </nav>

        {!domicilios ? <Cargando filas={4} /> : vista === 'curso' ? (
          enCurso.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white">
              <Vacio icono={Truck} titulo="No hay domicilios en curso" texto="Los pedidos por teléfono y los de la página aparecen aquí apenas llegan.">
                <Boton onClick={onNuevoDomicilio}><Plus size={16} aria-hidden="true" />Nuevo domicilio</Boton>
              </Vacio>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {ETAPAS.map((e) => {
                const deEtapa = enCurso.filter((d) => etapaDomicilio(d) === e.id);
                return (
                  <section key={e.id} aria-label={e.titulo} className="rounded-[22px] bg-gray-100 p-3">
                    <h2 className="flex items-center gap-2 px-1 text-[15px] font-extrabold text-espresso">
                      {e.titulo}
                      <span className="tabular rounded-full bg-white px-2 py-0.5 text-[12px] text-gray-600">{deEtapa.length}</span>
                    </h2>
                    <p className="mb-3 px-1 text-[12px] text-gray-500">{e.ayuda}</p>
                    <ul className="space-y-2">
                      {deEtapa.map((d) => <Tarjeta key={d.id} d={d} ahora={ahora} onAbrir={setAbierto} />)}
                    </ul>
                  </section>
                );
              })}
            </div>
          )
        ) : filtrados.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white">
            <Vacio icono={Truck} titulo={vista === 'entregados' ? 'Ningún domicilio entregado hoy' : 'Ningún domicilio cancelado hoy'} />
          </div>
        ) : (
          <Lista>
            {filtrados.map((d) => (
              <button key={d.id} type="button" onClick={() => setAbierto(d.id)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left hover:bg-gray-50">
                <span className="min-w-0 flex-1">
                  <span className="tabular block text-[15px] font-bold text-espresso">#{d.id} · {d.clienteNombre}</span>
                  <span className="tabular block truncate text-[13px] text-gray-500">
                    {hora(d.fechaEntrega ?? d.fechaPedido)} · {d.barrio || d.direccionCompleta}{d.domiciliarioNombre ? ` · ${d.domiciliarioNombre}` : ''}
                  </span>
                </span>
                {d.porLiquidar && <Chip tono="aviso"><CircleDollarSign size={13} aria-hidden="true" />Efectivo por recibir</Chip>}
                {d.numeroFactura && <Chip tono="ok">{d.numeroFactura}</Chip>}
                <Pago d={d} />
                <span className="tabular text-[16px] font-extrabold text-espresso">{pesos(d.total)}</span>
              </button>
            ))}
          </Lista>
        )}
      </main>

      <Panel
        abierto={!!seleccionado}
        onCerrar={() => setAbierto(null)}
        titulo={seleccionado ? `Domicilio #${seleccionado.id}` : ''}
        subtitulo={seleccionado && (
          <span className="flex flex-wrap items-center gap-2">
            {hora(seleccionado.fechaPedido)} · {ETAPAS.find((e) => e.id === etapaDomicilio(seleccionado))?.titulo ?? seleccionado.estado}
          </span>
        )}
        pie={seleccionado && (
          <Boton variante="secundario" className="w-full" onClick={() => imprimirHtml(htmlDomicilio(seleccionado))}>
            <Printer size={16} aria-hidden="true" />Imprimir comanda para la bolsa
          </Boton>
        )}
      >
        {seleccionado && <Detalle d={seleccionado} domiciliarios={carga} onCambio={cargar} mostrar={mostrar} />}
      </Panel>
      {aviso}
    </div>
  );
}
