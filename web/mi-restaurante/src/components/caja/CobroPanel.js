// Cobro de la cuenta de una mesa: qué pedidos se pagan (todos o algunos, para dividir la
// cuenta), propina voluntaria, método, cambio en efectivo y datos de la factura.
import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Printer } from 'lucide-react';
import * as api from '../../services/api';
import { Boton, Campo, Chip, Panel } from '../inventario/ui';
import {
  billetesSugeridos, cambio, cobrable, consumoPedido, estadoPedido, hora, METODOS, pesos, propinaSugerida, validarNit,
} from '../../utils/caja';
import { etiquetaImpuesto, impuestoIncluido } from '../../utils/impuestos';
import { htmlFactura, imprimirHtml } from '../../utils/recibo';

const opcion = (activa) =>
  `h-11 rounded-xl border px-3 text-[14px] font-bold transition-colors ${activa ? 'border-espresso bg-espresso text-white' : 'border-gray-300 bg-white text-espresso hover:border-gray-400'}`;

function Resultado({ cobro, onListo }) {
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
      <div className="mt-6 flex w-full gap-2">
        <Boton variante="secundario" tamano="lg" className="flex-1" onClick={() => imprimirHtml(htmlFactura(factura, cobro))}>
          <Printer size={18} aria-hidden="true" />Imprimir factura
        </Boton>
        <Boton tamano="lg" className="flex-1" onClick={onListo}>Listo</Boton>
      </div>
    </div>
  );
}

export default function CobroPanel({ cuenta, onCerrar, onCobrado, mostrar }) {
  const [seleccion, setSeleccion] = useState([]);
  const [propinaModo, setPropinaModo] = useState('ninguna');
  const [propinaOtra, setPropinaOtra] = useState('');
  const [metodo, setMetodo] = useState('Efectivo');
  const [recibido, setRecibido] = useState('');
  const [conDatos, setConDatos] = useState(false);
  const [nit, setNit] = useState('');
  const [nombre, setNombre] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);

  // Al abrir otra mesa se arranca de cero con todos los pedidos cobrables marcados.
  const mesaId = cuenta?.mesaId;
  useEffect(() => {
    if (!cuenta) return;
    setSeleccion(cuenta.pedidos.filter(cobrable).map((p) => p.id));
    setPropinaModo('ninguna'); setPropinaOtra(''); setMetodo('Efectivo'); setRecibido('');
    setConDatos(false); setNit(''); setNombre(''); setResultado(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesaId]);

  const pedidos = useMemo(() => cuenta?.pedidos ?? [], [cuenta]);
  const elegidos = pedidos.filter((p) => seleccion.includes(p.id) && cobrable(p));
  const consumo = elegidos.reduce((t, p) => t + consumoPedido(p), 0);
  const sugerida = propinaSugerida(consumo);
  const propina = propinaModo === 'sugerida' ? sugerida : propinaModo === 'otra' ? Math.max(0, Math.round(Number(propinaOtra) || 0)) : 0;
  const total = consumo + propina;
  const vuelto = cambio(recibido, total);
  const efectivo = metodo === 'Efectivo';

  const error =
    elegidos.length === 0 ? 'Marca al menos un pedido'
      : propina > consumo ? 'La propina no puede ser mayor que el consumo'
        : efectivo && recibido !== '' && vuelto < 0 ? `Faltan ${pesos(-vuelto)}`
          : conDatos && !validarNit(nit) ? 'La cédula o NIT solo lleva números'
            : null;

  const alternar = (id) => setSeleccion((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const cobrar = async () => {
    if (error || enviando) return;
    setEnviando(true);
    try {
      const res = await api.cobrarCuenta({
        pedidoIds: elegidos.map((p) => p.id),
        metodoPago: metodo,
        propina,
        recibido: efectivo && recibido !== '' ? Number(recibido) : null,
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

  const restantes = pedidos.length - elegidos.length;

  return (
    <Panel
      abierto={!!cuenta}
      onCerrar={onCerrar}
      titulo={cuenta ? `Cobrar mesa ${cuenta.mesaNumero}` : ''}
      subtitulo={cuenta && `${pedidos.length} pedido${pedidos.length === 1 ? '' : 's'} · desde las ${hora(cuenta.desde)}`}
      ancho="md:w-[560px]"
      pie={!resultado && cuenta && (
        <div>
          {error && consumo > 0 && <p className="mb-2 text-center text-[13px] font-semibold text-red-700" role="alert">{error}</p>}
          <Boton tamano="lg" className="w-full" onClick={cobrar} disabled={!!error || enviando}>
            {enviando ? 'Cobrando…' : `Cobrar ${pesos(total)}`}
          </Boton>
        </div>
      )}
    >
      {cuenta && (resultado ? (
        <Resultado cobro={resultado} onListo={onCerrar} />
      ) : (
        <div className="space-y-6 p-5">
          <section aria-label="Pedidos de la mesa">
            <h3 className="mb-2 text-[15px] font-bold text-espresso">Qué se cobra</h3>
            <ul className="divide-y divide-gray-200 overflow-hidden rounded-2xl border border-gray-200">
              {pedidos.map((p) => {
                const puede = cobrable(p);
                const estado = estadoPedido(p.estado);
                return (
                  <li key={p.id} className={puede ? '' : 'bg-gray-50'}>
                    <label className={`flex gap-3 px-4 py-3 ${puede ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                      <input
                        type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-espresso"
                        checked={puede && seleccion.includes(p.id)} disabled={!puede}
                        onChange={() => alternar(p.id)}
                        aria-label={`Cobrar el pedido ${p.id}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="tabular text-[15px] font-bold text-espresso">Pedido #{p.id}</span>
                          <span className="tabular text-[13px] text-gray-500">{hora(p.fecha)} · {p.meseroNombre === 'Cliente QR' ? 'por QR' : p.meseroNombre}</span>
                          <Chip tono={estado.tono}>{estado.texto}</Chip>
                        </span>
                        <span className="mt-1 block text-[14px] text-gray-600">
                          {p.detalles.map((d) => `${d.cantidad} × ${d.platilloNombre}`).join(' · ')}
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
            {restantes > 0 && elegidos.length > 0 && cuenta.enCocina < restantes && (
              <p className="mt-2 text-[13px] text-gray-500">Los pedidos sin marcar quedan en la cuenta de la mesa: sirve para dividir la cuenta.</p>
            )}
          </section>

          <section aria-label="Propina">
            <h3 className="mb-2 text-[15px] font-bold text-espresso">Propina voluntaria</h3>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Propina">
              <button type="button" role="radio" aria-checked={propinaModo === 'ninguna'} className={opcion(propinaModo === 'ninguna')} onClick={() => setPropinaModo('ninguna')}>Sin propina</button>
              <button type="button" role="radio" aria-checked={propinaModo === 'sugerida'} className={opcion(propinaModo === 'sugerida')} onClick={() => setPropinaModo('sugerida')}>
                10 % <span className="tabular font-semibold opacity-80">{pesos(sugerida)}</span>
              </button>
              <button type="button" role="radio" aria-checked={propinaModo === 'otra'} className={opcion(propinaModo === 'otra')} onClick={() => setPropinaModo('otra')}>Otro valor</button>
            </div>
            {propinaModo === 'otra' && (
              <Campo className="mt-2" label="Valor de la propina" type="number" min="0" step="100" inputMode="numeric" value={propinaOtra} onChange={(e) => setPropinaOtra(e.target.value)} autoFocus />
            )}
            <p className="mt-1.5 text-[12px] text-gray-500">Pregúntale al cliente: la propina es opcional.</p>
          </section>

          <section aria-label="Método de pago">
            <h3 className="mb-2 text-[15px] font-bold text-espresso">Cómo paga</h3>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Método de pago">
              {METODOS.map((m) => (
                <button key={m.id} type="button" role="radio" aria-checked={metodo === m.id} className={opcion(metodo === m.id)} onClick={() => setMetodo(m.id)}>
                  {m.label}
                </button>
              ))}
            </div>
            {efectivo && (
              <div className="mt-3 rounded-2xl bg-gray-100 p-4">
                <Campo label="Recibido del cliente" type="number" min="0" step="100" inputMode="numeric" value={recibido} onChange={(e) => setRecibido(e.target.value)} placeholder={String(total)} />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {billetesSugeridos(total).map((b) => (
                    <button key={b} type="button" onClick={() => setRecibido(String(b))} className="tabular h-9 rounded-full border border-gray-300 bg-white px-3 text-[13px] font-bold text-espresso hover:border-gray-400">
                      {b === total ? 'Exacto' : pesos(b)}
                    </button>
                  ))}
                </div>
                {recibido !== '' && (
                  <p className={`tabular mt-3 text-[15px] font-bold ${vuelto < 0 ? 'text-red-700' : 'text-espresso'}`}>
                    {vuelto < 0 ? `Faltan ${pesos(-vuelto)}` : `Cambio: ${pesos(vuelto)}`}
                  </p>
                )}
              </div>
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
      ))}
    </Panel>
  );
}
