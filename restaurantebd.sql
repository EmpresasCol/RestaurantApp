-- Crear Base de Datos -------
CREATE DATABASE IF NOT EXISTS RestauranteBD;
USE RestauranteBD;
----
-- Tablas
CREATE TABLE Usuarios (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    Nombre VARCHAR(100) NOT NULL,
    Usuario VARCHAR(50) UNIQUE NOT NULL,
    ClaveHash VARCHAR(255) NOT NULL,
    Rol ENUM('Administrador','Mesero','Cocina','Caja') NOT NULL
);

CREATE TABLE Mesas (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    Numero INT NOT NULL,
    Estado ENUM('Disponible','Ocupada','EsperandoPago') DEFAULT 'Disponible'
);

CREATE TABLE Platillos (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    Nombre VARCHAR(100) NOT NULL,
    Descripcion TEXT,
    Precio DECIMAL(10,2) NOT NULL,
    ImagenUrl VARCHAR(255),
    Categoria VARCHAR(50) NOT NULL DEFAULT 'Platos Principales'
);

CREATE TABLE Pedidos (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    MesaId INT NOT NULL,
    UsuarioId INT NOT NULL,
    Estado ENUM('EnProceso','Listo','Entregado','Pagado','Cancelado') DEFAULT 'EnProceso',
    Fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (MesaId) REFERENCES Mesas(Id),
    FOREIGN KEY (UsuarioId) REFERENCES Usuarios(Id)
);

CREATE TABLE PedidoDetalles (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    PedidoId INT NOT NULL,
    PlatilloId INT NOT NULL,
    Cantidad INT NOT NULL,
    Nota TEXT,
    Estado ENUM('Pendiente','EnPreparacion','Listo') DEFAULT 'Pendiente',
    FOREIGN KEY (PedidoId) REFERENCES Pedidos(Id),
    FOREIGN KEY (PlatilloId) REFERENCES Platillos(Id)
);

CREATE TABLE Pagos (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    PedidoId INT NOT NULL,
    Monto DECIMAL(10,2) NOT NULL,
    MontoPropina DECIMAL(10,2) DEFAULT 0.00,
    MetodoPago ENUM('Efectivo','Tarjeta','QR','Otro') NOT NULL,
    Fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (PedidoId) REFERENCES Pedidos(Id)
);

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
    FOREIGN KEY (PagoId) REFERENCES Pagos(Id)
);

-- Datos Iniciales
INSERT INTO Usuarios (Nombre, Usuario, ClaveHash, Rol) VALUES
('Admin Principal', 'admin', '123456', 'Administrador'),
('Juan Pérez', 'juan.mesero', '123456', 'Mesero'),
('María García', 'maria.mesero', '123456', 'Mesero'),
('Carlos López', 'carlos.cocina', '123456', 'Cocina'),
('Ana Martínez', 'ana.cocina', '123456', 'Cocina'),
('Pedro Rodríguez', 'pedro.caja', '123456', 'Caja'),
('Laura Fernández', 'laura.caja', '123456', 'Caja');

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

INSERT INTO Platillos (Nombre, Descripcion, Precio, ImagenUrl, Categoria) VALUES
('Hamburguesa Clásica', 'Hamburguesa de carne con lechuga, tomate, queso y papas fritas', 25000.00, 'https://cdn.pixabay.com/photo/2016/03/05/19/02/hamburger-1238246_1280.jpg', 'Platos Principales'),
('Pizza Margarita', 'Pizza con salsa de tomate, mozzarella fresca y albahaca', 35000.00, 'https://cdn.pixabay.com/photo/2017/12/09/08/18/pizza-3007395_1280.jpg', 'Platos Principales'),
('Ensalada César', 'Lechuga romana, crutones, queso parmesano y aderezo césar', 18000.00, 'https://www.gourmet.cl/wp-content/uploads/2016/09/EnsaladaCesar2.webp', 'Ensaladas'),
('Pasta Carbonara', 'Pasta con salsa cremosa, tocino y queso parmesano', 28000.00, 'https://cdn.pixabay.com/photo/2018/07/18/19/12/pasta-3547078_1280.jpg', 'Platos Principales'),
('Tacos al Pastor', 'Tres tacos de cerdo marinado con piña, cebolla y cilantro', 22000.00, 'https://cdn.pixabay.com/photo/2017/06/29/20/09/mexican-2456038_1280.jpg', 'Platos Principales'),
('Salmón a la Parrilla', 'Filete de salmón con verduras al vapor y arroz', 48000.00, 'https://cdn.pixabay.com/photo/2014/11/05/15/57/salmon-518032_1280.jpg', 'Platos Principales'),
('Sopa de Tomate', 'Sopa cremosa de tomate con crutones', 14000.00, 'https://www.unileverfoodsolutions.com.co/dam/global-ufs/mcos/nola/colombia/calcmenu/recipes/CO-recipes/soups/sopa-de-tomates-rostizados/main-header.jpg', 'Sopas'),
('Pollo Teriyaki', 'Pechuga de pollo con salsa teriyaki y arroz', 30000.00, 'https://cocinaconcoqui.com/wp-content/uploads/2022/04/Pollo-teriyaki-con-arroz-casero-480x270.png', 'Platos Principales'),
('Brownie con Helado', 'Brownie de chocolate caliente con helado de vainilla', 16000.00, 'https://cdn.pixabay.com/photo/2014/11/28/08/03/brownie-548591_1280.jpg', 'Postres'),
('Limonada Natural', 'Limonada recién hecha', 7000.00, 'https://cdn.pixabay.com/photo/2016/07/21/11/17/drink-1532300_1280.jpg', 'Bebidas'),
('Café Americano', 'Café negro recién preparado', 5000.00, 'https://cdn.recetasderechupete.com/wp-content/uploads/2023/11/Cafe-americano-portada.jpg', 'Bebidas'),
('Cerveza Artesanal', 'Cerveza local artesanal', 12000.00, 'https://politecnicointernacional.edu.co/wp-content/uploads/2025/07/trigo-y-jarras-de-cerveza-de-angulo-alto-scaled.jpg', 'Bebidas');

INSERT INTO Pedidos (MesaId, UsuarioId, Estado, Fecha) VALUES
(2, 2, 'EnProceso', '2025-10-15 12:30:00'),
(3, 3, 'Listo', '2025-10-15 12:45:00'),
(5, 2, 'Pagado', '2025-10-15 11:30:00'),
(7, 3, 'EnProceso', '2025-10-15 13:00:00');

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

INSERT INTO Pagos (PedidoId, Monto, MontoPropina, MetodoPago, Fecha) VALUES
(3, 232.00, 30.00, 'Tarjeta', '2025-10-15 12:15:00');

INSERT INTO Facturas (PagoId, NumeroFactura, NitCliente, NombreCliente, Subtotal, Propina, Total, ArchivoUrl, FechaEmision) VALUES
(1, 'FACT-2025-000001', '1234567890', 'Roberto Sánchez', 232.00, 30.00, 262.00, '/facturas/2025/10/FACT-2025-000001.pdf', '2025-10-15 12:15:00');