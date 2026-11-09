-- Qpro · 01/11/2026 · Ocultar platillos, desactivar usuarios y código secreto del QR de cada mesa.
-- Ejecutar una vez en TiDB Cloud (SQL Editor) ANTES de desplegar la API nueva.
-- Es idempotente: se puede repetir. Funciona en MySQL 8/9 y en TiDB.
--
-- Platillos.Activo  = 0 → no sale en la carta ni se puede pedir (en vez de borrar si ya tiene ventas).
-- Usuarios.Activo   = 0 → no puede iniciar sesión (en vez de borrar si tiene pedidos o domicilios).
-- Mesas.CodigoQR    → el comensal pide con este código, no con el Id de la mesa. La API lo
--                     genera al azar la primera vez que el administrador abre "Códigos QR".
--                     Los QR impresos antes de esta migración dejan de servir: hay que reimprimirlos.

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Platillos' AND COLUMN_NAME = 'Activo') = 0,
              'ALTER TABLE Platillos ADD COLUMN Activo BOOLEAN NOT NULL DEFAULT TRUE',
              'SELECT 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Usuarios' AND COLUMN_NAME = 'Activo') = 0,
              'ALTER TABLE Usuarios ADD COLUMN Activo BOOLEAN NOT NULL DEFAULT TRUE',
              'SELECT 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Mesas' AND COLUMN_NAME = 'CodigoQR') = 0,
              'ALTER TABLE Mesas ADD COLUMN CodigoQR VARCHAR(32) NULL',
              'SELECT 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Mesas' AND INDEX_NAME = 'uq_mesas_codigoqr') = 0,
              'ALTER TABLE Mesas ADD UNIQUE INDEX uq_mesas_codigoqr (CodigoQR)',
              'SELECT 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;
