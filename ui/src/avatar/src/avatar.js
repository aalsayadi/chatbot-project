import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";

let currentVrm = null;

// Default persona model; overridable via the vrmPath argument.
export const DEFAULT_VRM_PATH = "/AvatarVRM.vrm";

export function loadAvatar(scene, vrmPath = DEFAULT_VRM_PATH, options = {}) {
    const { visible = true } = options;

    return new Promise((resolve, reject) => {
        const loader = new GLTFLoader();

        loader.register((parser) => {
            return new VRMLoaderPlugin(parser);
        });

        loader.load(
            vrmPath,

            (gltf) => {
                currentVrm = gltf.userData.vrm;
                scene.add(currentVrm.scene);
                currentVrm.scene.visible = visible;
                currentVrm.scene.rotation.y = 0;
                console.log("VRM loaded:", vrmPath);
                resolve(currentVrm);
            },

            (progress) => {
                console.log(
                    "Loading:",
                    (progress.loaded / progress.total) * 100
                );
            },

            (error) => {
                console.error(error);
                reject(error);
            }
        );
    });
}

/**
 * Remove the current VRM from the scene and free its GPU resources.
 * Call before loading a different persona model at runtime.
 */
export function unloadAvatar(scene) {
    if (!currentVrm) return;

    scene.remove(currentVrm.scene);

    // Release geometries, textures and skeletons so swapping personas
    // repeatedly doesn't leak GPU memory.
    VRMUtils.deepDispose(currentVrm.scene);

    currentVrm = null;
}

/**
 * Swap the loaded persona model at runtime: unload the current VRM and load
 * the one at `vrmPath`. Returns the newly loaded VRM.
 */
export async function swapAvatar(scene, vrmPath) {
    const previousVrm = currentVrm;
    const nextVrm = await loadAvatar(scene, vrmPath, { visible: false });

    if (previousVrm && previousVrm.scene !== nextVrm.scene) {
        scene.remove(previousVrm.scene);
        VRMUtils.deepDispose(previousVrm.scene);
    }

    currentVrm = nextVrm;
    nextVrm.scene.visible = true;
    return nextVrm;
}

export function getCurrentVrm() {
    return currentVrm;
}

/**
 * Point the shared "current VRM" at a specific model. The render loop calls
 * this each frame so that, if React (StrictMode) briefly creates a second
 * avatar instance, the *live* instance keeps ownership of this module-level
 * pointer -- otherwise a stale reference makes a persona swap remove the wrong
 * model and leave the old avatar frozen behind the new one.
 */
export function setCurrentVrm(vrm) {
    currentVrm = vrm;
}
