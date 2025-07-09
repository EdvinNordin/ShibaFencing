import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { Game } from "./Game";
import { loadModel, loadWeapon } from "./Loader";

export let game: Game;
export let weapon: THREE.Object3D;
export let model: THREE.Object3D;

export const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

async function init() {
  await RAPIER.init();

  model = await loadModel();
  weapon = await loadWeapon();

  game = new Game();

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(12, 10, 8);
  directionalLight.castShadow = true;
  directionalLight.shadow.camera.top = 50;
  directionalLight.shadow.camera.bottom = -50;
  directionalLight.shadow.camera.left = -50;
  directionalLight.shadow.camera.right = 50;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 50;
  game.scene.add(directionalLight);

  let groundGeometry = new THREE.BoxGeometry(20, 1, 20);
  let groundMaterial = new THREE.MeshStandardMaterial({ color: 0x1a7b29 });
  let groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
  groundMesh.receiveShadow = true;
  groundMesh.position.set(0, -1.5, 0);
  game.scene.add(groundMesh);

  let groundColliderDesc = RAPIER.ColliderDesc.cuboid(
    10.0,
    0.5,
    10.0
  ).setTranslation(0, -1, 0);
  game.world.createCollider(groundColliderDesc);

  const debugRenderer = new RapierDebugRenderer(game.scene, game.world);

  // Add event listeners for window resize
  window.addEventListener("resize", () => {
    game.camera.aspect = window.innerWidth / window.innerHeight;
    game.camera.updateProjectionMatrix();
    game.renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const { socket } = await import("./Network");
  let clock = new THREE.Clock();
  let deltaTime = 0;
  function update() {
    deltaTime = clock.getDelta();
    deltaTime = Math.min(deltaTime, 0.1);
    //debugRenderer.update();
    game.controller.updateController(deltaTime, socket);
    game.world.step();
    game.renderer.render(game.scene, game.camera);
  }
  game.renderer.setAnimationLoop(update);
}

init();

class RapierDebugRenderer {
  mesh;
  world;
  enabled = true;

  constructor(scene: THREE.Scene, world: RAPIER.World) {
    this.world = world;
    this.mesh = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0xffffff, vertexColors: true })
    );
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  update() {
    if (this.enabled) {
      const { vertices, colors } = this.world.debugRender();
      this.mesh.geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(vertices, 3)
      );
      this.mesh.geometry.setAttribute(
        "color",
        new THREE.BufferAttribute(colors, 4)
      );
      this.mesh.visible = true;
    } else {
      this.mesh.visible = false;
    }
  }
}
