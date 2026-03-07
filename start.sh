#!/bin/sh
# Start nginx as a background daemon to serve the static client files
nginx

# Start the .NET WebSocket server as the main process (PID 1 via exec).
# This ensures Docker signals (SIGTERM/SIGKILL) are forwarded correctly.
exec dotnet WebFighting.dll
