import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { weapon } from "./main";
import { game } from "./main";
import { Player } from "./Player";

let offset = new RAPIER.Vector3(0, 0, 0);

export class Weapon {
  damage: number;
  mesh: THREE.Object3D;
  rigidBody: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  range: number = 2; // Example range value
  rotation: THREE.Quaternion = new THREE.Quaternion(0, 0, 0, 1);
  originalRotation: THREE.Quaternion;
  swingRotation: THREE.Quaternion;
  owner: Player;

  constructor(world: RAPIER.World, owner: Player) {
    this.owner = owner;
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

    this.swingRotation = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(Math.PI / 2, -Math.PI, Math.PI / 2)
    );

    const rbDesc = RAPIER.RigidBodyDesc.kinematicPositionBased();
    this.rigidBody = world.createRigidBody(rbDesc);
    this.rigidBody.setNextKinematicTranslation(new RAPIER.Vector3(0, 0, 0));

    let colliderDesc = RAPIER.ColliderDesc.cuboid(
      size.x / 8,
      size.y / 2,
      size.z / 2
    ).setTranslation(0, -0.55, 0);

    this.rigidBody.setNextKinematicRotation(this.originalRotation);

    this.collider = world.createCollider(colliderDesc, this.rigidBody);
    this.collider.setSensor(true); // Set the collider as a sensor
    this.updatePosition();
    this.updateRotation(this.originalRotation);
  }

  Swing(socket: WebSocket) {
    const duration = 0.5; // Duration of the swing in seconds
    const startTime = performance.now();

    const animate = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      const t = Math.min(elapsed / duration, 1);

      const c1 = 1.70158;
      const c3 = c1 + 1;
      const easing = 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);

      this.rotation.slerpQuaternions(
        this.originalRotation,
        this.swingRotation,
        easing
      );
      this.updateRotation(this.rotation);
      this.updatePosition();

      if (this.owner === game.player) {
        this.checkCollision(socket);
      }

      if (t < 1 && this.owner.isAttacking) {
        requestAnimationFrame(animate);
      } else {
        this.Reset(); // Automatically reset after swing

        /*if (game.player.isAttacking) {
          socket.send(
            JSON.stringify({
              action: "Player Stop Attack",
            })
          );
        }*/
        game.players.forEach((player) => {
          if (player.gotHit) {
            player.gotHit = false; // Reset gotHit flag after processing
          }
        });
        this.owner.isAttacking = false;
      }
    };

    animate();
  }

  checkCollision(socket: WebSocket) {
    game.players.forEach((player) => {
      if (player === game.player || player.gotHit) return;

      if (
        player.isAttacking &&
        this.collider.contactCollider(player.weapon.collider, 0)
      ) {
        player.gotHit = true;
        /*socket.send(
          JSON.stringify({
            action: "Player Parry",
            parryID: player.ID,
          })
        );*/
        this.knockback(player, socket);
        console.log("KNOCKBACK");
      } else if (this.collider.contactCollider(player.collider, 0)) {
        player.gotHit = true;
        socket.send(
          JSON.stringify({
            action: "Player Hit",
            hitID: player.ID,
            damage: this.damage,
          })
        );
      }
    });
  }

  knockback(player: Player, socket: WebSocket) {
    // Apply knockback effect to the attacked player
    const attackerForward = new THREE.Vector3(0, 0, 1).applyQuaternion(
      player.rotation
    ); // Get attacker's forward direction
    attackerForward.normalize(); // Ensure it's a unit vector

    // Apply knockback force in the attacker's forward direction
    const knockbackForce = 3.0; // Adjust this value as needed
    const knockbackVector = attackerForward.multiplyScalar(knockbackForce);

    // Update the player's position with the knockback effect
    const newPosition = new THREE.Vector3(
      this.owner.position.x + knockbackVector.x,
      this.owner.position.y + knockbackVector.y,
      this.owner.position.z + knockbackVector.z
    );
    this.owner.updatePosition(
      new RAPIER.Vector3(newPosition.x, newPosition.y, newPosition.z)
    );

    socket.send(
      JSON.stringify({
        action: "Player Move",
        position: {
          x: this.owner.position.x,
          y: this.owner.position.y,
          z: this.owner.position.z,
        },
      })
    );
  }

  updateRotation(rotation: THREE.Quaternion) {
    this.rotation.copy(rotation);
    this.mesh.quaternion.copy(rotation);

    let globalQuaternion = new THREE.Quaternion();
    this.mesh.getWorldQuaternion(globalQuaternion);
    this.rigidBody.setRotation(globalQuaternion, false);
  }

  updatePosition() {
    const globalPosition = new THREE.Vector3();
    this.mesh.getWorldPosition(globalPosition);
    this.rigidBody.setNextKinematicTranslation(
      new RAPIER.Vector3(globalPosition.x, globalPosition.y, globalPosition.z)
    );
  }

  Reset() {
    let temp = new THREE.Quaternion();
    temp.copy(this.originalRotation);
    this.originalRotation.copy(this.swingRotation);
    this.swingRotation.copy(temp);
  }
}
