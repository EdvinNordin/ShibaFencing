# WebFighting

A multiplayer 3D browser fighting game built with Three.js (TypeScript client) and a .NET WebSocket server (Fleck).

---

## Architecture

| Component | Technology | Port (internal) |
|-----------|-----------|-----------------|
| Static client | Vite + Three.js, served by **nginx** | 80 |
| WebSocket server | .NET 9 / Fleck | 8181 (internal only) |

In production, **nginx** is the only externally exposed service.  
WebSocket traffic arrives at `/ws` on port 80 (or 443 when HTTPS is terminated by the platform) and is reverse-proxied internally to the .NET server on port 8181.

```
Browser ──── HTTPS ────► nginx :80
                              │  GET /          → serve index.html / static assets
                              │  GET /ws (WSS)  → proxy_pass http://127.0.0.1:8181
                              │
                         .NET Fleck :8181  (internal)
```

---

## Local Development

### Prerequisites

- Node.js ≥ 22
- .NET SDK 9
- (Optional) Docker

### Run without Docker

**Terminal 1 – .NET WebSocket server**

```bash
cd Server
dotnet run
# Listens on ws://0.0.0.0:8181
```

**Terminal 2 – Vite dev server**

```bash
cd Client
npm ci
npm run dev
# http://localhost:5173
# /ws is proxied to ws://localhost:8181 automatically (see vite.config.js)
```

The Vite dev proxy handles the `/ws` → `ws://localhost:8181` forwarding, so no environment variables are needed for local development.

### Run with Docker (local)

```bash
docker build -t webfighting .
docker run -p 8080:80 webfighting
# Open http://localhost:8080
```

WebSocket connections automatically use the same-origin `/ws` path.

---

## Deploying to shiper.app

shiper.app runs your app from the `Dockerfile` at the repository root and exposes a single public port.

### Steps

1. Connect your GitHub repository in the shiper.app dashboard.
2. Set the **exposed port** to **`80`** (the default in the Dockerfile).
3. Deploy – no build arguments or environment variables are required.

### How it works

- The built client auto-detects the WebSocket URL at runtime:
  - **HTTPS** → `wss://<your-domain>/ws`
  - **HTTP** → `ws://<your-domain>/ws`
- nginx listens on port 80 and proxies `/ws` upgrade requests to the internal .NET server on port 8181.
- The platform's TLS termination (HTTPS → HTTP) is handled upstream; the container always receives plain HTTP/WS.

### Optional: custom WebSocket endpoint

If you need to point the client at a different WebSocket server (e.g. a separate backend instance), pass `VITE_BACKEND_URL` as a Docker **build argument**:

```bash
docker build --build-arg VITE_BACKEND_URL=wss://api.example.com/ws -t webfighting .
```

> **Note:** This value is baked into the client bundle at build time.  
> Leave it unset for the default same-origin `/ws` behaviour.

---

## Environment Variables / Build Args

| Name | Default | Description |
|------|---------|-------------|
| `VITE_BACKEND_URL` | *(unset – auto-detected)* | Override the WebSocket URL baked into the client at build time. |

---

## Project Structure

```
WebFighting/
├── Client/          # Vite + TypeScript + Three.js frontend
│   ├── src/
│   │   ├── Network.ts   # WebSocket connection logic
│   │   └── ...
│   └── vite.config.js   # Vite config (includes /ws dev proxy)
├── Server/          # .NET 9 WebSocket server (Fleck)
│   └── Program.cs
├── nginx.conf       # nginx config – SPA routing + /ws proxy
├── start.sh         # Container entrypoint (starts nginx + .NET)
└── Dockerfile       # Multi-stage build
```
