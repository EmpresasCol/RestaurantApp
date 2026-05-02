# QPro — Stack Odoo

Sistema de gestión de restaurantes desarrollado sobre Odoo 17 Community.

## Requisitos previos

Cada miembro del equipo debe tener instalado:

- **Docker Desktop** — https://docker.com/products/docker-desktop
- **Git** — https://git-scm.com/
- **Git LFS** — https://git-lfs.com/  (CRÍTICO, leer abajo)
- **Visual Studio Code** (recomendado)

### Por qué Git LFS es obligatorio

Este proyecto usa Git LFS para versionar los dumps de BD (`db_backups/*.sql` y `*.tar.gz`).

Si NO instalas Git LFS antes de clonar, los archivos `.sql` y `.tar.gz` aparecerán como punteros de texto de 130 bytes en lugar del contenido real, y la restauración fallará.

Después de instalar Git LFS, ejecuta una vez:
```bash
git lfs install
```

---

## Setup inicial (primera vez)

```bash
# 1. Clonar el repo
git clone <url-del-repo>
cd QPro
git lfs pull              # descarga los binarios LFS

# 2. Crear el archivo .env
cd Odoo
cp .env.example .env      # luego editar valores reales

# 3. Levantar contenedores
docker compose up -d

# 4. Restaurar la BD compartida
.\scripts\restore.ps1     # Windows
# o
./scripts/restore.sh      # Mac/Linux

# 5. Abrir http://localhost:8069
#    Usuario: el que figure en el último backup (ver db_backups/README.md)
```

---

## Flujo de trabajo en equipo (RELEVOS)

QPro se desarrolla en **relevos secuenciales**. Solo una persona trabaja a la vez.

### Al empezar tu sesión

```bash
git pull
git lfs pull
cd Odoo
.\scripts\restore.ps1     # restaura la BD del último relevo
```

### Al terminar tu sesión

```bash
cd Odoo
.\scripts\backup.ps1
# Edita db_backups/README.md con tu entrada
git add Odoo/db_backups/ Odoo/addons/ docs/
git commit -m "backup: <tu nombre> - <descripción>"
git push
```

**Avisa al equipo en el chat antes y después de tu sesión.**

---

## Comandos del día a día (durante una sesión)

```bash
# Levantar contenedores (si no están)
docker compose up -d

# Ver logs en vivo
docker compose logs -f odoo

# Reiniciar Odoo (después de cambiar Python)
docker compose restart odoo

# Actualizar un módulo (después de cambiar XML/Python)
docker compose exec odoo odoo -d qpro_dev -u qpro_orders --stop-after-init
docker compose restart odoo

# Apagar contenedores
docker compose down
```

---

## Estructura de módulos

- `addons/qpro_core/` — Restaurantes (entidad base)
- `addons/qpro_orders/` — Mesas, pedidos, líneas de pedido

## Documentación adicional

- Mapeo de migración MySQL → Odoo: `../docs/MAPPING.md`
- Log de relevos: `db_backups/README.md`

---

## Resolución de problemas comunes

**"git lfs: command not found"** → No tienes Git LFS instalado. Instala desde git-lfs.com.

**Al restaurar dice "el archivo SQL es un puntero LFS"** → Ejecuta `git lfs pull`.

**El restore falla con "database is being accessed by other users"** → Cierra todas las pestañas del navegador con Odoo abierto y vuelve a intentar.

**No veo los menús QPro** → Ve a Ajustes → Usuarios → tu usuario → Permisos de acceso → QPro → asigna "Administrador QPro".