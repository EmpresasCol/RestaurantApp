// Facturas emitidas en un día: búsqueda, detalle, reimpresión y exportación.
import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, Download, FileText, Printer, Search } from 'lucide-react';
import * as api from '../../services/api';
import { Boton, Cargando, Lista, Vacio } from '../inventario/ui';
import { coincide } from '../../utils/administracion';
import { hora, pesos } from '../../utils/caja';
import { etiquetaImpuesto, impuestoIncluido } from '../../utils/impuestos';
import { htmlFactura, imprimirHtml } from '../../utils/recibo';

const nombreMetodo = (m) => (m === 'QR' ? 'Transferencia o QR' : m);

export const csvFacturas = (facturas) => {
  const celda = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const filas = facturas.map((f) => [
    f.numeroFactura, new Date(f.fechaEmision).toLocaleString('es-CO'), f.mesaNumero ?? '', f.nombreCliente, f.nitCliente,
    nombreMetodo(f.metodoPago), f.subtotal, impuestoIncluido(f.subtotal), f.propina, f.total,
  ].map(celda).join(';'));
  return ['Factura;Fecha;Mesa;Cliente;CC/NIT;Pago;Consumo;Impoconsumo incluido;Propina;Total', ...filas].join('\n');
};

export default function FacturasDia({ fecha, onFecha, version, mostrar }) {
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
  const total = visibles.reduce((t, f) => t + f.total, 0);

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
          <Vacio icono={FileText} titulo={facturas.length ? 'Ninguna factura coincide' : 'No hay facturas este día'} texto={facturas.length ? 'Prueba con otra búsqueda.' : 'Cada cobro de mesa emite su factura con número consecutivo.'} />
        </div>
      ) : (
        <>
          <p className="tabular mb-2 text-[13px] text-gray-500">{visibles.length} factura{visibles.length === 1 ? '' : 's'} · {pesos(total)}</p>
          <Lista>
            {visibles.map((f) => {
              const expandida = abierta === f.id;
              return (
                <div key={f.id}>
                  <button
                    type="button" onClick={() => setAbierta(expandida ? null : f.id)} aria-expanded={expandida}
                    className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left transition-colors hover:bg-gray-50"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="tabular block text-[15px] font-bold text-espresso">{f.numeroFactura}</span>
                      <span className="tabular block truncate text-[13px] text-gray-500">
                        {hora(f.fechaEmision)}{f.mesaNumero ? ` · Mesa ${f.mesaNumero}` : ''} · {f.nombreCliente} · {nombreMetodo(f.metodoPago)}
                      </span>
                    </span>
                    <span className="tabular text-[17px] font-extrabold text-espresso">{pesos(f.total)}</span>
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
                        <div className="flex justify-between"><dt>Consumo</dt><dd>{pesos(f.subtotal)}</dd></div>
                        <div className="flex justify-between text-[13px] text-gray-500"><dt>{etiquetaImpuesto()}</dt><dd>{pesos(impuestoIncluido(f.subtotal))}</dd></div>
                        {f.propina > 0 && <div className="flex justify-between"><dt>Propina</dt><dd>{pesos(f.propina)}</dd></div>}
                        <div className="flex justify-between font-bold text-espresso"><dt>Total</dt><dd>{pesos(f.total)}</dd></div>
                      </dl>
                      <p className="mt-2 text-[13px] text-gray-500">CC/NIT {f.nitCliente} · pedidos {f.pedidoIds.map((id) => `#${id}`).join(', ')}</p>
                      <Boton variante="secundario" tamano="sm" className="mt-3" onClick={() => imprimirHtml(htmlFactura(f))}>
                        <Printer size={15} aria-hidden="true" />Reimprimir
                      </Boton>
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
