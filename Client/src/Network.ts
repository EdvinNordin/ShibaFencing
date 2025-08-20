/* import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat"; */
import { game } from "./main";
import { Player } from "./Player";
import { NPCPlayer } from "./NPC";

export function initializeWebSocket() {
  const socket = new WebSocket(import.meta.env.VITE_BACKEND_URL);

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);

    switch (data.action) {
      case "Set ID":
        game.playerID = data.ID;
        game.IDLoaded = true;
        game.startGame();
        break;

      case "Send Old Players":
        data.players.forEach((playerData: any) => {
          if (!playerData.initialized) return;
          //if (game.playerID === playerData.ID) return;
          let newPlayer = new Player(
            game.world,
            playerData.name,
            playerData.color,
            playerData.ID
          );
          if (playerData.alive) {
            newPlayer.mesh.visible = true;
          } else {
            newPlayer.mesh.visible = false;
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
        if (game.players.size === 0) {
          game.bot = new NPCPlayer(game.world);
          game.addPlayer(game.bot);
          game.singleplayerMode();
        } else {
          game.multiplayerMode();
        }
        game.opponentsLoaded = true;
        game.startGame();

        break;

      case "New Player":
        let newPlayer = new Player(game.world, data.name, data.color, data.ID);
        game.addPlayer(newPlayer);
        if (game.botGame && game.bot) {
          game.multiplayerMode();
        }
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
          attackingPlayer.weapon.Swing(socket);
        }
        break;

      case "Swap Weapon Side":
        const attacker = game.findPlayer(data.ID);
        if (attacker) {
          attacker.weapon.swapSide();
        }
        break;

      case "Player Death":
        const deadPlayer = game.findPlayer(data.ID);
        if (deadPlayer) {
          deadPlayer.death();
        }
        break;

      case "Player Respawn":
        const respawnPlayer = game.findPlayer(data.ID);
        if (respawnPlayer) {
          respawnPlayer.respawn();
        }
        break;

      case "Remove Player":
        const disconnectedPlayer = game.findPlayer(data.ID);
        if (disconnectedPlayer) {
          game.removePlayer(disconnectedPlayer);
          if (game.players.size === 1) {
            game.singleplayerMode();
          }
        }
        break;

      /* case "Sync Players":
        data.players.forEach((playerData: any) => {
          const existingPlayer = game.findPlayer(playerData.ID);
          if (existingPlayer) {
            existingPlayer.updatePosition(playerData.position);
            existingPlayer.updateRotation(playerData.rotation);
            existingPlayer.health = playerData.health;
            existingPlayer.alive = playerData.alive;
            existingPlayer.weapon.side = playerData.side;
          }
        });
        break; */

      case "Server Error":
        console.log("Server Error");
        console.error("Server Error:", data.message, "In: ", data.problem);
        break;
    }

    //if (game.player && game.player.ID !== null) {
    switch (data.action) {
      case "Player Hit":
        const hitPlayer = game.findPlayer(data.ID);
        if (!hitPlayer) return;

        hitPlayer.updatePosition(data.position);

        hitPlayer.health = data.health;

        if (hitPlayer === game.player) {
          hitPlayer.updateHealthBar();
        }
        break;
    }
    //}
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
