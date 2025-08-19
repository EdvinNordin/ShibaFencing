import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { positionViewDirection } from "three/tsl";

const loader = new GLTFLoader();

export function loadModel(): Promise<THREE.Object3D> {
  return new Promise((resolve, reject) => {
    loader.load("shiba.glb", (gltf) => {
      const model = gltf.scene;
      model.name = "shiba";
      model.castShadow = true;
      model.receiveShadow = true;
      const pivot = new THREE.Object3D();
      pivot.add(model);
      pivot.name = "pivot";

      // Offset the model to adjust the pivot point
      model.position.set(0, 0.5, 0.5);
      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true; // Enable shadow casting for the mesh
          child.receiveShadow = true; // Enable shadow receiving for the mesh
        }
      });

      resolve(pivot);
    });
  });
}

export function loadWeapon(): Promise<THREE.Object3D> {
  return new Promise((resolve, reject) => {
    loader.load("sword2.glb", (gltf) => {
      gltf.scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true; // Enable shadow casting for the mesh
          child.receiveShadow = true; // Enable shadow receiving for the mesh
        }
        if (child instanceof THREE.Mesh) {
          child.material = new THREE.MeshBasicMaterial({
            color: new THREE.Color(0.4, 0.4, 0.4),
          });
        }
      });
      resolve(gltf.scene);
    });
  });
}
/*
const audioLoader = new THREE.AudioLoader();
let moveBuffer: AudioBuffer | null = null;
let swingBuffer: AudioBuffer | null = null;
let parryBuffer: AudioBuffer | null = null;

// Load the audio buffer once
audioLoader.load("scrape.mp3", (buffer) => {
  moveBuffer = buffer;
});

audioLoader.load("swing.mp3", (buffer) => {
  swingBuffer = buffer;
});

audioLoader.load("parry.mp3", (buffer) => {
  parryBuffer = buffer;
});

// Utility function to set the audio
export function setAudio(
  listener: THREE.AudioListener,
  bufferName: "move" | "swing" | "parry",
  volume: number = 0.5
) {
  let selectedBuffer: AudioBuffer | null = null;
  switch (bufferName) {
    case "move":
      selectedBuffer = moveBuffer;
      break;
    case "swing":
      selectedBuffer = swingBuffer;
      break;
    case "parry":
      selectedBuffer = parryBuffer;
      break;
  }
  if (!selectedBuffer) {
    console.warn("Audio buffer not loaded yet.");
    return;
  }

  const audio = new THREE.PositionalAudio(listener);
  audio.setBuffer(selectedBuffer);
  audio.setVolume(volume);
  //audio.setRefDistance(10);

  return audio; // Return the audio instance if further control is needed
}*/

const sparkTexture = new THREE.TextureLoader().load("spark.png"); // load spark texture
const sparkMaterial = new THREE.SpriteMaterial({
  map: sparkTexture,
  transparent: true,
});
const spark = new THREE.Sprite(sparkMaterial);
spark.scale.set(1, 1, 1); // adjust spark size
export { spark };
