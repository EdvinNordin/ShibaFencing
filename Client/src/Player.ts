import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { Weapon } from "./Weapon";
import { model } from "./main";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";

export class Player {
  name: string = "Player";
  mesh: THREE.Object3D;
  position: RAPIER.Vector3 = new RAPIER.Vector3(0, 0, 0);
  rotation: THREE.Quaternion = new THREE.Quaternion(0, 0, 0, 1);
  health: number = 100;
  speed: number = 7;
  ID: string;
  weapon: Weapon;
  isAttacking: boolean = false;
  movable: boolean = false; // Flag to control movement
  alive: boolean = true; // Flag to check if player is alive

  constructor() {
    this.ID = crypto.randomUUID();

    this.mesh = model.clone();

    this.mesh.position.set(this.position.x, 10, this.position.z);

    this.weapon = new Weapon();
    this.mesh.add(this.weapon.mesh);
    this.weapon.mesh.position.set(0, -0.1, 0.3);
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

  death() {
    this.alive = false; // Set alive flag to false
    this.health = 0;
    this.mesh.visible = false; // Hide player mesh if health is 0
    this.movable = false; // Disable movement
    this.updatePosition(new RAPIER.Vector3(0, 0, 0));
    this.updateRotation(new THREE.Quaternion(0, 0, 0, 1)); // Reset rotation
    this.mesh.position.y = -20; // Reset height
    this.updateHealthBar();
  }

  respawn() {
    this.alive = true;
    this.health = 100;
    this.mesh.visible = true; // Show player mesh
    this.updatePosition(new RAPIER.Vector3(0, 0, 0)); // Reset position
    this.updateRotation(new THREE.Quaternion(0, 0, 0, 1)); // Reset rotation
    this.mesh.position.y = 10; // Reset height
    this.updateHealthBar(); // Update health bar
  }

  updateHealthBar() {
    let health = document.getElementById("hp") as HTMLDivElement;
    let hp = document.getElementById("currentHP");
    health.style.width = `${this.health}%`;
    health.style.backgroundColor =
      this.health > 50 ? "green" : this.health > 20 ? "orange" : "red";
    hp!.innerText = `${this.health}%`;
  }
}
