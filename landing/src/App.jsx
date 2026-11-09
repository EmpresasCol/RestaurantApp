import React, {useRef, useState, useEffect} from 'react';
import {motion, AnimatePresence, useScroll, useTransform, useSpring, useReducedMotion, useInView, useMotionValueEvent} from 'motion/react';
import {
  ArrowUpRight, ArrowDown, ArrowRight, Check, CheckCircle, Plus, Minus, QrCode, CookingPot, Receipt, Moped,
  Package, ChartBar, WhatsappLogo, EnvelopeSimple, InstagramLogo, MapPin, DeviceMobile, Monitor, DeviceTablet,
  Storefront, Clock, ChefHat, Bell, WarningCircle, Hamburger, Pizza, BowlFood, OrangeSlice, ForkKnife, UserCircle,
  ArrowCounterClockwise, PaperPlaneTilt, Calendar, CallBell
} from './icons';

import SITE from '../site.config.json';
import IMAGENES from './images.json';

/* Los datos de contacto se editan en site.config.json */
const CONTACTO = SITE.contacto;

const ease = [0.22, 1, 0.36, 1];
const pesos = n => '$ ' + n.toLocaleString('es-CO');
const waLink = text => `https://wa.me/${CONTACTO.whatsapp}?text=${encodeURIComponent(text)}`;
const DEMO_TEXT = 'Hola, quiero agendar una demo de Qpro para mi restaurante.';

function Reveal({children, className = '', delay = 0, as = 'div'}) {
  const reduced = useReducedMotion();
  const Tag = motion[as];
  return (
    <Tag className={className} initial={reduced ? {opacity: 0} : {opacity: 0, y: 32}} whileInView={{opacity: 1, y: 0}}
      viewport={{once: true, amount: 0.2}} transition={{duration: 0.7, ease, delay}}>
      {children}
    </Tag>
  );
}

/* Imágenes en WebP con varios anchos; build.cjs las genera desde public/assets/*.png|jpg según images.json */
function Pic({name, alt = '', sizes, priority = false, className, width, height}) {
  const img = IMAGENES[name];
  const src = w => `assets/${name}-${w}.webp`;
  return (
    <img className={className} src={src(img.widths[img.widths.length - 1])} alt={alt}
      srcSet={img.widths.length > 1 ? img.widths.map(w => `${src(w)} ${w}w`).join(', ') : undefined} sizes={img.widths.length > 1 ? sizes : undefined}
      width={width || img.w} height={height || img.h} loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : undefined} decoding="async" />
  );
}

function Logo() {
  return (
    <a className="logo" href="#inicio" aria-label="Qpro, volver al inicio">
      <Pic name="logo" width={36} height={36} priority />
      <span>Qpro</span>
    </a>
  );
}

function DemoButton({children = 'Agenda una demo gratis', small = false, light = false}) {
  return (
    <a className={`btn ${small ? 'btn-small' : ''} ${light ? 'btn-light' : ''}`} href="#contacto">
      <span>{children}</span>
      <span className="btn-icon" aria-hidden="true"><ArrowUpRight size={small ? 14 : 18} weight="bold" /></span>
    </a>
  );
}

/* ---------- Navegación ---------- */
const NAV = [['Pruébalo', 'demo'], ['Módulos', 'modulos'], ['Planes', 'planes'], ['Preguntas', 'preguntas']];

function Header() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState('');
  const reduced = useReducedMotion();
  useEffect(() => {
    const onKey = e => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    const io = new IntersectionObserver(entries => entries.forEach(e => e.isIntersecting && setActive(e.target.id)), {rootMargin: '-45% 0px -50% 0px'});
    [...NAV.map(n => n[1]), 'contacto'].forEach(id => {const el = document.getElementById(id); el && io.observe(el);});
    return () => {window.removeEventListener('keydown', onKey); io.disconnect();};
  }, []);
  useEffect(() => {document.body.style.overflow = open ? 'hidden' : '';}, [open]);
  return (
    <header className="nav-shell">
      <div className="nav">
        <Logo />
        <nav aria-label="Principal" className="nav-links">
          {NAV.map(([label, id]) => (
            <a key={id} href={'#' + id} aria-current={active === id ? 'true' : undefined}>
              {active === id && <motion.span layoutId="nav-pill" className="nav-pill" transition={{duration: 0.5, ease}} />}
              <span>{label}</span>
            </a>
          ))}
        </nav>
        <DemoButton small>Agenda una demo</DemoButton>
        <button className={`menu-toggle ${open ? 'is-open' : ''}`} aria-label={open ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen(!open)}>
          <span /><span />
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.nav id="mobile-nav" className="mobile-nav" aria-label="Navegación móvil" initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} transition={{duration: 0.3, ease}}>
            {[...NAV, ['Contacto', 'contacto']].map(([label, id], i) => (
              <motion.a key={id} href={'#' + id} onClick={() => setOpen(false)} initial={reduced ? {opacity: 0} : {opacity: 0, y: 24}} animate={{opacity: 1, y: 0}} transition={{duration: 0.5, ease, delay: Math.min(i * 0.06, 0.4)}}>
                {label}<ArrowRight size={24} />
              </motion.a>
            ))}
            <motion.div className="mobile-nav-cta" initial={{opacity: 0}} animate={{opacity: 1}} transition={{delay: 0.35}}>
              <a className="btn" href="#contacto" onClick={() => setOpen(false)}><span>Agenda una demo gratis</span><span className="btn-icon"><ArrowUpRight size={18} weight="bold" /></span></a>
            </motion.div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

/* ---------- Hero ---------- */
const HERO_ORDERS = [
  {where: 'Mesa 3', items: '2 Hamburguesa Clásica · 2 Limonada', total: 64000, Icon: ForkKnife},
  {where: 'Domicilio #203', items: '1 Pizza Margarita · 1 Brownie con Helado', total: 51000, Icon: Moped},
  {where: 'Mesa 7', items: '1 Pasta Carbonara · 1 Sopa de Tomate', total: 42000, Icon: ForkKnife},
  {where: 'Mesa 2', items: '2 Salmón a la Parrilla', total: 96000, Icon: ForkKnife}
];

function OrderStack() {
  const ref = useRef(null);
  const inView = useInView(ref);
  const reduced = useReducedMotion();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView || reduced) return;
    const id = setInterval(() => setN(v => v + 1), 3400);
    return () => clearInterval(id);
  }, [inView, reduced]);
  const len = HERO_ORDERS.length;
  const visible = [0, 1, 2].map(i => ({...HERO_ORDERS[((n - i) % len + len) % len], key: n - i}));
  return (
    <div className="order-stack" ref={ref} aria-hidden="true">
      <AnimatePresence initial={false} mode="popLayout">
        {visible.map((o, i) => (
          <motion.div layout key={o.key} className={`order-card ${i === 0 ? 'is-new' : ''}`}
            initial={{opacity: 0, y: -32, scale: 0.92}} animate={{opacity: 1 - i * 0.3, y: 0, scale: 1 - i * 0.05}}
            exit={{opacity: 0, scale: 0.85, transition: {duration: 0.3}}} transition={{duration: 0.6, ease}}>
            <span className="order-icon"><o.Icon size={18} weight="bold" /></span>
            <div>
              <strong>{o.where}{i === 0 && <em>Nuevo</em>}</strong>
              <small>{o.items}</small>
            </div>
            <b>{pesos(o.total)}</b>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function SpinBadge() {
  return (
    <div className="spin-badge" aria-hidden="true">
      <svg viewBox="0 0 120 120">
        <defs><path id="circle" d="M60,60 m-46,0 a46,46 0 1,1 92,0 a46,46 0 1,1 -92,0" /></defs>
        <text><textPath href="#circle">ESCANEA · PIDE · DISFRUTA · ESCANEA · PIDE · DISFRUTA ·</textPath></text>
      </svg>
      <span><QrCode size={34} weight="bold" /></span>
    </div>
  );
}

function Hero() {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const {scrollYProgress} = useScroll({target: ref, offset: ['start start', 'end start']});
  const phoneY = useTransform(scrollYProgress, [0, 1], [0, reduced ? 0 : 120]);
  const blobY = useTransform(scrollYProgress, [0, 1], [0, reduced ? 0 : -80]);
  const lines = ['Tus mesas piden con un QR.', 'Tu cocina lo ve al instante.'];
  return (
    <section id="inicio" className="hero" ref={ref}>
      <div className="hero-copy">
        <h1 aria-label={lines.join(' ')}>
          {lines.map((line, i) => (
            <span className="line-mask" key={line} aria-hidden="true">
              <span className="hero-line" style={{animationDelay: `${150 + i * 120}ms`}}>{line}</span>
            </span>
          ))}
        </h1>
        {/* Entrada con CSS: se ve con el HTML prerenderizado, sin esperar al JavaScript */}
        <div className="hero-rest">
          <p className="hero-sub">Qpro conecta la carta, la cocina, la caja, los domicilios y el inventario de tu restaurante en un solo sistema. Menos carreras con papelitos, más tiempo para atender.</p>
          <div className="hero-actions">
            <DemoButton />
            <a className="text-link" href="#demo">Pruébalo aquí mismo <ArrowDown size={16} weight="bold" /></a>
          </div>
          <ul className="hero-proof">
            <li><Check size={16} weight="bold" />Tus clientes no instalan nada</li>
            <li><Check size={16} weight="bold" />Celular, tablet o computador</li>
            <li><Check size={16} weight="bold" />Pedidos en tiempo real</li>
          </ul>
        </div>
      </div>
      <div className="hero-visual">
        <motion.svg className="hero-blob" style={{y: blobY}} viewBox="0 0 600 600" aria-hidden="true">
          <path d="M421 64c74 38 140 112 146 196 6 86-48 182-128 236-80 54-186 66-268 26C89 482 31 392 33 302 35 212 97 122 177 76c80-46 170-50 244-12z" />
        </motion.svg>
        <motion.div className="hero-phone-wrap" style={{y: phoneY}}>
          <div className="phone hero-phone"><Pic name="carrito" priority sizes="(min-width: 1024px) 296px, (min-width: 640px) 272px, 200px" alt="Pedido de la mesa 3 en el menú QR de Qpro: hamburguesa clásica y limonada natural, total $ 32.000" /></div>
        </motion.div>
        <OrderStack />
        <SpinBadge />
      </div>
    </section>
  );
}

/* ---------- Franja de tipos de negocio ---------- */
const NEGOCIOS = ['Restaurantes de menú del día', 'Pizzerías', 'Asaderos', 'Cafeterías', 'Comidas rápidas', 'Heladerías', 'Gastrobares', 'Restaurantes con domicilio'];
function Marquee() {
  const row = NEGOCIOS.map(t => <span key={t}>{t}<ForkKnife size={20} aria-hidden="true" /></span>);
  return (
    <section className="marquee" aria-label="Pensado para restaurantes de todo tipo">
      <div className="marquee-track" aria-hidden="true">{row}{row}</div>
      <p className="sr-only">Pensado para {NEGOCIOS.join(', ')}.</p>
    </section>
  );
}

/* ---------- Antes y después ---------- */
const CAMBIOS = [
  {Icon: CookingPot, sin: 'La comanda en papel llega tarde o nadie entiende la letra.', con: 'El pedido aparece en la pantalla de cocina en cuanto la mesa lo envía.'},
  {Icon: Receipt, sin: 'La mesa pide la cuenta tres veces y alguien suma a mano.', con: 'Caja ve cada mesa con sus pedidos juntos y divide la cuenta si lo piden.'},
  {Icon: Package, sin: 'Vendes un plato y después descubres que no había ingredientes.', con: 'Las recetas descuentan el inventario y el plato agotado se marca en la carta.'},
  {Icon: Moped, sin: 'Nadie sabe si el domicilio ya salió o sigue en cocina.', con: 'Cada domicilio muestra su etapa: en cocina, listo, en camino o entregado.'},
  {Icon: ChartBar, sin: 'El cierre del día no cuadra y toca revisar libreta por libreta.', con: 'Reportes y cierre de caja salen de lo que realmente se cobró.'}
];

function BeforeAfter() {
  const [con, setCon] = useState(false);
  const reduced = useReducedMotion();
  return (
    <section className={`before-after ${con ? 'is-con' : ''}`} aria-labelledby="ba-title">
      <motion.div className="ba-wash" animate={{opacity: con ? 1 : 0}} transition={{duration: 0.6, ease}} aria-hidden="true" />
      <div className="ba-inner">
        <div className="ba-head">
          <h2 id="ba-title">Un sábado a las 8 de la noche, <span>{con ? 'con Qpro.' : 'sin Qpro.'}</span></h2>
          <div className="switch" role="radiogroup" aria-label="Comparar el servicio">
            {[[false, 'Sin Qpro'], [true, 'Con Qpro']].map(([v, label]) => (
              <button key={label} role="radio" aria-checked={con === v} onClick={() => setCon(v)}>
                {con === v && <motion.span layoutId="switch-pill" className="switch-pill" transition={{duration: 0.5, ease}} />}
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
        <ul className="ba-list">
          {CAMBIOS.map(({Icon, sin, con: c}, i) => (
            <li key={i}>
              <span className="ba-icon">{con ? <CheckCircle size={24} weight="fill" /> : <WarningCircle size={24} />}</span>
              <AnimatePresence mode="wait" initial={false}>
                <motion.p key={con ? 'c' : 's'} initial={{opacity: 0, y: reduced ? 0 : 12}} animate={{opacity: 1, y: 0}} exit={{opacity: 0, y: reduced ? 0 : -12}} transition={{duration: 0.35, ease, delay: i * 0.04}}>
                  {con ? c : sin}
                </motion.p>
              </AnimatePresence>
              <Icon className="ba-module" size={22} aria-hidden="true" />
            </li>
          ))}
        </ul>
        {!con && <button className="text-link ba-cta" onClick={() => setCon(true)}>Ahora míralo con Qpro <ArrowRight size={16} weight="bold" /></button>}
        {con && <a className="text-link ba-cta" href="#demo">Pruébalo tú mismo <ArrowDown size={16} weight="bold" /></a>}
      </div>
    </section>
  );
}

/* ---------- Demo interactiva ---------- */
const PLATOS = [
  {id: 'h', name: 'Hamburguesa Clásica', price: 25000, Icon: Hamburger, uses: {pan: 1, carne: 1}},
  {id: 'p', name: 'Pizza Margarita', price: 35000, Icon: Pizza, uses: {masa: 1, queso: 1}},
  {id: 'c', name: 'Pasta Carbonara', price: 28000, Icon: BowlFood, uses: {pasta: 1, tocino: 1}},
  {id: 'l', name: 'Limonada Natural', price: 7000, Icon: OrangeSlice, uses: {limon: 2}}
];
const INSUMOS = {pan: 'Pan brioche', carne: 'Carne de res', masa: 'Masa de pizza', queso: 'Mozzarella', pasta: 'Pasta fresca', tocino: 'Tocino', limon: 'Limones'};
const STOCK0 = {pan: 24, carne: 22, masa: 11, queso: 13, pasta: 17, tocino: 15, limon: 58};
const ETAPAS = [['pidiendo', 'Pedir'], ['nuevo', 'Cocinar'], ['listo', 'Cobrar'], ['cobrado', 'Listo']];

function Demo() {
  const [cart, setCart] = useState({h: 1, l: 1});
  const [stage, setStage] = useState('pidiendo');
  const [order, setOrder] = useState(null);
  const [stock, setStock] = useState(STOCK0);
  const [seconds, setSeconds] = useState(0);
  const reduced = useReducedMotion();
  const kitchenRef = useRef(null), cashRef = useRef(null);
  // En móvil los paneles van apilados: lleva la vista al panel que acaba de cambiar
  const focusPanel = ref => {
    const el = ref.current;
    if (!el || window.innerWidth >= 768) return;
    const r = el.getBoundingClientRect();
    if (r.top < 80 || r.bottom > window.innerHeight - 96) setTimeout(() => el.scrollIntoView({behavior: reduced ? 'auto' : 'smooth', block: 'center'}), 120);
  };

  useEffect(() => {
    if (!order || stage === 'cobrado') return;
    const id = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [order, stage]);

  const items = PLATOS.filter(p => cart[p.id] > 0);
  const total = items.reduce((s, p) => s + p.price * cart[p.id], 0);
  const qty = (id, d) => setCart(c => ({...c, [id]: Math.max(0, Math.min(9, (c[id] || 0) + d))}));
  const send = () => {
    if (!items.length) return;
    const lines = items.map(p => ({...p, qty: cart[p.id]}));
    setOrder({lines, total});
    setStock(s => {
      const next = {...s};
      lines.forEach(l => Object.entries(l.uses).forEach(([k, v]) => {next[k] = Math.max(0, next[k] - v * l.qty);}));
      return next;
    });
    setSeconds(0);
    setStage('nuevo');
    focusPanel(kitchenRef);
  };
  const reset = () => {setCart({h: 1, l: 1}); setOrder(null); setStage('pidiendo'); setSeconds(0);};
  const usados = order ? [...new Set(order.lines.flatMap(l => Object.keys(l.uses)))] : ['pan', 'carne', 'limon'];
  const stepIndex = {pidiendo: 0, nuevo: 1, preparando: 1, listo: 2, cobrado: 3}[stage];
  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const pop = reduced ? {initial: {opacity: 0}, animate: {opacity: 1}} : {initial: {opacity: 0, y: 24, scale: 0.96}, animate: {opacity: 1, y: 0, scale: 1}};

  return (
    <section className="demo" id="demo" aria-labelledby="demo-title">
      <div className="demo-head">
        <Reveal><h2 id="demo-title">Haz un pedido.<br /><span>Mira cómo viaja.</span></h2></Reveal>
        <Reveal delay={0.1}><p>Pide como si estuvieras en la mesa 4. El pedido pasa a cocina, llega a caja y descuenta el inventario, como en el servicio real.</p></Reveal>
      </div>
      <ol className="demo-steps" aria-label="Etapas del pedido">
        {ETAPAS.map(([key, label], i) => (
          <li key={key} className={i <= stepIndex ? 'done' : ''} aria-current={i === stepIndex ? 'step' : undefined}>
            {i === stepIndex && <motion.span layoutId="step-pill" className="step-pill" transition={{duration: 0.5, ease}} />}
            <span>{label}</span>
          </li>
        ))}
      </ol>

      <div className="demo-grid">
        {/* Celular del comensal */}
        <div className="panel panel-phone">
          <div className="panel-label"><DeviceMobile size={18} />Celular del comensal</div>
          <div className="mini-phone">
            <div className="mini-top"><Pic name="logo" width={32} height={32} /><div><strong>Qpro</strong><small>Mesa 4 · pide desde aquí</small></div></div>
            <ul className="dish-list">
              {PLATOS.map(p => (
                <li key={p.id}>
                  <span className="dish-icon"><p.Icon size={24} weight="duotone" /></span>
                  <div><strong>{p.name}</strong><small>{pesos(p.price)}</small></div>
                  <div className="stepper">
                    <button aria-label={`Quitar ${p.name}`} onClick={() => qty(p.id, -1)} disabled={stage !== 'pidiendo' || !cart[p.id]}><Minus size={14} weight="bold" /></button>
                    <span aria-live="polite">{cart[p.id] || 0}</span>
                    <button aria-label={`Agregar ${p.name}`} onClick={() => qty(p.id, 1)} disabled={stage !== 'pidiendo'}><Plus size={14} weight="bold" /></button>
                  </div>
                </li>
              ))}
            </ul>
            {stage === 'pidiendo' ? (
              <button className="send-btn" onClick={send} disabled={!items.length}>
                <span>{items.length ? 'Enviar a cocina' : 'Agrega un plato'}</span><b>{pesos(total)}</b>
              </button>
            ) : (
              <motion.div className="sent-note" {...pop} transition={{duration: 0.5, ease}}>
                <CheckCircle size={20} weight="fill" /><span>Pedido enviado. Te avisamos cuando esté listo.</span>
              </motion.div>
            )}
          </div>
        </div>

        {/* Cocina */}
        <div className="panel panel-kitchen" ref={kitchenRef}>
          <div className="panel-label"><DeviceTablet size={18} />Pantalla de cocina</div>
          <AnimatePresence mode="wait">
            {!order ? (
              <motion.div key="empty" className="kds-empty" initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}}>
                <ChefHat size={40} weight="duotone" />
                <p>Sin pedidos por ahora.<br />Envía uno desde el celular.</p>
              </motion.div>
            ) : (
              <motion.div key="ticket" className={`kds-ticket ${stage === 'nuevo' ? 'is-new' : ''}`} {...pop} transition={{duration: 0.6, ease}}>
                <div className="kds-top">
                  <div><strong>Mesa 4</strong><small>Orden #105</small></div>
                  <span className="kds-time"><Clock size={16} weight="bold" />{time}</span>
                </div>
                <ul>
                  {order.lines.map(l => <li key={l.id}><b>{l.qty}</b>{l.name}</li>)}
                </ul>
                {stage === 'nuevo' && <button className="kds-btn" onClick={() => setStage('preparando')}><CookingPot size={18} />Empezar a preparar</button>}
                {stage === 'preparando' && <button className="kds-btn ok" onClick={() => {setStage('listo'); focusPanel(cashRef);}}><Check size={18} weight="bold" />Marcar listo</button>}
                {(stage === 'listo' || stage === 'cobrado') && <p className="kds-done"><Bell size={18} weight="fill" />Listo. El mesero ya fue avisado.</p>}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Caja + inventario */}
        <div className="panel-col">
          <div className="panel panel-cash" ref={cashRef}>
            <div className="panel-label"><Monitor size={18} />Caja</div>
            {!order ? <p className="muted">La cuenta de la mesa aparece aquí sola.</p> : (
              <motion.div {...pop} transition={{duration: 0.5, ease, delay: 0.15}}>
                <div className="cash-row"><strong>Mesa 4</strong><b>{pesos(order.total)}</b></div>
                <small className="muted">{order.lines.map(l => `${l.qty} × ${l.name}`).join(' · ')}</small>
                {stage === 'cobrado' ? (
                  <p className="cash-paid"><CheckCircle size={18} weight="fill" />Cobrado en efectivo · Factura #0412</p>
                ) : (
                  <button className="cash-btn" disabled={stage !== 'listo'} onClick={() => setStage('cobrado')}>
                    {stage === 'listo' ? `Cobrar ${pesos(order.total)}` : 'Esperando a cocina'}
                  </button>
                )}
              </motion.div>
            )}
          </div>
          <div className="panel panel-stock">
            <div className="panel-label"><Package size={18} />Inventario</div>
            <ul>
              {usados.map(k => (
                <li key={k}>
                  <span>{INSUMOS[k]}</span>
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.b key={stock[k]} initial={{opacity: 0, y: reduced ? 0 : -16}} animate={{opacity: 1, y: 0}} exit={{opacity: 0, y: reduced ? 0 : 16}} transition={{duration: 0.4, ease}} className={stock[k] !== STOCK0[k] ? 'changed' : ''}>
                      {stock[k]}
                    </motion.b>
                  </AnimatePresence>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <div className="demo-foot">
        <p>Simulación dentro de esta página. No se envía ningún pedido a un restaurante.</p>
        {stage !== 'pidiendo' && <button className="text-link light" onClick={reset}><ArrowCounterClockwise size={16} weight="bold" />Hacer otro pedido</button>}
        {stage === 'cobrado' && <DemoButton light>Quiero esto en mi restaurante</DemoButton>}
      </div>
    </section>
  );
}

/* ---------- Frase que se enciende palabra por palabra ---------- */
function Word({children, progress, start, end}) {
  const opacity = useTransform(progress, [start, end], [0.28, 1]);
  return <motion.span style={{opacity}}>{children} </motion.span>;
}
function Tagline() {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const {scrollYProgress} = useScroll({target: ref, offset: ['start 0.85', 'end 0.45']});
  const lines = [['Lo', 'que', 'se', 'pide,', 'se', 'cocina,'], ['se', 'cobra', 'y', 'se', 'descuenta.'], ['Sin', 'anotarlo', 'dos', 'veces.']];
  const total = lines.flat().length;
  let k = 0;
  return (
    <section className="tagline" ref={ref} aria-label="Lo que se pide, se cocina, se cobra y se descuenta. Sin anotarlo dos veces.">
      <p aria-hidden="true">
        {lines.map((line, li) => (
          <span className="tag-line" key={li}>
            {line.map(w => {
              const i = k++;
              return reduced ? <span key={i}>{w} </span> : <Word key={i} progress={scrollYProgress} start={i / total} end={(i + 1.5) / total}>{w}</Word>;
            })}
          </span>
        ))}
      </p>
    </section>
  );
}

/* ---------- Módulos ---------- */
const MODULOS = [
  {name: 'Carta QR', Icon: QrCode, img: 'pedido', phone: true, title: 'La carta en el celular de cada mesa.', text: 'El cliente escanea el código, ve fotos y precios, elige cantidades y envía el pedido. Sin descargar nada ni crear cuentas.', points: ['Fotos, categorías y buscador', 'Platos agotados marcados solos', 'Un código QR por mesa']},
  {name: 'Cocina', Icon: CookingPot, img: 'cocina', title: 'Comandas claras, de lejos.', text: 'Pedidos de mesa y domicilio en una sola pantalla. Cada orden muestra su tiempo y avisa cuando se está demorando.', points: ['Tiempo por orden', 'Empezar y marcar listo con un toque', 'Avisa al mesero cuando está listo']},
  {name: 'Caja', Icon: Receipt, img: 'cobro', title: 'La cuenta lista antes de que la pidan.', text: 'Cada mesa agrupa sus pedidos. Cobra toda la cuenta o divídela, suma propina y registra cómo pagó el cliente.', points: ['Efectivo, tarjeta o transferencia', 'Cuenta dividida y propina', 'Facturas y cierre del día']},
  {name: 'Domicilios', Icon: Moped, img: 'domicilios', title: 'Del fogón a la puerta del cliente.', text: 'Registra el domicilio, asígnalo a un domiciliario y sigue cada etapa. El domiciliario usa la app para llamar, ver el mapa y cobrar.', points: ['Etapas visibles para todos', 'App para domiciliarios', 'Efectivo por entregar en caja']},
  {name: 'Inventario', Icon: Package, img: 'inventario', title: 'Lo que vendes se descuenta solo.', text: 'Cada plato tiene su receta. Al venderlo, Qpro descuenta los ingredientes y te avisa qué se está acabando o vence pronto.', points: ['Recetas por plato', 'Compras, proveedores y lotes', 'Alertas de stock bajo y vencimientos']},
  {name: 'Reportes', Icon: ChartBar, img: 'reportes', title: 'Sabes cuánto vendiste, sin hacer cuentas.', text: 'Ventas por día, horas pico, ticket promedio y propinas, separados entre mesa y domicilio. Exporta los datos en CSV para abrirlos en Excel.', points: ['Ventas de mesa y domicilio', 'Horas pico', 'Exportación en CSV']}
];

function Shot({m}) {
  return m.phone ? (
    <div className="phone shot-phone"><Pic name={m.img} sizes="(min-width: 1024px) 260px, 200px" alt={`Pantalla de ${m.name} en Qpro con datos de demostración`} /></div>
  ) : (
    <div className="browser">
      <div className="browser-bar"><i /><i /><i /><span>qpro · {m.name.toLowerCase()}</span></div>
      <Pic name={m.img} sizes="(min-width: 1024px) 640px, 120vw" alt={`Pantalla de ${m.name} en Qpro con datos de demostración`} />
    </div>
  );
}

function Modules() {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const {scrollYProgress} = useScroll({target: ref, offset: ['start start', 'end end']});
  const [index, setIndex] = useState(0);
  useMotionValueEvent(scrollYProgress, 'change', v => setIndex(Math.min(MODULOS.length - 1, Math.floor(v * MODULOS.length))));
  const bar = useSpring(scrollYProgress, {stiffness: 120, damping: 30});
  const m = MODULOS[index];
  return (
    <section id="modulos" className="modules" aria-labelledby="mod-title">
      <div className="modules-intro">
        <Reveal><h2 id="mod-title">Todo el restaurante,<br /><span>conectado.</span></h2></Reveal>
        <Reveal delay={0.1}><p>Seis módulos que comparten la misma información. Lo que pasa en una pantalla se ve en las demás al momento.</p></Reveal>
      </div>
      <div className="modules-track" ref={ref} style={{'--count': MODULOS.length}}>
        <div className="modules-sticky">
          <ul className="mod-tabs">
            {MODULOS.map((x, i) => (
              <li key={x.name} className={i === index ? 'active' : ''}>
                <x.Icon size={20} weight={i === index ? 'fill' : 'regular'} /><span>{x.name}</span>
              </li>
            ))}
          </ul>
          <div className="mod-body">
            <AnimatePresence mode="wait">
              <motion.div key={m.name} className="mod-text" initial={{opacity: 0, y: reduced ? 0 : 24}} animate={{opacity: 1, y: 0}} exit={{opacity: 0, y: reduced ? 0 : -16}} transition={{duration: 0.45, ease}}>
                <h3>{m.title}</h3>
                <p>{m.text}</p>
                <ul>{m.points.map(p => <li key={p}><Check size={16} weight="bold" />{p}</li>)}</ul>
              </motion.div>
            </AnimatePresence>
            <div className="mod-shot">
              <AnimatePresence mode="wait">
                <motion.div key={m.img} initial={{opacity: 0, scale: reduced ? 1 : 0.96, y: reduced ? 0 : 24}} animate={{opacity: 1, scale: 1, y: 0}} exit={{opacity: 0, scale: reduced ? 1 : 0.98}} transition={{duration: 0.5, ease}}>
                  <Shot m={m} />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
          <div className="mod-progress"><motion.div style={{scaleX: bar}} /></div>
        </div>
      </div>
      <MobileModules />
    </section>
  );
}

/* Pantallas pequeñas: carrusel deslizable en lugar del panel fijo */
function MobileModules() {
  const track = useRef(null);
  const [index, setIndex] = useState(0);
  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    const card = el.firstElementChild.offsetWidth + 12;
    setIndex(Math.min(MODULOS.length - 1, Math.round(el.scrollLeft / card)));
  };
  const go = i => {
    const el = track.current;
    el.scrollTo({left: i * (el.firstElementChild.offsetWidth + 12), behavior: 'smooth'});
  };
  return (
    <div className="modules-stack">
      <div className="mod-track" ref={track} onScroll={onScroll} role="region" aria-label="Módulos de Qpro, desliza para ver más" tabIndex={0}>
        {MODULOS.map(x => (
          <article className="mod-card" key={x.name}>
            <span className="mod-chip"><x.Icon size={18} weight="fill" />{x.name}</span>
            <h3>{x.title}</h3>
            <p>{x.text}</p>
            <ul>{x.points.map(p => <li key={p}><Check size={16} weight="bold" />{p}</li>)}</ul>
            <Shot m={x} />
          </article>
        ))}
      </div>
      <div className="mod-dots">
        {MODULOS.map((x, i) => (
          <button key={x.name} aria-label={`Ver ${x.name}`} aria-current={i === index ? 'true' : undefined} onClick={() => go(i)}><span /></button>
        ))}
        <span className="mod-count" aria-live="polite">{MODULOS[index].name} · {index + 1} de {MODULOS.length}</span>
      </div>
    </div>
  );
}

/* ---------- Quién usa qué ---------- */
const ROLES = [
  {Icon: UserCircle, who: 'Comensal', does: 'Escanea el QR, pide y sigue su pedido.', device: 'Su celular, sin instalar nada', DevIcon: DeviceMobile},
  {Icon: CallBell, who: 'Mesero', does: 'Toma pedidos en mesa y sabe qué ya está listo para servir.', device: 'App móvil', DevIcon: DeviceMobile},
  {Icon: ChefHat, who: 'Cocina', does: 'Ve las comandas por orden de llegada y las marca listas.', device: 'Tablet o monitor', DevIcon: DeviceTablet},
  {Icon: Receipt, who: 'Caja', does: 'Cobra mesas y domicilios, factura y cierra el día.', device: 'Computador', DevIcon: Monitor},
  {Icon: Moped, who: 'Domiciliario', does: 'Recoge, llama al cliente, entrega y cobra.', device: 'App móvil', DevIcon: DeviceMobile},
  {Icon: Storefront, who: 'Administrador', does: 'Maneja la carta, usuarios, inventario, códigos QR y reportes.', device: 'Computador', DevIcon: Monitor}
];
function Roles() {
  return (
    <section className="roles" aria-labelledby="roles-title">
      <Reveal className="roles-head">
        <h2 id="roles-title">Cada persona,<br />con su pantalla.</h2>
        <p>Cada rol entra con su usuario y ve solo lo que necesita para trabajar.</p>
      </Reveal>
      <ul className="roles-list">
        {ROLES.map(({Icon, who, does, device, DevIcon}, i) => (
          <Reveal as="li" key={who} delay={i * 0.05}>
            <span className="role-icon"><Icon size={28} weight="duotone" /></span>
            <strong>{who}</strong>
            <p>{does}</p>
            <span className="role-device"><DevIcon size={16} />{device}</span>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}

/* ---------- Cómo empezar ---------- */
const PASOS = [
  {Icon: Calendar, title: 'Agenda la demo', text: 'Te mostramos Qpro funcionando y resolvemos tus dudas. Es gratis y sin compromiso.'},
  {Icon: ForkKnife, title: 'Configuramos tu restaurante', text: 'Cargamos contigo la carta, las mesas y los usuarios de tu equipo.'},
  {Icon: QrCode, title: 'Pega los QR y abre', text: 'Imprime un código para cada mesa y empieza a recibir pedidos.'}
];
function Steps() {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const {scrollYProgress} = useScroll({target: ref, offset: ['start 0.8', 'end 0.6']});
  const x = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);
  const line = useTransform(scrollYProgress, [0, 1], [0, 1]);
  return (
    <section className="steps" aria-labelledby="steps-title" ref={ref}>
      <Reveal><h2 id="steps-title">Empezar toma <span>tres pasos.</span></h2></Reveal>
      <div className="steps-rail" aria-hidden="true">
        <motion.div className="rail-fill" style={{scaleX: reduced ? 1 : line}} />
        <motion.div className="rail-rider" style={{left: reduced ? '100%' : x}}><Moped size={22} weight="fill" /></motion.div>
      </div>
      <ol className="steps-list">
        {PASOS.map(({Icon, title, text}, i) => (
          <Reveal as="li" key={title} delay={i * 0.1}>
            <span className="step-num">{i + 1}</span>
            <Icon size={28} weight="duotone" className="step-icon" aria-hidden="true" />
            <h3>{title}</h3>
            <p>{text}</p>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}

/* ---------- Planes ---------- */
const PLANES = [
  {name: 'Qpro Salón', for: 'Para restaurantes que atienden en mesa.', items: ['Carta QR por mesa', 'Pantalla de cocina', 'Caja, facturas y cierre del día', 'App móvil para meseros', 'Generador de códigos QR'], cta: 'Cotizar Qpro Salón'},
  {name: 'Qpro Completo', for: 'Para restaurantes con domicilios y bodega.', items: ['Todo lo de Qpro Salón', 'Domicilios con app para domiciliarios', 'Inventario por recetas', 'Compras, proveedores y lotes', 'Reportes de ventas'], cta: 'Cotizar Qpro Completo', featured: true}
];
function Plans() {
  return (
    <section className="plans" id="planes" aria-labelledby="plans-title">
      <Reveal className="plans-head">
        <h2 id="plans-title">Un plan a la medida <br />de tu restaurante.</h2>
        <p>El precio depende de tus mesas, tus puntos de venta y si manejas domicilios. Cuéntanos cómo trabajas y te enviamos una cotización.</p>
      </Reveal>
      <div className="plans-grid">
        {PLANES.map((p, i) => (
          <Reveal key={p.name} delay={i * 0.1} className={`plan ${p.featured ? 'featured' : ''}`}>
            {p.featured && <span className="plan-tag">El más completo</span>}
            <h3>{p.name}</h3>
            <p>{p.for}</p>
            <ul>{p.items.map(t => <li key={t}><Check size={18} weight="bold" />{t}</li>)}</ul>
            <div className="plan-price"><strong>Precio según tu restaurante</strong><small>Demo gratis y sin compromiso</small></div>
            <a className={`btn ${p.featured ? 'btn-light' : ''}`} href={waLink(`Hola, quiero cotizar ${p.name} para mi restaurante.`)} target="_blank" rel="noreferrer">
              <span>{p.cta}</span><span className="btn-icon" aria-hidden="true"><ArrowUpRight size={18} weight="bold" /></span>
            </a>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ---------- Preguntas ---------- */
const FAQS = [
  ['¿Mis clientes tienen que descargar una aplicación?', 'No. El cliente escanea el código QR de su mesa y la carta se abre en el navegador del celular. No necesita crear cuenta.'],
  ['¿Tengo que comprar equipos nuevos?', 'No necesariamente. Cocina, caja y administración funcionan en el navegador de cualquier tablet, monitor o computador. Meseros y domiciliarios usan la app en su celular.'],
  ['¿Qué pasa si un cliente no quiere usar el QR?', 'El mesero toma el pedido desde la app y llega a cocina igual que uno hecho desde el QR. Las dos formas conviven en el mismo servicio.'],
  ['¿Puedo cambiar precios o quitar platos cuando quiera?', 'Sí. El administrador edita la carta en cualquier momento. Las cuentas abiertas conservan el precio con el que se pidió cada plato.'],
  ['¿Cómo sabe Qpro cuándo se acaba un ingrediente?', 'Cada plato tiene una receta con sus ingredientes. Al venderlo se descuentan del inventario, y si falta algo el plato se marca como agotado en la carta.'],
  ['¿Sirve si también hago domicilios?', 'Sí. Registras el domicilio, cocina lo prepara junto a los pedidos de mesa y el domiciliario lo entrega y cobra desde su app.'],
  ['¿Cuánto cuesta?', 'Depende del tamaño de tu restaurante y de los módulos que uses. Agenda la demo y te enviamos una cotización sin compromiso.'],
  ['¿Me ayudan a configurarlo?', 'Sí. Cargamos contigo la carta, las mesas y los usuarios para que empieces con todo listo.']
];
function FAQ() {
  const [open, setOpen] = useState(0);
  return (
    <section className="faq" id="preguntas" aria-labelledby="faq-title">
      <Reveal className="faq-head">
        <h2 id="faq-title">Lo que nos preguntan <br />antes de empezar.</h2>
        <p>¿Tienes otra duda? <a href={waLink('Hola, tengo una pregunta sobre Qpro.')} target="_blank" rel="noreferrer">Escríbenos por WhatsApp</a>.</p>
      </Reveal>
      <div className="faq-list">
        {FAQS.map(([q, a], i) => (
          <div className={`faq-item ${open === i ? 'open' : ''}`} key={q}>
            <h3>
              <button aria-expanded={open === i} aria-controls={'faq-' + i} id={'faq-q-' + i} onClick={() => setOpen(open === i ? null : i)}>
                <span>{q}</span><span className="faq-sign" aria-hidden="true"><Plus size={18} weight="bold" /></span>
              </button>
            </h3>
            <AnimatePresence initial={false}>
              {open === i && (
                <motion.div id={'faq-' + i} role="region" aria-labelledby={'faq-q-' + i} className="faq-answer" initial={{opacity: 0, height: 0}} animate={{opacity: 1, height: 'auto'}} exit={{opacity: 0, height: 0}} transition={{duration: 0.4, ease}}>
                  <p>{a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify({'@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQS.map(([q, a]) => ({'@type': 'Question', name: q, acceptedAnswer: {'@type': 'Answer', text: a}}))})}} />
    </section>
  );
}

/* ---------- Contacto ---------- */
const INTERESES = ['Carta QR', 'Cocina', 'Caja', 'Domicilios', 'Inventario', 'Reportes'];
function Contact() {
  const [form, setForm] = useState({nombre: '', restaurante: '', ciudad: '', telefono: '', mesas: '', mensaje: ''});
  const [intereses, setIntereses] = useState(['Carta QR', 'Cocina']);
  const [acepto, setAcepto] = useState(false);
  const [errors, setErrors] = useState({});
  const [sent, setSent] = useState(false);
  const set = k => e => {setForm(f => ({...f, [k]: e.target.value})); errors[k] && setErrors(er => ({...er, [k]: undefined}));};
  const toggle = t => setIntereses(l => l.includes(t) ? l.filter(x => x !== t) : [...l, t]);
  const validate = () => {
    const e = {};
    if (!form.nombre.trim()) e.nombre = 'Escribe tu nombre.';
    if (!form.restaurante.trim()) e.restaurante = 'Escribe el nombre de tu restaurante.';
    const digits = form.telefono.replace(/\D/g, '');
    if (!digits) e.telefono = 'Escribe un número de WhatsApp para responderte.';
    else if (digits.length < 10 || digits.length > 12) e.telefono = 'El número debe tener 10 dígitos, por ejemplo 300 123 4567.';
    if (!acepto) e.acepto = 'Necesitamos tu autorización para usar estos datos y responderte.';
    return e;
  };
  const message = () => [
    'Hola, quiero agendar una demo de Qpro.',
    `Nombre: ${form.nombre.trim()}`,
    `Restaurante: ${form.restaurante.trim()}`,
    form.ciudad.trim() && `Ciudad: ${form.ciudad.trim()}`,
    `WhatsApp: ${form.telefono.trim()}`,
    form.mesas && `Mesas: ${form.mesas}`,
    intereses.length && `Me interesa: ${intereses.join(', ')}`,
    form.mensaje.trim() && `Mensaje: ${form.mensaje.trim()}`
  ].filter(Boolean).join('\n');
  const submit = ev => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {document.getElementById('f-' + Object.keys(e)[0])?.focus(); return;}
    window.open(waLink(message()), '_blank', 'noopener');
    setSent(true);
  };
  const field = (k, label, props = {}) => (
    <div className={`field ${errors[k] ? 'has-error' : ''}`}>
      <label htmlFor={'f-' + k}>{label}{props.required && <span aria-hidden="true"> *</span>}</label>
      <input id={'f-' + k} value={form[k]} onChange={set(k)} aria-invalid={!!errors[k]} aria-describedby={errors[k] ? 'e-' + k : undefined} {...props} />
      {errors[k] && <p className="field-error" id={'e-' + k}><WarningCircle size={16} weight="fill" />{errors[k]}</p>}
    </div>
  );
  return (
    <section className="contact" id="contacto" aria-labelledby="contact-title">
      <div className="contact-info">
        <Reveal>
          <h2 id="contact-title">Hablemos de tu restaurante.</h2>
          <p>Déjanos tus datos y te escribimos para agendar la demo. Es gratis y no te compromete a nada.</p>
        </Reveal>
        <ul className="channels">
          <li><a href={waLink(DEMO_TEXT)} target="_blank" rel="noreferrer"><span className="ch-icon wa"><WhatsappLogo size={24} weight="fill" /></span><span><small>WhatsApp</small><strong>{CONTACTO.whatsappVisible}</strong></span><ArrowUpRight size={18} /></a></li>
          {CONTACTO.correo && <li><a href={`mailto:${CONTACTO.correo}?subject=${encodeURIComponent('Demo de Qpro')}`}><span className="ch-icon"><EnvelopeSimple size={24} weight="fill" /></span><span><small>Correo</small><strong>{CONTACTO.correo}</strong></span><ArrowUpRight size={18} /></a></li>}
          {CONTACTO.instagram && <li><a href={`https://instagram.com/${CONTACTO.instagram}`} target="_blank" rel="noreferrer"><span className="ch-icon"><InstagramLogo size={24} weight="fill" /></span><span><small>Instagram</small><strong>@{CONTACTO.instagram}</strong></span><ArrowUpRight size={18} /></a></li>}
          <li><div><span className="ch-icon"><MapPin size={24} weight="fill" /></span><span><small>Estamos en</small><strong>{CONTACTO.ciudad}</strong></span></div></li>
        </ul>
      </div>
      <div className="contact-card">
        <AnimatePresence mode="wait">
          {sent ? (
            <motion.div key="ok" className="form-ok" initial={{opacity: 0, y: 16}} animate={{opacity: 1, y: 0}} transition={{duration: 0.5, ease}} role="status">
              <span className="ok-icon"><PaperPlaneTilt size={32} weight="fill" /></span>
              <h3>Abrimos WhatsApp con tu mensaje.</h3>
              <p>Solo tienes que tocar enviar. Si la ventana no se abrió, escríbenos al <a href={waLink(message())} target="_blank" rel="noreferrer">{CONTACTO.whatsappVisible}</a>{CONTACTO.correo && <> o al correo <a href={`mailto:${CONTACTO.correo}?subject=${encodeURIComponent('Demo de Qpro')}&body=${encodeURIComponent(message())}`}>{CONTACTO.correo}</a></>}.</p>
              <button className="text-link" onClick={() => setSent(false)}><ArrowCounterClockwise size={16} weight="bold" />Editar mis datos</button>
            </motion.div>
          ) : (
            <motion.form key="form" onSubmit={submit} noValidate initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}}>
              <div className="form-row">
                {field('nombre', 'Tu nombre', {required: true, autoComplete: 'name', placeholder: 'Laura Martínez'})}
                {field('restaurante', 'Restaurante', {required: true, autoComplete: 'organization', placeholder: 'Asadero La Ceiba'})}
              </div>
              <div className="form-row">
                {field('telefono', 'WhatsApp', {required: true, type: 'tel', inputMode: 'tel', autoComplete: 'tel', placeholder: '300 123 4567'})}
                {field('ciudad', 'Ciudad', {autoComplete: 'address-level2', placeholder: 'Sincelejo'})}
              </div>
              <div className="field">
                <label htmlFor="f-mesas">¿Cuántas mesas tienes?</label>
                <select id="f-mesas" value={form.mesas} onChange={set('mesas')}>
                  <option value="">Elige una opción</option>
                  <option>Menos de 10</option><option>Entre 10 y 25</option><option>Más de 25</option><option>Solo domicilios</option>
                </select>
              </div>
              <fieldset className="chips">
                <legend>¿Qué te interesa?</legend>
                {INTERESES.map(t => (
                  <label key={t} className={intereses.includes(t) ? 'on' : ''}>
                    <input type="checkbox" checked={intereses.includes(t)} onChange={() => toggle(t)} />
                    {intereses.includes(t) ? <Check size={14} weight="bold" /> : <Plus size={14} weight="bold" />}{t}
                  </label>
                ))}
              </fieldset>
              <div className="field">
                <label htmlFor="f-mensaje">Cuéntanos algo más <span className="opt">(opcional)</span></label>
                <textarea id="f-mensaje" rows="3" value={form.mensaje} onChange={set('mensaje')} placeholder="Abrimos de jueves a domingo y hacemos domicilios por WhatsApp." />
              </div>
              <div className={`consent ${errors.acepto ? 'has-error' : ''}`}>
                <label>
                  <input id="f-acepto" type="checkbox" checked={acepto} onChange={e => {setAcepto(e.target.checked); setErrors(er => ({...er, acepto: undefined}));}} aria-invalid={!!errors.acepto} aria-describedby={errors.acepto ? 'e-acepto' : undefined} />
                  <span className="consent-box" aria-hidden="true"><Check size={14} weight="bold" /></span>
                  <span>Autorizo a Qpro a usar estos datos para responderme, según la <a href="privacidad.html" target="_blank" rel="noopener">política de tratamiento de datos</a>.</span>
                </label>
                {errors.acepto && <p className="field-error" id="e-acepto"><WarningCircle size={16} weight="fill" />{errors.acepto}</p>}
              </div>
              <button type="submit" className="btn btn-wide"><span>Enviar por WhatsApp</span><span className="btn-icon" aria-hidden="true"><WhatsappLogo size={18} weight="fill" /></span></button>
              <p className="form-note">El mensaje se abre en tu WhatsApp. Esta página no guarda tus datos.</p>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

/* ---------- Cierre ---------- */
function FinalCTA() {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const {scrollYProgress} = useScroll({target: ref, offset: ['start end', 'end start']});
  const x = useTransform(scrollYProgress, [0, 1], reduced ? ['0%', '0%'] : ['8%', '-12%']);
  return (
    <section className="final" ref={ref} aria-labelledby="final-title">
      <motion.span className="final-word" style={{x}} aria-hidden="true">Qpro</motion.span>
      <Reveal className="final-inner">
        <h2 id="final-title">Que el próximo pedido <br />llegue solo a la cocina.</h2>
        <div className="final-actions">
          <DemoButton light />
          <a className="text-link light" href={waLink(DEMO_TEXT)} target="_blank" rel="noreferrer"><WhatsappLogo size={18} weight="fill" />Escríbenos ahora</a>
        </div>
      </Reveal>
    </section>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-top">
        <div className="footer-brand">
          <Logo />
          <p>La carta, la cocina, la caja, los domicilios y el inventario de tu restaurante en un solo sistema.</p>
        </div>
        <nav aria-label="Pie de página" className="footer-nav">
          {[...NAV, ['Contacto', 'contacto']].map(([l, id]) => <a key={id} href={'#' + id}>{l}</a>)}
        </nav>
        <div className="footer-contact">
          <a href={waLink(DEMO_TEXT)} target="_blank" rel="noreferrer"><WhatsappLogo size={18} />{CONTACTO.whatsappVisible}</a>
          {CONTACTO.correo && <a href={`mailto:${CONTACTO.correo}`}><EnvelopeSimple size={18} />{CONTACTO.correo}</a>}
          {CONTACTO.instagram && <a href={`https://instagram.com/${CONTACTO.instagram}`} target="_blank" rel="noreferrer"><InstagramLogo size={18} />@{CONTACTO.instagram}</a>}
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 Qpro · {CONTACTO.ciudad}, Colombia</span>
        <nav aria-label="Legal" className="footer-legal">
          <a href="privacidad.html">Política de datos</a>
          <a href="terminos.html">Términos de uso</a>
          <a href={SITE.appUrl}>Acceso del personal</a>
        </nav>
        <a href="#inicio">Volver arriba <ArrowUpRight size={14} /></a>
      </div>
      <p className="footer-note">Las pantallas de esta página usan datos de demostración. Este sitio no usa cookies ni herramientas de seguimiento.</p>
    </footer>
  );
}

function MobileBar() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    // Aparece cuando el botón principal del inicio sale de pantalla y se oculta desde el formulario de contacto
    const vis = {cta: true, contacto: false};
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.target.id === 'contacto') vis.contacto = e.isIntersecting || e.boundingClientRect.top < 0;
        else vis.cta = e.isIntersecting || e.boundingClientRect.top > 0;
      });
      setShow(!vis.cta && !vis.contacto);
    });
    [document.querySelector('.hero-actions'), document.getElementById('contacto')].forEach(el => el && io.observe(el));
    return () => io.disconnect();
  }, []);
  return (
    <AnimatePresence>
      {show && (
        <motion.div className="mobile-bar" initial={{y: 96}} animate={{y: 0}} exit={{y: 96}} transition={{duration: 0.5, ease}}>
          <a className="btn" href="#contacto"><span>Agenda una demo gratis</span></a>
          <a className="mobile-wa" href={waLink(DEMO_TEXT)} target="_blank" rel="noreferrer" aria-label="Escribir por WhatsApp"><WhatsappLogo size={24} weight="fill" /></a>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function App() {
  const {scrollYProgress} = useScroll();
  const scaleX = useSpring(scrollYProgress, {stiffness: 120, damping: 30});
  return (
    <>
      <a className="skip-link" href="#contenido">Saltar al contenido</a>
      <motion.div className="reading-progress" style={{scaleX}} aria-hidden="true" />
      <Header />
      <main id="contenido">
        <Hero />
        <Marquee />
        <BeforeAfter />
        <Demo />
        <Tagline />
        <Modules />
        <Roles />
        <Steps />
        <Plans />
        <FAQ />
        <Contact />
        <FinalCTA />
      </main>
      <Footer />
      <MobileBar />
    </>
  );
}

export default App;
