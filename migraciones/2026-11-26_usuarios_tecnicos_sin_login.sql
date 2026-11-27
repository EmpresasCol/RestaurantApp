-- Qpro · 26/11/2026 · Usuarios técnicos sin clave utilizable.
-- Ejecutar una vez en TiDB Cloud (SQL Editor). Es idempotente y funciona en MySQL 8/9 y en TiDB.
--
-- 'cliente_qr' y 'cliente_publico' solo firman los pedidos del menú QR y de la página pública de
-- domicilios (la FK de Pedidos/Domicilios lo exige). La semilla creaba 'cliente_qr' con la clave
-- '123' y rol Mesero: cualquiera podía entrar a la app móvil como mesero. La API ya los rechaza en
-- el login; esto además reemplaza su clave por un valor aleatorio que nadie conoce.

UPDATE Usuarios
   SET ClaveHash = CONCAT('!sin-login!', LEFT(SHA2(UUID(), 256), 49))
 WHERE Usuario IN ('cliente_qr', 'cliente_publico')
   AND ClaveHash NOT LIKE '!sin-login!%';

-- Revisión: usuarios activos cuya clave sigue en texto plano (nunca han entrado desde la migración
-- a BCrypt). Cámbiales la clave desde Administración → Usuarios.
SELECT Id, Usuario, Rol
  FROM Usuarios
 WHERE Activo = 1
   AND ClaveHash NOT LIKE '$2%'
   AND ClaveHash NOT LIKE '!sin-login!%';
