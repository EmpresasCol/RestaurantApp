// Factura y cierre en tirilla de 80 mm para la impresora térmica de la caja.
import { etiquetaImpuesto, impuestoIncluido } from './impuestos';
import { pesos } from './caja';

const escapar = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const fechaHora = (iso) =>
  new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit' });

const ESTILO = `
  @page { size: 80mm auto; margin: 4mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { width: 72mm; font: 12px/1.45 system-ui, -apple-system, 'Segoe UI', sans-serif; color: #000; font-variant-numeric: tabular-nums; }
  h1 { font-size: 18px; text-align: center; }
  .centro { text-align: center; }
  .suave { color: #444; }
  hr { border: 0; border-top: 1px dashed #000; margin: 8px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 1px 0; vertical-align: top; }
  td.n { text-align: right; white-space: nowrap; }
  .total td { font-size: 16px; font-weight: 800; padding-top: 4px; }
`;

const fila = (izq, der, clase = '') => `<tr class="${clase}"><td>${izq}</td><td class="n">${der}</td></tr>`;

/** HTML de la factura. extra: { recibido, cambio } del cobro en efectivo (no se guarda en la API). */
export const htmlFactura = (f, extra = {}) => {
  const items = (f.items ?? [])
    .map((i) => fila(`${i.cantidad} × ${escapar(i.nombre)}`, pesos(i.total)))
    .join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapar(f.numeroFactura)}</title><style>${ESTILO}</style></head><body>
  <h1>Qpro</h1>
  <p class="centro suave">Factura de venta</p>
  <p class="centro"><strong>${escapar(f.numeroFactura)}</strong></p>
  <p class="centro suave">${fechaHora(f.fechaEmision)}${f.mesaNumero ? ` · Mesa ${f.mesaNumero}` : ''}</p>
  <hr>
  <p>Cliente: ${escapar(f.nombreCliente)}</p>
  <p>CC/NIT: ${escapar(f.nitCliente)}</p>
  <hr>
  <table>${items}</table>
  <hr>
  <table>
    ${fila('Consumo', pesos(f.subtotal))}
    ${fila(`<span class="suave">${escapar(etiquetaImpuesto())}</span>`, `<span class="suave">${pesos(impuestoIncluido(f.subtotal))}</span>`)}
    ${f.propina > 0 ? fila('Propina voluntaria', pesos(f.propina)) : ''}
    ${fila('Total', pesos(f.total), 'total')}
  </table>
  <hr>
  <table>
    ${fila('Pago', escapar(f.metodoPago === 'QR' ? 'Transferencia o QR' : f.metodoPago))}
    ${extra.recibido != null ? fila('Recibido', pesos(extra.recibido)) + fila('Cambio', pesos(extra.cambio)) : ''}
  </table>
  <hr>
  <p class="centro">Gracias por su visita</p>
</body></html>`;
};

/** HTML del cierre de caja del día. cuadre: { base, contado, esperado, diferencia } (opcional). */
export const htmlCierre = (c, cuadre) => {
  const metodos = (c.porMetodo ?? []).map((m) => fila(escapar(m.metodo), pesos(m.total))).join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Cierre ${escapar(c.fecha)}</title><style>${ESTILO}</style></head><body>
  <h1>Qpro</h1>
  <p class="centro"><strong>Cierre de caja</strong></p>
  <p class="centro suave">${escapar(c.fecha)} · impreso ${fechaHora(new Date().toISOString())}</p>
  <hr>
  <table>
    ${fila('Ventas en mesa', pesos(c.ventasMesa))}
    ${fila('Propinas', pesos(c.propinas))}
    ${fila('Domicilios (platos)', pesos(c.ventasDomicilio))}
    ${fila('Envíos', pesos(c.envios))}
    ${fila('Total recaudado', pesos(c.totalRecaudado), 'total')}
  </table>
  <hr>
  <p><strong>Por método de pago</strong></p>
  <table>${metodos}</table>
  <hr>
  <table>
    ${fila('Cuentas de mesa', c.cuentasMesa)}
    ${fila('Domicilios entregados', c.domicilios)}
    ${fila('Facturas', c.facturasEmitidas ? `${c.facturasEmitidas} (${escapar(c.primeraFactura)} a ${escapar(c.ultimaFactura)})` : '0')}
    ${fila('Pedidos anulados', `${c.pedidosAnulados} · ${pesos(c.valorAnulado)}`)}
  </table>
  ${cuadre ? `<hr><p><strong>Cuadre de efectivo</strong></p><table>
    ${fila('Base inicial', pesos(cuadre.base))}
    ${fila('Efectivo esperado', pesos(cuadre.esperado))}
    ${cuadre.diferencia != null ? fila('Efectivo contado', pesos(cuadre.contado)) + fila('Diferencia', pesos(cuadre.diferencia)) : ''}
  </table>` : ''}
  <hr>
  <p>Firma cajero: ______________________</p>
</body></html>`;
};

/** Abre la tirilla en una ventana nueva y lanza la impresión. */
export const imprimirHtml = (html) => {
  const ventana = window.open('', '_blank', 'width=420,height=640');
  if (!ventana) return false;
  ventana.document.open();
  ventana.document.write(html);
  ventana.document.close();
  ventana.focus();
  setTimeout(() => ventana.print(), 250);
  return true;
};
