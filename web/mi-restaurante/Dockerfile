# ==========================================
# Multi-stage Dockerfile: Frontend Web (React + Nginx)
# ==========================================

# Stage 1: Build de la aplicación React
FROM node:20-alpine AS builder
WORKDIR /app

# Copiar definiciones de dependencias
COPY package.json package-lock.json ./

# Instalar dependencias usando ci para reproducibilidad
RUN npm ci --legacy-peer-deps

# Copiar el código fuente
COPY . ./

# Argumento para la URL de la API (por defecto /api para usar el reverse proxy de Nginx)
ARG REACT_APP_API_URL=/api
ENV REACT_APP_API_URL=$REACT_APP_API_URL

# Forzar ruta raíz pública dentro del contenedor Docker (sobreescribe homepage de GitHub Pages)
ENV PUBLIC_URL=/
ENV CI=false

# Compilar para producción
RUN npm run build

# Stage 2: Servidor Web Nginx ligero y seguro
FROM nginx:1.27-alpine AS runner

# Copiar configuración optimizada de Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar el build compilado desde la etapa anterior
COPY --from=builder /app/build /usr/share/nginx/html

# Exponer el puerto HTTP
EXPOSE 80

# Healthcheck
HEALTHCHECK --interval=20s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:80/ || exit 1

# Iniciar servidor web Nginx en primer plano
CMD ["nginx", "-g", "daemon off;"]
