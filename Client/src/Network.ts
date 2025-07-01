import * as THREE from "three";
import { game } from "./main";
import { Player } from "./Player";
import RAPIER from "@dimforge/rapier3d-compat";
import { Game } from "./Game";

export const socket = new WebSocket("ws://localhost:8181");

export function Network() {
  // Handle incoming events
  socket.onmessage = (event) => {
    // The server sends JSON, so parse it
    const data = JSON.parse(event.data);
    switch (data.action) {
      case "Set ID":
        game.player.ID = data.ID;
        console.log(`Player ID set to: ${game.player.ID}`);
        break;

      case "Send Old Players":
        let amount = 0;
        data.players.forEach((playerData: any) => {
            if (playerData.ID !== game.player.ID) {
              let newPlayer = new Player(game.world, new RAPIER.Vector3(playerData.position[0], playerData.position[1], playerData.position[2]));
              newPlayer.ID = playerData.ID;
              newPlayer.health = playerData.health;
              game.addPlayer(newPlayer);
              amount++;
            }
        });
        console.log(`Received ${amount} players from server.`);
        break;

      case "New Player":
        let newPlayer = new Player(game.world);
        newPlayer.ID = data.ID;
        game.addPlayer(newPlayer);
        console.log(`New player connected: ${data.ID}`);
        break;
          
      case "Player Move":
        const currPlayer = game.findPlayer(data.ID);
        if (currPlayer) {
          currPlayer.updatePosition(data.position);
        }
        //console.log("Another player has moved")
        break;

      case "Remove Player":
        const disconnectedPlayer = game.findPlayer(data.ID);
        if (disconnectedPlayer) {
          game.removePlayer(disconnectedPlayer);
        }
        console.log(`A player has disconnected`);
        break;
    }
  };

  window.addEventListener("beforeunload", () => {
    //socket.send(JSON.stringify({ action: "Player Disconnected", ID: player.id }));
  });

  socket.onclose = () => {
    console.log("Disconnected from server");
  };

  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
  };
}
