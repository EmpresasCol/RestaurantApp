-- Qpro · 31/10/2026 · Presentaciones de compra y códigos de barras.
-- Ejecutar una vez en TiDB Cloud (SQL Editor). Es idempotente: se puede repetir.
-- OrdenesCompra y DetallesOrdenCompra ya existen en restaurantebd.sql; se incluyen
-- con IF NOT EXISTS por si la base se creó sin ellas.

CREATE TABLE IF NOT EXISTS OrdenesCompra (
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
    FOREIGN KEY (UsuarioCreadorId) REFERENCES Usuarios(Id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS DetallesOrdenCompra (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    OrdenCompraId INT NOT NULL,
    ProductoId INT NOT NULL,
    Cantidad DECIMAL(10,2) NOT NULL,
    PrecioUnitario DECIMAL(10,2) NOT NULL,
    Subtotal DECIMAL(10,2) GENERATED ALWAYS AS (Cantidad * PrecioUnitario) STORED,
    CantidadRecibida DECIMAL(10,2) DEFAULT 0,
    FOREIGN KEY (OrdenCompraId) REFERENCES OrdenesCompra(Id) ON DELETE CASCADE,
    FOREIGN KEY (ProductoId) REFERENCES ProductosInventario(Id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Producto de compra: cómo llega el insumo del proveedor (caja x12, bulto 25 kg...).
-- Factor = unidades del insumo por presentación. Varios códigos → mismo insumo.
CREATE TABLE IF NOT EXISTS PresentacionesCompra (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    ProductoId INT NOT NULL,
    Nombre VARCHAR(150) NOT NULL,
    Factor DECIMAL(10,3) NOT NULL DEFAULT 1,
    Codigo VARCHAR(100) NULL,
    ProveedorId INT NULL,
    CostoReferencia DECIMAL(12,2) NULL,
    Activo BOOLEAN DEFAULT TRUE,
    FechaCreacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_presentacion_codigo (Codigo),
    CONSTRAINT chk_presentacion_factor CHECK (Factor > 0),
    FOREIGN KEY (ProductoId) REFERENCES ProductosInventario(Id) ON DELETE CASCADE,
    FOREIGN KEY (ProveedorId) REFERENCES Proveedores(Id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Los códigos de barras que ya estaban en ProductosInventario pasan a ser
-- presentaciones "por unidad" (factor 1).
INSERT INTO PresentacionesCompra (ProductoId, Nombre, Factor, Codigo, ProveedorId, CostoReferencia)
SELECT p.Id, CONCAT(p.Nombre, ' (unidad)'), 1, p.CodigoBarras, p.ProveedorId, p.PrecioCosto
FROM ProductosInventario p
WHERE p.CodigoBarras IS NOT NULL AND p.CodigoBarras <> ''
  AND NOT EXISTS (SELECT 1 FROM PresentacionesCompra pc WHERE pc.Codigo = p.CodigoBarras);
