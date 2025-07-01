using Fleck;
using System.Text.Json;

//var allSockets = new List<IWebSocketConnection>();
var websocketServer = new WebSocketServer("ws://0.0.0.0:8181");

Dictionary<Guid, (IWebSocketConnection connection, PlayerState state)> Players = [];


websocketServer.Start(connection =>
{
    // new player connects
    connection.OnOpen = () =>
        {
            Console.WriteLine("Current Amount of players: " + Players.Count);
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
                    var x = position.GetProperty("x").GetDouble();
                    var y = position.GetProperty("y").GetDouble();
                    var z = position.GetProperty("z").GetDouble();

                    Players[connection.ConnectionInfo.Id].state.setPosition(x, y, z);

                    var moveMsg = new
                    {
                        action = "Player Move",
                        position = new { x, y, z },
                        ID = connection.ConnectionInfo.Id
                    };

                    foreach (var player in Players)
                    {
                        if (player.Key != connection.ConnectionInfo.Id) player.Value.connection.Send(JsonSerializer.Serialize(moveMsg));
                    }
                    break;
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine("Error handling message: " + ex.Message);
        }
    };
});

WebApplication.CreateBuilder(args).Build().Run();

class PlayerState
{
    public double[] position { get; set; }
    public int health { get; set; }

    public PlayerState(double x, double y, double z)
    {
        position = [x, y, z];
        health = 100; // Default health
    }

    public PlayerState()
    {
        position = new double[3] { 0, 0, 0 };
        health = 100;
    }

    public void setPosition(double x, double y, double z)
    {
        position[0] = x;
        position[1] = y;
        position[2] = z;
    }
}