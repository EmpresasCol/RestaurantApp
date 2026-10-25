# ==========================================
# Multi-stage Dockerfile: RestaurantApi (.NET 8)
# Compatible con Render.com (usa variable $PORT)
# ==========================================

# Stage 1: Build & Publish
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS builder
WORKDIR /src

# Copiar csproj y restaurar dependencias aprovechando la caché de Docker
COPY RestaurantApi.csproj ./
RUN dotnet restore RestaurantApi.csproj

# Copiar el código fuente restante y publicar
COPY . ./
RUN dotnet publish RestaurantApi.csproj -c Release -o /app/publish --no-restore

# Stage 2: Runtime optimizado
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runner
WORKDIR /app

# Instalar curl para healthcheck
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Copiar artefactos compilados desde la etapa de compilación
COPY --from=builder /app/publish .

# Variables de entorno por defecto
# NOTA: Render.com inyecta $PORT automáticamente. ASPNETCORE_URLS la usa.
ENV ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_RUNNING_IN_CONTAINER=true

# Healthcheck usando el endpoint /health
HEALTHCHECK --interval=20s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:${PORT:-5000}/health || exit 1

# Buenas prácticas de seguridad: ejecutar como usuario no-root
USER app

# Script de inicio que respeta la variable PORT de Render
CMD ASPNETCORE_URLS=http://+:${PORT:-5000} dotnet RestaurantApi.dll
