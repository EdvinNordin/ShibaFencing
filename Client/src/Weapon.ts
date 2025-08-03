import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { weapon } from "./main";
import { game } from "./main";
import { Player } from "./Player";
import { spark } from "./Loader";

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
      size.y / 4,
      size.z / 2
    ).setTranslation(0, -1, 0);

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
        this.Reset();

        game.players.forEach((player) => {
          if (player.gotHit) {
            player.gotHit = false; // Reset gotHit flag after processing
          }
        });
        this.owner.isAttacking = false;
        //this.Spark(this.rigidBody.translation());
      }
    };

    animate();
  }

  checkCollision(socket: WebSocket) {
    game.players.forEach((opponent) => {
      // Skip the player who is swinging or if the player got hit
      if (opponent !== game.player && !opponent.gotHit) {
        const bodyContact = this.collider.contactCollider(opponent.collider, 0);
        const weaponContact = this.collider.contactCollider(
          opponent.weapon.collider,
          0
        );
        // If the weapon collider contacts the opponent's weapon
        if (weaponContact) {
          const contactPoint = weaponContact.point1;
          this.Parry(contactPoint, opponent, socket);
          this.owner.isAttacking = false;
          return; // Exit after parrying

          // If the weapon collider contacts the opponent's body
        } else if (bodyContact) {
          opponent.gotHit = true;
          socket.send(
            JSON.stringify({
              action: "Player Hit",
              hitID: opponent.ID,
              damage: this.damage,
            })
          );
        }
      }
    });
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

  Parry(contactPoint: RAPIER.Vector, opponent: Player, socket: WebSocket) {
    this.Spark(contactPoint);
    opponent.gotHit = true;
    this.Reset();

    const playerKnockback = this.calcDirection(this.owner, opponent);
    const opponentKnockback = this.calcDirection(opponent, this.owner);
    this.Knockback(opponent, opponentKnockback, socket);
    opponent.weapon.Knockback(this.owner, playerKnockback, socket);
  }

  Knockback(player: Player, direction: THREE.Vector3, socket: WebSocket) {
    const KnockbackForce = 3.0; // Adjust this value as needed
    const KnockbackVector = direction.multiplyScalar(KnockbackForce);

    // Update the player's position with the Knockback effect
    const newPosition = new THREE.Vector3(
      this.owner.position.x + KnockbackVector.x,
      this.owner.position.y + KnockbackVector.y,
      this.owner.position.z + KnockbackVector.z
    );
    this.owner.updatePosition(
      new RAPIER.Vector3(newPosition.x, newPosition.y, newPosition.z)
    );

    socket.send(
      JSON.stringify({
        action: "Player Knockback",
        knockbackPosition: this.owner.ID,
        position: {
          x: this.owner.position.x,
          y: this.owner.position.y,
          z: this.owner.position.z,
        },
      })
    );
  }

  calcDirection(attacker: Player, opponent: Player) {
    const direction = new THREE.Vector3();
    direction.subVectors(opponent.position, attacker.position);
    direction.normalize();
    return direction;
  }

  Spark(contactPoint: RAPIER.Vector) {
    if (contactPoint) {
      const sparkInstance = spark.clone();

      game.scene.add(sparkInstance);
      sparkInstance.position.set(
        contactPoint.x,
        contactPoint.y,
        contactPoint.z
      );

      let life = 1; // seconds
      const dt: number = game.deltaTime; // Use the delta time from the game
      const animate = (dt: number) => {
        life -= dt;
        sparkInstance.scale.setScalar(life * 2); // Scale the spark based on its life
        sparkInstance.material.opacity = life;
        if (life <= 0) {
          game.scene.remove(sparkInstance);
        } else {
          requestAnimationFrame(() => animate(0.016)); // ~60fps
        }
      };
      animate(0.016);
    }
  }
}
