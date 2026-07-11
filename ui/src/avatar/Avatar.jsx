import { useEffect, useRef } from "react";
import { initAvatar } from "./src/index.js";
import { PERSONAS, DEFAULT_PERSONA } from "./personas.js";

/**
 * Mounts the Three.js/VRM avatar into a container sized by the surrounding
 * layout. Calls `onReady(controls)` once the avatar is initialised, where
 * controls = { setState, setEmotion, loadPersona, dispose }.
 */
export default function Avatar({ persona = DEFAULT_PERSONA, onReady }) {
    const containerRef = useRef(null);
    const controlsRef = useRef(null);

    useEffect(() => {
        let cancelled = false;
        const container = containerRef.current;
        const initialVrm = PERSONAS[persona]?.vrmPath;

        initAvatar(container, initialVrm)
            .then((controls) => {
                // If the component unmounted before init finished (e.g. React
                // StrictMode double-invoke in dev), tear the instance down.
                if (cancelled) {
                    controls.dispose();
                    return;
                }
                controlsRef.current = controls;
                onReady?.(controls);
            })
            .catch((err) => console.error("Avatar init failed:", err));

        return () => {
            cancelled = true;
            controlsRef.current?.dispose();
            controlsRef.current = null;
        };
        // Init once on mount; persona changes are handled via loadPersona in App.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return <div className="avatarCanvas" ref={containerRef} aria-hidden="true" />;
}
