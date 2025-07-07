import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { Player } from "./Player";
import { Controller } from "./Controller";

export class Game {
  scene: THREE.Scene;
  world: RAPIER.World;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  players: Map<string, Player>;
  controller: Controller;
  player: Player;
  rigidBody: RAPIER.RigidBody;

  constructor() {
    this.scene = new THREE.Scene();
    //const texture = new THREE.TextureLoader().load( "Haze.png" );
    //this.scene.background = texture; // Set a background texture
    this.scene.background = new THREE.Color(0xd2f3d7);

    let gravity = { x: 0.0, y: -9.81, z: 0.0 };
    this.world = new RAPIER.World(gravity);

    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 5, 10);
    this.camera.lookAt(0, 0, 0);
    this.scene.add(this.camera);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.shadowMap.enabled = true;
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(this.renderer.domElement);

    this.players = new Map<string, Player>();
    this.player = new Player();
    this.addPlayer(this.player);

    const rbDesc = RAPIER.RigidBodyDesc.kinematicPositionBased();
    this.rigidBody = this.world.createRigidBody(rbDesc);
    this.rigidBody.setNextKinematicTranslation(new RAPIER.Vector3(0, 0, 0));

    this.controller = new Controller(this.player, this.world, this.camera);
  }

  addPlayer(newPlayer: Player) {
    this.players.set(newPlayer.ID, newPlayer);
    this.scene.add(newPlayer.mesh);
  }

  removePlayer(oldPlayer: Player) {
    this.scene.remove(oldPlayer.mesh);
    this.players.delete(oldPlayer.ID);
  }

  findPlayer(ID: string): Player | undefined {
    const currPlayer = this.players.get(ID);
    return currPlayer;
  }

  getPlayerCount(): number {
    return this.players.size;
  }

  printPlayers() {
    console.log("Current players in the game:");
    this.players.forEach((player, ID) => {
      console.log(`Player ID: ${ID}`);
    });
  }
}
