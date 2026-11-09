-- Qpro · 05/11/2026 · Recepciones de mercancía con fotos de evidencia.
-- Ejecutar una vez en TiDB Cloud (SQL Editor) ANTES de desplegar la API nueva.
-- Es idempotente: se puede repetir. Funciona en MySQL 8/9 y en TiDB. No toca ningún ENUM.
--
-- Recepciones     → cada entrada de mercancía: proveedor, orden, factura o remisión, quién la recibió y el total.
--                   Antes el proveedor de una compra directa y la factura de una orden se perdían.
-- RecepcionFotos  → fotos de lo que llegó (factura, cajas, producto dañado), varias por recepción.
--                   Data URI JPEG reducido en el navegador (~150-300 KB cada una).

CREATE TABLE IF NOT EXISTS Recepciones (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    Fecha DATETIME NOT NULL,
    UsuarioId INT NULL,
    ProveedorId INT NULL,
    OrdenCompraId INT NULL,
    Documento VARCHAR(60) NULL,
    Lineas INT NOT NULL DEFAULT 0,
    Total DECIMAL(12,2) NOT NULL DEFAULT 0,
    INDEX idx_recepciones_fecha (Fecha),
    INDEX idx_recepciones_orden (OrdenCompraId)
);

CREATE TABLE IF NOT EXISTS RecepcionFotos (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    RecepcionId INT NOT NULL,
    Foto MEDIUMTEXT NOT NULL,
    Fecha DATETIME NOT NULL,
    INDEX idx_fotos_recepcion (RecepcionId),
    FOREIGN KEY (RecepcionId) REFERENCES Recepciones(Id) ON DELETE CASCADE
);
