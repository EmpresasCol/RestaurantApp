// Facturas emitidas en un día: búsqueda, detalle, reimpresión y exportación.
import React, { useCallback, useEffect, useState } from 'react';
import { Ban, ChevronDown, Download, ExternalLink, FileText, Printer, RefreshCw, Search } from 'lucide-react';
import * as api from '../../services/api';
import { Boton, BotonConfirmar, Campo, Cargando, Chip, Lista, Selector, Vacio } from '../inventario/ui';
import { coincide } from '../../utils/administracion';
import { hora, pesos } from '../../utils/caja';
import { impuestoFactura } from '../../utils/impuestos';
import { documentoVenta, errorCliente, estadoDian, nombreCodigo, rechazoPorResolver, TIPOS_ID } from '../../utils/facturacion';
import { htmlFactura, imprimirHtml } from '../../utils/recibo';

const nombreMetodo = (m) => (m === 'QR' ? 'Transferencia o QR' : m);

export const csvFacturas = (facturas) => {
  const celda = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const filas = facturas.map((f) => [
    f.numeroFactura, new Date(f.fechaEmision).toLocaleString('es-CO'), f.mesaNumero ?? (f.domicilioId ? `Domicilio #${f.domicilioId}` : ''), f.nombreCliente, f.nitCliente,
    nombreMetodo(f.metodoPago), f.subtotal, impuestoFactura(f).base, impuestoFactura(f).valor, f.propina, f.total,
    estadoDian(f)?.texto ?? 'Sin documento electrónico', documentoVenta(f)?.cufe ?? '',
  ].map(celda).join(';'));
  return ['Factura;Fecha;Mesa;Cliente;CC/NIT;Pago;Consumo;Base gravable;Impuesto incluido;Propina;Total;Estado DIAN;CUFE/CUDE', ...filas].join('\n');
};

/** Anular: motivo obligatorio y, si solo estaban mal los datos, volver a facturar a nombre del cliente. */
function Anular({ factura, onAnulada, onCancelar, mostrar }) {
  const [motivo, setMotivo] = useState('');
  const [refacturar, setRefacturar] = useState(false);
  const [cliente, setCliente] = useState({ tipoId: 'CC', nit: '', nombre: '', correo: '' });
  const [enviando, setEnviando] = useState(false);
  const campo = (k) => (e) => setCliente((c) => ({ ...c, [k]: e.target.value }));
  const error = motivo.trim().length < 5 ? 'Escribe el motivo (mínimo 5 letras)' : refacturar ? errorCliente(cliente) : null;

  const anular = async () => {
    if (error || enviando) return;
    setEnviando(true);
    try {
      const r = await api.anularFactura(factura.id, { motivo: motivo.trim(), nuevoCliente: refacturar ? { ...cliente, nit: cliente.nit.trim(), nombre: cliente.nombre.trim(), correo: cliente.correo.trim() || null } : null });
      mostrar(r.reemplazo ? `Anulada. Nueva factura ${r.reemplazo.numeroFactura}` : `Factura ${factura.numeroFactura} anulada`);
      onAnulada();
    } catch (e) {
      mostrar(e.message, 'error');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="mt-3 rounded-2xl border border-red-200 bg-white p-4">
      <p className="text-[15px] font-bold text-espresso">Anular la factura {factura.numeroFactura}</p>
      <p className="mt-1 text-[13px] text-gray-600">
        {refacturar
          ? 'La venta sigue en pie: esta factura se anula y sale otra a nombre del cliente.'
          : 'La venta se reversa: deja de contar en el cierre y debes devolver el dinero. El número no se vuelve a usar.'}
      </p>
      <Campo className="mt-3" label="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} placeholder="Por ejemplo: el cliente pidió factura a nombre de su empresa" />
      <label className="mt-3 flex cursor-pointer items-center gap-3">
        <input type="checkbox" className="h-5 w-5 accent-espresso" checked={refacturar} onChange={(e) => setRefacturar(e.target.checked)} />
        <span className="text-[14px] font-semibold text-espresso">Solo corregir los datos del cliente (volver a facturar)</span>
      </label>
      {refacturar && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Selector label="Tipo de identificación" value={cliente.tipoId} onChange={campo('tipoId')}>
            {TIPOS_ID.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </Selector>
          <Campo label="Número" value={cliente.nit} onChange={campo('nit')} placeholder={cliente.tipoId === 'NIT' ? '900123456-8' : ''} />
          <Campo label="Nombre o razón social" value={cliente.nombre} onChange={campo('nombre')} maxLength={150} />
          <Campo label="Correo (opcional)" type="email" value={cliente.correo} onChange={campo('correo')} maxLength={150} />
        </div>
      )}
      {error && motivo.trim().length >= 5 && <p className="mt-2 text-[13px] font-semibold text-red-700" role="alert">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <BotonConfirmar disabled={!!error || enviando} onConfirmar={anular} confirmar="Toca otra vez para anular">
          <Ban size={15} aria-hidden="true" />{refacturar ? 'Anular y volver a facturar' : 'Anular factura'}
        </BotonConfirmar>
        <Boton variante="fantasma" tamano="sm" onClick={onCancelar}>No anular</Boton>
      </div>
    </div>
  );
}

export default function FacturasDia({ fecha, onFecha, version, mostrar, fiscal = null, onCambio }) {
  const [anulando, setAnulando] = useState(null);
  const [facturas, setFacturas] = useState(null);
  const [q, setQ] = useState('');
  const [abierta, setAbierta] = useState(null);

  const cargar = useCallback(() => {
    api.getFacturas(fecha)
      .then(setFacturas)
      .catch((e) => { setFacturas([]); mostrar(e.message, 'error'); });
  }, [fecha, mostrar]);
  useEffect(() => { cargar(); }, [cargar, version]);

  const visibles = (facturas ?? []).filter((f) => !q.trim()
    || coincide(f.numeroFactura, q) || coincide(f.nombreCliente, q) || coincide(f.nitCliente, q) || String(f.mesaNumero ?? '') === q.trim());
  // Lo anulado sin reemplazo es una venta reversada: se ve en la lista pero no suma.
  const total = visibles.filter((f) => !f.anulada).reduce((t, f) => t + f.total, 0);
  const porResolver = (facturas ?? []).filter(rechazoPorResolver).length;

  const reintentar = async (f) => {
    try {
      await api.reintentarFactura(f.id);
      mostrar('Documento enviado de nuevo a la DIAN');
      cargar();
    } catch (e) {
      mostrar(e.message, 'error');
    }
  };

  const exportar = () => {
    const url = URL.createObjectURL(new Blob(['﻿' + csvFacturas(visibles)], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `facturas_${fecha}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-gray-600">Día</span>
          <input type="date" value={fecha} onChange={(e) => e.target.value && onFecha(e.target.value)} className="h-11 rounded-xl border border-gray-300 bg-white px-3.5 text-[15px] text-espresso focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-100" />
        </label>
        <label className="relative block min-w-[220px] flex-1 sm:max-w-sm">
          <span className="sr-only">Buscar factura</span>
          <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Número, cliente, cédula o mesa" className="h-11 w-full rounded-xl border border-gray-300 bg-white pl-10 pr-3.5 text-[15px] text-espresso placeholder:text-gray-500 focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-100" />
        </label>
        {visibles.length > 0 && (
          <Boton variante="secundario" onClick={exportar}><Download size={16} aria-hidden="true" />Exportar CSV</Boton>
        )}
      </div>

      {!facturas ? <Cargando filas={4} /> : visibles.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white">
          <Vacio icono={FileText} titulo={facturas.length ? 'Ninguna factura coincide' : 'No hay facturas este día'} texto={facturas.length ? 'Prueba con otra búsqueda.' : 'Cada cobro de mesa y cada domicilio entregado emite su documento con número consecutivo.'} />
        </div>
      ) : (
        <>
          {porResolver > 0 && (
            <p className="mb-3 rounded-2xl bg-red-50 px-4 py-3 text-[14px] font-semibold text-red-800" role="alert">
              {porResolver === 1 ? 'Hay 1 documento rechazado' : `Hay ${porResolver} documentos rechazados`} por la DIAN. Ábrelo para ver el motivo: corrígelo y reenvíalo, o anúlalo. La caja no se puede cerrar mientras tanto.
            </p>
          )}
          <p className="tabular mb-2 text-[13px] text-gray-500">{visibles.length} factura{visibles.length === 1 ? '' : 's'} · {pesos(total)}</p>
          <Lista>
            {visibles.map((f) => {
              const expandida = abierta === f.id;
              const dian = estadoDian(f);
              const doc = documentoVenta(f);
              const impuesto = impuestoFactura(f);
              return (
                <div key={f.id}>
                  <button
                    type="button" onClick={() => setAbierta(expandida ? null : f.id)} aria-expanded={expandida}
                    className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left transition-colors hover:bg-gray-50"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="tabular block text-[15px] font-bold text-espresso">{f.numeroFactura}</span>
                      <span className="tabular block truncate text-[13px] text-gray-500">
                        {hora(f.fechaEmision)}{f.mesaNumero ? ` · Mesa ${f.mesaNumero}` : f.domicilioId ? ` · Domicilio #${f.domicilioId}` : ''} · {f.nombreCliente} · {nombreMetodo(f.metodoPago)}
                      </span>
                    </span>
                    {dian && <Chip tono={dian.tono}>{dian.texto}</Chip>}
                    <span className={`tabular text-[17px] font-extrabold ${f.anulada ? 'text-gray-500 line-through' : 'text-espresso'}`}>{pesos(f.total)}</span>
                    <ChevronDown size={18} className={`text-gray-500 transition-transform ${expandida ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </button>
                  {expandida && (
                    <div className="border-t border-gray-200 bg-gray-50 px-4 py-4">
                      <ul className="tabular space-y-1 text-[14px] text-gray-700">
                        {f.items.map((i) => (
                          <li key={`${i.nombre}-${i.precioUnitario}`} className="flex justify-between gap-3">
                            <span>{i.cantidad} × {i.nombre} <span className="text-gray-500">({pesos(i.precioUnitario)})</span></span>
                            <span>{pesos(i.total)}</span>
                          </li>
                        ))}
                      </ul>
                      <dl className="tabular mt-3 space-y-0.5 border-t border-gray-200 pt-2 text-[14px]">
                        <div className="flex justify-between"><dt>{f.domicilioId ? 'Productos y envío' : 'Consumo'}</dt><dd>{pesos(f.subtotal)}</dd></div>
                        <div className="flex justify-between text-[13px] text-gray-500"><dt>{impuesto.etiqueta}</dt><dd>{impuesto.valor > 0 ? pesos(impuesto.valor) : ''}</dd></div>
                        {f.propina > 0 && <div className="flex justify-between"><dt>Propina</dt><dd>{pesos(f.propina)}</dd></div>}
                        <div className="flex justify-between font-bold text-espresso"><dt>Total</dt><dd>{pesos(f.total)}</dd></div>
                      </dl>
                      {f.pagos?.length > 1 && (
                        <p className="tabular mt-2 text-[13px] text-gray-600">Pagos: {f.pagos.map((p) => `${nombreMetodo(p.metodoPago)} ${pesos(p.monto)}`).join(' + ')}</p>
                      )}
                      <p className="mt-2 text-[13px] text-gray-500">
                        {f.tipoIdCliente ?? 'CC/NIT'} {f.nitCliente}{f.correoCliente ? ` · ${f.correoCliente}` : ''} · {f.domicilio ?? `pedidos ${f.pedidoIds.map((id) => `#${id}`).join(', ')}`}
                      </p>
                      {dian?.detalle && (
                        <p className={`mt-2 rounded-xl px-3 py-2 text-[13px] ${dian.tono === 'peligro' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-900'}`}>
                          <strong>{f.anulada ? 'Motivo de la anulación' : 'Respuesta de la DIAN'}:</strong> {dian.detalle}
                        </p>
                      )}
                      {doc?.cufe && <p className="mt-2 break-all text-[12px] text-gray-500">{nombreCodigo(doc.tipo)}: {doc.cufe}</p>}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Boton variante="secundario" tamano="sm" onClick={() => imprimirHtml(htmlFactura(f, {}, fiscal))}>
                          <Printer size={15} aria-hidden="true" />Reimprimir
                        </Boton>
                        {doc?.urlPdf && (
                          <a href={doc.urlPdf} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 text-[13px] font-bold text-espresso hover:bg-gray-50">
                            <ExternalLink size={15} aria-hidden="true" />PDF de la DIAN
                          </a>
                        )}
                        {rechazoPorResolver(f) && (
                          <Boton variante="secundario" tamano="sm" onClick={() => reintentar(f)}><RefreshCw size={15} aria-hidden="true" />Enviar de nuevo</Boton>
                        )}
                        {!f.anulada && anulando !== f.id && (
                          <Boton variante="peligro" tamano="sm" onClick={() => setAnulando(f.id)}><Ban size={15} aria-hidden="true" />Anular</Boton>
                        )}
                      </div>
                      {anulando === f.id && !f.anulada && (
                        <Anular factura={f} mostrar={mostrar} onCancelar={() => setAnulando(null)} onAnulada={() => { setAnulando(null); cargar(); onCambio?.(); }} />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </Lista>
        </>
      )}
    </div>
  );
}
