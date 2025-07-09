import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { game } from "./main";
import { Player } from "./Player";
import nipplejs from "nipplejs";

const joystickZone = document.getElementById("joystickZone");
const rotateZone = document.getElementById("rotateZone");
const swingButton = document.getElementById("swingButton");

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
      //color: "white",
      restOpacity: 1,
    });
  }

  updateController(deltaTime: number, socket: WebSocket) {
    this.updateCameraOrbit(this.input);

    this.updateCameraPosition(true);

    if (this.player.movable) this.move(socket);

    if (!this.targetRotation.equals(this.player.rotation))
      this.rotateTowardsTarget(socket);

    if (!this.player.isAttacking) this.attack(socket);

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

    const threeDirection = this.joystickPosition;

    threeDirection.normalize();
    threeDirection.applyQuaternion(this.camera.quaternion);
    threeDirection.y = 0;
    threeDirection.normalize();
    threeDirection.multiplyScalar((this.player.speed * 0.5) / 60);

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

    game.rigidBody.setNextKinematicTranslation(nextPos);

    this.player.updatePosition(nextPos);

    const from = new THREE.Vector3(0, 0, 1); // forward
    const to = threeDirection.clone().normalize();

    const quat = new THREE.Quaternion().setFromUnitVectors(from, to);

    if (quat !== this.targetRotation) {
      this.updateTargetRotation(quat);
    }

    socket.send(
      JSON.stringify({
        action: "Player Move",
        position: { x: nextPos.x, y: nextPos.y, z: nextPos.z },
      })
    );
  }

  attack(socket: WebSocket) {
    if (swingButton) {
      swingButton.addEventListener("touchstart", (e) => {
        if (this.player.isAttacking) return;
        this.player.isAttacking = true;
        this.player.weapon.Swing();
        setTimeout(() => {
          this.player.isAttacking = false;
        }, 500);

        socket.send(
          JSON.stringify({
            action: "Player Attack",
            ID: this.player.ID,
            range: this.player.weapon.range,
          })
        );
      });
    }
  }

  updateCameraOrbit(input: InputManager) {
    let rotateBool = false;
    const rotationSpeed = 0.005;
    if (rotateZone) {
      rotateZone.addEventListener("touchstart", (e) => {
        if (e.touches.length > 0) {
          const touch = e.touches[0];
          this.prevTouchX = touch.clientX - window.innerWidth / 2;
        }
      });

      rotateZone.addEventListener("touchmove", (e) => {
        if (e.touches.length > 0) {
          const touch = e.touches[0];
          const touchDeltaX = touch.clientX - window.innerWidth / 2;
          rotateBool = true;
          this.camera.userData.orbitAngle -=
            (touchDeltaX - this.prevTouchX) * rotationSpeed;
          this.prevTouchX = touchDeltaX;
        }
      });

      rotateZone.addEventListener("touchend", (e) => {
        this.prevTouchX = -1;
      });
    }

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
      currentPos.lerp(this.cameraTargetPosition, 0.1);
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
    this.player.rotation.slerp(this.targetRotation, 0.3);

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

  updateTargetRotation(rotation: THREE.Quaternion) {
    this.targetRotation = rotation;
  }

  fallingPossibility(socket: WebSocket) {
    if (
      this.player.mesh.position.y > 0 &&
      socket.readyState === WebSocket.OPEN
    ) {
      this.player.mesh.position.y -= 0.5;
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

    if (this.player.mesh.position.y === 0) {
      this.player.movable = true;
    }

    if (
      Math.abs(this.player.position.x) > 11 ||
      Math.abs(this.player.position.z) > 11
    ) {
      this.player.movable = false;
      this.player.mesh.position.y -= 0.5;
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
      }, 3000); // Respawn after 2 seconds
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
