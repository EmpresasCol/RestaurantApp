-- Qpro · 14/11/2026 · Facturación electrónica (DIAN): datos fiscales, numeraciones y cola de documentos.
-- Ejecutar una vez en TiDB Cloud (SQL Editor) ANTES de desplegar la API nueva. Seleccionar todo antes de Run.
-- Es idempotente: se puede repetir. Funciona en MySQL 8/9 y en TiDB. No toca ningún ENUM ni borra datos.
--
-- ConfiguracionFiscal     → una fila: el restaurante como vendedor, impuesto (INC, IVA o Ninguno) y si la
--                           facturación electrónica está activa. Apagada, todo sigue como antes (FV-).
-- NumeracionesDian        → rangos autorizados por la DIAN por tipo de documento (POS o FEV).
-- DocumentosElectronicos  → cola de salida: un documento por venta (y su nota al anular) con estado,
--                           CUFE/CUDE y clave de idempotencia. La API lo envía en segundo plano.
-- Facturas                → cliente identificado (tipo y correo), impuesto discriminado y anulación.

CREATE TABLE IF NOT EXISTS ConfiguracionFiscal (
    Id INT PRIMARY KEY,
    RazonSocial VARCHAR(150) NOT NULL DEFAULT '',
    NombreComercial VARCHAR(150) NULL,
    Nit VARCHAR(15) NOT NULL DEFAULT '',
    DigitoVerificacion VARCHAR(1) NULL,
    Direccion VARCHAR(200) NULL,
    Municipio VARCHAR(100) NULL,
    Telefono VARCHAR(30) NULL,
    Correo VARCHAR(150) NULL,
    Regimen VARCHAR(200) NULL,
    TipoImpuesto VARCHAR(10) NOT NULL DEFAULT 'INC',
    TarifaImpuesto DECIMAL(5,2) NOT NULL DEFAULT 8.00,
    FacturacionElectronica TINYINT(1) NOT NULL DEFAULT 0,
    DocumentoConsumidorFinal VARCHAR(10) NOT NULL DEFAULT 'POS'
);

CREATE TABLE IF NOT EXISTS NumeracionesDian (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    TipoDocumento VARCHAR(15) NOT NULL,
    Resolucion VARCHAR(50) NULL,
    Prefijo VARCHAR(6) NOT NULL,
    Desde BIGINT NOT NULL,
    Hasta BIGINT NOT NULL,
    FechaDesde DATE NULL,
    FechaHasta DATE NULL,
    Siguiente BIGINT NOT NULL,
    Activa TINYINT(1) NOT NULL DEFAULT 1,
    INDEX idx_numeraciones_tipo (TipoDocumento, Activa)
);

CREATE TABLE IF NOT EXISTS DocumentosElectronicos (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    FacturaId INT NOT NULL,
    Tipo VARCHAR(15) NOT NULL,
    Prefijo VARCHAR(6) NOT NULL,
    Numero BIGINT NOT NULL,
    Cufe VARCHAR(120) NULL,
    Estado VARCHAR(15) NOT NULL DEFAULT 'Pendiente',
    Mensaje VARCHAR(500) NULL,
    UrlPdf VARCHAR(500) NULL,
    UrlXml VARCHAR(500) NULL,
    QrUrl VARCHAR(500) NULL,
    Intentos INT NOT NULL DEFAULT 0,
    ProximoIntento DATETIME NULL,
    FechaGeneracion DATETIME NOT NULL,
    FechaValidacion DATETIME NULL,
    DocumentoReferenciaId INT NULL,
    Motivo VARCHAR(300) NULL,
    ClaveIdempotencia VARCHAR(40) NOT NULL,
    UNIQUE INDEX ux_documentos_clave (ClaveIdempotencia),
    INDEX idx_documentos_cola (Estado, ProximoIntento),
    INDEX idx_documentos_factura (FacturaId),
    FOREIGN KEY (FacturaId) REFERENCES Facturas(Id) ON DELETE RESTRICT
);

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Facturas' AND COLUMN_NAME = 'TipoIdCliente') = 0,
              'ALTER TABLE Facturas ADD COLUMN TipoIdCliente VARCHAR(5) NULL',
              'SELECT 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Facturas' AND COLUMN_NAME = 'CorreoCliente') = 0,
              'ALTER TABLE Facturas ADD COLUMN CorreoCliente VARCHAR(150) NULL',
              'SELECT 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Facturas' AND COLUMN_NAME = 'NombreImpuesto') = 0,
              'ALTER TABLE Facturas ADD COLUMN NombreImpuesto VARCHAR(20) NULL',
              'SELECT 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Facturas' AND COLUMN_NAME = 'TarifaImpuesto') = 0,
              'ALTER TABLE Facturas ADD COLUMN TarifaImpuesto DECIMAL(5,2) NULL',
              'SELECT 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Facturas' AND COLUMN_NAME = 'BaseImpuesto') = 0,
              'ALTER TABLE Facturas ADD COLUMN BaseImpuesto DECIMAL(12,2) NULL',
              'SELECT 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Facturas' AND COLUMN_NAME = 'ValorImpuesto') = 0,
              'ALTER TABLE Facturas ADD COLUMN ValorImpuesto DECIMAL(12,2) NULL',
              'SELECT 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Facturas' AND COLUMN_NAME = 'Anulada') = 0,
              'ALTER TABLE Facturas ADD COLUMN Anulada TINYINT(1) NOT NULL DEFAULT 0',
              'SELECT 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Facturas' AND COLUMN_NAME = 'FechaAnulacion') = 0,
              'ALTER TABLE Facturas ADD COLUMN FechaAnulacion DATETIME NULL',
              'SELECT 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Facturas' AND COLUMN_NAME = 'MotivoAnulacion') = 0,
              'ALTER TABLE Facturas ADD COLUMN MotivoAnulacion VARCHAR(300) NULL',
              'SELECT 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Facturas' AND COLUMN_NAME = 'UsuarioAnulaId') = 0,
              'ALTER TABLE Facturas ADD COLUMN UsuarioAnulaId INT NULL',
              'SELECT 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Facturas' AND COLUMN_NAME = 'ReemplazaAId') = 0,
              'ALTER TABLE Facturas ADD COLUMN ReemplazaAId INT NULL',
              'SELECT 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;

-- Comprobación (debe dar 3 y 11):
-- SELECT (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()
--           AND TABLE_NAME IN ('ConfiguracionFiscal','NumeracionesDian','DocumentosElectronicos')) AS tablas,
--        (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Facturas'
--           AND COLUMN_NAME IN ('TipoIdCliente','CorreoCliente','NombreImpuesto','TarifaImpuesto','BaseImpuesto','ValorImpuesto',
--                               'Anulada','FechaAnulacion','MotivoAnulacion','UsuarioAnulaId','ReemplazaAId')) AS columnas;
