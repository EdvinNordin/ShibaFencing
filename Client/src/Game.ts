import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { Player } from "./Player";
import { Controller } from "./Controller";
import { MobileController } from "./Mobile";
import { isMobile } from "./main";
import { initializeWebSocket } from "./Network";

export class Game {
  scene: THREE.Scene;
  world: RAPIER.World;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  players: Map<string, Player>;
  controller: Controller | MobileController;
  player: Player;
  deltaTime: number = 0;
  socket: WebSocket;

  constructor() {
    this.scene = new THREE.Scene();
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
    this.player = new Player(this.world);
    this.addPlayer(this.player);

    if (isMobile) {
      this.controller = new MobileController(
        this.player,
        this.world,
        this.camera
      );
    } else {
      this.controller = new Controller(this.player, this.world, this.camera);
    }

    this.socket = initializeWebSocket();
  }

  updateDeltaTime(deltaTime: number) {
    this.deltaTime = deltaTime;
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

  initializePlayer(name: string, color: string, socket: WebSocket) {
    socket.send(
      JSON.stringify({
        action: "Initialize Player",
        name: name,
        color: color,
      })
    );
  }

  printPlayers() {
    console.log("Current players in the game:");
    this.players.forEach((player, ID) => {
      console.log(`Player ID: ${ID}`);
    });
  }
}
