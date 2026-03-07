# ---- Stage 1: Build Client ----
FROM node:22-alpine AS client-build
WORKDIR /client

COPY Client/package*.json ./
RUN npm ci

COPY Client/ .

# VITE_BACKEND_URL sets the WebSocket server address used by the client.
# Pass it at build time: docker build --build-arg VITE_BACKEND_URL=ws://<host>:8181 .
# Defaults to ws://localhost:8181 for local development.
ARG VITE_BACKEND_URL=ws://localhost:8181
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

# Port 80  – static client (nginx)
# Port 8181 – WebSocket server (.NET)
EXPOSE 80 8181

ENTRYPOINT ["./start.sh"]
