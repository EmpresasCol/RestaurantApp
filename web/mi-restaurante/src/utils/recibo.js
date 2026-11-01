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
  ${f.domicilio ? `<p class="centro suave">${escapar(f.domicilio)}</p>` : ''}
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
    ${(f.pagos?.length ? f.pagos : [{ metodoPago: f.metodoPago, monto: f.total }])
      .map((p) => fila(`Pago ${escapar(p.metodoPago === 'QR' ? 'Transferencia o QR' : p.metodoPago)}`, pesos(p.monto))).join('')}
    ${extra.recibido != null ? fila('Recibido en efectivo', pesos(extra.recibido)) + fila('Cambio', pesos(extra.cambio)) : ''}
  </table>
  <hr>
  <p class="centro">Gracias por su visita</p>
</body></html>`;
};

/**
 * Cuenta de la mesa (pre-cuenta) que el mesero lleva al cliente antes de pagar.
 * No es factura: la factura sale cuando la caja cobra.
 */
export const htmlCuenta = (cuenta, lineas, ahora = new Date()) => {
  const items = lineas.map((l) => fila(`${l.cantidad} × ${escapar(l.nombre)}`, pesos(l.total))).join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Cuenta mesa ${escapar(cuenta.mesaNumero)}</title><style>${ESTILO}</style></head><body>
  <h1>Qpro</h1>
  <p class="centro suave">Cuenta de la mesa</p>
  <p class="centro"><strong>Mesa ${escapar(cuenta.mesaNumero)}</strong></p>
  <p class="centro suave">${fechaHora(ahora)}</p>
  <hr>
  <table>${items}</table>
  <hr>
  <table>
    ${fila(`<span class="suave">${escapar(etiquetaImpuesto())}</span>`, `<span class="suave">${pesos(impuestoIncluido(cuenta.total))}</span>`)}
    ${fila('Total', pesos(cuenta.total), 'total')}
  </table>
  <hr>
  <p class="centro">La propina es voluntaria.</p>
  <p class="centro suave">Este documento no es una factura.</p>
</body></html>`;
};

/**
 * HTML del cierre de caja del día. a: el arqueo de la pantalla
 * { base, propinasPagadas, retiros, esperado, contado, efectivo, datafono, tarjeta, banco, transferencias, observaciones }.
 */
export const htmlCierre = (c, a = {}) => {
  const metodos = (c.porMetodo ?? []).map((m) => fila(escapar(m.metodo), pesos(m.total))).join('');
  const dif = (d) => (d?.diferencia == null ? '' : d.estado === 'cuadra' ? 'Cuadra' : `${d.diferencia > 0 ? 'Sobran' : 'Faltan'} ${pesos(Math.abs(d.diferencia))}`);
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Cierre ${escapar(c.fecha)}</title><style>${ESTILO}</style></head><body>
  <h1>Qpro</h1>
  <p class="centro"><strong>Cierre de caja</strong></p>
  <p class="centro suave">${escapar(c.fecha)} · impreso ${fechaHora(new Date().toISOString())}</p>
  ${c.cerrada ? `<p class="centro suave">Cerrada${c.cerradaPor ? ` por ${escapar(c.cerradaPor)}` : ''}</p>` : ''}
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
  <p><strong>Efectivo del cajón</strong></p>
  <table>
    ${fila('+ Base inicial', pesos(a.base ?? c.base))}
    ${fila('+ Cobros de mesa en efectivo', pesos(c.efectivoMesa))}
    ${fila('+ Efectivo de domiciliarios', pesos(c.efectivoDomicilios))}
    ${fila('− Propinas pagadas', pesos(a.propinasPagadas ?? c.propinasPagadas))}
    ${fila('− Gastos o retiros', pesos(a.retiros ?? c.retiros))}
    ${fila('= Debe haber', pesos(a.esperado ?? c.efectivoEsperado), 'total')}
    ${a.contado != null ? fila('Contado', pesos(a.contado)) + fila('Resultado', dif(a.efectivo)) : ''}
  </table>
  ${a.datafono != null || a.banco != null ? `<hr><table>
    ${a.datafono != null ? fila('Datáfono', `${pesos(a.datafono)} · ${dif(a.tarjeta)}`) : ''}
    ${a.banco != null ? fila('Banco', `${pesos(a.banco)} · ${dif(a.transferencias)}`) : ''}
  </table>` : ''}
  <hr>
  <table>
    ${fila('Cuentas de mesa', c.cuentasMesa)}
    ${fila('Domicilios entregados', c.domicilios)}
    ${fila('Facturas', c.facturasEmitidas ? `${c.facturasEmitidas} (${escapar(c.primeraFactura)} a ${escapar(c.ultimaFactura)})` : '0')}
    ${fila('Pedidos anulados', `${c.pedidosAnulados} · ${pesos(c.valorAnulado)}`)}
  </table>
  ${a.observaciones ? `<hr><p>${escapar(a.observaciones)}</p>` : ''}
  <hr>
  <p>Firma cajero: ______________________</p>
</body></html>`;
};

/** Comanda del domicilio para la bolsa: a quién, dónde, qué lleva y cuánto cobrar (con el cambio). */
export const htmlDomicilio = (d, ahora = new Date()) => {
  const items = (d.detalles ?? []).map((i) => fila(`${i.cantidad} × ${escapar(i.platilloNombre)}${i.nota ? `<br><span class="suave">${escapar(i.nota)}</span>` : ''}`, pesos(i.subtotal ?? i.precioUnitario * i.cantidad))).join('');
  const cobro = d.pagadoAnticipado
    ? fila('Pago', 'Pagado: no cobrar')
    : fila('Cobrar', `${pesos(d.total)} · ${escapar(d.metodoPago)}`) + (d.pagaCon ? fila('Paga con', pesos(d.pagaCon)) + fila('Llevar cambio', pesos(d.cambio ?? 0)) : '');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Domicilio ${escapar(d.id)}</title><style>${ESTILO}</style></head><body>
  <h1>Qpro</h1>
  <p class="centro"><strong>Domicilio #${escapar(d.id)}</strong></p>
  <p class="centro suave">${fechaHora(d.fechaPedido ?? ahora.toISOString())}</p>
  <hr>
  <p><strong>${escapar(d.clienteNombre)}</strong> · ${escapar(d.clienteTelefono)}</p>
  <p>${escapar(d.direccionCompleta)}${d.barrio ? `, ${escapar(d.barrio)}` : ''}</p>
  ${d.referenciasAdicionales ? `<p class="suave">${escapar(d.referenciasAdicionales)}</p>` : ''}
  ${d.notasCliente ? `<p class="suave">Nota: ${escapar(d.notasCliente)}</p>` : ''}
  <hr>
  <table>${items}</table>
  <hr>
  <table>
    ${fila('Productos', pesos(d.subtotal))}
    ${fila('Envío', pesos(d.costoEnvio))}
    ${fila('Total', pesos(d.total), 'total')}
  </table>
  <hr>
  <table>${cobro}</table>
  ${d.domiciliarioNombre ? `<p class="centro suave">Lo lleva ${escapar(d.domiciliarioNombre)}</p>` : ''}
  <p class="centro suave">La factura se entrega al cobrar.</p>
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
