/**
 * AudioWorklet processor that plays streaming PCM audio from a circular buffer.
 * Main thread posts decoded Float32Array chunks via MessagePort.
 * Audio is stereo interleaved (L, R, L, R, ...) at 48kHz.
 */
class PCMPlayerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    // 5 seconds of stereo audio at 48kHz = 480,000 samples
    this.bufferSize = 48000 * 2 * 5;
    this.buffer = new Float32Array(this.bufferSize);
    this.writePos = 0;
    this.readPos = 0;
    this.started = false;
    this.bufferedSamples = 0;

    // ~1 second of audio before we start playing (jitter buffer)
    this.startThreshold = 48000 * 2;

    this.port.onmessage = (e) => {
      if (e.data.type === 'audio') {
        const samples = e.data.samples;
        for (let i = 0; i < samples.length; i++) {
          this.buffer[this.writePos] = samples[i];
          this.writePos = (this.writePos + 1) % this.bufferSize;
        }
        this.bufferedSamples += samples.length;
      } else if (e.data.type === 'reset') {
        this.writePos = 0;
        this.readPos = 0;
        this.started = false;
        this.bufferedSamples = 0;
        this.buffer.fill(0);
      }
    };
  }

  available() {
    if (this.writePos >= this.readPos) {
      return this.writePos - this.readPos;
    }
    return this.bufferSize - this.readPos + this.writePos;
  }

  process(inputs, outputs) {
    const output = outputs[0];
    if (!output || output.length < 2) return true;

    const left = output[0];
    const right = output[1];

    // Wait for enough buffered audio before starting playback
    if (!this.started) {
      if (this.available() < this.startThreshold) {
        // Fill silence while buffering
        left.fill(0);
        right.fill(0);
        return true;
      }
      this.started = true;
    }

    for (let i = 0; i < left.length; i++) {
      if (this.available() >= 2) {
        left[i] = this.buffer[this.readPos];
        this.readPos = (this.readPos + 1) % this.bufferSize;
        right[i] = this.buffer[this.readPos];
        this.readPos = (this.readPos + 1) % this.bufferSize;
      } else {
        // Buffer underrun — output silence
        left[i] = 0;
        right[i] = 0;
      }
    }

    return true;
  }
}

registerProcessor('pcm-player', PCMPlayerProcessor);
