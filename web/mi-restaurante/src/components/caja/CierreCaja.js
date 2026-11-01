// Cierre del día como se hace en la caja: se abre con una base, al final se cuenta el cajón y se
// compara con lo que dice el sistema (efectivo, datáfono y banco). Lo que falta resolver antes de
// cerrar (mesas sin cobrar, domicilios en curso, efectivo de los domiciliarios) va arriba.
import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Banknote, CheckCircle2, CreditCard, Landmark, Lock, Printer, Unlock } from 'lucide-react';
import * as api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Boton, BotonConfirmar, Campo, Cargando, Chip } from '../inventario/ui';
import { arqueo, contarBilletes, DENOMINACIONES, hora, pesos } from '../../utils/caja';
import { etiquetaImpuesto, impuestoIncluido } from '../../utils/impuestos';
import { htmlCierre, imprimirHtml } from '../../utils/recibo';

const TONO = {
  cuadra: 'bg-green-50 text-green-800',
  sobra: 'bg-amber-50 text-amber-800',
  falta: 'bg-red-50 text-red-800',
};

const textoDiferencia = ({ estado, diferencia }, cuadra = 'Cuadra') =>
  estado === 'cuadra' ? cuadra : estado === 'sobra' ? `Sobran ${pesos(diferencia)}` : `Faltan ${pesos(-diferencia)}`;

const valor = (v) => (v == null ? '' : String(v));

/** Una fila del arqueo: signo, concepto y valor; la fila final va resaltada. */
function Fila({ signo, concepto, detalle, monto, fuerte, children }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${fuerte ? 'bg-gray-100' : ''}`}>
      <span className={`tabular grid h-7 w-7 shrink-0 place-items-center rounded-full text-[15px] font-extrabold ${signo === '−' ? 'bg-red-50 text-red-700' : signo === '=' ? 'bg-espresso text-white' : 'bg-green-50 text-green-700'}`} aria-hidden="true">{signo}</span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[14px] ${fuerte ? 'font-extrabold text-espresso' : 'font-semibold text-gray-700'}`}>{concepto}</span>
        {detalle && <span className="block text-[12px] text-gray-500">{detalle}</span>}
        {children}
      </span>
      {monto != null && <span className={`tabular shrink-0 ${fuerte ? 'text-[20px] font-extrabold text-espresso' : 'text-[15px] font-bold text-espresso'}`}>{pesos(monto)}</span>}
    </div>
  );
}

const campoMonto = 'tabular mt-1.5 h-10 w-full max-w-[200px] rounded-xl border border-gray-300 bg-white px-3 text-[15px] text-espresso focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-100 disabled:bg-gray-100';

export default function CierreCaja({ fecha, onFecha, version, mostrar, onLiquidar }) {
  const { usuario } = useAuth();
  const esAdmin = usuario?.rol?.toLowerCase() === 'administrador';
  const [cierre, setCierre] = useState(null);
  const [base, setBase] = useState('');
  const [propinasPagadas, setPropinasPagadas] = useState('');
  const [retiros, setRetiros] = useState('');
  const [contado, setContado] = useState('');
  const [datafono, setDatafono] = useState('');
  const [banco, setBanco] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [conteo, setConteo] = useState({});
  const [porBilletes, setPorBilletes] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [diaCargado, setDiaCargado] = useState(null);

  const cargar = useCallback(() => {
    api.getCierreCaja(fecha)
      .then(setCierre)
      .catch((e) => mostrar(e.message, 'error'));
  }, [fecha, mostrar]);
  useEffect(() => { cargar(); }, [cargar, version]);

  // Lo guardado del día llena los campos una vez; las recargas en tiempo real no pisan lo que se escribe.
  const llenar = (c) => {
    setBase(c.baseRegistrada ? valor(c.base) : '');
    setPropinasPagadas(c.propinasPagadas ? valor(c.propinasPagadas) : '');
    setRetiros(c.retiros ? valor(c.retiros) : '');
    setContado(valor(c.efectivoContado));
    setDatafono(valor(c.tarjetaDatafono));
    setBanco(valor(c.transferenciasBanco));
    setObservaciones(c.observaciones ?? '');
    setConteo({});
    setPorBilletes(false);
  };
  useEffect(() => {
    if (cierre && diaCargado !== cierre.fecha) {
      setDiaCargado(cierre.fecha);
      llenar(cierre);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cierre, diaCargado]);

  if (!cierre) return <Cargando filas={4} />;

  const cerrada = cierre.cerrada;
  const datos = { ...cierre, base: Number(base) || 0 };
  const a = arqueo(datos, { propinasPagadas, retiros, contado, datafono, banco });
  const pendientes = [
    cierre.esHoy && cierre.cuentasAbiertas > 0 && `Quedan ${cierre.cuentasAbiertas} mesa${cierre.cuentasAbiertas === 1 ? '' : 's'} sin cobrar por ${pesos(cierre.valorAbierto)}. Cóbralas antes de cerrar.`,
    cierre.esHoy && cierre.domiciliosEnCurso > 0 && `${cierre.domiciliosEnCurso} domicilio${cierre.domiciliosEnCurso === 1 ? ' sigue' : 's siguen'} en curso.`,
  ].filter(Boolean);
  const vendido = cierre.ventasMesa + cierre.ventasDomicilio + cierre.envios;

  const actualizarConteo = (d, n) => {
    const nuevo = { ...conteo, [d]: n };
    setConteo(nuevo);
    setContado(String(contarBilletes(nuevo)));
  };

  const guardarBase = async () => {
    try {
      setCierre(await api.abrirCaja(fecha, Number(base) || 0));
      mostrar('Base de la caja guardada');
    } catch (e) {
      mostrar(e.message, 'error');
    }
  };

  const cerrar = async () => {
    if (contado === '' || enviando) return;
    setEnviando(true);
    try {
      if (!cierre.baseRegistrada || Number(base) !== cierre.base) await api.abrirCaja(fecha, Number(base) || 0);
      const c = await api.cerrarCaja({
        fecha,
        efectivoContado: Number(contado) || 0,
        propinasPagadas: Number(propinasPagadas) || 0,
        retiros: Number(retiros) || 0,
        tarjetaDatafono: datafono === '' ? null : Number(datafono),
        transferenciasBanco: banco === '' ? null : Number(banco),
        observaciones: observaciones.trim() || null,
      });
      setCierre(c);
      llenar(c);
      mostrar('Cierre guardado');
    } catch (e) {
      mostrar(e.message, 'error');
    } finally {
      setEnviando(false);
    }
  };

  const reabrir = async () => {
    try {
      await api.reabrirCaja(fecha);
      mostrar('Caja reabierta');
      cargar();
    } catch (e) {
      mostrar(e.message, 'error');
    }
  };

  const imprimir = () => imprimirHtml(htmlCierre(cierre, {
    ...a, base: datos.base, propinasPagadas: Number(propinasPagadas) || 0, retiros: Number(retiros) || 0,
    contado: contado === '' ? null : Number(contado), datafono: datafono === '' ? null : Number(datafono), banco: banco === '' ? null : Number(banco),
    observaciones,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-gray-600">Día</span>
            <input type="date" value={fecha} onChange={(e) => e.target.value && onFecha(e.target.value)} className="h-11 rounded-xl border border-gray-300 bg-white px-3.5 text-[15px] text-espresso focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-100" />
          </label>
          {cerrada
            ? <Chip tono="ok"><Lock size={13} aria-hidden="true" />Cerrada{cierre.cerradaPor ? ` por ${cierre.cerradaPor}` : ''}{cierre.fechaCierre ? ` · ${hora(cierre.fechaCierre)}` : ''}</Chip>
            : cierre.baseRegistrada
              ? <Chip tono="info"><Unlock size={13} aria-hidden="true" />Abierta con {pesos(cierre.base)}</Chip>
              : <Chip tono="aviso">Sin base registrada</Chip>}
        </div>
        <div className="flex gap-2">
          {cerrada && esAdmin && (
            <BotonConfirmar confirmar="Toca otra vez para reabrir" onConfirmar={reabrir} varianteInicial="secundario" tamano="md">Reabrir caja</BotonConfirmar>
          )}
          <Boton variante="secundario" onClick={imprimir}><Printer size={16} aria-hidden="true" />Imprimir cierre</Boton>
        </div>
      </div>

      {(pendientes.length > 0 || (cierre.efectivoEnDomiciliarios ?? []).length > 0) && !cerrada && (
        <section className="space-y-2 rounded-2xl bg-amber-50 px-4 py-3 text-[14px] text-amber-900" aria-label="Antes de cerrar">
          <p className="flex items-center gap-2 font-bold"><AlertTriangle size={18} aria-hidden="true" />Antes de cerrar</p>
          {pendientes.map((p) => <p key={p}>{p}</p>)}
          {(cierre.efectivoEnDomiciliarios ?? []).map((l) => (
            <div key={l.domiciliarioId} className="flex flex-wrap items-center gap-2">
              <span className="flex-1">{l.nombre} tiene {pesos(l.total)} en efectivo de {l.entregas} entrega{l.entregas === 1 ? '' : 's'}: no está en el cajón.</span>
              {onLiquidar && (
                <BotonConfirmar confirmar={`Toca otra vez: recibí ${pesos(l.total)}`} onConfirmar={() => onLiquidar(l)} varianteInicial="secundario">Recibir efectivo</BotonConfirmar>
              )}
            </div>
          ))}
        </section>
      )}

      <dl className="grid grid-cols-2 divide-gray-200 overflow-hidden rounded-2xl border border-gray-200 bg-white lg:grid-cols-4 lg:divide-x">
        <div className="col-span-2 border-b border-gray-200 p-5 lg:col-span-1 lg:border-b-0">
          <dt className="text-[13px] font-semibold text-gray-500">Vendido en el día</dt>
          <dd className="tabular mt-1 text-[30px] font-extrabold tracking-[-0.02em] text-espresso">{pesos(vendido)}</dd>
          <dd className="tabular text-[13px] text-gray-500">Con propinas: {pesos(cierre.totalRecaudado)}</dd>
        </div>
        <div className="p-5">
          <dt className="text-[13px] font-semibold text-gray-500">Cuentas de mesa</dt>
          <dd className="tabular mt-1 text-[24px] font-extrabold text-espresso">{cierre.cuentasMesa}</dd>
          <dd className="tabular text-[13px] text-gray-500">{pesos(cierre.ventasMesa)}</dd>
        </div>
        <div className="p-5">
          <dt className="text-[13px] font-semibold text-gray-500">Domicilios entregados</dt>
          <dd className="tabular mt-1 text-[24px] font-extrabold text-espresso">{cierre.domicilios}</dd>
          <dd className="tabular text-[13px] text-gray-500">{pesos(cierre.ventasDomicilio + cierre.envios)}</dd>
        </div>
        <div className="col-span-2 border-t border-gray-200 p-5 lg:col-span-1 lg:border-t-0">
          <dt className="text-[13px] font-semibold text-gray-500">Propinas</dt>
          <dd className="tabular mt-1 text-[24px] font-extrabold text-espresso">{pesos(cierre.propinas)}</dd>
          <dd className="tabular text-[13px] text-gray-500">{pesos(cierre.propinasEfectivo ?? 0)} en efectivo · se reparten al equipo</dd>
        </div>
      </dl>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white" aria-label="Efectivo del cajón">
          <header className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
            <Banknote size={20} className="text-green-700" aria-hidden="true" />
            <div>
              <h2 className="text-[17px] font-extrabold text-espresso">Efectivo del cajón</h2>
              <p className="text-[13px] text-gray-500">Lo que debe haber en el cajón, paso a paso.</p>
            </div>
          </header>
          <div className="divide-y divide-gray-200">
            <Fila signo="+" concepto="Base con que se abrió la caja" detalle="El efectivo para dar cambio que se dejó al abrir">
              <span className="flex flex-wrap items-center gap-2">
                <input aria-label="Base con que se abrió la caja" type="number" min="0" step="1000" inputMode="numeric" value={base} disabled={cerrada} onChange={(e) => setBase(e.target.value)} className={campoMonto} placeholder="0" />
                {!cerrada && Number(base) !== (cierre.baseRegistrada ? cierre.base : -1) && base !== '' && (
                  <Boton variante="secundario" tamano="sm" className="mt-1.5" onClick={guardarBase}>Guardar base</Boton>
                )}
              </span>
            </Fila>
            <Fila signo="+" concepto="Cobros de mesa en efectivo" detalle={`Incluye ${pesos(cierre.propinasEfectivo ?? 0)} de propinas en efectivo`} monto={cierre.efectivoMesa ?? 0} />
            <Fila signo="+" concepto="Efectivo que entregaron los domiciliarios" detalle="O que se cobró en caja al entregar" monto={cierre.efectivoDomicilios ?? 0} />
            <Fila signo="−" concepto="Propinas pagadas al equipo" detalle="Si ya repartiste propinas con el efectivo del cajón">
              <span className="flex flex-wrap items-center gap-2">
                <input aria-label="Propinas pagadas al equipo" type="number" min="0" step="100" inputMode="numeric" value={propinasPagadas} disabled={cerrada} onChange={(e) => setPropinasPagadas(e.target.value)} className={campoMonto} placeholder="0" />
                {!cerrada && cierre.propinas > 0 && (
                  <Boton variante="fantasma" tamano="sm" className="mt-1.5" onClick={() => setPropinasPagadas(String(cierre.propinas))}>Todas ({pesos(cierre.propinas)})</Boton>
                )}
              </span>
            </Fila>
            <Fila signo="−" concepto="Gastos o retiros del cajón" detalle="Compras pagadas con efectivo de la caja, consignaciones">
              <input aria-label="Gastos o retiros del cajón" type="number" min="0" step="100" inputMode="numeric" value={retiros} disabled={cerrada} onChange={(e) => setRetiros(e.target.value)} className={campoMonto} placeholder="0" />
            </Fila>
            <Fila signo="=" concepto="Debe haber en el cajón" monto={a.esperado} fuerte />
          </div>
          <div className="border-t border-gray-200 p-4">
            <div className="flex flex-wrap items-end gap-3">
              <Campo className="min-w-[200px] flex-1" label="Efectivo contado" type="number" min="0" step="100" inputMode="numeric" value={contado} disabled={cerrada} onChange={(e) => { setContado(e.target.value); setConteo({}); }} />
              {!cerrada && (
                <Boton variante="secundario" onClick={() => setPorBilletes((v) => !v)} aria-expanded={porBilletes}>{porBilletes ? 'Ocultar billetes' : 'Contar por billetes'}</Boton>
              )}
            </div>
            {porBilletes && !cerrada && (
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="Conteo por billetes y monedas">
                {DENOMINACIONES.map((d) => (
                  <label key={d} className="flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-2">
                    <span className="tabular w-20 text-[13px] font-bold text-espresso">{pesos(d)}</span>
                    <span className="text-[13px] text-gray-500">×</span>
                    <input type="number" min="0" inputMode="numeric" value={conteo[d] ?? ''} onChange={(e) => actualizarConteo(d, e.target.value)} className="tabular h-9 w-16 rounded-lg border border-gray-300 bg-white px-2 text-center text-[14px] text-espresso" aria-label={`Cantidad de ${pesos(d)}`} />
                  </label>
                ))}
              </div>
            )}
            {a.efectivo.diferencia != null && (
              <p className={`tabular mt-3 rounded-xl px-3.5 py-3 text-[16px] font-extrabold ${TONO[a.efectivo.estado]}`} role="status">
                {textoDiferencia(a.efectivo, 'La caja cuadra')}
              </p>
            )}
          </div>
        </section>

        <div className="space-y-6">
          <section className="rounded-2xl border border-gray-200 bg-white p-4" aria-label="Tarjeta y transferencias">
            <h2 className="text-[17px] font-extrabold text-espresso">Tarjeta y transferencias</h2>
            <p className="mt-0.5 text-[13px] text-gray-500">Compara con el cierre del datáfono y con lo que muestra el banco o Nequi.</p>
            <div className="mt-4 space-y-4">
              {[
                { id: 'tarjeta', icono: CreditCard, titulo: 'Tarjeta (datáfono)', sistema: cierre.tarjeta ?? 0, etiqueta: 'Total del cierre del datáfono', v: datafono, set: setDatafono },
                { id: 'transferencias', icono: Landmark, titulo: 'Transferencias y QR', sistema: cierre.transferencias ?? 0, etiqueta: 'Lo que llegó al banco', v: banco, set: setBanco },
              ].map(({ id, icono: Icono, titulo, sistema, etiqueta, v, set }) => (
                <div key={id}>
                  <p className="flex items-center gap-2 text-[14px] font-bold text-espresso">
                    <Icono size={16} aria-hidden="true" />{titulo}
                    <span className="tabular ml-auto">{pesos(sistema)}</span>
                  </p>
                  <Campo className="mt-1.5" label={etiqueta} type="number" min="0" step="100" inputMode="numeric" value={v} disabled={cerrada} onChange={(e) => set(e.target.value)} />
                  {a[id].diferencia != null && (
                    <p className={`tabular mt-1.5 rounded-lg px-3 py-1.5 text-[13px] font-bold ${TONO[a[id].estado]}`}>{textoDiferencia(a[id])}</p>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-4" aria-label="Cerrar la caja">
            {cerrada ? (
              <div className="flex items-start gap-3">
                <CheckCircle2 size={22} className="mt-0.5 shrink-0 text-green-700" aria-hidden="true" />
                <div>
                  <p className="text-[15px] font-extrabold text-espresso">Caja cerrada</p>
                  <p className="text-[13px] text-gray-500">
                    {esAdmin ? 'Si se cobró algo después, reábrela y vuelve a cerrarla.' : 'Si hay que corregirla, pide al administrador que la reabra.'}
                  </p>
                  {cierre.observaciones && <p className="mt-2 text-[14px] text-gray-700">“{cierre.observaciones}”</p>}
                </div>
              </div>
            ) : (
              <>
                <label className="block">
                  <span className="mb-1.5 block text-[13px] font-semibold text-gray-600">Observaciones</span>
                  <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} maxLength={500} rows={2} className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-[15px] text-espresso focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-100" placeholder="Por qué sobra o falta, novedades del turno" />
                </label>
                <BotonConfirmar
                  confirmar="Toca otra vez: cerrar la caja"
                  onConfirmar={cerrar}
                  varianteInicial="primario"
                  tamano="lg"
                  className="mt-3 w-full"
                  disabled={contado === '' || enviando}
                >
                  {enviando ? 'Cerrando…' : contado === '' ? 'Cuenta el cajón para cerrar' : 'Cerrar la caja'}
                </BotonConfirmar>
              </>
            )}
          </section>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white" aria-label="Por método de pago">
        <h2 className="border-b border-gray-200 px-4 py-3 text-[17px] font-extrabold text-espresso">Por método de pago</h2>
        <div className="overflow-x-auto">
          <table className="tabular w-full text-[14px]">
            <thead>
              <tr className="text-left text-[12px] font-bold text-gray-500">
                <th className="px-4 py-2">Método</th>
                <th className="px-4 py-2 text-right">Mesa</th>
                <th className="px-4 py-2 text-right">Propinas</th>
                <th className="px-4 py-2 text-right">Domicilios</th>
                <th className="px-4 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {cierre.porMetodo.map((m) => (
                <tr key={m.metodo}>
                  <td className="px-4 py-3 font-bold text-espresso">{m.metodo}<span className="block text-[12px] font-medium text-gray-500">{m.cobros} cobro{m.cobros === 1 ? '' : 's'}</span></td>
                  <td className="px-4 py-3 text-right">{pesos(m.mesa)}</td>
                  <td className="px-4 py-3 text-right">{pesos(m.propinas)}</td>
                  <td className="px-4 py-3 text-right">{pesos(m.domicilios)}</td>
                  <td className="px-4 py-3 text-right font-extrabold text-espresso">{pesos(m.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="tabular space-y-1 border-t border-gray-200 px-4 py-3 text-[13px] text-gray-600">
          <div className="flex justify-between"><dt>Facturas emitidas</dt><dd>{cierre.facturasEmitidas ? `${cierre.facturasEmitidas} · ${cierre.primeraFactura} a ${cierre.ultimaFactura}` : 'Ninguna'}</dd></div>
          <div className="flex justify-between"><dt>{etiquetaImpuesto()} en las ventas</dt><dd>{pesos(impuestoIncluido(cierre.ventasMesa + cierre.ventasDomicilio))}</dd></div>
          <div className="flex justify-between"><dt>Envíos de domicilio</dt><dd>{pesos(cierre.envios)}</dd></div>
          <div className="flex justify-between"><dt>Pedidos anulados</dt><dd>{cierre.pedidosAnulados} · {pesos(cierre.valorAnulado)}</dd></div>
        </dl>
      </section>
    </div>
  );
}
