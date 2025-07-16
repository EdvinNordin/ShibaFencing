import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { Weapon } from "./Weapon";
import { model } from "./main";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";
let id = 0;
export class Player {
  name: string = "Player";
  mesh: THREE.Object3D;
  rigidBody: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  offset: RAPIER.Vector3;
  position: RAPIER.Vector3 = new RAPIER.Vector3(0, 0, 0);
  rotation: THREE.Quaternion = new THREE.Quaternion(0, 0, 0, 1);
  health: number = 100;
  speed: number = 7;
  ID: string;
  weapon: Weapon;
  isAttacking: boolean = false;
  movable: boolean = false; // Flag to control movement
  alive: boolean = true; // Flag to check if player is alive
  gotHit: boolean = false; // Flag to check if player got hit

  constructor(world: RAPIER.World) {
    id++;
    this.ID = id.toString();

    this.mesh = model.clone();
    const box = new THREE.Box3().setFromObject(this.mesh); // Compute the bounding box
    const size = new THREE.Vector3();
    box.getSize(size);

    this.offset = new RAPIER.Vector3(size.x / 2, size.y / 2, size.z / 2);

    this.mesh.position.set(this.position.x, 10, this.position.z);

    const rbDesc = RAPIER.RigidBodyDesc.kinematicPositionBased();
    this.rigidBody = world.createRigidBody(rbDesc);
    let colliderDesc = RAPIER.ColliderDesc.cuboid(
      this.offset.x,
      this.offset.y,
      this.offset.z
    );
    this.collider = world.createCollider(colliderDesc, this.rigidBody);
    this.collider.setSensor(true); // Set the collider as a sensor

    this.weapon = new Weapon(world, this);
    this.mesh.add(this.weapon.mesh);
    this.weapon.mesh.position.set(0, 0.4, 0.75);
  }

  updatePosition(position: RAPIER.Vector3) {
    this.position = position;
    this.mesh.position.set(position.x, position.y, position.z);
    this.rigidBody.setNextKinematicTranslation(position);

    const globalPosition = new THREE.Vector3();
    this.weapon.mesh.getWorldPosition(globalPosition);
    this.weapon.rigidBody.setNextKinematicTranslation(
      new RAPIER.Vector3(globalPosition.x, globalPosition.y, globalPosition.z)
    );
  }

  updateRotation(rotation: THREE.Quaternion) {
    this.rotation = rotation;
    this.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    this.rigidBody.setNextKinematicRotation(rotation);

    let globalQuaternion = new THREE.Quaternion();
    this.weapon.mesh.getWorldQuaternion(globalQuaternion);
    this.weapon.rigidBody.setRotation(globalQuaternion, false);
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
