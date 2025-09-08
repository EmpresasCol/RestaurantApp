create database RestauranteBD;
use RestauranteBD;
-- Usuarios del sistema (meseros, cocina, caja, admin)
CREATE TABLE Usuarios (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    Nombre VARCHAR(100) NOT NULL,
    Usuario VARCHAR(50) UNIQUE NOT NULL,
    ClaveHash VARCHAR(255) NOT NULL,
    Rol ENUM('Mesero','Cocina','Caja','Admin') NOT NULL
);

-- Mesas del restaurante
CREATE TABLE Mesas (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    Numero INT NOT NULL,
    Estado ENUM('Disponible','Ocupada','EsperandoPago') DEFAULT 'Disponible'
);

-- Platillos del menú
CREATE TABLE Platillos (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    Nombre VARCHAR(100) NOT NULL,
    Descripcion TEXT,
    Precio DECIMAL(10,2) NOT NULL,
    ImagenUrl VARCHAR(255)
);

-- Pedidos realizados en mesas
CREATE TABLE Pedidos (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    MesaId INT NOT NULL,
    UsuarioId INT NOT NULL, -- Mesero que tomó el pedido
    Estado ENUM('EnProceso','Listo','Pagado') DEFAULT 'EnProceso',
    Fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (MesaId) REFERENCES Mesas(Id),
    FOREIGN KEY (UsuarioId) REFERENCES Usuarios(Id)
);

-- Detalles de los pedidos (cada platillo y cantidad)
CREATE TABLE PedidoDetalles (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    PedidoId INT NOT NULL,
    PlatilloId INT NOT NULL,
    Cantidad INT NOT NULL,
    Estado ENUM('Pendiente','EnPreparacion','Listo') DEFAULT 'Pendiente',
    FOREIGN KEY (PedidoId) REFERENCES Pedidos(Id),
    FOREIGN KEY (PlatilloId) REFERENCES Platillos(Id)
);

-- Pagos (para cuando el cliente paga la cuenta)
CREATE TABLE Pagos (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    PedidoId INT NOT NULL,
    Monto DECIMAL(10,2) NOT NULL,
    MetodoPago ENUM('Efectivo','Tarjeta','QR','Otro') NOT NULL,
    Fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (PedidoId) REFERENCES Pedidos(Id)
);
