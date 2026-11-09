// Movimientos manuales del día a día: merma (se dañó, se cayó), salida (consumo de personal,
// cortesía), ajuste a lo que realmente hay y traslado entre almacenes. Las entradas van por Recibir.
import React, { useEffect, useState } from 'react';
import { ArrowLeftRight, Scale, Trash2, Undo2 } from 'lucide-react';
import { compras, createMovimiento, getAlmacenes, getStockPorProducto, mensajeError } from '../../services/inventarioApi';
import { formatearCantidad } from '../../utils/inventario';
import BuscadorInsumo from './BuscadorInsumo';
import { Boton, Campo, Panel, Selector } from './ui';

const TIPOS = [
  { id: 'Merma', icono: Trash2, titulo: 'Merma', texto: 'Se dañó, se cayó o se botó' },
  { id: 'Salida', icono: Undo2, titulo: 'Salida', texto: 'Consumo de personal, cortesía' },
  { id: 'Ajuste', icono: Scale, titulo: 'Ajuste', texto: 'Dejar la cantidad real' },
  { id: 'Traslado', icono: ArrowLeftRight, titulo: 'Traslado', texto: 'De un almacén a otro' },
];

const MOTIVOS = {
  Merma: ['Se dañó', 'Se cayó o derramó', 'Mal estado', 'Error de preparación'],
  Salida: ['Comida de personal', 'Cortesía', 'Degustación', 'Uso interno'],
  Ajuste: ['Conteo', 'Error de registro'],
  Traslado: ['Para el servicio', 'Reorganización'],
};

export default function RegistrarMovimiento({ abierto, onCerrar, onHecho, insumos = [], insumoInicial = null, tipoInicial = 'Merma' }) {
  const [tipo, setTipo] = useState(tipoInicial);
  const [insumo, setInsumo] = useState(insumoInicial);
  const [almacenes, setAlmacenes] = useState([]);
  const [stock, setStock] = useState([]);
  const [almacenId, setAlmacenId] = useState('');
  const [destinoId, setDestinoId] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!abierto) return;
    setTipo(tipoInicial);
    setInsumo(insumoInicial);
    setCantidad('');
    setMotivo('');
    setError(null);
    getAlmacenes().then((a) => setAlmacenes(a.filter((x) => x.activo !== false))).catch(() => {});
  }, [abierto, tipoInicial, insumoInicial]);

  // Cuánto hay del insumo en cada almacén, para elegir de dónde sale.
  useEffect(() => {
    if (!insumo) { setStock([]); return; }
    getStockPorProducto(insumo.id)
      .then((s) => {
        setStock(s);
        const conMas = [...s].sort((a, b) => b.cantidad - a.cantidad)[0];
        setAlmacenId(String(conMas?.almacenId ?? ''));
      })
      .catch(() => setStock([]));
  }, [insumo]);

  useEffect(() => {
    setDestinoId(String(almacenes.find((a) => String(a.id) !== String(almacenId))?.id ?? ''));
  }, [almacenes, almacenId]);

  const actual = stock.find((s) => String(s.almacenId) === String(almacenId))?.cantidad ?? 0;
  const unidad = insumo?.unidadMedida ?? '';
  const almacenesOrigen = tipo === 'Ajuste' ? almacenes : almacenes.filter((a) => stock.some((s) => s.almacenId === a.id && s.cantidad > 0));

  const guardar = async () => {
    if (!insumo) return setError('Elige el insumo.');
    if (!almacenId) return setError('Elige el almacén.');
    const n = Number(cantidad);
    if (!(n > 0) && !(tipo === 'Ajuste' && cantidad !== '' && n === 0)) return setError('Escribe una cantidad mayor que cero.');
    setGuardando(true);
    setError(null);
    try {
      if (tipo === 'Traslado') {
        const r = await compras.trasladar({ productoId: insumo.id, almacenOrigenId: Number(almacenId), almacenDestinoId: Number(destinoId), cantidad: n, motivo: motivo || null });
        onHecho?.(r.message);
      } else {
        await createMovimiento({ productoId: insumo.id, almacenId: Number(almacenId), tipoMovimiento: tipo, cantidad: n, motivo: motivo || tipo });
        onHecho?.(tipo === 'Ajuste' ? `${insumo.nombre} quedó en ${formatearCantidad(n, unidad)}` : `${tipo} registrada: ${formatearCantidad(n, unidad)} de ${insumo.nombre}`);
      }
    } catch (e) {
      setError(mensajeError(e, 'No se pudo registrar el movimiento'));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Panel
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Registrar movimiento"
      subtitulo="Para lo que sale sin venderse o cambia de lugar. Lo que llega del proveedor se registra en Recibir."
      pie={
        <div className="flex gap-2">
          <Boton variante="secundario" tamano="lg" onClick={onCerrar}>Cancelar</Boton>
          <Boton tamano="lg" className="flex-1" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : `Registrar ${tipo.toLowerCase()}`}</Boton>
        </div>
      }
    >
      <div className="space-y-5 p-5">
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Tipo de movimiento">
          {TIPOS.map(({ id, icono: Icono, titulo, texto }) => (
            <button
              key={id}
              type="button"
              aria-pressed={tipo === id}
              onClick={() => { setTipo(id); setMotivo(''); }}
              className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors ${tipo === id ? 'border-espresso bg-espresso text-white' : 'border-gray-200 bg-white text-espresso hover:border-gray-300'}`}
            >
              <Icono size={20} aria-hidden="true" />
              <span>
                <span className="block text-[14px] font-bold">{titulo}</span>
                <span className={`block text-[12px] ${tipo === id ? 'text-orange-100' : 'text-gray-500'}`}>{texto}</span>
              </span>
            </button>
          ))}
        </div>

        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-gray-600">Insumo</p>
          {insumo ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5">
              <span className="text-[15px] font-bold text-espresso">{insumo.nombre}</span>
              {!insumoInicial && <button type="button" className="text-[13px] font-bold text-orange-700 underline underline-offset-4" onClick={() => setInsumo(null)}>Cambiar</button>}
            </div>
          ) : (
            <BuscadorInsumo insumos={insumos} onElegir={setInsumo} autoFocus />
          )}
        </div>

        {insumo && (
          <>
            <div className={`grid gap-3 ${tipo === 'Traslado' ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <Selector label={tipo === 'Traslado' ? 'Sale de' : 'Almacén'} value={almacenId} onChange={(e) => setAlmacenId(e.target.value)}>
                {almacenesOrigen.length === 0 && <option value="">Sin existencias</option>}
                {almacenesOrigen.map((a) => {
                  const hay = stock.find((s) => s.almacenId === a.id)?.cantidad ?? 0;
                  return <option key={a.id} value={a.id}>{a.nombre} · {formatearCantidad(hay, unidad)}</option>;
                })}
              </Selector>
              {tipo === 'Traslado' && (
                <Selector label="Llega a" value={destinoId} onChange={(e) => setDestinoId(e.target.value)}>
                  {almacenes.filter((a) => String(a.id) !== String(almacenId)).map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                </Selector>
              )}
            </div>
            <Campo
              label={tipo === 'Ajuste' ? `Cantidad real que hay (${unidad})` : `Cantidad (${unidad})`}
              type="number" min="0" step="any" inputMode="decimal"
              value={cantidad} onChange={(e) => setCantidad(e.target.value)}
              ayuda={tipo === 'Ajuste'
                ? `El sistema dice ${formatearCantidad(actual, unidad)}. Se guarda la diferencia.`
                : `Hay ${formatearCantidad(actual, unidad)} en este almacén.`}
              className="tabular"
            />
            <div>
              <p className="mb-1.5 text-[13px] font-semibold text-gray-600">Motivo</p>
              <div className="flex flex-wrap gap-2">
                {MOTIVOS[tipo].map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={motivo === m}
                    onClick={() => setMotivo(motivo === m ? '' : m)}
                    className={`h-9 rounded-full border px-3.5 text-[13px] font-semibold transition-colors ${motivo === m ? 'border-espresso bg-espresso text-white' : 'border-gray-200 text-espresso hover:border-gray-300'}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <Campo className="mt-2" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="U otro motivo" />
            </div>
          </>
        )}

        {error && <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-[14px] font-semibold text-red-800" role="alert">{error}</p>}
      </div>
    </Panel>
  );
}
