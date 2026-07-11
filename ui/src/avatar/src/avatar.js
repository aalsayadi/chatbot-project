import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";

let currentVrm = null;

// Default persona model; overridable via the vrmPath argument.
export const DEFAULT_VRM_PATH = "/AvatarVRM.vrm";

export function loadAvatar(scene, vrmPath = DEFAULT_VRM_PATH) {
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
    unloadAvatar(scene);
    return loadAvatar(scene, vrmPath);
}

export function getCurrentVrm() {
    return currentVrm;
}
