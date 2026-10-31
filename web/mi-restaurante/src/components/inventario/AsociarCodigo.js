// Asocia un código de barras a un insumo como presentación de compra:
// el mismo insumo puede tener el código de la unidad, el de la caja y el de otra marca.
import React, { useEffect, useState } from 'react';
import { Package, Boxes } from 'lucide-react';
import { compras, mensajeError } from '../../services/inventarioApi';
import BuscadorInsumo from './BuscadorInsumo';
import EscanerCodigo from './EscanerCodigo';
import { Boton, Campo, Panel, Selector } from './ui';

export default function AsociarCodigo({ abierto, codigo: codigoInicial = '', insumos, insumoFijo = null, proveedores = [], onCerrar, onAsociado, onCrearInsumo }) {
  const [insumo, setInsumo] = useState(insumoFijo);
  const [codigo, setCodigo] = useState(codigoInicial);
  const [tipo, setTipo] = useState('unidad');
  const [factor, setFactor] = useState('12');
  const [nombre, setNombre] = useState('');
  const [costo, setCosto] = useState('');
  const [proveedorId, setProveedorId] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!abierto) return;
    setInsumo(insumoFijo);
    setCodigo(codigoInicial);
    setTipo('unidad');
    setFactor('12');
    setNombre('');
    setCosto('');
    setProveedorId(insumoFijo?.proveedorId ? String(insumoFijo.proveedorId) : '');
    setError(null);
  }, [abierto, codigoInicial, insumoFijo]);

  const unidad = insumo?.unidadMedida ?? 'unidad';
  const factorNum = tipo === 'unidad' ? 1 : Number(factor);
  const nombreSugerido = tipo === 'unidad' ? `Unidad (1 ${unidad})` : `Caja x${factor || '?'}`;

  const guardar = async () => {
    if (!insumo) return setError('Elige el insumo al que pertenece el código.');
    if (!(factorNum > 0)) return setError('Indica cuántas unidades trae la presentación.');
    setGuardando(true);
    setError(null);
    try {
      const creada = await compras.crearPresentacion({
        productoId: insumo.id,
        nombre: (nombre || nombreSugerido).trim(),
        factor: factorNum,
        codigo: codigo.trim() || null,
        proveedorId: proveedorId ? Number(proveedorId) : null,
        costoReferencia: costo ? Number(costo) : null,
      });
      onAsociado?.(creada, insumo);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo guardar el código'));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Panel
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={codigoInicial ? 'Código nuevo' : 'Agregar presentación'}
      subtitulo={codigoInicial
        ? <>El código <span className="tabular font-bold text-espresso">{codigoInicial}</span> no está asociado. Dinos qué es y la próxima vez se reconoce solo.</>
        : 'Cómo llega este insumo del proveedor y su código de barras.'}
      pie={
        <div className="flex gap-2">
          <Boton variante="secundario" tamano="lg" onClick={onCerrar}>Cancelar</Boton>
          <Boton tamano="lg" className="flex-1" onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar y usar'}
          </Boton>
        </div>
      }
    >
      <div className="space-y-5 p-5">
        {!insumoFijo && (
          <div>
            <p className="mb-1.5 text-[13px] font-semibold text-gray-600">Insumo</p>
            {insumo ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5">
                <span className="text-[15px] font-bold text-espresso">{insumo.nombre}</span>
                <button type="button" className="text-[13px] font-bold text-orange-700 underline underline-offset-4" onClick={() => setInsumo(null)}>Cambiar</button>
              </div>
            ) : (
              <>
                <BuscadorInsumo insumos={insumos} onElegir={setInsumo} autoFocus />
                {onCrearInsumo && (
                  <button type="button" onClick={() => onCrearInsumo(codigo.trim())} className="mt-2 text-[13px] font-bold text-orange-700 underline underline-offset-4">
                    ¿No existe todavía? Crear insumo nuevo con este código
                  </button>
                )}
              </>
            )}
          </div>
        )}

        <fieldset>
          <legend className="mb-1.5 text-[13px] font-semibold text-gray-600">¿Cómo viene?</legend>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'unidad', icono: Package, titulo: 'Por unidad', texto: `1 ${unidad}` },
              { id: 'caja', icono: Boxes, titulo: 'Caja o paquete', texto: 'Trae varias unidades' },
            ].map(({ id, icono: Icono, titulo, texto }) => (
              <button
                key={id}
                type="button"
                aria-pressed={tipo === id}
                onClick={() => setTipo(id)}
                className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors ${
                  tipo === id ? 'border-espresso bg-espresso text-white' : 'border-gray-200 bg-white text-espresso hover:border-gray-300'
                }`}
              >
                <Icono size={22} aria-hidden="true" />
                <span>
                  <span className="block text-[14px] font-bold">{titulo}</span>
                  <span className={`block text-[12px] ${tipo === id ? 'text-orange-100' : 'text-gray-500'}`}>{texto}</span>
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        {tipo === 'caja' && (
          <Campo
            label={`¿Cuánto trae? (en ${unidad})`}
            type="number" min="0.001" step="any" inputMode="decimal"
            value={factor} onChange={(e) => setFactor(e.target.value)}
            ayuda={`Cada caja escaneada suma ${factor || '…'} (${unidad}) al inventario.`}
          />
        )}

        <Campo label="Nombre de la presentación" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={nombreSugerido} />
        {codigoInicial ? (
          <Campo label="Código de barras" value={codigo} onChange={(e) => setCodigo(e.target.value)} className="tabular" />
        ) : (
          <div>
            <p className="mb-1.5 text-[13px] font-semibold text-gray-600">Código de barras <span className="font-medium text-gray-500">(opcional)</span></p>
            <EscanerCodigo onCodigo={setCodigo} autoFocus={false} placeholder="Escanea o escribe el código" />
            {codigo && (
              <p className="mt-2 text-[14px] text-espresso">
                Código: <span className="tabular font-bold">{codigo}</span>{' '}
                <button type="button" className="text-[13px] font-bold text-orange-700 underline underline-offset-4" onClick={() => setCodigo('')}>Quitar</button>
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Campo label="Precio de compra" type="number" min="0" step="any" inputMode="decimal" value={costo} onChange={(e) => setCosto(e.target.value)} placeholder="Opcional" />
          <Selector label="Proveedor" value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
            <option value="">Sin proveedor</option>
            {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </Selector>
        </div>

        {error && <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-[14px] font-semibold text-red-800" role="alert">{error}</p>}
      </div>
    </Panel>
  );
}
