import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { game } from "./main";
import { Player } from "./Player";

export const socket = new WebSocket("ws://localhost:8181");

// Handle incoming events
socket.onmessage = (event) => {
  // The server sends JSON, so parse it
  const data = JSON.parse(event.data);
  switch (data.action) {
    case "Set ID":
      game.player.ID = data.ID;
      break;

    case "Send Old Players":
      let amount = 0;
      data.players.forEach((playerData: any) => {
          let newPlayer = new Player(game.model.clone(), new RAPIER.Vector3(playerData.position[0], playerData.position[1], playerData.position[2]));
          newPlayer.ID = playerData.ID;
          newPlayer.health = playerData.health;
          newPlayer.updateRotation(new THREE.Quaternion(playerData.rotation[0], playerData.rotation[1], playerData.rotation[2], playerData.rotation[3]));
          game.addPlayer(newPlayer);
          amount++;
      });
      break;

    case "New Player":
      let newPlayer = new Player(game.model.clone());
      newPlayer.ID = data.ID;
      game.addPlayer(newPlayer);
      break;
        
    case "Player Move":
      const movePlayer = game.findPlayer(data.ID);
      //console.log("Player Move", data);
      if (movePlayer) {
        movePlayer.updatePosition(new RAPIER.Vector3(data.position.posX, data.position.posY, data.position.posZ));
      }
      break;

    case "Player Rotate":
      const rotatePlayer = game.findPlayer(data.ID);

      //console.log("Player Rot", data.rotation.rotY);
      if (rotatePlayer) {
        rotatePlayer.updateRotation(new THREE.Quaternion(data.rotation.rotX, data.rotation.rotY, data.rotation.rotZ, data.rotation.rotW));
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
    console.log("Opened connection to server");
  };

  socket.onclose = () => {
    console.log("Disconnected from server");
  };

  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
  };
