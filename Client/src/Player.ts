import * as THREE from "three";
import { Weapon } from "./Weapon";
import { model, game } from "./main";
import { OBB } from "three/addons/math/OBB.js";
//import { setAudio } from "./Loader";
const size = new THREE.Vector3();
export class Player {
  name: string;
  mesh: THREE.Object3D;
  //rigidBody: RAPIER.RigidBody;
  collider: OBB;
  //offset: RAPIER.Vector3;
  position: THREE.Vector3 = new THREE.Vector3(0, 10, 0);
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
  isKnockbacked: boolean = false;
  targetPosition: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  obbDebug: THREE.LineSegments | null = null;
  constructor(name: string, color: string, ID: string) {
    this.ID = ID;
    this.name = name;

    this.mesh = model.clone();
    this.color = color;
    this.setColor(this.color);

    this.mesh.visible = true;

    this.collider = new OBB();
    this.collider.fromBox3(new THREE.Box3().setFromObject(this.mesh));

    this.weapon = new Weapon(this);
    this.mesh.add(this.weapon.mesh);
    this.weapon.mesh.position.set(0, 0.4, 0.8);

    this.createNameTag(this.name);

    this.updatePosition(this.position);
    this.createOBBDebug();
  }

  updatePosition(position: THREE.Vector3) {
    this.position = position;
    this.mesh.position.set(position.x, position.y, position.z);
    this.collider.center.copy(this.position);

    this.updateOBB();
    this.weapon.updateOBB();
  }

  updateRotation(rotation: THREE.Quaternion) {
    this.rotation = rotation;
    this.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);

    this.updateOBB();
    this.weapon.updateOBB();
  }

  death() {
    this.alive = false;
    this.health = 0;
    this.mesh.visible = false;
    this.updateHealthBar();
    this.isKnockbacked = false;
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
    this.updatePosition(new THREE.Vector3(0, 10, 0));
    this.updateRotation(new THREE.Quaternion(0, 0, 0, 1));
    this.updateHealthBar();
  }

  updateHealthBar() {
    if (this === game.player && !game.debug) {
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

  updateOBB() {
    this.mesh.updateWorldMatrix(true, true);
    this.collider.center.setFromMatrixPosition(this.mesh.matrixWorld);
    this.collider.rotation.setFromMatrix4(this.mesh.matrixWorld);

    if (game.debug && this.obbDebug) {
      this.obbDebug.position.copy(this.collider.center);
      const rotation = new THREE.Quaternion();
      const matrix4 = new THREE.Matrix4().setFromMatrix3(
        this.collider.rotation
      );
      rotation.setFromRotationMatrix(matrix4);
      this.obbDebug.setRotationFromQuaternion(rotation);
    }
  }
  createOBBDebug() {
    if (game.debug) {
      const geometry = new THREE.BoxGeometry(1, 1, 1); // Unit box
      const edges = new THREE.EdgesGeometry(geometry); // Create edges for wireframe
      const material = new THREE.LineBasicMaterial({ color: 0x00ff00 }); // Green wireframe
      this.obbDebug = new THREE.LineSegments(edges, material);

      const size = new THREE.Vector3();
      this.collider.getSize(size);
      this.obbDebug.scale.copy(size);

      game.scene.add(this.obbDebug); // Add the visualizer to the scene
    } else {
      this.obbDebug = null;
    }
  }
}
