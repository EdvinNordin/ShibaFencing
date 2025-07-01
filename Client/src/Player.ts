import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

export class Player {
  mesh: THREE.Mesh;
  position: RAPIER.Vector3;
  health: number = 100;
  speed: number = 10;
  ID: string;

  constructor(world: RAPIER.World, position: RAPIER.Vector3 = new RAPIER.Vector3(0, 0, 0), ID: string = crypto.randomUUID()) {
    this.ID = ID;

    const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
    const boxMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    this.mesh = new THREE.Mesh(boxGeometry, boxMaterial);
    this.mesh.position.set(position.x, position.y, position.z);
    
    this.position = position;
  }

  updatePosition(position: RAPIER.Vector3) {
    this.mesh.position.set(position.x, position.y, position.z);
    this.position = position;
  }
}

