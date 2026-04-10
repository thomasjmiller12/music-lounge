import { GoogleGenAI } from '@google/genai';
import type { WeightedPrompt, MusicGenConfig } from '../types';
import { decodeBase64PCM } from './pcm-utils';

export interface LyriaCallbacks {
  onAudioChunk: (pcm: Float32Array) => void;
  onFilteredPrompt?: (text: string, reason: string) => void;
  onWarning?: (message: string) => void;
  onError: (error: Error) => void;
  onClose: () => void;
  onReady: () => void;
}

type LyriaSession = Awaited<ReturnType<InstanceType<typeof GoogleGenAI>['live']['music']['connect']>>;

/**
 * Wraps the @google/genai SDK for Lyria Realtime music generation.
 * Handles connection lifecycle, audio chunk decoding, and parameter updates.
 *
 * Usage:
 *   const client = new LyriaClient(apiKey);
 *   await client.connect(callbacks);
 *   client.setPrompts([{ text: 'Ambient, Synth Pads', weight: 1.0 }]);
 *   client.setConfig({ density: 0.3, brightness: 0.5, temperature: 1.1, guidance: 3.5 });
 *   client.play();
 */
export class LyriaClient {
  private client: GoogleGenAI;
  private session: LyriaSession | null = null;
  private connected = false;

  // Track last-sent values to avoid redundant updates
  private lastPromptsJSON = '';
  private lastConfigJSON = '';

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey, apiVersion: 'v1alpha' });
  }

  async connect(callbacks: LyriaCallbacks): Promise<void> {
    this.session = await this.client.live.music.connect({
      model: 'models/lyria-realtime-exp',
      callbacks: {
        onmessage: (msg: any) => {
          if (msg.setupComplete) {
            this.connected = true;
            callbacks.onReady();
          }
          if (msg.serverContent?.audioChunks) {
            for (const chunk of msg.serverContent.audioChunks) {
              const pcm = decodeBase64PCM(chunk.data);
              callbacks.onAudioChunk(pcm);
            }
          }
          if (msg.filteredPrompt) {
            callbacks.onFilteredPrompt?.(
              msg.filteredPrompt.text,
              msg.filteredPrompt.filteredReason,
            );
          }
          if (msg.warning) {
            callbacks.onWarning?.(msg.warning);
          }
        },
        onerror: (e: any) => callbacks.onError(new Error(e.message || 'Lyria connection error')),
        onclose: () => {
          this.connected = false;
          callbacks.onClose();
        },
      },
    });
  }

  isConnected(): boolean {
    return this.connected;
  }

  play(): void {
    this.session?.play();
  }

  pause(): void {
    this.session?.pause();
  }

  stop(): void {
    this.session?.stop();
  }

  /**
   * Reset context — required after changing BPM or scale.
   * Music continues generating with current prompts/config.
   */
  resetContext(): void {
    this.session?.resetContext();
  }

  /**
   * Update weighted prompts. Skips if identical to last-sent value.
   * Weights are auto-normalized by Lyria (they sum to 1.0).
   */
  setPrompts(prompts: WeightedPrompt[]): void {
    const json = JSON.stringify(prompts);
    if (json === this.lastPromptsJSON) return;
    this.lastPromptsJSON = json;
    this.session?.setWeightedPrompts({ weightedPrompts: prompts });
  }

  /**
   * Update generation config. Must send the FULL config every time —
   * omitted fields reset to Lyria defaults.
   */
  setConfig(config: MusicGenConfig): void {
    const json = JSON.stringify(config);
    if (json === this.lastConfigJSON) return;
    this.lastConfigJSON = json;
    this.session?.setMusicGenerationConfig({ musicGenerationConfig: config as any });
  }

  close(): void {
    this.session?.close();
    this.session = null;
    this.connected = false;
  }
}
