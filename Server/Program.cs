using Fleck;
using System.Numerics;
using System.Text.Json;

class Program{
    static void Main(string[] args)
    {

        var port = Environment.GetEnvironmentVariable("PORT") ?? "8181";
        var websocketServer = new WebSocketServer($"ws://0.0.0.0:{port}");

        Dictionary<Guid, (IWebSocketConnection connection, PlayerState state)> Players = [];


        websocketServer.Start(connection =>
        {
            Guid socketID = connection.ConnectionInfo.Id;
            PlayerState socketPlayer = new PlayerState();
            Players.Add(socketID, (connection, socketPlayer));
            // new player connects
            connection.OnOpen = () =>
                {
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
                            players = Players.Select(p =>
                            new
                            {
                                ID = p.Key,
                                position = PlayerState.SerializeVector3(p.Value.state.position),
                                rotation = PlayerState.SerializeQuaternion(p.Value.state.rotation),
                                health = p.Value.state.health,
                                name = p.Value.state.name,
                                alive = p.Value.state.alive,
                                color = p.Value.state.color,
                                initialized = p.Value.state.Initialized,
                                side = p.Value.state.side
                            }).ToList()
                        };
                        connection.Send(JsonSerializer.Serialize(sendOldPlayers));
                    }

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

                    };

            connection.OnMessage = message =>
                {
                    try
                    {
                        var doc = JsonDocument.Parse(message);
                        var action = doc.RootElement.GetProperty("action").GetString();
                        switch (action)
                        {
                            case "Initialize Player":

                                var playerName = doc.RootElement.GetProperty("name").GetString();
                                var color = doc.RootElement.GetProperty("color").GetString();
                                if (!string.IsNullOrEmpty(playerName))
                                {
                                    socketPlayer.name = playerName;
                                }
                                if (!string.IsNullOrEmpty(color))
                                {
                                    socketPlayer.color = color;
                                }
                                socketPlayer.alive = true;

                                socketPlayer.Initialized = true;

                                // Notify all other players about the new player
                                var newPlayer = new
                                {
                                    action = "New Player",
                                    ID = socketID,
                                    name = socketPlayer.name,
                                    color = socketPlayer.color
                                };

                                foreach (var player in Players)
                                {
                                    if (player.Key != socketID)
                                    {
                                        player.Value.connection.Send(JsonSerializer.Serialize(newPlayer));
                                    }
                                }
                                break;

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

                                foreach (var player in Players)
                                {

                                    //var hitPlayer = Players[socketID]; // Default to self
                                    if (player.Key != socketID)
                                    {
                                        // Notify other players about the attack
                                        var playerAttack = new
                                        {
                                            action = "Player Attack",
                                            ID = socketID
                                        };
                                        player.Value.connection.Send(JsonSerializer.Serialize(playerAttack));
                                    }
                                }
                                break;



                            case "Player Hit":

                                var damage = doc.RootElement.GetProperty("damage").GetInt32();

                                var attackingID = doc.RootElement.GetProperty("attackerID").GetGuid();
                                var attacking = Players[attackingID];

                                var hitPlayerID = doc.RootElement.GetProperty("defenderID").GetGuid();
                                var hitPlayer = Players[hitPlayerID];

                                var hitDirection = new Vector3(attacking.state.position.X - hitPlayer.state.position.X,
                                                            0,
                                                            attacking.state.position.Z - hitPlayer.state.position.Z);

                                hitDirection = Vector3.Normalize(hitDirection) * 3.0f;


                                hitPlayer.state.setPosition(hitPlayer.state.position.X - hitDirection.X,
                                                        0,
                                                        hitPlayer.state.position.Z - hitDirection.Z);

                                hitPlayer.state.health -= damage; // Apply damage



                                if (hitPlayer.state.health <= 0)
                                {
                                    hitPlayer.state.alive = false; // Player is dead
                                    hitPlayer.state.health = 0; // Ensure health doesn't go below 0

                                    var healthZero = new
                                    {
                                        action = "Player Death",
                                        ID = hitPlayerID,
                                    };
                                    foreach (var player in Players)
                                    {
                                        player.Value.connection.Send(JsonSerializer.Serialize(healthZero));
                                    }
                                }
                                else
                                {

                                    var playerHit = new
                                    {
                                        action = "Player Hit",
                                        health = hitPlayer.state.health,
                                        ID = hitPlayer.connection.ConnectionInfo.Id,
                                        position = PlayerState.SerializeVector3(hitPlayer.state.position),

                                    };

                                    foreach (var player in Players)
                                    {
                                        player.Value.connection.Send(JsonSerializer.Serialize(playerHit));
                                    }
                                }
                                break;

                            case "Player Parry":
                                var attackerID = doc.RootElement.GetProperty("attackerID").GetGuid();
                                var attacker = Players[attackerID];

                                var defenderID = doc.RootElement.GetProperty("defenderID").GetGuid();
                                var defender = Players[defenderID];

                                var knockbackDirection = new Vector3(attacker.state.position.X - defender.state.position.X,
                                                                    0,
                                                                    attacker.state.position.Z - defender.state.position.Z);

                                knockbackDirection = Vector3.Normalize(knockbackDirection) * 3.0f;

                                attacker.state.setPosition(attacker.state.position.X + knockbackDirection.X,
                                                    0,
                                                    attacker.state.position.Z + knockbackDirection.Z);

                                defender.state.setPosition(defender.state.position.X - knockbackDirection.X,
                                                    0,
                                                    defender.state.position.Z - knockbackDirection.Z);

                                var attackerKnockback = new
                                {
                                    action = "Player Move",
                                    position = PlayerState.SerializeVector3(attacker.state.position),
                                    ID = attackerID
                                };

                                var swapWeaponSide = new
                                {
                                    action = "Swap Weapon Side",
                                    ID = attackerID
                                };

                                var defenderKnockback = new
                                {
                                    action = "Player Move",
                                    position = PlayerState.SerializeVector3(defender.state.position),
                                    ID = defenderID
                                };


                                foreach (var player in Players)
                                {
                                    player.Value.connection.Send(JsonSerializer.Serialize(attackerKnockback));
                                    player.Value.connection.Send(JsonSerializer.Serialize(defenderKnockback));
                                    if(player.Key != socketID){
                                        player.Value.connection.Send(JsonSerializer.Serialize(swapWeaponSide));
                                    }
                                }
                                break;

                            case "Player Death":

                                socketPlayer.alive = false; // Set player as dead
                                socketPlayer.health = 0; // Set health to 0

                                var playerDeath = new
                                {
                                    action = "Player Death",
                                    ID = socketID,
                                };
                                foreach (var player in Players)
                                {
                                    if (player.Key != socketID) player.Value.connection.Send(JsonSerializer.Serialize(playerDeath));
                                }
                                break;

                            case "Player Respawn":

                                socketPlayer.health = 100; // Reset health
                                socketPlayer.setPosition(0, 0, 0); // Reset position
                                socketPlayer.setRotation(0, 0, 0, 1); // Reset rotation
                                socketPlayer.alive = true; // Set player as alive
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
                        var serverError = new
                        {
                            action = "Server Error",
                            message = ex.Message,
                            problem = message
                        };
                        Players[socketID].connection.Send(JsonSerializer.Serialize(serverError));
                    }
                };

        });

        WebApplication.CreateBuilder(args).Build().Run();
    }
}


class PlayerState
{
    public string name { get; set; } = "Player";
    public Vector3 position { get; set; } = new Vector3(0, 0, 0);
    public Quaternion rotation { get; set; } = new Quaternion(0, 0, 0, 1);
    public int health { get; set; } = 100;
    public bool alive { get; set; } = false;
    public string color { get; set; } = "#ff0000";
    public bool Initialized { get; set; } = false;
    public int side { get; set; } = -1;
    //public DateTime lastActivity { get; set; } = DateTime.UtcNow;


    public PlayerState()
    {
        position = new Vector3(0, 0, 0);
        rotation = new Quaternion(0, 0, 0, 1);
        health = 100;
    }
    public void setPosition(float x, float y, float z)
    {
        position = new Vector3(x, y, z);
        //lastActivity = DateTime.UtcNow; // Update last activity time
    }
    public void setRotation(float x, float y, float z, float w)
    {
        rotation = new Quaternion(x, y, z, w);
        //lastActivity = DateTime.UtcNow; // Update last activity time
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
