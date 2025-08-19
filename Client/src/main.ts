import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { Game } from "./Game";
import { NPCPlayer } from "./NPC";
import { loadModel, loadWeapon } from "./Loader";
import screenfull from "screenfull";

export let game: Game;
export let weapon: THREE.Object3D;
export let model: THREE.Object3D;
export const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

if (isMobile) {
  const instructions = document.getElementById("instructions");

  const fullscreenButton = document.getElementById("fullscreenButton");
  if (fullscreenButton) {
    fullscreenButton.style.setProperty("display", "block");
    fullscreenButton.addEventListener("click", (e) => {
      e.preventDefault();
      if (screenfull.isEnabled) {
        screenfull.toggle();
        if (fullscreenButton instanceof HTMLImageElement) {
          if (screenfull.isFullscreen) {
            fullscreenButton.src = "enter_fullscreen.svg";
          } else {
            fullscreenButton.src = "exit_fullscreen.svg";
          }
        }
      }
    });
  }

  const rotateScreenIcon = document.getElementById("rotateScreenIcon");
  if (instructions) {
    instructions.style.display = "none";
  }
  const portrait = window.matchMedia("(orientation: portrait)").matches;
  if (portrait) {
    rotateScreenIcon!.style.display = "block";
  } else {
    rotateScreenIcon!.style.display = "none";
  }
  window
    .matchMedia("(orientation: portrait)")
    .addEventListener("change", (e) => {
      const portrait = e.matches;

      if (portrait) {
        rotateScreenIcon!.style.display = "block";
      } else {
        rotateScreenIcon!.style.display = "none";
      }
    });
}
let gameStarted = false;

document.addEventListener("DOMContentLoaded", () => {
  const startGameForm = document.getElementById("startGameForm");
  const colorInput = document.getElementById("favcolor") as HTMLInputElement;

  if (startGameForm) {
    startGameForm.addEventListener("submit", (event) => {
      event.preventDefault(); // Prevent the default form submission behavior
      const playerNameInput = document.getElementById(
        "playerNameInput"
      ) as HTMLInputElement;

      if (playerNameInput) {
        let playerName = playerNameInput.value.trim();
      if (playerName === "") playerName = " "; 
        if (playerName) {
          if (game && game.gameLoaded) {
            // Hide the input UI
            const startScreen = document.getElementById("startScreen");
            if (startScreen) {
              startScreen.style.display = "none";
            }

            if (isMobile) {
              const mobileControls = document.getElementById("mobileControls");
              if (mobileControls) {
                mobileControls.style.display = "block"; // Show mobile controls
              }
            }


            const color = colorInput.value;
            game.initializePlayer(playerName, color, game.socket);
            gameStarted = true; // Set the game started flag
          }
        }
      }
    });
  }
});

async function init() {
  await RAPIER.init();

  model = await loadModel();
  weapon = await loadWeapon();

  game = new Game();

  const debugRenderer = new RapierDebugRenderer(game.scene, game.world);

  // Add event listeners for window resize
  window.addEventListener("resize", () => {
    game.camera.aspect = window.innerWidth / window.innerHeight;
    game.camera.updateProjectionMatrix();
    game.renderer.setSize(window.innerWidth, window.innerHeight);
  });

  //const socket = initializeWebSocket();

  let clock = new THREE.Clock();
  let deltaTime = 0;

  function update() {
    deltaTime = clock.getDelta();
    deltaTime = Math.min(deltaTime, 0.1);
    game.updateDeltaTime(deltaTime);

    if (gameStarted && game.controller) {
      game.controller.updateController(game.socket);
      game.players.forEach((player) => {
        if (player.isAttacking) {
          player.weapon.Swing(game.socket);
        }
      });
    }

    if ((game.botGame && game.bot) || game.bot?.alive) {
      game.bot.update();
    }

    game.world.step();
    game.renderer.render(game.scene, game.camera);

    //debugRenderer.update();
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
