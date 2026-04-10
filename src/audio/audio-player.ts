import type { AudioAnalysis } from '../types';

/**
 * Manages audio playback of Lyria PCM streams via AudioWorklet,
 * and provides FFT/waveform analysis for visualization.
 */
export class AudioPlayer {
  private ctx: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private fftData: Float32Array<ArrayBuffer> = new Float32Array(0);
  private waveformData: Float32Array<ArrayBuffer> = new Float32Array(0);

  /**
   * Initialize AudioContext and worklet. Must be called from a user gesture.
   */
  async init(): Promise<void> {
    this.ctx = new AudioContext({ sampleRate: 48000 });

    await this.ctx.audioWorklet.addModule('/pcm-worklet-processor.js');
    this.workletNode = new AudioWorkletNode(this.ctx, 'pcm-player', {
      outputChannelCount: [2],
    });

    this.gainNode = this.ctx.createGain();
    this.gainNode.gain.value = 1.0;

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.8;

    // Signal chain: worklet → gain → analyser → destination
    this.workletNode.connect(this.gainNode);
    this.gainNode.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    this.fftData = new Float32Array(this.analyser.frequencyBinCount);
    this.waveformData = new Float32Array(this.analyser.fftSize);
  }

  /**
   * Push decoded PCM audio into the worklet's circular buffer.
   * Called from LyriaClient's onAudioChunk callback.
   */
  pushAudio(pcm: Float32Array): void {
    this.workletNode?.port.postMessage(
      { type: 'audio', samples: pcm },
      [pcm.buffer],
    );
  }

  /**
   * Reset the worklet buffer (e.g., after a context reset or reconnection).
   */
  resetBuffer(): void {
    this.workletNode?.port.postMessage({ type: 'reset' });
  }

  /**
   * Get current audio analysis data for visualization.
   */
  getAnalysis(): AudioAnalysis {
    if (!this.analyser) {
      return {
        fft: new Float32Array(0),
        waveform: new Float32Array(0),
        lowEnergy: 0,
        midEnergy: 0,
        highEnergy: 0,
      };
    }

    this.analyser.getFloatFrequencyData(this.fftData);
    this.analyser.getFloatTimeDomainData(this.waveformData);

    const bins = this.fftData.length; // 128
    const lowEnd = Math.floor(bins * 0.15);   // ~0-900Hz
    const midEnd = Math.floor(bins * 0.45);   // ~900-5400Hz

    return {
      fft: this.fftData,
      waveform: this.waveformData,
      lowEnergy: this.bandEnergy(0, lowEnd),
      midEnergy: this.bandEnergy(lowEnd, midEnd),
      highEnergy: this.bandEnergy(midEnd, bins),
    };
  }

  private bandEnergy(start: number, end: number): number {
    let sum = 0;
    for (let i = start; i < end; i++) {
      // FFT values are in dB (negative). Normalize roughly to 0-1.
      sum += Math.max(0, Math.min(1, (this.fftData[i] + 100) / 80));
    }
    return sum / Math.max(1, end - start);
  }

  setVolume(value: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, value));
    }
  }

  async resume(): Promise<void> {
    if (this.ctx?.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  async suspend(): Promise<void> {
    if (this.ctx?.state === 'running') {
      await this.ctx.suspend();
    }
  }
}
