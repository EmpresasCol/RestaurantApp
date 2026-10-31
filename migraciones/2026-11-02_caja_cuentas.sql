-- Qpro · 02/11/2026 · Caja: precio congelado por plato y una factura por cuenta de mesa.
-- Ejecutar una vez en TiDB Cloud (SQL Editor) ANTES de desplegar la API nueva.
-- Es idempotente: se puede repetir. Funciona en MySQL 8/9 y en TiDB.
--
-- PedidoDetalles.PrecioUnitario → precio de la carta cuando se pidió el plato. Si después
--                                 cambia el precio, la cuenta y los reportes no cambian.
-- Pagos.FacturaId               → una factura puede cubrir varios pedidos de la misma mesa
--                                 (cada envío del QR es un pedido aparte).

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PedidoDetalles' AND COLUMN_NAME = 'PrecioUnitario') = 0,
              'ALTER TABLE PedidoDetalles ADD COLUMN PrecioUnitario DECIMAL(10,2) NULL',
              'SELECT 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;

-- Los platos que ya existían toman el precio actual de la carta (lo más cercano que hay).
UPDATE PedidoDetalles d
JOIN Platillos p ON p.Id = d.PlatilloId
SET d.PrecioUnitario = p.Precio
WHERE d.PrecioUnitario IS NULL;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Pagos' AND COLUMN_NAME = 'FacturaId') = 0,
              'ALTER TABLE Pagos ADD COLUMN FacturaId INT NULL',
              'SELECT 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Pagos' AND INDEX_NAME = 'idx_pagos_factura') = 0,
              'ALTER TABLE Pagos ADD INDEX idx_pagos_factura (FacturaId)',
              'SELECT 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;

-- Las facturas que ya existían cubren solo su pago.
UPDATE Pagos pa
JOIN Facturas f ON f.PagoId = pa.Id
SET pa.FacturaId = f.Id
WHERE pa.FacturaId IS NULL;
