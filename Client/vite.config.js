import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist",
  },
  server: {
    // Proxy /ws to the local .NET WebSocket server during development so that
    // the same-origin /ws path works without any extra configuration.
    proxy: {
      "/ws": {
        target: "ws://localhost:8181",
        ws: true,
        // Rewrite the Origin header to match the target so that the Fleck
        // server does not reject the upgrade request due to origin mismatch.
        rewriteWsOrigin: true,
      },
    },
  },
});
