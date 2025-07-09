using Fleck;
using System.Numerics;
using System.Text.Json;


var port = Environment.GetEnvironmentVariable("PORT") ?? "8181";
var websocketServer = new WebSocketServer($"ws://0.0.0.0:{port}");

Dictionary<Guid, (IWebSocketConnection connection, PlayerState state)> Players = [];

//Console.WriteLine("Current Amount of players: " + Players.Count);

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
                        position = PlayerState.SerializeVector3(p.Value.state.position),
                        rotation = PlayerState.SerializeQuaternion(p.Value.state.rotation),
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

            Players.Add(connection.ConnectionInfo.Id, (connection, new PlayerState()));
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
            
            //Console.WriteLine("Current Amount of players: " + Players.Count);
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
                    var posX = position.GetProperty("x").GetSingle();
                    var posY = position.GetProperty("y").GetSingle();
                    var posZ = position.GetProperty("z").GetSingle();

                    Players[connection.ConnectionInfo.Id].state.setPosition(posX, posY, posZ);

                    var playerMove = new
                    {
                        action = "Player Move",
                        position = PlayerState.SerializeVector3(Players[connection.ConnectionInfo.Id].state.position),
                        ID = connection.ConnectionInfo.Id
                    };

                    foreach (var player in Players)
                    {
                        if (player.Key != connection.ConnectionInfo.Id) player.Value.connection.Send(JsonSerializer.Serialize(playerMove));
                    }
                    break;

                case "Player Rotate":
                    var rotation = doc.RootElement.GetProperty("rotation");
                    var rotX = rotation.GetProperty("x").GetSingle();
                    var rotY = rotation.GetProperty("y").GetSingle();
                    var rotZ = rotation.GetProperty("z").GetSingle();
                    var rotW = rotation.GetProperty("w").GetSingle();

                    Players[connection.ConnectionInfo.Id].state.setRotation(rotX, rotY, rotZ, rotW);
                    //Console.WriteLine("Player Rot: " + rotX + ", " + rotY + ", " + rotZ + ", " + rotW);
                    var playerRotate = new
                    {
                        action = "Player Rotate",
                        rotation = PlayerState.SerializeQuaternion(Players[connection.ConnectionInfo.Id].state.rotation),
                        ID = connection.ConnectionInfo.Id
                    };

                    foreach (var player in Players)
                    {
                        if (player.Key != connection.ConnectionInfo.Id) player.Value.connection.Send(JsonSerializer.Serialize(playerRotate));
                    }
                    break;

                case "Player Attack":
                    //var ID = doc.RootElement.GetProperty("ID");
                    foreach (var player in Players)
                    {
                        if (player.Key != connection.ConnectionInfo.Id)
                        {
                            var playerAttack = new
                            {
                                action = "Player Attack",
                                ID = connection.ConnectionInfo.Id
                            };
                            player.Value.connection.Send(JsonSerializer.Serialize(playerAttack));

                            var range = doc.RootElement.GetProperty("range").GetSingle();
                            if (Players[connection.ConnectionInfo.Id].state.attack(player.Value.state, range))
                            {
                                var playerHit = new
                                {
                                    action = "Player Hit",
                                    health = player.Value.state.health,
                                    ID = player.Key

                                };
                                player.Value.connection.Send(JsonSerializer.Serialize(playerHit));
                            }
                        }
                    }

                    break;

                case "Player Death":
                    foreach (var player in Players)
                    {
                        if (player.Key != connection.ConnectionInfo.Id)
                        {
                            var playerDeath = new
                            {
                                action = "Player Death",
                                ID = connection.ConnectionInfo.Id
                            };
                            player.Value.connection.Send(JsonSerializer.Serialize(playerDeath));
                        }
                    }
                    break;

                case "Player Respawn":
                    Players[connection.ConnectionInfo.Id].state.health = 100; // Reset health
                    Players[connection.ConnectionInfo.Id].state.setPosition(0, 0, 0); // Reset position
                    Players[connection.ConnectionInfo.Id].state.setRotation(0, 0, 0, 1); // Reset rotation
                    var playerRespawn = new
                    {
                        action = "Player Respawn",
                        ID = connection.ConnectionInfo.Id,
                        position = PlayerState.SerializeVector3(Players[connection.ConnectionInfo.Id].state.position),
                        rotation = PlayerState.SerializeQuaternion(Players[connection.ConnectionInfo.Id].state.rotation),
                        health = Players[connection.ConnectionInfo.Id].state.health
                    };
                    foreach (var player in Players)
                    {
                        if (player.Key != connection.ConnectionInfo.Id) player.Value.connection.Send(JsonSerializer.Serialize(playerRespawn));
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
    public Vector3 position { get; set; }
    public Quaternion rotation { get; set; }
    public int health { get; set; }

    public PlayerState()
    {
        position = new Vector3(0, 0, 0);
        rotation = new Quaternion(0, 0, 0, 1);
        health = 100;
    }
    public void setPosition(float x, float y, float z)
    {
        position = new Vector3(x, y, z);
    }
    public void setRotation(float x, float y, float z, float w)
    {
        rotation = new Quaternion(x, y, z, w);
    }

    public bool attack(PlayerState target, float range)
    {
        // 1. Get attacker’s forward vector (z‑axis).
        Vector3 forward = Vector3.Transform(Vector3.UnitZ, this.rotation);
        forward = Vector3.Normalize(forward);

        // 2. Vector from attacker to target, flattened on XZ plane (ignore height).
        Vector3 toTarget = target.position - this.position;
        toTarget.Y = 0f;
        float distance = toTarget.Length();

        if (distance > range || distance < 0.0001f)
            return false;

        toTarget = Vector3.Normalize(toTarget);

        float swingAngle = 180f; // Example swing angle in degrees

        // 3. Dot‑product test against cone threshold.
        float halfAngleRad = (swingAngle * 0.5f) * (MathF.PI / 180f);
        float threshold = MathF.Cos(halfAngleRad);

        float dot = Vector3.Dot(forward, toTarget);
        bool isHit = dot >= threshold;
        if (isHit)
        {
            target.health -= 20; // Example damage
            if (target.health < 0) target.health = 0; // Prevent negative health
        }
        return isHit;
    }
    public static object SerializeVector3(Vector3 vector)
    {
        return new { x = vector.X, y = vector.Y, z = vector.Z };
    }
    public static object SerializeQuaternion(Quaternion quaternion)
    {
        return new { x = quaternion.X, y = quaternion.Y, z = quaternion.Z, w = quaternion.W };
    }

}

//gcloud run deploy webfightingbackend --source=Server --region=europe-north2 --allow-unauthenticated