// Categorías, almacenes y proveedores del inventario.
import React from 'react';
import { Tag, Truck, Warehouse } from 'lucide-react';
import {
  createAlmacen, createCategoria, createProveedor, deleteAlmacen, deleteCategoria, deleteProveedor,
  getAlmacenes, getCategorias, getProveedores, updateAlmacen, updateCategoria, updateProveedor,
} from '../../services/inventarioApi';
import ListaConfig from './ListaConfig';

const COLORES = ['#C8955E', '#865B35', '#1E505A', '#82BCC3', '#57534E', '#A97644', '#2F7D88', '#78716C'];

const TIPOS_CATEGORIA = [
  { valor: 'Ingrediente', texto: 'Ingrediente' },
  { valor: 'Bebida', texto: 'Bebida' },
  { valor: 'MaterialLimpieza', texto: 'Aseo y limpieza' },
  { valor: 'ProductoTerminado', texto: 'Producto terminado' },
  { valor: 'Otro', texto: 'Otro' },
];
const TEXTO_TIPO = Object.fromEntries(TIPOS_CATEGORIA.map((t) => [t.valor, t.texto]));

const TIPOS_ALMACEN = ['Principal', 'Secundario', 'Cocina', 'Bar', 'Refrigerado', 'Congelado'];

export function Categorias() {
  return (
    <ListaConfig
      nombre="Categoría"
      plural="categorías"
      cargar={getCategorias}
      crear={createCategoria}
      actualizar={updateCategoria}
      eliminar={deleteCategoria}
      vacio={{ icono: Tag, titulo: 'Sin categorías', texto: 'Agrupa los insumos: carnes, lácteos, bebidas, aseo…' }}
      campos={[
        { nombre: 'nombre', label: 'Nombre', requerido: true, placeholder: 'Lácteos' },
        { nombre: 'tipo', label: 'Tipo', tipo: 'select', opciones: TIPOS_CATEGORIA, inicial: 'Ingrediente' },
        { nombre: 'color', label: 'Color', tipo: 'color', opciones: COLORES, inicial: COLORES[0] },
        { nombre: 'descripcion', label: 'Descripción', tipo: 'textarea' },
      ]}
      filaIcono={(c) => <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ backgroundColor: c.color || COLORES[0] }} aria-hidden="true" />}
      filaTitulo={(c) => c.nombre}
      filaDetalle={(c) => [TEXTO_TIPO[c.tipo] ?? c.tipo, c.descripcion].filter(Boolean).join(' · ')}
    />
  );
}

export function Almacenes() {
  return (
    <ListaConfig
      nombre="Almacén"
      plural="almacenes"
      cargar={getAlmacenes}
      crear={createAlmacen}
      actualizar={updateAlmacen}
      eliminar={deleteAlmacen}
      vacio={{ icono: Warehouse, titulo: 'Sin almacenes', texto: 'Bodega, cocina, cuarto frío, bar: cada lugar donde se guarda mercancía.' }}
      campos={[
        { nombre: 'nombre', label: 'Nombre', requerido: true, placeholder: 'Cuarto frío' },
        { nombre: 'tipo', label: 'Tipo', tipo: 'select', opciones: TIPOS_ALMACEN, inicial: 'Principal', ancho: 'medio' },
        { nombre: 'codigo', label: 'Código', placeholder: 'Se genera solo', ancho: 'medio' },
        { nombre: 'ubicacion', label: 'Ubicación', placeholder: 'Patio trasero, segundo piso…' },
        { nombre: 'descripcion', label: 'Descripción', tipo: 'textarea' },
      ]}
      prepararGuardado={(v, todos) => {
        if (String(v.codigo ?? '').trim()) return v;
        const usados = new Set(todos.map((a) => a.codigo));
        let n = todos.length + 1;
        while (usados.has(`ALM-${String(n).padStart(2, '0')}`)) n += 1;
        return { ...v, codigo: `ALM-${String(n).padStart(2, '0')}` };
      }}
      filaIcono={() => <Warehouse size={20} className="shrink-0 text-orange-700" aria-hidden="true" />}
      filaTitulo={(a) => a.nombre}
      filaDetalle={(a) => [a.codigo, a.tipo, a.ubicacion].filter(Boolean).join(' · ')}
    />
  );
}

export function Proveedores() {
  return (
    <ListaConfig
      nombre="Proveedor"
      plural="proveedores"
      cargar={getProveedores}
      crear={createProveedor}
      actualizar={updateProveedor}
      eliminar={deleteProveedor}
      vacio={{ icono: Truck, titulo: 'Sin proveedores', texto: 'Con su teléfono puedes enviarle los pedidos por WhatsApp.' }}
      campos={[
        { nombre: 'nombre', label: 'Nombre o razón social', requerido: true },
        { nombre: 'contacto', label: 'Persona de contacto', ancho: 'medio' },
        { nombre: 'telefono', label: 'Teléfono / WhatsApp', tipo: 'tel', ancho: 'medio', placeholder: '300 123 4567' },
        { nombre: 'email', label: 'Correo', tipo: 'email', ancho: 'medio' },
        { nombre: 'ciudad', label: 'Ciudad', ancho: 'medio' },
        { nombre: 'direccion', label: 'Dirección' },
        { nombre: 'tipoProductos', label: 'Qué le compramos', placeholder: 'Carnes, pollo, embutidos' },
      ]}
      filaIcono={() => <Truck size={20} className="shrink-0 text-purple-700" aria-hidden="true" />}
      filaTitulo={(p) => p.nombre}
      filaDetalle={(p) => [p.contacto, p.telefono, p.tipoProductos].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
    />
  );
}
