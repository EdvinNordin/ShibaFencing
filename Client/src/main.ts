import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { Game } from "./Game";
import { Network } from "./Network";

export let game: Game;

async function init() {
  await RAPIER.init();

  game = new Game();

  let groundColliderDesc = RAPIER.ColliderDesc.cuboid(10.0, 1.0, 10.0).setTranslation(0, 0, 0);
  game.world.createCollider(groundColliderDesc);


  const debugRenderer = new RapierDebugRenderer(game.scene, game.world);

  // Start networking after game is ready
  Network();

  // Add event listeners for window resize
  window.addEventListener("resize", () => {
    game.camera.aspect = window.innerWidth / window.innerHeight;
    game.camera.updateProjectionMatrix();
    game.renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const deltaTime = 1 / 60; // Fixed time step for physics

  function update() {
    debugRenderer.update();
    game.controller.move(deltaTime);
    game.world.step();
    game.renderer.render(game.scene, game.camera);
  }
  game.renderer.setAnimationLoop(update);
}

init();

class RapierDebugRenderer {
  mesh
  world
  enabled = true

  constructor(scene: THREE.Scene, world: RAPIER.World) {
    this.world = world
    this.mesh = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffffff, vertexColors: true }))
    this.mesh.frustumCulled = false
    scene.add(this.mesh)
  }

  update() {
    if (this.enabled) {
      const { vertices, colors } = this.world.debugRender()
      this.mesh.geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
      this.mesh.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4))
      this.mesh.visible = true
    } else {
      this.mesh.visible = false
    }
  }
}


