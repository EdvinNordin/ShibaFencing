import * as THREE from "three";
import { weapon } from "./main";
import { game } from "./main";

export class Weapon {
  damage: number;
  mesh: THREE.Object3D;
  range: number = 2; // Example range value
  rotation: THREE.Quaternion;
  originalRotation: THREE.Quaternion;
  swingRotation: THREE.Quaternion;
  constructor() {
    const scaleFactor = 0.015; // Adjust the scale factor as needed
    this.damage = 10; // Example damage value

    this.mesh = weapon.clone();
    this.mesh.scale.setScalar(scaleFactor);

    const box = new THREE.Box3().setFromObject(this.mesh); // Compute the bounding box
    const size = new THREE.Vector3();
    box.getSize(size);

    let biggest = 0;
    for (const side of size) {
      if (side > biggest) biggest = side;
    }
    this.range = biggest;

    this.originalRotation = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(-Math.PI / 2, 0, Math.PI / 2) // Original orientation
    );

    this.rotation = this.originalRotation;
    this.mesh.quaternion.copy(this.rotation);

    this.swingRotation = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(Math.PI / 2, -Math.PI, Math.PI / 2)
    );
  }

  Swing(socket: WebSocket) {
    const duration = 0.3; // Duration of the swing in seconds
    const startTime = performance.now();

    const animate = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      const t = Math.min(elapsed / duration, 1);

      this.mesh.quaternion.slerpQuaternions(
        this.originalRotation,
        this.swingRotation,
        t
      );

      if (elapsed < 1) {
        requestAnimationFrame(animate);
      } else {
        if (game.player.isAttacking) {
          socket.send(
            JSON.stringify({
              action: "Player Attack",
              ID: game.player.ID,
              range: game.player.weapon.range,
            })
          );
        }
        game.player.isAttacking = false;
        this.Reset(); // Automatically reset after swing
        socket.send(
          JSON.stringify({
            action: "Player Stop Attack",
          })
        );
      }
    };

    animate();
  }

  Reset() {
    this.rotation = this.originalRotation;
    this.originalRotation = this.swingRotation;
    this.swingRotation = this.rotation;
  }
}
