-- Qpro · 04/11/2026 · Cuentas compartidas, pagos avisados por el mesero, domicilios con factura y cierre de caja.
-- Ejecutar una vez en TiDB Cloud (SQL Editor) ANTES de desplegar la API nueva.
-- Es idempotente: se puede repetir. Funciona en MySQL 8/9 y en TiDB. No toca ningún ENUM.
--
-- PedidoDetalles.FacturaId      → cada plato sabe en qué factura se cobró: así se divide la cuenta
--                                 por consumo (cada quien paga lo suyo, incluso 1 de 2 cervezas).
-- Pedidos.FechaEdicion          → el mesero editó el pedido: la cocina lo ve resaltado.
-- Facturas.PagoId NULL          → la factura de un domicilio no tiene pago de mesa.
-- Facturas.DomicilioId          → factura del domicilio (se emite al entregarlo y cobrarlo).
-- SolicitudesCuenta.Propina     → propina que avisó el mesero.
-- PagosAvisados                 → cómo pagó la mesa según el mesero: uno o varios pagos (pago dividido),
--                                 cada transferencia con su foto. FacturaId = ya se usó en un cobro.
-- Domicilios.InicioPreparacion  → la cocina empezó el domicilio (antes el cliente aún puede editarlo).
-- Domicilios.PagaCon            → billete con que paga el cliente: el domiciliario lleva el cambio.
-- Domicilios.ComprobantePago    → foto de la transferencia que recibió el domiciliario.
-- Domicilios.FechaLiquidacion   → la caja recibió el efectivo que cobró el domiciliario.
-- CierresCaja                   → base, conteo y diferencias del cierre de cada día.

-- ── PedidoDetalles.FacturaId ─────────────────────────────────────────────
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PedidoDetalles' AND COLUMN_NAME = 'FacturaId') = 0,
              'ALTER TABLE PedidoDetalles ADD COLUMN FacturaId INT NULL',
              'SELECT 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PedidoDetalles' AND INDEX_NAME = 'idx_detalles_factura') = 0,
              'ALTER TABLE PedidoDetalles ADD INDEX idx_detalles_factura (FacturaId)',
              'SELECT 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;

-- Lo ya cobrado: antes había un pago por pedido, así que todos sus platos van en esa factura.
UPDATE PedidoDetalles d
JOIN Pagos pa ON pa.PedidoId = d.PedidoId
SET d.FacturaId = pa.FacturaId
WHERE d.FacturaId IS NULL AND pa.FacturaId IS NOT NULL;

-- ── Pedidos.FechaEdicion ─────────────────────────────────────────────────
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Pedidos' AND COLUMN_NAME = 'FechaEdicion') = 0,
              'ALTER TABLE Pedidos ADD COLUMN FechaEdicion DATETIME NULL',
              'SELECT 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;

-- ── Facturas: domicilios ─────────────────────────────────────────────────
ALTER TABLE Facturas MODIFY COLUMN PagoId INT NULL;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Facturas' AND COLUMN_NAME = 'DomicilioId') = 0,
              'ALTER TABLE Facturas ADD COLUMN DomicilioId INT NULL',
              'SELECT 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Facturas' AND INDEX_NAME = 'ux_facturas_domicilio') = 0,
              'ALTER TABLE Facturas ADD UNIQUE INDEX ux_facturas_domicilio (DomicilioId)',
              'SELECT 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;

-- ── Pagos avisados por el mesero ─────────────────────────────────────────
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'SolicitudesCuenta' AND COLUMN_NAME = 'Propina') = 0,
              'ALTER TABLE SolicitudesCuenta ADD COLUMN Propina DECIMAL(10,2) NULL',
              'SELECT 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;

CREATE TABLE IF NOT EXISTS PagosAvisados (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    SolicitudId INT NOT NULL,
    MetodoPago VARCHAR(10) NOT NULL,
    Monto DECIMAL(10,2) NOT NULL,
    Comprobante MEDIUMTEXT NULL,
    Fecha DATETIME NOT NULL,
    FacturaId INT NULL,
    INDEX idx_avisados_solicitud (SolicitudId),
    FOREIGN KEY (SolicitudId) REFERENCES SolicitudesCuenta(Id) ON DELETE CASCADE
);

-- ── Domicilios ───────────────────────────────────────────────────────────
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Domicilios' AND COLUMN_NAME = 'InicioPreparacion') = 0,
              'ALTER TABLE Domicilios ADD COLUMN InicioPreparacion DATETIME NULL',
              'SELECT 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Domicilios' AND COLUMN_NAME = 'PagaCon') = 0,
              'ALTER TABLE Domicilios ADD COLUMN PagaCon DECIMAL(10,2) NULL',
              'SELECT 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Domicilios' AND COLUMN_NAME = 'ComprobantePago') = 0,
              'ALTER TABLE Domicilios ADD COLUMN ComprobantePago MEDIUMTEXT NULL',
              'SELECT 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Domicilios' AND COLUMN_NAME = 'FechaLiquidacion') = 0,
              'ALTER TABLE Domicilios ADD COLUMN FechaLiquidacion DATETIME NULL',
              'SELECT 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;

-- Los domicilios que ya se entregaron se dan por liquidados (su efectivo ya llegó a caja).
UPDATE Domicilios SET FechaLiquidacion = FechaEntrega
WHERE Estado = 'Entregado' AND FechaLiquidacion IS NULL;

-- Los que ya estaban en cocina se dan por empezados.
UPDATE Domicilios SET InicioPreparacion = FechaPedido
WHERE Estado <> 'EnPreparacion' AND InicioPreparacion IS NULL;

-- ── Cierre de caja ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS CierresCaja (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    FechaCaja DATE NOT NULL,
    Base DECIMAL(12,2) NOT NULL DEFAULT 0,
    UsuarioAperturaId INT NULL,
    FechaApertura DATETIME NULL,
    PropinasPagadas DECIMAL(12,2) NOT NULL DEFAULT 0,
    Retiros DECIMAL(12,2) NOT NULL DEFAULT 0,
    EfectivoEsperado DECIMAL(12,2) NULL,
    EfectivoContado DECIMAL(12,2) NULL,
    TarjetaDatafono DECIMAL(12,2) NULL,
    TransferenciasBanco DECIMAL(12,2) NULL,
    Observaciones VARCHAR(500) NULL,
    UsuarioCierreId INT NULL,
    FechaCierre DATETIME NULL,
    UNIQUE INDEX ux_cierres_fecha (FechaCaja)
);
