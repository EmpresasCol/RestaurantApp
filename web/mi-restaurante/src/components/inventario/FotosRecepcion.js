// Fotos de evidencia de lo que llegó: tomarlas con la cámara o subirlas al registrar la entrada,
// y verlas (o sumar más) después en las entradas recientes y en cada orden.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, ChevronLeft, ChevronRight, ImagePlus, Images, X } from 'lucide-react';
import { compras, mensajeError } from '../../services/inventarioApi';
import { reducirImagen } from '../../utils/imagenes';
import { formatearCOP } from '../../utils/inventario';
import { Boton, Cargando, Lista, Panel } from './ui';

export const MAXIMO_FOTOS = 10;

/** Botones "Tomar foto" (cámara trasera del celular) y "Subir fotos" (galería o archivo, varias a la vez). */
export function BotonesFoto({ onFotos, disponibles = MAXIMO_FOTOS, onError, tamano = 'md' }) {
  const camara = useRef(null);
  const galeria = useRef(null);
  const [leyendo, setLeyendo] = useState(false);

  const alElegir = async (e) => {
    const archivos = Array.from(e.target.files ?? []).filter((a) => a.type.startsWith('image/'));
    e.target.value = ''; // permite volver a elegir la misma foto
    if (!archivos.length) return;
    if (archivos.length > disponibles) onError?.(`Caben ${disponibles} foto${disponibles === 1 ? '' : 's'} más`);
    setLeyendo(true);
    try {
      onFotos(await Promise.all(archivos.slice(0, disponibles).map((a) => reducirImagen(a, 1280, 0.8))));
    } catch {
      onError?.('No se pudo leer la foto');
    } finally {
      setLeyendo(false);
    }
  };

  const sinCupo = disponibles <= 0 || leyendo;
  return (
    <div className="flex flex-wrap gap-2">
      <input ref={camara} type="file" accept="image/*" capture="environment" className="hidden" onChange={alElegir} />
      <input ref={galeria} type="file" accept="image/*" multiple className="hidden" onChange={alElegir} />
      <Boton variante="secundario" tamano={tamano} onClick={() => camara.current?.click()} disabled={sinCupo}>
        <Camera size={17} aria-hidden="true" /> Tomar foto
      </Boton>
      <Boton variante="secundario" tamano={tamano} onClick={() => galeria.current?.click()} disabled={sinCupo}>
        <ImagePlus size={17} aria-hidden="true" /> {leyendo ? 'Preparando…' : 'Subir fotos'}
      </Boton>
    </div>
  );
}

/** Miniaturas de las fotos que aún no se han enviado, cada una con su botón para quitarla. */
export function MiniaturasFotos({ fotos, onQuitar, onVer }) {
  if (!fotos.length) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-2" aria-label="Fotos de evidencia">
      {fotos.map((f, i) => (
        <li key={f.slice(-40) + i} className="relative">
          <button type="button" onClick={() => onVer?.(i)} className="block h-20 w-20 overflow-hidden rounded-xl border border-gray-200 bg-gray-100" aria-label={`Ver foto ${i + 1}`}>
            <img src={f} alt="" className="h-full w-full object-cover" />
          </button>
          {onQuitar && (
            <button
              type="button"
              onClick={() => onQuitar(i)}
              className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-espresso text-white shadow-card"
              aria-label={`Quitar foto ${i + 1}`}
            >
              <X size={14} />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Visor a pantalla completa. `fotos` son data URI o promesas de cargar cada una (por Id). */
export function VisorFotos({ fotos, inicio = 0, onCerrar, cargar }) {
  const [i, setI] = useState(inicio);
  const [src, setSrc] = useState(null);
  const total = fotos?.length ?? 0;

  useEffect(() => { setI(inicio); }, [inicio, fotos]);
  useEffect(() => {
    if (!total) return undefined;
    let vivo = true;
    const f = fotos[i];
    if (typeof f === 'string' && f.startsWith('data:')) setSrc(f);
    else {
      setSrc(null);
      cargar(f).then((d) => vivo && setSrc(d)).catch(() => vivo && setSrc(''));
    }
    return () => { vivo = false; };
  }, [fotos, i, total, cargar]);

  useEffect(() => {
    if (!total) return undefined;
    const tecla = (e) => {
      if (e.key === 'Escape') onCerrar();
      if (e.key === 'ArrowRight') setI((x) => Math.min(total - 1, x + 1));
      if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1));
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [total, onCerrar]);

  if (!total) return null;
  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-espresso/95" role="dialog" aria-modal="true" aria-label="Fotos de evidencia">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <p className="tabular text-[15px] font-bold">Foto {i + 1} de {total}</p>
        <button type="button" onClick={onCerrar} className="grid h-11 w-11 place-items-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Cerrar">
          <X size={20} />
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-6">
        {src === null ? <p className="text-[15px] text-white/70">Cargando foto…</p>
          : src === '' ? <p className="text-[15px] text-white/70">No se pudo cargar la foto</p>
            : <img src={src} alt={`Evidencia ${i + 1}`} className="max-h-full max-w-full rounded-xl object-contain" />}
        {i > 0 && (
          <button type="button" onClick={() => setI(i - 1)} className="absolute left-3 grid h-12 w-12 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25" aria-label="Foto anterior">
            <ChevronLeft size={22} />
          </button>
        )}
        {i < total - 1 && (
          <button type="button" onClick={() => setI(i + 1)} className="absolute right-3 grid h-12 w-12 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25" aria-label="Foto siguiente">
            <ChevronRight size={22} />
          </button>
        )}
      </div>
    </div>
  );
}

const fechaHora = (iso) => {
  const f = new Date(/Z|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  return f.toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
};

/** Entradas de mercancía con sus fotos. Con `ordenId` muestra solo las de esa orden. */
export function EntradasRecientes({ ordenId = null, version, mostrar, limite = 8, vacio = null }) {
  const [entradas, setEntradas] = useState(null);
  const [visor, setVisor] = useState(null);
  const [subiendo, setSubiendo] = useState(null);

  const cargar = useCallback(() => {
    compras.recepciones({ ordenId: ordenId ?? undefined, limite })
      .then(setEntradas)
      .catch((e) => { setEntradas([]); mostrar?.(mensajeError(e, 'No se pudieron cargar las entradas'), 'error'); });
  }, [ordenId, limite, mostrar]);

  useEffect(() => { cargar(); }, [cargar, version]);

  const agregar = async (entrada, fotos) => {
    setSubiendo(entrada.id);
    try {
      const r = await compras.agregarFotos(entrada.id, fotos);
      // Se ven al instante, sin esperar a recargar la lista.
      setEntradas((es) => es.map((x) => (x.id === entrada.id ? { ...x, fotos: [...x.fotos, ...r.fotos] } : x)));
      mostrar?.(r.message);
    } catch (e) {
      mostrar?.(mensajeError(e, 'No se pudieron guardar las fotos'), 'error');
    } finally {
      setSubiendo(null);
    }
  };

  if (!entradas) return <Cargando filas={2} />;
  if (!entradas.length) return vacio;
  return (
    <>
      <Lista>
        {entradas.map((e) => (
          <div key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-2 text-[15px] font-bold text-espresso">
                <span className="tabular">R-{e.id}</span>
                <span className="font-semibold">{e.proveedor ?? 'Compra directa'}</span>
              </p>
              <p className="tabular text-[13px] text-gray-500">
                {[fechaHora(e.fecha), `${e.lineas} insumo${e.lineas === 1 ? '' : 's'}`, e.numeroOrden, e.documento && `Factura ${e.documento}`].filter(Boolean).join(' · ')}
              </p>
            </div>
            <span className="tabular text-[15px] font-bold text-espresso">{formatearCOP(e.total)}</span>
            <div className="flex flex-wrap items-center gap-2">
              {e.fotos.length > 0 && (
                <Boton variante="secundario" tamano="sm" onClick={() => setVisor(e.fotos)}>
                  <Images size={15} aria-hidden="true" /> {e.fotos.length} foto{e.fotos.length === 1 ? '' : 's'}
                </Boton>
              )}
              {subiendo === e.id ? <span className="text-[13px] font-semibold text-gray-500">Subiendo…</span> : (
                <BotonesFoto tamano="sm" disponibles={MAXIMO_FOTOS - e.fotos.length} onFotos={(f) => agregar(e, f)} onError={(m) => mostrar?.(m, 'error')} />
              )}
            </div>
          </div>
        ))}
      </Lista>
      <VisorFotos fotos={visor} onCerrar={() => setVisor(null)} cargar={compras.fotoRecepcion} />
    </>
  );
}

/** Panel con las entradas (y fotos) de una orden de compra. */
export function PanelEntradasOrden({ orden, onCerrar, mostrar }) {
  return (
    <Panel
      abierto={!!orden}
      onCerrar={onCerrar}
      titulo={orden ? `Entradas de ${orden.numeroOrden}` : ''}
      subtitulo="Lo que se recibió de esta orden, con sus fotos. Puedes sumar fotos que faltaron."
    >
      <div className="p-5">
        {orden && (
          <EntradasRecientes
            ordenId={orden.id}
            limite={50}
            mostrar={mostrar}
            vacio={<p className="text-[14px] text-gray-500">Aún no se ha recibido nada de esta orden.</p>}
          />
        )}
      </div>
    </Panel>
  );
}
