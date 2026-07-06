import * as THREE from "three";
import { loadAvatar } from "./avatar.js";
import { updateIdle } from "./idle.js";
import { setEmotion, updateLipSync } from "./emotions.js";
import { getCurrentVrm } from "./avatar.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { setState } from "./states.js";
import { createMixer, loadAnimations, updateAnimations } from "./animationManager.js";
import { setAvatarEmotion, setAvatarState, updateAvatarController } from "./controller.js";


const scene = new THREE.Scene();

scene.background =
    new THREE.Color(0x222222);

const camera =
    new THREE.PerspectiveCamera(
        35,
        window.innerWidth /
        window.innerHeight,
        0.1,
        1000
    );

camera.position.set(0, 1.4, 2);

const renderer =
    new THREE.WebGLRenderer({
        antialias: true
    });

renderer.setSize(
    window.innerWidth,
    window.innerHeight
);

document.body.appendChild(
    renderer.domElement
);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.enableZoom = true;
controls.screenSpacePanning = false;
controls.minPolarAngle = Math.PI / 2;
controls.maxPolarAngle = Math.PI / 2;
controls.target.set(0, 1.2, 0);
controls.update();

const light = new THREE.DirectionalLight(0xffffff, 2);

light.position.set(1, 1, 1);

scene.add(light);

const ambient = new THREE.AmbientLight(0xffffff, 1);
scene.add(ambient);

await loadAvatar(scene);
const vrm = getCurrentVrm();
await loadAnimations(vrm);
const lookAtTarget = new THREE.Object3D();
scene.add(lookAtTarget);

if (vrm) {
    createMixer(vrm.scene);

    const box = new THREE.Box3().setFromObject(vrm.scene);
    const center = new THREE.Vector3();
    box.getCenter(center);

        const visibleHeight = 1.0; 
        const yOffset = 1.0;
        const zOffset = 1.5;

        controls.target.set(center.x, center.y - visibleHeight / 2 + yOffset, center.z);
        camera.position.set(center.x, center.y + 0.2, center.z + zOffset);

      if (vrm.lookAt) {
        vrm.lookAt.target = lookAtTarget;
        vrm.lookAt.autoUpdate = true;
    }

const clock = new THREE.Clock();
window.setEmotion = setAvatarEmotion;
window.setState = setAvatarState;
window.updateAvatarController = updateAvatarController;

if (vrm) {
    setState("idle");
}

function animate() {
    requestAnimationFrame(animate);

    controls.update();

    const delta = clock.getDelta();
    updateIdle(delta);
    updateAnimations(delta);
    updateAvatarController(delta);

    if (lookAtTarget) {
        lookAtTarget.position.copy(camera.position);
    }

    if (vrm) {
        vrm.update(delta);
    }

    renderer.render(scene, camera);
}

animate();}