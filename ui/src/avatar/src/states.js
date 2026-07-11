import { setEmotion, setSpeaking } from "./emotions.js";
import { playAnimation } from "./animationManager.js";

let currentState = "idle";

export function setState(state) {
    const nextState = state || "idle";

    currentState = nextState;

    switch (nextState) {
        case "idle":
        case "listening":
            //setEmotion("relaxed");
            setSpeaking(false);
            break;

        case "thinking":
           // setEmotion("sad", 0.5);
            setSpeaking(false);
            break;

        case "speaking":
            setSpeaking(true);
            break;

        default:
            setEmotion("relaxed");
            setSpeaking(false);
            break;
    }

    playAnimation(nextState);
    console.log("State:", nextState);
}

export function getState() {
    return currentState;
}