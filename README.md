# RestaurantApp - Sistema de Inventario

Sistema completo de gestión de inventario para restaurantes desarrollado con ASP.NET Core Web API y React.

## Características

### 1. Gestión de Productos e Insumos
- ✅ Registro completo de ingredientes, bebidas, materiales y productos terminados
- ✅ Clasificación por categorías (carnes, verduras, bebidas, limpieza, etc.)
- ✅ Información detallada: unidad de medida, proveedor, precio de compra, costo promedio
- ✅ Control de productos con caducidad (fecha de vencimiento y lote)

### 2. Control de Existencias
- ✅ Visualización en tiempo real de la cantidad disponible de cada producto
- ✅ Alertas de stock mínimo y máximo
- ✅ Control de múltiples almacenes (cocina principal, bar, bodega de bebidas, etc.)
- ✅ Movimientos de inventario (entradas, salidas, ajustes, transferencias)
- 🔄 Vinculación con módulo POS (próximamente)

## Tecnologías Utilizadas

### Backend
- ASP.NET Core 8.0 Web API
- Entity Framework Core 8.0
- SQL Server
- Swagger/OpenAPI
- AutoMapper

### Frontend
- React 18
- Vite
- React Router DOM
- Axios
- React Icons
- date-fns

## Estructura del Proyecto

```
RestaurantApp/
├── Backend/
│   └── RestaurantApp.API/
│       ├── Controllers/          # Controladores de API
│       ├── Data/                 # DbContext y configuración EF
│       ├── DTOs/                 # Data Transfer Objects
│       ├── Models/               # Modelos de base de datos
│       ├── Services/             # Servicios de negocio
│       ├── Program.cs            # Punto de entrada
│       └── appsettings.json      # Configuración
├── Frontend/
│   ├── public/
│   └── src/
│       ├── components/           # Componentes React
│       │   ├── Layout/
│       │   ├── Products/
│       │   ├── Stock/
│       │   └── Categories/
│       ├── pages/                # Páginas principales
│       │   ├── Dashboard.jsx
│       │   ├── Products.jsx
│       │   ├── Stock.jsx
│       │   ├── Movements.jsx
│       │   ├── Alerts.jsx
│       │   └── Categories.jsx
│       ├── services/             # Servicios API
│       ├── App.jsx
│       └── main.jsx
└── README.md
```

## Requisitos Previos

### Backend
- .NET 8.0 SDK o superior
- SQL Server 2019 o superior (o SQL Server Express)
- Visual Studio 2022 o Visual Studio Code

### Frontend
- Node.js 18.x o superior
- npm o yarn

## Instalación

### 1. Configurar el Backend

#### Paso 1: Configurar la cadena de conexión

Edita el archivo `Backend/RestaurantApp.API/appsettings.json` y configura tu cadena de conexión a SQL Server:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost;Database=RestaurantAppDB;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true"
  }
}
```

O si usas autenticación de SQL Server:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost;Database=RestaurantAppDB;User Id=tu_usuario;Password=tu_password;TrustServerCertificate=True;MultipleActiveResultSets=true"
  }
}
```

#### Paso 2: Instalar herramientas de Entity Framework

```bash
dotnet tool install --global dotnet-ef
```

#### Paso 3: Crear la base de datos

Desde el directorio `Backend/RestaurantApp.API/`:

```bash
# Crear la migración inicial
dotnet ef migrations add InitialCreate

# Aplicar la migración (crear la base de datos)
dotnet ef database update
```

#### Paso 4: Ejecutar el Backend

```bash
cd Backend/RestaurantApp.API
dotnet run
```

El API estará disponible en:
- HTTPS: `https://localhost:5001`
- HTTP: `http://localhost:5000`
- Swagger UI: `https://localhost:5001` (en desarrollo)

### 2. Configurar el Frontend

#### Paso 1: Instalar dependencias

```bash
cd Frontend
npm install
```

#### Paso 2: Configurar variables de entorno

Crea un archivo `.env` en el directorio `Frontend/`:

```env
VITE_API_URL=http://localhost:5000/api
```

#### Paso 3: Ejecutar el Frontend

```bash
npm run dev
```

La aplicación estará disponible en: `http://localhost:3000`

## Uso de la Aplicación

### Dashboard
- Vista general del sistema con estadísticas principales
- Productos con stock bajo
- Alertas recientes
- Últimos movimientos

### Productos e Insumos
- **Crear**: Click en "Nuevo Producto" y completa el formulario
- **Editar**: Click en el icono de editar (lápiz) en la tabla
- **Eliminar**: Click en el icono de eliminar (basurero)
- **Filtrar**: Usa la barra de búsqueda o el selector de categorías

### Control de Existencias
- Visualiza el stock actual de todos los productos
- Stock agrupado por almacenes
- Indicadores de estado (óptimo, medio, bajo)
- Registra movimientos directamente desde la tabla

### Movimientos de Inventario
- **Entrada**: Registra compras o devoluciones
- **Salida**: Registra ventas, consumos o mermas
- **Transferencia**: Mueve stock entre almacenes
- **Ajuste**: Corrige discrepancias de inventario

### Alertas
- Productos con stock bajo
- Productos próximos a vencer (30 días)
- Productos vencidos
- Filtros por tipo de alerta

### Categorías
- Gestiona las categorías de productos
- Organiza tu inventario eficientemente

## API Endpoints

### Products
- `GET /api/products` - Obtener todos los productos
- `GET /api/products/{id}` - Obtener un producto
- `GET /api/products/category/{categoryId}` - Productos por categoría
- `GET /api/products/low-stock` - Productos con stock bajo
- `POST /api/products` - Crear producto
- `PUT /api/products/{id}` - Actualizar producto
- `DELETE /api/products/{id}` - Eliminar producto

### Stock
- `GET /api/stock` - Todo el stock
- `GET /api/stock/summary` - Resumen por producto
- `GET /api/stock/product/{productId}` - Stock de un producto
- `GET /api/stock/warehouse/{warehouseId}` - Stock por almacén
- `GET /api/stock/alerts` - Alertas de stock
- `POST /api/stock/movement` - Registrar movimiento
- `POST /api/stock/adjust` - Ajustar stock
- `GET /api/stock/movements` - Historial de movimientos

### Categories
- `GET /api/categories` - Todas las categorías
- `GET /api/categories/{id}` - Una categoría
- `POST /api/categories` - Crear categoría
- `PUT /api/categories/{id}` - Actualizar categoría
- `DELETE /api/categories/{id}` - Eliminar categoría

## Configuración de Datos Iniciales

El sistema incluye datos semilla (seed data) que se crean automáticamente:

- **8 Unidades de medida**: kg, g, L, ml, u, cj, lb, oz
- **8 Categorías**: Carnes, Verduras, Bebidas, Lácteos, Limpieza, Granos, Condimentos, Aceites
- **4 Almacenes**: Cocina Principal, Bar, Bodega de Bebidas, Bodega Seca

## Solución de Problemas

### Error de conexión a la base de datos
- Verifica que SQL Server esté ejecutándose
- Confirma que la cadena de conexión sea correcta
- Asegúrate de tener permisos suficientes

### Error CORS en el frontend
- Verifica que el backend esté ejecutándose
- Confirma que la URL del API en `.env` sea correcta
- Revisa la configuración de CORS en `Program.cs`

### La base de datos no se crea
```bash
# Elimina las migraciones existentes
rm -rf Migrations/

# Crea una nueva migración
dotnet ef migrations add InitialCreate

# Aplica la migración
dotnet ef database update
```

## Próximas Características

- 🔄 Integración con módulo POS para descuento automático de ingredientes
- 📊 Reportes y análisis de inventario
- 📱 Aplicación móvil
- 🔐 Sistema de autenticación y roles
- 📧 Notificaciones por email/SMS para alertas
- 📈 Dashboard con gráficos y métricas
- 🧾 Integración con proveedores
- 💰 Gestión de costos y valorización de inventario

## Contribuir

Las contribuciones son bienvenidas. Por favor:

1. Haz fork del proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## Licencia

Este proyecto es de código abierto y está disponible bajo la licencia MIT.

## Contacto

Para preguntas o soporte, por favor abre un issue en el repositorio.

---

Desarrollado con ❤️ para la gestión eficiente de restaurantes
