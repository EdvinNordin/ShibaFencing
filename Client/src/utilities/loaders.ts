import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import * as THREE from "three";
import { scene } from "./setup";
import { setObjectCells } from "./spatial";
import * as constant from "./constants";
import { Rhino3dmLoader } from "three/examples/jsm/loaders/3DMLoader";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";

export let animations: any = [];
export let weapon: THREE.Mesh;
export let model: THREE.Object3D;
export function loadModel() {
  return new Promise((resolve, reject) => {
    const loader = new FBXLoader();
    loader.load(
      "pala.fbx",
      (object) => {
        //object.rotation.x = Math.PI / 2;
        let i: number = 0;
        object.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            if (i === 1) {
              weapon = child;
            }
            i++;
          }
        });
        object.castShadow = true;
        object.receiveShadow = true;
        model = object;
        const animLoader = new FBXLoader();
        animLoader.load("idleAnim.fbx", (anim) => {
          anim.animations[0].name = "idle";
          animations[0] = anim.animations[0];
        });
        animLoader.load("runAnim.fbx", (anim) => {
          anim.animations[0].name = "run";
          animations[1] = anim.animations[0];
        });
        animLoader.load("attackAnim.fbx", (anim) => {
          anim.animations[0].name = "attack";
          animations[2] = anim.animations[0];
        });
        animLoader.load("rollAnim.fbx", (anim) => {
          anim.animations[0].name = "roll";
          animations[3] = anim.animations[0];
        });
        animLoader.load("hitAnim.fbx", (anim) => {
          anim.animations[0].name = "hit";
          animations[4] = anim.animations[0];
        });
        animLoader.load("deathAnim.fbx", (anim) => {
          anim.animations[0].name = "death";
          animations[5] = anim.animations[0];

          model = object;
          resolve(object);
        });
      },
      (xhr) => {
        // Loading progress
      },
      (error) => {
        console.log(error);
        reject(error);
      }
    );
  });
}

/*export function loadModel() {
  return new Promise((resolve, reject) => {
    new GLTFLoader().load(
      //"./paladino2.glb",
      "./selfRigged.glb",
      function (gltf: { scene: any; animations: any }) {
        let model = gltf.scene;
        animations = gltf.animations;
        console.log(model);
        //scene.add(model);
        resolve(model);
      },
      function (xhr: { loaded: number; total: number }) {
        if ((xhr.loaded / xhr.total) * 100 === 100) {
          // Loading complete
        }
      },
      function (error: any) {
        console.log(error);
        reject(error);
      }
    );
  });
} */
export function loadModels(
  floorGrid: { [key: string]: THREE.Object3D[] },
  wallGrid: { [key: string]: THREE.Object3D[] }
) {
  const mountLoader = new FBXLoader();
  mountLoader.load(
    "/mountains2.fbx",
    function (object) {
      object.scale.set(100, 100, 100);
      scene.add(object);
      object.position.set(0, -1000, 0);
    },
    function (xhr) {
      //console.log((xhr.loaded / xhr.total) * 100 + "%");
    },
    function (error) {
      console.error("Error loading mountains.fbx:", error);
    }
  );

  let planeMesh = new THREE.Mesh();
  planeMesh.geometry = new THREE.PlaneGeometry(1000, 1000, 1, 1);
  //planeMesh.rotation.x = -Math.PI / 2;

  // const texture = new THREE.TextureLoader().load("/stacked-stones.jpg");
  // texture.wrapS = THREE.RepeatWrapping;
  // texture.wrapT = THREE.RepeatWrapping;
  // texture.repeat.set(25, 25);
  planeMesh.material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    side: THREE.FrontSide,
  });

  planeMesh.name = "plane";
  scene.add(planeMesh);
  planeMesh.receiveShadow = true;
  planeMesh.castShadow = true;
  planeMesh.layers.enable(0);
  setObjectCells(planeMesh, floorGrid);

  const loader = new Rhino3dmLoader().setLibraryPath(
    "https://cdn.jsdelivr.net/npm/rhino3dm@8.4.0/"
  );

  loader.load(
    "/baken.3dm",
    function (object: THREE.Object3D) {
      object.rotation.x = -Math.PI / 2; // rotate the model
      object.scale.set(constant.scale, constant.scale, constant.scale);
      object.position.z = -20;
      object.name = "baken";
      scene.add(object);
      let box = new THREE.Box3().setFromObject(object, false);
      let center = new THREE.Vector3();
      let boxSize = new THREE.Vector3();
      box.getCenter(center);
      box.getSize(boxSize);
      object.position.y = 0; //-boxSize.y / 4;
      object.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material.metalness = 0;
          child.material.side = 0;
          child.receiveShadow = true;
          child.castShadow = true;
          if (child.material.name === "Paint") {
            child.layers.enable(0);
            setObjectCells(child, floorGrid);
          } else {
            child.layers.enable(1);
            setObjectCells(child, wallGrid);
          }
        }
      });
    },
    function () {
      //console.log((progress.loaded / progress.total) * 100 + "%");
    },
    function (error: any) {
      console.log(error);
    }
  );

  /*
        loader.load("land.3dm", function (object) {
    
            scene.add(object);
    
        }, function (progress) {
            //console.log((progress.loaded / progress.total) * 100 + "%");
        }, function (error) {
            console.log(error);
        });
    
    
        
        loader.load(
            "net.3dm",
            function (object) {
                object.rotation.x = -Math.PI / 2; // rotate the model
    
                object.scale.set(constant.scale);
                object.position.x = 150;
                let i = 0;
                scene.add(object);
    
                object.traverse((child) => {
                    if (child.isMesh) {
                        i++;
                        child.material.metalness = 0;
                        child.material.side = 2;
                        child.recieveShadow = true;
                        child.castShadow = true;
                    }
                });
                //console.log(i);
            },
            function (progress) {
                //console.log((progress.loaded / progress.total) * 100 + "%");
            },
            function (error) {
                console.log(error);
            }
        );
        */
  /*
    loader.load(
        "byReduced.3dm",
        function (object) {
            object.rotation.x = -Math.PI / 2; // rotate the model
            object.scale.set(constant.scale);
            object.position.x = -200;
            object.position.y = 0;
            scene.add(object);
            /*let box = new THREE.Box3().setFromObject(object, false);
            let center = new THREE.Vector3();
            box.getCenter(center);
            let i = 0;

            object.traverse((child) => {
                if (child.isMesh) {
                    child.material.metalness = 0;
                    child.material.side = 0;
                    child.recieveShadow = true;
                    child.castShadow = true;

                }
            });
            //console.log(i);
        },
        function (progress) {
            //console.log((progress.loaded / progress.total) * 100 + "%");
        },
        function (error) {
            console.log(error);
        }
    );*/
}
