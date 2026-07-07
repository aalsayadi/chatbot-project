Use controller.js to interact. 
The most important functions for you are setAvatarState(should probably be triggered on the audio part) 
and possibly setAvatarEmotion (probably as an extra for the llm/emotion recognition part)
setAvatarSpeaking is pretty much irrelevant (only for very specific situations)
Possible states are idle, listening, thinking, and speaking. 
Optionally, you can specify an emotion (happy, sad, angry, relaxed, surprised, default)
!please avoid “happy” and "surprised" for now! Use "relaxed" as a happy emotion!!!
You are able to set an emotion intensity between 0 and 1. 
You don’t need to worry about anything else!

EXAMPLE:

//Avatar should be sad
setAvatarEmotion("sad", 0.7); // 70% intensity (using intensity 1 should be fine for almost everything)

// Avatar should speak and be happy
setAvatarState("speaking", { emotion: "relaxed", intensity: 1 });

// Avatar should think without any extra emotion
setAvatarState("thinking");

// Avatar should listen and be sad
setAvatarState("listening", { emotion: "sad" });
