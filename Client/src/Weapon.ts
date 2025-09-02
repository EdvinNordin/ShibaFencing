import * as THREE from "three";
import { weapon } from "./main";
import { game } from "./main";
import { Player } from "./Player";
import { OBB } from "three/addons/math/OBB.js";
//import { setAudio } from "./Loader";

enum Side {
  left = -1,
  right = 1,
}

export class Weapon {
  damage: number = 10;
  mesh: THREE.Object3D;
  collider: OBB;
  range: number = 2;
  force: number = 3;
  swingDuration: number = 0.5;
  rotation: THREE.Quaternion = new THREE.Quaternion(0, 0, 0, 1);
  side: Side = Side.left;
  owner: Player;
  startTime: number = 0;
  obbDebug: THREE.LineSegments | null = null; // Add a property for the OBB visualizer

  constructor(owner: Player) {
    this.owner = owner;
    this.mesh = weapon.clone();
    this.mesh.children[0].position.set(0, 0, 0.75);
    game.scene.add(this.mesh);

    this.collider = new OBB();
    this.collider.fromBox3(
      new THREE.Box3().setFromObject(this.mesh.children[0])
    );
    this.range = this.collider.getSize(new THREE.Vector3()).z - 0.25;

    this.updateRotation(this.sideToQuaternion(this.side));
    this.createOBBDebug();
  }

  updateRotation(rotation: THREE.Quaternion) {
    this.rotation.copy(rotation);
    this.mesh.quaternion.copy(rotation);

    if (game.debug) {
      this.updateOBB();
    }
  }

  swapSide() {
    this.side = this.side * -1;
  }

  Swing() {
    const duration = this.swingDuration;
    if (!this.owner.isAttacking) {
      this.startTime = performance.now();
    }
    let elapsed = this.animate(duration);
    if (elapsed >= duration) {
      this.swapSide();
      game.players.forEach((player) => {
        if (player.gotHit) {
          player.gotHit = false;
        }
      });
      this.owner.isAttacking = false;
    }
  }

  animate(duration: number) {
    this.owner.isAttacking = true;
    const elapsed = (performance.now() - this.startTime) / 1000;
    const t = Math.min(elapsed / duration, 1);

    const c1 = 1.70158;
    const c3 = c1 + 1;
    const easing = 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);

    this.rotation.slerpQuaternions(
      this.sideToQuaternion(this.side),
      this.sideToQuaternion(this.side * -1),
      easing
    );

    this.updateRotation(this.rotation);

    if (this.owner === game.player || this.owner === game.bot) {
      this.checkCollision();
    }

    return elapsed;
  }

  checkCollision() {
    const attacker = this.owner;
    game.players.forEach((hitPlayer) => {
      if (hitPlayer.gotHit || attacker === hitPlayer || !hitPlayer.alive)
        return;

      const weaponContact = this.collider.intersectsOBB(
        hitPlayer.weapon.collider
      );
      const bodyContact = this.collider.intersectsOBB(hitPlayer.collider);
      if (bodyContact) {
        this.bodyHit(hitPlayer, attacker);
      } else if (weaponContact) {
        this.weaponHit(hitPlayer, attacker);
      }
    });
  }

  weaponHit(hitPlayer: Player, attacker: Player) {
    hitPlayer.gotHit = true;
    let contactPoint = new THREE.Vector3();
    this.collider.clampPoint(hitPlayer.weapon.collider.center, contactPoint);
    this.swapSide();

    if (!game.botGame) {
      game.Spark(contactPoint);
      this.knockbacked(attacker, hitPlayer);

      game.socket.send(
        JSON.stringify({
          action: "Player Parry",
          attackerID: attacker.ID,
          defenderID: hitPlayer.ID,
        })
      );
    } else {
      if (
        attacker.isAttacking &&
        hitPlayer.isAttacking &&
        attacker.ID !== game.bot?.ID
      ) {
        return;
      }
      game.Spark(contactPoint);
      hitPlayer.weapon.knockbacked(hitPlayer, attacker);
      attacker.weapon.knockbacked(attacker, hitPlayer);
    }
  }

  bodyHit(hitPlayer: Player, attacker: Player) {
    hitPlayer.gotHit = true;
    if (game.botGame) {
      hitPlayer.weapon.knockbacked(hitPlayer, attacker);
      hitPlayer.health -= attacker.weapon.damage;
      hitPlayer.updateHealthBar();

      if (hitPlayer.ID === game.playerID) {
        //send info to others that may be in menu
        game.socket.send(
          JSON.stringify({
            action: "Player Move",
            position: {
              x: hitPlayer.position.x,
              y: hitPlayer.position.y,
              z: hitPlayer.position.z,
            },
          })
        );
      }
      if (hitPlayer.health <= 0) {
        hitPlayer.death();
      }
    } else {
      game.socket.send(
        JSON.stringify({
          action: "Player Hit",
          attackerID: attacker.ID,
          defenderID: hitPlayer.ID,
          damage: attacker.weapon.damage,
        })
      );
    }
  }

  knockbacked(hitPlayer: Player, attacker: Player) {
    let direction = new THREE.Vector3();
    direction.x = hitPlayer.position.x - attacker.position.x;
    direction.y = 0;
    direction.z = hitPlayer.position.z - attacker.position.z;
    direction.normalize();

    const KnockbackVector = direction.multiplyScalar(this.force);

    // Update the player's position with the Knockback effect
    let newPosition = new THREE.Vector3(
      hitPlayer.position.x + KnockbackVector.x,
      0,
      hitPlayer.position.z + KnockbackVector.z
    );

    // Ensure targetPosition is a Vector3 before copying
    if (!(hitPlayer.targetPosition instanceof THREE.Vector3)) {
      hitPlayer.targetPosition = new THREE.Vector3();
    }
    hitPlayer.targetPosition.copy(newPosition);
    hitPlayer.isKnockbacked = true;

    return newPosition;
  }

  sideToQuaternion(side: Side): THREE.Quaternion {
    if (side === Side.left) {
      return new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0, Math.PI / 2, 0)
      );
    } else {
      return new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0, -Math.PI / 2, 0)
      );
    }
  }

  updateOBB() {
    this.mesh.updateWorldMatrix(true, true);
    this.collider.rotation.setFromMatrix4(this.mesh.matrixWorld);
    this.collider.center.setFromMatrixPosition(
      this.mesh.children[0].matrixWorld
    );

    if (game.debug && this.obbDebug) {
      this.obbDebug.position.copy(this.collider.center);
      const rotation = new THREE.Quaternion();
      const matrix4 = new THREE.Matrix4().setFromMatrix3(
        this.collider.rotation
      );
      rotation.setFromRotationMatrix(matrix4);
      this.obbDebug.setRotationFromQuaternion(rotation);
    }
  }
  createOBBDebug() {
    if (game.debug) {
      const geometry = new THREE.BoxGeometry(1, 1, 1); // Unit box
      const edges = new THREE.EdgesGeometry(geometry); // Create edges for wireframe
      const material = new THREE.LineBasicMaterial({ color: 0xffff00 }); // Green wireframe
      this.obbDebug = new THREE.LineSegments(edges, material);

      const size = new THREE.Vector3();
      this.collider.getSize(size);
      this.obbDebug.scale.copy(size);

      game.scene.add(this.obbDebug); // Add the visualizer to the scene
    } else {
      this.obbDebug = null;
    }
  }
}
