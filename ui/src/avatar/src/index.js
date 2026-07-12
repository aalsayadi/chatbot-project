import * as THREE from "three";
import { loadAvatar, swapAvatar, getCurrentVrm, DEFAULT_VRM_PATH } from "./avatar.js";
import { updateIdle } from "./idle.js";
import {
    createMixer,
    loadAnimations,
    updateAnimations,
} from "./animationManager.js";
import { setState } from "./states.js";
import {
    setAvatarEmotion,
    setAvatarState,
    updateAvatarController,
} from "./controller.js";

/**
 * Initialise the Three.js/VRM avatar and mount it into `container`.
 *
 * Unlike the original standalone main.js, this attaches the canvas to a
 * caller-provided element (not document.body), sizes itself to that element,
 * uses a transparent background so it blends into the surrounding UI panel,
 * and returns a small control surface for the React app to drive.
 *
 * @returns {Promise<{
 *   setState: (state: string, options?: object) => void,
 *   setEmotion: (name: string, intensity?: number) => void,
 *   loadPersona: (vrmPath: string) => Promise<void>,
 *   dispose: () => void,
 * }>}
 */
export async function initAvatar(container, initialVrmPath = DEFAULT_VRM_PATH) {
    const scene = new THREE.Scene();
    // No scene.background -> transparent canvas, panel shows through.

    const width = container.clientWidth || 260;
    const height = container.clientHeight || 260;

    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 1000);
    camera.position.set(0, 1.4, 2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0); // fully transparent
    container.appendChild(renderer.domElement);

    const light = new THREE.DirectionalLight(0xffffff, 2);
    light.position.set(1, 1, 1);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0xffffff, 1));

    const lookAtTarget = new THREE.Object3D();
    scene.add(lookAtTarget);

    // Frame the camera on the currently loaded VRM (reused after persona swaps).
    function frameAvatar(vrm) {
        const box = new THREE.Box3().setFromObject(vrm.scene);
        const center = new THREE.Vector3();
        box.getCenter(center);

        const visibleHeight = 1.0;
        const yOffset = 1.05;
        const zOffset = 1.2;

        camera.position.set(center.x, center.y + 0.2, center.z + zOffset);
        camera.lookAt(center.x, center.y - visibleHeight / 2 + yOffset, center.z);

        if (vrm.lookAt) {
            vrm.lookAt.target = lookAtTarget;
            vrm.lookAt.autoUpdate = true;
        }
    }

    // --- Initial load ------------------------------------------------------
    await loadAvatar(scene, initialVrmPath);
    let vrm = getCurrentVrm();
    if (!vrm) throw new Error("VRM could not be loaded");

    await loadAnimations(vrm);
    createMixer(vrm.scene);
    frameAvatar(vrm);
    setState("idle");

    // --- Runtime persona swap ---------------------------------------------
    // Guard against overlapping swaps (rapid persona clicks).
    let swapping = false;
    async function loadPersona(vrmPath) {
        if (swapping) return;
        swapping = true;
        try {
            const nextVrm = await swapAvatar(scene, vrmPath);
            vrm = nextVrm;
            if (!vrm) return;

            vrm.scene.visible = false;
            await loadAnimations(vrm);   // re-retarget clips onto new skeleton
            createMixer(vrm.scene);      // fresh mixer for the new skeleton
            frameAvatar(vrm);
            setState("idle");
            vrm.scene.visible = true;
        } finally {
            swapping = false;
        }
    }

    // --- Resize with the container ----------------------------------------
    const resizeObserver = new ResizeObserver(() => {
        const w = container.clientWidth || 260;
        const h = container.clientHeight || 260;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    // --- Render loop -------------------------------------------------------
    const clock = new THREE.Clock();
    let rafId = null;
    let disposed = false;

    function animate() {
        if (disposed) return;
        rafId = requestAnimationFrame(animate);

        const delta = clock.getDelta();
        updateIdle(delta);
        updateAnimations(delta);
        updateAvatarController(delta);

        lookAtTarget.position.copy(camera.position);
        if (vrm) vrm.update(delta);

        renderer.render(scene, camera);
    }
    animate();

    function dispose() {
        disposed = true;
        if (rafId) cancelAnimationFrame(rafId);
        resizeObserver.disconnect();
        renderer.dispose();
        if (renderer.domElement.parentNode === container) {
            container.removeChild(renderer.domElement);
        }
    }

    return {
        setState: setAvatarState,
        setEmotion: setAvatarEmotion,
        loadPersona,
        dispose,
    };
}
