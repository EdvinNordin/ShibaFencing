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
        game.IDLoaded = true;
        game.startGame();
        break;

      case "Send Old Players":
        data.players.forEach((playerData: any) => {
          if (playerData.initialized === false) return;
          //if (game.playerID === playerData.ID) return;
          let newPlayer = new Player(
            game.world,
            playerData.name,
            playerData.color,
            playerData.ID
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
        game.opponentsLoaded = true;
        game.startGame();
        break;

      case "New Player":
        let newPlayer = new Player(game.world, data.name, data.color, data.ID);
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
        }
        break;

      case "Sync Players":
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
        break;

      case "Server Error":
        console.log("Server Error");
        console.error("Server Error:", data.message, "In: ", data.problem);
        break;
    }

    if (game.player && game.player.ID !== null) {
      switch (data.action) {
        case "Player Hit":
          const hitPlayer = game.findPlayer(data.ID);
          if (!hitPlayer) return; // Ensure hit player exists

          hitPlayer.updatePosition(data.position);

          hitPlayer.health = data.health;

          if (hitPlayer === game.player) {
            hitPlayer.updateHealthBar();
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
