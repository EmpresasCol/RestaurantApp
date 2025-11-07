-- =====================================================
-- SCRIPT COMPLETO: RestauranteBD (con correcciones, CHECKs, triggers y procedimientos)
-- Fecha: Generado automáticamente
-- Motor: MySQL 8+
-- =====================================================

DROP DATABASE IF EXISTS RestauranteBD;
CREATE DATABASE RestauranteBD;
USE RestauranteBD;

-- =====================================================
-- TABLA: Usuarios
-- =====================================================
CREATE TABLE Usuarios (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    Nombre VARCHAR(100) NOT NULL,
    Usuario VARCHAR(50) UNIQUE NOT NULL,
    ClaveHash CHAR(60) NOT NULL, -- recomendado bcrypt (~60)
    Rol ENUM('Administrador','Mesero','Cocina','Caja') NOT NULL,
    INDEX idx_usuario (Usuario),
    INDEX idx_rol (Rol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLA: Mesas
-- =====================================================
CREATE TABLE Mesas (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    Numero INT NOT NULL UNIQUE,
    Estado ENUM('Disponible','Ocupada','EsperandoPago') DEFAULT 'Disponible',
    INDEX idx_estado (Estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLA: Platillos
-- =====================================================
CREATE TABLE Platillos (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    Nombre VARCHAR(100) NOT NULL,
    Descripcion TEXT,
    Precio DECIMAL(10,2) NOT NULL,
    ImagenUrl LONGTEXT,  -- soporta Base64 o URL larga
    Categoria VARCHAR(50) NOT NULL DEFAULT 'Platos Principales',
    INDEX idx_categoria (Categoria),
    INDEX idx_nombre (Nombre),
    CONSTRAINT chk_platillos_precio_nonneg CHECK (Precio >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLA: Pedidos
-- =====================================================
CREATE TABLE Pedidos (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    MesaId INT NOT NULL,
    UsuarioId INT NOT NULL,
    Estado ENUM('EnProceso','Listo','Entregado','Pagado','Cancelado') DEFAULT 'EnProceso',
    Fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (MesaId) REFERENCES Mesas(Id) ON DELETE RESTRICT,
    FOREIGN KEY (UsuarioId) REFERENCES Usuarios(Id) ON DELETE RESTRICT,
    INDEX idx_estado (Estado),
    INDEX idx_fecha (Fecha),
    INDEX idx_mesa (MesaId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLA: PedidoDetalles
-- =====================================================
CREATE TABLE PedidoDetalles (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    PedidoId INT NOT NULL,
    PlatilloId INT NOT NULL,
    Cantidad INT NOT NULL,
    Nota TEXT,
    Estado ENUM('Pendiente','EnPreparacion','Listo','Cancelado') DEFAULT 'Pendiente',
    FOREIGN KEY (PedidoId) REFERENCES Pedidos(Id) ON DELETE CASCADE,
    FOREIGN KEY (PlatilloId) REFERENCES Platillos(Id) ON DELETE RESTRICT,
    INDEX idx_pedido (PedidoId),
    INDEX idx_platillo (PlatilloId),
    INDEX idx_estado (Estado),
    CONSTRAINT chk_pedidodetalles_cantidad_positive CHECK (Cantidad > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLA: Pagos
-- =====================================================
CREATE TABLE Pagos (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    PedidoId INT NOT NULL,
    Monto DECIMAL(10,2) NOT NULL,
    MontoPropina DECIMAL(10,2) DEFAULT 0.00,
    MetodoPago ENUM('Efectivo','Tarjeta','QR','Otro') NOT NULL,
    Fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (PedidoId) REFERENCES Pedidos(Id) ON DELETE RESTRICT,
    INDEX idx_fecha (Fecha),
    INDEX idx_metodo (MetodoPago),
    CONSTRAINT chk_pagos_montos_nonneg CHECK (Monto >= 0 AND MontoPropina >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLA: Facturas
-- =====================================================
CREATE TABLE Facturas (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    PagoId INT NOT NULL,
    NumeroFactura VARCHAR(50) UNIQUE NOT NULL,
    NitCliente VARCHAR(50),
    NombreCliente VARCHAR(150),
    Subtotal DECIMAL(10,2) NOT NULL,
    Propina DECIMAL(10,2) DEFAULT 0.00,
    Total DECIMAL(10,2) NOT NULL,
    ArchivoUrl VARCHAR(255),
    FechaEmision DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (PagoId) REFERENCES Pagos(Id) ON DELETE RESTRICT,
    INDEX idx_numero (NumeroFactura),
    INDEX idx_fecha (FechaEmision),
    CONSTRAINT chk_facturas_totales_nonneg CHECK (Subtotal >= 0 AND Propina >= 0 AND Total >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLA: UsuariosFCM
-- =====================================================
CREATE TABLE UsuariosFCM (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    UsuarioId INT NOT NULL,
    FcmToken VARCHAR(255) NOT NULL,
    FechaRegistro DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (UsuarioId) REFERENCES Usuarios(Id) ON DELETE CASCADE,
    UNIQUE KEY unique_usuario_token (UsuarioId, FcmToken)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- MÓDULO DE INVENTARIO - TABLAS (con CORRECCIONES aplicadas)
-- =====================================================

-- =====================================================
-- TABLA: Categorías de Inventario
-- =====================================================
CREATE TABLE CategoriasInventario (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    Nombre VARCHAR(100) NOT NULL UNIQUE,
    Descripcion TEXT,
    Tipo ENUM('Ingrediente','Bebida','MaterialLimpieza','ProductoTerminado','Otro') NOT NULL,
    Color VARCHAR(20) DEFAULT '#3b82f6',
    Activo BOOLEAN DEFAULT TRUE,
    FechaCreacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tipo (Tipo),
    INDEX idx_activo (Activo),
    INDEX idx_nombre (Nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLA: Proveedores  (CORRECCIÓN 1 aplicada)
-- =====================================================
CREATE TABLE Proveedores (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    Nombre VARCHAR(150) NOT NULL,
    Contacto VARCHAR(100),
    Telefono VARCHAR(20),
    Email VARCHAR(100),
    Direccion TEXT,
    NIT VARCHAR(50),
    Ciudad VARCHAR(100),
    Pais VARCHAR(100) DEFAULT 'Colombia',
    NotasAdicionales TEXT,
    TipoProductos VARCHAR(200),          -- nueva columna
    Activo BOOLEAN DEFAULT TRUE,
    FechaRegistro DATETIME DEFAULT CURRENT_TIMESTAMP, -- renombrada FechaCreacion -> FechaRegistro
    INDEX idx_nombre (Nombre),
    INDEX idx_activo (Activo),
    INDEX idx_nit (NIT)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLA: Productos de Inventario (CORRECCIÓN 2: UnidadMedida VARCHAR)
-- =====================================================
CREATE TABLE ProductosInventario (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    Codigo VARCHAR(50) UNIQUE,
    Nombre VARCHAR(150) NOT NULL,
    Descripcion TEXT,
    CategoriaId INT NOT NULL,
    ProveedorId INT,
    UnidadMedida VARCHAR(20) NOT NULL,  -- ahora VARCHAR en lugar de ENUM
    PrecioCosto DECIMAL(10,2) NOT NULL,
    StockMinimo DECIMAL(10,2) NOT NULL DEFAULT 0,
    StockMaximo DECIMAL(10,2),
    PuntoReorden DECIMAL(10,2),
    RequiereCaducidad BOOLEAN DEFAULT FALSE,
    DiasVencimiento INT,
    CodigoBarras VARCHAR(50),
    ImagenUrl LONGTEXT,
    Activo BOOLEAN DEFAULT TRUE,
    FechaCreacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    FechaActualizacion DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (CategoriaId) REFERENCES CategoriasInventario(Id) ON DELETE RESTRICT,
    FOREIGN KEY (ProveedorId) REFERENCES Proveedores(Id) ON DELETE SET NULL,
    INDEX idx_categoria (CategoriaId),
    INDEX idx_proveedor (ProveedorId),
    INDEX idx_codigo (Codigo),
    INDEX idx_codigo_barras (CodigoBarras),
    INDEX idx_activo (Activo),
    INDEX idx_nombre (Nombre),
    CONSTRAINT chk_productos_precio_nonneg CHECK (PrecioCosto >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLA: Almacenes/Bodegas
-- =====================================================
CREATE TABLE Almacenes (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    Codigo VARCHAR(20) UNIQUE NOT NULL,
    Nombre VARCHAR(100) NOT NULL UNIQUE,
    Descripcion TEXT,
    Ubicacion VARCHAR(150),
    Tipo ENUM('Principal','Secundario','Cocina','Bar','Refrigerado','Congelado') DEFAULT 'Principal',
    ResponsableId INT,
    CapacidadMaxima DECIMAL(10,2),
    Activo BOOLEAN DEFAULT TRUE,
    FechaCreacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ResponsableId) REFERENCES Usuarios(Id) ON DELETE SET NULL,
    INDEX idx_codigo (Codigo),
    INDEX idx_nombre (Nombre),
    INDEX idx_tipo (Tipo),
    INDEX idx_activo (Activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLA: Stock por Almacén (CORRECCIÓN 3: FechaActualizacion)
-- =====================================================
CREATE TABLE Stock (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    ProductoId INT NOT NULL,
    AlmacenId INT NOT NULL,
    Cantidad DECIMAL(10,2) NOT NULL DEFAULT 0,
    CostoPromedio DECIMAL(10,2) NOT NULL DEFAULT 0,
    CostoTotal DECIMAL(10,2) GENERATED ALWAYS AS (Cantidad * CostoPromedio) STORED,
    FechaActualizacion DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (ProductoId) REFERENCES ProductosInventario(Id) ON DELETE CASCADE,
    FOREIGN KEY (AlmacenId) REFERENCES Almacenes(Id) ON DELETE CASCADE,
    UNIQUE KEY unique_producto_almacen (ProductoId, AlmacenId),
    INDEX idx_producto (ProductoId),
    INDEX idx_almacen (AlmacenId),
    INDEX idx_cantidad (Cantidad),
    CONSTRAINT chk_stock_cantidad_nonneg CHECK (Cantidad >= 0),
    CONSTRAINT chk_stock_costopromedio_nonneg CHECK (CostoPromedio >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLA: Lotes (CORRECCIÓN 5: PrecioCosto -> CostoUnitario, se quitaron Proveedor y NotasCalidad)
-- =====================================================
CREATE TABLE Lotes (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    ProductoId INT NOT NULL,
    AlmacenId INT NOT NULL,
    NumeroLote VARCHAR(50) NOT NULL,
    FechaIngreso DATE NOT NULL,
    FechaVencimiento DATE,
    CantidadInicial DECIMAL(10,2) NOT NULL,
    CantidadActual DECIMAL(10,2) NOT NULL,
    CostoUnitario DECIMAL(10,2) NOT NULL, -- antes PrecioCosto
    Estado ENUM('Activo','Vencido','Agotado') DEFAULT 'Activo',
    FechaCreacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ProductoId) REFERENCES ProductosInventario(Id) ON DELETE CASCADE,
    FOREIGN KEY (AlmacenId) REFERENCES Almacenes(Id) ON DELETE CASCADE,
    INDEX idx_vencimiento (FechaVencimiento),
    INDEX idx_producto (ProductoId),
    INDEX idx_almacen (AlmacenId),
    INDEX idx_estado (Estado),
    INDEX idx_numero_lote (NumeroLote),
    CONSTRAINT chk_lotes_cantidades_nonneg CHECK (CantidadInicial >= 0 AND CantidadActual >= 0 AND CostoUnitario >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLA: Movimientos de Inventario (CORRECCIÓN 4: AlmacenOrigenId -> AlmacenId, se eliminó AlmacenDestinoId)
-- =====================================================
CREATE TABLE MovimientosInventario (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    TipoMovimiento ENUM('Entrada','Salida','Ajuste','Transferencia','Merma','Devolucion','ConsumoProduccion') NOT NULL,
    ProductoId INT NOT NULL,
    AlmacenId INT NOT NULL, -- antes AlmacenOrigenId
    Cantidad DECIMAL(10,2) NOT NULL,
    CostoUnitario DECIMAL(10,2),
    CostoTotal DECIMAL(10,2) GENERATED ALWAYS AS (Cantidad * IFNULL(CostoUnitario, 0)) STORED,
    LoteId INT,
    UsuarioId INT NOT NULL,
    Motivo TEXT,
    Referencia VARCHAR(100),
    DocumentoUrl VARCHAR(255),
    Fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ProductoId) REFERENCES ProductosInventario(Id) ON DELETE RESTRICT,
    FOREIGN KEY (AlmacenId) REFERENCES Almacenes(Id) ON DELETE RESTRICT,
    FOREIGN KEY (UsuarioId) REFERENCES Usuarios(Id) ON DELETE RESTRICT,
    FOREIGN KEY (LoteId) REFERENCES Lotes(Id) ON DELETE SET NULL,
    INDEX idx_fecha (Fecha),
    INDEX idx_tipo (TipoMovimiento),
    INDEX idx_producto (ProductoId),
    INDEX idx_almacen (AlmacenId),
    INDEX idx_usuario (UsuarioId),
    INDEX idx_referencia (Referencia),
    CONSTRAINT chk_movimientos_cantidad_nonneg CHECK (Cantidad >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLA: Recetas (Relación Platillo-Ingredientes)
-- =====================================================
CREATE TABLE Recetas (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    PlatilloId INT NOT NULL,
    ProductoId INT NOT NULL,
    CantidadRequerida DECIMAL(10,2) NOT NULL,
    UnidadMedida VARCHAR(20) NOT NULL,
    CostoUnitario DECIMAL(10,2) NULL,
    Opcional BOOLEAN DEFAULT FALSE,
    Notas VARCHAR(500) NULL,
    FechaCreacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (PlatilloId) REFERENCES Platillos(Id) ON DELETE CASCADE,
    FOREIGN KEY (ProductoId) REFERENCES ProductosInventario(Id) ON DELETE RESTRICT,
    INDEX idx_platillo (PlatilloId),
    INDEX idx_producto (ProductoId),
    CONSTRAINT chk_recetas_cantidad_nonneg CHECK (CantidadRequerida >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLA: Alertas de Inventario
-- =====================================================
CREATE TABLE AlertasInventario (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    TipoAlerta ENUM('StockBajo','StockCritico','Vencimiento','Vencido','StockExcedido') NOT NULL,
    ProductoId INT NOT NULL,
    AlmacenId INT,
    LoteId INT,
    Mensaje TEXT NOT NULL,
    Nivel ENUM('Info','Advertencia','Critico') DEFAULT 'Info',
    Leida BOOLEAN DEFAULT FALSE,
    FechaGeneracion DATETIME DEFAULT CURRENT_TIMESTAMP,
    FechaLeida DATETIME,
    FOREIGN KEY (ProductoId) REFERENCES ProductosInventario(Id) ON DELETE CASCADE,
    FOREIGN KEY (AlmacenId) REFERENCES Almacenes(Id) ON DELETE CASCADE,
    FOREIGN KEY (LoteId) REFERENCES Lotes(Id) ON DELETE CASCADE,
    INDEX idx_tipo (TipoAlerta),
    INDEX idx_producto (ProductoId),
    INDEX idx_leida (Leida),
    INDEX idx_nivel (Nivel),
    INDEX idx_fecha (FechaGeneracion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLA: Órdenes de Compra
-- =====================================================
CREATE TABLE OrdenesCompra (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    NumeroOrden VARCHAR(50) UNIQUE NOT NULL,
    ProveedorId INT NOT NULL,
    AlmacenDestinoId INT NOT NULL,
    UsuarioCreadorId INT NOT NULL,
    FechaOrden DATE NOT NULL,
    FechaEntregaEstimada DATE,
    FechaEntregaReal DATE,
    Estado ENUM('Pendiente','Aprobada','EnTransito','Recibida','Cancelada') DEFAULT 'Pendiente',
    Subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    Impuestos DECIMAL(10,2) DEFAULT 0,
    Total DECIMAL(10,2) NOT NULL DEFAULT 0,
    Notas TEXT,
    FechaCreacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    FechaActualizacion DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (ProveedorId) REFERENCES Proveedores(Id) ON DELETE RESTRICT,
    FOREIGN KEY (AlmacenDestinoId) REFERENCES Almacenes(Id) ON DELETE RESTRICT,
    FOREIGN KEY (UsuarioCreadorId) REFERENCES Usuarios(Id) ON DELETE RESTRICT,
    INDEX idx_numero (NumeroOrden),
    INDEX idx_proveedor (ProveedorId),
    INDEX idx_estado (Estado),
    INDEX idx_fecha_orden (FechaOrden),
    CONSTRAINT chk_ordenes_totales_nonneg CHECK (Subtotal >= 0 AND Impuestos >= 0 AND Total >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLA: Detalles de Órdenes de Compra
-- =====================================================
CREATE TABLE DetallesOrdenCompra (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    OrdenCompraId INT NOT NULL,
    ProductoId INT NOT NULL,
    Cantidad DECIMAL(10,2) NOT NULL,
    PrecioUnitario DECIMAL(10,2) NOT NULL,
    Subtotal DECIMAL(10,2) GENERATED ALWAYS AS (Cantidad * PrecioUnitario) STORED,
    CantidadRecibida DECIMAL(10,2) DEFAULT 0,
    FOREIGN KEY (OrdenCompraId) REFERENCES OrdenesCompra(Id) ON DELETE CASCADE,
    FOREIGN KEY (ProductoId) REFERENCES ProductosInventario(Id) ON DELETE RESTRICT,
    INDEX idx_orden (OrdenCompraId),
    INDEX idx_producto (ProductoId),
    CONSTRAINT chk_detalleorden_cant_nonneg CHECK (Cantidad >= 0 AND PrecioUnitario >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- VISTAS
-- =====================================================
CREATE VIEW vw_stock_general AS
SELECT 
    p.Id AS ProductoId,
    p.Codigo,
    p.Nombre AS ProductoNombre,
    c.Nombre AS Categoria,
    p.UnidadMedida,
    COALESCE(SUM(s.Cantidad), 0) AS StockTotal,
    p.StockMinimo,
    p.StockMaximo,
    p.PuntoReorden,
    COALESCE(SUM(s.CostoTotal), 0) AS ValorInventario,
    CASE 
        WHEN COALESCE(SUM(s.Cantidad), 0) = 0 THEN 'Agotado'
        WHEN COALESCE(SUM(s.Cantidad), 0) <= p.StockMinimo THEN 'Critico'
        WHEN COALESCE(SUM(s.Cantidad), 0) <= p.PuntoReorden THEN 'Bajo'
        WHEN p.StockMaximo IS NOT NULL AND COALESCE(SUM(s.Cantidad), 0) >= p.StockMaximo THEN 'Excedido'
        ELSE 'Normal'
    END AS EstadoStock,
    p.Activo
FROM ProductosInventario p
LEFT JOIN Stock s ON p.Id = s.ProductoId
LEFT JOIN CategoriasInventario c ON p.CategoriaId = c.Id
WHERE p.Activo = TRUE
GROUP BY p.Id, p.Codigo, p.Nombre, c.Nombre, p.UnidadMedida, p.StockMinimo, p.StockMaximo, p.PuntoReorden, p.Activo;

CREATE VIEW vw_productos_vencimiento AS
SELECT 
    l.Id AS LoteId,
    l.NumeroLote,
    p.Id AS ProductoId,
    p.Nombre AS ProductoNombre,
    a.Nombre AS Almacen,
    l.CantidadActual,
    p.UnidadMedida,
    l.FechaVencimiento,
    DATEDIFF(l.FechaVencimiento, CURDATE()) AS DiasParaVencer,
    CASE 
        WHEN l.FechaVencimiento < CURDATE() THEN 'Vencido'
        WHEN DATEDIFF(l.FechaVencimiento, CURDATE()) <= 3 THEN 'Critico'
        WHEN DATEDIFF(l.FechaVencimiento, CURDATE()) <= 7 THEN 'Advertencia'
        ELSE 'Normal'
    END AS NivelAlerta
FROM Lotes l
INNER JOIN ProductosInventario p ON l.ProductoId = p.Id
INNER JOIN Almacenes a ON l.AlmacenId = a.Id
WHERE l.Estado = 'Activo' 
  AND l.CantidadActual > 0
  AND l.FechaVencimiento IS NOT NULL
ORDER BY l.FechaVencimiento ASC;

CREATE VIEW vw_valor_inventario_almacen AS
SELECT 
    a.Id AS AlmacenId,
    a.Codigo,
    a.Nombre AS Almacen,
    a.Tipo,
    COUNT(DISTINCT s.ProductoId) AS TotalProductos,
    SUM(s.Cantidad) AS CantidadTotal,
    SUM(s.CostoTotal) AS ValorTotal
FROM Almacenes a
LEFT JOIN Stock s ON a.Id = s.AlmacenId
WHERE a.Activo = TRUE
GROUP BY a.Id, a.Codigo, a.Nombre, a.Tipo;

-- =====================================================
-- DATOS INICIALES
-- (ajustados para las columnas nuevas)
-- =====================================================

-- Usuarios (usa ClaveHash simulada — recuerda reemplazar con hashes reales en producción)
INSERT INTO Usuarios (Nombre, Usuario, ClaveHash, Rol) VALUES
('Admin Principal', 'admin', '::bcrypt-hash-placeholder-60-chars::', 'Administrador'),
('Juan Pérez', 'juan.mesero', '::bcrypt-hash-placeholder-60-chars::', 'Mesero'),
('María García', 'maria.mesero', '::bcrypt-hash-placeholder-60-chars::', 'Mesero'),
('Carlos López', 'carlos.cocina', '::bcrypt-hash-placeholder-60-chars::', 'Cocina'),
('Ana Martínez', 'ana.cocina', '::bcrypt-hash-placeholder-60-chars::', 'Cocina'),
('Pedro Rodríguez', 'pedro.caja', '::bcrypt-hash-placeholder-60-chars::', 'Caja'),
('Laura Fernández', 'laura.caja', '::bcrypt-hash-placeholder-60-chars::', 'Caja');

-- Mesas
INSERT INTO Mesas (Numero, Estado) VALUES
(1, 'Disponible'),
(2, 'Ocupada'),
(3, 'Ocupada'),
(4, 'Disponible'),
(5, 'EsperandoPago'),
(6, 'Disponible'),
(7, 'Ocupada'),
(8, 'Disponible'),
(9, 'Disponible'),
(10, 'Disponible'),
(11, 'Disponible'),
(12, 'Disponible');

-- CategoriasInventario
INSERT INTO CategoriasInventario (Nombre, Descripcion, Tipo, Color) VALUES
('Carnes Rojas', 'Res, cerdo, cordero', 'Ingrediente', '#ef4444'),
('Carnes Blancas', 'Pollo, pavo, conejo', 'Ingrediente', '#f59e0b'),
('Pescados y Mariscos', 'Pescados frescos y mariscos', 'Ingrediente', '#3b82f6'),
('Verduras Frescas', 'Verduras y hortalizas', 'Ingrediente', '#10b981'),
('Frutas', 'Frutas frescas y procesadas', 'Ingrediente', '#ec4899'),
('Lácteos', 'Leche, quesos, yogurt', 'Ingrediente', '#f3f4f6'),
('Granos y Cereales', 'Arroz, pasta, harinas', 'Ingrediente', '#92400e'),
('Condimentos y Especias', 'Sal, pimienta, hierbas', 'Ingrediente', '#7c3aed'),
('Aceites y Grasas', 'Aceites vegetales, mantequilla', 'Ingrediente', '#fbbf24'),
('Bebidas Alcohólicas', 'Cervezas, vinos, licores', 'Bebida', '#dc2626'),
('Bebidas No Alcohólicas', 'Refrescos, jugos, agua', 'Bebida', '#06b6d4'),
('Café y Té', 'Café, té, infusiones', 'Bebida', '#78350f'),
('Productos de Limpieza', 'Detergentes, desinfectantes', 'MaterialLimpieza', '#8b5cf6'),
('Material Desechable', 'Platos, vasos, cubiertos desechables', 'MaterialLimpieza', '#6b7280'),
('Panadería', 'Panes, tortillas, masa', 'Ingrediente', '#d97706'),
('Conservas', 'Productos enlatados o en conserva', 'Ingrediente', '#059669');

-- Proveedores (con nueva columna TipoProductos en blanco inicialmente)
INSERT INTO Proveedores (Nombre, Contacto, Telefono, Email, NIT, Ciudad, Direccion, TipoProductos) VALUES
('Distribuidora de Carnes La Finca', 'Juan Pérez', '3001234567', 'ventas@lafinca.com', '900123456-1', 'Bogotá', 'Calle 50 #25-30', NULL),
('Verduras Frescas del Valle', 'María García', '3107654321', 'info@verdurasdelvalle.com', '900234567-2', 'Cali', 'Carrera 10 #15-20', NULL),
('Bebidas Premium Ltda', 'Carlos López', '3159876543', 'pedidos@bebidaspremium.com', '900345678-3', 'Medellín', 'Avenida 80 #40-50', NULL),
('Lácteos del Norte', 'Ana Martínez', '3201239876', 'contacto@lacteosdelNorte.com', '900456789-4', 'Barranquilla', 'Calle 72 #54-20', NULL),
('Pescados y Mariscos del Pacífico', 'Roberto Sánchez', '3158887766', 'ventas@pescadospacifico.com', '900567890-5', 'Buenaventura', 'Zona Portuaria', NULL),
('Distribuidora de Granos El Trigal', 'Laura Ramírez', '3176665544', 'info@eltrigal.com', '900678901-6', 'Villavicencio', 'Carrera 40 #25-10', NULL),
('Productos de Limpieza Aseo Total', 'Diego Torres', '3143332211', 'ventas@aseototal.com', '900789012-7', 'Bogotá', 'Calle 13 #68-50', NULL),
('Panadería y Harinas La Espiga', 'Claudia Moreno', '3195554433', 'pedidos@laespiga.com', '900890123-8', 'Pereira', 'Avenida 30 de Agosto #12-20', NULL);

-- Almacenes
INSERT INTO Almacenes (Codigo, Nombre, Descripcion, Ubicacion, Tipo) VALUES
('ALM-001', 'Bodega Principal', 'Almacén general de productos secos', 'Planta Baja - Área de Bodega', 'Principal'),
('ALM-002', 'Cocina Principal', 'Área de preparación de alimentos', 'Planta Baja - Cocina', 'Cocina'),
('ALM-003', 'Refrigerador 1', 'Cámara fría para productos perecederos', 'Planta Baja - Área Fría', 'Refrigerado'),
('ALM-004', 'Congelador 1', 'Cámara de congelación', 'Planta Baja - Área Fría', 'Congelado'),
('ALM-005', 'Bar', 'Área de bebidas y licores', 'Planta 1 - Bar', 'Bar'),
('ALM-006', 'Bodega Secundaria', 'Almacén de respaldo', 'Planta Baja - Bodega Auxiliar', 'Secundario');

-- ProductosInventario (ejemplos) - mantenidos, ajustados para nuevo esquema
INSERT INTO ProductosInventario (Codigo, Nombre, Descripcion, CategoriaId, ProveedorId, UnidadMedida, PrecioCosto, StockMinimo, StockMaximo, PuntoReorden, RequiereCaducidad, DiasVencimiento, ImagenUrl) VALUES
('PROD-001', 'Lomo de Res Premium', 'Corte de res de primera calidad', 1, 1, 'Kg', 28000.00, 10, 50, 15, TRUE, 5, 'https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=400'),
('PROD-002', 'Pechuga de Pollo', 'Pechuga deshuesada sin piel', 2, 1, 'Kg', 12000.00, 15, 60, 20, TRUE, 4, 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=400'),
('PROD-003', 'Chuleta de Cerdo', 'Chuletas de cerdo frescas', 1, 1, 'Kg', 15000.00, 8, 40, 12, TRUE, 5, 'https://images.unsplash.com/photo-1602470520998-f4a52199a3d6?w=400'),
('PROD-004', 'Salmón Fresco', 'Filete de salmón del Atlántico', 3, 5, 'Kg', 35000.00, 5, 20, 8, TRUE, 3, 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400'),
('PROD-005', 'Camarones Jumbo', 'Camarones grandes pelados', 3, 5, 'Kg', 42000.00, 3, 15, 5, TRUE, 2, 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=400'),
('PROD-006', 'Tomate Chonto', 'Tomate fresco de primera', 4, 2, 'Kg', 3500.00, 20, 100, 30, TRUE, 7, 'https://images.unsplash.com/photo-1546094096-0df4bcaaa337?w=400'),
('PROD-007', 'Cebolla Cabezona', 'Cebolla blanca fresca', 4, 2, 'Kg', 2800.00, 15, 80, 25, TRUE, 14, 'https://images.unsplash.com/photo-1508747703725-719777637510?w=400'),
('PROD-008', 'Lechuga Romana', 'Lechuga fresca hidropónica', 4, 2, 'Unidad', 2500.00, 10, 50, 15, TRUE, 5, 'https://images.unsplash.com/photo-1556801712-76c8eb07bbc9?w=400'),
('PROD-009', 'Papa Criolla', 'Papa criolla amarilla', 4, 2, 'Kg', 4200.00, 25, 120, 40, FALSE, NULL, 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400'),
('PROD-010', 'Queso Mozzarella', 'Queso mozzarella para pizza', 6, 4, 'Kg', 18000.00, 5, 30, 10, TRUE, 30, 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=400'),
('PROD-011', 'Leche Entera', 'Leche entera pasteurizada', 6, 4, 'Litro', 3200.00, 10, 50, 15, TRUE, 7, 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400'),
('PROD-012', 'Mantequilla', 'Mantequilla sin sal', 6, 4, 'Kg', 14000.00, 3, 20, 5, TRUE, 60, 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=400'),
('PROD-013', 'Arroz Blanco', 'Arroz de primera calidad', 7, 6, 'Kg', 3000.00, 50, 200, 75, FALSE, NULL, 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400'),
('PROD-014', 'Pasta Spaghetti', 'Pasta italiana importada', 7, 6, 'Paquete', 5000.00, 20, 100, 30, FALSE, NULL, 'https://images.unsplash.com/photo-1551462147-ff29053bfc14?w=400'),
('PROD-015', 'Harina de Trigo', 'Harina todo uso', 7, 8, 'Kg', 2800.00, 30, 150, 50, FALSE, NULL, 'https://images.unsplash.com/photo-1628958180577-5a5a8f0d2f8e?w=400'),
('PROD-016', 'Aceite de Oliva Extra Virgen', 'Aceite de oliva primera prensada', 9, 3, 'Litro', 35000.00, 5, 25, 10, FALSE, NULL, 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400'),
('PROD-017', 'Aceite Vegetal', 'Aceite vegetal para cocina', 9, 3, 'Litro', 8000.00, 10, 50, 15, FALSE, NULL, 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400'),
('PROD-018', 'Sal de Mar', 'Sal marina refinada', 8, 6, 'Kg', 2000.00, 5, 30, 10, FALSE, NULL, 'https://images.unsplash.com/photo-1598666065762-85dc528922d1?w=400'),
('PROD-019', 'Pimienta Negra Molida', 'Pimienta negra recién molida', 8, 6, 'Kg', 18000.00, 2, 10, 4, FALSE, NULL, 'https://images.unsplash.com/photo-1599909533248-5d5a9f5ba1f5?w=400'),
('PROD-020', 'Ajo en Pasta', 'Ajo procesado y envasado', 8, 2, 'Kg', 12000.00, 3, 15, 5, TRUE, 90, 'https://images.unsplash.com/photo-1580910365203-91ea527ff1dd?w=400'),
('PROD-021', 'Cerveza Nacional Lata 355ml', 'Cerveza nacional lata', 10, 3, 'Unidad', 2000.00, 50, 300, 100, FALSE, NULL, 'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=400'),
('PROD-022', 'Vino Tinto Reserva', 'Vino tinto reserva chileno', 10, 3, 'Botella', 35000.00, 10, 50, 15, FALSE, NULL, 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=400'),
('PROD-023', 'Coca Cola 1.5L', 'Gaseosa Coca Cola botella', 11, 3, 'Botella', 3500.00, 30, 150, 50, FALSE, NULL, 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400'),
('PROD-024', 'Agua Mineral Sin Gas 600ml', 'Agua embotellada', 11, 3, 'Botella', 1200.00, 40, 200, 70, FALSE, NULL, 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400'),
('PROD-025', 'Detergente Industrial', 'Detergente para loza industrial', 13, 7, 'Litro', 12000.00, 5, 30, 10, FALSE, NULL, 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400'),
('PROD-026', 'Desinfectante Multiusos', 'Desinfectante bactericida', 13, 7, 'Litro', 15000.00, 8, 40, 12, FALSE, NULL, 'https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?w=400'),
('PROD-027', 'Platos Desechables 10"', 'Platos biodegradables', 14, 7, 'Paquete', 8000.00, 10, 50, 15, FALSE, NULL, NULL),
('PROD-028', 'Vasos Desechables 16oz', 'Vasos para bebidas frías', 14, 7, 'Paquete', 6000.00, 15, 60, 20, FALSE, NULL, NULL),
('PROD-029', 'Servilletas de Papel', 'Servilletas blancas', 14, 7, 'Paquete', 4000.00, 20, 80, 30, FALSE, NULL, NULL);

-- Stock inicial
INSERT INTO Stock (ProductoId, AlmacenId, Cantidad, CostoPromedio) VALUES
(13, 1, 150, 3000), -- Arroz
(14, 1, 80, 5000),  -- Pasta
(15, 1, 100, 2800), -- Harina
(18, 1, 20, 2000),  -- Sal
(19, 1, 8, 18000),  -- Pimienta
(1, 2, 15, 28000),
(2, 2, 25, 12000),
(6, 2, 30, 3500),
(7, 2, 20, 2800),
(9, 2, 40, 4200),
(4, 3, 8, 35000),
(5, 3, 5, 42000),
(8, 3, 25, 2500),
(10, 3, 12, 18000),
(11, 3, 30, 3200),
(3, 4, 20, 15000),
(21, 5, 120, 2000),
(22, 5, 24, 35000),
(23, 5, 80, 3500),
(24, 5, 100, 1200);

-- Ejemplo de lotes iniciales (para que FIFO tenga datos)
INSERT INTO Lotes (ProductoId, AlmacenId, NumeroLote, FechaIngreso, FechaVencimiento, CantidadInicial, CantidadActual, CostoUnitario)
VALUES
(1, 2, 'L-LOMO-001', CURDATE()-INTERVAL 5 DAY, CURDATE()+INTERVAL 5 DAY, 20, 20, 28000),
(2, 2, 'L-PECH-001', CURDATE()-INTERVAL 4 DAY, CURDATE()+INTERVAL 4 DAY, 30, 30, 12000),
(6, 2, 'L-TOM-001', CURDATE()-INTERVAL 2 DAY, CURDATE()+INTERVAL 7 DAY, 40, 40, 3500);

-- =====================================================
-- ACTUALIZACIÓN DE PROVEEDORES: CORRECCIÓN 6
-- =====================================================
UPDATE Proveedores SET TipoProductos = 
CASE 
    WHEN Id = 1 THEN 'Carnes y derivados'
    WHEN Id = 2 THEN 'Verduras y hortalizas'
    WHEN Id = 3 THEN 'Bebidas alcohólicas y no alcohólicas'
    WHEN Id = 4 THEN 'Productos lácteos'
    WHEN Id = 5 THEN 'Pescados y mariscos'
    WHEN Id = 6 THEN 'Granos y cereales'
    WHEN Id = 7 THEN 'Productos de limpieza'
    WHEN Id = 8 THEN 'Panadería y harinas'
END
WHERE Id BETWEEN 1 AND 8;

-- =====================================================
-- INDICES ADICIONALES Y FULLTEXT (opcional)
-- =====================================================
ALTER TABLE Pedidos ADD INDEX IF NOT EXISTS idx_estado_fecha (Estado, Fecha);
ALTER TABLE MovimientosInventario ADD INDEX IF NOT EXISTS idx_producto_fecha (ProductoId, Fecha);
ALTER TABLE ProductosInventario ADD FULLTEXT INDEX IF NOT EXISTS ft_descripcion (Nombre, Descripcion);
ALTER TABLE Platillos ADD FULLTEXT INDEX IF NOT EXISTS ft_platillo_descripcion (Nombre, Descripcion);

-- Nota: MySQL no soporta "IF NOT EXISTS" en ALTER INDEX en algunas versiones; ejecútalo si tu versión lo permite o ignora el error si ya existe.

-- =====================================================
-- PROCEDIMIENTOS ALMACENADOS Y TRIGGERS
-- =====================================================

DELIMITER $$

-- ======================================================================================
-- PROCEDIMIENTO: sp_procesar_pago
--  - Inserta Pago, Factura, marca Pedido como Pagado y libera la Mesa.
--  - Validaciones básicas incluidas.
-- ======================================================================================
CREATE PROCEDURE sp_procesar_pago(
  IN p_pedidoId INT,
  IN p_monto DECIMAL(10,2),
  IN p_montoPropina DECIMAL(10,2),
  IN p_metodo VARCHAR(20),
  IN p_numeroFactura VARCHAR(50),
  IN p_nitCliente VARCHAR(50),
  IN p_nombreCliente VARCHAR(150),
  IN p_archivoUrl VARCHAR(255)
)
BEGIN
  DECLARE v_subtotal DECIMAL(10,2);
  DECLARE v_total_esperado DECIMAL(10,2);

  -- Calcular subtotal desde PedidoDetalles x Platillos
  SELECT COALESCE(SUM(pd.Cantidad * pl.Precio),0) INTO v_subtotal
  FROM PedidoDetalles pd
  JOIN Platillos pl ON pd.PlatilloId = pl.Id
  WHERE pd.PedidoId = p_pedidoId AND pd.Estado <> 'Cancelado';

  SET v_total_esperado = v_subtotal + p_montoPropina;

  IF p_monto < v_subtotal THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Monto pagado menor que el subtotal.';
  END IF;

  START TRANSACTION;

  INSERT INTO Pagos (PedidoId, Monto, MontoPropina, MetodoPago)
  VALUES (p_pedidoId, p_monto, p_montoPropina, p_metodo);
  SET @lastPagoId = LAST_INSERT_ID();

  INSERT INTO Facturas (PagoId, NumeroFactura, NitCliente, NombreCliente, Subtotal, Propina, Total, ArchivoUrl)
  VALUES (@lastPagoId, p_numeroFactura, p_nitCliente, p_nombreCliente, v_subtotal, p_montoPropina, p_monto + p_montoPropina, p_archivoUrl);

  UPDATE Pedidos SET Estado = 'Pagado' WHERE Id = p_pedidoId;

  -- Liberar mesa asociada al pedido
  UPDATE Mesas m
  JOIN Pedidos ped ON ped.MesaId = m.Id
  SET m.Estado = 'Disponible'
  WHERE ped.Id = p_pedidoId;

  COMMIT;
END$$

-- ======================================================================================
-- PROCEDIMIENTO: sp_consumir_ingredientes_fifo
--  - Consume inventario por receta de un platillo
--  - Usa Lotes FIFO por FechaVencimiento (más antiguos primero)
--  - Actualiza Lotes.CantidadActual, Stock.Cantidad, inserta MovimientosInventario
--  - Param: p_platilloId, p_cantidadPlatillo, p_usuarioId, p_referencia
-- ======================================================================================
CREATE PROCEDURE sp_consumir_ingredientes_fifo(
  IN p_platilloId INT,
  IN p_cantidadPlatillo INT,
  IN p_usuarioId INT,
  IN p_referencia VARCHAR(100)
)
BEGIN
  DECLARE done INT DEFAULT 0;
  DECLARE v_productoId INT;
  DECLARE v_cantRequerida DECIMAL(10,2);
  DECLARE v_totalNecesaria DECIMAL(10,2);
  DECLARE v_loteId INT;
  DECLARE v_loteCant DECIMAL(10,2);
  DECLARE v_consumir DECIMAL(10,2);

  -- Cursor sobre ingredientes de la receta
  DECLARE cur_recetas CURSOR FOR 
    SELECT ProductoId, CantidadRequerida FROM Recetas WHERE PlatilloId = p_platilloId;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

  START TRANSACTION;

  OPEN cur_recetas;
  recetas_loop: LOOP
    FETCH cur_recetas INTO v_productoId, v_cantRequerida;
    IF done THEN
      LEAVE recetas_loop;
    END IF;

    SET v_totalNecesaria = v_cantRequerida * p_cantidadPlatillo;

    IF v_totalNecesaria <= 0 THEN
      ITERATE recetas_loop;
    END IF;

    -- Mientras quede cantidad por consumir, tomar lotes FIFO
    WHILE v_totalNecesaria > 0 DO
      -- Tomamos el primer lote activo con CantidadActual > 0 ordenado por FechaVencimiento asc
      SELECT Id, CantidadActual 
      INTO v_loteId, v_loteCant
      FROM Lotes
      WHERE ProductoId = v_productoId AND CantidadActual > 0 AND Estado = 'Activo' 
      ORDER BY COALESCE(FechaVencimiento, '9999-12-31') ASC, FechaIngreso ASC
      LIMIT 1;

      IF v_loteId IS NULL OR v_loteCant IS NULL THEN
        -- No hay lotes suficientes: generar alerta y salir del bucle para este producto
        INSERT INTO AlertasInventario (TipoAlerta, ProductoId, AlmacenId, LoteId, Mensaje, Nivel)
        VALUES ('StockBajo', v_productoId, NULL, NULL, CONCAT('Stock insuficiente para platillo ', p_platilloId), 'Critico');
        LEAVE recetas_loop; -- salimos a la siguiente receta
      END IF;

      SET v_consumir = LEAST(v_totalNecesaria, v_loteCant);

      -- Actualizar Lotes
      UPDATE Lotes
      SET CantidadActual = CantidadActual - v_consumir,
          Estado = CASE WHEN CantidadActual - v_consumir <= 0 THEN 'Agotado' ELSE Estado END
      WHERE Id = v_loteId;

      -- Actualizar Stock (buscar stock del producto en ese almacén)
      UPDATE Stock
      SET Cantidad = Cantidad - v_consumir
      WHERE ProductoId = v_productoId
        AND AlmacenId = (SELECT AlmacenId FROM Lotes WHERE Id = v_loteId LIMIT 1)
      LIMIT 1;

      -- Insertar movimiento de salida por consumo de producción
      INSERT INTO MovimientosInventario (TipoMovimiento, ProductoId, AlmacenId, Cantidad, CostoUnitario, LoteId, UsuarioId, Motivo, Referencia)
      VALUES ('ConsumoProduccion', v_productoId, (SELECT AlmacenId FROM Lotes WHERE Id = v_loteId LIMIT 1), v_consumir, (SELECT CostoUnitario FROM Lotes WHERE Id = v_loteId LIMIT 1), v_loteId, p_usuarioId, CONCAT('Consumo por platillo ', p_platilloId), p_referencia);

      SET v_totalNecesaria = v_totalNecesaria - v_consumir;

    END WHILE; -- while v_totalNecesaria > 0

    -- Reinicializar variable done por si fue cambiada por handler (seguridad)
    SET done = 0;
  END LOOP;
  CLOSE cur_recetas;

  COMMIT;
END$$

-- ======================================================================================
-- PROCEDIMIENTO: sp_restaurar_stock_por_pedidodetalle
--  - Caso simplificado: busca MovimientosInventario con Referencia = 'PedidoDetalle-<Id>' y los revierte
--  - Este procedimiento asume que los consumos fueron registrados con Referencia 'PedidoDetalle-<Id>'
-- ======================================================================================
CREATE PROCEDURE sp_restaurar_stock_por_pedidodetalle(
  IN p_pedidodetalleId INT,
  IN p_usuarioId INT,
  IN p_referencia VARCHAR(100)
)
BEGIN
  DECLARE done2 INT DEFAULT 0;
  DECLARE v_movId INT;
  DECLARE v_productoId INT;
  DECLARE v_almacenId INT;
  DECLARE v_cantidad DECIMAL(10,2);
  DECLARE cur_mov CURSOR FOR
    SELECT Id, ProductoId, AlmacenId, Cantidad FROM MovimientosInventario WHERE Referencia = p_referencia;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done2 = 1;

  START TRANSACTION;

  OPEN cur_mov;
  mov_loop: LOOP
    FETCH cur_mov INTO v_movId, v_productoId, v_almacenId, v_cantidad;
    IF done2 THEN
      LEAVE mov_loop;
    END IF;

    -- Insertar movimiento inverso (Entrada) para restaurar stock
    INSERT INTO MovimientosInventario (TipoMovimiento, ProductoId, AlmacenId, Cantidad, CostoUnitario, LoteId, UsuarioId, Motivo, Referencia)
    VALUES ('Devolucion', v_productoId, v_almacenId, v_cantidad, NULL, NULL, p_usuarioId, CONCAT('Restauración por cancelación PedidoDetalle ', p_pedidodetalleId), p_referencia);

    -- Actualizar Stock sumando
    UPDATE Stock
    SET Cantidad = Cantidad + v_cantidad
    WHERE ProductoId = v_productoId AND AlmacenId = v_almacenId
    LIMIT 1;

    -- Intentar actualizar Lotes (reponer en el primer lote 'Agotado' o crear nota; simplificado)
    -- En implementación completa habría que llevar registro preciso del lote de origen y revertir CantidadActual
    UPDATE Lotes
    SET CantidadActual = CantidadActual + v_cantidad,
        Estado = 'Activo'
    WHERE ProductoId = v_productoId
      AND AlmacenId = v_almacenId
    ORDER BY FechaIngreso DESC
    LIMIT 1;

  END LOOP;
  CLOSE cur_mov;

  COMMIT;
END$$

-- ======================================================================================
-- TRIGGERS
-- ======================================================================================

-- Trigger: al crear Pedido -> marcar Mesa como Ocupada
CREATE TRIGGER trg_pedido_after_insert
AFTER INSERT ON Pedidos
FOR EACH ROW
BEGIN
  UPDATE Mesas SET Estado = 'Ocupada' WHERE Id = NEW.MesaId;
END$$

-- Trigger: cuando PedidoDetalle pasa a EnPreparacion -> consumir ingredientes vía SP
CREATE TRIGGER trg_pedidodetalle_after_update
AFTER UPDATE ON PedidoDetalles
FOR EACH ROW
BEGIN
  -- Si cambia a EnPreparacion desde otro estado
  IF NEW.Estado = 'EnPreparacion' AND OLD.Estado <> 'EnPreparacion' THEN
    -- Llamamos al procedimiento que consume inventario
    CALL sp_consumir_ingredientes_fifo(NEW.PlatilloId, NEW.Cantidad, NEW.PedidoId /*usuarioId placeholder*/, CONCAT('PedidoDetalle-', NEW.Id));
  END IF;
END$$

-- Trigger: si un PedidoDetalle se marca Cancelado AFTER haber sido en EnPreparacion/listo, intentar restaurar stock (usa referencia creada al consumir)
CREATE TRIGGER trg_pedidodetalle_after_update_restore
AFTER UPDATE ON PedidoDetalles
FOR EACH ROW
BEGIN
  IF NEW.Estado = 'Cancelado' AND OLD.Estado <> 'Cancelado' THEN
    -- Intentamos restaurar stock basado en movimientos previos con referencia 'PedidoDetalle-<Id>'
    CALL sp_restaurar_stock_por_pedidodetalle(NEW.Id, NEW.PedidoId /*usuarioId placeholder*/, CONCAT('PedidoDetalle-', NEW.Id));
  END IF;
END$$

-- Trigger: si Pedido cambia a Pagado -> liberar mesa (esto también lo hace sp_procesar_pago, pero lo incluimos por seguridad)
CREATE TRIGGER trg_pedido_after_update
AFTER UPDATE ON Pedidos
FOR EACH ROW
BEGIN
  IF NEW.Estado = 'Pagado' AND OLD.Estado <> 'Pagado' THEN
    UPDATE Mesas SET Estado = 'Disponible' WHERE Id = NEW.MesaId;
  END IF;
END$$

DELIMITER ;

-- =====================================================
-- SCRIPTS ADICIONALES / BUENAS PRÁCTICAS (EJEMPLOS)
-- =====================================================

-- Ejemplo de CHECK adicional: evitar insertar Pedidos con Mesa NULL
ALTER TABLE Pedidos ADD CONSTRAINT chk_pedidos_mesa_notnull CHECK (MesaId IS NOT NULL);

-- Auditoría simple (opcional): tabla para logs
CREATE TABLE IF NOT EXISTS AuditLog (
  Id INT AUTO_INCREMENT PRIMARY KEY,
  Tabla VARCHAR(100),
  Accion VARCHAR(50),
  RegistroId VARCHAR(100),
  UsuarioId INT,
  Detalle TEXT,
  Fecha DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Trigger ejemplo para auditar cambios en ProductosInventario (puedes replicar para otras tablas)
DELIMITER $$
CREATE TRIGGER trg_productosinventario_after_update
AFTER UPDATE ON ProductosInventario
FOR EACH ROW
BEGIN
  INSERT INTO AuditLog (Tabla, Accion, RegistroId, UsuarioId, Detalle)
  VALUES ('ProductosInventario', 'UPDATE', NEW.Id, NULL, CONCAT('Antes PrecioCosto=', OLD.PrecioCosto, '; Ahora PrecioCosto=', NEW.PrecioCosto));
END$$
DELIMITER ;

-- Verificar si el índice ya existe antes de crearlo
-- -----------------------corre esto ultimo para quitar el ultimo error que sale-----------------------------------------
SET @index_exists := (
    SELECT COUNT(*)
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE()
      AND table_name = 'Pedidos'
      AND index_name = 'idx_estado_fecha'
);

SET @query := IF(@index_exists = 0, 
    'ALTER TABLE Pedidos ADD INDEX idx_estado_fecha (Estado, Fecha);', 
    'SELECT "Índice ya existente";');

PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- =====================================================
-- FIN DEL SCRIPT
-- =====================================================

