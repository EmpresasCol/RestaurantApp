// Cierre del día: lo recaudado por método, facturas emitidas, anulados y cuadre del efectivo.
import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Printer } from 'lucide-react';
import * as api from '../../services/api';
import { Boton, Campo, Cargando } from '../inventario/ui';
import { cuadreEfectivo, pesos } from '../../utils/caja';
import { etiquetaImpuesto, impuestoIncluido } from '../../utils/impuestos';
import { htmlCierre, imprimirHtml } from '../../utils/recibo';

const leer = (clave) => { try { return localStorage.getItem(clave) ?? ''; } catch { return ''; } };
const guardar = (clave, valor) => { try { localStorage.setItem(clave, valor); } catch { /* sin almacenamiento */ } };

const TONO_CUADRE = {
  cuadra: 'bg-green-50 text-green-800',
  sobra: 'bg-amber-50 text-amber-800',
  falta: 'bg-red-50 text-red-800',
};

export default function CierreCaja({ fecha, onFecha, version, mostrar }) {
  const [cierre, setCierre] = useState(null);
  // La base se recuerda por día en este navegador: es lo que se dejó en el cajón al abrir.
  const [base, setBase] = useState(() => leer(`qpro-base-${fecha}`));
  const [contado, setContado] = useState('');

  const cargar = useCallback(() => {
    api.getCierreCaja(fecha)
      .then(setCierre)
      .catch((e) => mostrar(e.message, 'error'));
  }, [fecha, mostrar]);
  useEffect(() => { cargar(); }, [cargar, version]);
  useEffect(() => { setBase(leer(`qpro-base-${fecha}`)); setContado(''); }, [fecha]);

  if (!cierre) return <Cargando filas={4} />;

  const efectivo = cierre.porMetodo.find((m) => m.metodo === 'Efectivo')?.total ?? 0;
  const cuadre = cuadreEfectivo({ base, efectivo, contado });
  const ventasConImpuesto = cierre.ventasMesa + cierre.ventasDomicilio;

  const imprimir = () => imprimirHtml(htmlCierre(cierre, { base: Number(base) || 0, contado: Number(contado) || 0, ...cuadre }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-gray-600">Día</span>
          <input type="date" value={fecha} onChange={(e) => e.target.value && onFecha(e.target.value)} className="h-11 rounded-xl border border-gray-300 bg-white px-3.5 text-[15px] text-espresso focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-100" />
        </label>
        <Boton variante="secundario" onClick={imprimir}><Printer size={16} aria-hidden="true" />Imprimir cierre</Boton>
      </div>

      {cierre.cuentasAbiertas > 0 && (
        <p className="flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-[14px] text-amber-900" role="status">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          Quedan {cierre.cuentasAbiertas} mesa{cierre.cuentasAbiertas === 1 ? '' : 's'} sin cobrar por {pesos(cierre.valorAbierto)}. Cóbralas antes de cerrar.
        </p>
      )}

      <dl className="grid grid-cols-2 divide-gray-200 overflow-hidden rounded-2xl border border-gray-200 bg-white lg:grid-cols-4 lg:divide-x">
        <div className="col-span-2 border-b border-gray-200 p-5 lg:col-span-1 lg:border-b-0">
          <dt className="text-[13px] font-semibold text-gray-500">Total recaudado</dt>
          <dd className="tabular mt-1 text-[30px] font-extrabold tracking-[-0.02em] text-espresso">{pesos(cierre.totalRecaudado)}</dd>
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
          <dd className="text-[13px] text-gray-500">Se reparten al equipo</dd>
        </div>
      </dl>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
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
            <div className="flex justify-between"><dt>{etiquetaImpuesto()} en las ventas</dt><dd>{pesos(impuestoIncluido(ventasConImpuesto))}</dd></div>
            <div className="flex justify-between"><dt>Envíos de domicilio</dt><dd>{pesos(cierre.envios)}</dd></div>
            <div className="flex justify-between"><dt>Pedidos anulados</dt><dd>{cierre.pedidosAnulados} · {pesos(cierre.valorAnulado)}</dd></div>
          </dl>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-4" aria-label="Cuadre de efectivo">
          <h2 className="text-[17px] font-extrabold text-espresso">Cuadre de efectivo</h2>
          <p className="mt-0.5 text-[13px] text-gray-500">Cuenta el cajón y compáralo con lo que dice el sistema.</p>
          <div className="mt-4 space-y-3">
            <Campo
              label="Base con que se abrió la caja" type="number" min="0" step="1000" inputMode="numeric"
              value={base} onChange={(e) => { setBase(e.target.value); guardar(`qpro-base-${fecha}`, e.target.value); }}
            />
            <div className="tabular flex justify-between rounded-xl bg-gray-100 px-3.5 py-3 text-[14px]">
              <span className="text-gray-600">Efectivo esperado</span>
              <span className="font-extrabold text-espresso">{pesos(cuadre.esperado)}</span>
            </div>
            <Campo label="Efectivo contado" type="number" min="0" step="100" inputMode="numeric" value={contado} onChange={(e) => setContado(e.target.value)} />
            {cuadre.diferencia != null && (
              <p className={`tabular rounded-xl px-3.5 py-3 text-[15px] font-bold ${TONO_CUADRE[cuadre.estado]}`} role="status">
                {cuadre.estado === 'cuadra' ? 'La caja cuadra' : cuadre.estado === 'sobra' ? `Sobran ${pesos(cuadre.diferencia)}` : `Faltan ${pesos(-cuadre.diferencia)}`}
              </p>
            )}
            <p className="text-[12px] text-gray-500">El efectivo esperado incluye las propinas en efectivo y lo que traen los domiciliarios.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
