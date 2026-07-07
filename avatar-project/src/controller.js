import { setEmotion, setSpeaking, updateLipSync, getCurrentEmotion } from "./emotions.js";
import { setState as applyState, getState as getCurrentState } from "./states.js";

export function setAvatarEmotion(name, intensity = 1) { //happy (für happy nutzt "relaxed") und surprised bitte nicht aufrufen
    setEmotion(name, intensity);
    return name;
}

export function setAvatarSpeaking(isSpeaking) {
    setSpeaking(isSpeaking);
    return Boolean(isSpeaking);
}

export function setAvatarState(state, options = {}) {
    const nextState = state || "idle";
    const emotionName = options.emotion || null;
    const intensity = options.intensity ?? 1;

    if (emotionName) {
        setEmotion(emotionName, intensity);
    }

    applyState(nextState, options);
    return nextState;
}

export function getAvatarState() {
    return getCurrentState();
}

export function getAvatarEmotion() {
    return getCurrentEmotion();
}

export function updateAvatarController(deltaTime) {
    updateLipSync(deltaTime);
}
