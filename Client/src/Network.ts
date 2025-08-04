import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { game } from "./main";
import { Player } from "./Player";

let health = document.getElementById("hp") as HTMLDivElement;
let hp = document.getElementById("currentHP");

export function initializeWebSocket() {
  const socket = new WebSocket(import.meta.env.VITE_BACKEND_URL);

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);

    switch (data.action) {
      case "Set ID":
        game.playerID = data.ID;
        break;

      case "Send Old Players":
        data.players.forEach((playerData: any) => {
          if (playerData.initialized === false) return;
          //if (game.playerID === playerData.ID) return;
          let newPlayer = new Player(
            game.world,
            playerData.name,
            playerData.color
          );
          if (playerData.alive) {
            newPlayer.mesh.visible = true; // Show player mesh if alive
          } else {
            newPlayer.mesh.visible = false; // Hide player mesh if not alive
          }
          newPlayer.ID = playerData.ID;
          newPlayer.health = playerData.health;
          newPlayer.weapon.side = playerData.side;
          newPlayer.weapon.updateRotation(
            newPlayer.weapon.sideToQuaternion(playerData.side)
          );

          newPlayer.updatePosition(playerData.position);
          newPlayer.updateRotation(playerData.rotation);
          game.addPlayer(newPlayer);
        });
        break;

      case "New Player":
        let newPlayer = new Player(game.world, data.name, data.color);
        newPlayer.ID = data.ID;
        game.addPlayer(newPlayer);
        break;

      case "Player Move":
        const movePlayer = game.findPlayer(data.ID);
        if (movePlayer) {
          movePlayer.updatePosition(data.position);
        }
        break;

      case "Player Rotate":
        const rotatePlayer = game.findPlayer(data.ID);
        if (rotatePlayer) {
          rotatePlayer.updateRotation(data.rotation);
        }
        break;

      case "Player Attack":
        const attackingPlayer = game.findPlayer(data.ID);
        if (attackingPlayer) {
          attackingPlayer.isAttacking = true; // Set attacking state
          attackingPlayer.weapon.Swing(socket); // Trigger weapon swing animation
        }
        break;

      case "Parry Impact":
        const attacker = game.findPlayer(data.attackerID);
        const defender = game.findPlayer(data.defenderID);
        game.Spark(
          new RAPIER.Vector3(data.impact.x, data.impact.y, data.impact.z)
        );
        if (attacker && defender) {
          const knockbackPosition = defender.weapon.KnockbackCalc(attacker);
          defender.updatePosition(knockbackPosition);
          ///attacker.isAttacking = false;
          //attacker.weapon.Reset();
        }

        break;

      case "Player Death":
        const deadPlayer = game.findPlayer(data.ID);
        if (deadPlayer) {
          deadPlayer.mesh.visible = false;
        }
        break;

      case "Player Respawn":
        const respawnPlayer = game.findPlayer(data.ID);
        if (respawnPlayer) {
          respawnPlayer.health = data.health; // Reset health
          respawnPlayer.updatePosition(data.position); // Reset position
          respawnPlayer.updateRotation(data.rotation); // Reset rotation
          respawnPlayer.mesh.position.y = 10; // Reset height
          respawnPlayer.mesh.visible = true; // Show player mesh again
        }
        break;

      case "Remove Player":
        const disconnectedPlayer = game.findPlayer(data.ID);
        if (disconnectedPlayer) {
          game.removePlayer(disconnectedPlayer);
        }
        break;

      case "Server Error":
        console.log("Server Error");
        console.error("Server Error:", data.message, "In: ", data.problem);
        break;
    }

    if (game.player && game.player.ID !== null) {
      switch (data.action) {
        case "Player Hit":
          const attackerPlayer = game.findPlayer(data.attackerID);
          if (!attackerPlayer) return; // Ensure attacker exists

          // Apply knockback effect to the attacked player
          const attackerForward = new THREE.Vector3(0, 0, 1).applyQuaternion(
            attackerPlayer.rotation
          ); // Get attacker's forward direction
          attackerForward.normalize(); // Ensure it's a unit vector

          // Apply knockback force in the attacker's forward direction
          const knockbackForce = 3.0; // Adjust this value as needed
          const knockbackVector =
            attackerForward.multiplyScalar(knockbackForce);

          // Update the player's position with the knockback effect
          const newPosition = new THREE.Vector3(
            game.player.position.x + knockbackVector.x,
            game.player.position.y + knockbackVector.y,
            game.player.position.z + knockbackVector.z
          );
          game.player.updatePosition(
            new RAPIER.Vector3(newPosition.x, newPosition.y, newPosition.z)
          );

          socket.send(
            JSON.stringify({
              action: "Player Move",
              position: {
                x: game.player.position.x,
                y: game.player.position.y,
                z: game.player.position.z,
              },
            })
          );

          game.player.health = data.health;
          updateHealthBar();

          // Check if this kills the player
          if (game.player.health <= 0) {
            socket.send(
              JSON.stringify({
                action: "Player Death",
              })
            );
            game.player.mesh.visible = false; // Hide player mesh if health is 0
            setTimeout(() => {
              socket.send(
                JSON.stringify({
                  action: "Player Respawn",
                })
              );
              if (game.player) {
                game.player.health = 100;
                updateHealthBar();
                game.player.updatePosition(new RAPIER.Vector3(0, 0, 0)); // Reset position
                game.player.updateRotation(new THREE.Quaternion(0, 0, 0, 1));
                game.player.mesh.position.y = 10; // Reset height
                game.player.mesh.visible = true;
              }
            }, 3000);
          }

          break;
      }
    }
  };

  socket.onopen = () => {
    //console.log("Opened connection to server");
  };

  socket.onclose = () => {
    //console.log("Disconnected from server");
  };

  socket.onerror = (error) => {
    //console.error("WebSocket error:", error);
  };
  return socket;
}
function updateHealthBar() {
  if (!game.player) return;

  health.style.width = `${game.player.health}%`;
  health.style.backgroundColor =
    game.player.health > 50
      ? "green"
      : game.player.health > 20
      ? "orange"
      : "red";
  hp!.innerText = `${game.player.health}%`;
}
