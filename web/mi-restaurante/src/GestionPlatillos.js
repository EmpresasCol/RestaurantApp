// Platillos: la carta que ve el comensal. Cada platillo muestra si el inventario alcanza para
// venderlo y cuánto cuesta prepararlo; su ficha permite editarlo y armar su receta ahí mismo.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ImagePlus, Plus, Search, Trash2, UtensilsCrossed } from 'lucide-react';
import * as api from './services/api';
import { compras, getRecetas } from './services/inventarioApi';
import { EditorReceta, tonoCosto } from './components/inventario/RecetasConfig';
import { Boton, BotonConfirmar, Campo, Cargando, Chip, Panel, useAviso, Vacio } from './components/inventario/ui';
import { categoriasDisponibles, coincide, estadoPlatillo, validarPlatillo } from './utils/administracion';
import { etiquetaImpuesto, impuestoIncluido } from './utils/impuestos';
import { formatearCOP } from './utils/inventario';

const FORM_VACIO = { nombre: '', descripcion: '', precio: '', categoria: 'Platos Principales', imagenUrl: '' };

const FILTROS = [
  { id: 'todos', label: 'Todos' },
  { id: 'agotado', label: 'Agotados' },
  { id: 'sin-receta', label: 'Sin receta' },
];

/** Reduce la foto a 1000 px como máximo antes de guardarla en Base64: la carta carga más rápido. */
const reducirImagen = (archivo, maximo = 1000) =>
  new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onerror = reject;
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => resolve(lector.result);
      img.onload = () => {
        const escala = Math.min(1, maximo / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * escala);
        canvas.height = Math.round(img.height * escala);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff'; // una PNG transparente no queda con fondo negro en JPEG
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = lector.result;
    };
    lector.readAsDataURL(archivo);
  });

function Foto({ src, alt, className = '' }) {
  const [fallo, setFallo] = useState(false);
  useEffect(() => setFallo(false), [src]);
  if (!src || fallo) {
    return (
      <div className={`grid place-items-center bg-orange-50 ${className}`}>
        <UtensilsCrossed className="text-orange-300" size={32} strokeWidth={1.5} aria-hidden="true" />
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" onError={() => setFallo(true)} className={`object-cover ${className}`} />;
}

function TarjetaPlatillo({ platillo, costo, onAbrir }) {
  const estado = estadoPlatillo(platillo);
  const porcentaje = costo != null && platillo.precio > 0 ? Math.round((costo / platillo.precio) * 100) : null;
  return (
    <li>
      <button type="button" onClick={onAbrir} className="group block w-full text-left" aria-label={`Editar ${platillo.nombre}`}>
        <div className="relative overflow-hidden rounded-[20px] bg-gray-100 shadow-card transition-shadow duration-300 group-hover:shadow-lift">
          <Foto src={platillo.imagenUrl} alt="" className="aspect-[4/3] w-full transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]" />
          <span className="absolute left-2.5 top-2.5"><Chip tono={estado.tono} className="shadow-card">{estado.texto}</Chip></span>
        </div>
        <div className="px-1 pt-2.5">
          <p className="truncate text-[16px] font-bold text-espresso">{platillo.nombre}</p>
          <p className="truncate text-[13px] text-gray-500">{platillo.categoria}</p>
          <p className="mt-1 flex items-center justify-between gap-2">
            <span className="tabular text-[15px] font-extrabold text-espresso">{formatearCOP(platillo.precio)}</span>
            {porcentaje != null && <Chip tono={tonoCosto(porcentaje)}>Costo {porcentaje} %</Chip>}
          </p>
        </div>
      </button>
    </li>
  );
}

function FichaPlatillo({ platillo, platillos, recetas, insumos, mostrar, onGuardado, onRecetaCambio }) {
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setForm(platillo
      ? { nombre: platillo.nombre, descripcion: platillo.descripcion ?? '', precio: String(platillo.precio), categoria: platillo.categoria ?? '', imagenUrl: platillo.imagenUrl ?? '' }
      : FORM_VACIO);
  }, [platillo]);

  const cambiar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));
  const precio = Number(form.precio) || 0;

  const elegirFoto = async (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    if (!archivo.type.startsWith('image/')) return mostrar('Elige un archivo de imagen (JPG, PNG o WEBP)', 'error');
    if (archivo.size > 8 * 1024 * 1024) return mostrar('La foto no debe pasar de 8 MB', 'error');
    try {
      const imagenUrl = await reducirImagen(archivo);
      setForm((f) => ({ ...f, imagenUrl }));
    } catch {
      mostrar('No se pudo leer la foto', 'error');
    }
  };

  const guardar = async (e) => {
    e.preventDefault();
    const error = validarPlatillo(form, platillos, platillo?.id ?? null);
    if (error) return mostrar(error, 'error');

    const datos = {
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim(),
      precio,
      categoria: form.categoria.trim() || 'General',
      imagenUrl: form.imagenUrl.trim(),
    };
    setGuardando(true);
    try {
      if (platillo) {
        await api.updatePlatillo(platillo.id, datos);
        mostrar('Platillo actualizado');
        onGuardado(platillo.id);
      } else {
        const creado = await api.createPlatillo(datos);
        mostrar('Platillo creado. Ahora arma su receta');
        onGuardado(creado.id);
      }
    } catch (err) {
      mostrar(err.message, 'error');
    } finally {
      setGuardando(false);
    }
  };

  const actuarReceta = async (promesa, ok) => {
    try {
      await promesa;
      if (ok) mostrar(ok);
      await onRecetaCambio();
    } catch (err) {
      mostrar(err?.response?.data?.message ?? 'No se pudo guardar la receta', 'error');
    }
  };

  return (
    <div className="space-y-6 p-5">
      <form id="form-platillo" onSubmit={guardar} className="space-y-4" noValidate>
        <div className="flex items-start gap-4">
          <Foto src={form.imagenUrl} alt={form.nombre ? `Foto de ${form.nombre}` : 'Sin foto'} className="aspect-[4/3] w-36 shrink-0 rounded-[16px] bg-gray-100 sm:w-44" />
          <div className="min-w-0 flex-1 space-y-2">
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 text-[14px] font-bold text-espresso transition-colors hover:border-gray-400 hover:bg-gray-50 focus-within:ring-4 focus-within:ring-orange-100">
              <ImagePlus size={17} aria-hidden="true" />
              {form.imagenUrl ? 'Cambiar foto' : 'Subir foto'}
              <input type="file" accept="image/*" onChange={elegirFoto} className="sr-only" />
            </label>
            {form.imagenUrl && (
              <Boton variante="fantasma" tamano="sm" onClick={() => setForm((f) => ({ ...f, imagenUrl: '' }))}>Quitar foto</Boton>
            )}
            <p className="text-[12px] text-gray-500">Sin foto, la carta muestra el ícono de cubiertos.</p>
          </div>
        </div>

        <Campo label="Nombre" value={form.nombre} onChange={cambiar('nombre')} maxLength={100} placeholder="Hamburguesa clásica" autoFocus={!platillo} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            label="Precio de venta (COP)"
            type="number" min="0" step="100" inputMode="numeric"
            value={form.precio} onChange={cambiar('precio')} placeholder="25000"
            ayuda={precio > 0 ? `${etiquetaImpuesto()}: ${formatearCOP(impuestoIncluido(precio))}` : etiquetaImpuesto()}
          />
          <Campo
            label="Categoría" list="categorias-platillo" maxLength={50}
            value={form.categoria} onChange={cambiar('categoria')} placeholder="Platos Principales"
            ayuda="Agrupa el platillo en la carta del QR"
          />
          <datalist id="categorias-platillo">
            {categoriasDisponibles(platillos).map((c) => <option key={c} value={c} />)}
          </datalist>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-gray-600">Descripción</span>
          <textarea
            value={form.descripcion} onChange={cambiar('descripcion')} rows={3}
            placeholder="Lo que lleva y cómo se sirve"
            className="w-full resize-none rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-[15px] leading-relaxed text-espresso placeholder:text-gray-500 focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-100"
          />
        </label>

        <details className="group">
          <summary className="cursor-pointer text-[13px] font-semibold text-orange-700 hover:text-espresso">Usar una foto desde internet</summary>
          <Campo className="mt-2" type="url" value={form.imagenUrl.startsWith('data:') ? '' : form.imagenUrl} onChange={cambiar('imagenUrl')} placeholder="https://…/foto.jpg" aria-label="Dirección de la foto" />
        </details>

        {guardando && <p className="text-[13px] text-gray-500" role="status">Guardando…</p>}
      </form>

      {platillo ? (
        <section aria-label="Receta">
          <EditorReceta
            key={platillo.id}
            platillo={{ ...platillo, precio: precio || platillo.precio }}
            recetas={recetas}
            insumos={insumos}
            actuar={actuarReceta}
            mostrar={mostrar}
            titulo="Receta por porción"
          />
          <p className="mt-2 text-[13px] text-gray-500">
            Cada venta descuenta estos insumos del inventario. Si alguno se acaba, la carta marca el platillo como no disponible.
          </p>
        </section>
      ) : (
        <p className="rounded-2xl bg-gray-100 px-4 py-3 text-[14px] text-gray-600">
          Al crear el platillo podrás armar su receta aquí mismo para que descuente inventario.
        </p>
      )}
    </div>
  );
}

function GestionPlatillos() {
  const [platillos, setPlatillos] = useState(null);
  const [recetas, setRecetas] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [q, setQ] = useState('');
  const [categoria, setCategoria] = useState(null);
  const [filtro, setFiltro] = useState('todos');
  const [editando, setEditando] = useState(null); // null, 'nuevo' o el id del platillo
  const [aviso, mostrar] = useAviso();

  const cargarPlatillos = useCallback(async () => {
    try {
      setPlatillos(await api.getPlatillos());
    } catch {
      setPlatillos((p) => p ?? []);
      mostrar('No se pudieron cargar los platillos', 'error');
    }
  }, [mostrar]);

  const cargarRecetas = useCallback(async () => {
    const [r, i] = await Promise.all([getRecetas().catch(() => []), compras.insumos().catch(() => [])]);
    setRecetas(r);
    setInsumos(i);
  }, []);

  useEffect(() => {
    cargarPlatillos();
    cargarRecetas();
  }, [cargarPlatillos, cargarRecetas]);

  // Costo por porción de cada platillo según su receta y el costo de los insumos.
  const costos = useMemo(() => {
    const precio = Object.fromEntries(insumos.map((i) => [i.id, i.precioCosto ?? 0]));
    const r = {};
    recetas.forEach((x) => { r[x.platilloId] = (r[x.platilloId] ?? 0) + x.cantidadRequerida * (precio[x.productoId] ?? 0); });
    return r;
  }, [recetas, insumos]);

  const lista = useMemo(() => platillos ?? [], [platillos]);
  const conteo = useMemo(() => {
    const c = { todos: lista.length, agotado: 0, 'sin-receta': 0 };
    lista.forEach((p) => { const k = estadoPlatillo(p).clave; if (k in c) c[k] += 1; });
    return c;
  }, [lista]);
  const categorias = useMemo(() => [...new Set(lista.map((p) => p.categoria || 'General'))].sort((a, b) => a.localeCompare(b, 'es')), [lista]);

  const visibles = lista
    .filter((p) => !categoria || (p.categoria || 'General') === categoria)
    .filter((p) => filtro === 'todos' || estadoPlatillo(p).clave === filtro)
    .filter((p) => !q.trim() || coincide(p.nombre, q) || coincide(p.descripcion, q))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  const seleccionado = typeof editando === 'number' ? lista.find((p) => p.id === editando) : null;
  const cerrar = useCallback(() => setEditando(null), []);

  const eliminar = async () => {
    try {
      await api.deletePlatillo(seleccionado.id);
      mostrar(`${seleccionado.nombre} salió de la carta`);
      setEditando(null);
      await cargarPlatillos();
    } catch (err) {
      mostrar(err.message, 'error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-[1440px] px-4 py-6 lg:px-6 lg:py-8">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.02em] text-espresso">Platillos</h1>
            <p className="mt-1 text-[15px] text-gray-500">La carta del QR, con la disponibilidad que calcula el inventario y el costo de cada receta.</p>
          </div>
          <Boton tamano="lg" onClick={() => setEditando('nuevo')}><Plus size={18} aria-hidden="true" />Nuevo platillo</Boton>
        </header>

        <div className="mb-5 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="relative block min-w-[220px] flex-1 sm:max-w-sm">
              <span className="sr-only">Buscar platillo</span>
              <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" aria-hidden="true" />
              <input
                value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar platillo"
                className="h-11 w-full rounded-xl border border-gray-300 bg-white pl-10 pr-3.5 text-[15px] text-espresso placeholder:text-gray-500 focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-100"
              />
            </label>
            <div className="flex gap-1 rounded-full bg-white p-1 ring-1 ring-gray-200" role="group" aria-label="Filtrar por disponibilidad">
              {FILTROS.map((f) => (
                <button
                  key={f.id} type="button" onClick={() => setFiltro(f.id)} aria-pressed={filtro === f.id}
                  className={`tabular h-9 rounded-full px-3.5 text-[14px] font-bold transition-colors ${filtro === f.id ? 'bg-espresso text-white' : 'text-gray-600 hover:text-espresso'}`}
                >
                  {f.label} <span className={filtro === f.id ? 'text-white/70' : 'text-gray-400'}>{conteo[f.id]}</span>
                </button>
              ))}
            </div>
          </div>

          {categorias.length > 1 && (
            <div className="qp-rail -mx-1 flex gap-1 overflow-x-auto px-1" role="group" aria-label="Filtrar por categoría">
              {[null, ...categorias].map((c) => (
                <button
                  key={c ?? 'todas'} type="button" onClick={() => setCategoria(c)} aria-pressed={categoria === c}
                  className={`h-9 shrink-0 rounded-full px-3.5 text-[14px] font-semibold transition-colors ${categoria === c ? 'bg-orange-100 text-espresso' : 'text-gray-500 hover:text-espresso'}`}
                >
                  {c ?? 'Todas las categorías'}
                </button>
              ))}
            </div>
          )}
        </div>

        {!platillos ? (
          <Cargando filas={4} />
        ) : lista.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white">
            <Vacio icono={UtensilsCrossed} titulo="La carta está vacía" texto="Crea el primer platillo para que aparezca en el menú del QR.">
              <Boton onClick={() => setEditando('nuevo')}><Plus size={18} aria-hidden="true" />Nuevo platillo</Boton>
            </Vacio>
          </div>
        ) : visibles.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white">
            <Vacio icono={Search} titulo="Ningún platillo coincide" texto="Prueba con otra búsqueda o quita los filtros.">
              <Boton variante="secundario" onClick={() => { setQ(''); setFiltro('todos'); setCategoria(null); }}>Quitar filtros</Boton>
            </Vacio>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            {visibles.map((p) => (
              <TarjetaPlatillo key={p.id} platillo={p} costo={costos[p.id]} onAbrir={() => setEditando(p.id)} />
            ))}
          </ul>
        )}
      </main>

      <Panel
        abierto={editando !== null}
        onCerrar={cerrar}
        titulo={seleccionado ? seleccionado.nombre : 'Nuevo platillo'}
        subtitulo={seleccionado ? `${seleccionado.categoria} · ${estadoPlatillo(seleccionado).texto}` : 'Aparece en la carta del QR apenas lo guardes.'}
        ancho="md:w-[640px]"
        pie={
          <div className="flex items-center gap-2">
            {seleccionado && (
              <BotonConfirmar confirmar="Toca otra vez para eliminar" onConfirmar={eliminar}>
                <Trash2 size={16} aria-hidden="true" />Eliminar
              </BotonConfirmar>
            )}
            <Boton variante="secundario" className="ml-auto" onClick={cerrar}>Cerrar</Boton>
            <Boton type="submit" form="form-platillo">{seleccionado ? 'Guardar cambios' : 'Crear platillo'}</Boton>
          </div>
        }
      >
        {editando !== null && (
          <FichaPlatillo
            key={seleccionado?.id ?? 'nuevo'}
            platillo={seleccionado}
            platillos={lista}
            recetas={recetas}
            insumos={insumos}
            mostrar={mostrar}
            onGuardado={async (id) => { await cargarPlatillos(); setEditando(id); }}
            onRecetaCambio={async () => { await Promise.all([cargarRecetas(), cargarPlatillos()]); }}
          />
        )}
      </Panel>
      {aviso}
    </div>
  );
}

export default GestionPlatillos;
