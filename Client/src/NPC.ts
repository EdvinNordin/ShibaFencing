import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { Player } from "./Player";
import { game } from "./main";

export class NPCPlayer extends Player {
  targetPosition = new THREE.Vector3(0, 0, 0);
  targetRotation: THREE.Quaternion = new THREE.Quaternion(0, 0, 0, 1);
  targetUpdateFrequency: number = 0;
  distanceToPlayer: number = Infinity;
  isFalling: boolean = true;
  isFleeing: boolean = false;
  constructor(world: RAPIER.World) {
    super(
      world,
      "Evil Shiba Bot",
      "black",
      "00000000-0000-0000-0000-000000000000"
    );
    this.alive = true;
    this.speed = 4;
    game.scene.add(this.mesh);
  }

  update() {
    if (!this.alive) return;

    if (this.isFalling) {
      this.fallLogic();
      return;
    }

    if (!game.botGame) {
      this.runOut();
    } else {
      if (game.player?.position.y === 0) {
        if (game.difficulty === 1) {
          this.easyMode();
          this.rotationCheck();
        } else if (game.difficulty === 2) this.fightPlayer();
      } else {
        this.moveRandomly();
        this.rotationCheck();
      }
    }

    this.fallLogic();
  }

  runOut() {
    if (!this.isFleeing) {
      this.createNameTag("Fuck this, I'm out!");
      if (Math.abs(this.position.z) > Math.abs(this.position.x)) {
        this.targetPosition.z = this.position.z > 0 ? 20 : -20;
      } else {
        this.targetPosition.x = this.position.x > 0 ? 20 : -20;
      }
      this.targetRotation.setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(
          this.targetPosition.x - this.position.x,
          0,
          this.targetPosition.z - this.position.z
        ).normalize()
      );
      this.isFleeing = true;
    }
    let direction = new THREE.Vector3();
    direction.subVectors(this.targetPosition, this.position);
    if (direction.length() < 1) {
      this.targetPosition.copy(this.position);
      this.targetUpdateFrequency = 0;
      return;
    }
    direction.normalize();
    direction.y = 0;

    let movement = direction.multiplyScalar(this.speed * 2 * game.deltaTime);

    this.position = new RAPIER.Vector3(
      this.position.x + movement.x,
      this.position.y + movement.y,
      this.position.z + movement.z
    );

    this.updatePosition(this.position);

    this.updatePosition(this.position);
    if (!this.targetRotation.equals(this.rotation)) {
      this.slerpPlayer();
    }
  }

  easyMode() {
    this.targetUpdateFrequency -= game.deltaTime;
    const rand = Math.random();
    if (rand > 0.98 || this.isAttacking) {
      this.attack();
      return;
    }
    if (rand < 0.05 && this.targetUpdateFrequency <= 0) {
      this.targetPosition.set(
        Math.random() * 20 - 10,
        0,
        Math.random() * 20 - 10
      );

      this.targetRotation.setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        this.targetPosition.clone().sub(this.position).normalize()
      );
      this.targetUpdateFrequency = 5000;
    }

    let direction = new THREE.Vector3();
    direction.subVectors(this.targetPosition, this.position);
    if (direction.length() < 1) {
      this.targetPosition.copy(this.position);
      this.targetUpdateFrequency = 0;
      return;
    }
    direction.normalize();
    direction.y = 0;

    let movement = direction.multiplyScalar(this.speed * 0.5 * game.deltaTime);

    this.position = new RAPIER.Vector3(
      this.position.x + movement.x,
      this.position.y + movement.y,
      this.position.z + movement.z
    );
    if (!this.targetRotation.equals(this.rotation)) {
      this.slerpPlayer();
    }
    this.updatePosition(this.position);
  }

  fightPlayer() {
    this.distanceToPlayer = this.mesh.position.distanceTo(
      game.player!.mesh.position
    );
    if (this.distanceToPlayer < 3 || this.isAttacking) {
      this.attack();
    } else {
      this.targetRotation.setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(
          game.player!.position.x - this.position.x,
          0,
          game.player!.position.z - this.position.z
        ).normalize()
      );
      if (!this.targetRotation.equals(this.rotation)) {
        this.slerpPlayer();
      }
      this.moveTowardsPlayer(game.player!);
    }
  }

  moveTowardsPlayer(player: Player) {
    const direction = new THREE.Vector3();
    direction.subVectors(player.position, this.position).normalize();
    const movement = direction.multiplyScalar(this.speed * game.deltaTime);
    this.position = new RAPIER.Vector3(
      this.position.x + movement.x,
      0,
      this.position.z + movement.z
    );
    this.updatePosition(this.position);
  }

  moveRandomly() {
    this.targetUpdateFrequency -= game.deltaTime;
    if (Math.random() < 0.05 && this.targetUpdateFrequency <= 0) {
      this.targetPosition.set(
        Math.random() * 20 - 10,
        0,
        Math.random() * 20 - 10
      );

      this.targetRotation.setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        this.targetPosition.clone().sub(this.position).normalize()
      );
      this.targetUpdateFrequency = 5000;
    }

    let direction = new THREE.Vector3();
    direction.subVectors(this.targetPosition, this.position);
    if (direction.length() < 1) {
      this.targetPosition.copy(this.position);
      this.targetUpdateFrequency = 0;
      return;
    }
    direction.normalize();
    direction.y = 0;

    let movement = direction.multiplyScalar(this.speed * 0.5 * game.deltaTime);

    this.position = new RAPIER.Vector3(
      this.position.x + movement.x,
      this.position.y + movement.y,
      this.position.z + movement.z
    );
    if (!this.targetRotation.equals(this.rotation)) {
      this.slerpPlayer();
    }
    this.updatePosition(this.position);
  }

  slerpPlayer() {
    this.rotation.slerp(
      this.targetRotation,
      1 - Math.pow(0.001, game.deltaTime)
    );

    this.updateRotation(this.rotation);
  }

  attack() {
    this.weapon.Swing(game.socket);
  }

  rotationCheck() {
    this.targetRotation = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(
        this.targetPosition.x - this.position.x,
        0,
        this.targetPosition.z - this.position.z
      ).normalize()
    );

    if (!this.targetRotation.equals(this.rotation)) {
      this.slerpPlayer();
    }
  }

  fallLogic() {
    const fallSpeed = 10 * game.deltaTime;

    if (this.position.y > 0) {
      this.position.y -= fallSpeed;
      this.isFalling = true;
      this.updatePosition(this.position);
    } else if (this.position.y < -20) {
      this.death();
    } else if (
      Math.abs(this.position.x) > 10.5 ||
      Math.abs(this.position.z) > 10.5
    ) {
      this.isFalling = true;
      this.position.y -= fallSpeed;
      this.updatePosition(this.position);
    } else if (this.position.y !== 0) {
      this.isFalling = false;
      this.position.y = 0;
      this.updatePosition(this.position);
    } else {
      this.isFalling = false;
    }
  }

  death() {
    this.alive = false;
    this.health = 0;
    this.mesh.visible = false;
    setTimeout(() => {
      if (game.botGame) {
        this.respawn();
      }
    }, 3000);
  }

  respawn() {
    this.alive = true;
    this.health = 100;
    this.mesh.visible = true;
    this.updatePosition(new RAPIER.Vector3(0, 10, 0));
    this.updateRotation(new THREE.Quaternion(0, 0, 0, 1));
  }

  findClosestPlayer() {
    let closestPlayer: Player | null = null;
    let closestDistance = Infinity;

    game.players.forEach((player) => {
      if (player.ID !== this.ID && player.alive) {
        const distance = this.mesh.position.distanceTo(player.mesh.position);
        if (distance < closestDistance) {
          this.distanceToPlayer = distance;
          closestPlayer = player;
        }
      }
    });
    return closestPlayer;
  }
}

function randomPosition() {
  new RAPIER.Vector3(Math.random() * 20 - 10, 0, Math.random() * 20 - 10);
}
