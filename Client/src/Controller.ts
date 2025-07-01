import * as THREE from "three";
import { Player } from "./Player";
import RAPIER from "@dimforge/rapier3d-compat";
import { socket } from "./Network";
import { game } from "./main";

export class Controller {
  player: Player;
  world: RAPIER.World;
  camera: THREE.PerspectiveCamera;
  input: InputManager;

  constructor(
    player: Player,
    world: RAPIER.World,
    camera: THREE.PerspectiveCamera
  ) {
    this.player = player;
    this.world = world;
    this.camera = camera;
    this.input = new InputManager();
  }

  move(deltaTime: number) {
    const threeDirection = new THREE.Vector3(0, 0, 0);
    let movement = false;
    if (this.input.isPressed("w")) (threeDirection.z -= 1), (movement = true);
    if (this.input.isPressed("s")) (threeDirection.z += 1), (movement = true);
    if (this.input.isPressed("a")) (threeDirection.x -= 1), (movement = true);
    if (this.input.isPressed("d")) (threeDirection.x += 1), (movement = true);

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

      socket.send(
        JSON.stringify({
          action: "Player Move",
          position: { x: nextPos.x, y: nextPos.y, z: nextPos.z },
        })
      );
    }

    updateCameraOrbit(this.camera, this.player.mesh.position, this.input);
  }
}

// MAGIC LOOK INTO LATER
function updateCameraOrbit(
  camera: THREE.PerspectiveCamera,
  target: THREE.Vector3,
  input: InputManager
) {
  // Adjust angle with input
  if (input.isPressed("ArrowLeft")) camera.userData.orbitAngle += 0.05;
  if (input.isPressed("ArrowRight")) camera.userData.orbitAngle -= 0.05;
  // Store angle as a property of the camera (or globally)
  if (camera.userData.orbitAngle === undefined) camera.userData.orbitAngle = 0;
// Store angle as a property of the camera (or globally)
  if (camera.userData.orbitAngle === undefined) camera.userData.orbitAngle = 0;


  // Set camera position using polar coordinates
  const radius = 10;
  const height = 5;
  const angle = camera.userData.orbitAngle;

  camera.position.x = target.x + radius * Math.sin(angle);
  camera.position.z = target.z + radius * Math.cos(angle);
  camera.position.y = target.y + height;

  camera.lookAt(target);
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
