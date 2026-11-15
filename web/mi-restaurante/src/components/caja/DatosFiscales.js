// Datos fiscales del restaurante (solo administrador): el vendedor que sale en la tirilla, el
// impuesto, las numeraciones autorizadas por la DIAN y el interruptor de facturación electrónica.
import React, { useEffect, useState } from 'react';
import { CheckCircle2, Pencil, Plus, TriangleAlert } from 'lucide-react';
import * as api from '../../services/api';
import { Boton, Campo, Cargando, Chip, Lista, Selector, Vacio } from '../inventario/ui';
import { digitoVerificacion, nombreTipoDocumento } from '../../utils/facturacion';

const IMPUESTOS = [
  { id: 'INC', label: 'Impuesto al consumo (restaurantes)', tarifa: 8 },
  { id: 'IVA', label: 'IVA (franquicias)', tarifa: 19 },
  { id: 'Ninguno', label: 'No responsable (no cobra impuesto)', tarifa: 0 },
];

const RANGO_NUEVO = { id: 0, tipoDocumento: 'POS', resolucion: '', prefijo: '', desde: '', hasta: '', fechaDesde: '', fechaHasta: '', activa: true };

const soloFecha = (iso) => (iso ? String(iso).slice(0, 10) : '');
const fechaLegible = (iso) => (iso ? soloFecha(iso).split('-').reverse().join('/') : 'sin fecha');

function Seccion({ titulo, detalle, children }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5">
      <h2 className="text-[17px] font-extrabold text-espresso">{titulo}</h2>
      {detalle && <p className="mt-1 text-[13px] text-gray-500">{detalle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function FormularioRango({ rango, onGuardado, onCancelar, mostrar }) {
  const [r, setR] = useState(rango);
  const [enviando, setEnviando] = useState(false);
  const campo = (k) => (e) => setR((x) => ({ ...x, [k]: e.target.value }));
  const error = !r.prefijo.trim() ? 'Escribe el prefijo de la resolución'
    : !(Number(r.desde) >= 1) || !(Number(r.hasta) >= Number(r.desde)) ? 'Revisa el rango: desde y hasta'
      : r.fechaDesde && r.fechaHasta && r.fechaHasta < r.fechaDesde ? 'La vigencia termina antes de empezar'
        : null;

  const guardar = async (e) => {
    e.preventDefault();
    if (error || enviando) return;
    setEnviando(true);
    try {
      await api.guardarNumeracion({
        ...r, prefijo: r.prefijo.trim(), resolucion: r.resolucion?.trim() || null, desde: Number(r.desde), hasta: Number(r.hasta),
        fechaDesde: r.fechaDesde || null, fechaHasta: r.fechaHasta || null,
      });
      mostrar('Numeración guardada');
      onGuardado();
    } catch (err) {
      mostrar(err.message, 'error');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={guardar} className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <p className="text-[15px] font-bold text-espresso">{r.id ? 'Corregir numeración' : 'Nueva numeración'}</p>
      <p className="mt-1 text-[13px] text-gray-500">Copia los datos tal como aparecen en la autorización de numeración de la DIAN.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Selector label="Documento" value={r.tipoDocumento} onChange={campo('tipoDocumento')}>
          <option value="POS">Documento equivalente POS</option>
          <option value="FEV">Factura electrónica de venta</option>
        </Selector>
        <Campo label="Número de resolución" value={r.resolucion ?? ''} onChange={campo('resolucion')} maxLength={50} inputMode="numeric" />
        <Campo label="Prefijo" value={r.prefijo} onChange={campo('prefijo')} maxLength={6} placeholder="POS" />
        <label className="flex items-end gap-3 pb-2.5">
          <input type="checkbox" className="h-5 w-5 accent-espresso" checked={r.activa} onChange={(e) => setR((x) => ({ ...x, activa: e.target.checked }))} />
          <span className="text-[14px] font-semibold text-espresso">En uso</span>
        </label>
        <Campo label="Desde el número" type="number" min="1" inputMode="numeric" value={r.desde} onChange={campo('desde')} />
        <Campo label="Hasta el número" type="number" min="1" inputMode="numeric" value={r.hasta} onChange={campo('hasta')} />
        <Campo label="Vigente desde" type="date" value={r.fechaDesde} onChange={campo('fechaDesde')} />
        <Campo label="Vigente hasta" type="date" value={r.fechaHasta} onChange={campo('fechaHasta')} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Boton type="submit" disabled={!!error || enviando}>{enviando ? 'Guardando…' : 'Guardar numeración'}</Boton>
        <Boton variante="fantasma" onClick={onCancelar}>Cancelar</Boton>
        {error && <span className="text-[13px] font-semibold text-amber-800">{error}</span>}
      </div>
    </form>
  );
}

export default function DatosFiscales({ fiscal, onGuardado, mostrar }) {
  const [c, setC] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [rango, setRango] = useState(null);

  // El formulario parte de lo guardado; no se pisa lo que el administrador está escribiendo.
  const guardado = fiscal?.config;
  useEffect(() => { if (guardado) setC((actual) => actual ?? { ...guardado }); }, [guardado]);

  if (!fiscal || !c) return <Cargando filas={5} />;

  const campo = (k) => (e) => setC((x) => ({ ...x, [k]: e.target.value }));
  const nit = String(c.nit ?? '').replace(/\D/g, '');
  const dv = nit.length >= 5 ? digitoVerificacion(nit) : null;
  const { documentos, numeraciones } = fiscal;
  const sinImpuesto = c.tipoImpuesto === 'Ninguno';

  const guardar = async (e) => {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    try {
      await api.guardarFiscal({ ...c, nit, digitoVerificacion: dv == null ? null : String(dv), tarifaImpuesto: sinImpuesto ? 0 : Number(c.tarifaImpuesto) || 0 });
      mostrar(c.facturacionElectronica ? 'Datos guardados. La facturación electrónica está activa.' : 'Datos fiscales guardados');
      setC(null);
      await onGuardado();
    } catch (err) {
      mostrar(err.message, 'error');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className={`flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 ${guardado.facturacionElectronica ? 'bg-green-50 text-green-900' : 'bg-amber-50 text-amber-900'}`} role="status">
        {guardado.facturacionElectronica ? <CheckCircle2 size={20} aria-hidden="true" /> : <TriangleAlert size={20} aria-hidden="true" />}
        <p className="min-w-0 flex-1 text-[14px] font-semibold">
          {guardado.facturacionElectronica
            ? 'Facturación electrónica activa: cada cobro toma un número autorizado y se envía a la DIAN.'
            : 'Facturación electrónica apagada: las facturas salen con el consecutivo interno FV-, sin validez ante la DIAN.'}
        </p>
        {documentos.pendientes > 0 && <Chip tono={documentos.enContingencia > 0 ? 'aviso' : 'info'}>{documentos.pendientes} en validación</Chip>}
        {documentos.enContingencia > 0 && <Chip tono="aviso">{documentos.enContingencia} sin respuesta</Chip>}
        {documentos.rechazados > 0 && <Chip tono="peligro">{documentos.rechazados} rechazado{documentos.rechazados === 1 ? '' : 's'}</Chip>}
      </div>

      <form onSubmit={guardar} className="space-y-5">
        <Seccion titulo="El restaurante" detalle="Como aparece en el RUT. Sale en el encabezado de cada tirilla y en el documento electrónico.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="Razón social" value={c.razonSocial ?? ''} onChange={campo('razonSocial')} maxLength={150} />
            <Campo label="Nombre comercial (opcional)" value={c.nombreComercial ?? ''} onChange={campo('nombreComercial')} maxLength={150} />
            <Campo label="NIT (sin dígito de verificación)" inputMode="numeric" value={c.nit ?? ''} onChange={campo('nit')} maxLength={15} ayuda={dv == null ? undefined : `Dígito de verificación: ${dv}`} />
            <Campo label="Teléfono" inputMode="tel" value={c.telefono ?? ''} onChange={campo('telefono')} maxLength={30} />
            <Campo label="Dirección" value={c.direccion ?? ''} onChange={campo('direccion')} maxLength={200} />
            <Campo label="Municipio" value={c.municipio ?? ''} onChange={campo('municipio')} maxLength={100} placeholder="Sincelejo, Sucre" />
            <Campo label="Correo" type="email" value={c.correo ?? ''} onChange={campo('correo')} maxLength={150} />
            <Campo label="Responsabilidad tributaria" value={c.regimen ?? ''} onChange={campo('regimen')} maxLength={200} placeholder="Responsable del impuesto al consumo" ayuda="El texto que indique tu contador." />
          </div>
        </Seccion>

        <Seccion titulo="Impuesto de la venta" detalle="Los precios de la carta ya lo incluyen: aquí solo se define cuánto se discrimina en la factura. Confírmalo con tu contador.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Selector label="Impuesto" value={c.tipoImpuesto} onChange={(e) => setC((x) => ({ ...x, tipoImpuesto: e.target.value, tarifaImpuesto: IMPUESTOS.find((i) => i.id === e.target.value).tarifa }))}>
              {IMPUESTOS.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
            </Selector>
            <Campo label="Tarifa (%)" type="number" min="0" max="50" step="0.01" inputMode="decimal" disabled={sinImpuesto} value={sinImpuesto ? 0 : c.tarifaImpuesto} onChange={campo('tarifaImpuesto')} />
          </div>
        </Seccion>

        <Seccion titulo="Facturación electrónica" detalle="Actívala cuando el restaurante esté habilitado ante la DIAN y hayas registrado abajo sus numeraciones.">
          <Selector label="Al consumidor final que no pide factura a su nombre se le emite" value={c.documentoConsumidorFinal} onChange={campo('documentoConsumidorFinal')} className="sm:max-w-md">
            <option value="POS">Documento equivalente POS electrónico</option>
            <option value="FEV">Factura electrónica de venta</option>
          </Selector>
          <label className="mt-4 flex cursor-pointer items-center gap-3">
            <input type="checkbox" className="h-5 w-5 accent-espresso" checked={!!c.facturacionElectronica} onChange={(e) => setC((x) => ({ ...x, facturacionElectronica: e.target.checked }))} />
            <span>
              <span className="block text-[15px] font-bold text-espresso">Facturación electrónica activa</span>
              <span className="block text-[13px] text-gray-500">Desde que la actives, sin una numeración vigente la caja no deja cobrar y dice por qué.</span>
            </span>
          </label>
        </Seccion>

        <Boton type="submit" tamano="lg" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar datos fiscales'}</Boton>
      </form>

      <Seccion titulo="Numeraciones autorizadas por la DIAN" detalle="Una para el documento POS y otra para la factura electrónica. Qpro avisa cuando una está por agotarse o por vencer.">
        {numeraciones.length === 0 ? (
          <Vacio icono={TriangleAlert} titulo="Aún no hay numeraciones" texto="Regístralas con los datos de la autorización que el restaurante solicitó en el portal de la DIAN." />
        ) : (
          <Lista>
            {numeraciones.map((n) => (
              <div key={n.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="tabular block text-[15px] font-bold text-espresso">{nombreTipoDocumento(n.tipoDocumento)} · {n.prefijo}{n.desde} a {n.prefijo}{n.hasta}</span>
                  <span className="tabular block text-[13px] text-gray-500">
                    {n.resolucion ? `Resolución ${n.resolucion} · ` : ''}{n.fechaHasta ? `vigente hasta ${fechaLegible(n.fechaHasta)}` : 'sin fecha de vencimiento'} · sigue el {n.prefijo}{n.siguiente} · quedan {n.restantes}
                  </span>
                </span>
                {!n.activa ? <Chip>Fuera de uso</Chip> : n.aviso ? <Chip tono={n.vigente ? 'aviso' : 'peligro'}>{n.aviso}</Chip> : <Chip tono="ok">Vigente</Chip>}
                <Boton variante="fantasma" tamano="sm" aria-label={`Corregir la numeración ${n.prefijo}`} onClick={() => setRango({ ...n, resolucion: n.resolucion ?? '', fechaDesde: soloFecha(n.fechaDesde), fechaHasta: soloFecha(n.fechaHasta) })}>
                  <Pencil size={15} aria-hidden="true" />Corregir
                </Boton>
              </div>
            ))}
          </Lista>
        )}
        {rango
          ? <FormularioRango key={rango.id} rango={rango} mostrar={mostrar} onCancelar={() => setRango(null)} onGuardado={() => { setRango(null); onGuardado(); }} />
          : <Boton variante="secundario" className="mt-4" onClick={() => setRango(RANGO_NUEVO)}><Plus size={16} aria-hidden="true" />Agregar numeración</Boton>}
      </Seccion>
    </div>
  );
}
