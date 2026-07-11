// AudioWorklet that forwards raw microphone PCM frames to the main thread.
// Runs in every major browser that supports AudioWorklet (Chrome, Firefox,
// Safari 14.1+, Edge). The main thread resamples to 16 kHz Int16 and streams
// the audio over a WebSocket to the backend for Silero VAD + faster-whisper.
class VadCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input[0] && input[0].length) {
      // Channel 0 only (mono). Copy because the buffer is reused each quantum.
      this.port.postMessage(input[0].slice(0));
    }
    // Keep the processor alive even when input is briefly empty.
    return true;
  }
}

registerProcessor("vad-capture", VadCaptureProcessor);
