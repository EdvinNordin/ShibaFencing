using Fleck;
using System.Numerics;
using System.Text.Json;


var port = Environment.GetEnvironmentVariable("PORT") ?? "8181";
var websocketServer = new WebSocketServer($"ws://0.0.0.0:{port}");

Dictionary<Guid, (IWebSocketConnection connection, PlayerState state)> Players = [];

//Console.WriteLine("Current Amount of players: " + Players.Count);

websocketServer.Start(connection =>
{
    Guid socketID = Guid.Empty;
    PlayerState socketPlayer = null;
    // new player connects
    connection.OnOpen = () =>
        {

            socketID = connection.ConnectionInfo.Id;
            // Set the ID for the new player
            var setID = new
            {
                action = "Set ID",
                ID = socketID
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
                    ID = socketID
                };

                foreach (var player in Players)
                {
                    if (player.Key != socketID)
                    {
                        player.Value.connection.Send(JsonSerializer.Serialize(newPlayer));
                    }
                }
            }

            Players.Add(socketID, (connection, new PlayerState()));
            
            socketPlayer = Players[socketID].state;
        };

    // player disconnects
    connection.OnClose = () =>
        {

            var disconnectMsg = new
            {
                action = "Remove Player",
                ID = socketID
            };

            Players.Remove(socketID);

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

                    socketPlayer.setPosition(posX, posY, posZ);

                    var playerMove = new
                    {
                        action = "Player Move",
                        position = PlayerState.SerializeVector3(socketPlayer.position),
                        ID = socketID
                    };

                    foreach (var player in Players)
                    {
                        if (player.Key != socketID) player.Value.connection.Send(JsonSerializer.Serialize(playerMove));
                    }
                    break;

                case "Player Rotate":
                    var rotation = doc.RootElement.GetProperty("rotation");
                    var rotX = rotation.GetProperty("x").GetSingle();
                    var rotY = rotation.GetProperty("y").GetSingle();
                    var rotZ = rotation.GetProperty("z").GetSingle();
                    var rotW = rotation.GetProperty("w").GetSingle();

                    socketPlayer.setRotation(rotX, rotY, rotZ, rotW);
                    //Console.WriteLine("Player Rot: " + rotX + ", " + rotY + ", " + rotZ + ", " + rotW);
                    var playerRotate = new
                    {
                        action = "Player Rotate",
                        rotation = PlayerState.SerializeQuaternion(socketPlayer.rotation),
                        ID = socketID
                    };

                    foreach (var player in Players)
                    {
                        if (player.Key != socketID) player.Value.connection.Send(JsonSerializer.Serialize(playerRotate));
                    }
                    break;

                case "Player Attack":
                    //var ID = doc.RootElement.GetProperty("ID");
                    //socketPlayer.isAttacking = true;
                    foreach (var hitPlayer in Players)
                    {
                        if (hitPlayer.Key != socketID)
                        {
                            var playerAttack = new
                            {
                                action = "Player Attack",
                                ID = socketID
                            };
                            hitPlayer.Value.connection.Send(JsonSerializer.Serialize(playerAttack));

                            var range = doc.RootElement.GetProperty("range").GetSingle();
                            if (socketPlayer.attack(hitPlayer.Value.state, range))
                            {
                       
                                hitPlayer.Value.state.health -= hitPlayer.Value.state.damage; // Example damage
                                if (hitPlayer.Value.state.health < 0) hitPlayer.Value.state.health = 0; // Prevent negative health
        
                                var playerHit = new
                                {
                                    action = "Player Hit",
                                    health = hitPlayer.Value.state.health,
                                    ID = hitPlayer.Key,
                                    attackerID = socketID
                                };
                                hitPlayer.Value.connection.Send(JsonSerializer.Serialize(playerHit));
                            }
                        }
                    }

                    break;

                case "Player Stop Attack":
                    //socketPlayer.isAttacking = false;
                    break;

                case "Player Parry":
                    socketPlayer.health += socketPlayer.damage;
                    var parPosition = doc.RootElement.GetProperty("position");
                    var parX = parPosition.GetProperty("x").GetSingle();
                    var parY = parPosition.GetProperty("y").GetSingle();
                    var parZ = parPosition.GetProperty("z").GetSingle();

                    socketPlayer.setPosition(parX, parY, parZ);

                    var playerPar = new
                    {
                        action = "Player Move",
                        position = PlayerState.SerializeVector3(socketPlayer.position),
                        ID = socketID
                    };

                    foreach (var player in Players)
                    {
                        if (player.Key != socketID) player.Value.connection.Send(JsonSerializer.Serialize(playerPar));
                    }
                    break;

                case "Player Death":
                    foreach (var player in Players)
                    {
                        if (player.Key != socketID)
                        {
                            var playerDeath = new
                            {
                                action = "Player Death",
                                ID = socketID
                            };
                            player.Value.connection.Send(JsonSerializer.Serialize(playerDeath));
                        }
                    }
                    break;

                case "Player Respawn":
                    socketPlayer.health = 100; // Reset health
                    socketPlayer.setPosition(0, 0, 0); // Reset position
                    socketPlayer.setRotation(0, 0, 0, 1); // Reset rotation
                    var playerRespawn = new
                    {
                        action = "Player Respawn",
                        ID = socketID,
                        position = PlayerState.SerializeVector3(socketPlayer.position),
                        rotation = PlayerState.SerializeQuaternion(socketPlayer.rotation),
                        health = socketPlayer.health
                    };
                    foreach (var player in Players)
                    {
                        if (player.Key != socketID) player.Value.connection.Send(JsonSerializer.Serialize(playerRespawn));
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
    public int damage { get; set; } = 20; // Example damage value
    public bool isAttacking { get; set; } = false;

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