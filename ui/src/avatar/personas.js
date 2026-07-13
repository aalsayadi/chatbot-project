import felixAvatar from "../../assets/icons/Felix.png";
import lisaAvatar from "../../assets/icons/Lisa.png";
import atlasAvatar from "../../assets/icons/Atlas.png";

// A persona pairs a VRM model with a backend voice. Selecting a persona
// swaps BOTH together. The `backend` key is sent to /api/chat, where the
// server maps it to the matching Kokoro voice (voice/tts.py VOICES).
export const PERSONAS = {
    male: { label: "Felix", vrmPath: "/AvatarVRM.vrm", backend: "male", avatarImage: felixAvatar },
    female: { label: "Lisa", vrmPath: "/FemaleVRM.vrm", backend: "female", avatarImage: lisaAvatar },
    robot: { label: "Atlas", vrmPath: "/RobotVRM.vrm", backend: "robot", avatarImage: atlasAvatar },
};

export const PERSONA_ORDER = ["male", "female", "robot"];

export const DEFAULT_PERSONA = "male";
