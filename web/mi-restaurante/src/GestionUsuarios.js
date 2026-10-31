// Usuarios: quién entra a Qpro, con qué rol y por dónde (web o app móvil).
// Los domiciliarios creados aquí aparecen en Domicilios; los meseros entran por la app.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Monitor, Plus, Search, Smartphone, Trash2, Users } from 'lucide-react';
import * as api from './services/api';
import { useAuth } from './context/AuthContext';
import { Boton, BotonConfirmar, Campo, Cargando, Chip, Lista, Panel, useAviso, Vacio } from './components/inventario/ui';
import { coincide, iniciales, ROLES, validarUsuario } from './utils/administracion';

const FORM_VACIO = { nombre: '', nombreUsuario: '', rol: 'Caja', clave: '', confirmarClave: '' };
const rolDe = (id) => ROLES.find((r) => r.id === id);

function Acceso({ rol }) {
  const web = rolDe(rol)?.acceso === 'Web';
  const Icono = web ? Monitor : Smartphone;
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-gray-500">
      <Icono size={15} aria-hidden="true" />
      {web ? 'Web' : 'App móvil'}
    </span>
  );
}

function FichaUsuario({ usuario, esPropio, mostrar, onGuardado }) {
  const [form, setForm] = useState(FORM_VACIO);
  const [verClave, setVerClave] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const edicion = !!usuario;

  useEffect(() => {
    setForm(usuario ? { nombre: usuario.nombre, nombreUsuario: usuario.nombreUsuario, rol: usuario.rol, clave: '', confirmarClave: '' } : FORM_VACIO);
  }, [usuario]);

  const cambiar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  const guardar = async (e) => {
    e.preventDefault();
    const error = validarUsuario(form, { edicion });
    if (error) return mostrar(error, 'error');

    const datos = { nombre: form.nombre.trim(), nombreUsuario: form.nombreUsuario.trim(), rol: form.rol, clave: form.clave };
    setGuardando(true);
    try {
      if (edicion) {
        await api.updateUsuario(usuario.id, datos);
        mostrar(form.clave ? 'Usuario y clave actualizados' : 'Usuario actualizado');
        onGuardado(usuario.id);
      } else {
        const creado = await api.createUsuario(datos);
        mostrar(`${datos.nombre} ya puede entrar por ${rolDe(datos.rol).acceso === 'Web' ? 'la web' : 'la app móvil'}`);
        onGuardado(creado.id);
      }
    } catch (err) {
      mostrar(err.message, 'error');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form id="form-usuario" onSubmit={guardar} className="space-y-5 p-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Nombre completo" value={form.nombre} onChange={cambiar('nombre')} placeholder="Ana Ruiz" autoFocus={!edicion} autoComplete="off" />
        <Campo
          label="Usuario para entrar" value={form.nombreUsuario} onChange={cambiar('nombreUsuario')}
          placeholder="ana.caja" autoComplete="off" autoCapitalize="none" spellCheck={false}
          ayuda="Sin espacios, mínimo 3 caracteres"
        />
      </div>

      <fieldset>
        <legend className="mb-1.5 text-[13px] font-semibold text-gray-600">Rol</legend>
        {esPropio && <p className="mb-2 text-[13px] text-gray-500">No puedes cambiar tu propio rol; pídeselo a otro administrador.</p>}
        <div className="grid gap-2 sm:grid-cols-2">
          {ROLES.map((r) => {
            const activo = form.rol === r.id;
            return (
              <label
                key={r.id}
                className={`flex cursor-pointer gap-3 rounded-2xl border px-4 py-3 transition-colors has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-orange-100 ${
                  activo ? 'border-espresso bg-white ring-1 ring-espresso' : 'border-gray-200 bg-white hover:border-gray-300'
                } ${esPropio && !activo ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                <input
                  type="radio" name="rol" value={r.id} checked={activo} onChange={cambiar('rol')}
                  disabled={esPropio && !activo} className="mt-1 h-4 w-4 accent-espresso"
                />
                <span className="min-w-0">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-[15px] font-bold text-espresso">{r.id}</span>
                    <Acceso rol={r.id} />
                  </span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-gray-500">{r.descripcion}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="rounded-2xl bg-gray-100 p-4">
        <legend className="sr-only">Clave</legend>
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-[15px] font-bold text-espresso">{edicion ? 'Cambiar clave' : 'Clave'}</p>
          <Boton variante="fantasma" tamano="sm" onClick={() => setVerClave((v) => !v)} aria-pressed={verClave}>
            {verClave ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
            {verClave ? 'Ocultar' : 'Mostrar'}
          </Boton>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            label={edicion ? 'Clave nueva' : 'Clave'} type={verClave ? 'text' : 'password'} autoComplete="new-password"
            value={form.clave} onChange={cambiar('clave')} ayuda="Mínimo 4 caracteres"
          />
          <Campo
            label="Repite la clave" type={verClave ? 'text' : 'password'} autoComplete="new-password"
            value={form.confirmarClave} onChange={cambiar('confirmarClave')}
            ayuda={edicion ? 'Déjalas vacías para conservar la actual' : undefined}
          />
        </div>
      </fieldset>

      {guardando && <p className="text-[13px] text-gray-500" role="status">Guardando…</p>}
    </form>
  );
}

function GestionUsuarios() {
  const { usuario: sesion } = useAuth();
  const [usuarios, setUsuarios] = useState(null);
  const [q, setQ] = useState('');
  const [rol, setRol] = useState(null);
  const [editando, setEditando] = useState(null); // null, 'nuevo' o el id del usuario
  const [aviso, mostrar] = useAviso();

  const cargar = useCallback(async () => {
    try {
      setUsuarios(await api.getUsuarios());
    } catch {
      setUsuarios((u) => u ?? []);
      mostrar('No se pudieron cargar los usuarios', 'error');
    }
  }, [mostrar]);

  useEffect(() => { cargar(); }, [cargar]);

  const lista = useMemo(() => usuarios ?? [], [usuarios]);
  const conteo = useMemo(() => Object.fromEntries(ROLES.map((r) => [r.id, lista.filter((u) => u.rol === r.id).length])), [lista]);
  const visibles = lista
    .filter((u) => !rol || u.rol === rol)
    .filter((u) => !q.trim() || coincide(u.nombre, q) || coincide(u.nombreUsuario, q))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  const seleccionado = typeof editando === 'number' ? lista.find((u) => u.id === editando) : null;
  const esPropio = seleccionado?.id === sesion?.id;
  const cerrar = useCallback(() => setEditando(null), []);

  const eliminar = async () => {
    try {
      await api.deleteUsuario(seleccionado.id);
      mostrar(`${seleccionado.nombre} ya no tiene acceso`);
      setEditando(null);
      await cargar();
    } catch (err) {
      mostrar(err.message, 'error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-[1100px] px-4 py-6 lg:px-6 lg:py-8">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.02em] text-espresso">Usuarios</h1>
            <p className="mt-1 text-[15px] text-gray-500">Quién entra a Qpro, con qué rol y por dónde: la web o la app móvil.</p>
          </div>
          <Boton tamano="lg" onClick={() => setEditando('nuevo')}><Plus size={18} aria-hidden="true" />Nuevo usuario</Boton>
        </header>

        <div className="mb-4 space-y-3">
          <label className="relative block max-w-sm">
            <span className="sr-only">Buscar usuario</span>
            <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" aria-hidden="true" />
            <input
              value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o usuario"
              className="h-11 w-full rounded-xl border border-gray-300 bg-white pl-10 pr-3.5 text-[15px] text-espresso placeholder:text-gray-500 focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-100"
            />
          </label>
          <div className="qp-rail -mx-1 flex gap-1 overflow-x-auto px-1" role="group" aria-label="Filtrar por rol">
            {[null, ...ROLES.map((r) => r.id)].map((r) => (
              <button
                key={r ?? 'todos'} type="button" onClick={() => setRol(r)} aria-pressed={rol === r}
                className={`tabular h-9 shrink-0 rounded-full px-3.5 text-[14px] font-bold transition-colors ${rol === r ? 'bg-espresso text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-espresso'}`}
              >
                {r ?? 'Todos'} <span className={rol === r ? 'text-white/70' : 'text-gray-400'}>{r ? conteo[r] : lista.length}</span>
              </button>
            ))}
          </div>
        </div>

        {!usuarios ? (
          <Cargando filas={5} />
        ) : visibles.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white">
            <Vacio icono={Users} titulo={lista.length ? 'Nadie coincide' : 'Aún no hay usuarios'} texto={lista.length ? 'Prueba con otra búsqueda o quita el filtro de rol.' : 'Crea el primero para que el equipo pueda entrar.'} />
          </div>
        ) : (
          <Lista>
            {visibles.map((u) => (
              <button
                key={u.id} type="button" onClick={() => setEditando(u.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-orange-100 text-[13px] font-bold text-espresso" aria-hidden="true">
                  {iniciales(u.nombre)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[15px] font-bold text-espresso">{u.nombre}</span>
                    {u.id === sesion?.id && <Chip tono="info">Tú</Chip>}
                  </span>
                  <span className="block truncate text-[13px] text-gray-500">@{u.nombreUsuario}</span>
                </span>
                <span className="hidden w-28 sm:block"><Acceso rol={u.rol} /></span>
                <Chip className="w-28 justify-center">{u.rol}</Chip>
              </button>
            ))}
          </Lista>
        )}
      </main>

      <Panel
        abierto={editando !== null}
        onCerrar={cerrar}
        titulo={seleccionado ? seleccionado.nombre : 'Nuevo usuario'}
        subtitulo={seleccionado ? `@${seleccionado.nombreUsuario} · ${seleccionado.rol}` : 'Elige su rol: define qué ve y por dónde entra.'}
        ancho="md:w-[620px]"
        pie={
          <div className="flex items-center gap-2">
            {seleccionado && !esPropio && (
              <BotonConfirmar confirmar="Toca otra vez para eliminar" onConfirmar={eliminar}>
                <Trash2 size={16} aria-hidden="true" />Eliminar
              </BotonConfirmar>
            )}
            <Boton variante="secundario" className="ml-auto" onClick={cerrar}>Cerrar</Boton>
            <Boton type="submit" form="form-usuario">{seleccionado ? 'Guardar cambios' : 'Crear usuario'}</Boton>
          </div>
        }
      >
        {editando !== null && (
          <FichaUsuario
            key={seleccionado?.id ?? 'nuevo'}
            usuario={seleccionado}
            esPropio={esPropio}
            mostrar={mostrar}
            onGuardado={async (id) => { await cargar(); setEditando(id); }}
          />
        )}
      </Panel>
      {aviso}
    </div>
  );
}

export default GestionUsuarios;
