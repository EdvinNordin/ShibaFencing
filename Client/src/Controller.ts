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
  cameraTargetPosition: THREE.Vector3 = new THREE.Vector3(0, 0, 0);

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
  number = 0;

  updateController(socket: WebSocket) {
    this.updateCameraOrbit(this.input);

    this.updateCameraPosition(true);

    if (this.player.movable && !this.player.isAttacking) this.move(socket);

    if (!this.targetRotation.equals(this.player.rotation))
      this.rotateTowardsTarget(socket);

    if (this.input.isPressed(" ") && !this.player.isAttacking)
      this.attack(socket);

    if (this.player.alive) this.fallingPossibility(socket);

    const globalPosition = new THREE.Vector3();
    this.player.weapon.mesh.getWorldPosition(globalPosition);
    this.player.weapon.rigidBody.setNextKinematicTranslation(
      new RAPIER.Vector3(globalPosition.x, globalPosition.y, globalPosition.z)
    );
  }

  move(socket: WebSocket) {
    const threeDirection = new THREE.Vector3(0, 0, 0);
    let movement = false;
    if (this.input.isPressed("w")) (threeDirection.z -= 1), (movement = true);
    if (this.input.isPressed("s")) (threeDirection.z += 1), (movement = true);
    if (this.input.isPressed("a")) (threeDirection.x -= 1), (movement = true);
    if (this.input.isPressed("d")) (threeDirection.x += 1), (movement = true);

    if (movement) {
      threeDirection.applyQuaternion(this.camera.quaternion);
      threeDirection.y = 0;
      threeDirection.normalize();
      threeDirection.multiplyScalar(this.player.speed * game.deltaTime); // Scale movement by deltaTime

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

      let nextPos3 = new THREE.Vector3(nextPos.x, nextPos.y, nextPos.z);

      this.cameraTargetPosition.copy(this.offsetCalc(nextPos3));

      this.player.updatePosition(nextPos);

      const from = new THREE.Vector3(0, 0, 1); // forward
      const to = threeDirection.clone().normalize();

      const quat = new THREE.Quaternion().setFromUnitVectors(from, to);

      if (quat !== this.targetRotation) {
        this.targetRotation = quat;
      }

      socket.send(
        JSON.stringify({
          action: "Player Move",
          position: { x: nextPos.x, y: nextPos.y, z: nextPos.z },
        })
      );
    }
  }

  attack(socket: WebSocket) {
    this.player.isAttacking = true;
    socket.send(
      JSON.stringify({
        action: "Player Attack",
        ID: this.player.ID,
        range: this.player.weapon.range,
      })
    );
    this.player.weapon.Swing(socket);
  }

  updateCameraOrbit(input: InputManager) {
    let rotateBool = false;
    const rotationSpeed = game.deltaTime; // Scale rotation speed by deltaTime

    if (input.isPressed("ArrowLeft"))
      (this.camera.userData.orbitAngle += rotationSpeed), (rotateBool = true);
    if (input.isPressed("ArrowRight"))
      (this.camera.userData.orbitAngle -= rotationSpeed), (rotateBool = true);
    if (this.camera.userData.orbitAngle === undefined)
      this.camera.userData.orbitAngle = 0;

    if (rotateBool) this.updateCameraPosition(true);
  }

  updateCameraPosition(isLerp: boolean) {
    // Smoothly interpolate the camera target position
    const playerPos = new THREE.Vector3(
      this.player.position.x,
      this.player.position.y,
      this.player.position.z
    );

    // Update the target position for the camera
    this.cameraTargetPosition.copy(this.offsetCalc(playerPos));

    // Calculate the camera's position relative to the target position
    const currentPos = this.camera.position.clone(); // Start from the camera's current position

    if (isLerp) {
      currentPos.lerp(
        this.cameraTargetPosition,
        1 - Math.pow(0.01, game.deltaTime)
      ); // Scale lerp factor by deltaTime
      if (
        Math.abs(currentPos.x - this.cameraTargetPosition.x) < 0.001 &&
        Math.abs(currentPos.y - this.cameraTargetPosition.y) < 0.001 &&
        Math.abs(currentPos.z - this.cameraTargetPosition.z) < 0.001
      ) {
        currentPos.copy(this.cameraTargetPosition);
      }
    } else {
      currentPos.lerp(this.cameraTargetPosition, 0.1); // Scale lerp factor by deltaTime
      if (
        Math.abs(currentPos.x - this.cameraTargetPosition.x) < 0.001 &&
        Math.abs(currentPos.y - this.cameraTargetPosition.y) < 0.001 &&
        Math.abs(currentPos.z - this.cameraTargetPosition.z) < 0.001
      ) {
        currentPos.copy(this.cameraTargetPosition);
      }
    }

    // Update the camera's position
    this.camera.position.set(currentPos.x, currentPos.y, currentPos.z);

    const offset = new THREE.Vector3();
    offset.copy(this.cameraTargetPosition.sub(currentPos));
    // Ensure the camera is always looking at the target position
    this.camera.lookAt(
      this.player.position.x - offset.x,
      this.player.position.y - offset.y,
      this.player.position.z - offset.z
    );
  }

  offsetCalc(vec: THREE.Vector3): THREE.Vector3 {
    const radius = 10;
    const height = 5;
    const angle = this.camera.userData.orbitAngle;

    // Calculate the target position based on the camera's orbit
    return new THREE.Vector3(
      vec.x + radius * Math.sin(angle),
      vec.y + height,
      vec.z + radius * Math.cos(angle)
    );
  }

  rotateTowardsTarget(socket: WebSocket) {
    this.player.rotation.slerp(
      this.targetRotation,
      1 - Math.pow(0.001, game.deltaTime)
    ); // Scale slerp factor by deltaTime

    if (this.player.rotation.angleTo(this.targetRotation) < 0.001) {
      this.player.updateRotation(this.targetRotation);
    }

    this.player.updateRotation(this.player.rotation);

    socket.send(
      JSON.stringify({
        action: "Player Rotate",
        rotation: {
          x: this.player.rotation.x,
          y: this.player.rotation.y,
          z: this.player.rotation.z,
          w: this.player.rotation.w,
        },
      })
    );
  }

  fallingPossibility(socket: WebSocket) {
    const fallSpeed = 10 * game.deltaTime; // Scale falling speed by deltaTime

    if (
      this.player.mesh.position.y > 0 &&
      socket.readyState === WebSocket.OPEN
    ) {
      this.player.mesh.position.y -= fallSpeed;
      this.player.movable = false;
      socket.send(
        JSON.stringify({
          action: "Player Move",
          position: {
            x: this.player.mesh.position.x,
            y: this.player.mesh.position.y,
            z: this.player.mesh.position.z,
          },
        })
      );
    }

    if (this.player.mesh.position.y < -20) {
      socket.send(
        JSON.stringify({
          action: "Player Death",
        })
      );
      this.player.death();

      setTimeout(() => {
        socket.send(
          JSON.stringify({
            action: "Player Respawn",
          })
        );
        this.player.respawn();
      }, 3000);
    } else if (
      Math.abs(this.player.position.x) > 11 ||
      Math.abs(this.player.position.z) > 11
    ) {
      this.player.alive;
      this.player.movable = false;
      this.player.mesh.position.y -= fallSpeed;
      socket.send(
        JSON.stringify({
          action: "Player Move",
          position: {
            x: this.player.mesh.position.x,
            y: this.player.mesh.position.y,
            z: this.player.mesh.position.z,
          },
        })
      );
    } else if (this.player.mesh.position.y < 0.1 && this.player.health > 0) {
      this.player.mesh.position.y = 0; // Reset height to 0 if close enough
      this.player.movable = true;
    }
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
