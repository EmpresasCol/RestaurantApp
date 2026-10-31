// Reglas y textos de los módulos del administrador: platillos, usuarios y QR de mesas (sin React, para poder probarlos).

const normalizar = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

export const coincide = (texto, busqueda) => normalizar(texto).includes(normalizar(busqueda));

// ==================== PLATILLOS ====================

export const CATEGORIAS_BASE = ['Entradas', 'Platos Principales', 'Ensaladas', 'Sopas', 'Postres', 'Bebidas'];

/** Categorías en uso más las de base, sin repetir (ignora mayúsculas y tildes) y en orden alfabético. */
export const categoriasDisponibles = (platillos = []) => {
  const vistas = new Map();
  [...platillos.map((p) => p.categoria), ...CATEGORIAS_BASE].forEach((c) => {
    const limpio = String(c ?? '').trim();
    if (limpio && !vistas.has(normalizar(limpio))) vistas.set(normalizar(limpio), limpio);
  });
  return [...vistas.values()].sort((a, b) => a.localeCompare(b, 'es'));
};

/** Mismas reglas que la API (PlatillosController): devuelve el primer error o null. */
export const validarPlatillo = (form, platillos = [], idActual = null) => {
  const nombre = String(form.nombre ?? '').trim();
  if (!nombre) return 'Escribe el nombre del platillo';
  if (nombre.length > 100) return 'El nombre admite máximo 100 caracteres';
  if (String(form.categoria ?? '').trim().length > 50) return 'La categoría admite máximo 50 caracteres';
  if (!(Number(form.precio) > 0)) return 'El precio debe ser mayor que cero';
  if (platillos.some((p) => p.id !== idActual && normalizar(p.nombre) === normalizar(nombre))) {
    return `Ya existe un platillo llamado "${nombre}"`;
  }
  return null;
};

/**
 * Cómo está el platillo frente al inventario, con el tono del chip.
 * porcionesDisponibles null = la API no lo controla (no tiene receta).
 */
export const estadoPlatillo = (platillo) => {
  const n = platillo?.porcionesDisponibles;
  if (platillo?.disponible === false || n === 0) return { clave: 'agotado', tono: 'peligro', texto: 'Agotado' };
  if (n == null) return { clave: 'sin-receta', tono: 'aviso', texto: 'Sin receta' };
  if (n <= 5) return { clave: 'pocas', tono: 'aviso', texto: `Quedan ${n}` };
  return { clave: 'disponible', tono: 'ok', texto: `${n} porciones` };
};

// ==================== USUARIOS ====================

// Lo que hace cada rol y por dónde entra (la API bloquea al Mesero en la web y solo deja Mesero en la app).
export const ROLES = [
  { id: 'Administrador', descripcion: 'Gestiona la carta, el inventario, los usuarios y los reportes.', acceso: 'Web' },
  { id: 'Caja', descripcion: 'Cobra pedidos y domicilios, y emite facturas.', acceso: 'Web' },
  { id: 'Cocina', descripcion: 'Ve las comandas y las marca como listas.', acceso: 'Web' },
  { id: 'Mesero', descripcion: 'Toma pedidos en las mesas.', acceso: 'App móvil' },
  { id: 'Domiciliario', descripcion: 'Recibe y entrega los domicilios.', acceso: 'App móvil' },
];

export const iniciales = (nombre) =>
  String(nombre ?? '').trim().split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase() || '?';

/** Mismas reglas que la API (UsuariosController). La clave es obligatoria solo al crear. */
export const validarUsuario = (form, { edicion = false } = {}) => {
  const usuario = String(form.nombreUsuario ?? '').trim();
  if (!String(form.nombre ?? '').trim()) return 'Escribe el nombre de la persona';
  if (usuario.length < 3) return 'El usuario debe tener al menos 3 caracteres';
  if (/\s/.test(usuario)) return 'El usuario no puede tener espacios';
  if (!ROLES.some((r) => r.id === form.rol)) return 'Elige un rol';
  if (!edicion || form.clave) {
    if (String(form.clave ?? '').length < 4) return 'La clave debe tener al menos 4 caracteres';
    if (form.clave !== form.confirmarClave) return 'Las claves no coinciden';
  }
  return null;
};

// ==================== MESAS Y QR ====================

export const MAXIMO_MESAS = 200; // igual que MesasController.MaximoMesas

/** El QR lleva el Id de la mesa (lo que espera POST /pedidos) y su número visible. */
export const urlMesa = (base, mesa) => `${base}?mesa=${mesa.id}&numero=${mesa.numero}`;

/** Lleva un número escrito a mano al rango permitido; lo que no es número cuenta como 1. */
export const limitarMesas = (valor) => {
  const n = Math.round(Number(valor));
  return Number.isFinite(n) ? Math.min(MAXIMO_MESAS, Math.max(1, n)) : 1;
};

/** Lo que pasará al guardar: cuántas mesas se crean y qué números se retiran. */
export const cambioMesas = (numeros, cantidad) => ({
  crear: Array.from({ length: cantidad }, (_, i) => i + 1).filter((n) => !numeros.includes(n)).length,
  retirar: numeros.filter((n) => n > cantidad).sort((a, b) => a - b),
});

/**
 * Insignia con el número de mesa para el centro del QR (va como imagen dentro del código).
 * El QR usa corrección H (30 %), así que el hueco del centro no impide leerlo.
 */
export const insigniaMesa = (numero, { fondo = '#2A1D15', texto = '#FFFFFF' } = {}) => {
  const tamano = String(numero).length >= 3 ? 34 : 44;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
    `<rect width="100" height="100" rx="24" fill="${fondo}"/>` +
    `<text x="50" y="50" dy="0.35em" text-anchor="middle" font-family="Manrope,Segoe UI,Arial,sans-serif" font-weight="800" font-size="${tamano}" fill="${texto}">${Number(numero)}</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};
