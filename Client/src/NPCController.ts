import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { NPCPlayer } from "./NPC";
import { game } from "./main";

export class NPCController {
  npc: NPCPlayer;

  constructor(npc: NPCPlayer) {
    this.npc = npc;
  }

  update() {
    this.moveRandomly();
    const closestPlayer = this.findClosestPlayer();
    if (closestPlayer) {
      this.npc.lerpPlayer(game.socket); // Example of interacting with the NPC
    }
  }

  moveRandomly() {
    let direction = new THREE.Vector3(
      Math.random() - 0.5,
      0,
      Math.random() - 0.5
    );

    let movement = direction.multiplyScalar(this.npc.speed * game.deltaTime);

    if (this.npc.position.x + movement.x > 10) movement.x = -movement.x;
    if (this.npc.position.x + movement.x < -10) movement.x = -movement.x;
    if (this.npc.position.z + movement.z > 10) movement.z = -movement.z;
    if (this.npc.position.z + movement.z < -10) movement.z = -movement.z;

    this.npc.updatePosition(
      new RAPIER.Vector3(
        this.npc.position.x + movement.x,
        this.npc.position.y,
        this.npc.position.z + movement.z
      )
    );
  }

  findClosestPlayer() {
    let closestPlayer: Player | null = null;
    let closestDistance = Infinity;

    game.players.forEach((player) => {
      if (player.ID !== this.npc.ID && player.alive) {
        const distance = this.npc.mesh.position.distanceTo(
          player.mesh.position
        );
        if (distance < closestDistance) {
          closestDistance = distance;
          closestPlayer = player;
        }
      }
    });
    return closestPlayer;
  }
}
