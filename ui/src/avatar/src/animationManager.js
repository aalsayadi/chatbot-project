import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from "@pixiv/three-vrm-animation";

let mixer;
let animations = {};
let activeAction = null;

function prepareSpeakingClip(clip) {
    if (!clip || !clip.duration) return clip;

    const trimmedDuration = Math.max(0.8, clip.duration * 0.92);
    const fps = clip.fps || 30;
    const endFrame = Math.max(1, Math.floor(trimmedDuration * fps));

    const subClip = THREE.AnimationUtils.subclip(
        clip,
        "speaking_trimmed",
        0,
        endFrame,
        fps
    );

    subClip.tracks = (subClip.tracks || []).filter((track) => {
        const trackName = (track && track.name) || "";
        return !/(head|neck|eye)/i.test(trackName);
    });

    subClip.duration = trimmedDuration;
    return subClip;
}

export async function loadAnimations(vrm) {
    // Clips are retargeted to a specific VRM skeleton, so drop any previously
    // loaded clips when (re)loading for a new persona model.
    animations = {};

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
        const preparedClip = name === "speaking" ? prepareSpeakingClip(clip) : clip;

        animations[name] = preparedClip;
        console.log("Loaded:", name, preparedClip);
    }
}

export function getAnimation(name) {
    return animations[name];
}

export function createMixer(root) {
    // The previous mixer (if any) belonged to the old persona's skeleton and
    // its actions are now invalid; start fresh.
    mixer = new THREE.AnimationMixer(root);
    activeAction = null;
    return mixer;
}

export function playAnimation(name, fadeDuration = 0.3) {
    const clip = animations[name];

    if (!mixer || !clip) {
        console.warn("Animation nicht abspielbar:", name);
        return null;
    }

    const previousAction = activeAction;
    const newAction = mixer.clipAction(clip);

    newAction.reset();
    newAction.enabled = true;
    newAction.setEffectiveTimeScale(1);
    newAction.setEffectiveWeight(1);
    newAction.play();

    if (previousAction && previousAction !== newAction) {
        previousAction.crossFadeTo(newAction, fadeDuration, true);
    }

    activeAction = newAction;
    return newAction;
}

export function updateAnimations(deltaTime) {
    if (mixer) {
        mixer.update(deltaTime);
    }
}

export function getMixer() {
    return mixer;
}