# Backups de BD QPro

Este directorio contiene los dumps oficiales de la BD `qpro_dev` y del filestore de Odoo.

Los archivos están versionados con **Git LFS**. Asegúrate de tener Git LFS instalado:
```bash
git lfs install
```

Después de cada `git pull`, ejecuta:
```bash
git lfs pull
```

Para descargar el contenido real de los archivos LFS.

---

## Flujo de relevo (LEER ANTES DE TRABAJAR)

QPro se desarrolla en relevos secuenciales. **Nunca trabajéis dos personas al mismo tiempo.**

### Antes de empezar tu sesión

```bash
git pull
git lfs pull
cd Odoo
.\scripts\restore.ps1     # (Windows) o ./scripts/restore.sh (Mac/Linux)
```

### Al terminar tu sesión

```bash
cd Odoo
.\scripts\backup.ps1      # (Windows) o ./scripts/backup.sh (Mac/Linux)
```

Edita este README añadiendo tu entrada al final del log y luego:

```bash
git add Odoo/db_backups/ Odoo/addons/ docs/
git commit -m "backup: <tu nombre> - <descripción>"
git push
```

Avisa al equipo en el chat: **"Subí backup, podéis tomar el relevo."**

---

## Log de relevos

Cada miembro añade una entrada al terminar su sesión. Formato: