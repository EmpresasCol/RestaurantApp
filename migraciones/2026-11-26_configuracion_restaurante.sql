-- Qpro · 26/11/2026 · Configuración del restaurante (personalización del administrador).
-- Ejecutar una vez en TiDB Cloud (SQL Editor) ANTES de desplegar la API nueva. Seleccionar todo antes de Run.
-- Es idempotente: se puede repetir. Funciona en MySQL 8/9 y en TiDB. No toca ninguna tabla existente.
-- Si la API nueva corre sin esta tabla, usa los valores de fábrica (todo se ve como antes) y no deja guardar.
--
-- ConfiguracionRestaurante → una fila: nombre, eslogan, logo (data URI), colores de marca y de acciones,
--                            carta del comensal (bienvenida, horario, WhatsApp, Instagram, pedidos por QR),
--                            pie y logo de la factura, propina sugerida, costo del envío y tiempos de cocina.

CREATE TABLE IF NOT EXISTS ConfiguracionRestaurante (
    Id INT PRIMARY KEY,
    Nombre VARCHAR(60) NOT NULL DEFAULT 'Qpro',
    Eslogan VARCHAR(120) NULL,
    Logo MEDIUMTEXT NULL,
    ColorMarca CHAR(7) NOT NULL DEFAULT '#C8955E',
    ColorAccion CHAR(7) NOT NULL DEFAULT '#2A1D15',
    MensajeBienvenida VARCHAR(200) NULL,
    Horario VARCHAR(120) NULL,
    Whatsapp VARCHAR(15) NULL,
    Instagram VARCHAR(60) NULL,
    PedidosQR TINYINT(1) NOT NULL DEFAULT 1,
    PieFactura VARCHAR(200) NULL,
    LogoEnFactura TINYINT(1) NOT NULL DEFAULT 0,
    PropinaSugerida INT NOT NULL DEFAULT 10,
    CostoEnvio DECIMAL(10,2) NOT NULL DEFAULT 3000.00,
    MinutosAlerta INT NOT NULL DEFAULT 10,
    MinutosUrgente INT NOT NULL DEFAULT 15,
    FechaActualizacion DATETIME NULL
);
