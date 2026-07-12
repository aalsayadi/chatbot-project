import { getCurrentVrm } from "./avatar.js";
import { getState } from "./states.js";

let blinkTimer = 0;

export function updateIdle(deltaTime) {

    const vrm = getCurrentVrm();
    const state = getState();

    if (!vrm) return;

    blinkTimer += deltaTime;

    if (blinkTimer > 4) {

        vrm.expressionManager.setValue("blink", 1);

        setTimeout(() => {
            vrm.expressionManager.setValue("blink", 0);
        }, 150);

        blinkTimer = 0;
    }

    const t = performance.now() * 0.001;

    if(state === "idle"){

       // vrm.scene.rotation.x =
         //   Math.sin(t * 0.4) * 0.02;

    }

    if(state === "listening"){

       // vrm.scene.rotation.x =
         //   Math.sin(t * 1.5) * 0.05;
    }

    if(state === "thinking"){

       // vrm.scene.rotation.z =
         //   Math.sin(t * 0.5) * 0.08;
    }

    if(state === "speaking"){

       // vrm.scene.rotation.y =
         //   Math.sin(t * 0.8) * 0.05;
    }
}