#!/bin/bash

###############################################################################
# INSTALACIÓN RÁPIDA - Corrección UTF-8
# Sistema de Facturación - Restaurante Dálice
###############################################################################

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║     INSTALACIÓN RÁPIDA - Corrección de Codificación UTF-8     ║"
echo "║          Sistema de Facturación - Restaurante Dálice          ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para imprimir con color
print_success() { echo -e "${GREEN}✓ $1${NC}"; }
print_error() { echo -e "${RED}✗ $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠ $1${NC}"; }

###############################################################################
# PASO 1: Detectar proyecto
###############################################################################

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PASO 1: Detectando proyecto React..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Buscar package.json
if [ -f "package.json" ]; then
    PROJECT_DIR=$(pwd)
    print_success "Proyecto encontrado: $PROJECT_DIR"
else
    print_error "No se encontró package.json en el directorio actual"
    echo ""
    print_info "Por favor, ejecuta este script desde la raíz de tu proyecto React"
    print_info "Ejemplo:"
    echo "  cd /ruta/a/tu/proyecto/mi-restaurante"
    echo "  bash quick-install.sh"
    exit 1
fi

# Verificar estructura de React
if [ ! -d "src" ]; then
    print_error "No se encontró el directorio 'src/'"
    print_info "Asegúrate de estar en la raíz del proyecto React"
    exit 1
fi

if [ ! -d "public" ]; then
    print_error "No se encontró el directorio 'public/'"
    print_info "Asegúrate de estar en la raíz del proyecto React"
    exit 1
fi

print_success "Estructura del proyecto validada"
echo ""

###############################################################################
# PASO 2: Copiar setupProxy.js
###############################################################################

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PASO 2: Instalando setupProxy.js..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

SETUP_PROXY="src/setupProxy.js"

# Verificar si ya existe
if [ -f "$SETUP_PROXY" ]; then
    print_warning "setupProxy.js ya existe"
    read -p "¿Deseas reemplazarlo? (s/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Ss]$ ]]; then
        print_info "Saltando setupProxy.js"
    else
        # Hacer backup
        cp "$SETUP_PROXY" "${SETUP_PROXY}.backup"
        print_info "Backup creado: ${SETUP_PROXY}.backup"
    fi
fi

# Crear setupProxy.js
cat > "$SETUP_PROXY" << 'EOF'
/**
 * setupProxy.js - Configuración UTF-8 para servidor de desarrollo
 * Instalado automáticamente por quick-install.sh
 */
module.exports = function(app) {
  app.use((req, res, next) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  });
};
EOF

print_success "setupProxy.js instalado en: $SETUP_PROXY"
echo ""

###############################################################################
# PASO 3: Actualizar index.html
###############################################################################

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PASO 3: Verificando public/index.html..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

INDEX_HTML="public/index.html"

if [ ! -f "$INDEX_HTML" ]; then
    print_error "No se encontró public/index.html"
    exit 1
fi

# Verificar si tiene las meta tags
if grep -q 'charset="UTF-8"' "$INDEX_HTML" || grep -q "charset='UTF-8'" "$INDEX_HTML"; then
    print_success "index.html ya tiene meta charset UTF-8"
else
    print_warning "index.html no tiene meta charset UTF-8"
    # Hacer backup
    cp "$INDEX_HTML" "${INDEX_HTML}.backup"
    print_info "Backup creado: ${INDEX_HTML}.backup"
    
    # Agregar meta tag (esto es básico, puede requerir ajuste manual)
    print_info "Por favor, verifica manualmente que index.html tenga:"
    echo "  <meta charset=\"UTF-8\">"
    echo "  <meta http-equiv=\"Content-Type\" content=\"text/html; charset=UTF-8\">"
fi

echo ""

###############################################################################
# PASO 4: Crear archivos de configuración
###############################################################################

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PASO 4: Creando archivos de configuración para producción..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Crear .htaccess
cat > "public/.htaccess" << 'EOF'
AddDefaultCharset UTF-8
AddType 'text/html; charset=UTF-8' .html
AddType 'text/css; charset=UTF-8' .css
AddType 'application/javascript; charset=UTF-8' .js

<IfModule mod_headers.c>
    Header set Content-Type "text/html; charset=utf-8"
</IfModule>

<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /
    RewriteRule ^index\.html$ - [L]
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /index.html [L]
</IfModule>
EOF

print_success "Creado: public/.htaccess (para Apache)"

# Crear web.config
cat > "public/web.config" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <staticContent>
      <remove fileExtension=".html"/>
      <mimeMap fileExtension=".html" mimeType="text/html; charset=UTF-8"/>
    </staticContent>
    <httpProtocol>
      <customHeaders>
        <add name="Content-Type" value="text/html; charset=UTF-8"/>
      </customHeaders>
    </httpProtocol>
  </system.webServer>
</configuration>
EOF

print_success "Creado: public/web.config (para IIS)"

echo ""

###############################################################################
# PASO 5: Instrucciones finales
###############################################################################

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "INSTALACIÓN COMPLETADA ✓"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
print_success "Todos los archivos de configuración han sido instalados"
echo ""
echo "┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓"
echo "┃                    SIGUIENTES PASOS                         ┃"
echo "┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛"
echo ""
echo "1️⃣  REINICIAR EL SERVIDOR DE DESARROLLO:"
echo ""
echo "   Si el servidor está corriendo, deténlo (Ctrl+C) y ejecuta:"
echo "   ${GREEN}npm start${NC}"
echo ""
echo "2️⃣  LIMPIAR CACHÉ DEL NAVEGADOR:"
echo ""
echo "   Chrome/Edge: Presiona Ctrl+Shift+Delete"
echo "   Firefox:     Presiona Ctrl+Shift+Delete"
echo "   Marca: \"Imágenes y archivos en caché\""
echo ""
echo "3️⃣  REFRESCAR LA PÁGINA:"
echo ""
echo "   Presiona: ${GREEN}Ctrl+F5${NC} (refresh forzado)"
echo "   O prueba en modo incógnito: ${GREEN}Ctrl+Shift+N${NC}"
echo ""
echo "4️⃣  VERIFICAR QUE FUNCIONA:"
echo ""
echo "   Abre tu aplicación y verifica que las palabras se vean así:"
echo "   ${GREEN}✓${NC} Facturación"
echo "   ${GREEN}✓${NC} Día"
echo "   ${GREEN}✓${NC} Délice"
echo "   ${GREEN}✓${NC} Menú"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
print_info "💡 TIP: Si el problema persiste:"
echo "   - Verifica que no haya errores en la consola del navegador (F12)"
echo "   - Prueba ejecutar: rm -rf node_modules && npm install"
echo "   - Consulta README.md y GUIA_UTF8.md para más información"
echo ""
print_success "¡Buena suerte! 🚀"
echo ""
