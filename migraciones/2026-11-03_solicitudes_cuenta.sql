-- Qpro · 03/11/2026 · App del mesero: solicitud de cuenta con el comprobante de pago.
-- Ejecutar una vez en TiDB Cloud (SQL Editor) ANTES de desplegar la API nueva.
-- Es idempotente: se puede repetir. Funciona en MySQL 8/9 y en TiDB.
--
-- El mesero pide la cuenta de una mesa (la caja la imprime) y luego avisa cómo pagó el cliente:
-- efectivo que lleva a caja, tarjeta en el datáfono o transferencia al QR del negocio (con foto).
-- La caja hace el cobro real (POST api/pagos/cobro) y la solicitud queda ligada a la factura.

CREATE TABLE IF NOT EXISTS SolicitudesCuenta (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    MesaId INT NOT NULL,
    UsuarioId INT NOT NULL,
    Fecha DATETIME NOT NULL,
    MetodoPago VARCHAR(10) NULL,
    Comprobante MEDIUMTEXT NULL,
    FechaPago DATETIME NULL,
    Estado VARCHAR(10) NOT NULL DEFAULT 'Pendiente',
    FacturaId INT NULL,
    INDEX idx_solicitudes_mesa_estado (MesaId, Estado),
    FOREIGN KEY (MesaId) REFERENCES Mesas(Id) ON DELETE RESTRICT,
    FOREIGN KEY (UsuarioId) REFERENCES Usuarios(Id) ON DELETE RESTRICT
);
