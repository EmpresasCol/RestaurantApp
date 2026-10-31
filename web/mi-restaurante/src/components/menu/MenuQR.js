// src/components/menu/MenuQR.js
// Menú del comensal (QR de la mesa). Pensado primero para el celular:
// pestañas de categoría fijas, carrusel de destacados, rieles por categoría,
// hoja del plato para notas y carrito como hoja inferior.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronRight, Minus, Plus, Search, ShoppingBag, Trash2, UtensilsCrossed, X } from 'lucide-react';
import Carousel from '../reactbits/Carousel/Carousel';
import CountUp from '../reactbits/CountUp/CountUp';
import ClickSpark from '../reactbits/ClickSpark/ClickSpark';
import logo from '../logo.jpg';

const ease = [0.16, 1, 0.3, 1];
const NOTAS_RAPIDAS = ['Sin cebolla', 'Sin salsas', 'Bien cocido', 'Término medio', 'Sin picante'];

const formatear = (valor) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(valor);

// La API marca disponible=false cuando no hay ingredientes para una porción.
export const agotado = (platillo) => platillo?.disponible === false;
export const NO_DISPONIBLE = 'No disponible por el momento';
const MAX_POR_PLATO = 50;
// Porciones que se pueden pedir de un platillo (null en la API = sin control de inventario).
export const topePorciones = (platillo) =>
  agotado(platillo) ? 0 : Math.min(MAX_POR_PLATO, platillo?.porcionesDisponibles ?? MAX_POR_PLATO);

const idCategoria = (nombre) => `cat-${nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

function FotoPlato({ platillo, className = '' }) {
  const [fallo, setFallo] = useState(false);
  if (!platillo.imagenUrl || fallo) {
    return (
      <div className={`flex items-center justify-center bg-orange-50 ${className}`}>
        <UtensilsCrossed className="text-orange-300" size={36} strokeWidth={1.5} aria-hidden="true" />
      </div>
    );
  }
  return (
    <img
      src={platillo.imagenUrl}
      alt={platillo.nombre}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setFallo(true)}
      className={`object-cover ${className}`}
    />
  );
}

/** Botón + que se convierte en selector − n + al agregar el primer plato. */
function ControlCantidad({ cantidad, onSumar, onRestar, nombre, oscuro = false }) {
  const base = oscuro ? 'bg-white text-espresso' : 'bg-espresso text-white';
  return (
    <ClickSpark sparkColor="#C8955E" sparkCount={8} sparkRadius={18} sparkSize={8} duration={420}>
      <motion.div
        layout
        transition={{ duration: 0.35, ease }}
        className={`flex h-11 items-center overflow-hidden rounded-full shadow-card ${base}`}
      >
        <AnimatePresence initial={false} mode="popLayout">
          {cantidad > 0 && (
            <motion.button
              key="menos"
              type="button"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.25, ease }}
              onClick={(e) => { e.stopPropagation(); onRestar(); }}
              className="grid h-11 w-11 place-items-center"
              aria-label={`Quitar un ${nombre}`}
            >
              <Minus size={18} strokeWidth={2.5} />
            </motion.button>
          )}
          {cantidad > 0 && (
            <motion.span
              key={`n-${cantidad}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.22, ease }}
              className="tabular min-w-[1.25rem] text-center text-[15px] font-extrabold"
              aria-live="polite"
            >
              {cantidad}
            </motion.span>
          )}
        </AnimatePresence>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onSumar(); }}
          className="grid h-11 w-11 place-items-center"
          aria-label={`Agregar ${nombre}`}
        >
          <Plus size={20} strokeWidth={2.5} />
        </button>
      </motion.div>
    </ClickSpark>
  );
}

function TarjetaPlato({ platillo, cantidad, onAbrir, onSumar, onRestar }) {
  const sinStock = agotado(platillo);
  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, ease }}
      onClick={onAbrir}
      className="group w-[72vw] max-w-[260px] shrink-0 cursor-pointer lg:w-auto lg:max-w-none"
    >
      <div className="relative overflow-hidden rounded-[20px] bg-gray-100 shadow-card transition-shadow duration-300 group-hover:shadow-lift">
        <FotoPlato
          platillo={platillo}
          className={`aspect-[4/3] w-full transition-transform duration-700 ease-out group-hover:scale-[1.04] ${sinStock ? 'opacity-50 grayscale' : ''}`}
        />
        {sinStock ? (
          <span className="absolute bottom-3 left-3 right-3 rounded-full bg-white/95 px-3 py-2 text-center text-[13px] font-bold text-espresso shadow-card">
            {NO_DISPONIBLE}
          </span>
        ) : (
          <div className="absolute bottom-3 right-3">
            <ControlCantidad cantidad={cantidad} onSumar={onSumar} onRestar={onRestar} nombre={platillo.nombre} oscuro />
          </div>
        )}
      </div>
      <div className="px-1 pt-3">
        <h3 className="text-[16px] font-bold leading-snug text-espresso">{platillo.nombre}</h3>
        {platillo.descripcion && (
          <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-gray-500">{platillo.descripcion}</p>
        )}
        <p className="tabular mt-2 text-[15px] font-extrabold text-espresso">{formatear(platillo.precio)}</p>
      </div>
    </motion.article>
  );
}

/** Hoja inferior reutilizable: entra desde abajo y se cierra arrastrando o con Escape. */
function HojaInferior({ abierta, onCerrar, titulo, children, pie }) {
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

function HojaPlato({ platillo, onCerrar, onAgregar }) {
  const [nota, setNota] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const tope = topePorciones(platillo);

  useEffect(() => {
    setNota('');
    setCantidad(1);
  }, [platillo?.id]);

  const alternarNota = (texto) => {
    const partes = nota.split(',').map((p) => p.trim()).filter(Boolean);
    const nuevas = partes.includes(texto) ? partes.filter((p) => p !== texto) : [...partes, texto];
    setNota(nuevas.join(', '));
  };

  return (
    <HojaInferior
      abierta={!!platillo}
      onCerrar={onCerrar}
      titulo={platillo?.nombre ?? 'Plato'}
      pie={platillo && (tope === 0 ? (
        <p className="flex h-14 items-center justify-center rounded-full bg-gray-100 text-[15px] font-bold text-gray-600" role="status">
          {NO_DISPONIBLE}
        </p>
      ) : (
        <div className="flex items-center gap-3">
          <div className="flex h-14 items-center rounded-full border border-gray-200">
            <button type="button" className="grid h-14 w-12 place-items-center disabled:text-gray-300" onClick={() => setCantidad((c) => Math.max(1, c - 1))} disabled={cantidad <= 1} aria-label="Menos">
              <Minus size={18} strokeWidth={2.5} />
            </button>
            <span className="tabular w-6 text-center text-lg font-extrabold">{cantidad}</span>
            <button type="button" className="grid h-14 w-12 place-items-center disabled:text-gray-300" onClick={() => setCantidad((c) => Math.min(tope, c + 1))} disabled={cantidad >= tope} aria-label="Más">
              <Plus size={18} strokeWidth={2.5} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => onAgregar(platillo, cantidad, nota.trim())}
            className="flex h-14 flex-1 items-center justify-between rounded-full bg-espresso px-6 text-[15px] font-bold text-white transition-transform active:scale-[0.98]"
          >
            <span>Agregar</span>
            <span className="tabular">{formatear(platillo.precio * cantidad)}</span>
          </button>
        </div>
      ))}
    >
      {platillo && (
        <>
          <div className="relative">
            <FotoPlato platillo={platillo} className="aspect-[16/10] w-full" />
            <button type="button" onClick={onCerrar} className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white text-espresso shadow-card" aria-label="Cerrar">
              <X size={20} />
            </button>
          </div>
          <div className="px-5 pb-6 pt-5">
            <h2 className="text-2xl font-extrabold tracking-[-0.02em] text-espresso">{platillo.nombre}</h2>
            <p className="tabular mt-1 text-lg font-bold text-orange-700">{formatear(platillo.precio)}</p>
            {platillo.descripcion && <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-gray-600">{platillo.descripcion}</p>}

            <label htmlFor="nota-plato" className="mt-6 block text-sm font-bold text-espresso">
              Indicaciones para la cocina
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              {NOTAS_RAPIDAS.map((texto) => {
                const activa = nota.split(',').map((p) => p.trim()).includes(texto);
                return (
                  <button
                    key={texto}
                    type="button"
                    onClick={() => alternarNota(texto)}
                    aria-pressed={activa}
                    className={`h-9 rounded-full border px-3.5 text-[13px] font-semibold transition-colors ${
                      activa ? 'border-espresso bg-espresso text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {texto}
                  </button>
                );
              })}
            </div>
            <textarea
              id="nota-plato"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Escribe otra indicación (opcional)"
              rows={2}
              maxLength={200}
              className="mt-3 w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 p-3.5 text-[15px] placeholder:text-gray-500 focus:border-orange-400 focus:bg-white focus:outline-none"
            />
          </div>
        </>
      )}
    </HojaInferior>
  );
}

export default function MenuQR({ platillos, cargando, mesaId, numeroMesa, aviso, onEnviarPedido, onRecargarCarta, offsetSuperior = 0 }) {
  const [carrito, setCarrito] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [categoriaActiva, setCategoriaActiva] = useState(null);
  const [platoAbierto, setPlatoAbierto] = useState(null);
  const [carritoAbierto, setCarritoAbierto] = useState(false);
  const [envio, setEnvio] = useState({ estado: 'idle', error: null, resumen: null });
  const totalAnterior = useRef(0);
  const destacadosRef = useRef(null);
  const [anchoDestacados, setAnchoDestacados] = useState(0);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return q ? platillos.filter((p) => `${p.nombre} ${p.descripcion ?? ''}`.toLowerCase().includes(q)) : platillos;
  }, [platillos, busqueda]);

  const categorias = useMemo(() => {
    const grupos = new Map();
    filtrados.forEach((p) => {
      const cat = p.categoria || 'Otros';
      if (!grupos.has(cat)) grupos.set(cat, []);
      grupos.get(cat).push(p);
    });
    return [...grupos.entries()];
  }, [filtrados]);

  // Destacados: el plato con foto de mayor precio de cada categoría (no es un ranking de ventas).
  // Así el carrusel no repite la primera tarjeta de cada riel.
  const destacados = useMemo(() => {
    const porCategoria = new Map();
    platillos
      .filter((p) => p.imagenUrl && !agotado(p))
      .forEach((p) => {
        const cat = p.categoria || 'Otros';
        if (!porCategoria.has(cat) || p.precio > porCategoria.get(cat).precio) porCategoria.set(cat, p);
      });
    return [...porCategoria.values()].slice(0, 5);
  }, [platillos]);

  const totalUnidades = carrito.reduce((s, i) => s + i.cantidad, 0);
  const total = carrito.reduce((s, i) => s + i.precio * i.cantidad, 0);

  useEffect(() => {
    if (!categoriaActiva && categorias.length) setCategoriaActiva(categorias[0][0]);
  }, [categorias, categoriaActiva]);

  // La pestaña activa sigue la sección visible al desplazarse.
  useEffect(() => {
    const secciones = categorias.map(([cat]) => document.getElementById(idCategoria(cat))).filter(Boolean);
    if (!secciones.length || typeof IntersectionObserver === 'undefined') return undefined;
    const obs = new IntersectionObserver(
      (entradas) => {
        const visible = entradas.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setCategoriaActiva(visible.target.dataset.categoria);
      },
      { rootMargin: '-140px 0px -55% 0px' }
    );
    secciones.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, [categorias]);

  useEffect(() => {
    const el = destacadosRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => setAnchoDestacados(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [destacados.length]);

  const cantidadRapida = (id) => carrito.find((i) => i.id === id && i.nota === '')?.cantidad ?? 0;

  // Lo que queda por pedir de un platillo, sumando todas sus notas en el carrito.
  const restantes = (actual, id) =>
    topePorciones(platillos.find((p) => p.id === id)) - actual.filter((i) => i.id === id).reduce((n, i) => n + i.cantidad, 0);

  const agregar = (platillo, cantidad = 1, nota = '') => {
    totalAnterior.current = total;
    setCarrito((actual) => {
      const n = Math.min(cantidad, restantes(actual, platillo.id));
      if (n <= 0) return actual;
      const existe = actual.find((i) => i.id === platillo.id && i.nota === nota);
      if (existe) return actual.map((i) => (i === existe ? { ...i, cantidad: i.cantidad + n } : i));
      return [...actual, { id: platillo.id, nombre: platillo.nombre, precio: platillo.precio, imagenUrl: platillo.imagenUrl, nota, cantidad: n }];
    });
  };

  const cambiarCantidad = (id, nota, delta) => {
    totalAnterior.current = total;
    setCarrito((actual) => {
      if (delta > 0 && restantes(actual, id) < delta) return actual;
      return actual
        .map((i) => (i.id === id && i.nota === nota ? { ...i, cantidad: i.cantidad + delta } : i))
        .filter((i) => i.cantidad > 0);
    });
  };

  const irACategoria = (cat) => {
    setCategoriaActiva(cat);
    document.getElementById(idCategoria(cat))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const enviar = async () => {
    if (!mesaId || !carrito.length) return;
    setEnvio({ estado: 'enviando', error: null, resumen: null });
    try {
      await onEnviarPedido(mesaId, carrito);
      setEnvio({ estado: 'enviado', error: null, resumen: { unidades: totalUnidades, total } });
      setCarrito([]);
      totalAnterior.current = 0;
    } catch (error) {
      setEnvio({ estado: 'error', error: error.message?.replace(/^Error al crear pedido:\s*/, '') || 'No se pudo enviar el pedido.', resumen: null });
    } finally {
      // El stock cambió (o alguien pidió antes): refrescar qué sigue disponible.
      onRecargarCarta?.();
    }
  };

  const cerrarCarrito = () => {
    setCarritoAbierto(false);
    if (envio.estado !== 'enviando') setEnvio({ estado: 'idle', error: null, resumen: null });
  };

  return (
    <div className="min-h-screen overflow-x-clip bg-white pb-32 text-espresso">
      {/* Cabecera */}
      <header className="sticky z-30 border-b border-gray-200/80 bg-white" style={{ top: offsetSuperior }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="flex min-w-0 items-center gap-3">
            <img src={logo} alt="Qpro" className="h-10 w-10 shrink-0 rounded-xl object-contain ring-1 ring-gray-200" />
            <div className="min-w-0">
              <p className="text-[17px] font-extrabold leading-tight tracking-[-0.01em]">Qpro</p>
              <p className="truncate text-[13px] font-medium text-gray-500">
                {mesaId ? `Mesa ${numeroMesa} · pide desde aquí` : 'Vista previa del menú'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCarritoAbierto(true)}
            className="relative grid h-11 w-11 place-items-center rounded-full bg-gray-100 text-espresso transition-colors hover:bg-gray-200"
            aria-label={`Ver pedido, ${totalUnidades} platos`}
          >
            <ShoppingBag size={20} />
            <AnimatePresence>
              {totalUnidades > 0 && (
                <motion.span
                  key={totalUnidades}
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.4, opacity: 0 }}
                  transition={{ duration: 0.3, ease }}
                  className="tabular absolute -right-1 -top-1 grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-orange-500 px-1 text-[11px] font-extrabold text-espresso"
                >
                  {totalUnidades}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>

        <div className="mx-auto max-w-6xl px-4 pb-3">
          <label className="flex h-11 items-center gap-2 rounded-2xl bg-gray-100 px-3.5 text-gray-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-orange-300">
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar en la carta"
              className="h-full w-full bg-transparent text-[15px] text-espresso placeholder:text-gray-500 focus:outline-none"
            />
          </label>
        </div>

        {/* Pestañas de categoría con indicador deslizante */}
        {categorias.length > 1 && (
          <nav className="qp-rail mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 pb-2" aria-label="Categorías">
            {categorias.map(([cat]) => {
              const activa = cat === categoriaActiva;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => irACategoria(cat)}
                  className={`relative h-10 shrink-0 rounded-full px-4 text-[14px] font-bold transition-colors ${activa ? 'text-white' : 'text-gray-600 hover:text-espresso'}`}
                  aria-current={activa ? 'true' : undefined}
                >
                  {activa && (
                    <motion.span layoutId="pestana-activa" className="absolute inset-0 rounded-full bg-espresso" transition={{ duration: 0.4, ease }} />
                  )}
                  <span className="relative">{cat}</span>
                </button>
              );
            })}
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-6xl">
        {!mesaId && (
          <p className="mx-4 mt-4 rounded-2xl bg-orange-50 px-4 py-3 text-[14px] font-medium text-orange-900">
            {aviso ?? 'Esta es una vista previa. Para enviar pedidos, abre el menú desde el QR de una mesa.'}
          </p>
        )}

        {cargando && (
          <div className="space-y-6 px-4 pt-6" aria-busy="true" aria-label="Cargando la carta">
            <div className="aspect-[16/9] animate-pulse rounded-[24px] bg-gray-100" />
            <div className="flex gap-4 overflow-hidden">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-[72vw] max-w-[260px] shrink-0">
                  <div className="aspect-[4/3] animate-pulse rounded-[20px] bg-gray-100" />
                  <div className="mt-3 h-4 w-2/3 animate-pulse rounded bg-gray-100" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Destacados */}
        {!cargando && !busqueda && destacados.length > 1 && (
          <section className="px-4 pt-5" aria-label="Destacados">
            <h2 className="mb-3 text-[20px] font-extrabold tracking-[-0.02em]">Destacados</h2>
            <div ref={destacadosRef} className="w-full overflow-hidden rounded-[24px] lg:overflow-visible lg:rounded-none">
              <div className="lg:overflow-hidden lg:rounded-[24px]">
              {anchoDestacados > 0 && (
                <Carousel
                  items={destacados.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPlatoAbierto(p)}
                      className="relative block h-full w-full text-left"
                    >
                      <FotoPlato platillo={p} className="absolute inset-0 h-full w-full" />
                      <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                      <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
                        <span className="min-w-0">
                          <span className="block truncate text-[18px] font-extrabold text-white">{p.nombre}</span>
                          <span className="tabular block text-[14px] font-semibold text-white/85">{formatear(p.precio)}</span>
                        </span>
                        <span className="flex h-10 shrink-0 items-center gap-1 rounded-full bg-white px-4 text-[13px] font-bold text-espresso">
                          Ver <ChevronRight size={16} />
                        </span>
                      </span>
                    </button>
                  ))}
                  baseWidth={anchoDestacados}
                  aspectRatio={anchoDestacados < 640 ? 1.5 : anchoDestacados < 1024 ? 2.3 : 3.4}
                  peek={anchoDestacados < 640 ? 14 : 0}
                  style={{ '--carousel-faint': 'rgba(42,29,21,0.22)', '--carousel-soft': 'rgba(42,29,21,0.45)', '--carousel-ink': '#2A1D15' }}
                  gap={12}
                  radius={24}
                  frame={false}
                  effect="slide"
                  indicator="dots"
                  autoplay
                  autoplayDelay={4500}
                  pauseOnHover
                  loop
                  theme="light"
                />
              )}
              </div>
            </div>
          </section>
        )}

        {!cargando && categorias.length === 0 && (
          <div className="px-6 py-20 text-center">
            <UtensilsCrossed className="mx-auto text-gray-300" size={40} strokeWidth={1.5} />
            <p className="mt-4 text-[16px] font-bold">{busqueda ? `No encontramos «${busqueda}»` : 'La carta aún no tiene platos'}</p>
            {busqueda && (
              <button type="button" onClick={() => setBusqueda('')} className="mt-3 text-[14px] font-bold text-orange-700 underline underline-offset-4">
                Ver toda la carta
              </button>
            )}
          </div>
        )}

        {/* Un riel por categoría */}
        {!cargando &&
          categorias.map(([cat, items]) => (
            <section key={cat} id={idCategoria(cat)} data-categoria={cat} className="scroll-mt-[150px] pt-8">
              <div className="flex items-baseline justify-between px-4">
                <h2 className="text-[20px] font-extrabold tracking-[-0.02em]">{cat}</h2>
                <span className="tabular text-[13px] font-semibold text-gray-500">{items.length} platos</span>
              </div>
              <div className="qp-rail mt-3 flex gap-4 overflow-x-auto px-4 pb-2 lg:grid lg:grid-cols-3 lg:overflow-visible xl:grid-cols-4">
                {items.map((p) => (
                  <TarjetaPlato
                    key={p.id}
                    platillo={p}
                    cantidad={cantidadRapida(p.id)}
                    onAbrir={() => setPlatoAbierto(p)}
                    onSumar={() => agregar(p)}
                    onRestar={() => cambiarCantidad(p.id, '', -1)}
                  />
                ))}
              </div>
            </section>
          ))}
      </main>

      {/* Barra flotante del pedido */}
      <AnimatePresence>
        {totalUnidades > 0 && !carritoAbierto && (
          <motion.div
            initial={{ y: 120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 120, opacity: 0 }}
            transition={{ duration: 0.5, ease }}
            className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          >
            <button
              type="button"
              onClick={() => setCarritoAbierto(true)}
              className="mx-auto flex h-16 w-full max-w-lg items-center gap-3 rounded-[22px] bg-espresso pl-3 pr-5 text-white shadow-lift transition-transform active:scale-[0.99]"
            >
              <span className="tabular grid h-10 min-w-[2.5rem] place-items-center rounded-2xl bg-orange-500 px-2 text-[15px] font-extrabold text-espresso">
                {totalUnidades}
              </span>
              <span className="text-[15px] font-bold">Ver pedido</span>
              <span className="tabular ml-auto text-[16px] font-extrabold">
                $<CountUp key={total} from={totalAnterior.current} to={total} duration={0.6} separator="." trigger="load" />
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <HojaPlato
        platillo={platoAbierto}
        onCerrar={() => setPlatoAbierto(null)}
        onAgregar={(p, cantidad, nota) => {
          agregar(p, cantidad, nota);
          setPlatoAbierto(null);
        }}
      />

      {/* Carrito */}
      <HojaInferior
        abierta={carritoAbierto}
        onCerrar={cerrarCarrito}
        titulo="Tu pedido"
        pie={
          envio.estado === 'enviado' ? (
            <button type="button" onClick={cerrarCarrito} className="h-14 w-full rounded-full bg-espresso text-[15px] font-bold text-white">
              Pedir algo más
            </button>
          ) : carrito.length > 0 ? (
            <div>
              <div className="mb-3 flex items-baseline justify-between">
                <span className="text-[15px] font-semibold text-gray-600">Total · impuestos incluidos</span>
                <span className="tabular text-[22px] font-extrabold">{formatear(total)}</span>
              </div>
              <button
                type="button"
                onClick={enviar}
                disabled={!mesaId || envio.estado === 'enviando'}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-espresso text-[15px] font-bold text-white transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600"
              >
                {envio.estado === 'enviando' ? (
                  <>
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
                    Enviando a cocina…
                  </>
                ) : mesaId ? (
                  'Enviar pedido a cocina'
                ) : (
                  'Disponible desde el QR de la mesa'
                )}
              </button>
            </div>
          ) : null
        }
      >
        {envio.estado === 'enviado' ? (
          <div className="px-6 py-12 text-center">
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease }}
              className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-green-600 text-white"
            >
              <Check size={40} strokeWidth={3} />
            </motion.div>
            <h2 className="mt-6 text-2xl font-extrabold tracking-[-0.02em]">¡Pedido enviado!</h2>
            <p className="mx-auto mt-2 max-w-xs text-[15px] leading-relaxed text-gray-600">
              La cocina ya recibió tu pedido de la mesa {numeroMesa}: {envio.resumen?.unidades} platos por {formatear(envio.resumen?.total ?? 0)}.
            </p>
          </div>
        ) : (
          <div className="px-5 pb-4 pt-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-extrabold tracking-[-0.02em]">Tu pedido</h2>
              <button type="button" onClick={cerrarCarrito} className="grid h-10 w-10 place-items-center rounded-full bg-gray-100" aria-label="Cerrar">
                <X size={20} />
              </button>
            </div>
            {mesaId && <p className="mt-1 text-[14px] font-medium text-gray-500">Mesa {numeroMesa}</p>}

            {envio.estado === 'error' && (
              <p role="alert" className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-[14px] font-medium text-red-800">
                {envio.error} Revisa tu pedido e intenta de nuevo.
              </p>
            )}

            {carrito.length === 0 ? (
              <div className="py-14 text-center">
                <ShoppingBag className="mx-auto text-gray-300" size={40} strokeWidth={1.5} />
                <p className="mt-4 text-[16px] font-bold">Aún no has agregado platos</p>
                <p className="mt-1 text-[14px] text-gray-500">Toca + en cualquier plato para empezar.</p>
              </div>
            ) : (
              <ul className="mt-4 divide-y divide-gray-200">
                <AnimatePresence initial={false}>
                  {carrito.map((item) => (
                    <motion.li
                      key={`${item.id}-${item.nota}`}
                      layout
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3, ease }}
                      className="overflow-hidden"
                    >
                      <div className="flex gap-3 py-4">
                        <FotoPlato platillo={item} className="h-16 w-16 shrink-0 rounded-2xl" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[15px] font-bold leading-snug">{item.nombre}</p>
                          {item.nota && <p className="mt-0.5 text-[13px] text-gray-500">{item.nota}</p>}
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <div className="flex h-9 items-center rounded-full border border-gray-200">
                              <button type="button" className="grid h-9 w-9 place-items-center" onClick={() => cambiarCantidad(item.id, item.nota, -1)} aria-label={`Quitar un ${item.nombre}`}>
                                <Minus size={16} strokeWidth={2.5} />
                              </button>
                              <span className="tabular w-6 text-center text-[14px] font-extrabold">{item.cantidad}</span>
                              <button type="button" className="grid h-9 w-9 place-items-center" onClick={() => cambiarCantidad(item.id, item.nota, 1)} aria-label={`Agregar un ${item.nombre}`}>
                                <Plus size={16} strokeWidth={2.5} />
                              </button>
                            </div>
                            <span className="tabular text-[15px] font-extrabold">{formatear(item.precio * item.cantidad)}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => cambiarCantidad(item.id, item.nota, -item.cantidad)}
                          className="ml-2 grid h-9 w-9 shrink-0 place-items-center self-start rounded-full text-gray-400 transition-colors hover:bg-red-50 hover:text-red-700"
                          aria-label={`Eliminar ${item.nombre} del pedido`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </div>
        )}
      </HojaInferior>
    </div>
  );
}
