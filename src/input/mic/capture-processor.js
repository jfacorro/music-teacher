/**
 * AudioWorklet that hands microphone samples to the main thread in fixed-size hops, tagged
 * with the audio-clock frame of their first sample. All analysis happens in detector.ts.
 *
 * Plain JavaScript: it's loaded as-is with audioWorklet.addModule().
 */
class CaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.hopSize = options.processorOptions.hopSize;
    this.buffer = new Float32Array(this.hopSize);
    this.filled = 0;
    this.startFrame = 0;
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel) return true;
    for (let i = 0; i < channel.length; i++) {
      if (this.filled === 0) this.startFrame = currentFrame + i;
      this.buffer[this.filled++] = channel[i];
      if (this.filled === this.hopSize) {
        this.port.postMessage({ samples: this.buffer, frame: this.startFrame }, [
          this.buffer.buffer,
        ]);
        this.buffer = new Float32Array(this.hopSize);
        this.filled = 0;
      }
    }
    return true;
  }
}

registerProcessor('capture-processor', CaptureProcessor);
