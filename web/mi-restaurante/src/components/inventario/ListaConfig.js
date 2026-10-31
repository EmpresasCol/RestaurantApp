// Catálogos sencillos de configuración (categorías, almacenes, proveedores): lista con
// búsqueda y un panel lateral para crear o editar. Los campos se describen con `campos`.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { mensajeError } from '../../services/inventarioApi';
import { Boton, BotonConfirmar, Campo, Cargando, Chip, Panel, Selector, useAviso, Vacio } from './ui';

const normalizar = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function CampoConfig({ campo, valor, onCambio }) {
  const comun = { value: valor ?? '', onChange: (e) => onCambio(e.target.value) };
  if (campo.tipo === 'select') {
    return (
      <Selector label={campo.label} {...comun} className={campo.ancho === 'medio' ? '' : 'col-span-2'}>
        {campo.opciones.map((o) => <option key={o.valor ?? o} value={o.valor ?? o}>{o.texto ?? o}</option>)}
      </Selector>
    );
  }
  if (campo.tipo === 'textarea') {
    return (
      <label className="col-span-2 block">
        <span className="mb-1.5 block text-[13px] font-semibold text-gray-600">{campo.label}</span>
        <textarea
          {...comun}
          rows={3}
          placeholder={campo.placeholder}
          className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-[15px] text-espresso placeholder:text-gray-500 focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-100"
        />
      </label>
    );
  }
  if (campo.tipo === 'color') {
    return (
      <div className="col-span-2">
        <span className="mb-1.5 block text-[13px] font-semibold text-gray-600">{campo.label}</span>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={campo.label}>
          {campo.opciones.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={valor === c}
              aria-label={c}
              onClick={() => onCambio(c)}
              className={`h-9 w-9 rounded-full ring-offset-2 transition-shadow ${valor === c ? 'ring-2 ring-espresso' : 'ring-1 ring-gray-200'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
    );
  }
  return (
    <Campo
      label={campo.label}
      type={campo.tipo ?? 'text'}
      inputMode={campo.tipo === 'tel' ? 'tel' : undefined}
      placeholder={campo.placeholder}
      ayuda={campo.ayuda}
      className={campo.ancho === 'medio' ? '' : 'col-span-2'}
      {...comun}
    />
  );
}

export default function ListaConfig({
  nombre, plural, campos, vacio, cargar, crear, actualizar, eliminar, filaTitulo, filaDetalle, filaIcono, prepararGuardado,
}) {
  const [items, setItems] = useState(null);
  const [q, setQ] = useState('');
  const [editando, setEditando] = useState(null);
  const [valores, setValores] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [aviso, mostrar] = useAviso();

  const recargar = useCallback(() => {
    cargar().then(setItems).catch((e) => { setItems([]); mostrar(mensajeError(e, `No se pudieron cargar los ${plural}`), 'error'); });
  }, [cargar, plural, mostrar]);
  useEffect(() => { recargar(); }, [recargar]);

  const visibles = useMemo(() => {
    const t = normalizar(q.trim());
    return (items ?? []).filter((x) => !t || campos.some((c) => normalizar(x[c.nombre]).includes(t)));
  }, [items, q, campos]);

  const abrir = (item) => {
    setEditando(item ?? {});
    setValores(item ? { ...item } : { ...Object.fromEntries(campos.map((c) => [c.nombre, c.inicial ?? ''])), activo: true });
    setError(null);
  };

  const guardar = async () => {
    const faltante = campos.find((c) => c.requerido && !String(valores[c.nombre] ?? '').trim());
    if (faltante) return setError(`Falta: ${faltante.label.toLowerCase()}.`);
    setGuardando(true);
    setError(null);
    try {
      const dto = prepararGuardado ? prepararGuardado(valores, items ?? []) : valores;
      if (editando.id) await actualizar(editando.id, dto);
      else await crear(dto);
      mostrar(editando.id ? `${nombre} actualizado` : `${nombre} creado`);
      setEditando(null);
      recargar();
    } catch (e) {
      setError(mensajeError(e, `No se pudo guardar el ${nombre.toLowerCase()}`));
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async () => {
    try {
      await eliminar(editando.id);
      mostrar(`${nombre} eliminado`);
      setEditando(null);
      recargar();
    } catch (e) {
      setError(mensajeError(e, `No se pudo eliminar el ${nombre.toLowerCase()}`));
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex gap-2">
        <label className="relative flex-1">
          <span className="sr-only">Buscar {plural}</span>
          <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" aria-hidden="true" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Buscar ${plural}`}
            className="h-11 w-full rounded-xl border border-gray-300 bg-white pl-10 pr-3.5 text-[15px] text-espresso placeholder:text-gray-500 focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-100"
          />
        </label>
        <Boton onClick={() => abrir(null)} className="h-11"><Plus size={18} aria-hidden="true" /> Nuevo</Boton>
      </div>

      <div className="mt-4">
        {!items ? <Cargando /> : visibles.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white"><Vacio {...vacio} /></div>
        ) : (
          <ul className="divide-y divide-gray-200 overflow-hidden rounded-2xl border border-gray-200 bg-white">
            {visibles.map((x) => (
              <li key={x.id}>
                <button type="button" onClick={() => abrir(x)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50">
                  {filaIcono?.(x)}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold text-espresso">{filaTitulo(x)}</span>
                    <span className="block truncate text-[13px] text-gray-500">{filaDetalle(x)}</span>
                  </span>
                  {x.activo === false && <Chip>Inactivo</Chip>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Panel
        abierto={!!editando}
        onCerrar={() => setEditando(null)}
        titulo={editando?.id ? filaTitulo(editando) : `Nuevo ${nombre.toLowerCase()}`}
        pie={
          <div className="flex items-center gap-2">
            {editando?.id && eliminar && <BotonConfirmar onConfirmar={borrar}>Eliminar</BotonConfirmar>}
            <span className="flex-1" />
            <Boton variante="secundario" tamano="lg" onClick={() => setEditando(null)}>Cancelar</Boton>
            <Boton tamano="lg" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</Boton>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-4 p-5">
          {campos.map((c) => (
            <CampoConfig key={c.nombre} campo={c} valor={valores[c.nombre]} onCambio={(v) => setValores((x) => ({ ...x, [c.nombre]: v }))} />
          ))}
          {editando?.id && (
            <label className="col-span-2 flex items-center gap-3 text-[14px] font-semibold text-espresso">
              <input type="checkbox" checked={valores.activo !== false} onChange={(e) => setValores((x) => ({ ...x, activo: e.target.checked }))} className="h-5 w-5 rounded accent-espresso" />
              Activo (desactívalo en lugar de eliminarlo si ya tiene historial)
            </label>
          )}
          {error && <p className="col-span-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-[14px] font-semibold text-red-800" role="alert">{error}</p>}
        </div>
      </Panel>
      {aviso}
    </div>
  );
}
