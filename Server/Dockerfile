# ----------- Build Stage -------------
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copy everything from the Server folder and restore
COPY Server/. .
RUN dotnet restore

# Build and publish the app
RUN dotnet publish -c Release -o /app

# ----------- Runtime Stage -------------
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app

# Copy the published app from build stage
COPY --from=build /app .

# Expose the WebSocket server port
EXPOSE 8181

# Run the server
ENTRYPOINT ["dotnet", "WebFighting.dll"]
