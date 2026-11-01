// Domicilio por teléfono, en una sola pantalla como lo toma la caja: quién llama (por su número se
// encuentran sus datos y direcciones), a dónde va, qué pide (con lo que hay en inventario) y cómo
// paga (si es en efectivo, con qué billete, para que el domiciliario lleve el cambio).
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, MapPin, Minus, Plus, Search, Trash2 } from 'lucide-react';
import { getPlatillos } from './services/api';
import { NO_DISPONIBLE, agotado, topePorciones } from './components/menu/MenuQR';
import {
  buscarClientePorTelefono, createClienteConDireccion, createDireccion, createDomicilio, getDireccionesCliente,
} from './services/domiciliosApi';
import { Boton, Campo, Chip, useAviso } from './components/inventario/ui';
import { billetesSugeridos, pesos } from './utils/caja';
import { cambioDomicilio, METODOS_DOMICILIO, telefonoValido, totalDomicilio } from './utils/domicilios';

const ENVIO_POR_DEFECTO = 3000;
const NUEVA = 'nueva';

const opcion = (activa) =>
  `h-10 rounded-xl border px-3 text-[14px] font-bold transition-colors ${activa ? 'border-espresso bg-espresso text-white' : 'border-gray-300 bg-white text-espresso hover:border-gray-400'}`;

function Seccion({ numero, titulo, children }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5" aria-label={titulo}>
      <h2 className="mb-4 flex items-center gap-2.5 text-[18px] font-extrabold text-espresso">
        <span className="tabular grid h-7 w-7 place-items-center rounded-full bg-espresso text-[13px] text-white">{numero}</span>
        {titulo}
      </h2>
      {children}
    </section>
  );
}

export default function NuevoDomicilio({ onVolver, onDomicilioCreado }) {
  const [telefono, setTelefono] = useState('');
  const [buscado, setBuscado] = useState(false);
  const [cliente, setCliente] = useState(null);
  const [nombre, setNombre] = useState('');
  const [direcciones, setDirecciones] = useState([]);
  const [direccionId, setDireccionId] = useState(NUEVA);
  const [nuevaDireccion, setNuevaDireccion] = useState({ direccionCompleta: '', barrio: '', referenciasAdicionales: '' });
  const [platillos, setPlatillos] = useState([]);
  const [q, setQ] = useState('');
  const [categoria, setCategoria] = useState('Todas');
  const [carrito, setCarrito] = useState([]);
  const [envio, setEnvio] = useState(String(ENVIO_POR_DEFECTO));
  const [metodo, setMetodo] = useState('Efectivo');
  const [anticipado, setAnticipado] = useState(false);
  const [pagaCon, setPagaCon] = useState('');
  const [notas, setNotas] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [aviso, mostrar] = useAviso();

  useEffect(() => {
    getPlatillos().then(setPlatillos).catch(() => mostrar('No se pudo cargar la carta', 'error'));
  }, [mostrar]);

  const buscar = async () => {
    if (!telefonoValido(telefono)) {
      mostrar('Escribe un teléfono de 10 dígitos', 'error');
      return;
    }
    setBuscando(true);
    try {
      const encontrado = await buscarClientePorTelefono(telefono.replace(/\D/g, ''));
      setCliente(encontrado);
      setNombre(encontrado?.nombre ?? '');
      const lista = encontrado ? await getDireccionesCliente(encontrado.id) : [];
      setDirecciones(lista ?? []);
      setDireccionId(lista?.length ? (lista.find((d) => d.esPrincipal) ?? lista[0]).id : NUEVA);
      setBuscado(true);
    } catch (e) {
      mostrar(e.message, 'error');
    } finally {
      setBuscando(false);
    }
  };

  const categorias = useMemo(() => ['Todas', ...new Set(platillos.map((p) => p.categoria))], [platillos]);
  const visibles = platillos.filter((p) => (categoria === 'Todas' || p.categoria === categoria)
    && (!q.trim() || p.nombre.toLowerCase().includes(q.trim().toLowerCase())));

  const cantidadDe = (id) => carrito.find((i) => i.id === id)?.cantidad ?? 0;
  const cambiarCantidad = (platillo, delta) => setCarrito((c) => {
    const actual = c.find((i) => i.id === platillo.id);
    const cantidad = Math.max(0, Math.min(topePorciones(platillo), (actual?.cantidad ?? 0) + delta));
    if (cantidad === 0) return c.filter((i) => i.id !== platillo.id);
    return actual ? c.map((i) => (i.id === platillo.id ? { ...i, cantidad } : i)) : [...c, { id: platillo.id, nombre: platillo.nombre, precio: platillo.precio, cantidad, nota: '' }];
  });
  const cambiarNota = (id, nota) => setCarrito((c) => c.map((i) => (i.id === id ? { ...i, nota } : i)));

  const costoEnvio = Math.max(0, Number(envio) || 0);
  const total = totalDomicilio(carrito, costoEnvio);
  const efectivo = metodo === 'Efectivo' && !anticipado;
  const cambio = cambioDomicilio(total, pagaCon);
  const direccionLista = direccionId !== NUEVA || nuevaDireccion.direccionCompleta.trim().length >= 5;

  const error =
    !buscado ? 'Busca primero al cliente por su teléfono'
      : !nombre.trim() ? 'Escribe el nombre del cliente'
        : !direccionLista ? 'Escribe la dirección completa'
          : carrito.length === 0 ? 'Agrega al menos un plato'
            : efectivo && pagaCon !== '' && cambio == null ? 'El billete no alcanza para el total'
              : null;

  const enviar = async () => {
    if (error || enviando) return;
    setEnviando(true);
    try {
      let clienteId = cliente?.id;
      let idDireccion = direccionId === NUEVA ? null : direccionId;
      if (!clienteId) {
        const r = await createClienteConDireccion({
          cliente: { nombre: nombre.trim(), telefono: telefono.replace(/\D/g, ''), email: null },
          direccion: nuevaDireccion,
        });
        clienteId = r.clienteId;
        idDireccion = r.direccionId;
      } else if (!idDireccion) {
        idDireccion = (await createDireccion(clienteId, nuevaDireccion)).id;
      }
      const creado = await createDomicilio({
        clienteId,
        direccionId: idDireccion,
        costoEnvio,
        metodoPago: metodo,
        pagadoAnticipado: anticipado,
        pagaCon: efectivo && pagaCon !== '' ? Number(pagaCon) : null,
        notasCliente: notas.trim(),
        detalles: carrito.map((i) => ({ platilloId: i.id, cantidad: i.cantidad, nota: i.nota.trim() })),
      });
      mostrar(`Domicilio #${creado?.id ?? ''} enviado a cocina`);
      onDomicilioCreado?.();
      onVolver?.();
    } catch (e) {
      mostrar(e.message, 'error');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-[1280px] px-4 py-6 lg:px-6 lg:py-8">
        <header className="mb-6">
          <Boton variante="fantasma" tamano="sm" onClick={onVolver}><ArrowLeft size={16} aria-hidden="true" />Domicilios</Boton>
          <h1 className="mt-2 text-[28px] font-extrabold leading-tight tracking-[-0.02em] text-espresso">Nuevo domicilio</h1>
          <p className="mt-1 text-[15px] text-gray-500">Toma el pedido por teléfono: llega a cocina apenas lo envías.</p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
          <div className="space-y-6">
            <Seccion numero={1} titulo="Cliente">
              <div className="flex flex-wrap items-end gap-2">
                <Campo
                  className="min-w-[220px] flex-1" label="Teléfono" inputMode="tel" autoFocus value={telefono} placeholder="3001234567"
                  onChange={(e) => { setTelefono(e.target.value); setBuscado(false); }}
                  onKeyDown={(e) => e.key === 'Enter' && buscar()}
                />
                <Boton onClick={buscar} disabled={buscando} className="h-11"><Search size={16} aria-hidden="true" />{buscando ? 'Buscando…' : 'Buscar'}</Boton>
              </div>
              {buscado && (
                <div className="mt-4">
                  {cliente
                    ? <p className="mb-2"><Chip tono="ok">Cliente registrado</Chip></p>
                    : <p className="mb-2"><Chip tono="info">Cliente nuevo</Chip></p>}
                  <Campo label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} disabled={!!cliente} maxLength={100} />
                </div>
              )}
            </Seccion>

            {buscado && (
              <Seccion numero={2} titulo="Dirección">
                {direcciones.length > 0 && (
                  <div className="mb-3 space-y-2" role="radiogroup" aria-label="Direcciones del cliente">
                    {direcciones.map((d) => (
                      <label key={d.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${direccionId === d.id ? 'border-espresso bg-orange-50' : 'border-gray-200'}`}>
                        <input type="radio" name="direccion" className="mt-1 accent-espresso" checked={direccionId === d.id} onChange={() => setDireccionId(d.id)} />
                        <span>
                          <span className="block text-[15px] font-bold text-espresso">{d.direccionCompleta}</span>
                          <span className="block text-[13px] text-gray-500">{[d.barrio, d.referenciasAdicionales].filter(Boolean).join(' · ')}</span>
                        </span>
                      </label>
                    ))}
                    <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${direccionId === NUEVA ? 'border-espresso bg-orange-50' : 'border-gray-200'}`}>
                      <input type="radio" name="direccion" className="accent-espresso" checked={direccionId === NUEVA} onChange={() => setDireccionId(NUEVA)} />
                      <span className="text-[15px] font-bold text-espresso">Otra dirección</span>
                    </label>
                  </div>
                )}
                {direccionId === NUEVA && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Campo className="sm:col-span-2" label="Dirección completa" value={nuevaDireccion.direccionCompleta} placeholder="Calle 20 # 15-30, apto 302" maxLength={200}
                      onChange={(e) => setNuevaDireccion((d) => ({ ...d, direccionCompleta: e.target.value }))} />
                    <Campo label="Barrio" value={nuevaDireccion.barrio} maxLength={100} onChange={(e) => setNuevaDireccion((d) => ({ ...d, barrio: e.target.value }))} />
                    <Campo label="Referencias" value={nuevaDireccion.referenciasAdicionales} placeholder="Casa azul, frente al parque" maxLength={200}
                      onChange={(e) => setNuevaDireccion((d) => ({ ...d, referenciasAdicionales: e.target.value }))} />
                  </div>
                )}
              </Seccion>
            )}

            <Seccion numero={3} titulo="Pedido">
              <label className="relative block">
                <span className="sr-only">Buscar plato</span>
                <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" aria-hidden="true" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar plato" className="h-11 w-full rounded-xl border border-gray-300 bg-white pl-10 pr-3.5 text-[15px] text-espresso placeholder:text-gray-500 focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-100" />
              </label>
              <div className="qp-rail -mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1">
                {categorias.map((c) => (
                  <button key={c} type="button" onClick={() => setCategoria(c)} aria-pressed={categoria === c} className={`h-9 shrink-0 rounded-full px-3.5 text-[13px] font-bold ${categoria === c ? 'bg-espresso text-white' : 'bg-gray-100 text-gray-600 hover:text-espresso'}`}>{c}</button>
                ))}
              </div>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {visibles.map((p) => {
                  const n = cantidadDe(p.id);
                  const sinStock = agotado(p);
                  const tope = topePorciones(p);
                  return (
                    <li key={p.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${n > 0 ? 'border-espresso' : 'border-gray-200'} ${sinStock ? 'opacity-60' : ''}`}>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-bold text-espresso">{p.nombre}</span>
                        <span className="tabular block text-[13px] text-gray-500">
                          {sinStock ? NO_DISPONIBLE : `${pesos(p.precio)}${p.porcionesDisponibles != null && p.porcionesDisponibles <= 5 ? ` · quedan ${p.porcionesDisponibles}` : ''}`}
                        </span>
                      </span>
                      {n > 0 && (
                        <>
                          <button type="button" onClick={() => cambiarCantidad(p, -1)} className="grid h-9 w-9 place-items-center rounded-full border border-gray-300 text-espresso" aria-label={`Quitar ${p.nombre}`}><Minus size={15} /></button>
                          <span className="tabular w-5 text-center text-[16px] font-extrabold text-espresso">{n}</span>
                        </>
                      )}
                      <button type="button" onClick={() => cambiarCantidad(p, 1)} disabled={sinStock || n >= tope} className="grid h-9 w-9 place-items-center rounded-full bg-espresso text-white disabled:bg-gray-200 disabled:text-gray-500" aria-label={`Agregar ${p.nombre}`}><Plus size={15} /></button>
                    </li>
                  );
                })}
              </ul>
            </Seccion>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24" aria-label="Resumen del domicilio">
            <section className="rounded-2xl border border-gray-200 bg-white p-5">
              <h2 className="text-[18px] font-extrabold text-espresso">Resumen</h2>
              {carrito.length === 0 ? (
                <p className="mt-2 text-[14px] text-gray-500">Agrega los platos que pide el cliente.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {carrito.map((i) => (
                    <li key={i.id}>
                      <div className="flex items-center gap-2 text-[14px]">
                        <span className="tabular font-bold text-orange-700">{i.cantidad}×</span>
                        <span className="min-w-0 flex-1 truncate font-semibold text-espresso">{i.nombre}</span>
                        <span className="tabular text-espresso">{pesos(i.precio * i.cantidad)}</span>
                        <button type="button" onClick={() => setCarrito((c) => c.filter((x) => x.id !== i.id))} className="grid h-8 w-8 place-items-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-red-700" aria-label={`Quitar ${i.nombre} del pedido`}><Trash2 size={14} /></button>
                      </div>
                      <input value={i.nota} onChange={(e) => cambiarNota(i.id, e.target.value)} placeholder="Nota para cocina (sin cebolla…)" maxLength={200} aria-label={`Nota de ${i.nombre}`} className="mt-1 h-9 w-full rounded-lg border border-gray-200 px-2.5 text-[13px] text-espresso placeholder:text-gray-400" />
                    </li>
                  ))}
                </ul>
              )}
              <Campo className="mt-4" label="Costo del envío" type="number" min="0" step="500" inputMode="numeric" value={envio} onChange={(e) => setEnvio(e.target.value)} />
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-5" aria-label="Pago">
              <h2 className="mb-3 text-[18px] font-extrabold text-espresso">Pago</h2>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Método de pago">
                {METODOS_DOMICILIO.map((m) => (
                  <button key={m.id} type="button" role="radio" aria-checked={metodo === m.id} className={opcion(metodo === m.id)} onClick={() => setMetodo(m.id)}>{m.label}</button>
                ))}
              </div>
              <label className="mt-3 flex items-center gap-2 text-[14px] font-semibold text-espresso">
                <input type="checkbox" className="h-5 w-5 accent-espresso" checked={anticipado} onChange={(e) => setAnticipado(e.target.checked)} />
                Ya pagó (transferencia antes de salir)
              </label>
              {efectivo && (
                <div className="mt-3 rounded-xl bg-gray-100 p-3">
                  <Campo label="Paga con (billete)" type="number" min="0" step="1000" inputMode="numeric" value={pagaCon} onChange={(e) => setPagaCon(e.target.value)} placeholder="Opcional" />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {billetesSugeridos(total).filter((b) => b > total).map((b) => (
                      <button key={b} type="button" onClick={() => setPagaCon(String(b))} className="tabular h-8 rounded-full border border-gray-300 bg-white px-3 text-[13px] font-bold text-espresso">{pesos(b)}</button>
                    ))}
                  </div>
                  {pagaCon !== '' && (
                    <p className={`tabular mt-2 text-[14px] font-bold ${cambio == null ? 'text-red-700' : 'text-espresso'}`}>
                      {cambio == null ? 'No alcanza para el total' : `Llevar ${pesos(cambio)} de cambio`}
                    </p>
                  )}
                </div>
              )}
              <label className="mt-3 block">
                <span className="mb-1.5 block text-[13px] font-semibold text-gray-600">Nota del cliente</span>
                <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} maxLength={500} className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-[15px] text-espresso focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-100" placeholder="Timbre dañado, llamar al llegar…" />
              </label>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-5">
              <dl className="tabular space-y-1 text-[14px]">
                <div className="flex justify-between text-gray-600"><dt>Productos</dt><dd>{pesos(total - costoEnvio)}</dd></div>
                <div className="flex justify-between text-gray-600"><dt>Envío</dt><dd>{pesos(costoEnvio)}</dd></div>
                <div className="flex items-baseline justify-between border-t border-gray-200 pt-2">
                  <dt className="text-[15px] font-bold text-espresso">Total</dt>
                  <dd className="text-[30px] font-extrabold tracking-[-0.03em] text-espresso">{pesos(total)}</dd>
                </div>
              </dl>
              {error && <p className="mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-amber-800"><MapPin size={14} aria-hidden="true" />{error}</p>}
              <Boton tamano="lg" className="mt-3 w-full" onClick={enviar} disabled={!!error || enviando}>
                {enviando ? 'Enviando…' : 'Enviar a cocina'}
              </Boton>
            </section>
          </aside>
        </div>
      </main>
      {aviso}
    </div>
  );
}
