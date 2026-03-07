# ---- Stage 1: Build Client ----
FROM node:22-alpine AS client-build
WORKDIR /client

COPY Client/package*.json ./
RUN npm ci

COPY Client/ .

# VITE_BACKEND_URL overrides the WebSocket URL baked into the client bundle.
# Leave unset (default) so the client auto-detects the backend via same-origin
# /ws at runtime – required for platforms like shiper.app where only one port
# is exposed.  Set explicitly only when you need a custom WebSocket endpoint:
#   docker build --build-arg VITE_BACKEND_URL=ws://custom-host:8181 .
ARG VITE_BACKEND_URL
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL

RUN npm run build

# ---- Stage 2: Build Server ----
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS server-build
WORKDIR /src

COPY Server/ .
RUN dotnet restore
RUN dotnet publish -c Release -o /app

# ---- Stage 3: Runtime ----
FROM mcr.microsoft.com/dotnet/aspnet:9.0
WORKDIR /app

# Install nginx to serve the static client files
RUN apt-get update \
    && apt-get install -y --no-install-recommends nginx \
    && rm -rf /var/lib/apt/lists/*

# Copy the published .NET server
COPY --from=server-build /app .

# Copy the built client into the nginx web root
COPY --from=client-build /client/dist /var/www/html

# Configure nginx to serve the client as a single-page application
COPY nginx.conf /etc/nginx/sites-available/default

# Copy and prepare the entrypoint script
COPY start.sh .
RUN chmod +x start.sh

# Port 80  – nginx (serves static client + proxies /ws to the .NET server)
EXPOSE 80

ENTRYPOINT ["./start.sh"]
