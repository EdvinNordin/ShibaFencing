import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const loader = new GLTFLoader();

export function loadModel(): Promise<THREE.Object3D> {
  return new Promise((resolve, reject) => {
    loader.load("shiba.glb", (gltf) => {
      const model = gltf.scene;
      const pivot = new THREE.Object3D();
      pivot.add(model);

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
      });
      resolve(gltf.scene);
    });
  });
}

const sparkTexture = new THREE.TextureLoader().load("spark.png"); // load spark texture
const sparkMaterial = new THREE.SpriteMaterial({
  map: sparkTexture,
  transparent: true,
});
const spark = new THREE.Sprite(sparkMaterial);
spark.scale.set(1, 1, 1); // adjust spark size
export { spark };
