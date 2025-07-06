import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { Weapon } from "./Weapon";
import { model } from "./main";

export class Player {
  mesh: THREE.Object3D;
  position: RAPIER.Vector3;
  rotation: THREE.Quaternion = new THREE.Quaternion(0, 0, 0, 1);
  health: number = 100;
  speed: number = 10;
  ID: string;
  weapon: Weapon;
  isAttacking: boolean = false;

  constructor(position: RAPIER.Vector3 = new RAPIER.Vector3(0, 0, 0)) {
    this.ID = crypto.randomUUID();

    this.mesh = model.clone();

    this.mesh.position.set(position.x, position.y, position.z);

    this.weapon = new Weapon();
    this.mesh.add(this.weapon.mesh);
    this.weapon.mesh.position.set(0, -0.1, 0.3);

    this.position = position;
  }

  updatePosition(position: RAPIER.Vector3) {
    this.mesh.position.set(position.x, position.y, position.z);
    this.position = position;
  }

  updateRotation(rotation: THREE.Quaternion) {
    this.rotation = rotation;
    this.mesh.quaternion.set(
      this.rotation.x,
      this.rotation.y,
      this.rotation.z,
      this.rotation.w
    );
  }
}
