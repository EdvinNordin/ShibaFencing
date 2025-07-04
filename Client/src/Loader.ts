import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const loader = new GLTFLoader();

export function loadModel(): Promise<THREE.Object3D> {
  return new Promise((resolve, reject) => {
    loader.load(
      'shiba.glb',
      (gltf) => {
        gltf.scene.rotation.set(0, Math.PI, 0); // Rotate the model to face the correct direction
        gltf.scene.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true; // Enable shadow casting for the mesh
            child.receiveShadow = true; // Enable shadow receiving for the mesh
          }
        });
        resolve(gltf.scene);
      }
    );
  })
}


export function loadWeapon(): Promise<THREE.Object3D> {
  return new Promise((resolve, reject) => {
    loader.load(
      'sword2.glb',
      (gltf) => {
        gltf.scene.rotation.set(0, Math.PI, 0); // Rotate the model to face the correct direction
        gltf.scene.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true; // Enable shadow casting for the mesh
            child.receiveShadow = true; // Enable shadow receiving for the mesh
          }
        });
        resolve(gltf.scene);
      }
    );
  })
}
