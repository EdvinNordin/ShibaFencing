import * as THREE from "three";
import Stats from "three/examples/jsm/libs/stats.module";

import { camera, scene, renderer, mobile } from "./utilities/setup";
import { floorGrid, wallGrid } from "./utilities/spatial";
import { loadModels } from "./utilities/loaders";
import { PCMovement } from "./controls/movement";
import { mobileMovement } from "./controls/mobile";
import { updateMixers } from "./animations";
import { ready } from "./utilities/classes";
import { combat } from "./controls/combat";
import { composer } from "./utilities/setup";
loadModels(floorGrid, wallGrid);

// const stats: Stats = new Stats();
//document.body.appendChild(stats.dom);

const clock = new THREE.Clock();
let delta;
const serverMessage = document.getElementById("server") as HTMLElement;

// window.onerror = function () {
//   location.reload();
// };
// ANIMATION LOOP ######################################################################
animate();
function animate() {
  requestAnimationFrame(animate);

  if(ready) serverMessage.style.display = "none"; 

  delta = clock.getDelta();

  updatePlayers(delta, ready);

  renderer.render(scene, camera);

  composer.render();
  //stats.update();
}

function updatePlayers(delta: number, ready: boolean) {
  if (ready) {
    if (mobile) mobileMovement(delta);
    else PCMovement(delta);

    combat(delta);

    updateMixers(delta);
  }
}
