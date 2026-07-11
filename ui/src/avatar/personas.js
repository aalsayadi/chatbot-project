// A persona pairs a VRM model with a backend voice. Selecting a persona
// swaps BOTH together. The `backend` key is sent to /api/chat, where the
// server maps it to the matching Kokoro voice (voice/tts.py VOICES).
export const PERSONAS = {
    male: { label: "Male", vrmPath: "/AvatarVRM.vrm", backend: "male" },
    female: { label: "Female", vrmPath: "/FemaleVRM.vrm", backend: "female" },
    robot: { label: "Robot", vrmPath: "/RobotVRM.vrm", backend: "robot" },
};

export const PERSONA_ORDER = ["male", "female", "robot"];

export const DEFAULT_PERSONA = "male";
