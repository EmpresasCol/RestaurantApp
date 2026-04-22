-- =====================================================
-- SCRIPT COMPLETO Y CORREGIDO: RestauranteBD
-- Sistema de Gestión de Restaurante + Inventario + Domicilios
-- Motor: MySQL 8+
-- =====================================================

DROP DATABASE IF EXISTS RestauranteBD;
CREATE DATABASE RestauranteBD CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE RestauranteBD;

-- =====================================================
-- SECCIÓN 1: TABLAS PRINCIPALES (CORE)
-- =====================================================

CREATE TABLE Usuarios (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    Nombre VARCHAR(100) NOT NULL,
    Usuario VARCHAR(50) UNIQUE NOT NULL,
    ClaveHash CHAR(60) NOT NULL,
    Rol ENUM('Administrador','Mesero','Cocina','Caja') NOT NULL,
    INDEX idx_usuario (Usuario),
    INDEX idx_rol (Rol)
) ENGINE=InnoDB;

CREATE TABLE Mesas (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    Numero INT NOT NULL UNIQUE,
    Estado ENUM('Disponible','Ocupada','EsperandoPago') DEFAULT 'Disponible',
    INDEX idx_estado (Estado)
) ENGINE=InnoDB;

CREATE TABLE Platillos (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    Nombre VARCHAR(100) NOT NULL,
    Descripcion TEXT,
    Precio DECIMAL(10,2) NOT NULL,
    ImagenUrl LONGTEXT,
    Categoria VARCHAR(50) NOT NULL DEFAULT 'Platos Principales',
    INDEX idx_categoria (Categoria),
    FULLTEXT INDEX ft_platillo_descripcion (Nombre, Descripcion),
    CONSTRAINT chk_platillos_precio_nonneg CHECK (Precio >= 0)
) ENGINE=InnoDB;

CREATE TABLE Pedidos (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    MesaId INT NOT NULL,
    UsuarioId INT NOT NULL,
    Estado ENUM('EnProceso','Listo','Entregado','Pagado','Cancelado') DEFAULT 'EnProceso',
    Fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (MesaId) REFERENCES Mesas(Id) ON DELETE RESTRICT,
    FOREIGN KEY (UsuarioId) REFERENCES Usuarios(Id) ON DELETE RESTRICT,
    INDEX idx_estado (Estado)
) ENGINE=InnoDB;

CREATE TABLE PedidoDetalles (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    PedidoId INT NOT NULL,
    PlatilloId INT NOT NULL,
    Cantidad INT NOT NULL,
    Nota TEXT,
    Estado ENUM('Pendiente','EnPreparacion','Listo','Cancelado') DEFAULT 'Pendiente',
    FOREIGN KEY (PedidoId) REFERENCES Pedidos(Id) ON DELETE CASCADE,
    FOREIGN KEY (PlatilloId) REFERENCES Platillos(Id) ON DELETE RESTRICT,
    CONSTRAINT chk_pedidodetalles_cantidad_positive CHECK (Cantidad > 0)
) ENGINE=InnoDB;

CREATE TABLE Pagos (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    PedidoId INT NOT NULL,
    Monto DECIMAL(10,2) NOT NULL,
    MontoPropina DECIMAL(10,2) DEFAULT 0.00,
    MetodoPago ENUM('Efectivo','Tarjeta','QR','Otro') NOT NULL,
    Fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (PedidoId) REFERENCES Pedidos(Id) ON DELETE RESTRICT
) ENGINE=InnoDB;

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
    FOREIGN KEY (PagoId) REFERENCES Pagos(Id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE UsuariosFCM (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    UsuarioId INT NOT NULL,
    FcmToken VARCHAR(255) NOT NULL,
    FechaRegistro DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (UsuarioId) REFERENCES Usuarios(Id) ON DELETE CASCADE,
    UNIQUE KEY unique_usuario_token (UsuarioId, FcmToken)
) ENGINE=InnoDB;

-- =====================================================
-- SECCIÓN 2: MÓDULO DE INVENTARIO
-- =====================================================

CREATE TABLE CategoriasInventario (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    Nombre VARCHAR(100) NOT NULL UNIQUE,
    Descripcion TEXT,
    Tipo ENUM('Ingrediente','Bebida','MaterialLimpieza','ProductoTerminado','Otro') NOT NULL,
    Color VARCHAR(20) DEFAULT '#3b82f6',
    Activo BOOLEAN DEFAULT TRUE,
    FechaCreacion DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

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
    TipoProductos VARCHAR(200),
    Activo BOOLEAN DEFAULT TRUE,
    FechaRegistro DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE ProductosInventario (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    Codigo VARCHAR(50) UNIQUE,
    Nombre VARCHAR(150) NOT NULL,
    Descripcion TEXT,
    CategoriaId INT NOT NULL,
    ProveedorId INT,
    UnidadMedida VARCHAR(20) NOT NULL,
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
    FOREIGN KEY (ProveedorId) REFERENCES Proveedores(Id) ON DELETE SET NULL
) ENGINE=InnoDB;

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
    FOREIGN KEY (ResponsableId) REFERENCES Usuarios(Id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Aquí estaba el error del delimiter en tu código original. Ya está corregido.
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
    UNIQUE KEY unique_producto_almacen (ProductoId, AlmacenId)
) ENGINE=InnoDB;

CREATE TABLE Lotes (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    ProductoId INT NOT NULL,
    AlmacenId INT NOT NULL,
    NumeroLote VARCHAR(50) NOT NULL,
    FechaIngreso DATE NOT NULL,
    FechaVencimiento DATE,
    CantidadInicial DECIMAL(10,2) NOT NULL,
    CantidadActual DECIMAL(10,2) NOT NULL,
    CostoUnitario DECIMAL(10,2) NOT NULL,
    Estado ENUM('Activo','Vencido','Agotado') DEFAULT 'Activo',
    FechaCreacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ProductoId) REFERENCES ProductosInventario(Id) ON DELETE CASCADE,
    FOREIGN KEY (AlmacenId) REFERENCES Almacenes(Id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE MovimientosInventario (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    TipoMovimiento ENUM('Entrada','Salida','Ajuste','Transferencia','Merma','Devolucion','ConsumoProduccion') NOT NULL,
    ProductoId INT NOT NULL,
    AlmacenId INT NOT NULL,
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
    FOREIGN KEY (LoteId) REFERENCES Lotes(Id) ON DELETE SET NULL
) ENGINE=InnoDB;

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
    FOREIGN KEY (ProductoId) REFERENCES ProductosInventario(Id) ON DELETE RESTRICT
) ENGINE=InnoDB;

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
    FOREIGN KEY (LoteId) REFERENCES Lotes(Id) ON DELETE CASCADE
) ENGINE=InnoDB;

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
    FOREIGN KEY (UsuarioCreadorId) REFERENCES Usuarios(Id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE DetallesOrdenCompra (
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

-- =====================================================
-- SECCIÓN 3: MÓDULO DE DOMICILIOS
-- =====================================================

CREATE TABLE Clientes (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    Nombre VARCHAR(100) NOT NULL,
    Telefono VARCHAR(20) NOT NULL,
    Email VARCHAR(100),
    FechaRegistro DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_telefono (Telefono)
) ENGINE=InnoDB;

CREATE TABLE Direcciones (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    ClienteId INT NOT NULL,
    Direccion VARCHAR(255) NOT NULL,
    Barrio VARCHAR(100),
    Ciudad VARCHAR(100) DEFAULT 'Sincelejo',
    Departamento VARCHAR(100) DEFAULT 'Sucre',
    ReferenciasAdicionales TEXT,
    EsPrincipal BOOLEAN DEFAULT FALSE,
    Activa BOOLEAN DEFAULT TRUE,
    FechaCreacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ClienteId) REFERENCES Clientes(Id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE Domicilios (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    ClienteId INT NOT NULL,
    DireccionId INT NOT NULL,
    Estado ENUM('EnPreparacion','Listo','EnCamino','Entregado','Cancelado') DEFAULT 'EnPreparacion',
    FechaPedido DATETIME DEFAULT CURRENT_TIMESTAMP,
    FechaEstimadaEntrega DATETIME,
    FechaEntrega DATETIME,
    Subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    CostoEnvio DECIMAL(10,2) NOT NULL DEFAULT 0,
    Total DECIMAL(10,2) GENERATED ALWAYS AS (Subtotal + CostoEnvio) STORED,
    MetodoPago ENUM('Efectivo','Transferencia','Tarjeta','Nequi','Daviplata') NOT NULL DEFAULT 'Efectivo',
    PagadoAnticipado BOOLEAN DEFAULT FALSE,
    DomiciliarioId INT,
    NotasCliente TEXT,
    NotasInternas TEXT,
    UsuarioCreadorId INT NOT NULL,
    FechaCreacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    FechaActualizacion DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (ClienteId) REFERENCES Clientes(Id) ON DELETE RESTRICT,
    FOREIGN KEY (DireccionId) REFERENCES Direcciones(Id) ON DELETE RESTRICT,
    FOREIGN KEY (DomiciliarioId) REFERENCES Usuarios(Id) ON DELETE SET NULL,
    FOREIGN KEY (UsuarioCreadorId) REFERENCES Usuarios(Id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE DomicilioDetalles (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    DomicilioId INT NOT NULL,
    PlatilloId INT NOT NULL,
    Cantidad INT NOT NULL,
    PrecioUnitario DECIMAL(10,2) NOT NULL,
    Subtotal DECIMAL(10,2) GENERATED ALWAYS AS (Cantidad * PrecioUnitario) STORED,
    Nota TEXT,
    FOREIGN KEY (DomicilioId) REFERENCES Domicilios(Id) ON DELETE CASCADE,
    FOREIGN KEY (PlatilloId) REFERENCES Platillos(Id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE HistorialEstadosDomicilio (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    DomicilioId INT NOT NULL,
    EstadoAnterior VARCHAR(50),
    EstadoNuevo VARCHAR(50) NOT NULL,
    UsuarioId INT,
    Comentario TEXT,
    Fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (DomicilioId) REFERENCES Domicilios(Id) ON DELETE CASCADE,
    FOREIGN KEY (UsuarioId) REFERENCES Usuarios(Id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE ConfiguracionDomicilios (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    CostoEnvioBase DECIMAL(10,2) NOT NULL DEFAULT 3000.00,
    CostoEnvioPorKm DECIMAL(10,2) NOT NULL DEFAULT 1000.00,
    TiempoEstimadoPreparacion INT NOT NULL DEFAULT 30,
    TiempoEstimadoEntrega INT NOT NULL DEFAULT 20,
    PedidoMinimo DECIMAL(10,2) NOT NULL DEFAULT 15000.00,
    ZonasCobertura JSON,
    HorarioInicio TIME DEFAULT '10:00:00',
    HorarioCierre TIME DEFAULT '22:00:00',
    DiasCierre JSON,
    Activo BOOLEAN DEFAULT TRUE,
    FechaActualizacion DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE AuditLog (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    Tabla VARCHAR(100),
    Accion VARCHAR(50),
    RegistroId VARCHAR(100),
    UsuarioId INT,
    Detalle TEXT,
    Fecha DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =====================================================
-- SECCIÓN 4: VISTAS
-- =====================================================

CREATE VIEW vw_stock_general AS
SELECT 
    p.Id AS ProductoId, p.Codigo, p.Nombre AS ProductoNombre, c.Nombre AS Categoria,
    p.UnidadMedida, COALESCE(SUM(s.Cantidad), 0) AS StockTotal,
    p.StockMinimo, p.StockMaximo, p.PuntoReorden,
    COALESCE(SUM(s.CostoTotal), 0) AS ValorInventario,
    CASE 
        WHEN COALESCE(SUM(s.Cantidad), 0) = 0 THEN 'Agotado'
        WHEN COALESCE(SUM(s.Cantidad), 0) <= p.StockMinimo THEN 'Critico'
        WHEN COALESCE(SUM(s.Cantidad), 0) <= p.PuntoReorden THEN 'Bajo'
        WHEN p.StockMaximo IS NOT NULL AND COALESCE(SUM(s.Cantidad), 0) >= p.StockMaximo THEN 'Excedido'
        ELSE 'Normal'
    END AS EstadoStock, p.Activo
FROM ProductosInventario p
LEFT JOIN Stock s ON p.Id = s.ProductoId
LEFT JOIN CategoriasInventario c ON p.CategoriaId = c.Id
WHERE p.Activo = TRUE
GROUP BY p.Id, p.Codigo, p.Nombre, c.Nombre, p.UnidadMedida, p.StockMinimo, p.StockMaximo, p.PuntoReorden, p.Activo;

CREATE VIEW vw_productos_vencimiento AS
SELECT 
    l.Id AS LoteId, l.NumeroLote, p.Id AS ProductoId, p.Nombre AS ProductoNombre,
    a.Nombre AS Almacen, l.CantidadActual, p.UnidadMedida, l.FechaVencimiento,
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
WHERE l.Estado = 'Activo' AND l.CantidadActual > 0 AND l.FechaVencimiento IS NOT NULL
ORDER BY l.FechaVencimiento ASC;

CREATE VIEW vw_valor_inventario_almacen AS
SELECT 
    a.Id AS AlmacenId, a.Codigo, a.Nombre AS Almacen, a.Tipo,
    COUNT(DISTINCT s.ProductoId) AS TotalProductos,
    SUM(s.Cantidad) AS CantidadTotal, SUM(s.CostoTotal) AS ValorTotal
FROM Almacenes a
LEFT JOIN Stock s ON a.Id = s.AlmacenId
WHERE a.Activo = TRUE
GROUP BY a.Id, a.Codigo, a.Nombre, a.Tipo;

CREATE VIEW vw_domicilios_activos AS
SELECT 
    d.Id AS DomicilioId, d.Estado, d.FechaPedido, d.FechaEstimadaEntrega,
    c.Id AS ClienteId, c.Nombre AS ClienteNombre, c.Telefono AS ClienteTelefono,
    dir.Direccion, dir.Barrio, dir.ReferenciasAdicionales,
    d.Subtotal, d.CostoEnvio, d.Total, d.MetodoPago,
    u.Nombre AS DomiciliarioNombre, d.NotasCliente,
    COUNT(dd.Id) AS CantidadItems, SUM(dd.Cantidad) AS TotalProductos
FROM Domicilios d
INNER JOIN Clientes c ON d.ClienteId = c.Id
INNER JOIN Direcciones dir ON d.DireccionId = dir.Id
LEFT JOIN Usuarios u ON d.DomiciliarioId = u.Id
LEFT JOIN DomicilioDetalles dd ON d.Id = dd.DomicilioId
WHERE d.Estado IN ('Pendiente', 'EnPreparacion', 'EnCamino')
GROUP BY d.Id, d.Estado, d.FechaPedido, d.FechaEstimadaEntrega, c.Id, c.Nombre, c.Telefono, dir.Direccion, dir.Barrio, dir.ReferenciasAdicionales, d.Subtotal, d.CostoEnvio, d.Total, d.MetodoPago, u.Nombre, d.NotasCliente;

CREATE VIEW vw_estadisticas_domicilios AS
SELECT 
    DATE(d.FechaPedido) AS Fecha, COUNT(*) AS TotalDomicilios,
    SUM(CASE WHEN d.Estado = 'Entregado' THEN 1 ELSE 0 END) AS Entregados,
    SUM(CASE WHEN d.Estado = 'Cancelado' THEN 1 ELSE 0 END) AS Cancelados,
    SUM(CASE WHEN d.Estado IN ('Pendiente', 'EnPreparacion', 'EnCamino') THEN 1 ELSE 0 END) AS EnProceso,
    SUM(d.Total) AS VentaTotal, AVG(d.Total) AS TicketPromedio,
    SUM(d.CostoEnvio) AS TotalCostosEnvio
FROM Domicilios d
GROUP BY DATE(d.FechaPedido)
ORDER BY Fecha DESC;

-- =====================================================
-- SECCIÓN 5: INSERCIÓN DE DATOS (Tus datos originales)
-- =====================================================

-- Usuarios
INSERT INTO Usuarios (Nombre, Usuario, ClaveHash, Rol) VALUES
('Admin Principal', 'admin', '123', 'Administrador'),
('Juan Pérez', 'juan.mesero', '123', 'Mesero'),
('María García', 'maria.mesero', '123', 'Mesero'),
('Carlos López', 'carlos.cocina', '123', 'Cocina'),
('Ana Martínez', 'ana.cocina', '123', 'Cocina'),
('Pedro Rodríguez', 'pedro.caja', '123', 'Caja'),
('Laura Fernández', 'laura.caja', '123', 'Caja'),
('Cliente QR', 'cliente_qr', '123', 'Mesero');

-- Mesas
INSERT INTO Mesas (Numero, Estado) VALUES
(1, 'Disponible'), (2, 'Ocupada'), (3, 'Ocupada'), (4, 'Disponible'),
(5, 'EsperandoPago'), (6, 'Disponible'), (7, 'Ocupada'), (8, 'Disponible'),
(9, 'Disponible'), (10, 'Disponible'), (11, 'Disponible'), (12, 'Disponible');

-- Platillos
INSERT INTO Platillos (Nombre, Descripcion, Precio, ImagenUrl, Categoria) VALUES
('Hamburguesa Clásica', 'Hamburguesa de carne con lechuga, tomate, queso y papas fritas', 25000.00, 
 'https://cdn.pixabay.com/photo/2016/03/05/19/02/hamburger-1238246_1280.jpg', 'Platos Principales'),
('Pizza Margarita', 'Pizza con salsa de tomate, mozzarella fresca y albahaca', 35000.00, 
 'https://cdn.pixabay.com/photo/2017/12/09/08/18/pizza-3007395_1280.jpg', 'Platos Principales'),
('Ensalada César', 'Lechuga romana, crutones, queso parmesano y aderezo césar', 18000.00, 
 'https://www.gourmet.cl/wp-content/uploads/2016/09/EnsaladaCesar2.webp', 'Ensaladas'),
('Pasta Carbonara', 'Pasta con salsa cremosa, tocino y queso parmesano', 28000.00, 
 'https://cdn.pixabay.com/photo/2018/07/18/19/12/pasta-3547078_1280.jpg', 'Platos Principales'),
('Tacos al Pastor', 'Tres tacos de cerdo marinado con piña, cebolla y cilantro', 22000.00, 
 'https://cdn.pixabay.com/photo/2017/06/29/20/09/mexican-2456038_1280.jpg', 'Platos Principales'),
('Salmón a la Parrilla', 'Filete de salmón con verduras al vapor y arroz', 48000.00, 
 'https://cdn.pixabay.com/photo/2014/11/05/15/57/salmon-518032_1280.jpg', 'Platos Principales'),
('Sopa de Tomate', 'Sopa cremosa de tomate con crutones', 14000.00, 
 'https://www.unileverfoodsolutions.com.co/dam/global-ufs/mcos/nola/colombia/calcmenu/recipes/CO-recipes/soups/sopa-de-tomates-rostizados/main-header.jpg', 'Sopas'),
('Pollo Teriyaki', 'Pechuga de pollo con salsa teriyaki y arroz', 30000.00, 
 'https://cocinaconcoqui.com/wp-content/uploads/2022/04/Pollo-teriyaki-con-arroz-casero-480x270.png', 'Platos Principales'),
('Brownie con Helado', 'Brownie de chocolate caliente con helado de vainilla', 16000.00, 
 'https://cdn.pixabay.com/photo/2014/11/28/08/03/brownie-548591_1280.jpg', 'Postres'),
('Limonada Natural', 'Limonada recién hecha', 7000.00, 
 'https://cdn.pixabay.com/photo/2016/07/21/11/17/drink-1532300_1280.jpg', 'Bebidas'),
('Café Americano', 'Café negro recién preparado', 5000.00, 
 'https://cdn.recetasderechupete.com/wp-content/uploads/2023/11/Cafe-americano-portada.jpg', 'Bebidas'),
('Cerveza Artesanal', 'Cerveza local artesanal', 12000.00, 
 'https://politecnicointernacional.edu.co/wp-content/uploads/2025/07/trigo-y-jarras-de-cerveza-de-angulo-alto-scaled.jpg', 'Bebidas');

-- Pedidos de ejemplo
INSERT INTO Pedidos (MesaId, UsuarioId, Estado, Fecha) VALUES
(2, 2, 'EnProceso', '2025-10-15 12:30:00'),
(3, 3, 'Listo', '2025-10-15 12:45:00'),
(5, 2, 'Pagado', '2025-10-15 11:30:00'),
(7, 3, 'EnProceso', '2025-10-15 13:00:00');

-- Detalles de pedidos
INSERT INTO PedidoDetalles (PedidoId, PlatilloId, Cantidad, Nota, Estado) VALUES
(1, 1, 2, 'Sin cebolla en una', 'EnPreparacion'),
(1, 10, 2, NULL, 'Listo'),
(1, 9, 1, NULL, 'Pendiente'),
(2, 2, 1, 'Extra queso', 'Listo'),
(2, 3, 1, 'Sin crutones', 'Listo'),
(2, 12, 2, NULL, 'Listo'),
(3, 6, 2, 'Término medio', 'Listo'),
(3, 3, 1, NULL, 'Listo'),
(3, 11, 2, NULL, 'Listo'),
(4, 5, 3, 'Sin cilantro', 'Pendiente'),
(4, 4, 1, 'Sin tocino', 'Pendiente'),
(4, 10, 3, NULL, 'Listo');

-- Pago de ejemplo
INSERT INTO Pagos (PedidoId, Monto, MontoPropina, MetodoPago, Fecha) VALUES
(3, 232000.00, 30000.00, 'Tarjeta', '2025-10-15 12:15:00');

-- Factura de ejemplo
INSERT INTO Facturas (PagoId, NumeroFactura, NitCliente, NombreCliente, Subtotal, Propina, Total, ArchivoUrl, FechaEmision) VALUES
(1, 'FACT-2025-000001', '1234567890', 'Roberto Sánchez', 232000.00, 30000.00, 262000.00, 
 '/facturas/2025/10/FACT-2025-000001.pdf', '2025-10-15 12:15:00');

-- Categorías de Inventario
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

-- Proveedores
INSERT INTO Proveedores (Nombre, Contacto, Telefono, Email, NIT, Ciudad, Direccion, TipoProductos) VALUES
('Distribuidora de Carnes La Finca', 'Juan Pérez', '3001234567', 'ventas@lafinca.com', 
 '900123456-1', 'Bogotá', 'Calle 50 #25-30', 'Carnes y derivados'),
('Verduras Frescas del Valle', 'María García', '3107654321', 'info@verdurasdelvalle.com', 
 '900234567-2', 'Cali', 'Carrera 10 #15-20', 'Verduras y hortalizas'),
('Bebidas Premium Ltda', 'Carlos López', '3159876543', 'pedidos@bebidaspremium.com', 
 '900345678-3', 'Medellín', 'Avenida 80 #40-50', 'Bebidas alcohólicas y no alcohólicas'),
('Lácteos del Norte', 'Ana Martínez', '3201239876', 'contacto@lacteosdelNorte.com', 
 '900456789-4', 'Barranquilla', 'Calle 72 #54-20', 'Productos lácteos'),
('Pescados y Mariscos del Pacífico', 'Roberto Sánchez', '3158887766', 'ventas@pescadospacifico.com', 
 '900567890-5', 'Buenaventura', 'Zona Portuaria', 'Pescados y mariscos'),
('Distribuidora de Granos El Trigal', 'Laura Ramírez', '3176665544', 'info@eltrigal.com', 
 '900678901-6', 'Villavicencio', 'Carrera 40 #25-10', 'Granos y cereales'),
('Productos de Limpieza Aseo Total', 'Diego Torres', '3143332211', 'ventas@aseototal.com', 
 '900789012-7', 'Bogotá', 'Calle 13 #68-50', 'Productos de limpieza'),
('Panadería y Harinas La Espiga', 'Claudia Moreno', '3195554433', 'pedidos@laespiga.com', 
 '900890123-8', 'Pereira', 'Avenida 30 de Agosto #12-20', 'Panadería y harinas');

-- Almacenes
INSERT INTO Almacenes (Codigo, Nombre, Descripcion, Ubicacion, Tipo) VALUES
('ALM-001', 'Bodega Principal', 'Almacén general de productos secos', 'Planta Baja - Área de Bodega', 'Principal'),
('ALM-002', 'Cocina Principal', 'Área de preparación de alimentos', 'Planta Baja - Cocina', 'Cocina'),
('ALM-003', 'Refrigerador 1', 'Cámara fría para productos perecederos', 'Planta Baja - Área Fría', 'Refrigerado'),
('ALM-004', 'Congelador 1', 'Cámara de congelación', 'Planta Baja - Área Fría', 'Congelado'),
('ALM-005', 'Bar', 'Área de bebidas y licores', 'Planta 1 - Bar', 'Bar'),
('ALM-006', 'Bodega Secundaria', 'Almacén de respaldo', 'Planta Baja - Bodega Auxiliar', 'Secundario');

-- Productos de Inventario
INSERT INTO ProductosInventario (Codigo, Nombre, Descripcion, CategoriaId, ProveedorId, UnidadMedida, 
                                  PrecioCosto, StockMinimo, StockMaximo, PuntoReorden, RequiereCaducidad, DiasVencimiento) VALUES
('PROD-001', 'Lomo de Res Premium', 'Corte de res de primera calidad', 1, 1, 'Kg', 28000.00, 10, 50, 15, TRUE, 5),
('PROD-002', 'Pechuga de Pollo', 'Pechuga deshuesada sin piel', 2, 1, 'Kg', 12000.00, 15, 60, 20, TRUE, 4),
('PROD-003', 'Chuleta de Cerdo', 'Chuletas de cerdo frescas', 1, 1, 'Kg', 15000.00, 8, 40, 12, TRUE, 5),
('PROD-004', 'Salmón Fresco', 'Filete de salmón del Atlántico', 3, 5, 'Kg', 35000.00, 5, 20, 8, TRUE, 3),
('PROD-005', 'Camarones Jumbo', 'Camarones grandes pelados', 3, 5, 'Kg', 42000.00, 3, 15, 5, TRUE, 2),
('PROD-006', 'Tomate Chonto', 'Tomate fresco de primera', 4, 2, 'Kg', 3500.00, 20, 100, 30, TRUE, 7),
('PROD-007', 'Cebolla Cabezona', 'Cebolla blanca fresca', 4, 2, 'Kg', 2800.00, 15, 80, 25, TRUE, 14),
('PROD-008', 'Lechuga Romana', 'Lechuga fresca hidropónica', 4, 2, 'Unidad', 2500.00, 10, 50, 15, TRUE, 5),
('PROD-009', 'Papa Criolla', 'Papa criolla amarilla', 4, 2, 'Kg', 4200.00, 25, 120, 40, FALSE, NULL),
('PROD-010', 'Queso Mozzarella', 'Queso mozzarella para pizza', 6, 4, 'Kg', 18000.00, 5, 30, 10, TRUE, 30),
('PROD-011', 'Leche Entera', 'Leche entera pasteurizada', 6, 4, 'Litro', 3200.00, 10, 50, 15, TRUE, 7),
('PROD-012', 'Mantequilla', 'Mantequilla sin sal', 6, 4, 'Kg', 14000.00, 3, 20, 5, TRUE, 60),
('PROD-013', 'Arroz Blanco', 'Arroz de primera calidad', 7, 6, 'Kg', 3000.00, 50, 200, 75, FALSE, NULL),
('PROD-014', 'Pasta Spaghetti', 'Pasta italiana importada', 7, 6, 'Paquete', 5000.00, 20, 100, 30, FALSE, NULL),
('PROD-015', 'Harina de Trigo', 'Harina todo uso', 7, 8, 'Kg', 2800.00, 30, 150, 50, FALSE, NULL),
('PROD-016', 'Aceite de Oliva Extra Virgen', 'Aceite de oliva primera prensada', 9, 3, 'Litro', 35000.00, 5, 25, 10, FALSE, NULL),
('PROD-017', 'Aceite Vegetal', 'Aceite vegetal para cocina', 9, 3, 'Litro', 8000.00, 10, 50, 15, FALSE, NULL),
('PROD-018', 'Sal de Mar', 'Sal marina refinada', 8, 6, 'Kg', 2000.00, 5, 30, 10, FALSE, NULL),
('PROD-019', 'Pimienta Negra Molida', 'Pimienta negra recién molida', 8, 6, 'Kg', 18000.00, 2, 10, 4, FALSE, NULL),
('PROD-020', 'Ajo en Pasta', 'Ajo procesado y envasado', 8, 2, 'Kg', 12000.00, 3, 15, 5, TRUE, 90);

-- Stock inicial
INSERT INTO Stock (ProductoId, AlmacenId, Cantidad, CostoPromedio) VALUES
(13, 1, 150, 3000), (14, 1, 80, 5000), (15, 1, 100, 2800),
(18, 1, 20, 2000), (19, 1, 8, 18000), (1, 2, 15, 28000),
(2, 2, 25, 12000), (6, 2, 30, 3500), (7, 2, 20, 2800),
(9, 2, 40, 4200), (4, 3, 8, 35000), (5, 3, 5, 42000),
(8, 3, 25, 2500), (10, 3, 12, 18000), (11, 3, 30, 3200),
(3, 4, 20, 15000);

-- Lotes de ejemplo
INSERT INTO Lotes (ProductoId, AlmacenId, NumeroLote, FechaIngreso, FechaVencimiento, 
                   CantidadInicial, CantidadActual, CostoUnitario) VALUES
(1, 2, 'L-LOMO-001', DATE_SUB(CURDATE(), INTERVAL 5 DAY), DATE_ADD(CURDATE(), INTERVAL 5 DAY), 20, 15, 28000),
(2, 2, 'L-PECH-001', DATE_SUB(CURDATE(), INTERVAL 4 DAY), DATE_ADD(CURDATE(), INTERVAL 4 DAY), 30, 25, 12000),
(6, 2, 'L-TOM-001', DATE_SUB(CURDATE(), INTERVAL 2 DAY), DATE_ADD(CURDATE(), INTERVAL 7 DAY), 40, 30, 3500);

-- Configuración inicial de domicilios
INSERT INTO ConfiguracionDomicilios (
    CostoEnvioBase, 
    CostoEnvioPorKm, 
    TiempoEstimadoPreparacion, 
    TiempoEstimadoEntrega,
    PedidoMinimo,
    Activo
) VALUES (
    3000.00, 
    1000.00, 
    30, 
    20, 
    15000.00, 
    TRUE
);

-- Cliente de ejemplo para domicilios
INSERT INTO Clientes (Nombre, Telefono, Email) VALUES
('Cliente Ejemplo', '3001234567', 'cliente@ejemplo.com');

-- Dirección de ejemplo
INSERT INTO Direcciones (ClienteId, Direccion, Barrio, Ciudad, EsPrincipal) VALUES
(1, 'Calle 25 #15-30', 'Centro', 'Sincelejo', TRUE);

-- =====================================================
-- SECCIÓN 6: PROCEDIMIENTOS ALMACENADOS
-- =====================================================

DELIMITER $$

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
    DECLARE v_pagoId INT;
    
    -- Calcular subtotal real del pedido
    SELECT COALESCE(SUM(pd.Cantidad * pl.Precio), 0) INTO v_subtotal
    FROM PedidoDetalles pd
    JOIN Platillos pl ON pd.PlatilloId = pl.Id
    WHERE pd.PedidoId = p_pedidoId AND pd.Estado <> 'Cancelado';
    
    SET v_total_esperado = v_subtotal + p_montoPropina;
    
    -- Validar monto
    IF p_monto < v_subtotal THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Monto pagado es menor que el subtotal del pedido';
    END IF;
    
    START TRANSACTION;
    
    -- Insertar pago
    INSERT INTO Pagos (PedidoId, Monto, MontoPropina, MetodoPago)
    VALUES (p_pedidoId, p_monto, p_montoPropina, p_metodo);
    
    SET v_pagoId = LAST_INSERT_ID();
    
    -- Insertar factura
    INSERT INTO Facturas (PagoId, NumeroFactura, NitCliente, NombreCliente, 
                          Subtotal, Propina, Total, ArchivoUrl)
    VALUES (v_pagoId, p_numeroFactura, p_nitCliente, p_nombreCliente,
            v_subtotal, p_montoPropina, p_monto + p_montoPropina, p_archivoUrl);
    
    -- Actualizar estado del pedido
    UPDATE Pedidos SET Estado = 'Pagado' WHERE Id = p_pedidoId;
    
    -- Liberar mesa
    UPDATE Mesas m
    JOIN Pedidos ped ON ped.MesaId = m.Id
    SET m.Estado = 'Disponible'
    WHERE ped.Id = p_pedidoId;
    
    COMMIT;
END$$

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
    DECLARE v_almacenId INT;
    DECLARE v_consumir DECIMAL(10,2);
    DECLARE v_costoUnit DECIMAL(10,2);
    
    DECLARE cur_recetas CURSOR FOR
        SELECT ProductoId, CantidadRequerida
        FROM Recetas
        WHERE PlatilloId = p_platilloId;
        
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
        
        -- Consumir usando FIFO
        WHILE v_totalNecesaria > 0 DO
            SELECT Id, CantidadActual, AlmacenId, CostoUnitario
            INTO v_loteId, v_loteCant, v_almacenId, v_costoUnit
            FROM Lotes
            WHERE ProductoId = v_productoId 
              AND CantidadActual > 0 
              AND Estado = 'Activo'
            ORDER BY COALESCE(FechaVencimiento, '9999-12-31') ASC, FechaIngreso ASC
            LIMIT 1;
            
            IF v_loteId IS NULL OR v_loteCant IS NULL THEN
                -- Stock insuficiente
                INSERT INTO AlertasInventario (TipoAlerta, ProductoId, Mensaje, Nivel)
                VALUES ('StockCritico', v_productoId, 
                        CONCAT('Stock insuficiente para platillo ID:', p_platilloId), 
                        'Critico');
                LEAVE recetas_loop;
            END IF;
            
            SET v_consumir = LEAST(v_totalNecesaria, v_loteCant);
            
            -- Actualizar lote
            UPDATE Lotes
            SET CantidadActual = CantidadActual - v_consumir,
                Estado = CASE WHEN CantidadActual - v_consumir <= 0 THEN 'Agotado' ELSE Estado END
            WHERE Id = v_loteId;
            
            -- Actualizar stock
            UPDATE Stock
            SET Cantidad = Cantidad - v_consumir
            WHERE ProductoId = v_productoId AND AlmacenId = v_almacenId;
            
            -- Registrar movimiento
            INSERT INTO MovimientosInventario 
                (TipoMovimiento, ProductoId, AlmacenId, Cantidad, CostoUnitario, 
                 LoteId, UsuarioId, Motivo, Referencia)
            VALUES 
                ('ConsumoProduccion', v_productoId, v_almacenId, v_consumir, v_costoUnit,
                 v_loteId, p_usuarioId, CONCAT('Consumo platillo ID:', p_platilloId), p_referencia);
            
            SET v_totalNecesaria = v_totalNecesaria - v_consumir;
        END WHILE;
        
        SET done = 0;
    END LOOP;
    
    CLOSE cur_recetas;
    COMMIT;
END$$

CREATE PROCEDURE sp_restaurar_stock_por_pedidodetalle(
    IN p_pedidodetalleId INT,
    IN p_usuarioId INT,
    IN p_referencia VARCHAR(100)
)
BEGIN
    DECLARE done INT DEFAULT 0;
    DECLARE v_movId INT;
    DECLARE v_productoId INT;
    DECLARE v_almacenId INT;
    DECLARE v_cantidad DECIMAL(10,2);
    
    DECLARE cur_mov CURSOR FOR
        SELECT Id, ProductoId, AlmacenId, Cantidad
        FROM MovimientosInventario
        WHERE Referencia = p_referencia;
        
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;
    
    START TRANSACTION;
    
    OPEN cur_mov;
    
    mov_loop: LOOP
        FETCH cur_mov INTO v_movId, v_productoId, v_almacenId, v_cantidad;
        
        IF done THEN
            LEAVE mov_loop;
        END IF;
        
        -- Registrar devolución
        INSERT INTO MovimientosInventario 
            (TipoMovimiento, ProductoId, AlmacenId, Cantidad, UsuarioId, Motivo, Referencia)
        VALUES 
            ('Devolucion', v_productoId, v_almacenId, v_cantidad, p_usuarioId,
             CONCAT('Restauración por cancelación PedidoDetalle:', p_pedidodetalleId), 
             p_referencia);
        
        -- Actualizar stock
        UPDATE Stock
        SET Cantidad = Cantidad + v_cantidad
        WHERE ProductoId = v_productoId AND AlmacenId = v_almacenId;
        
        -- Reactivar lote (simplificado)
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

-- =====================================================
-- SECCIÓN 7: TRIGGERS
-- =====================================================

CREATE TRIGGER trg_pedido_after_insert 
AFTER INSERT ON Pedidos
FOR EACH ROW
BEGIN
    UPDATE Mesas SET Estado = 'Ocupada' WHERE Id = NEW.MesaId;
END$$

CREATE TRIGGER trg_pedidodetalle_after_update 
AFTER UPDATE ON PedidoDetalles
FOR EACH ROW
BEGIN
    IF NEW.Estado = 'EnPreparacion' AND OLD.Estado <> 'EnPreparacion' THEN
        CALL sp_consumir_ingredientes_fifo(
            NEW.PlatilloId, 
            NEW.Cantidad, 
            (SELECT UsuarioId FROM Pedidos WHERE Id = NEW.PedidoId), 
            CONCAT('PedidoDetalle-', NEW.Id)
        );
    END IF;
END$$

CREATE TRIGGER trg_pedidodetalle_cancelado 
AFTER UPDATE ON PedidoDetalles
FOR EACH ROW
BEGIN
    IF NEW.Estado = 'Cancelado' AND OLD.Estado <> 'Cancelado' THEN
        CALL sp_restaurar_stock_por_pedidodetalle(
            NEW.Id,
            (SELECT UsuarioId FROM Pedidos WHERE Id = NEW.PedidoId),
            CONCAT('PedidoDetalle-', NEW.Id)
        );
    END IF;
END$$

CREATE TRIGGER trg_pedido_after_update 
AFTER UPDATE ON Pedidos
FOR EACH ROW
BEGIN
    IF NEW.Estado = 'Pagado' AND OLD.Estado <> 'Pagado' THEN
        UPDATE Mesas SET Estado = 'Disponible' WHERE Id = NEW.MesaId;
    END IF;
END$$

CREATE TRIGGER trg_domicilio_cambio_estado 
AFTER UPDATE ON Domicilios
FOR EACH ROW
BEGIN
    IF NEW.Estado != OLD.Estado THEN
        INSERT INTO HistorialEstadosDomicilio (
            DomicilioId, 
            EstadoAnterior, 
            EstadoNuevo,
            UsuarioId
        ) VALUES (
            NEW.Id,
            OLD.Estado,
            NEW.Estado,
            NEW.UsuarioCreadorId
        );
    END IF;
END$$

CREATE TRIGGER trg_domicilio_actualizar_subtotal_insert
AFTER INSERT ON DomicilioDetalles
FOR EACH ROW
BEGIN
    UPDATE Domicilios 
    SET Subtotal = (
        SELECT COALESCE(SUM(Subtotal), 0) 
        FROM DomicilioDetalles 
        WHERE DomicilioId = NEW.DomicilioId
    )
    WHERE Id = NEW.DomicilioId;
END$$

CREATE TRIGGER trg_domicilio_actualizar_subtotal_update
AFTER UPDATE ON DomicilioDetalles
FOR EACH ROW
BEGIN
    UPDATE Domicilios 
    SET Subtotal = (
        SELECT COALESCE(SUM(Subtotal), 0) 
        FROM DomicilioDetalles 
        WHERE DomicilioId = NEW.DomicilioId
    )
    WHERE Id = NEW.DomicilioId;
END$$

CREATE TRIGGER trg_domicilio_actualizar_subtotal_delete
AFTER DELETE ON DomicilioDetalles
FOR EACH ROW
BEGIN
    UPDATE Domicilios 
    SET Subtotal = (
        SELECT COALESCE(SUM(Subtotal), 0) 
        FROM DomicilioDetalles 
        WHERE DomicilioId = OLD.DomicilioId
    )
    WHERE Id = OLD.DomicilioId;
END$$

DELIMITER ;

-- =====================================================

-- Domicilios 
-- ============================================================================
--  QPro · Migración: Módulo Domiciliarios + Seguimiento Público
--  Motor: MySQL 8+
--  Naturaleza: NO destructiva · Idempotente · Segura para prod
--  Aplica sobre: RestauranteBD (ya existente)
--
--  CÓMO EJECUTAR (elige una opción):
--
--  Opción A — MySQL Workbench:
--    1. Abre una pestaña de Query conectada a tu servidor.
--    2. Pega TODO el contenido de este archivo.
--    3. Ejecuta con el botón "Execute Script" (rayo con hoja) o Ctrl+Shift+Enter.
--       NO uses el botón "Execute Statement" (rayo simple): ese ejecuta solo
--       la instrucción donde está el cursor y falla con el DELIMITER.
--
--  Opción B — Línea de comandos (más confiable para scripts con DELIMITER):
--    mysql -u root -p RestauranteBD < 01_migration_domiciliarios.sql
-- ============================================================================

USE RestauranteBD;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Añadir rol 'Domiciliario' al ENUM (conservando los existentes)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE Usuarios
    MODIFY COLUMN Rol ENUM(
        'Administrador',
        'Mesero',
        'Cocina',
        'Caja',
        'Domiciliario'
    ) NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Añadir estado 'Recogido' al ENUM de Domicilios
--    Flujo: EnPreparacion → Listo → Recogido → EnCamino → Entregado
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE Domicilios
    MODIFY COLUMN Estado ENUM(
        'EnPreparacion',
        'Listo',
        'Recogido',
        'EnCamino',
        'Entregado',
        'Cancelado'
    ) NOT NULL DEFAULT 'EnPreparacion';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Procedimiento auxiliar para añadir columnas de forma idempotente
--    (solo añade si la columna no existe; re-ejecutable sin error)
-- ─────────────────────────────────────────────────────────────────────────────
DROP PROCEDURE IF EXISTS sp_add_column_if_not_exists;

DELIMITER $$
CREATE PROCEDURE sp_add_column_if_not_exists(
    IN p_table   VARCHAR(64),
    IN p_column  VARCHAR(64),
    IN p_ddl     VARCHAR(1024)
)
BEGIN
    DECLARE v_count INT DEFAULT 0;
    SELECT COUNT(*) INTO v_count
      FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME   = p_table
       AND COLUMN_NAME  = p_column;
    IF v_count = 0 THEN
        SET @sql = CONCAT('ALTER TABLE `', p_table, '` ADD COLUMN ', p_ddl);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END$$
DELIMITER ;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Añadir las columnas nuevas a la tabla Domicilios
--    NOTA: los COMMENT usan comillas simples duplicadas ('') para escapar
--    dentro de un string delimitado por comillas simples. Compatible con
--    MySQL Workbench y línea de comandos.
-- ─────────────────────────────────────────────────────────────────────────────

CALL sp_add_column_if_not_exists(
    'Domicilios',
    'TokenSeguimiento',
    '`TokenSeguimiento` CHAR(32) NULL UNIQUE COMMENT ''Token publico para seguimiento del cliente'''
);

CALL sp_add_column_if_not_exists(
    'Domicilios',
    'PuedeEditarHasta',
    '`PuedeEditarHasta` DATETIME NULL COMMENT ''Ventana de edicion de 5 min tras crear el pedido publico'''
);

CALL sp_add_column_if_not_exists(
    'Domicilios',
    'FechaRecogida',
    '`FechaRecogida` DATETIME NULL COMMENT ''Momento en que el domiciliario recoge del restaurante'''
);

CALL sp_add_column_if_not_exists(
    'Domicilios',
    'ObservacionCliente',
    '`ObservacionCliente` TEXT NULL COMMENT ''Observacion opcional del cliente sobre el domiciliario'''
);

CALL sp_add_column_if_not_exists(
    'Domicilios',
    'FechaObservacion',
    '`FechaObservacion` DATETIME NULL COMMENT ''Fecha en que se envio la observacion del cliente'''
);

CALL sp_add_column_if_not_exists(
    'Domicilios',
    'OrigenPedido',
    '`OrigenPedido` ENUM(''Admin'',''Publico'') NOT NULL DEFAULT ''Admin'' COMMENT ''Admin=sistema interno, Publico=link abierto'''
);

-- Limpiar el procedimiento auxiliar
DROP PROCEDURE IF EXISTS sp_add_column_if_not_exists;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Índice sobre TokenSeguimiento (solo si no existe ya)
-- ─────────────────────────────────────────────────────────────────────────────
SET @idx_exists := (
    SELECT COUNT(*)
      FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME   = 'Domicilios'
       AND INDEX_NAME   = 'idx_token_seguimiento'
);

SET @sql_idx := IF(
    @idx_exists = 0,
    'CREATE INDEX idx_token_seguimiento ON Domicilios(TokenSeguimiento)',
    'SELECT 1'
);

PREPARE stmt FROM @sql_idx;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Vista: rendimiento por domiciliario (panel admin)
-- ─────────────────────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS vw_rendimiento_domiciliarios;

CREATE VIEW vw_rendimiento_domiciliarios AS
SELECT
    u.Id                                                               AS DomiciliarioId,
    u.Nombre                                                           AS DomiciliarioNombre,
    u.Usuario                                                          AS DomiciliarioUsuario,
    COUNT(d.Id)                                                        AS TotalAsignados,
    SUM(CASE WHEN d.Estado = 'Entregado' THEN 1 ELSE 0 END)             AS TotalEntregados,
    SUM(CASE WHEN d.Estado = 'EnCamino'  THEN 1 ELSE 0 END)             AS EnCaminoActualmente,
    SUM(CASE WHEN d.Estado = 'Recogido'  THEN 1 ELSE 0 END)             AS RecogidosPendientes,
    SUM(CASE WHEN DATE(d.FechaEntrega) = CURDATE()
             AND d.Estado = 'Entregado' THEN 1 ELSE 0 END)              AS EntregadosHoy,
    SUM(CASE WHEN YEARWEEK(d.FechaEntrega, 1) = YEARWEEK(CURDATE(), 1)
             AND d.Estado = 'Entregado' THEN 1 ELSE 0 END)              AS EntregadosSemana,
    SUM(CASE WHEN DATE_FORMAT(d.FechaEntrega, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')
             AND d.Estado = 'Entregado' THEN 1 ELSE 0 END)              AS EntregadosMes,
    AVG(CASE WHEN d.Estado = 'Entregado' AND d.FechaRecogida IS NOT NULL
             THEN TIMESTAMPDIFF(MINUTE, d.FechaRecogida, d.FechaEntrega)
             ELSE NULL END)                                             AS TiempoPromedioEntregaMin
FROM Usuarios u
LEFT JOIN Domicilios d ON d.DomiciliarioId = u.Id
WHERE u.Rol = 'Domiciliario'
GROUP BY u.Id, u.Nombre, u.Usuario;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Vista: observaciones recibidas de clientes (panel admin)
-- ─────────────────────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS vw_observaciones_clientes;

CREATE VIEW vw_observaciones_clientes AS
SELECT
    d.Id                  AS DomicilioId,
    d.FechaObservacion,
    d.ObservacionCliente,
    c.Id                  AS ClienteId,
    c.Nombre              AS ClienteNombre,
    c.Telefono            AS ClienteTelefono,
    u.Id                  AS DomiciliarioId,
    u.Nombre              AS DomiciliarioNombre,
    d.FechaEntrega
FROM Domicilios d
INNER JOIN Clientes  c ON d.ClienteId      = c.Id
LEFT  JOIN Usuarios  u ON d.DomiciliarioId = u.Id
WHERE d.ObservacionCliente IS NOT NULL
  AND d.ObservacionCliente <> ''
ORDER BY d.FechaObservacion DESC;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Usuario demo de prueba
--    Comentar en producción si no se necesita.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO Usuarios (Nombre, Usuario, ClaveHash, Rol)
SELECT 'Domiciliario Demo', 'domiciliario', '123', 'Domiciliario'
  FROM DUAL
 WHERE NOT EXISTS (
     SELECT 1 FROM Usuarios WHERE Usuario = 'domiciliario'
 );

-- ─────────────────────────────────────────────────────────────────────────────
-- Verificación final
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 'Migracion Domiciliarios aplicada correctamente' AS Status;

SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
  FROM INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME   = 'Domicilios'
   AND COLUMN_NAME IN (
       'Estado', 'TokenSeguimiento', 'PuedeEditarHasta',
       'FechaRecogida', 'ObservacionCliente', 'FechaObservacion', 'OrigenPedido'
   )
 ORDER BY ORDINAL_POSITION;
-- VERIFICACIÓN FINAL
-- =====================================================
SELECT '✅ Base de datos RestauranteBD (Core + Inventario + Domicilios) creada exitosamente' AS Status;