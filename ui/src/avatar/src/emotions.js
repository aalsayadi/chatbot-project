import { getCurrentVrm } from "./avatar.js";

const emotionNames = ["happy", "sad", "angry", "surprised", "relaxed"]; //happy und surprised nicht aufrufen
const lipSyncExpressions = ["aa", "ah", "ih", "ou", "ee", "oh", "mouthOpen", "jawOpen"];

let currentEmotion = "relaxed";
let isSpeaking = false;
let lipSyncTimer = 0;

function setExpressionValue(manager, name, value) {
    if (!manager || !name) return false;

    try {
        if (typeof manager.getExpression === "function") {
            const expression = manager.getExpression(name);
            if (expression) {
                manager.setValue(name, value);
                return true;
            }
        }
    } catch (error) {
        console.warn("Expression unavailable:", name, error);
    }

    try {
        manager.setValue(name, value);
        return true;
    } catch (error) {
        console.warn("Expression unavailable:", name, error);
        return false;
    }
}

export function setEmotion(name, intensity = 1) {
    const vrm = getCurrentVrm();

    if (!vrm?.expressionManager) return;

    const manager = vrm.expressionManager;

    for (const emotion of emotionNames) {
        manager.setValue(emotion, 0);
    }

    currentEmotion = name || "relaxed";
    const normalizedIntensity = Math.max(0, Math.min(1, intensity));

    if (currentEmotion && currentEmotion !== "neutral") {
        setExpressionValue(manager, currentEmotion, normalizedIntensity);
    }

    //manager.update();

    console.log("Emotion:", currentEmotion);
}

export function setSpeaking(speaking) {
    isSpeaking = Boolean(speaking);
    lipSyncTimer = 0;

    const vrm = getCurrentVrm();
    if (!vrm?.expressionManager) return;

    const manager = vrm.expressionManager;

    if (!isSpeaking) {
        for (const name of lipSyncExpressions) {
            setExpressionValue(manager, name, 0);
        }
        manager.update();
    }
}

export function updateLipSync(deltaTime) {
    if (!isSpeaking) return;

    const vrm = getCurrentVrm();
    if (!vrm?.expressionManager) return;

    const manager = vrm.expressionManager;
    lipSyncTimer += deltaTime;

    const openAmount = 0.2 + 0.35 * Math.abs(Math.sin(lipSyncTimer * 4));
    const shapeAmount = 0.1 + 0.2 * Math.abs(Math.sin(lipSyncTimer * 10 + 0.5));

    const mouthShapes = [
        ["aa", openAmount * 0.9],
        ["mouthOpen", openAmount * 0.7],
        ["jawOpen", openAmount * 0.55],
        ["oh", shapeAmount * 0.45],
        ["ou", shapeAmount * 0.4],
        ["ih", shapeAmount * 0.25],
        ["ee", shapeAmount * 0.2],
    ];

    for (const [name, value] of mouthShapes) {
        setExpressionValue(manager, name, value);
    }

    //manager.update();
}

export function getCurrentEmotion() {
    return currentEmotion;
}