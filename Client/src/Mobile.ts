import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { game } from "./main";
import { Player } from "./Player";
import nipplejs from "nipplejs";
import screenfull from "screenfull";

const joystickZone = document.getElementById("joystickZone");
const rotateZone = document.getElementById("rotateZone");
const swingButton = document.getElementById("swingButton");
const fullscreenButton = document.getElementById("fullscreenButton");
let attackReady = false;

export class MobileController {
  player: Player;
  world: RAPIER.World;
  camera: THREE.PerspectiveCamera;
  input: InputManager;
  targetRotation: THREE.Quaternion = new THREE.Quaternion(0, 0, 0, 1);
  cameraTargetPosition: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  joystick: nipplejs.JoystickManager;
  joystickCentered: boolean = true;
  joystickPosition: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  prevTouchX: number = -1;

  constructor(
    player: Player,
    world: RAPIER.World,
    camera: THREE.PerspectiveCamera
  ) {
    this.player = player;
    this.world = world;
    this.camera = camera;
    this.input = new InputManager();
    this.joystick = nipplejs.create({
      zone: joystickZone ?? undefined,
      mode: "static",
      position: { left: "50%", top: "50%" },
      restOpacity: 1,
    });

    if (rotateZone) {
      rotateZone.addEventListener("touchstart", (e) => {
        if (e.touches.length > 0) {
          const touch = e.touches[0];
          this.prevTouchX = touch.clientX - window.innerWidth / 2;
        }
      });

      rotateZone.addEventListener("touchmove", (e) => {
        if (e.touches.length > 0 && this.prevTouchX !== -1) {
          const touch = e.touches[0];
          const touchDeltaX = touch.clientX - window.innerWidth / 2;

          this.camera.userData.orbitAngle -=
            (touchDeltaX - this.prevTouchX) * 0.005;
          this.prevTouchX = touchDeltaX;
        }
      });

      rotateZone.addEventListener("touchend", (e) => {
        this.prevTouchX = -1;
      });
    }

    if (swingButton) {
      swingButton.style.setProperty("display", "block");
      swingButton.addEventListener("touchstart", (e) => {
        if (this.player.isAttacking) return;
        attackReady = true;
      });
    }
    attackReady = false;

    if (fullscreenButton) {
      fullscreenButton.style.setProperty("display", "block");
      fullscreenButton.addEventListener("click", () => {
        if (screenfull.isEnabled) {
          screenfull.toggle();
        }
      });
    }
  }

  updateController(socket: WebSocket) {
    this.updateCameraOrbit(this.input);

    this.updateCameraPosition(true);

    if (this.player.movable && !this.player.isAttacking) this.move(socket);

    if (!this.targetRotation.equals(this.player.rotation))
      this.rotateTowardsTarget(socket);

    if (!this.player.isAttacking && attackReady) this.attack(socket);

    this.fallingPossibility(socket);
  }

  move(socket: WebSocket) {
    this.joystick.on("move", (e, data) => {
      this.joystickCentered = false;
      this.joystickPosition.set(data.vector.x, 0, -data.vector.y);
    });

    this.joystick.on("end", () => {
      this.joystickCentered = true;
      this.joystickPosition.set(0, 0, 0);
    });

    if (this.joystickCentered) return; // Do not move if joystick is centered

    // Clone the joystick position to avoid modifying the original vector
    const threeDirection = this.joystickPosition.clone();

    // Extract the yaw rotation from the camera's quaternion
    const cameraQuaternion = this.camera.quaternion.clone();
    const cameraYawQuaternion = new THREE.Quaternion();
    const upVector = new THREE.Vector3(0, 1, 0); // Y-axis

    // Project the camera's forward vector onto the horizontal plane
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
      cameraQuaternion
    );
    forward.y = 0; // Flatten to horizontal plane
    forward.normalize();

    // Create a quaternion that represents the yaw rotation
    cameraYawQuaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, -1),
      forward
    );

    // Apply only the yaw rotation to the movement direction
    threeDirection.applyQuaternion(cameraYawQuaternion);

    // Ensure movement remains on the horizontal plane
    threeDirection.y = 0;

    // Normalize and scale the movement vector
    threeDirection.normalize();
    threeDirection.multiplyScalar(this.player.speed * game.deltaTime);

    // Convert the movement vector to RAPIER's format
    const direction = new RAPIER.Vector3(
      threeDirection.x,
      threeDirection.y,
      threeDirection.z
    );

    // Calculate the next position
    const nextPos = {
      x: this.player.position.x + direction.x,
      y: this.player.position.y + direction.y,
      z: this.player.position.z + direction.z,
    };

    // Update the camera target position
    const nextPos3 = new THREE.Vector3(nextPos.x, nextPos.y, nextPos.z);
    this.cameraTargetPosition.copy(this.offsetCalc(nextPos3));

    // Update the player's position
    this.player.rigidBody.setNextKinematicTranslation(nextPos);
    this.player.updatePosition(nextPos);

    // Update the player's rotation to face the movement direction
    const from = new THREE.Vector3(0, 0, 1); // Forward vector
    const to = threeDirection.clone().normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(from, to);

    if (quat.angleTo(this.targetRotation) > 0.001) {
      this.targetRotation = quat;
    }

    // Send the updated position to the server
    socket.send(
      JSON.stringify({
        action: "Player Move",
        position: { x: nextPos.x, y: nextPos.y, z: nextPos.z },
      })
    );
  }

  attack(socket: WebSocket) {
    if (socket.readyState === WebSocket.OPEN) {
      this.player.isAttacking = true;
      socket.send(
        JSON.stringify({
          action: "Player Attack",
          ID: this.player.ID,
          range: this.player.weapon.range,
        })
      );
      this.player.weapon.Swing(socket);
      attackReady = false; // Reset attack readiness
    }
  }

  updateCameraOrbit(input: InputManager) {
    let rotateBool = false;
    const rotationSpeed = 10 * game.deltaTime;

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
      );
      if (
        Math.abs(currentPos.x - this.cameraTargetPosition.x) < 0.001 &&
        Math.abs(currentPos.y - this.cameraTargetPosition.y) < 0.001 &&
        Math.abs(currentPos.z - this.cameraTargetPosition.z) < 0.001
      ) {
        currentPos.copy(this.cameraTargetPosition);
      }
    } else {
      currentPos.copy(this.cameraTargetPosition); // Directly set to target position
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
    );

    if (this.player.rotation.angleTo(this.targetRotation) < 0.001) {
      this.player.rotation.copy(this.targetRotation);
    }

    this.player.mesh.quaternion.set(
      this.player.rotation.x,
      this.player.rotation.y,
      this.player.rotation.z,
      this.player.rotation.w
    );

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
