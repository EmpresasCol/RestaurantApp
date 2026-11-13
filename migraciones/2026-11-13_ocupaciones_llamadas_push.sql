-- Qpro · 13/11/2026 · Visitas de mesa (ocupaciones), llamadas al mesero y avisos al comensal.
-- Ejecutar una vez en TiDB Cloud (SQL Editor) ANTES de desplegar la API nueva.
-- Es idempotente: se puede repetir. Funciona en MySQL 8/9 y en TiDB. No toca ningún ENUM.
--
-- Ocupaciones          → una visita a la mesa: se abre con el primer pedido y se cierra al saldar o
--                        cancelar todo. Token = llave de seguimiento del comensal; Pin = código de
--                        6 dígitos para sumar a otro comensal. Abierta = 1 mientras dura y NULL al
--                        cerrar: el índice único (MesaId, Abierta) impide dos visitas abiertas.
-- Pedidos.OcupacionId  → visita a la que pertenece el pedido (NULL en el historial anterior).
-- LlamadasMesero       → "Llamar al mesero" desde el QR; Activa = 1 mientras está Pendiente o
--                        EnCamino (una sola viva por mesa).
-- SuscripcionesPush    → navegadores suscritos a los avisos (Web Push) de una visita.

CREATE TABLE IF NOT EXISTS Ocupaciones (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    MesaId INT NOT NULL,
    Token CHAR(32) NOT NULL,
    Pin CHAR(6) NOT NULL,
    IntentosPin INT NOT NULL DEFAULT 0,
    Inicio DATETIME NOT NULL,
    Cierre DATETIME NULL,
    Abierta TINYINT(1) NULL DEFAULT 1,
    UNIQUE INDEX ux_ocupaciones_token (Token),
    UNIQUE INDEX ux_ocupaciones_mesa_abierta (MesaId, Abierta),
    FOREIGN KEY (MesaId) REFERENCES Mesas(Id) ON DELETE CASCADE
);

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Pedidos' AND COLUMN_NAME = 'OcupacionId') = 0,
              'ALTER TABLE Pedidos ADD COLUMN OcupacionId INT NULL',
              'SELECT 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Pedidos' AND INDEX_NAME = 'idx_pedidos_ocupacion') = 0,
              'ALTER TABLE Pedidos ADD INDEX idx_pedidos_ocupacion (OcupacionId)',
              'SELECT 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;

CREATE TABLE IF NOT EXISTS LlamadasMesero (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    MesaId INT NOT NULL,
    OcupacionId INT NULL,
    Clave CHAR(24) NOT NULL,
    Fecha DATETIME NOT NULL,
    Estado VARCHAR(10) NOT NULL DEFAULT 'Pendiente',
    MeseroId INT NULL,
    FechaTomada DATETIME NULL,
    FechaAtendida DATETIME NULL,
    Activa TINYINT(1) NULL DEFAULT 1,
    UNIQUE INDEX ux_llamadas_clave (Clave),
    UNIQUE INDEX ux_llamadas_mesa_activa (MesaId, Activa),
    INDEX idx_llamadas_mesa_fecha (MesaId, Fecha),
    FOREIGN KEY (MesaId) REFERENCES Mesas(Id) ON DELETE CASCADE,
    FOREIGN KEY (MeseroId) REFERENCES Usuarios(Id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS SuscripcionesPush (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    OcupacionId INT NOT NULL,
    Endpoint VARCHAR(1000) NOT NULL,
    Huella CHAR(64) NOT NULL,
    Fecha DATETIME NOT NULL,
    UNIQUE INDEX ux_suscripciones_huella (Huella),
    INDEX idx_suscripciones_ocupacion (OcupacionId),
    FOREIGN KEY (OcupacionId) REFERENCES Ocupaciones(Id) ON DELETE CASCADE
);

-- Mesas que ya tienen pedidos abiertos al migrar: reciben su visita para que el personal vea el
-- código y los pedidos en curso entren al seguimiento. La llave generada aquí no se entrega a nadie.
INSERT INTO Ocupaciones (MesaId, Token, Pin, Inicio, Abierta)
SELECT p.MesaId, MD5(CONCAT(UUID(), RAND(), p.MesaId, RAND())), LPAD(FLOOR(RAND() * 1000000), 6, '0'), MIN(p.Fecha), 1
FROM Pedidos p
WHERE p.Estado IN ('EnProceso', 'Listo', 'Entregado')
  AND NOT EXISTS (SELECT 1 FROM Ocupaciones o WHERE o.MesaId = p.MesaId AND o.Abierta = 1)
GROUP BY p.MesaId;

UPDATE Pedidos p
JOIN Ocupaciones o ON o.MesaId = p.MesaId AND o.Abierta = 1
SET p.OcupacionId = o.Id
WHERE p.OcupacionId IS NULL AND p.Estado IN ('EnProceso', 'Listo', 'Entregado');
