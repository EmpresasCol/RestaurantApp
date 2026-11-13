// src/components/menu/HojaInferior.js
// Único patrón de diálogo del comensal (plato, carrito y su mesa).
import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';

const ease = [0.16, 1, 0.3, 1];

/** Hoja inferior reutilizable: entra desde abajo y se cierra arrastrando o con Escape. */
export default function HojaInferior({ abierta, onCerrar, titulo, children, pie }) {
  useEffect(() => {
    if (!abierta) return undefined;
    const alTeclear = (e) => e.key === 'Escape' && onCerrar();
    document.addEventListener('keydown', alTeclear);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', alTeclear);
      document.body.style.overflow = overflow;
    };
  }, [abierta, onCerrar]);

  return (
    <AnimatePresence>
      {abierta && (
        <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label={titulo}>
          <motion.div
            className="absolute inset-0 bg-espresso/55"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onCerrar}
          />
          <motion.div
            className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-lift md:max-w-lg md:rounded-[28px]"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.45, ease }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => { if (info.offset.y > 120 || info.velocity.y > 600) onCerrar(); }}
          >
            <div className="flex justify-center pt-3 md:hidden" aria-hidden="true">
              <span className="h-1.5 w-10 rounded-full bg-gray-300" />
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
            {pie && <div className="border-t border-gray-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{pie}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
