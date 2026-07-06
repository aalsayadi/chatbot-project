import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin } from "@pixiv/three-vrm";

let currentVrm = null;

export function loadAvatar(scene) {
    return new Promise((resolve, reject) => {
        const loader = new GLTFLoader();

        loader.register((parser) => {
            return new VRMLoaderPlugin(parser);
        });

        loader.load(
            "/AvatarVRM.vrm",

            (gltf) => {
                currentVrm = gltf.userData.vrm;
                scene.add(currentVrm.scene);
                currentVrm.scene.rotation.y = 0;
                console.log("VRM loaded");
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

export function getCurrentVrm() {
    return currentVrm;
}