import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { game } from "./main";
import { Player } from "./Player";

export class Controller {
  player: Player;
  world: RAPIER.World;
  camera: THREE.PerspectiveCamera;
  input: InputManager;
  targetRotation: THREE.Quaternion = new THREE.Quaternion(0, 0, 0, 1);
  velocity: RAPIER.Vector3;

  constructor(
    player: Player,
    world: RAPIER.World,
    camera: THREE.PerspectiveCamera
  ) {
    this.player = player;
    this.world = world;
    this.camera = camera;
    this.input = new InputManager();
    this.velocity = new RAPIER.Vector3(0, 0, 0);
  }

  move(deltaTime: number, socket: WebSocket) {
    const threeDirection = new THREE.Vector3(0, 0, 0);
    let movement = false;
    if (this.input.isPressed("w")) (threeDirection.z -= 1), (movement = true);
    if (this.input.isPressed("s")) (threeDirection.z += 1), (movement = true);
    if (this.input.isPressed("a")) (threeDirection.x -= 1), (movement = true);
    if (this.input.isPressed("d")) (threeDirection.x += 1), (movement = true);

    this.updateCameraOrbit(this.input);
    if (movement) {
      threeDirection.normalize();
      threeDirection.multiplyScalar(this.player.speed * deltaTime);

      threeDirection.applyQuaternion(this.camera.quaternion); // move relative to camera
      threeDirection.y = 0;

      const direction = new RAPIER.Vector3(
        threeDirection.x,
        threeDirection.y,
        threeDirection.z
      );

      const nextPos = {
        x: this.player.position.x + direction.x,
        y: this.player.position.y + direction.y,
        z: this.player.position.z + direction.z,
      };

      game.rigidBody.setNextKinematicTranslation(nextPos);

      this.player.updatePosition(nextPos);

      const from = new THREE.Vector3(0, 0, 1); // forward
      const to = threeDirection.clone().normalize();

      const quat = new THREE.Quaternion().setFromUnitVectors(from, to);

      if(quat !== this.targetRotation){
        this.updateTargetRotation(quat);
      }

      socket.send(
        JSON.stringify({
          action: "Player Move",
          position: { x: nextPos.x, y: nextPos.y, z: nextPos.z },
        })
      );
    }

    if(!this.targetRotation.equals(this.player.rotation)){
      this.rotateTowardsTarget();
      socket.send(
          JSON.stringify({
            action: "Player Rotate",
            rotation: { x: this.player.rotation.x, y: this.player.rotation.y, z: this.player.rotation.z, w: this.player.rotation.w  },
          })
        )
    }
  }

  // MAGIC LOOK INTO THIS LATER
  updateCameraOrbit(input: InputManager) {
    let rotateBool = false;
    // Adjust angle with input
    if (input.isPressed("ArrowLeft")) this.camera.userData.orbitAngle += 0.05, rotateBool = true;
    if (input.isPressed("ArrowRight")) this.camera.userData.orbitAngle -= 0.05, rotateBool = true;
    if (input.isPressed("j")) this.camera.userData.orbitAngle += 0.05, rotateBool = true;
    if (input.isPressed("l")) this.camera.userData.orbitAngle -= 0.05, rotateBool = true;

    // Store angle as a property of the camera (or globally)
    if (this.camera.userData.orbitAngle === undefined) this.camera.userData.orbitAngle = 0;

    // Set camera position using polar coordinates
    const radius = 10;
    const height = 5;
    const angle = this.camera.userData.orbitAngle;

    const target = new THREE.Vector3(
      this.player.position.x,
      this.player.position.y,
      this.player.position.z
    );

    this.camera.position.x = target.x + radius * Math.sin(angle);
    this.camera.position.z = target.z + radius * Math.cos(angle);
    this.camera.position.y = target.y + height;
  
    this.camera.lookAt(target)
  }

  rotateTowardsTarget() {
    this.player.rotation.slerp(this.targetRotation, 0.3);

    if (this.player.rotation.angleTo(this.targetRotation) < 0.001) {
      this.player.rotation.copy(this.targetRotation);
    }

    this.player.mesh.quaternion.set(this.player.rotation.x, this.player.rotation.y, this.player.rotation.z, this.player.rotation.w);
  }

  updateTargetRotation(rotation: THREE.Quaternion) {
    this.targetRotation = rotation;
  }
}

export class InputManager {
  keys: Record<string, boolean> = {};

  constructor() {
    window.addEventListener("keydown", (e) => (this.keys[e.key] = true));
    window.addEventListener("keyup", (e) => (this.keys[e.key] = false));
  }

  isPressed(key: string): boolean {
    return !!this.keys[key];
  }
}
