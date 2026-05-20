# syntax=docker/dockerfile:1

# Stage 1: Build the React application
FROM node:20-alpine AS build

WORKDIR /app
ARG VITE_SPOTIFY_CLIENT_ID
ENV VITE_SPOTIFY_CLIENT_ID=$VITE_SPOTIFY_CLIENT_ID

# Copy dependency manifests first for better layer caching
COPY package.json package-lock.json ./

# Clean install dependencies from the lockfile
RUN npm ci

# Copy only files required to build the static app
COPY index.html vite.config.js ./
COPY src ./src

RUN npm run build

# Stage 2: Serve the application with Nginx
FROM nginx:alpine

# Clean default nginx static files
RUN rm -rf /usr/share/nginx/html/*

# Copy built assets from Stage 1
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
