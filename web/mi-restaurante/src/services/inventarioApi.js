// ==================== SERVICIOS API - MÓDULO DE INVENTARIO ====================
// Archivo: src/services/inventarioApi.js

const API_URL = process.env.REACT_APP_API_URL || 'https://pulingly-unpromising-gracie.ngrok-free.dev/api';

// Helper para headers con UTF-8 y ngrok
const fetchWithHeaders = async (url, options = {}) => {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Accept': 'application/json',
    'ngrok-skip-browser-warning': 'true',
    ...options.headers
  };

  return fetch(url, {
    ...options,
    headers
  });
};

// ==================== CATEGORÍAS DE INVENTARIO ====================

export const getCategoriasInventario = async () => {
  try {
    const response = await fetchWithHeaders(`${API_URL}/inventario/categorias`);
    if (!response.ok) throw new Error('Error al obtener categorías');
    return await response.json();
  } catch (error) {
    console.error('Error en getCategoriasInventario:', error);
    throw error;
  }
};

export const createCategoriaInventario = async (categoriaData) => {
  try {
    console.log('📤 Creando categoría:', categoriaData);
    
    const dataBackend = {
      Nombre: categoriaData.nombre,
      Descripcion: categoriaData.descripcion || null,
      Tipo: categoriaData.tipo,
      Color: categoriaData.color || '#3b82f6',
      Activo: categoriaData.activo !== false
    };

    const response = await fetchWithHeaders(`${API_URL}/inventario/categorias`, {
      method: 'POST',
      body: JSON.stringify(dataBackend)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error al crear categoría: ${errorText}`);
    }

    const resultado = await response.json();
    console.log('✅ Categoría creada:', resultado);
    return resultado;
  } catch (error) {
    console.error('❌ Error en createCategoriaInventario:', error);
    throw error;
  }
};

export const updateCategoriaInventario = async (id, categoriaData) => {
  try {
    console.log('🔄 Actualizando categoría:', { id, ...categoriaData });
    
    const dataBackend = {
      Id: id,
      Nombre: categoriaData.nombre,
      Descripcion: categoriaData.descripcion || null,
      Tipo: categoriaData.tipo,
      Color: categoriaData.color || '#3b82f6',
      Activo: categoriaData.activo !== false
    };

    const response = await fetchWithHeaders(`${API_URL}/inventario/categorias/${id}`, {
      method: 'PUT',
      body: JSON.stringify(dataBackend)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Error al actualizar categoría');
    }

    console.log('✅ Categoría actualizada exitosamente');
    return { success: true };
  } catch (error) {
    console.error('❌ Error en updateCategoriaInventario:', error);
    throw error;
  }
};

export const deleteCategoriaInventario = async (id) => {
  try {
    console.log('🗑️ Eliminando categoría:', id);
    
    const response = await fetchWithHeaders(`${API_URL}/inventario/categorias/${id}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Error al eliminar categoría');
    }

    console.log('✅ Categoría eliminada exitosamente');
    return { success: true };
  } catch (error) {
    console.error('❌ Error en deleteCategoriaInventario:', error);
    throw error;
  }
};

// ==================== PROVEEDORES ====================

export const getProveedores = async () => {
  try {
    const response = await fetchWithHeaders(`${API_URL}/inventario/proveedores`);
    if (!response.ok) throw new Error('Error al obtener proveedores');
    return await response.json();
  } catch (error) {
    console.error('Error en getProveedores:', error);
    throw error;
  }
};

export const createProveedor = async (proveedorData) => {
  try {
    console.log('📤 Creando proveedor:', proveedorData);
    
    const dataBackend = {
      Nombre: proveedorData.nombre,
      Contacto: proveedorData.contacto || null,
      Telefono: proveedorData.telefono || null,
      Email: proveedorData.email || null,
      Direccion: proveedorData.direccion || null,
      Ciudad: proveedorData.ciudad || null,
      TipoProductos: proveedorData.tipoProductos || null,
      Activo: proveedorData.activo !== false
    };

    const response = await fetchWithHeaders(`${API_URL}/inventario/proveedores`, {
      method: 'POST',
      body: JSON.stringify(dataBackend)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error al crear proveedor: ${errorText}`);
    }

    const resultado = await response.json();
    console.log('✅ Proveedor creado:', resultado);
    return resultado;
  } catch (error) {
    console.error('❌ Error en createProveedor:', error);
    throw error;
  }
};

export const updateProveedor = async (id, proveedorData) => {
  try {
    console.log('🔄 Actualizando proveedor:', { id, ...proveedorData });
    
    const dataBackend = {
      Id: id,
      Nombre: proveedorData.nombre,
      Contacto: proveedorData.contacto || null,
      Telefono: proveedorData.telefono || null,
      Email: proveedorData.email || null,
      Direccion: proveedorData.direccion || null,
      Ciudad: proveedorData.ciudad || null,
      TipoProductos: proveedorData.tipoProductos || null,
      Activo: proveedorData.activo !== false
    };

    const response = await fetchWithHeaders(`${API_URL}/inventario/proveedores/${id}`, {
      method: 'PUT',
      body: JSON.stringify(dataBackend)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Error al actualizar proveedor');
    }

    console.log('✅ Proveedor actualizado exitosamente');
    return { success: true };
  } catch (error) {
    console.error('❌ Error en updateProveedor:', error);
    throw error;
  }
};

export const deleteProveedor = async (id) => {
  try {
    console.log('🗑️ Eliminando proveedor:', id);
    
    const response = await fetchWithHeaders(`${API_URL}/inventario/proveedores/${id}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Error al eliminar proveedor');
    }

    console.log('✅ Proveedor eliminado exitosamente');
    return { success: true };
  } catch (error) {
    console.error('❌ Error en deleteProveedor:', error);
    throw error;
  }
};

// ==================== ALMACENES ====================

export const getAlmacenes = async () => {
  try {
    const response = await fetchWithHeaders(`${API_URL}/inventario/almacenes`);
    if (!response.ok) throw new Error('Error al obtener almacenes');
    return await response.json();
  } catch (error) {
    console.error('Error en getAlmacenes:', error);
    throw error;
  }
};

export const createAlmacen = async (almacenData) => {
  try {
    console.log('📤 Creando almacén:', almacenData);
    
    const dataBackend = {
      Codigo: almacenData.codigo,
      Nombre: almacenData.nombre,
      Descripcion: almacenData.descripcion || null,
      Ubicacion: almacenData.ubicacion || null,
      Tipo: almacenData.tipo || 'Principal',
      Activo: almacenData.activo !== false
    };

    const response = await fetchWithHeaders(`${API_URL}/inventario/almacenes`, {
      method: 'POST',
      body: JSON.stringify(dataBackend)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error al crear almacén: ${errorText}`);
    }

    const resultado = await response.json();
    console.log('✅ Almacén creado:', resultado);
    return resultado;
  } catch (error) {
    console.error('❌ Error en createAlmacen:', error);
    throw error;
  }
};

export const updateAlmacen = async (id, almacenData) => {
  try {
    console.log('🔄 Actualizando almacén:', { id, ...almacenData });
    
    const dataBackend = {
      Id: id,
      Codigo: almacenData.codigo,
      Nombre: almacenData.nombre,
      Descripcion: almacenData.descripcion || null,
      Ubicacion: almacenData.ubicacion || null,
      Tipo: almacenData.tipo || 'Principal',
      Activo: almacenData.activo !== false
    };

    const response = await fetchWithHeaders(`${API_URL}/inventario/almacenes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(dataBackend)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Error al actualizar almacén');
    }

    console.log('✅ Almacén actualizado exitosamente');
    return { success: true };
  } catch (error) {
    console.error('❌ Error en updateAlmacen:', error);
    throw error;
  }
};

export const deleteAlmacen = async (id) => {
  try {
    console.log('🗑️ Eliminando almacén:', id);
    
    const response = await fetchWithHeaders(`${API_URL}/inventario/almacenes/${id}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Error al eliminar almacén');
    }

    console.log('✅ Almacén eliminado exitosamente');
    return { success: true };
  } catch (error) {
    console.error('❌ Error en deleteAlmacen:', error);
    throw error;
  }
};

// ==================== PRODUCTOS DE INVENTARIO ====================

export const getProductosInventario = async () => {
  try {
    const response = await fetchWithHeaders(`${API_URL}/inventario/productos`);
    if (!response.ok) throw new Error('Error al obtener productos');
    return await response.json();
  } catch (error) {
    console.error('Error en getProductosInventario:', error);
    throw error;
  }
};

export const getProductoInventario = async (id) => {
  try {
    const response = await fetchWithHeaders(`${API_URL}/inventario/productos/${id}`);
    if (!response.ok) throw new Error('Error al obtener producto');
    return await response.json();
  } catch (error) {
    console.error('Error en getProductoInventario:', error);
    throw error;
  }
};

export const createProductoInventario = async (productoData) => {
  try {
    console.log('📤 Creando producto:', productoData);
    
    const dataBackend = {
      Codigo: productoData.codigo,
      Nombre: productoData.nombre,
      Descripcion: productoData.descripcion || null,
      CategoriaId: parseInt(productoData.categoriaId),
      ProveedorId: productoData.proveedorId ? parseInt(productoData.proveedorId) : null,
      UnidadMedida: productoData.unidadMedida,
      PrecioCosto: parseFloat(productoData.precioCosto),
      StockMinimo: parseInt(productoData.stockMinimo),
      StockMaximo: productoData.stockMaximo ? parseInt(productoData.stockMaximo) : null,
      PuntoReorden: productoData.puntoReorden ? parseInt(productoData.puntoReorden) : null,
      RequiereCaducidad: productoData.requiereCaducidad || false,
      DiasVencimiento: productoData.diasVencimiento ? parseInt(productoData.diasVencimiento) : null,
      ImagenUrl: productoData.imagenUrl || null,
      Activo: productoData.activo !== false
    };

    const response = await fetchWithHeaders(`${API_URL}/inventario/productos`, {
      method: 'POST',
      body: JSON.stringify(dataBackend)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error al crear producto: ${errorText}`);
    }

    const resultado = await response.json();
    console.log('✅ Producto creado:', resultado);
    return resultado;
  } catch (error) {
    console.error('❌ Error en createProductoInventario:', error);
    throw error;
  }
};

export const updateProductoInventario = async (id, productoData) => {
  try {
    console.log('🔄 Actualizando producto:', { id, ...productoData });
    
    const dataBackend = {
      Id: id,
      Codigo: productoData.codigo,
      Nombre: productoData.nombre,
      Descripcion: productoData.descripcion || null,
      CategoriaId: parseInt(productoData.categoriaId),
      ProveedorId: productoData.proveedorId ? parseInt(productoData.proveedorId) : null,
      UnidadMedida: productoData.unidadMedida,
      PrecioCosto: parseFloat(productoData.precioCosto),
      StockMinimo: parseInt(productoData.stockMinimo),
      StockMaximo: productoData.stockMaximo ? parseInt(productoData.stockMaximo) : null,
      PuntoReorden: productoData.puntoReorden ? parseInt(productoData.puntoReorden) : null,
      RequiereCaducidad: productoData.requiereCaducidad || false,
      DiasVencimiento: productoData.diasVencimiento ? parseInt(productoData.diasVencimiento) : null,
      ImagenUrl: productoData.imagenUrl || null,
      Activo: productoData.activo !== false
    };

    const response = await fetchWithHeaders(`${API_URL}/inventario/productos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(dataBackend)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Error al actualizar producto');
    }

    console.log('✅ Producto actualizado exitosamente');
    return { success: true };
  } catch (error) {
    console.error('❌ Error en updateProductoInventario:', error);
    throw error;
  }
};

export const deleteProductoInventario = async (id) => {
  try {
    console.log('🗑️ Eliminando producto:', id);
    
    const response = await fetchWithHeaders(`${API_URL}/inventario/productos/${id}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Error al eliminar producto');
    }

    console.log('✅ Producto eliminado exitosamente');
    return { success: true };
  } catch (error) {
    console.error('❌ Error en deleteProductoInventario:', error);
    throw error;
  }
};

// ==================== STOCK ====================

export const getStock = async () => {
  try {
    const response = await fetchWithHeaders(`${API_URL}/inventario/stock`);
    if (!response.ok) throw new Error('Error al obtener stock');
    return await response.json();
  } catch (error) {
    console.error('Error en getStock:', error);
    throw error;
  }
};

export const getStockPorAlmacen = async (almacenId) => {
  try {
    const response = await fetchWithHeaders(`${API_URL}/inventario/stock/almacen/${almacenId}`);
    if (!response.ok) throw new Error('Error al obtener stock por almacén');
    return await response.json();
  } catch (error) {
    console.error('Error en getStockPorAlmacen:', error);
    throw error;
  }
};

export const getStockPorProducto = async (productoId) => {
  try {
    const response = await fetchWithHeaders(`${API_URL}/inventario/stock/producto/${productoId}`);
    if (!response.ok) throw new Error('Error al obtener stock por producto');
    return await response.json();
  } catch (error) {
    console.error('Error en getStockPorProducto:', error);
    throw error;
  }
};

// ==================== MOVIMIENTOS DE INVENTARIO ====================

export const getMovimientos = async () => {
  try {
    const response = await fetchWithHeaders(`${API_URL}/inventario/movimientos`);
    if (!response.ok) throw new Error('Error al obtener movimientos');
    return await response.json();
  } catch (error) {
    console.error('Error en getMovimientos:', error);
    throw error;
  }
};

export const createMovimiento = async (movimientoData) => {
  try {
    console.log('📤 Creando movimiento:', movimientoData);
    
    const dataBackend = {
      ProductoId: parseInt(movimientoData.productoId),
      AlmacenId: parseInt(movimientoData.almacenId),
      TipoMovimiento: movimientoData.tipoMovimiento,
      Cantidad: parseFloat(movimientoData.cantidad),
      CostoUnitario: movimientoData.costoUnitario ? parseFloat(movimientoData.costoUnitario) : null,
      Motivo: movimientoData.motivo || null,
      Referencia: movimientoData.referencia || null,
      LoteId: movimientoData.loteId ? parseInt(movimientoData.loteId) : null,
      UsuarioId: movimientoData.usuarioId ? parseInt(movimientoData.usuarioId) : null
    };

    const response = await fetchWithHeaders(`${API_URL}/inventario/movimientos`, {
      method: 'POST',
      body: JSON.stringify(dataBackend)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error al crear movimiento: ${errorText}`);
    }

    const resultado = await response.json();
    console.log('✅ Movimiento creado:', resultado);
    return resultado;
  } catch (error) {
    console.error('❌ Error en createMovimiento:', error);
    throw error;
  }
};

// ==================== LOTES ====================

export const getLotes = async () => {
  try {
    const response = await fetchWithHeaders(`${API_URL}/inventario/lotes`);
    if (!response.ok) throw new Error('Error al obtener lotes');
    return await response.json();
  } catch (error) {
    console.error('Error en getLotes:', error);
    throw error;
  }
};

export const getLotesProximosVencer = async (dias = 7) => {
  try {
    const response = await fetchWithHeaders(`${API_URL}/inventario/lotes/vencimiento?dias=${dias}`);
    if (!response.ok) throw new Error('Error al obtener lotes próximos a vencer');
    return await response.json();
  } catch (error) {
    console.error('Error en getLotesProximosVencer:', error);
    throw error;
  }
};

export const createLote = async (loteData) => {
  try {
    console.log('📤 Creando lote:', loteData);
    
    const dataBackend = {
      NumeroLote: loteData.numeroLote,
      ProductoId: parseInt(loteData.productoId),
      AlmacenId: parseInt(loteData.almacenId),
      CantidadInicial: parseFloat(loteData.cantidadInicial),
      CantidadActual: parseFloat(loteData.cantidadActual || loteData.cantidadInicial),
      FechaIngreso: loteData.fechaIngreso || new Date().toISOString(),
      FechaVencimiento: loteData.fechaVencimiento || null,
      CostoUnitario: parseFloat(loteData.costoUnitario),
      Estado: loteData.estado || 'Activo'
    };

    const response = await fetchWithHeaders(`${API_URL}/inventario/lotes`, {
      method: 'POST',
      body: JSON.stringify(dataBackend)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error al crear lote: ${errorText}`);
    }

    const resultado = await response.json();
    console.log('✅ Lote creado:', resultado);
    return resultado;
  } catch (error) {
    console.error('❌ Error en createLote:', error);
    throw error;
  }
};

// ==================== REPORTES Y VISTAS ====================

export const getStockGeneral = async () => {
  try {
    const response = await fetchWithHeaders(`${API_URL}/inventario/reportes/stock-general`);
    if (!response.ok) throw new Error('Error al obtener stock general');
    return await response.json();
  } catch (error) {
    console.error('Error en getStockGeneral:', error);
    throw error;
  }
};

export const getProductosVencimiento = async () => {
  try {
    const response = await fetchWithHeaders(`${API_URL}/inventario/reportes/productos-vencimiento`);
    if (!response.ok) throw new Error('Error al obtener productos próximos a vencer');
    return await response.json();
  } catch (error) {
    console.error('Error en getProductosVencimiento:', error);
    throw error;
  }
};

export const getValorInventarioPorAlmacen = async () => {
  try {
    const response = await fetchWithHeaders(`${API_URL}/inventario/reportes/valor-por-almacen`);
    if (!response.ok) throw new Error('Error al obtener valor de inventario por almacén');
    return await response.json();
  } catch (error) {
    console.error('Error en getValorInventarioPorAlmacen:', error);
    throw error;
  }
};

export const getAlertasStock = async () => {
  try {
    const response = await fetchWithHeaders(`${API_URL}/inventario/reportes/alertas-stock`);
    if (!response.ok) throw new Error('Error al obtener alertas de stock');
    return await response.json();
  } catch (error) {
    console.error('Error en getAlertasStock:', error);
    throw error;
  }
};
