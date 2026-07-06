import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from "@pixiv/three-vrm-animation";

let mixer;
let animations = {};
let activeAction = null;

export async function loadAnimations(vrm) {
    const loader = new GLTFLoader();
    

    loader.register((parser) => {
        return new VRMAnimationLoaderPlugin(parser);

    });

    const files = {
        idle: new URL("../animations/Breathing_Idle.vrma", import.meta.url).href,
        listening: new URL("../animations/Thoughtful_Head_Nod.vrma", import.meta.url).href,
        thinking: new URL("../animations/Thinking.vrma", import.meta.url).href,
        speaking: new URL("../animations/Talking.vrma", import.meta.url).href,
    };

    for (const [name, path] of Object.entries(files)) {
        const gltf = await loader.loadAsync(path);

        // Animationsdaten liegen hier:
        const vrmAnimation = gltf.userData.vrmAnimations?.[0];

        if (!vrmAnimation) {
            console.warn("Keine VRMA-Daten gefunden in:", path);
            continue;
        }

        if (!vrm) {
            console.warn("VRM noch nicht geladen, kann Clip nicht erstellen");
            continue;
        }

        // Retargeting auf das VRM-Humanoid-Skelett
        const clip = createVRMAnimationClip(vrmAnimation, vrm);

        animations[name] = clip;
        console.log("Loaded:", name, clip);
    }
}

export function getAnimation(name) {
    return animations[name];
}

export function createMixer(root) {
    mixer = new THREE.AnimationMixer(root);
    return mixer;
}

export function playAnimation(name, fadeDuration = 0.2) {
    const clip = animations[name];

    if (!mixer || !clip) {
        console.warn("Animation nicht abspielbar:", name, { mixer: !!mixer, clip: !!clip });
        return null;
    }

    if (activeAction) {
        activeAction.fadeOut(fadeDuration);
        activeAction.stop();
    }

    const action = mixer.clipAction(clip).reset();
    action.fadeIn(fadeDuration);
    action.play();
    activeAction = action;

    return action;
}

export function updateAnimations(deltaTime) {
    if (mixer) {
        mixer.update(deltaTime);
    }
}

export function getMixer() {
    return mixer;
}