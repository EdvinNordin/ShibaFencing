import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { Weapon } from "./Weapon";
import { model } from "./main";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";
let id = 0;
const size = new THREE.Vector3();
export class Player {
  name: string;
  mesh: THREE.Object3D;
  rigidBody: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  offset: RAPIER.Vector3;
  position: RAPIER.Vector3 = new RAPIER.Vector3(0, 10, 0);
  rotation: THREE.Quaternion = new THREE.Quaternion(0, 0, 0, 1);
  health: number = 100;
  speed: number = 7;
  ID: string;
  weapon: Weapon;
  isAttacking: boolean = false;
  movable: boolean = false; // Flag to control movement
  alive: boolean = true; // Flag to check if player is alive
  gotHit: boolean = false; // Flag to check if player got hit
  color: string;
  nameTag: THREE.Sprite | null = null;
  hitCounter: number = 0; // Counter for hit detection

  constructor(world: RAPIER.World, name: string, color: string) {
    id++;
    this.ID = id.toString();
    this.name = name;

    this.mesh = model.clone();
    this.color = color;
    this.setColor(this.color);

    this.mesh.visible = true;
    const box = new THREE.Box3().setFromObject(this.mesh); // Compute the bounding box
    box.getSize(size);

    this.offset = new RAPIER.Vector3(size.x / 2, size.y / 2, size.z / 2);

    const rbDesc = RAPIER.RigidBodyDesc.kinematicPositionBased();
    this.rigidBody = world.createRigidBody(rbDesc);
    this.rigidBody.setTranslation(this.position, true);
    this.rigidBody.setRotation(this.rotation, true);
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

    this.createNameTag(this.name);

    this.updatePosition(this.position);
  }

  updatePosition(position: RAPIER.Vector3) {
    //console.log(this.name, "position", position);
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
    this.updateHealthBar();
  }

  respawn() {
    this.alive = true;
    this.health = 100;
    this.mesh.visible = true; // Show player mesh
    this.updatePosition(new RAPIER.Vector3(0, 10, 0)); // Reset position
    this.updateRotation(new THREE.Quaternion(0, 0, 0, 1)); // Reset rotation
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

  createNameTag(message: string) {
    if (this.nameTag) {
      this.mesh.remove(this.nameTag); // Remove existing name tag if it exists
    }

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    const fontSize = 48; // Font size in pixels

    if (context) {
      // Measure the text width and set canvas dimensions
      context.font = `${fontSize}px Arial`;
      const textWidth = context.measureText(message).width;
      const textHeight =
        context.measureText(message).fontBoundingBoxAscent +
        context.measureText(message).fontBoundingBoxDescent;
      canvas.width = textWidth;
      canvas.height = textHeight;

      // Reapply the font after resizing the canvas
      context.font = `${fontSize}px Arial`;
      context.textAlign = "center";
      context.textBaseline = "middle"; // Center the text vertically
      context.fillStyle = "white"; // Text fill color
      context.strokeStyle = "black"; // Outline color
      context.lineWidth = 4; // Thickness of the outline

      // Draw the text outline and fill
      context.strokeText(message, canvas.width / 2, canvas.height / 2);
      context.fillText(message, canvas.width / 2, canvas.height / 2);
    }

    // Create a texture from the canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true; // Ensure the texture updates

    // Create a sprite material and sprite
    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
    });
    const sprite = new THREE.Sprite(spriteMaterial);

    // Adjust the sprite's scale and position
    sprite.scale.set(message.length * 0.25, 0.5, 1); // Adjust as needed
    sprite.position.set(0, 1.3, 0); // Position above the player
    this.nameTag = sprite;
    this.mesh.add(sprite);
  }

  setColor(color: string) {
    this.color = color;
    this.mesh.traverse((child) => {
      if (
        child.name === "Group18985_default_0" &&
        child instanceof THREE.Mesh
      ) {
        child.material = new THREE.MeshBasicMaterial({
          color: this.color,
        });
      }
    });
  }
}
