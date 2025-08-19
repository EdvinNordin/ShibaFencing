import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { Weapon } from "./Weapon";
import { model, game } from "./main";
//import { setAudio } from "./Loader";
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
  alive: boolean = true;
  gotHit: boolean = false;
  color: string;
  nameTag: THREE.Sprite | null = null;
  hitCounter: number = 0;
  //moveSound: THREE.PositionalAudio;

  constructor(world: RAPIER.World, name: string, color: string, ID: string) {
    this.ID = ID;
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
    this.weapon.mesh.position.set(0, 0.4, 0.8);

    this.createNameTag(this.name);

    this.updatePosition(this.position);
    /*
    const moveSound = setAudio(game.audioListener, "move", 0.1);
    if (!moveSound) {
      throw new Error("Failed to create move sound audio.");
    }
    this.moveSound = moveSound;

    this.mesh.add(this.moveSound);*/
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
    this.alive = false;
    this.health = 0;
    this.mesh.visible = false;
    this.updateHealthBar();
    setTimeout(() => {
      game.socket.send(
        JSON.stringify({
          action: "Player Respawn",
        })
      );

      this.respawn();
    }, 3000);
  }

  respawn() {
    this.alive = true;
    this.health = 100;
    this.mesh.visible = true;
    this.updatePosition(new RAPIER.Vector3(0, 10, 0));
    this.updateRotation(new THREE.Quaternion(0, 0, 0, 1));
    this.updateHealthBar();
  }

  updateHealthBar() {
    if (this === game.player) {
      let health = document.getElementById("hp") as HTMLDivElement;
      let hp = document.getElementById("currentHP");
      health.style.width = `${this.health}%`;
      health.style.backgroundColor =
        this.health > 50 ? "green" : this.health > 20 ? "orange" : "red";
      hp!.innerText = `${this.health}%`;
    }
  }

  createNameTag(message: string) {
    if (this.nameTag) {
      this.mesh.remove(this.nameTag);
    }

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    const fontSize = 48; // in pixels

    if (context) {
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
      context.textBaseline = "middle";
      context.fillStyle = "white";
      context.strokeStyle = "rgb(50, 50, 50)";
      context.lineWidth = 4;

      context.strokeText(message, canvas.width / 2, canvas.height / 2);
      context.fillText(message, canvas.width / 2, canvas.height / 2);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true; // Ensure the texture updates

    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
    });
    const sprite = new THREE.Sprite(spriteMaterial);

    sprite.scale.set(message.length * 0.25, 0.5, 1); // Can be adjusted
    sprite.position.set(0, 1.3, 0);
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
        child.material = new THREE.MeshToonMaterial({
          color: this.color,
        });
      }
    });
  }
}
