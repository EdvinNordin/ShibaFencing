import * as THREE from "three";
import { weapon } from "./main";

export class Weapon {
    damage: number;
    mesh: THREE.Object3D;
    constructor() {
        const scaleFactor = 0.015; // Adjust the scale factor as needed
        this.damage = 10; // Example damage value
        this.mesh = weapon.clone();
        this.mesh.scale.setScalar(scaleFactor); 
    }
}