// Crear o editar un insumo. El código de barras se puede escanear (cámara o lector de mano).
import React, { useEffect, useState } from 'react';
import {
  createProducto, deleteProducto, getCategorias, getProducto, getProveedores, mensajeError, updateProducto,
} from '../../services/inventarioApi';
import EscanerCodigo from './EscanerCodigo';
import { Boton, BotonConfirmar, Campo, Panel, Selector } from './ui';

// Mismas unidades que entienden las recetas: el descuento no convierte entre unidades.
export const UNIDADES = ['Kg', 'Gramos', 'Litro', 'Mililitro', 'Unidad', 'Paquete', 'Caja', 'Botella', 'Lata', 'Pieza', 'Porcion'];

const VACIO = {
  nombre: '', categoriaId: '', unidadMedida: 'Kg', proveedorId: '', codigo: '', codigoBarras: '', precioCosto: '',
  stockMinimo: '', puntoReorden: '', stockMaximo: '', requiereCaducidad: false, diasVencimiento: '', descripcion: '', activo: true,
};

export default function FormularioInsumo({ abierto, productoId = null, codigoInicial = '', onCerrar, onGuardado }) {
  const [v, setV] = useState(VACIO);
  const [original, setOriginal] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!abierto) return;
    setError(null);
    Promise.all([getCategorias(), getProveedores()])
      .then(([c, p]) => {
        setCategorias(c.filter((x) => x.activo !== false));
        setProveedores(p.filter((x) => x.activo !== false));
        if (!productoId) setV((x) => ({ ...x, categoriaId: x.categoriaId || String(c[0]?.id ?? '') }));
      })
      .catch(() => {});
    if (productoId) {
      getProducto(productoId)
        .then((p) => {
          setOriginal(p);
          setV({
            nombre: p.nombre ?? '', categoriaId: String(p.categoriaId ?? ''), unidadMedida: p.unidadMedida ?? 'Kg',
            proveedorId: p.proveedorId ? String(p.proveedorId) : '', codigo: p.codigo ?? '', codigoBarras: p.codigoBarras ?? '',
            precioCosto: p.precioCosto ?? '', stockMinimo: p.stockMinimo ?? '', puntoReorden: p.puntoReorden ?? '', stockMaximo: p.stockMaximo ?? '',
            requiereCaducidad: !!p.requiereCaducidad, diasVencimiento: p.diasVencimiento ?? '', descripcion: p.descripcion ?? '', activo: p.activo !== false,
          });
        })
        .catch((e) => setError(mensajeError(e, 'No se pudo cargar el insumo')));
    } else {
      setOriginal(null);
      setV({ ...VACIO, codigoBarras: codigoInicial });
    }
  }, [abierto, productoId, codigoInicial]);

  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const num = (x) => (x === '' || x == null ? null : Number(x));

  const guardar = async () => {
    if (!v.nombre.trim()) return setError('Escribe el nombre del insumo.');
    if (!v.categoriaId) return setError('Elige la categoría.');
    setGuardando(true);
    setError(null);
    const dto = {
      id: productoId ?? undefined,
      nombre: v.nombre.trim(), categoriaId: Number(v.categoriaId), unidadMedida: v.unidadMedida,
      proveedorId: v.proveedorId ? Number(v.proveedorId) : null, codigo: v.codigo.trim() || null,
      codigoBarras: v.codigoBarras.trim() || null, precioCosto: num(v.precioCosto) ?? 0,
      stockMinimo: num(v.stockMinimo) ?? 0, puntoReorden: num(v.puntoReorden), stockMaximo: num(v.stockMaximo),
      requiereCaducidad: v.requiereCaducidad, diasVencimiento: v.diasVencimiento === '' ? null : Math.round(Number(v.diasVencimiento)),
      descripcion: v.descripcion.trim() || null, imagenUrl: original?.imagenUrl ?? null, activo: v.activo,
    };
    try {
      const r = productoId ? await updateProducto(productoId, dto) : await createProducto(dto);
      onGuardado?.(productoId ? `${dto.nombre} actualizado` : `${dto.nombre} creado con código ${r?.codigo ?? ''}`.trim(), r?.id ?? productoId);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo guardar el insumo'));
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async () => {
    try {
      await deleteProducto(productoId);
      onGuardado?.(`${v.nombre} eliminado`, null);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo eliminar'));
    }
  };

  return (
    <Panel
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={productoId ? v.nombre || 'Insumo' : 'Nuevo insumo'}
      subtitulo={productoId ? `Código interno ${v.codigo}` : 'Lo que se compra y se gasta en las recetas.'}
      pie={
        <div className="flex items-center gap-2">
          {productoId && <BotonConfirmar onConfirmar={borrar}>Eliminar</BotonConfirmar>}
          <span className="flex-1" />
          <Boton variante="secundario" tamano="lg" onClick={onCerrar}>Cancelar</Boton>
          <Boton tamano="lg" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</Boton>
        </div>
      }
    >
      <div className="space-y-6 p-5">
        <section className="grid grid-cols-2 gap-4">
          <Campo label="Nombre" value={v.nombre} onChange={set('nombre')} placeholder="Leche entera" className="col-span-2" autoFocus={!productoId} />
          <Selector label="Categoría" value={v.categoriaId} onChange={set('categoriaId')}>
            {categorias.length === 0 && <option value="">Crea una categoría primero</option>}
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </Selector>
          <Selector label="Se mide en" value={v.unidadMedida} onChange={set('unidadMedida')}>
            {!UNIDADES.includes(v.unidadMedida) && <option value={v.unidadMedida}>{v.unidadMedida}</option>}
            {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
          </Selector>
          <Selector label="Proveedor habitual" value={v.proveedorId} onChange={set('proveedorId')} className="col-span-2">
            <option value="">Sin proveedor</option>
            {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </Selector>
        </section>

        <section>
          <h3 className="mb-2 text-[15px] font-extrabold text-espresso">Códigos</h3>
          <p className="mb-1.5 text-[13px] font-semibold text-gray-600">Código de barras</p>
          <EscanerCodigo onCodigo={(c) => setV((x) => ({ ...x, codigoBarras: c }))} autoFocus={false} placeholder="Escanea o escribe el código" />
          {v.codigoBarras && (
            <p className="mt-2 text-[14px] text-espresso">
              Código: <span className="tabular font-bold">{v.codigoBarras}</span>{' '}
              <button type="button" className="text-[13px] font-bold text-orange-700 underline underline-offset-4" onClick={() => setV((x) => ({ ...x, codigoBarras: '' }))}>Quitar</button>
            </p>
          )}
          <p className="mt-1 text-[12px] text-gray-500">Para la caja o el paquete, agrega una presentación desde la ficha del insumo.</p>
          <Campo label="Código interno" value={v.codigo} onChange={set('codigo')} placeholder="Se genera solo (PROD-021)" className="mt-3 tabular" />
        </section>

        <section className="grid grid-cols-2 gap-4">
          <h3 className="col-span-2 text-[15px] font-extrabold text-espresso">Compra y niveles</h3>
          <Campo label={`Precio por ${v.unidadMedida}`} type="number" min="0" step="any" inputMode="decimal" value={v.precioCosto} onChange={set('precioCosto')} ayuda="Se actualiza solo con cada compra." className="col-span-2 tabular" />
          <Campo label="Mínimo" type="number" min="0" step="any" inputMode="decimal" value={v.stockMinimo} onChange={set('stockMinimo')} className="tabular" />
          <Campo label="Pedir al llegar a" type="number" min="0" step="any" inputMode="decimal" value={v.puntoReorden} onChange={set('puntoReorden')} placeholder="= mínimo" className="tabular" />
          <Campo label="Llenar hasta" type="number" min="0" step="any" inputMode="decimal" value={v.stockMaximo} onChange={set('stockMaximo')} placeholder="2 × punto" className="col-span-2 tabular" />
        </section>

        <section className="space-y-3">
          <h3 className="text-[15px] font-extrabold text-espresso">Vencimiento</h3>
          <label className="flex items-center gap-3 text-[14px] font-semibold text-espresso">
            <input type="checkbox" checked={v.requiereCaducidad} onChange={set('requiereCaducidad')} className="h-5 w-5 rounded accent-espresso" />
            Es perecedero: pedir fecha de vencimiento al recibir
          </label>
          <Campo label="Dura (días) desde que llega" type="number" min="0" step="1" value={v.diasVencimiento} onChange={set('diasVencimiento')} placeholder="Opcional" ayuda="Sugiere la fecha al escanear." />
        </section>

        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-gray-600">Notas</span>
          <textarea
            value={v.descripcion}
            onChange={set('descripcion')}
            rows={2}
            placeholder="Marca preferida, cómo se almacena…"
            className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-[15px] text-espresso placeholder:text-gray-500 focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-100"
          />
        </label>

        {productoId && (
          <label className="flex items-center gap-3 text-[14px] font-semibold text-espresso">
            <input type="checkbox" checked={v.activo} onChange={set('activo')} className="h-5 w-5 rounded accent-espresso" />
            Activo (un insumo inactivo deja sus platillos como no disponibles)
          </label>
        )}

        {error && <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-[14px] font-semibold text-red-800" role="alert">{error}</p>}
      </div>
    </Panel>
  );
}
