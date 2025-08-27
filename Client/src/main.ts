import * as THREE from "three";
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

  const checkBox = document.getElementById(
    "difficultyCheckbox"
  ) as HTMLInputElement;
  const labelEasy = document.getElementsByClassName(
    "labelEasy"
  )[0] as HTMLElement;
  const labelHard = document.getElementsByClassName(
    "labelHard"
  )[0] as HTMLElement;

  if (checkBox.checked) {
    labelHard.style.display = "block";
    labelEasy.style.display = "none";
  } else {
    labelEasy.style.display = "block";
    labelHard.style.display = "none";
  }

  checkBox.addEventListener("change", () => {
    game.difficulty = checkBox.checked ? 2 : 1;
    if (checkBox.checked) {
      labelHard.style.display = "block";
      labelEasy.style.display = "none";
    } else {
      labelEasy.style.display = "block";
      labelHard.style.display = "none";
    }
  });

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

            game.difficulty = checkBox.checked ? 2 : 1;
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
  model = await loadModel();
  weapon = await loadWeapon();

  game = new Game();

  // Add event listeners for window resize
  window.addEventListener("resize", () => {
    game.camera.aspect = window.innerWidth / window.innerHeight;
    game.camera.updateProjectionMatrix();
    game.renderer.setSize(window.innerWidth, window.innerHeight);
  });

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
          player.weapon.Swing();
        }
      });
    }

    if ((game.botGame && game.bot) || game.bot?.alive) {
      game.bot.update();
      //checkCollision();
    }

    game.renderer.render(game.scene, game.camera);
  }
  game.renderer.setAnimationLoop(update);
}

init();

function checkCollision() {
  if (game.player && game.bot) {
    if (game.bot.weapon.collider.intersectsOBB(game.player.collider)) {
      console.log("Sword hit player!");
    } else {
      console.log("Sword missed player!");
    }
  }
}
