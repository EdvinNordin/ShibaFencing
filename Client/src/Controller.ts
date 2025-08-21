import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { game } from "./main";
import { Player } from "./Player";

export class Controller {
  player: Player;
  world: RAPIER.World;
  camera: THREE.PerspectiveCamera;
  input: InputManager = new InputManager();
  targetRotation: THREE.Quaternion = new THREE.Quaternion(0, 0, 0, 1);
  cameraTargetPosition: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  updatePosition: boolean = false;
  rotationSpeed: number = 2;
  cameraRadius: number = 10;
  cameraHeight: number = 5;
  moveDirection: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  isFalling: boolean = true;
  moveReady: boolean = false;
  rotateReady: boolean = false;
  attackReady: boolean = false;

  constructor(
    player: Player,
    world: RAPIER.World,
    camera: THREE.PerspectiveCamera
  ) {
    this.player = player;
    this.world = world;
    this.camera = camera;
  }

  updateController(socket: WebSocket) {
    this.resetChecks();
    this.inputCheck();

    if (!this.camera.position.equals(this.cameraTargetPosition))
      this.updateCameraPosition();

    if (this.player.isKnockbacked) this.knockback();

    if (
      this.moveReady &&
      !this.isFalling &&
      !this.player.isAttacking &&
      !this.player.isKnockbacked
    )
      this.move();

    if (!this.targetRotation.equals(this.player.rotation))
      this.lerpPlayer(socket);

    if (this.attackReady && !this.isFalling) this.startAttack(socket);

    if (this.player.isAttacking && !this.isFalling)
      this.attackAnimation(socket);

    if (this.player.alive) this.fallLogic(socket);

    if (this.updatePosition && !this.player.isAttacking) {
      if (this.isFalling) {
        this.player.updatePosition(this.player.position);
      } else {
        this.player.updatePosition(
          new RAPIER.Vector3(this.player.position.x, 0, this.player.position.z)
        );
      }
    }
  }

  resetChecks() {
    this.updatePosition = false;
    this.moveReady = false;
    this.rotateReady = false;
    this.attackReady = false;
  }

  inputCheck() {
    if (this.input.isPressed("ArrowLeft"))
      (this.camera.userData.orbitAngle += this.rotationSpeed * game.deltaTime),
        (this.rotateReady = true);
    if (this.input.isPressed("ArrowRight"))
      (this.camera.userData.orbitAngle -= this.rotationSpeed * game.deltaTime),
        (this.rotateReady = true);
    if (this.camera.userData.orbitAngle === undefined)
      this.camera.userData.orbitAngle = 0;

    if (this.input.isPressed("w") || this.input.isPressed("W"))
      (this.moveDirection.z -= 1), (this.moveReady = true);
    if (this.input.isPressed("s") || this.input.isPressed("S"))
      (this.moveDirection.z += 1), (this.moveReady = true);
    if (this.input.isPressed("a") || this.input.isPressed("A"))
      (this.moveDirection.x -= 1), (this.moveReady = true);
    if (this.input.isPressed("d") || this.input.isPressed("D"))
      (this.moveDirection.x += 1), (this.moveReady = true);

    if (this.input.isPressed(" ")) {
      if (!this.player.isAttacking) {
        this.attackReady = true;
      }
    }
  }

  updateCameraPosition() {
    // Smoothly interpolate the camera target position

    const playerPos = new THREE.Vector3(
      this.player.position.x,
      this.player.position.y,
      this.player.position.z
    );

    this.cameraTargetPosition.copy(this.offsetCalc(playerPos));

    const currentPos = this.camera.position.clone();

    currentPos.lerp(
      this.cameraTargetPosition,
      0.1 //1 - Math.pow(0.01, game.deltaTime)
    );

    if (
      Math.abs(currentPos.x - this.cameraTargetPosition.x) < 0.001 &&
      Math.abs(currentPos.y - this.cameraTargetPosition.y) < 0.001 &&
      Math.abs(currentPos.z - this.cameraTargetPosition.z) < 0.001
    ) {
      currentPos.copy(this.cameraTargetPosition);
    }

    this.camera.position.set(currentPos.x, currentPos.y, currentPos.z);

    const offset = new THREE.Vector3();
    offset.copy(this.cameraTargetPosition.sub(currentPos));

    this.camera.lookAt(
      this.player.position.x - offset.x,
      0,
      this.player.position.z - offset.z
    );
  }

  offsetCalc(vec: THREE.Vector3): THREE.Vector3 {
    const radius = this.cameraRadius;
    const height = this.cameraHeight;
    const angle = this.camera.userData.orbitAngle;

    // Calculate the target position based on the camera's orbit
    return new THREE.Vector3(
      vec.x + radius * Math.sin(angle),
      height,
      vec.z + radius * Math.cos(angle)
    );
  }

  move() {
    this.moveDirection
      .applyQuaternion(this.camera.quaternion)
      .setY(0)
      .normalize();
    this.moveDirection.multiplyScalar(this.player.speed * game.deltaTime);

    const nextPos = new RAPIER.Vector3(
      this.player.position.x + this.moveDirection.x,
      this.player.position.y,
      this.player.position.z + this.moveDirection.z
    );

    this.player.position = nextPos;
    this.updatePosition = true;

    const from = new THREE.Vector3(0, 0, 1); // forward
    const to = this.moveDirection.clone().normalize();

    const quat = new THREE.Quaternion().setFromUnitVectors(from, to);

    if (quat !== this.targetRotation) {
      this.targetRotation = quat;
    }

    //this.player.moveSound.play();
    game.socket.send(
      JSON.stringify({
        action: "Player Move",
        position: { x: nextPos.x, y: nextPos.y, z: nextPos.z },
      })
    );
  }

  lerpPlayer(socket: WebSocket) {
    this.player.rotation.slerp(
      this.targetRotation,
      0.15 // - Math.pow(0.001, game.deltaTime)
    );

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

  startAttack(socket: WebSocket) {
    socket.send(
      JSON.stringify({
        action: "Player Attack",
        ID: this.player.ID,
        range: this.player.weapon.range,
      })
    );

    this.player.weapon.Swing(socket);

    //this.player.weapon.swingSound.play();
    this.attackReady = false;
  }

  attackAnimation(socket: WebSocket) {
    this.player.weapon.Swing(socket);
  }

  fallLogic(socket: WebSocket) {
    const fallSpeed = 10 * game.deltaTime;

    if (this.player.position.y > 0) {
      this.player.position.y -= fallSpeed;
      this.isFalling = true;
      this.updatePosition = true;

      socket.send(
        JSON.stringify({
          action: "Player Move",
          position: {
            x: this.player.position.x,
            y: this.player.position.y,
            z: this.player.position.z,
          },
        })
      );
    } else if (this.player.position.y < -20) {
      socket.send(
        JSON.stringify({
          action: "Player Death",
        })
      );

      this.player.death();
      this.player.updateHealthBar();

      setTimeout(() => {
        socket.send(
          JSON.stringify({
            action: "Player Respawn",
          })
        );

        this.player.respawn();
        this.player.updateHealthBar();
      }, 3000);
    } else if (
      Math.abs(this.player.position.x) > 10.5 ||
      Math.abs(this.player.position.z) > 10.5
    ) {
      this.isFalling = true;
      this.player.position.y -= fallSpeed;
      this.updatePosition = true;

      socket.send(
        JSON.stringify({
          action: "Player Move",
          position: {
            x: this.player.position.x,
            y: this.player.position.y,
            z: this.player.position.z,
          },
        })
      );
    } else if (this.player.position.y !== 0 && this.player.position.y < 0.1) {
      this.player.position.y = 0;
      this.updatePosition = true;

      socket.send(
        JSON.stringify({
          action: "Player Move",
          position: {
            x: this.player.position.x,
            y: this.player.position.y,
            z: this.player.position.z,
          },
        })
      );
    } else {
      this.isFalling = false;
    }
  }

  knockback() {
    if (
      Math.abs(this.player.targetPosition.x - this.player.position.x) > 0.1 &&
      Math.abs(this.player.targetPosition.z - this.player.position.z) > 0.1
    ) {
      let lerpVector = new THREE.Vector3(
        this.player.position.x,
        this.player.position.y,
        this.player.position.z
      );
      lerpVector.lerp(this.player.targetPosition, 0.1);
      this.player.position.x = lerpVector.x;
      this.player.position.y = lerpVector.y;
      this.player.position.z = lerpVector.z;
      this.updatePosition = true;
      game.socket.send(
        JSON.stringify({
          action: "Player Move",
          position: {
            x: this.player.position.x,
            y: this.player.position.y,
            z: this.player.position.z,
          },
        })
      );
    } else {
      this.player.isKnockbacked = false;
    }
  }
}

export class InputManager {
  keys: Record<string, boolean> = {};

  constructor() {
    window.addEventListener("keydown", (e) => {
      this.keys[e.key] = true;
      if (e.key === " ") {
        e.preventDefault();
      }
    });
    window.addEventListener("keyup", (e) => (this.keys[e.key] = false));
  }

  isPressed(key: string): boolean {
    return !!this.keys[key];
  }
}
