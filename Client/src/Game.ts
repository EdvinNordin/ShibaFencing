import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { Player } from "./Player";
import { Controller } from "./Controller";
import { MobileController } from "./Mobile";
import { isMobile } from "./main";
import { initializeWebSocket } from "./Network";
import { spark } from "./Loader";

export class Game {
  scene: THREE.Scene;
  world: RAPIER.World;
  camera: THREE.PerspectiveCamera;
  //audioListener: THREE.AudioListener;
  renderer: THREE.WebGLRenderer;
  players: Map<string, Player>;
  controller: Controller | MobileController | null = null;
  player: Player | null = null;
  deltaTime: number = 0;
  socket: WebSocket;
  playerID: string = "";
  IDLoaded: boolean = false;
  opponentsLoaded: boolean = false;
  gameLoaded: boolean = false;

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

    /*this.audioListener = new THREE.AudioListener();
    this.camera.add(this.audioListener);*/

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.shadowMap.enabled = true;
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(this.renderer.domElement);

    this.players = new Map<string, Player>();

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
    this.world.removeRigidBody(oldPlayer.weapon.rigidBody);
    this.world.removeCollider(oldPlayer.weapon.collider, false);
    this.world.removeRigidBody(oldPlayer.rigidBody);
    this.world.removeCollider(oldPlayer.collider, false);
  }

  findPlayer(ID: string): Player | undefined {
    const currPlayer = this.players.get(ID);
    return currPlayer;
  }

  getPlayerCount(): number {
    return this.players.size;
  }

  Spark(contactPoint: RAPIER.Vector) {
    if (contactPoint) {
      const sparkInstance = spark.clone();

      this.scene.add(sparkInstance);
      sparkInstance.position.set(
        contactPoint.x,
        contactPoint.y,
        contactPoint.z
      );

      let life = 1; // seconds
      const dt: number = this.deltaTime; // Use the delta time from the game
      const animate = (dt: number) => {
        life -= dt;
        sparkInstance.scale.setScalar(life * 2); // Scale the spark based on its life
        sparkInstance.material.opacity = life;
        if (life <= 0) {
          this.scene.remove(sparkInstance);
        } else {
          requestAnimationFrame(() => animate(0.016)); // ~60fps
        }
      };
      animate(0.016);
    }
  }

  initializePlayer(name: string, color: string, socket: WebSocket) {
    this.player = new Player(this.world, name, color, this.playerID);
    this.addPlayer(this.player);
    this.player.createNameTag(name);
    this.player.setColor(color);
    if (this.playerID) {
      this.player.ID = this.playerID;
    }

    if (isMobile) {
      this.controller = new MobileController(
        this.player,
        this.world,
        this.camera
      );
    } else {
      this.controller = new Controller(this.player, this.world, this.camera);
    }

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

  startGame() {
    if (this.IDLoaded && this.opponentsLoaded) {
      this.gameLoaded = true;
    }
  }
}
