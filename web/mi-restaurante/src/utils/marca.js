// Marca del restaurante (Configuración del administrador): valores de fábrica, paleta derivada del
// color elegido y su aplicación a la página. Reglas puras con prueba en __tests__/marca.test.js.

export const COLOR_MARCA = '#C8955E';
export const COLOR_ACCION = '#2A1D15';
/** El color de las acciones lleva texto blanco encima (botones): contraste AA mínimo. */
export const CONTRASTE_MINIMO = 4.5;

/** Lo mismo que GET api/configuracion responde sin nada guardado: el sistema se ve como siempre. */
export const CONFIG_FABRICA = Object.freeze({
  nombre: 'Qpro',
  eslogan: null,
  logo: null,
  colorMarca: COLOR_MARCA,
  colorAccion: COLOR_ACCION,
  mensajeBienvenida: null,
  horario: null,
  whatsapp: null,
  instagram: null,
  pedidosQR: true,
  pieFactura: null,
  logoEnFactura: false,
  propinaSugerida: 10,
  costoEnvio: 3000,
  minutosAlerta: 10,
  minutosUrgente: 15,
  fechaActualizacion: null,
});

/** Combinaciones probadas (contraste AA del color de acciones con blanco). */
export const PALETAS = [
  { id: 'caramelo', nombre: 'Caramelo', marca: COLOR_MARCA, accion: COLOR_ACCION },
  { id: 'oliva', nombre: 'Oliva', marca: '#8A9A3B', accion: '#2E3A1F' },
  { id: 'vino', nombre: 'Vino', marca: '#C0596B', accion: '#4A1624' },
  { id: 'mar', nombre: 'Mar', marca: '#2F8F9D', accion: '#123B47' },
  { id: 'terracota', nombre: 'Terracota', marca: '#D2693C', accion: '#3D1E12' },
  { id: 'carbon', nombre: 'Carbón', marca: '#E0A526', accion: '#1F2328' },
];

export const TONOS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

// Peso de blanco (aclarar) o de negro (oscurecer) que lleva cada tono respecto al 500.
const MEZCLA = { 50: 0.94, 100: 0.86, 200: 0.7, 300: 0.48, 400: 0.24, 500: 0, 600: -0.16, 700: -0.33, 800: -0.48, 900: -0.61, 950: -0.76 };

// Escala de fábrica afinada a mano (tailwind.config.js de antes): el caramelo se ve idéntico.
const ESCALA_CARAMELO = {
  50: '#FBF6F0', 100: '#F5E9DA', 200: '#EBD3B6', 300: '#DFB98D', 400: '#D3A372',
  500: '#C8955E', 600: '#A97644', 700: '#865B35', 800: '#654430', 900: '#4A3224', 950: '#2A1D15',
};

export const esHex = (v) => /^#[0-9a-f]{6}$/i.test(String(v ?? ''));

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const hexDe = (canales) => `#${canales.map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0')).join('')}`.toUpperCase();

/** Luminancia relativa y contraste de WCAG 2 (de 1 a 21), igual que la API. */
const luminancia = (hex) => {
  const [r, g, b] = rgb(hex).map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contraste = (a, b) => {
  const [x, y] = [luminancia(a), luminancia(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

export const accionLegible = (hex) => esHex(hex) && contraste(hex, '#FFFFFF') >= CONTRASTE_MINIMO;

/** Escala 50–950 a partir del color de marca (el 500 es el color elegido). */
export const escala = (hex) => {
  if (!esHex(hex)) return { ...ESCALA_CARAMELO };
  if (hex.toUpperCase() === COLOR_MARCA) return { ...ESCALA_CARAMELO };
  const base = rgb(hex);
  return Object.fromEntries(TONOS.map((t) => {
    const p = MEZCLA[t];
    const destino = p >= 0 ? 255 : 0;
    return [t, hexDe(base.map((c) => c + (destino - c) * Math.abs(p)))];
  }));
};

/** Une lo que respondió la API con los valores de fábrica (campos nuevos o nulos). */
export const normalizar = (config) => {
  const c = { ...CONFIG_FABRICA };
  Object.entries(config ?? {}).forEach(([k, v]) => {
    if (k in c && v !== undefined && v !== null && v !== '') c[k] = v;
  });
  if (!esHex(c.colorMarca)) c.colorMarca = COLOR_MARCA;
  if (!accionLegible(c.colorAccion)) c.colorAccion = COLOR_ACCION;
  return c;
};

/** Variables CSS que leen tailwind.config.js e index.css ("r g b" para admitir opacidad). */
export const variablesCss = (config) => {
  const c = normalizar(config);
  const canales = (hex) => rgb(hex).join(' ');
  const tonos = escala(c.colorMarca);
  return {
    ...Object.fromEntries(TONOS.map((t) => [`--qp-marca-${t}`, canales(tonos[t])])),
    '--qp-accion': canales(c.colorAccion),
  };
};

// Copia de la marca vigente para el código que no es React (tirillas de impresión, utilidades).
let actual = CONFIG_FABRICA;
export const marcaActual = () => actual;

/** Pinta la página con la marca: colores, título de la pestaña, ícono y color del navegador. */
export const aplicarMarca = (config, doc = typeof document === 'undefined' ? null : document) => {
  actual = normalizar(config);
  if (!doc) return actual;
  const raiz = doc.documentElement;
  Object.entries(variablesCss(actual)).forEach(([k, v]) => raiz.style.setProperty(k, v));
  doc.title = actual.nombre;
  doc.querySelector('meta[name="theme-color"]')?.setAttribute('content', actual.colorAccion);
  const icono = doc.querySelector('link[rel="icon"]');
  if (icono) {
    if (!icono.dataset.original) icono.dataset.original = icono.getAttribute('href') ?? '';
    icono.setAttribute('href', actual.logo || icono.dataset.original);
  }
  return actual;
};

/** Tasa de propina sugerida (0.1 = 10 %). */
export const tasaPropina = (config = actual) => Math.max(0, Number(config?.propinaSugerida ?? 10)) / 100;

/** Enlace de WhatsApp con el número guardado (solo dígitos, con indicativo). Colombia por defecto. */
export const enlaceWhatsapp = (numero) => {
  const d = String(numero ?? '').replace(/\D/g, '');
  if (!d) return null;
  return `https://wa.me/${d.length === 10 ? `57${d}` : d}`;
};

export const enlaceInstagram = (usuario) => {
  const u = String(usuario ?? '').replace(/^@/, '').trim();
  return u ? `https://instagram.com/${encodeURIComponent(u)}` : null;
};

/** Lo que el formulario manda a la API: textos recortados y números como números. */
export const paraGuardar = (form) => ({
  ...form,
  nombre: String(form.nombre ?? '').trim(),
  propinaSugerida: Math.round(Number(form.propinaSugerida) || 0),
  costoEnvio: Math.max(0, Number(form.costoEnvio) || 0),
  minutosAlerta: Math.round(Number(form.minutosAlerta) || 0),
  minutosUrgente: Math.round(Number(form.minutosUrgente) || 0),
});

/** Errores que la API también rechaza, para avisarlos antes de enviar. */
export const errorConfiguracion = (c) => {
  if (!String(c.nombre ?? '').trim()) return 'Escribe el nombre del restaurante';
  if (!esHex(c.colorMarca) || !esHex(c.colorAccion)) return 'Los colores van en formato #RRGGBB';
  if (!accionLegible(c.colorAccion)) return 'El color de las acciones es muy claro: el texto blanco de los botones no se leería';
  const propina = Number(c.propinaSugerida);
  if (!(propina >= 0 && propina <= 30)) return 'La propina sugerida va de 0 % a 30 %';
  const envio = Number(c.costoEnvio);
  if (!(envio >= 0 && envio <= 1000000)) return 'El costo del envío va de $0 a $1.000.000';
  const [a, u] = [Number(c.minutosAlerta), Number(c.minutosUrgente)];
  if (!(a >= 1 && a <= 180 && u >= 1 && u <= 240)) return 'Los tiempos de cocina van de 1 a 240 minutos';
  if (u <= a) return 'El tiempo de "urgente" debe ser mayor que el de "demorado"';
  const wa = String(c.whatsapp ?? '').replace(/\D/g, '');
  if (wa && (wa.length < 7 || wa.length > 15)) return 'El WhatsApp lleva entre 7 y 15 números';
  return null;
};
