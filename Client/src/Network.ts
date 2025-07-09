import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { game } from "./main";
import { Player } from "./Player";

export const socket = new WebSocket(import.meta.env.VITE_BACKEND_URL);

let health = document.getElementById("hp") as HTMLDivElement;
let hp = document.getElementById("currentHP");
// Handle incoming events
socket.onmessage = (event) => {
  // The server sends JSON, so parse it
  const data = JSON.parse(event.data);
  switch (data.action) {
    case "Set ID":
      game.player.ID = data.ID;
      break;

    case "Send Old Players":
      data.players.forEach((playerData: any) => {
        let newPlayer = new Player();
        newPlayer.ID = playerData.ID;
        newPlayer.health = playerData.health;
        newPlayer.updatePosition(playerData.position);
        newPlayer.updateRotation(playerData.rotation);
        game.addPlayer(newPlayer);
      });
      break;

    case "New Player":
      let newPlayer = new Player();
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
        attackingPlayer.weapon.Swing(); // Trigger weapon swing animation
      }
      break;

    case "Player Hit":
      game.player.health = data.health;
      updateHealthBar();
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
          game.player.health = 100;
          updateHealthBar();
          game.player.updatePosition(new RAPIER.Vector3(0, 0, 0)); // Reset position
          game.player.updateRotation(new THREE.Quaternion(0, 0, 0, 1));
          game.player.mesh.position.y = 10; // Reset height
          game.player.mesh.visible = true;
        }, 3000); // Respawn after 2 seconds
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

function updateHealthBar() {
  health.style.width = `${game.player.health}%`;
  health.style.backgroundColor =
    game.player.health > 50
      ? "green"
      : game.player.health > 20
      ? "orange"
      : "red";
  hp!.innerText = `${game.player.health}%`;
}
