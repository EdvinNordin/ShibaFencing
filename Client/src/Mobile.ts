import * as THREE from "three";
import { game } from "./main";
import { Player } from "./Player";
import { Controller } from "./Controller";
import nipplejs from "nipplejs";
import screenfull from "screenfull";

const joystickZone = document.getElementById("joystickZone");
const rotateZone = document.getElementById("rotateZone");
const swingButton = document.getElementById("swingButton");

export class MobileController extends Controller {
  targetRotation: THREE.Quaternion = new THREE.Quaternion(0, 0, 0, 1);
  cameraTargetPosition: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  joystick: nipplejs.JoystickManager;
  joystickCentered: boolean = true;
  joystickPosition: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  prevTouchX: number = -1;
  cameraRadius: number = 6;
  cameraHeight: number = 3;
  rotationSpeed: number = 0.4;

  constructor(player: Player, camera: THREE.PerspectiveCamera) {
    super(player, camera);

    this.joystick = nipplejs.create({
      zone: joystickZone as HTMLElement,
      mode: "static",
      position: { left: "50%", top: "50%" },
      restOpacity: 1,
    });

    if (rotateZone) {
      rotateZone.addEventListener("touchstart", (e) => {
        if (screenfull.isFullscreen) {
          e.preventDefault();
        }
        if (e.touches.length > 0) {
          const touch = e.touches[0];
          this.prevTouchX = touch.clientX - window.innerWidth / 2;
        }
      });

      rotateZone.addEventListener("touchmove", (e) => {
        e.preventDefault();
        if (e.touches.length > 0 && this.prevTouchX !== -1) {
          const touch = e.touches[0];
          const touchDeltaX = touch.clientX - window.innerWidth / 2;

          this.camera.userData.orbitAngle -=
            (touchDeltaX - this.prevTouchX) *
            game.deltaTime *
            this.rotationSpeed;
          this.prevTouchX = touchDeltaX;
        }
      });

      rotateZone.addEventListener("touchend", (e) => {
        e.preventDefault();
        this.prevTouchX = -1;
      });
    }

    this.attackReady = false;
    if (swingButton) {
      swingButton.addEventListener("touchstart", (e) => {
        e.preventDefault();
        if (!this.player.isAttacking) {
          this.startAttack(game.socket);
          this.attackReady = true;
        }
      });
    }
  }

  resetChecks() {
    this.updatePosition = false;
    this.attackReady = false;
  }

  inputCheck() {
    if (this.camera.userData.orbitAngle === undefined)
      this.camera.userData.orbitAngle = 0;

    this.joystick.on("start", () => {
      this.moveReady = true;
      this.joystickPosition.set(0, 0, 0);
    });

    this.joystick.on("move", (e, data) => {
      this.joystickPosition.set(data.vector.x, 0, -data.vector.y);
    });

    this.joystick.on("end", () => {
      this.moveReady = false;
      this.joystickPosition.set(0, 0, 0);
    });
    this.moveDirection = this.joystickPosition.clone();
  }
}
