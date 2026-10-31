// Piezas comunes del módulo de inventario, sobre el sistema visual del personal (DESIGN.md).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

export const ease = [0.16, 1, 0.3, 1];

const TONOS = {
  peligro: 'bg-red-50 text-red-800',
  aviso: 'bg-amber-50 text-amber-800',
  ok: 'bg-green-50 text-green-800',
  info: 'bg-purple-50 text-purple-700',
  neutro: 'bg-gray-100 text-gray-600',
};

export function Chip({ tono = 'neutro', children, className = '' }) {
  return (
    <span className={`inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-[12px] font-bold ${TONOS[tono]} ${className}`}>
      {children}
    </span>
  );
}

const TONO_ESTADO = { Agotado: 'peligro', Bajo: 'aviso', OK: 'ok' };
const TEXTO_ESTADO = { Agotado: 'Agotado', Bajo: 'Por pedir', OK: 'Al día' };

export const ChipEstado = ({ estado }) => <Chip tono={TONO_ESTADO[estado] ?? 'neutro'}>{TEXTO_ESTADO[estado] ?? estado}</Chip>;

const VARIANTES = {
  primario: 'bg-espresso text-white hover:bg-gray-900 disabled:bg-gray-300 disabled:text-gray-600',
  secundario: 'border border-gray-300 bg-white text-espresso hover:border-gray-400 hover:bg-gray-50 disabled:text-gray-400',
  fantasma: 'text-espresso hover:bg-gray-100 disabled:text-gray-400',
  peligro: 'border border-red-200 bg-white text-red-700 hover:bg-red-50 disabled:text-gray-400',
};

export function Boton({ variante = 'primario', tamano = 'md', className = '', children, ...props }) {
  const alto = tamano === 'lg' ? 'h-12 px-5 text-[15px]' : tamano === 'sm' ? 'h-9 px-3 text-[13px]' : 'h-10 px-4 text-[14px]';
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-bold transition-colors disabled:cursor-not-allowed ${alto} ${VARIANTES[variante]} ${className}`}
    >
      {children}
    </button>
  );
}

const claseCampo =
  'h-11 w-full rounded-xl border border-gray-300 bg-white px-3.5 text-[15px] text-espresso placeholder:text-gray-500 transition-shadow focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-100';

export function Campo({ label, ayuda, className = '', id, ...props }) {
  const autoId = useRef(`campo-${Math.random().toString(36).slice(2, 8)}`).current;
  const idCampo = id ?? autoId;
  return (
    <label htmlFor={idCampo} className={`block ${className}`}>
      {label && <span className="mb-1.5 block text-[13px] font-semibold text-gray-600">{label}</span>}
      <input id={idCampo} {...props} className={claseCampo} />
      {ayuda && <span className="mt-1 block text-[12px] text-gray-500">{ayuda}</span>}
    </label>
  );
}

export function Selector({ label, className = '', children, ...props }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="mb-1.5 block text-[13px] font-semibold text-gray-600">{label}</span>}
      <select {...props} className={`${claseCampo} pr-8`}>
        {children}
      </select>
    </label>
  );
}

/** Panel de detalle: hoja inferior en el celular, lateral derecho desde md. */
export function Panel({ abierto, onCerrar, titulo, subtitulo, children, pie, ancho = 'md:w-[560px]' }) {
  useEffect(() => {
    if (!abierto) return undefined;
    const alTeclear = (e) => e.key === 'Escape' && onCerrar();
    document.addEventListener('keydown', alTeclear);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', alTeclear);
      document.body.style.overflow = overflow;
    };
  }, [abierto, onCerrar]);

  // Lateral desde la derecha en pantallas anchas; hoja que sube en el celular.
  const lateral = typeof window !== 'undefined' && window.matchMedia?.('(min-width: 768px)').matches;
  const fuera = lateral ? { x: '100%', y: 0 } : { y: '100%', x: 0 };

  // Portal: un panel abierto desde otro panel no queda atrapado en su transform.
  return createPortal(
    <AnimatePresence>
      {abierto && (
        <div className="fixed inset-0 z-50 flex items-end md:items-stretch md:justify-end" role="dialog" aria-modal="true" aria-label={titulo}>
          <motion.div
            className="absolute inset-0 bg-espresso/55"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onCerrar}
          />
          <motion.section
            className={`relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-lift md:max-h-none md:rounded-none md:rounded-l-[28px] ${ancho}`}
            initial={fuera}
            animate={{ y: 0, x: 0 }}
            exit={fuera}
            transition={{ duration: 0.45, ease }}
          >
            <header className="flex items-start gap-3 border-b border-gray-200 px-5 pb-4 pt-5">
              <div className="min-w-0 flex-1">
                <h2 className="text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-espresso">{titulo}</h2>
                {subtitulo && <div className="mt-1 text-[13px] text-gray-500">{subtitulo}</div>}
              </div>
              <button
                type="button"
                onClick={onCerrar}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gray-100 text-espresso hover:bg-gray-200"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
            {pie && <footer className="border-t border-gray-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{pie}</footer>}
          </motion.section>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/** Aviso flotante (éxito o error) que se va solo. */
export function useAviso() {
  const [aviso, setAviso] = useState(null);
  const mostrar = useCallback((mensaje, tipo = 'ok') => setAviso({ mensaje, tipo, id: Date.now() }), []);

  useEffect(() => {
    if (!aviso) return undefined;
    const t = setTimeout(() => setAviso(null), aviso.tipo === 'error' ? 4000 : 2400);
    return () => clearTimeout(t);
  }, [aviso]);

  const elemento = createPortal(
    <AnimatePresence>
      {aviso && (
        <motion.div
          key={aviso.id}
          role={aviso.tipo === 'error' ? 'alert' : 'status'}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.35, ease }}
          className={`fixed bottom-28 left-1/2 z-[60] flex max-w-[calc(100vw-32px)] -translate-x-1/2 items-center gap-2.5 rounded-full px-5 py-3 text-[15px] font-bold shadow-lift ${
            aviso.tipo === 'error' ? 'bg-red-700 text-white' : 'bg-white text-espresso'
          }`}
        >
          {aviso.tipo === 'error'
            ? <AlertCircle size={20} aria-hidden="true" />
            : <CheckCircle2 size={20} className="text-green-600" aria-hidden="true" />}
          <span>{aviso.mensaje}</span>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );

  return [elemento, mostrar];
}

export function Vacio({ icono: Icono, titulo, texto, children }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {Icono && (
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-orange-50 text-orange-700">
          <Icono size={26} aria-hidden="true" />
        </span>
      )}
      <p className="mt-4 text-[16px] font-bold text-espresso">{titulo}</p>
      {texto && <p className="mt-1 max-w-sm text-[14px] text-gray-500">{texto}</p>}
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}

export function Cargando({ filas = 4 }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: filas }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-2xl bg-gray-100" />
      ))}
    </div>
  );
}

/** Encabezado de bloque: título a la izquierda, acción a la derecha. */
export function Encabezado({ titulo, detalle, children }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-[20px] font-extrabold tracking-[-0.02em] text-espresso">{titulo}</h2>
        {detalle && <p className="mt-0.5 text-[13px] text-gray-500">{detalle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

/** Contenedor de lista: superficie blanca con borde, filas separadas por línea. */
export const Lista = ({ children, className = '' }) => (
  <div className={`divide-y divide-gray-200 overflow-hidden rounded-2xl border border-gray-200 bg-white ${className}`}>{children}</div>
);

/** Botón de dos toques para acciones que no se deshacen (sin modal). */
export function BotonConfirmar({ children, confirmar = 'Toca otra vez para confirmar', onConfirmar, ...props }) {
  const [armado, setArmado] = useState(false);
  useEffect(() => {
    if (!armado) return undefined;
    const t = setTimeout(() => setArmado(false), 3000);
    return () => clearTimeout(t);
  }, [armado]);
  return (
    <Boton
      variante={armado ? 'primario' : 'peligro'}
      tamano="sm"
      {...props}
      onClick={() => (armado ? (setArmado(false), onConfirmar()) : setArmado(true))}
    >
      {armado ? confirmar : children}
    </Boton>
  );
}
