using Fleck;
using System.Text.Json;

//var allSockets = new List<IWebSocketConnection>();
var websocketServer = new WebSocketServer("ws://0.0.0.0:8181");

Dictionary<Guid, (IWebSocketConnection connection, PlayerState state)> Players = [];

Console.WriteLine("Current Amount of players: " + Players.Count);

websocketServer.Start(connection =>
{
    // new player connects
    connection.OnOpen = () =>
        {
            // Set the ID for the new player
            var setID = new
            {
                action = "Set ID",
                ID = connection.ConnectionInfo.Id
            };
            connection.Send(JsonSerializer.Serialize(setID));

            if (Players.Count > 0)
            {
                // Send all existing players to the new player

                var sendOldPlayers = new
                {
                    action = "Send Old Players",
                    players = Players.Select(p => new
                    {
                        ID = p.Key,
                        position = p.Value.state.position,
                        rotation = p.Value.state.rotation,
                        health = p.Value.state.health
                    }).ToList()
                };
                connection.Send(JsonSerializer.Serialize(sendOldPlayers));

                // Notify all other players about the new player
                var newPlayer = new
                {
                    action = "New Player",
                    ID = connection.ConnectionInfo.Id
                };

                foreach (var player in Players)
                {
                    if (player.Key != connection.ConnectionInfo.Id)
                    {
                        player.Value.connection.Send(JsonSerializer.Serialize(newPlayer));
                    }
                }
            }

            Players.Add(connection.ConnectionInfo.Id, (connection, new PlayerState(0, 0, 0)));

            Console.WriteLine("Current Amount of players: " + Players.Count);
        };

    // player disconnects
    connection.OnClose = () =>
        {

            var disconnectMsg = new
            {
                action = "Remove Player",
                ID = connection.ConnectionInfo.Id
            };

            Players.Remove(connection.ConnectionInfo.Id);

            foreach (var player in Players)
            {
                player.Value.connection.Send(JsonSerializer.Serialize(disconnectMsg));
            }
            
            Console.WriteLine("Current Amount of players: " + Players.Count);
        };

    connection.OnMessage = message =>
    {
        try
        {
            var doc = JsonDocument.Parse(message);
            var action = doc.RootElement.GetProperty("action").GetString();

            switch (action)
            {
                // player moves thus updating their position to everyone else
                case "Player Move":
                    var position = doc.RootElement.GetProperty("position");
                    var posX = position.GetProperty("x").GetDouble();
                    var posY = position.GetProperty("y").GetDouble();
                    var posZ = position.GetProperty("z").GetDouble();

                    Players[connection.ConnectionInfo.Id].state.setPosition(posX, posY, posZ);

                    var playerMove = new
                    {
                        action = "Player Move",
                        position = new { posX, posY, posZ},
                        ID = connection.ConnectionInfo.Id
                    };

                    foreach (var player in Players)
                    {
                        if (player.Key != connection.ConnectionInfo.Id) player.Value.connection.Send(JsonSerializer.Serialize(playerMove));
                    }
                    break;

                case "Player Rotate":
                    var rotation = doc.RootElement.GetProperty("rotation");
                    var rotX = rotation.GetProperty("x").GetDouble();
                    var rotY = rotation.GetProperty("y").GetDouble();
                    var rotZ = rotation.GetProperty("z").GetDouble();
                    var rotW = rotation.GetProperty("w").GetDouble();

                    Players[connection.ConnectionInfo.Id].state.setRotation(rotX, rotY, rotZ, rotW);

                    var playerRotate = new
                    {
                        action = "Player Rotate",
                        rotation = new { rotX, rotY, rotZ, rotW },
                        ID = connection.ConnectionInfo.Id
                    };

                    foreach (var player in Players)
                    {
                        if (player.Key != connection.ConnectionInfo.Id) player.Value.connection.Send(JsonSerializer.Serialize(playerRotate));
                    }
                    break;
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine("Error parsing message: " + message);
            Console.WriteLine("Error: " + ex.Message);
            Console.WriteLine("Error source: " + ex.Source);
        }
    };
});

WebApplication.CreateBuilder(args).Build().Run();

class PlayerState
{
    public double[] position { get; set; }
    public double[] rotation { get; set; }
    public int health { get; set; }

    public PlayerState(double x, double y, double z)
    {
        position = [x, y, z];
        rotation = [0, 0, 0, 1];
        health = 100; // Default health
    }

    public PlayerState()
    {
        position = new double[3] { 0, 0, 0 };
        rotation = new double[4] { 0, 0, 0, 1 };
        health = 100;
    }

    public void setPosition(double x, double y, double z)
    {
        position[0] = x;
        position[1] = y;
        position[2] = z;
    }
    public void setRotation(double x, double y, double z, double w)
    {
        rotation[0] = x;
        rotation[1] = y;
        rotation[2] = z;
        rotation[3] = w;
    }
}