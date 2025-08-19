import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { weapon } from "./main";
import { game } from "./main";
import { Player } from "./Player";
//import { setAudio } from "./Loader";

enum Side {
  left = -1,
  right = 1,
}

/* this.originalRotation = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(-Math.PI / 2, 0, Math.PI / 2) // Original orientation
    );

    this.swingRotation = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(Math.PI / 2, -Math.PI, Math.PI / 2)
    ); */

export class Weapon {
  damage: number = 10;
  mesh: THREE.Object3D;
  rigidBody: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  range: number = 2; // Example range value
  rotation: THREE.Quaternion = new THREE.Quaternion(0, 0, 0, 1);
  side: Side = Side.left;
  owner: Player;
  startTime: number = 0;
  /*swingSound: THREE.PositionalAudio;
  parrySound: THREE.PositionalAudio;*/

  constructor(world: RAPIER.World, owner: Player) {
    this.owner = owner;
    const scaleFactor = 0.015; // Adjust the scale factor as needed
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

    const rbDesc = RAPIER.RigidBodyDesc.kinematicPositionBased();
    this.rigidBody = world.createRigidBody(rbDesc);
    this.rigidBody.setTranslation(
      new RAPIER.Vector3(owner.position.x, owner.position.y, owner.position.z),
      true
    );

    let colliderDesc = RAPIER.ColliderDesc.cuboid(
      size.x / 8,
      size.y / 4,
      size.z * 10
    ).setTranslation(0, -1, 0);

    this.rigidBody.setNextKinematicRotation(this.sideToQuaternion(this.side));

    this.collider = world.createCollider(colliderDesc, this.rigidBody);
    this.collider.setSensor(true); // Set the collider as a sensor
    this.updateRotation(this.sideToQuaternion(this.side));
    /*
    const swingSound = setAudio(game.audioListener, "swing", 0.5);
    if (!swingSound) {
      throw new Error("Failed to create swing sound audio.");
    }
    this.swingSound = swingSound;
    this.mesh.add(this.swingSound);

    const parrySound = setAudio(game.audioListener, "parry", 0.1);
    if (!parrySound) {
      throw new Error("Failed to create parry sound audio.");
    }
    this.parrySound = parrySound;
    this.mesh.add(this.parrySound);*/
  }

  Swing(socket: WebSocket) {
    const duration = 0.5; // Duration of the swing in seconds
    if (!this.owner.isAttacking) {
      this.startTime = performance.now();
    }
    let elapsed = this.animate(duration, socket);
    if (elapsed >= duration) {
      this.swapSide();
      game.players.forEach((player) => {
        if (player.gotHit) {
          player.gotHit = false; // swapSide gotHit flag after processing
        }
      });
      this.owner.isAttacking = false;
    }
  }

  animate(duration: number, socket: WebSocket) {
    this.owner.isAttacking = true;
    const elapsed = (performance.now() - this.startTime) / 1000;
    const t = Math.min(elapsed / duration, 1);

    const c1 = 1.70158;
    const c3 = c1 + 1;
    const easing = 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);

    this.rotation.slerpQuaternions(
      this.sideToQuaternion(this.side),
      this.sideToQuaternion(this.side * -1), //=== Side.left ? Side.right : Side.left),
      easing
    );
    this.updateRotation(this.rotation);

    if (this.owner === game.player || game.botGame) {
      this.checkCollision(socket);
    }

    return elapsed;
  }

  checkCollision(socket: WebSocket) {
    game.players.forEach((opponent) => {
      // Skip the player who is swinging or if the player got hit

      if (opponent !== this.owner && !opponent.gotHit) {
        const weaponContact = this.collider.contactCollider(
          opponent.weapon.collider,
          0
        );
        const bodyContact = this.collider.contactCollider(opponent.collider, 0);

        // If the weapon collider contacts the opponent's weapon
        if (weaponContact) {
          /*this.swingSound.stop();
          this.parrySound.play();*/
          opponent.gotHit = true;

          const contactPoint1 = weaponContact.point1;
          //const contactPoint2 = weaponContact.point2;

          this.weaponHit(contactPoint1, opponent, socket);
          this.swapSide();

          //this.updateRotation(this.sideToQuaternion(this.side));
          //this.owner.isAttacking = false;
          return; // Exit after weaponHiting

          // If the weapon collider contacts the opponent's body
        } else if (bodyContact) {
          opponent.gotHit = true;
          if (game.botGame) {
            let knockbackPos = opponent.weapon.knockbackCalc(this.owner);
            opponent.updatePosition(knockbackPos);
            opponent.health -= this.damage;
            if (opponent.ID === game.playerID) {
              socket.send(
                JSON.stringify({
                  action: "Player Move",
                  position: {
                    x: opponent.position.x,
                    y: opponent.position.y,
                    z: opponent.position.z,
                  },
                })
              );
            }
            if (opponent === game.player) {
              opponent.updateHealthBar();
            }
            if (opponent.health <= 0) {
              opponent.death();
            }
          } else {
            socket.send(
              JSON.stringify({
                action: "Player Hit",
                attackerID: this.owner.ID,
                defenderID: opponent.ID,
                damage: this.damage,
              })
            );
          }
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
      new RAPIER.Vector3(
        globalPosition.x,
        this.owner.position.y,
        globalPosition.z
      )
    );
  }

  swapSide() {
    this.side = this.side * -1;
  }

  weaponHit(contactPoint: RAPIER.Vector, opponent: Player, socket: WebSocket) {
    if (game.botGame) {
      if (
        this.owner.isAttacking &&
        opponent.isAttacking &&
        this.owner === game.player
      ) {
        //console.log("Both players are attacking, parrying...");
        return;
      }

      game.Spark(contactPoint);
      const ownerKnockbackPos = this.knockbackCalc(opponent);
      const opponentKnockbackPos = opponent.weapon.knockbackCalc(this.owner);
      this.owner.updatePosition(ownerKnockbackPos);
      opponent.updatePosition(opponentKnockbackPos);
    } else if (this.owner === game.player) {
      game.Spark(contactPoint);
      if (game.botGame) {
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
      } else {
        socket.send(
          JSON.stringify({
            action: "Player Parry",
            attackerID: this.owner.ID,
            defenderID: opponent.ID,
          })
        );
      }
    }
  }

  knockbackCalc(opponent: Player) {
    const direction = new THREE.Vector3();
    direction.subVectors(this.owner.position, opponent.position);
    direction.normalize();

    const KnockbackForce = 3.0; // Adjust this value as needed
    const KnockbackVector = direction.multiplyScalar(KnockbackForce);

    // Update the player's position with the Knockback effect
    const newPosition = new THREE.Vector3(
      this.owner.position.x + KnockbackVector.x,
      0,
      this.owner.position.z + KnockbackVector.z
    );
    return newPosition;
  }

  sideToQuaternion(side: Side): THREE.Quaternion {
    if (side === Side.left) {
      return new THREE.Quaternion().setFromEuler(
        new THREE.Euler(-Math.PI / 2, 0, Math.PI / 2)
      );
    } else {
      return new THREE.Quaternion().setFromEuler(
        new THREE.Euler(Math.PI / 2, -Math.PI, Math.PI / 2)
      );
    }
  }

  sendKnockback(
    socket: WebSocket,
    attacker: Player,
    defender: Player,
    newPosition: THREE.Vector3,
    contactPoint: RAPIER.Vector
  ) {
    if (!game.botGame) {
      socket.send(
        JSON.stringify({
          action: "Player Parry",
          attackerID: attacker.ID,
          defenderID: defender.ID,
          knockbackPosition: {
            x: newPosition.x,
            y: newPosition.y,
            z: newPosition.z,
          },
          impactPosition: {
            x: contactPoint.x,
            y: contactPoint.y,
            z: contactPoint.z,
          },
        })
      );
    }
  }
}
