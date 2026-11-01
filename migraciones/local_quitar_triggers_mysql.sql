-- Qpro · 03/11/2026 · SOLO para el MySQL local de desarrollo. No hace falta en TiDB (no tiene triggers).
--
-- La base local conserva triggers de un esquema anterior que ya no existen en producción ni en
-- restaurantebd.sql. Hoy la API hace ese trabajo (InventarioService descuenta por recetas y los
-- controladores marcan la mesa), así que estos triggers duplican el descuento de inventario y,
-- además, fallan: trg_pedidodetalle_after_update llama a sp_consumir_ingredientes_fifo, que hace
-- COMMIT dentro del trigger ("Explicit or implicit commit is not allowed in stored function or trigger").
-- Por eso falla PUT api/pedidos/{id}/preparar (cocina: "Empezar a preparar") solo en local.
--
-- Antes de ejecutarlo, si quieres un respaldo de los triggers:
--   mysqldump -uroot -p --no-data --no-create-info --triggers restaurantebd > triggers_respaldo.sql

DROP TRIGGER IF EXISTS trg_pedido_after_insert;
DROP TRIGGER IF EXISTS trg_pedido_after_update;
DROP TRIGGER IF EXISTS trg_pedidodetalle_after_update;
DROP TRIGGER IF EXISTS trg_pedidodetalle_cancelado;
DROP TRIGGER IF EXISTS trg_domicilio_actualizar_subtotal_insert;
DROP TRIGGER IF EXISTS trg_domicilio_actualizar_subtotal_update;
DROP TRIGGER IF EXISTS trg_domicilio_actualizar_subtotal_delete;
DROP TRIGGER IF EXISTS trg_domicilio_cambio_estado;
