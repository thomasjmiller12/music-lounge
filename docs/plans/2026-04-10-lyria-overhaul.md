# Lyria Realtime Music Lounge — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Overhaul Music Lounge to replace Tone.js synthesis with Google Lyria Realtime AI music generation, controlled by day/night + chill/drive sliders and a slow Lorenz attractor, with a completely rewritten Three.js visualization featuring sunrise/moonrise transitions and a 3D Lorenz trail.

**Architecture:** Browser app connects to Lyria via `@google/genai` SDK over WebSocket. Two user-facing sliders (day/night, chill/drive) plus a continuously-evolving Lorenz attractor combine to produce weighted text prompts and generation config sent to Lyria every ~500ms. Lyria streams PCM audio chunks which are decoded and played via AudioWorklet. An AnalyserNode on the playback chain feeds FFT/waveform data to a Three.js scene featuring a Sky shader (sunrise→moonrise), environmental particles, a 3D Lorenz attractor trail, and bloom postprocessing.

**Tech Stack:** Vite 6, TypeScript (strict), `@google/genai` (Lyria SDK), Three.js + postprocessing, GSAP, Vitest

---

## Architecture Overview

### System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  Browser                                                     │
│                                                              │
│  ┌──────────┐   ┌──────────────┐   ┌───────────────────┐   │
│  │ Sliders  │──▶│              │   │   LyriaClient     │   │
│  │ day/night│   │  ParamEngine │──▶│   (@google/genai) │   │
│  │ calm/drv │   │              │   │   WebSocket ───────────▶ Lyria API
│  └──────────┘   │  Combines    │   └─────────┬─────────┘   │
│                 │  sliders +   │             │ audio chunks │
│  ┌──────────┐   │  lorenz →    │   ┌─────────▼─────────┐   │
│  │ Lorenz   │──▶│  prompts +   │   │   AudioPlayer     │   │
│  │ Modulator│   │  config      │   │   (AudioWorklet   │   │
│  │ (slow)   │   └──────────────┘   │    + AnalyserNode)│   │
│  └────┬─────┘                      └─────────┬─────────┘   │
│       │                                       │ FFT/waveform│
│       │  lorenz xyz                           │             │
│       │                            ┌──────────▼──────────┐  │
│       └───────────────────────────▶│  Three.js Scene     │  │
│                                    │  - Sky (day/night)  │  │
│          slider positions ────────▶│  - Particles        │  │
│                                    │  - Lorenz 3D trail  │  │
│                                    │  - Bloom / effects  │  │
│                                    └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow & Control Separation

**Sliders control the *feel* (scalar config):**
- Day/Night → brightness, subtle temperature shift
- Calm/Drive → density, guidance, minimal mood hint

**Lorenz controls the *palette* (prompt content — which instruments/textures are heard):**
- 3 axes, each blending between two "instrument poles"
- As the attractor wanders, instruments fade in and out over minutes
- This gives genuine sonic variety — the actual sounds change, not just how loud/dense they are

**Smooth transitions everywhere:**
- All parameters (config scalars AND prompt weights) pass through a lerp system
- Target values change instantly, but actual sent values ease over ~2 seconds
- Prevents jarring jumps when sliders move or Lorenz crosses a wing boundary

**Timing:**
1. **Every animation frame (~16ms):** Lorenz advances one tiny step. Smoothed values lerp toward targets. Three.js scene renders.
2. **Every ~500ms:** Smoothed prompt weights + config sent to Lyria (only if changed since last send).
3. **Continuously:** Lyria streams base64 PCM chunks → LyriaClient decodes → AudioPlayer worklet plays → AnalyserNode provides FFT/waveform for visualization.

### New File Structure

```
src/
├── audio/
│   ├── lyria-client.ts          # @google/genai SDK wrapper
│   ├── audio-player.ts          # AudioWorklet playback + AnalyserNode
│   └── pcm-utils.ts             # Base64 PCM decoding
├── music/
│   ├── lorenz-modulator.ts      # Slow Lorenz attractor
│   ├── param-engine.ts          # Smoothed sliders→config + Lorenz→prompts
│   ├── sound-palette.ts         # Main app base vibe + instrument poles
│   └── demo-schemas.ts          # 10 demo-only preset schemas
├── viz/
│   ├── scene.ts                 # Three.js scene, camera, renderer
│   ├── sky.ts                   # Sky shader + sun/moon + stars
│   ├── particles.ts             # Environmental particle system
│   ├── lorenz-viz.ts            # 3D Lorenz attractor trail
│   └── effects.ts               # Postprocessing pipeline
├── ui/
│   └── controls.ts              # Slider bindings + advanced panel
├── main.ts                      # App entry, animation loop
├── demo.ts                      # Demo page entry
├── types.ts                     # Shared type definitions
└── style.css                    # Full CSS rewrite
public/
└── pcm-worklet-processor.js     # AudioWorklet (plain JS, separate scope)
index.html                       # Main app
demo.html                        # Demo / parameter exploration page
```

### Guiding Principle: Start From Scratch

The existing codebase is **reference material, not a foundation**. We use it
for ideas (the Lorenz math, the day/night color palette concept) but
fundamentally write everything new. Delete old files early — don't try to
incrementally migrate. The new architecture is different enough that
adapting old code creates more problems than starting clean.

### Files to Delete (do this in Task 1, not last)

- `src/audio/engine.ts` — Tone.js engine replaced by Lyria
- `src/audio/generative.ts` — Euclidean/Markov/L-System no longer needed
- `src/audio/presets.ts` — chord/drum presets no longer needed
- `src/ui/Visualizer.ts` — 2D Canvas replaced by Three.js
- `src/ui/Knob.ts`, `src/ui/Fader.ts`, `src/ui/MacroSlider.ts` — dead code
- `src/main.ts` — will be rewritten entirely (delete, then create fresh)

---

## Task 1: Project Setup & Dependencies

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Modify: `tsconfig.json`
- Create: `.env` (already done)
- Create: `.gitignore` entry for `.env`
- Create: `src/types.ts`

**Step 1: Install new dependencies, remove Tone.js**

Run:
```bash
cd /Users/thomasmiller/personal/music-lounge
npm uninstall tone
npm install @google/genai three postprocessing gsap
npm install -D @types/three vitest
```

**Step 2: Update vite.config.ts for multi-page app**

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: { port: 3000, open: true },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        demo: resolve(__dirname, 'demo.html'),
      },
    },
  },
});
```

**Step 3: Add `.env` to `.gitignore`**

Append to `.gitignore`:
```
.env
.env.local
```

**Step 4: Create shared types file**

```typescript
// src/types.ts

export interface SliderState {
  lightNight: number; // 0 = day, 1 = night
  calmDrive: number;  // 0 = calm, 1 = drive
}

export interface LorenzState {
  x: number;
  y: number;
  z: number;
  nx: number; // normalized 0-1
  ny: number;
  nz: number;
}

export interface WeightedPrompt {
  text: string;
  weight: number;
}

export interface MusicGenConfig {
  temperature: number;
  guidance: number;
  density: number;
  brightness: number;
  topK?: number;
  muteBass?: boolean;
  muteDrums?: boolean;
  musicGenerationMode?: 'QUALITY' | 'DIVERSITY';
}

export interface LyriaParams {
  prompts: WeightedPrompt[];
  config: MusicGenConfig;
}

export interface AudioAnalysis {
  fft: Float32Array;
  waveform: Float32Array;
  lowEnergy: number;   // bass
  midEnergy: number;   // mids
  highEnergy: number;  // highs
}

/**
 * An instrument pole pair — the Lorenz blends between pole A and pole B
 * along one axis. Both are always present but weights shift.
 */
export interface InstrumentAxis {
  axis: 'nx' | 'ny' | 'nz';
  poleA: string;  // prompt text when axis → 0
  poleB: string;  // prompt text when axis → 1
}

/**
 * The base vibe for the main app — one starting sound with
 * Lorenz-driven instrument variety.
 */
export interface SoundPalette {
  foundation: string;           // always-on core prompt
  instrumentAxes: InstrumentAxis[];  // 3 axes of instrument poles
  moodCalmPrompt: string;       // fades in as calmDrive → 0
  moodDrivePrompt: string;      // fades in as calmDrive → 1
  baseConfig: MusicGenConfig;
}

/**
 * Demo-only: a preset schema for A/B testing different tag combos.
 * NOT used in the main app — the main app has one SoundPalette.
 */
export interface DemoSchema {
  id: string;
  name: string;
  description: string;
  palette: SoundPalette;
}
```

**Step 5: Set up Vitest**

Add to `package.json` scripts:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:run": "vitest run"
  }
}
```

**Step 6: Commit**

```bash
git add package.json vite.config.ts .gitignore src/types.ts .env
git commit -m "chore: swap Tone.js for Lyria/Three.js deps, add shared types"
```

---

## Task 2: Audio Worklet Processor

**Files:**
- Create: `public/pcm-worklet-processor.js`
- Create: `src/audio/__tests__/pcm-utils.test.ts`
- Create: `src/audio/pcm-utils.ts`

The AudioWorklet runs in a separate thread and plays streaming PCM audio from a circular buffer. It must be a plain `.js` file in `public/` because the AudioWorklet scope has no bundler access.

**Step 1: Write unit test for PCM decoding**

```typescript
// src/audio/__tests__/pcm-utils.test.ts
import { describe, it, expect } from 'vitest';
import { decodeBase64PCM } from '../pcm-utils';

describe('decodeBase64PCM', () => {
  it('converts base64 16-bit PCM to Float32Array', () => {
    // 16-bit signed PCM: [0, 16384 (0.5), -16384 (-0.5), 32767 (~1.0)]
    // as little-endian bytes: [0x00,0x00, 0x00,0x40, 0x00,0xC0, 0xFF,0x7F]
    const bytes = new Uint8Array([0x00, 0x00, 0x00, 0x40, 0x00, 0xC0, 0xFF, 0x7F]);
    const base64 = btoa(String.fromCharCode(...bytes));

    const result = decodeBase64PCM(base64);

    expect(result).toBeInstanceOf(Float32Array);
    expect(result.length).toBe(4);
    expect(result[0]).toBeCloseTo(0, 4);
    expect(result[1]).toBeCloseTo(0.5, 2);
    expect(result[2]).toBeCloseTo(-0.5, 2);
    expect(result[3]).toBeCloseTo(1.0, 2);
  });

  it('returns empty Float32Array for empty input', () => {
    const result = decodeBase64PCM('');
    expect(result.length).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/audio/__tests__/pcm-utils.test.ts`
Expected: FAIL — module not found

**Step 3: Implement PCM decode utility**

```typescript
// src/audio/pcm-utils.ts

/**
 * Decode base64-encoded 16-bit signed PCM into normalized Float32Array.
 * Lyria outputs 48kHz stereo interleaved (L,R,L,R,...).
 */
export function decodeBase64PCM(base64: string): Float32Array {
  if (!base64) return new Float32Array(0);

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 32768;
  }

  return float32;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/audio/__tests__/pcm-utils.test.ts`
Expected: PASS

**Step 5: Create the AudioWorklet processor**

```javascript
// public/pcm-worklet-processor.js

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
```

**Step 6: Commit**

```bash
git add public/pcm-worklet-processor.js src/audio/pcm-utils.ts src/audio/__tests__/pcm-utils.test.ts
git commit -m "feat: add AudioWorklet PCM player and base64 decode utility"
```

---

## Task 3: Lyria Client Service

**Files:**
- Create: `src/audio/lyria-client.ts`

**Step 1: Implement the Lyria client wrapper**

```typescript
// src/audio/lyria-client.ts
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
    this.session?.setMusicGenerationConfig({ musicGenerationConfig: config });
  }

  close(): void {
    this.session?.close();
    this.session = null;
    this.connected = false;
  }
}
```

**Step 2: Commit**

```bash
git add src/audio/lyria-client.ts
git commit -m "feat: add Lyria client wrapper with dedup and PCM decode"
```

---

## Task 4: Audio Player & Analyzer

**Files:**
- Create: `src/audio/audio-player.ts`

**Step 1: Implement the audio player**

```typescript
// src/audio/audio-player.ts
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
  private fftData: Float32Array = new Float32Array(0);
  private waveformData: Float32Array = new Float32Array(0);

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
```

**Step 2: Commit**

```bash
git add src/audio/audio-player.ts
git commit -m "feat: add AudioPlayer with worklet playback and FFT analysis"
```

---

## Task 5: Lorenz Modulator

**Files:**
- Create: `src/music/lorenz-modulator.ts`
- Create: `src/music/__tests__/lorenz-modulator.test.ts`

**Step 1: Write tests for Lorenz modulator**

```typescript
// src/music/__tests__/lorenz-modulator.test.ts
import { describe, it, expect } from 'vitest';
import { LorenzModulator } from '../lorenz-modulator';

describe('LorenzModulator', () => {
  it('produces normalized values between 0 and 1', () => {
    const lorenz = new LorenzModulator(0.005);
    // Run many steps to traverse the attractor
    for (let i = 0; i < 10000; i++) lorenz.step();
    const state = lorenz.getState();
    expect(state.nx).toBeGreaterThanOrEqual(0);
    expect(state.nx).toBeLessThanOrEqual(1);
    expect(state.ny).toBeGreaterThanOrEqual(0);
    expect(state.ny).toBeLessThanOrEqual(1);
    expect(state.nz).toBeGreaterThanOrEqual(0);
    expect(state.nz).toBeLessThanOrEqual(1);
  });

  it('evolves state over time (not stuck)', () => {
    const lorenz = new LorenzModulator(0.005);
    const states: number[] = [];
    for (let i = 0; i < 100; i++) {
      lorenz.step();
      states.push(lorenz.getState().nx);
    }
    // Should have variation — not all the same value
    const unique = new Set(states.map((v) => v.toFixed(3)));
    expect(unique.size).toBeGreaterThan(5);
  });

  it('returns raw xyz for 3D visualization', () => {
    const lorenz = new LorenzModulator(0.005);
    for (let i = 0; i < 100; i++) lorenz.step();
    const state = lorenz.getState();
    // Raw values should be in classic Lorenz range (not 0-1)
    expect(Math.abs(state.x)).toBeLessThan(50);
    expect(Math.abs(state.y)).toBeLessThan(60);
    expect(state.z).toBeGreaterThan(0);
    expect(state.z).toBeLessThan(55);
  });

  it('speed parameter controls evolution rate', () => {
    const fast = new LorenzModulator(0.01);
    const slow = new LorenzModulator(0.001);

    for (let i = 0; i < 100; i++) {
      fast.step();
      slow.step();
    }

    // Fast should have moved further from initial conditions
    const fastState = fast.getState();
    const slowState = slow.getState();
    const fastDist = Math.abs(fastState.x - 1) + Math.abs(fastState.y - 1);
    const slowDist = Math.abs(slowState.x - 1) + Math.abs(slowState.y - 1);
    expect(fastDist).toBeGreaterThan(slowDist);
  });

  it('getHistory returns position trail', () => {
    const lorenz = new LorenzModulator(0.005, 50);
    for (let i = 0; i < 100; i++) lorenz.step();
    const history = lorenz.getHistory();
    expect(history.length).toBe(50);
    expect(history[0]).toHaveProperty('x');
    expect(history[0]).toHaveProperty('y');
    expect(history[0]).toHaveProperty('z');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/music/__tests__/lorenz-modulator.test.ts`
Expected: FAIL — module not found

**Step 3: Implement the Lorenz modulator**

```typescript
// src/music/lorenz-modulator.ts
import type { LorenzState } from '../types';

interface LorenzPoint {
  x: number;
  y: number;
  z: number;
}

/**
 * Lorenz attractor used as a slow, chaotic modulation source.
 * Outputs normalized 0-1 values for driving Lyria parameters,
 * plus raw xyz for 3D visualization of the attractor trail.
 *
 * Classic parameters: sigma=10, rho=28, beta=8/3
 * With these values, the attractor has two "wings" and the
 * trajectory switches between them unpredictably — creating
 * organic, never-repeating modulation patterns.
 */
export class LorenzModulator {
  private x: number;
  private y: number;
  private z: number;
  private sigma = 10;
  private rho = 28;
  private beta = 8 / 3;
  private dt: number;

  // Position history for 3D trail visualization
  private history: LorenzPoint[] = [];
  private maxHistory: number;

  // Normalization ranges (empirical for classic parameters)
  private static X_RANGE: [number, number] = [-22, 22];
  private static Y_RANGE: [number, number] = [-28, 28];
  private static Z_RANGE: [number, number] = [2, 48];

  /**
   * @param speed - Integration step size. Smaller = slower evolution.
   *                0.0005 = very slow (good for background modulation)
   *                0.005  = moderate (noticeable over ~30 seconds)
   *                0.01   = fast (for testing/demo)
   * @param historyLength - Number of past positions to keep for trail rendering.
   */
  constructor(speed = 0.0005, historyLength = 2000) {
    this.dt = speed;
    this.maxHistory = historyLength;

    // Start near the attractor (avoids transient behavior)
    this.x = 1 + Math.random() * 2;
    this.y = 1 + Math.random() * 2;
    this.z = 20 + Math.random() * 5;
  }

  /**
   * Advance one integration step using Euler method.
   * Call once per animation frame for smooth evolution.
   */
  step(): void {
    const dx = this.sigma * (this.y - this.x);
    const dy = this.x * (this.rho - this.z) - this.y;
    const dz = this.x * this.y - this.beta * this.z;

    this.x += dx * this.dt;
    this.y += dy * this.dt;
    this.z += dz * this.dt;

    // Record for trail visualization
    this.history.push({ x: this.x, y: this.y, z: this.z });
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }

  /**
   * Get current state with both raw and normalized values.
   */
  getState(): LorenzState {
    return {
      x: this.x,
      y: this.y,
      z: this.z,
      nx: this.normalize(this.x, LorenzModulator.X_RANGE),
      ny: this.normalize(this.y, LorenzModulator.Y_RANGE),
      nz: this.normalize(this.z, LorenzModulator.Z_RANGE),
    };
  }

  /**
   * Get the position history for 3D trail rendering.
   * Oldest points first, newest last.
   */
  getHistory(): LorenzPoint[] {
    return this.history;
  }

  setSpeed(speed: number): void {
    this.dt = speed;
  }

  private normalize(value: number, [min, max]: [number, number]): number {
    return Math.max(0, Math.min(1, (value - min) / (max - min)));
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/music/__tests__/lorenz-modulator.test.ts`
Expected: PASS (all 5 tests)

**Step 5: Commit**

```bash
git add src/music/lorenz-modulator.ts src/music/__tests__/lorenz-modulator.test.ts
git commit -m "feat: add Lorenz modulator with history trail for 3D viz"
```

---

## Task 6: Sound Palette & Demo Schemas

**Files:**
- Create: `src/music/sound-palette.ts` (main app — ONE base vibe)
- Create: `src/music/demo-schemas.ts` (demo page only — 10 presets for A/B testing)

### Design Philosophy

The main app has **one sound**. No schema picker, no presets, no modes.
You enter the lounge and it plays. The sliders shift the feel (config scalars).
The Lorenz shifts what you hear (instrument prompts). That's it.

The **demo page** has 10 different palettes so the user can find the right
starting point during development. Once chosen, those values become the
single `SOUND_PALETTE` in the main app.

### Step 1: Create the main app sound palette

```typescript
// src/music/sound-palette.ts
import type { SoundPalette } from '../types';

/**
 * The single base vibe for Music Lounge.
 *
 * SLIDERS control scalar config (density, brightness, etc.)
 * LORENZ controls which instruments are prominent via 3 axis poles:
 *   - Each axis has two instrument groups (pole A ↔ pole B)
 *   - The Lorenz position determines the blend between them
 *   - As the attractor wanders its butterfly, instruments fade in/out
 *
 * The result: music that slowly, unpredictably morphs its sonic palette
 * while maintaining a consistent overall mood set by the sliders.
 */
export const SOUND_PALETTE: SoundPalette = {
  // Always-on core identity — keeps everything electronic/ambient
  foundation: 'Electronic, Ambient, Synth',

  // Lorenz-driven instrument poles (3 axes × 2 poles = 6 prompt groups)
  instrumentAxes: [
    {
      axis: 'nx',
      poleA: 'Synth Pads, Sustained Chords',        // warm, sustained, pad-heavy
      poleB: 'Moog Oscillations, Buchla Synths',     // analog, textural, modular
    },
    {
      axis: 'ny',
      poleA: 'Rhodes Piano, Smooth Pianos, Harp',    // melodic, gentle, keys
      poleB: 'Dirty Synths, 303 Acid Bass',          // gritty, analog, bassy
    },
    {
      axis: 'nz',
      poleA: 'Spacey Synths, Echo, Swirling Phasers', // spacious, effects-heavy
      poleB: 'Kalimba, Hang Drum, Vibraphone',        // percussive, organic, tonal
    },
  ],

  // Minimal mood hints from the calm↔drive slider
  // These are the ONLY slider-driven prompt text. Everything else is config.
  moodCalmPrompt: 'Chill, Subdued Melody',
  moodDrivePrompt: 'Danceable, Tight Groove',

  // Base config — sliders shift these on a spectrum
  baseConfig: {
    temperature: 1.1,
    guidance: 3.5,
    density: 0.2,
    brightness: 0.55,
  },
};

/**
 * Session randomness — call once on app start.
 * Returns a slight variation of the base config for variety across sessions.
 */
export function randomizeSession(base: SoundPalette): SoundPalette {
  const jitter = (v: number, range: number) => v + (Math.random() - 0.5) * range;
  return {
    ...base,
    baseConfig: {
      ...base.baseConfig,
      temperature: jitter(base.baseConfig.temperature, 0.2),
      guidance: jitter(base.baseConfig.guidance, 0.4),
      brightness: jitter(base.baseConfig.brightness, 0.1),
    },
  };
}
```

### Step 2: Create the demo schemas (demo page only)

```typescript
// src/music/demo-schemas.ts
import type { DemoSchema } from '../types';

/**
 * 10 demo-only palettes for A/B testing different instrument combinations.
 * Each explores a different sonic identity. Once you find the right one,
 * copy its values into sound-palette.ts as the permanent SOUND_PALETTE.
 *
 * NOT imported by the main app — only by demo.ts.
 */
export const DEMO_SCHEMAS: DemoSchema[] = [
  {
    id: 'ethereal-drift',
    name: 'Ethereal Drift',
    description: 'Floating ambient pads with shimmering high-end. The most minimal, meditative option.',
    palette: {
      foundation: 'Electronic, Ambient, Synth',
      instrumentAxes: [
        { axis: 'nx', poleA: 'Synth Pads, Sustained Chords', poleB: 'Spacey Synths, Echo' },
        { axis: 'ny', poleA: 'Smooth Pianos, Harp', poleB: 'Mellotron, Vibraphone' },
        { axis: 'nz', poleA: 'Ethereal Ambience, Dreamy', poleB: 'Kalimba, Hang Drum' },
      ],
      moodCalmPrompt: 'Chill, Subdued Melody',
      moodDrivePrompt: 'Upbeat, Bright Tones',
      baseConfig: { temperature: 1.2, guidance: 3.5, density: 0.15, brightness: 0.7 },
    },
  },
  {
    id: 'midnight-pulse',
    name: 'Midnight Pulse',
    description: 'Deep house rhythms with warm sub bass. Gets groovy at high drive.',
    palette: {
      foundation: 'Electronic, Deep House, Synth',
      instrumentAxes: [
        { axis: 'nx', poleA: 'Synth Pads, Sustained Chords', poleB: 'TR-909 Drum Machine, Fat Beats' },
        { axis: 'ny', poleA: 'Rhodes Piano, Smooth Pianos', poleB: 'Boomy Bass, 303 Acid Bass' },
        { axis: 'nz', poleA: 'Swirling Phasers, Echo', poleB: 'Funk Drums, Tight Groove' },
      ],
      moodCalmPrompt: 'Chill, Subdued Melody, Lo-fi',
      moodDrivePrompt: 'Danceable, Tight Groove, Fat Beats',
      baseConfig: { temperature: 1.0, guidance: 4.0, density: 0.4, brightness: 0.45 },
    },
  },

  {
    id: 'analog-warmth',
    name: 'Analog Warmth',
    description: 'Moog oscillators and lo-fi textures. Vintage synth character with gentle movement.',
    palette: {
      foundation: 'Electronic, Lo-fi, Synth',
      instrumentAxes: [
        { axis: 'nx', poleA: 'Moog Oscillations, Warm', poleB: 'Buchla Synths, Experimental' },
        { axis: 'ny', poleA: 'Rhodes Piano, Mellotron', poleB: 'Dirty Synths, Crunchy Distortion' },
        { axis: 'nz', poleA: 'Smooth Pianos, Sustained Chords', poleB: 'Spacey Synths, Swirling Phasers' },
      ],
      moodCalmPrompt: 'Chill, Subdued Melody',
      moodDrivePrompt: 'Funky, Tight Groove',
      baseConfig: { temperature: 1.1, guidance: 3.8, density: 0.3, brightness: 0.5 },
    },
  },

  {
    id: 'crystal-caverns',
    name: 'Crystal Caverns',
    description: 'Sparkling melodic textures with harp and glockenspiel. Bright and airy.',
    palette: {
      foundation: 'Electronic, Ethereal Ambience, Bright Tones',
      instrumentAxes: [
        { axis: 'nx', poleA: 'Glockenspiel, Harp', poleB: 'Vibraphone, Marimba' },
        { axis: 'ny', poleA: 'Smooth Pianos, Celesta', poleB: 'Kalimba, Hang Drum' },
        { axis: 'nz', poleA: 'Echo, Spacey Synths', poleB: 'Synth Pads, Sustained Chords' },
      ],
      moodCalmPrompt: 'Chill, Dreamy',
      moodDrivePrompt: 'Upbeat, Danceable',
      baseConfig: { temperature: 1.3, guidance: 3.0, density: 0.15, brightness: 0.8 },
    },
  },

  {
    id: 'neon-groove',
    name: 'Neon Groove',
    description: 'Synthpop and acid bass. The most energetic option — great for drive mode.',
    palette: {
      foundation: 'Electronic, Synthpop, Synth',
      instrumentAxes: [
        { axis: 'nx', poleA: 'Synth Pads, Bright Tones', poleB: '303 Acid Bass, Dirty Synths' },
        { axis: 'ny', poleA: 'Smooth Pianos, Warm', poleB: 'TR-909 Drum Machine, Fat Beats' },
        { axis: 'nz', poleA: 'Swirling Phasers, Glitchy Effects', poleB: 'Funk Drums, Tight Groove' },
      ],
      moodCalmPrompt: 'Chill, Synth Pads',
      moodDrivePrompt: 'Danceable, Fat Beats',
      baseConfig: { temperature: 1.0, guidance: 4.5, density: 0.55, brightness: 0.6 },
    },
  },

  {
    id: 'ocean-floor',
    name: 'Ocean Floor',
    description: 'Deep ambient with spacious reverb. Extremely minimal — barely there at calm.',
    palette: {
      foundation: 'Electronic, Ambient, Synth',
      instrumentAxes: [
        { axis: 'nx', poleA: 'Spacey Synths, Sustained Chords', poleB: 'Ominous Drone, Psychedelic' },
        { axis: 'ny', poleA: 'Smooth Pianos, Warm Acoustic Guitar', poleB: 'Cello, Crunchy Distortion' },
        { axis: 'nz', poleA: 'Echo, Ethereal Ambience', poleB: 'Weird Noises, Unsettling' },
      ],
      moodCalmPrompt: 'Chill, Subdued Melody',
      moodDrivePrompt: 'Psychedelic, Echo',
      baseConfig: { temperature: 1.4, guidance: 3.0, density: 0.08, brightness: 0.35 },
    },
  },

  {
    id: 'desert-dawn',
    name: 'Desert Dawn',
    description: 'World-tinged ambient with kalimba and sitar. Warm, organic, percussive.',
    palette: {
      foundation: 'Electronic, Ambient, Chill',
      instrumentAxes: [
        { axis: 'nx', poleA: 'Kalimba, Sitar', poleB: 'Hang Drum, Didgeridoo' },
        { axis: 'ny', poleA: 'Warm Acoustic Guitar, Harp', poleB: 'Tabla, Mbira' },
        { axis: 'nz', poleA: 'Synth Pads, Ethereal Ambience', poleB: 'Ocarina, Vibraphone' },
      ],
      moodCalmPrompt: 'Chill, Sustained Chords',
      moodDrivePrompt: 'Tight Groove, Danceable',
      baseConfig: { temperature: 1.2, guidance: 3.5, density: 0.25, brightness: 0.65 },
    },
  },

  {
    id: 'vapor-lounge',
    name: 'Vapor Lounge',
    description: 'Vaporwave aesthetics with smooth Rhodes piano. Nostalgic, hazy, cool.',
    palette: {
      foundation: 'Electronic, Vaporwave, Lo-fi',
      instrumentAxes: [
        { axis: 'nx', poleA: 'Smooth Pianos, Rhodes Piano', poleB: 'Synth Pads, Mellotron' },
        { axis: 'ny', poleA: 'Harpsichord, Warm', poleB: 'Dirty Synths, Saturated Tones' },
        { axis: 'nz', poleA: 'Spacey Synths, Echo', poleB: 'Funk Drums, Funky' },
      ],
      moodCalmPrompt: 'Chill, Sustained Chords',
      moodDrivePrompt: 'Funky, Danceable',
      baseConfig: { temperature: 1.1, guidance: 4.0, density: 0.3, brightness: 0.5 },
    },
  },

  {
    id: 'orbital',
    name: 'Orbital',
    description: 'Trance-influenced synths with swirling modulation. Hypnotic, layered.',
    palette: {
      foundation: 'Electronic, Trance, Synth',
      instrumentAxes: [
        { axis: 'nx', poleA: 'Buchla Synths, Synth Pads', poleB: 'Moog Oscillations, 303 Acid Bass' },
        { axis: 'ny', poleA: 'Spacey Synths, Ethereal Ambience', poleB: 'Glitchy Effects, Weird Noises' },
        { axis: 'nz', poleA: 'Swirling Phasers, Psychedelic', poleB: 'Sustained Chords, Smooth Pianos' },
      ],
      moodCalmPrompt: 'Ambient, Ethereal Ambience',
      moodDrivePrompt: 'Danceable, Tight Groove',
      baseConfig: { temperature: 1.0, guidance: 4.2, density: 0.4, brightness: 0.55 },
    },
  },

  {
    id: 'deep-meditation',
    name: 'Deep Meditation',
    description: 'Drone-heavy with hang drum overtones. The deepest, most hypnotic option.',
    palette: {
      foundation: 'Electronic, Ambient, Ominous Drone',
      instrumentAxes: [
        { axis: 'nx', poleA: 'Hang Drum, Singing Bowl', poleB: 'Didgeridoo, Cello' },
        { axis: 'ny', poleA: 'Synth Pads, Sustained Chords', poleB: 'Psychedelic, Unsettling' },
        { axis: 'nz', poleA: 'Ethereal Ambience, Spacey Synths', poleB: 'Kalimba, Warm' },
      ],
      moodCalmPrompt: 'Chill, Subdued Melody',
      moodDrivePrompt: 'Tight Groove, Danceable',
      baseConfig: { temperature: 1.5, guidance: 2.5, density: 0.08, brightness: 0.3 },
    },
  },
];
```

### Step 3: Commit

```bash
git add src/music/sound-palette.ts src/music/demo-schemas.ts
git commit -m "feat: add sound palette (main app) + 10 demo schemas for A/B testing"
```

---

## Task 7: Parameter Engine with Smoothing

**Files:**
- Create: `src/music/param-engine.ts`
- Create: `src/music/__tests__/param-engine.test.ts`

### Design

The key architectural insight: **nothing changes instantly.**

Every value passes through a `SmoothedValue` that lerps toward its target.
When you snap a slider, the density eases over ~1.5 seconds. When the Lorenz
crosses a wing boundary, instruments cross-fade over ~3 seconds. The music
never jumps.

**Separation of concerns:**
- **Sliders** → config scalars (density, brightness, temperature, guidance) + one minimal mood prompt
- **Lorenz** → instrument prompt weights (3 axes × 2 poles = 6 instrument groups blending)
- Both go through the smoother before being sent to Lyria

**Step 1: Write tests**

```typescript
// src/music/__tests__/param-engine.test.ts
import { describe, it, expect } from 'vitest';
import { ParamEngine, SmoothedValue } from '../param-engine';
import { SOUND_PALETTE } from '../sound-palette';

describe('SmoothedValue', () => {
  it('starts at initial value', () => {
    const sv = new SmoothedValue(0.5, 0.1);
    expect(sv.current).toBe(0.5);
  });

  it('moves toward target over ticks', () => {
    const sv = new SmoothedValue(0, 0.5); // aggressive alpha for test
    sv.set(1.0);
    sv.tick();
    expect(sv.current).toBeGreaterThan(0);
    expect(sv.current).toBeLessThan(1);
    // After many ticks, should be very close to target
    for (let i = 0; i < 50; i++) sv.tick();
    expect(sv.current).toBeCloseTo(1.0, 2);
  });

  it('never overshoots', () => {
    const sv = new SmoothedValue(0, 0.3);
    sv.set(1.0);
    for (let i = 0; i < 100; i++) {
      sv.tick();
      expect(sv.current).toBeLessThanOrEqual(1.0);
      expect(sv.current).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('ParamEngine', () => {
  it('produces prompts with positive weights', () => {
    const engine = new ParamEngine(SOUND_PALETTE);
    engine.setTargets(
      { lightNight: 0.5, calmDrive: 0.5 },
      { x: 0, y: 0, z: 25, nx: 0.5, ny: 0.5, nz: 0.5 },
    );
    // Tick many times to reach targets
    for (let i = 0; i < 200; i++) engine.tick();
    const params = engine.getSmoothedParams();
    expect(params.prompts.length).toBeGreaterThan(0);
    for (const p of params.prompts) {
      expect(p.weight).toBeGreaterThan(0);
    }
  });

  it('config density increases with calmDrive', () => {
    const calm = new ParamEngine(SOUND_PALETTE);
    calm.setTargets(
      { lightNight: 0.5, calmDrive: 0 },
      { x: 0, y: 0, z: 25, nx: 0.5, ny: 0.5, nz: 0.5 },
    );
    for (let i = 0; i < 200; i++) calm.tick();

    const drive = new ParamEngine(SOUND_PALETTE);
    drive.setTargets(
      { lightNight: 0.5, calmDrive: 1 },
      { x: 0, y: 0, z: 25, nx: 0.5, ny: 0.5, nz: 0.5 },
    );
    for (let i = 0; i < 200; i++) drive.tick();

    expect(drive.getSmoothedParams().config.density)
      .toBeGreaterThan(calm.getSmoothedParams().config.density);
  });

  it('all config values stay within Lyria valid ranges at extremes', () => {
    const engine = new ParamEngine(SOUND_PALETTE);
    engine.setTargets(
      { lightNight: 1, calmDrive: 1 },
      { x: 20, y: 25, z: 48, nx: 1, ny: 1, nz: 1 },
    );
    for (let i = 0; i < 200; i++) engine.tick();
    const { config } = engine.getSmoothedParams();
    expect(config.density).toBeGreaterThanOrEqual(0);
    expect(config.density).toBeLessThanOrEqual(1);
    expect(config.brightness).toBeGreaterThanOrEqual(0);
    expect(config.brightness).toBeLessThanOrEqual(1);
    expect(config.temperature).toBeGreaterThanOrEqual(0);
    expect(config.temperature).toBeLessThanOrEqual(3);
    expect(config.guidance).toBeGreaterThanOrEqual(0);
    expect(config.guidance).toBeLessThanOrEqual(6);
  });

  it('Lorenz axes produce different instrument blends', () => {
    // With nx=0 vs nx=1, we should get different prompt sets
    const engineA = new ParamEngine(SOUND_PALETTE);
    engineA.setTargets(
      { lightNight: 0.5, calmDrive: 0.5 },
      { x: -20, y: 0, z: 25, nx: 0, ny: 0.5, nz: 0.5 },
    );
    for (let i = 0; i < 200; i++) engineA.tick();

    const engineB = new ParamEngine(SOUND_PALETTE);
    engineB.setTargets(
      { lightNight: 0.5, calmDrive: 0.5 },
      { x: 20, y: 0, z: 25, nx: 1, ny: 0.5, nz: 0.5 },
    );
    for (let i = 0; i < 200; i++) engineB.tick();

    const textsA = engineA.getSmoothedParams().prompts.map(p => p.text).join(',');
    const textsB = engineB.getSmoothedParams().prompts.map(p => p.text).join(',');
    // Same prompts present but different weights
    expect(textsA).not.toBe(textsB);
  });

  it('shouldSend rate limits to ~500ms', () => {
    const engine = new ParamEngine(SOUND_PALETTE);
    expect(engine.shouldSend()).toBe(true);
    expect(engine.shouldSend()).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/music/__tests__/param-engine.test.ts`
Expected: FAIL — module not found

**Step 3: Implement the smoothed parameter engine**

```typescript
// src/music/param-engine.ts
import type { SliderState, LorenzState, LyriaParams, WeightedPrompt, MusicGenConfig, SoundPalette } from '../types';

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * A value that smoothly interpolates toward a target.
 * Used to prevent abrupt changes in music parameters.
 */
export class SmoothedValue {
  current: number;
  private target: number;
  private alpha: number;

  /**
   * @param initial Starting value
   * @param alpha Lerp speed per tick (0.01 = very slow ~3s, 0.05 = moderate ~1s, 0.2 = fast)
   */
  constructor(initial: number, alpha = 0.03) {
    this.current = initial;
    this.target = initial;
    this.alpha = alpha;
  }

  set(target: number): void {
    this.target = target;
  }

  tick(): number {
    this.current += (this.target - this.current) * this.alpha;
    return this.current;
  }

  snap(value: number): void {
    this.current = value;
    this.target = value;
  }
}

/**
 * Manages a set of named prompts with smoothed weights.
 * Prompts fade in/out gracefully — never jump.
 */
class SmoothedPromptSet {
  private weights = new Map<string, SmoothedValue>();
  private alpha: number;

  constructor(alpha = 0.02) {
    this.alpha = alpha;
  }

  setTargets(prompts: WeightedPrompt[]): void {
    const targetTexts = new Set(prompts.map(p => p.text));

    // Fade out prompts not in target
    for (const [text, sv] of this.weights) {
      if (!targetTexts.has(text)) sv.set(0);
    }

    // Set targets for all requested prompts
    for (const { text, weight } of prompts) {
      if (!this.weights.has(text)) {
        this.weights.set(text, new SmoothedValue(0, this.alpha));
      }
      this.weights.get(text)!.set(weight);
    }
  }

  tick(): WeightedPrompt[] {
    const result: WeightedPrompt[] = [];
    const toDelete: string[] = [];

    for (const [text, sv] of this.weights) {
      const w = sv.tick();
      if (w > 0.02) {
        result.push({ text, weight: w });
      } else if (Math.abs(w) < 0.005) {
        toDelete.push(text); // fully faded out, clean up
      }
    }

    for (const text of toDelete) this.weights.delete(text);
    return result;
  }
}

/**
 * The brain of the music system.
 *
 * SLIDERS → config scalars (density, brightness, temperature, guidance)
 *           + one minimal mood prompt (calm ↔ drive)
 * LORENZ  → instrument prompt weights (3 axes × 2 poles each)
 *
 * Everything passes through smoothers so the music never jumps.
 * Call setTargets() when inputs change, tick() every frame,
 * and getSmoothedParams() when ready to send to Lyria.
 */
export class ParamEngine {
  private palette: SoundPalette;

  // Smoothed config scalars
  private density: SmoothedValue;
  private brightness: SmoothedValue;
  private temperature: SmoothedValue;
  private guidance: SmoothedValue;

  // Smoothed prompt weights
  private prompts: SmoothedPromptSet;

  // Rate limiter
  private lastSendTime = 0;
  private sendInterval = 500;

  constructor(palette: SoundPalette) {
    this.palette = palette;
    const bc = palette.baseConfig;
    this.density = new SmoothedValue(bc.density, 0.03);
    this.brightness = new SmoothedValue(bc.brightness, 0.03);
    this.temperature = new SmoothedValue(bc.temperature, 0.02);
    this.guidance = new SmoothedValue(bc.guidance, 0.02);
    this.prompts = new SmoothedPromptSet(0.02);
  }

  /**
   * Update targets from current slider + Lorenz state.
   * Call whenever sliders change or Lorenz steps (every frame is fine).
   */
  setTargets(sliders: SliderState, lorenz: LorenzState): void {
    const { lightNight, calmDrive } = sliders;
    const { nx, ny, nz } = lorenz;
    const bc = this.palette.baseConfig;

    // ── Config targets from sliders ──
    // Sliders shift config on a smooth spectrum — no discrete states
    this.density.set(clamp(bc.density + calmDrive * 0.5, 0, 1));
    this.brightness.set(clamp(bc.brightness - lightNight * 0.3, 0, 1));
    this.temperature.set(clamp(bc.temperature + calmDrive * 0.25, 0.1, 3.0));
    this.guidance.set(clamp(bc.guidance + calmDrive * 0.8, 0.5, 6.0));

    // ── Prompt targets ──
    const targetPrompts: WeightedPrompt[] = [];

    // Foundation: always present
    targetPrompts.push({ text: this.palette.foundation, weight: 1.0 });

    // Mood hint from calm/drive slider (minimal — just one prompt shifting)
    const calmW = 1 - calmDrive;
    const driveW = calmDrive;
    if (calmW > 0.1) {
      targetPrompts.push({ text: this.palette.moodCalmPrompt, weight: calmW * 0.6 });
    }
    if (driveW > 0.1) {
      targetPrompts.push({ text: this.palette.moodDrivePrompt, weight: driveW * 0.6 });
    }

    // Instrument axes from Lorenz — THIS is where variety comes from.
    // Each axis blends between two instrument poles.
    // When nx=0: pole A fully weighted. When nx=1: pole B fully weighted.
    // At 0.5: both equally present.
    for (const axis of this.palette.instrumentAxes) {
      const v = lorenz[axis.axis]; // 0-1
      const weightA = (1 - v) * 0.7; // max 0.7 to keep foundation dominant
      const weightB = v * 0.7;
      if (weightA > 0.05) targetPrompts.push({ text: axis.poleA, weight: weightA });
      if (weightB > 0.05) targetPrompts.push({ text: axis.poleB, weight: weightB });
    }

    this.prompts.setTargets(targetPrompts);
  }

  /**
   * Advance all smoothers by one step.
   * Call once per animation frame (~60fps).
   */
  tick(): void {
    this.density.tick();
    this.brightness.tick();
    this.temperature.tick();
    this.guidance.tick();
    this.prompts.tick();
  }

  /**
   * Get the current smoothed params, ready to send to Lyria.
   */
  getSmoothedParams(): LyriaParams {
    return {
      prompts: this.prompts.tick(), // returns current smoothed weights
      config: {
        density: clamp(this.density.current, 0, 1),
        brightness: clamp(this.brightness.current, 0, 1),
        temperature: clamp(this.temperature.current, 0.1, 3.0),
        guidance: clamp(this.guidance.current, 0.5, 6.0),
      },
    };
  }

  /**
   * Rate limiter — returns true at most once per sendInterval.
   */
  shouldSend(): boolean {
    const now = Date.now();
    if (now - this.lastSendTime >= this.sendInterval) {
      this.lastSendTime = now;
      return true;
    }
    return false;
  }

  setSendInterval(ms: number): void {
    this.sendInterval = ms;
  }

  /**
   * Swap the palette (e.g., from demo page).
   * Snaps config to new base values to avoid long drift.
   */
  setPalette(palette: SoundPalette): void {
    this.palette = palette;
    const bc = palette.baseConfig;
    this.density.snap(bc.density);
    this.brightness.snap(bc.brightness);
    this.temperature.snap(bc.temperature);
    this.guidance.snap(bc.guidance);
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/music/__tests__/param-engine.test.ts`
Expected: PASS (all 6 tests)

**Step 5: Commit**

```bash
git add src/music/param-engine.ts src/music/__tests__/param-engine.test.ts
git commit -m "feat: add smoothed ParamEngine — sliders→config, Lorenz→instruments"
```

---

## Task 8: Three.js Visualization System

This is the largest task — it creates the entire 3D scene. Broken into sub-steps for manageability.

**Files:**
- Create: `src/viz/scene.ts`
- Create: `src/viz/sky.ts`
- Create: `src/viz/particles.ts`
- Create: `src/viz/lorenz-viz.ts`
- Create: `src/viz/effects.ts`

### Step 1: Scene Manager

```typescript
// src/viz/scene.ts
import * as THREE from 'three';
import { EffectComposer } from 'postprocessing';
import { SkySystem } from './sky';
import { ParticleSystem } from './particles';
import { LorenzViz } from './lorenz-viz';
import { createEffectComposer } from './effects';
import type { AudioAnalysis, LorenzState, SliderState } from '../types';

/**
 * Top-level Three.js scene manager. Creates and orchestrates all
 * visual layers: sky, particles, Lorenz trail, and postprocessing.
 */
export class SceneManager {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private composer: EffectComposer;

  private sky: SkySystem;
  private particles: ParticleSystem;
  private lorenzViz: LorenzViz;

  // Smooth breathing camera drift
  private cameraTime = 0;

  constructor(canvas: HTMLCanvasElement) {
    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.5;

    // Scene
    this.scene = new THREE.Scene();

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      60,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      10000,
    );
    this.camera.position.set(0, 5, 35);
    this.camera.lookAt(0, 8, 0);

    // Sub-systems
    this.sky = new SkySystem(this.scene);
    this.particles = new ParticleSystem(this.scene);
    this.lorenzViz = new LorenzViz(this.scene);

    // Postprocessing
    this.composer = createEffectComposer(this.renderer, this.scene, this.camera);

    // Handle resize
    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());
  }

  private handleResize(): void {
    const canvas = this.renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
  }

  /**
   * Called every animation frame.
   */
  update(
    sliders: SliderState,
    lorenz: LorenzState,
    audio: AudioAnalysis,
    dt: number,
  ): void {
    // Gentle camera breathing
    this.cameraTime += dt * 0.15;
    this.camera.position.y = 5 + Math.sin(this.cameraTime) * 0.3;
    this.camera.position.x = Math.sin(this.cameraTime * 0.7) * 0.5;

    // Update sub-systems
    this.sky.update(sliders.lightNight, audio);
    this.particles.update(sliders, audio, dt);
    this.lorenzViz.update(lorenz);

    // Render with postprocessing
    this.composer.render(dt);
  }

  /**
   * Update bloom intensity based on audio energy.
   * Called from effects module.
   */
  setBloomIntensity(intensity: number): void {
    // This will be wired up in effects.ts
  }

  dispose(): void {
    this.sky.dispose();
    this.particles.dispose();
    this.lorenzViz.dispose();
    this.renderer.dispose();
  }
}
```

### Step 2: Sky System (Sunrise → Moonrise)

```typescript
// src/viz/sky.ts
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import type { AudioAnalysis } from '../types';

/**
 * Day/night sky system using Three.js physically-based Sky shader.
 * Maps lightNight (0=day, 1=night) to sun elevation, creating
 * natural sunrise/sunset/moonrise transitions.
 *
 * Layers:
 * - Sky shader sphere (atmosphere scattering)
 * - Star field (fades in at night)
 * - Sun orb (emissive mesh, tracks sky sun position)
 * - Moon orb (opposite side, fades in at night)
 */
export class SkySystem {
  private sky: Sky;
  private sunPosition = new THREE.Vector3();
  private stars: THREE.Points;
  private sunMesh: THREE.Mesh;
  private moonMesh: THREE.Mesh;
  private starMaterial: THREE.PointsMaterial;
  private sunMaterial: THREE.MeshBasicMaterial;
  private moonMaterial: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene) {
    // ── Sky shader ──
    this.sky = new Sky();
    this.sky.scale.setScalar(5000);
    scene.add(this.sky);

    const uniforms = this.sky.material.uniforms;
    uniforms['turbidity'].value = 2.5;
    uniforms['rayleigh'].value = 1.5;
    uniforms['mieCoefficient'].value = 0.005;
    uniforms['mieDirectionalG'].value = 0.75;

    // ── Stars ──
    const starCount = 1500;
    const starPositions = new Float32Array(starCount * 3);
    const starSizes = new Float32Array(starCount);
    for (let i = 0; i < starCount; i++) {
      // Distribute on a sphere
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 2000 + Math.random() * 500;
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = Math.abs(r * Math.cos(phi)); // upper hemisphere
      starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      starSizes[i] = Math.random() * 2 + 0.5;
    }
    const starGeom = new THREE.BufferGeometry();
    starGeom.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeom.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));
    this.starMaterial = new THREE.PointsMaterial({
      color: 0xCCD8FF,
      size: 1.5,
      transparent: true,
      opacity: 0,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.stars = new THREE.Points(starGeom, this.starMaterial);
    scene.add(this.stars);

    // ── Sun orb ──
    this.sunMaterial = new THREE.MeshBasicMaterial({
      color: 0xFFE4B5,
      transparent: true,
      opacity: 1,
    });
    this.sunMesh = new THREE.Mesh(
      new THREE.SphereGeometry(8, 32, 32),
      this.sunMaterial,
    );
    scene.add(this.sunMesh);

    // ── Moon orb ──
    this.moonMaterial = new THREE.MeshBasicMaterial({
      color: 0xD4E5FF,
      transparent: true,
      opacity: 0,
    });
    this.moonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(5, 32, 32),
      this.moonMaterial,
    );
    scene.add(this.moonMesh);
  }

  update(lightNight: number, audio: AudioAnalysis): void {
    // ── Sun elevation from lightNight ──
    // 0.0 → 55° (bright day)
    // 0.3 → 12° (golden hour)
    // 0.5 → -2° (just below horizon)
    // 1.0 → -30° (deep night)
    const elevation = 55 - lightNight * 85;
    const azimuth = -135 + lightNight * 90; // sun moves across sky

    const phi = THREE.MathUtils.degToRad(90 - elevation);
    const theta = THREE.MathUtils.degToRad(azimuth);
    this.sunPosition.setFromSphericalCoords(1, phi, theta);
    this.sky.material.uniforms['sunPosition'].value.copy(this.sunPosition);

    // ── Sky tuning based on time of day ──
    const uniforms = this.sky.material.uniforms;
    // Increase rayleigh during golden hour for richer colors
    const goldenFactor = 1 - Math.abs(lightNight - 0.35) * 3;
    uniforms['rayleigh'].value = 1.5 + Math.max(0, goldenFactor) * 2;
    uniforms['mieCoefficient'].value = 0.005 + Math.max(0, goldenFactor) * 0.01;
    // Exposure: brighter during day
    uniforms['turbidity'].value = 2.5 - lightNight * 1.5;

    // ── Sun orb position and visibility ──
    const sunDir = this.sunPosition.clone().normalize();
    this.sunMesh.position.copy(sunDir.multiplyScalar(800));
    this.sunMaterial.opacity = Math.max(0, 1 - lightNight * 2);
    // Audio reactive: bass makes sun pulse slightly
    const sunScale = 1 + audio.lowEnergy * 0.15;
    this.sunMesh.scale.setScalar(sunScale);

    // ── Moon position (opposite side) and visibility ──
    const moonElevation = -55 + lightNight * 85;
    const moonPhi = THREE.MathUtils.degToRad(90 - moonElevation);
    const moonTheta = THREE.MathUtils.degToRad(azimuth + 180);
    const moonDir = new THREE.Vector3().setFromSphericalCoords(1, moonPhi, moonTheta).normalize();
    this.moonMesh.position.copy(moonDir.multiplyScalar(900));
    this.moonMaterial.opacity = Math.max(0, lightNight * 2 - 0.8);

    // ── Stars: fade in during night ──
    // Start appearing at lightNight > 0.45
    const starOpacity = Math.max(0, (lightNight - 0.45) / 0.55);
    this.starMaterial.opacity = starOpacity * 0.8;
    // Subtle twinkle via slight rotation
    this.stars.rotation.y += 0.00003;
  }

  dispose(): void {
    this.sky.geometry.dispose();
    (this.sky.material as THREE.ShaderMaterial).dispose();
    this.stars.geometry.dispose();
    this.starMaterial.dispose();
    this.sunMesh.geometry.dispose();
    this.sunMaterial.dispose();
    this.moonMesh.geometry.dispose();
    this.moonMaterial.dispose();
  }
}
```

### Step 3: Environmental Particles

```typescript
// src/viz/particles.ts
import * as THREE from 'three';
import type { SliderState, AudioAnalysis } from '../types';

/**
 * Environmental particle system that shifts character with day/night:
 * - Day: warm dust motes / pollen drifting upward in sunlight
 * - Night: cool fireflies / tiny stars drifting gently
 *
 * Particles are audio-reactive: bass energy affects drift speed,
 * high energy affects twinkle rate.
 */
export class ParticleSystem {
  private points: THREE.Points;
  private geometry: THREE.BufferGeometry;
  private material: THREE.PointsMaterial;
  private count: number;
  private velocities: Float32Array;
  private phases: Float32Array;
  private sizes: Float32Array;
  private time = 0;

  constructor(scene: THREE.Scene, count = 300) {
    this.count = count;

    const positions = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);
    this.phases = new Float32Array(count);
    this.sizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Spread particles in a box around the camera
      positions[i * 3] = (Math.random() - 0.5) * 80;
      positions[i * 3 + 1] = Math.random() * 50 - 5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 60 - 10;

      this.velocities[i * 3] = (Math.random() - 0.5) * 0.02;
      this.velocities[i * 3 + 1] = Math.random() * 0.015 + 0.003;
      this.velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.01;

      this.phases[i] = Math.random() * Math.PI * 2;
      this.sizes[i] = Math.random() * 0.3 + 0.1;
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    this.material = new THREE.PointsMaterial({
      color: 0xFFE8C8,
      size: 0.3,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    scene.add(this.points);
  }

  update(sliders: SliderState, audio: AudioAnalysis, dt: number): void {
    this.time += dt;
    const positions = this.geometry.attributes.position.array as Float32Array;
    const { lightNight, calmDrive } = sliders;

    // Color shift: warm gold (day) → cool blue-white (night)
    const r = 1.0 - lightNight * 0.4;
    const g = 0.91 - lightNight * 0.15;
    const b = 0.78 + lightNight * 0.22;
    this.material.color.setRGB(r, g, b);

    // Opacity and size affected by audio
    this.material.opacity = 0.3 + audio.highEnergy * 0.4 + lightNight * 0.2;
    this.material.size = 0.2 + calmDrive * 0.15 + audio.lowEnergy * 0.1;

    // Move speed affected by drive and bass
    const speedMult = 0.5 + calmDrive * 1.0 + audio.lowEnergy * 0.5;

    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3;
      this.phases[i] += dt * (0.5 + audio.highEnergy * 2);

      // Base drift + gentle sine wobble
      positions[i3] += this.velocities[i3] * speedMult
        + Math.sin(this.phases[i] * 0.7) * 0.003;
      positions[i3 + 1] += this.velocities[i3 + 1] * speedMult
        + Math.sin(this.phases[i]) * 0.002;
      positions[i3 + 2] += this.velocities[i3 + 2] * speedMult;

      // Wrap particles that drift out of bounds
      if (positions[i3 + 1] > 45) {
        positions[i3 + 1] = -5;
        positions[i3] = (Math.random() - 0.5) * 80;
        positions[i3 + 2] = (Math.random() - 0.5) * 60 - 10;
      }
      if (Math.abs(positions[i3]) > 45) {
        positions[i3] = -Math.sign(positions[i3]) * 44;
      }
    }

    this.geometry.attributes.position.needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
```

### Step 4: Lorenz Attractor 3D Visualization

```typescript
// src/viz/lorenz-viz.ts
import * as THREE from 'three';
import type { LorenzState } from '../types';

/**
 * Renders the Lorenz attractor as a glowing 3D trail in the scene.
 * Shows the full trajectory history as a fading line, with a bright
 * marker at the current position.
 *
 * The attractor is scaled and positioned to sit as a central
 * decorative element — the "heart" of the visualization that shows
 * exactly where in the chaotic system the music modulation currently is.
 */
export class LorenzViz {
  private trailLine: THREE.Line;
  private trailGeometry: THREE.BufferGeometry;
  private trailMaterial: THREE.LineBasicMaterial;
  private markerMesh: THREE.Mesh;
  private markerMaterial: THREE.MeshBasicMaterial;
  private glowMesh: THREE.Mesh;
  private glowMaterial: THREE.MeshBasicMaterial;

  private maxPoints = 2000;
  private positions: Float32Array;
  private colors: Float32Array;
  private pointCount = 0;

  // Scale and offset to position the attractor nicely in the scene
  private scale = 0.4;
  private offset = new THREE.Vector3(0, 12, -15);

  constructor(scene: THREE.Scene) {
    // ── Trail line ──
    this.positions = new Float32Array(this.maxPoints * 3);
    this.colors = new Float32Array(this.maxPoints * 3);

    this.trailGeometry = new THREE.BufferGeometry();
    this.trailGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage),
    );
    this.trailGeometry.setAttribute(
      'color',
      new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage),
    );

    this.trailMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.trailLine = new THREE.Line(this.trailGeometry, this.trailMaterial);
    scene.add(this.trailLine);

    // ── Current position marker (bright dot) ──
    this.markerMaterial = new THREE.MeshBasicMaterial({
      color: 0xFFFFFF,
      transparent: true,
      opacity: 0.9,
    });
    this.markerMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 16, 16),
      this.markerMaterial,
    );
    scene.add(this.markerMesh);

    // ── Glow around marker ──
    this.glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x88CCFF,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.glowMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.0, 16, 16),
      this.glowMaterial,
    );
    scene.add(this.glowMesh);
  }

  update(lorenz: LorenzState): void {
    // Transform Lorenz coordinates to scene space
    const sx = lorenz.x * this.scale + this.offset.x;
    const sy = lorenz.z * this.scale + this.offset.y; // z → up
    const sz = lorenz.y * this.scale + this.offset.z;

    // ── Update trail ──
    if (this.pointCount < this.maxPoints) {
      const idx = this.pointCount * 3;
      this.positions[idx] = sx;
      this.positions[idx + 1] = sy;
      this.positions[idx + 2] = sz;
      this.pointCount++;
    } else {
      // Shift all points left by one and append new point at end
      this.positions.copyWithin(0, 3);
      const idx = (this.maxPoints - 1) * 3;
      this.positions[idx] = sx;
      this.positions[idx + 1] = sy;
      this.positions[idx + 2] = sz;
    }

    // Color gradient: older points are dim/cool, newer are bright/warm
    const count = Math.min(this.pointCount, this.maxPoints);
    for (let i = 0; i < count; i++) {
      const t = i / count; // 0 = oldest, 1 = newest
      const fade = t * t; // exponential fade — recent points much brighter
      this.colors[i * 3] = 0.2 + fade * 0.6;     // R: warm at tip
      this.colors[i * 3 + 1] = 0.3 + fade * 0.5;  // G
      this.colors[i * 3 + 2] = 0.8 - fade * 0.3;  // B: cool at tail
    }

    this.trailGeometry.attributes.position.needsUpdate = true;
    this.trailGeometry.attributes.color.needsUpdate = true;
    this.trailGeometry.setDrawRange(0, count);

    // ── Update marker position ──
    this.markerMesh.position.set(sx, sy, sz);
    this.glowMesh.position.set(sx, sy, sz);

    // Marker color shifts with normalized state
    this.markerMaterial.color.setRGB(
      0.5 + lorenz.nx * 0.5,
      0.6 + lorenz.ny * 0.4,
      1.0 - lorenz.nz * 0.3,
    );
    this.glowMaterial.color.copy(this.markerMaterial.color);
  }

  dispose(): void {
    this.trailGeometry.dispose();
    this.trailMaterial.dispose();
    this.markerMesh.geometry.dispose();
    this.markerMaterial.dispose();
    this.glowMesh.geometry.dispose();
    this.glowMaterial.dispose();
  }
}
```

### Step 5: Postprocessing Effects

```typescript
// src/viz/effects.ts
import * as THREE from 'three';
import {
  EffectComposer,
  EffectPass,
  RenderPass,
  BloomEffect,
  VignetteEffect,
  BlendFunction,
} from 'postprocessing';

/**
 * Creates the postprocessing pipeline:
 * - Render pass (base scene)
 * - Bloom (audio-reactive glow on sun/moon/lorenz marker)
 * - Vignette (subtle edge darkening for focus)
 */
export function createEffectComposer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
): EffectComposer {
  const composer = new EffectComposer(renderer);

  // Base render
  composer.addPass(new RenderPass(scene, camera));

  // Bloom — makes emissive objects glow
  const bloom = new BloomEffect({
    blendFunction: BlendFunction.ADD,
    intensity: 0.8,
    luminanceThreshold: 0.6,
    luminanceSmoothing: 0.3,
    mipmapBlur: true,
  });

  // Vignette — subtle darkened edges
  const vignette = new VignetteEffect({
    offset: 0.35,
    darkness: 0.5,
  });

  composer.addPass(new EffectPass(camera, bloom, vignette));

  // Expose bloom for audio-reactive intensity updates
  (composer as any).__bloom = bloom;

  return composer;
}

/**
 * Update bloom intensity based on audio.
 * Call from the animation loop.
 */
export function updateBloom(composer: EffectComposer, lowEnergy: number, beatIntensity: number): void {
  const bloom = (composer as any).__bloom as BloomEffect | undefined;
  if (bloom) {
    bloom.intensity = 0.6 + lowEnergy * 0.8 + beatIntensity * 0.4;
  }
}
```

### Step 6: Commit

```bash
git add src/viz/
git commit -m "feat: add Three.js visualization — sky, particles, Lorenz trail, postprocessing"
```

---

## Task 9: UI Structure & Controls

**Files:**
- Rewrite: `index.html`
- Create: `src/ui/controls.ts`

### Step 1: Rewrite index.html

```html
<!-- index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Music Lounge</title>
  <link rel="stylesheet" href="/src/style.css" />
</head>
<body>
  <!-- Start overlay (AudioContext needs user gesture) -->
  <div id="start-overlay">
    <h1>MUSIC LOUNGE</h1>
    <p class="subtitle">AI-generated ambient music that never repeats</p>
    <button id="start-btn">ENTER LOUNGE</button>
  </div>

  <div id="app" class="hidden">
    <!-- Three.js renders to this canvas -->
    <canvas id="viz-canvas"></canvas>

    <!-- Status bar (top) -->
    <div id="status-bar">
      <span id="status-text">Connecting...</span>
    </div>

    <!-- Control panel (bottom) -->
    <div id="controls">
      <div class="slider-group">
        <div class="slider-row">
          <label class="slider-label-left">DAY</label>
          <input type="range" id="light-night" min="0" max="1000" value="200" />
          <label class="slider-label-right">NIGHT</label>
        </div>
        <div class="slider-row">
          <label class="slider-label-left">CALM</label>
          <input type="range" id="calm-drive" min="0" max="1000" value="200" />
          <label class="slider-label-right">DRIVE</label>
        </div>
      </div>

      <!-- Transport -->
      <div class="transport">
        <button id="play-btn" class="transport-btn active">PLAY</button>
        <button id="pause-btn" class="transport-btn">PAUSE</button>
      </div>

      <!-- Advanced toggle -->
      <button id="advanced-toggle" class="advanced-btn">ADVANCED</button>

      <!-- Advanced panel (hidden by default) -->
      <div id="advanced-panel" class="hidden">
        <div class="advanced-row">
          <label>BPM</label>
          <select id="bpm-select">
            <option value="" selected>Auto</option>
            <option value="70">70</option>
            <option value="80">80</option>
            <option value="90">90</option>
            <option value="100">100</option>
            <option value="110">110</option>
            <option value="120">120</option>
            <option value="130">130</option>
            <option value="140">140</option>
          </select>
          <span class="hint">Changes BPM (requires brief audio reset)</span>
        </div>
        <div class="advanced-row">
          <label>Volume</label>
          <input type="range" id="volume" min="0" max="100" value="80" />
        </div>
        <div class="advanced-row">
          <label>Lorenz Speed</label>
          <input type="range" id="lorenz-speed" min="1" max="100" value="10" />
          <span class="hint">How fast the music evolves</span>
        </div>
      </div>
    </div>
  </div>

  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

### Step 2: Create controls module

```typescript
// src/ui/controls.ts
import type { SliderState } from '../types';

export interface ControlCallbacks {
  onSliderChange: (state: SliderState) => void;
  onBpmChange: (bpm: number | null) => void;
  onVolumeChange: (volume: number) => void;
  onLorenzSpeedChange: (speed: number) => void;
  onPlay: () => void;
  onPause: () => void;
}

/**
 * Binds UI controls to callbacks and manages the control panel state.
 */
export function initControls(callbacks: ControlCallbacks): {
  getSliderState: () => SliderState;
} {
  const lightNightEl = document.getElementById('light-night') as HTMLInputElement;
  const calmDriveEl = document.getElementById('calm-drive') as HTMLInputElement;
  const bpmSelect = document.getElementById('bpm-select') as HTMLSelectElement;
  const volumeEl = document.getElementById('volume') as HTMLInputElement;
  const lorenzSpeedEl = document.getElementById('lorenz-speed') as HTMLInputElement;
  const playBtn = document.getElementById('play-btn')!;
  const pauseBtn = document.getElementById('pause-btn')!;
  const advancedToggle = document.getElementById('advanced-toggle')!;
  const advancedPanel = document.getElementById('advanced-panel')!;

  const getSliderState = (): SliderState => ({
    lightNight: parseInt(lightNightEl.value) / 1000,
    calmDrive: parseInt(calmDriveEl.value) / 1000,
  });

  // Slider events
  const onSliderInput = () => callbacks.onSliderChange(getSliderState());
  lightNightEl.addEventListener('input', onSliderInput);
  calmDriveEl.addEventListener('input', onSliderInput);

  // BPM
  bpmSelect.addEventListener('change', () => {
    const val = bpmSelect.value;
    callbacks.onBpmChange(val ? parseInt(val) : null);
  });

  // Volume
  volumeEl.addEventListener('input', () => {
    callbacks.onVolumeChange(parseInt(volumeEl.value) / 100);
  });

  // Lorenz speed
  lorenzSpeedEl.addEventListener('input', () => {
    // Map 1-100 to 0.0001-0.005
    const raw = parseInt(lorenzSpeedEl.value);
    const speed = 0.0001 + (raw / 100) * 0.0049;
    callbacks.onLorenzSpeedChange(speed);
  });

  // Transport
  playBtn.addEventListener('click', () => {
    playBtn.classList.add('active');
    pauseBtn.classList.remove('active');
    callbacks.onPlay();
  });
  pauseBtn.addEventListener('click', () => {
    pauseBtn.classList.add('active');
    playBtn.classList.remove('active');
    callbacks.onPause();
  });

  // Advanced panel toggle
  advancedToggle.addEventListener('click', () => {
    advancedPanel.classList.toggle('hidden');
    advancedToggle.textContent = advancedPanel.classList.contains('hidden')
      ? 'ADVANCED'
      : 'HIDE ADVANCED';
  });

  // Update slider track fills for visual feedback
  const updateTrackFill = (el: HTMLInputElement) => {
    const pct = (parseInt(el.value) / parseInt(el.max)) * 100;
    el.style.setProperty('--fill', `${pct}%`);
  };
  [lightNightEl, calmDriveEl].forEach((el) => {
    el.addEventListener('input', () => updateTrackFill(el));
    updateTrackFill(el);
  });

  return { getSliderState };
}
```

### Step 3: Commit

```bash
git add index.html src/ui/controls.ts
git commit -m "feat: add new HTML structure and UI control bindings"
```

---

## Task 10: CSS Design System

**Files:**
- Rewrite: `src/style.css`

### Step 1: Write the full CSS

The CSS should create a transparent overlay aesthetic — controls float over the Three.js canvas with frosted-glass backgrounds. Colors adapt subtly to day/night via CSS custom properties set from JS.

```css
/* src/style.css */

/* ── Reset & Base ── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --surface: rgba(20, 20, 30, 0.55);
  --surface-hover: rgba(30, 30, 45, 0.65);
  --text: rgba(255, 255, 255, 0.9);
  --text-dim: rgba(255, 255, 255, 0.5);
  --accent: rgba(160, 200, 255, 0.8);
  --border: rgba(255, 255, 255, 0.08);
  --radius: 12px;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}

html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #0a0a12;
  color: var(--text);
}

.hidden { display: none !important; }

/* ── Start Overlay ── */
#start-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: radial-gradient(ellipse at 50% 40%, #1a1a2e 0%, #0a0a12 100%);
  z-index: 100;
}

#start-overlay h1 {
  font-size: 2.4rem;
  font-weight: 300;
  letter-spacing: 0.4em;
  margin-bottom: 0.5rem;
  color: rgba(255, 255, 255, 0.85);
}

.subtitle {
  font-size: 0.85rem;
  color: var(--text-dim);
  letter-spacing: 0.15em;
  margin-bottom: 2.5rem;
}

#start-btn {
  padding: 14px 48px;
  font-size: 0.9rem;
  letter-spacing: 0.3em;
  font-weight: 500;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.04);
  color: var(--text);
  border-radius: 50px;
  cursor: pointer;
  transition: all 0.3s ease;
}
#start-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.25);
}

/* ── App Layout ── */
#app {
  position: fixed;
  inset: 0;
}

#viz-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

/* ── Status Bar ── */
#status-bar {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  padding: 6px 20px;
  background: var(--surface);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--border);
  border-radius: 20px;
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  color: var(--text-dim);
  z-index: 10;
}

/* ── Controls Panel ── */
#controls {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  width: min(440px, calc(100% - 32px));
  padding: 20px 24px;
  background: var(--surface);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ── Slider Rows ── */
.slider-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.slider-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.slider-label-left,
.slider-label-right {
  font-size: 0.65rem;
  letter-spacing: 0.2em;
  color: var(--text-dim);
  width: 40px;
  flex-shrink: 0;
}
.slider-label-left { text-align: right; }
.slider-label-right { text-align: left; }

/* ── Range Inputs ── */
input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
  flex: 1;
  height: 4px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}

input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--accent);
  border: 2px solid rgba(255, 255, 255, 0.2);
  cursor: grab;
  transition: transform 0.15s ease;
}
input[type="range"]::-webkit-slider-thumb:active {
  transform: scale(1.2);
  cursor: grabbing;
}

/* ── Transport Buttons ── */
.transport {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.transport-btn {
  padding: 8px 24px;
  font-size: 0.7rem;
  letter-spacing: 0.2em;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-dim);
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.transport-btn.active {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text);
  border-color: var(--accent);
}
.transport-btn:hover {
  background: var(--surface-hover);
}

/* ── Advanced Button ── */
.advanced-btn {
  padding: 6px 16px;
  font-size: 0.6rem;
  letter-spacing: 0.25em;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-dim);
  border-radius: 20px;
  cursor: pointer;
  align-self: center;
  transition: all 0.2s ease;
}
.advanced-btn:hover {
  background: var(--surface-hover);
}

/* ── Advanced Panel ── */
#advanced-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}

.advanced-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.72rem;
}
.advanced-row label {
  width: 90px;
  flex-shrink: 0;
  color: var(--text-dim);
  letter-spacing: 0.1em;
}
.advanced-row select {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 0.72rem;
}
.advanced-row .hint {
  font-size: 0.6rem;
  color: var(--text-dim);
  opacity: 0.6;
}
.advanced-row input[type="range"] {
  flex: 1;
  max-width: 140px;
}

/* ── Responsive ── */
@media (max-width: 480px) {
  #controls {
    bottom: 12px;
    padding: 16px;
    gap: 12px;
  }
  .slider-label-left,
  .slider-label-right {
    font-size: 0.55rem;
    width: 32px;
  }
}
```

### Step 2: Commit

```bash
git add src/style.css
git commit -m "feat: add frosted-glass CSS design system for Three.js overlay"
```

---

## Task 11: Main Application Integration

**Files:**
- Rewrite: `src/main.ts`

This is the critical wiring task — it connects all modules into the animation loop.

### Step 1: Implement main.ts

```typescript
// src/main.ts
import './style.css';
import { LyriaClient } from './audio/lyria-client';
import { AudioPlayer } from './audio/audio-player';
import { LorenzModulator } from './music/lorenz-modulator';
import { ParamEngine } from './music/param-engine';
import { SOUND_PALETTE, randomizeSession } from './music/sound-palette';
import { SceneManager } from './viz/scene';
import { initControls } from './ui/controls';
import type { SliderState, AudioAnalysis, MusicGenConfig } from './types';

// ── State ──
let sliderState: SliderState = { lightNight: 0.2, calmDrive: 0.2 };
let playing = false;
let bpm: number | null = null;

// ── Modules (session-randomized palette) ──
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const lyria = new LyriaClient(apiKey);
const audioPlayer = new AudioPlayer();
const lorenz = new LorenzModulator(0.0005, 2000);
const palette = randomizeSession(SOUND_PALETTE);
const paramEngine = new ParamEngine(palette);
let scene: SceneManager | null = null;

// ── Status ──
function setStatus(text: string): void {
  const el = document.getElementById('status-text');
  if (el) el.textContent = text;
}

// ── Start ──
async function start(): Promise<void> {
  const overlay = document.getElementById('start-overlay')!;
  const app = document.getElementById('app')!;
  overlay.classList.add('hidden');
  app.classList.remove('hidden');

  setStatus('Initializing audio...');
  await audioPlayer.init();

  const canvas = document.getElementById('viz-canvas') as HTMLCanvasElement;
  scene = new SceneManager(canvas);

  setStatus('Connecting to Lyria...');

  await lyria.connect({
    onAudioChunk: (pcm) => audioPlayer.pushAudio(pcm),
    onFilteredPrompt: (text, reason) => {
      console.warn(`Prompt filtered: "${text}" — ${reason}`);
    },
    onWarning: (msg) => console.warn('Lyria warning:', msg),
    onError: (err) => {
      console.error('Lyria error:', err);
      setStatus('Connection error — refresh to retry');
    },
    onClose: () => {
      setStatus('Disconnected');
      playing = false;
    },
    onReady: () => {
      setStatus('Ready');
      // Set initial targets and immediately send
      paramEngine.setTargets(sliderState, lorenz.getState());
      for (let i = 0; i < 100; i++) paramEngine.tick(); // snap to initial
      sendSmoothedParams();
      lyria.play();
      playing = true;
      setStatus('Playing');
    },
  });
}

// ── Send smoothed params to Lyria ──
function sendSmoothedParams(): void {
  const params = paramEngine.getSmoothedParams();
  lyria.setPrompts(params.prompts);

  const config: MusicGenConfig = { ...params.config };
  if (bpm !== null) (config as any).bpm = bpm;
  lyria.setConfig(config);
}

// ── Animation loop ──
let lastTime = performance.now();

function animate(): void {
  requestAnimationFrame(animate);

  const now = performance.now();
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  // Advance Lorenz attractor
  lorenz.step();
  const lorenzState = lorenz.getState();

  // Update targets (cheap — just sets target values)
  paramEngine.setTargets(sliderState, lorenzState);

  // Advance smoothers (every frame — this is what makes transitions gradual)
  paramEngine.tick();

  // Send smoothed params to Lyria at rate-limited interval
  if (playing && paramEngine.shouldSend()) {
    sendSmoothedParams();
  }

  // Audio analysis for visualization
  const audio: AudioAnalysis = audioPlayer.getAnalysis();

  // Update Three.js scene
  if (scene) {
    scene.update(sliderState, lorenzState, audio, dt);
  }
}

// ── Controls ──
const { getSliderState } = initControls({
  onSliderChange: (state) => {
    sliderState = state;
    // Targets update next frame via paramEngine.setTargets()
    // Smoothers ensure gradual transition — no jump
  },
  onBpmChange: (newBpm) => {
    bpm = newBpm;
    if (playing) {
      sendSmoothedParams();
      lyria.resetContext();
      audioPlayer.resetBuffer();
      setStatus('Resetting for new BPM...');
      setTimeout(() => setStatus('Playing'), 2000);
    }
  },
  onVolumeChange: (vol) => audioPlayer.setVolume(vol),
  onLorenzSpeedChange: (speed) => lorenz.setSpeed(speed),
  onPlay: () => {
    if (!playing) {
      lyria.play();
      audioPlayer.resume();
      playing = true;
      setStatus('Playing');
    }
  },
  onPause: () => {
    if (playing) {
      lyria.pause();
      playing = false;
      setStatus('Paused');
    }
  },
});

// ── Init ──
document.getElementById('start-btn')!.addEventListener('click', async () => {
  await start();
  animate();
});
```

### Step 2: Commit

```bash
git add src/main.ts
git commit -m "feat: wire up main application — Lyria + Lorenz + Three.js loop"
```

---

## Task 12: Demo Page — Schemas & UI

**Files:**
- Create: `demo.html`
- Create: `src/demo.ts`

The demo page lets you audition each of the 10 prompt schemas at four "positions" (calm-day, calm-night, drive-day, center) to find the right sonic palette.

### Step 1: Create demo.html

```html
<!-- demo.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Music Lounge — Sound Lab</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', -apple-system, sans-serif;
      background: #0c0c16;
      color: rgba(255, 255, 255, 0.9);
      padding: 24px;
      max-width: 900px;
      margin: 0 auto;
    }

    h1 {
      font-size: 1.4rem;
      font-weight: 300;
      letter-spacing: 0.3em;
      margin-bottom: 8px;
    }

    .intro {
      font-size: 0.8rem;
      color: rgba(255, 255, 255, 0.5);
      margin-bottom: 32px;
      line-height: 1.6;
    }

    .status {
      position: fixed;
      top: 16px;
      right: 16px;
      padding: 6px 16px;
      background: rgba(20, 20, 30, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 20px;
      font-size: 0.7rem;
      color: rgba(255, 255, 255, 0.5);
    }

    .stop-all {
      position: fixed;
      top: 16px;
      left: 16px;
      padding: 8px 20px;
      font-size: 0.7rem;
      letter-spacing: 0.2em;
      border: 1px solid rgba(255, 100, 100, 0.3);
      background: rgba(255, 50, 50, 0.1);
      color: rgba(255, 150, 150, 0.9);
      border-radius: 20px;
      cursor: pointer;
    }
    .stop-all:hover { background: rgba(255, 50, 50, 0.2); }

    .schema-card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 16px;
    }
    .schema-card.active {
      border-color: rgba(160, 200, 255, 0.3);
      background: rgba(160, 200, 255, 0.04);
    }

    .schema-name {
      font-size: 1rem;
      font-weight: 500;
      letter-spacing: 0.1em;
      margin-bottom: 4px;
    }

    .schema-desc {
      font-size: 0.75rem;
      color: rgba(255, 255, 255, 0.45);
      margin-bottom: 14px;
    }

    .schema-buttons {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .play-btn {
      padding: 8px 16px;
      font-size: 0.65rem;
      letter-spacing: 0.15em;
      border: 1px solid rgba(255, 255, 255, 0.1);
      background: rgba(255, 255, 255, 0.03);
      color: rgba(255, 255, 255, 0.7);
      border-radius: 20px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .play-btn:hover {
      background: rgba(255, 255, 255, 0.08);
    }
    .play-btn.playing {
      background: rgba(160, 200, 255, 0.15);
      border-color: rgba(160, 200, 255, 0.4);
      color: rgba(200, 220, 255, 1);
    }

    .schema-details {
      margin-top: 12px;
      padding-top: 10px;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      font-size: 0.65rem;
      color: rgba(255, 255, 255, 0.35);
      font-family: 'SF Mono', 'Fira Code', monospace;
      white-space: pre-wrap;
      display: none;
    }
    .schema-card.active .schema-details {
      display: block;
    }
  </style>
</head>
<body>
  <h1>SOUND LAB</h1>
  <p class="intro">
    Audition 10 parameter schemas to find the right vibe. Each has 4 positions:
    calm-day (minimal/bright), calm-night (minimal/dark), drive-day (energetic/bright),
    and center (balanced). Click any button to hear that combination.
    The current prompts and config are shown below each active schema.
  </p>

  <div class="status" id="status">Not connected</div>
  <button class="stop-all" id="stop-all">STOP</button>

  <div id="schemas"></div>

  <script type="module" src="/src/demo.ts"></script>
</body>
</html>
```

### Step 2: Implement demo.ts

```typescript
// src/demo.ts
import { LyriaClient } from './audio/lyria-client';
import { AudioPlayer } from './audio/audio-player';
import { ParamEngine } from './music/param-engine';
import { LorenzModulator } from './music/lorenz-modulator';
import { DEMO_SCHEMAS } from './music/demo-schemas';
import type { SliderState, LyriaParams, DemoSchema } from './types';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const lyria = new LyriaClient(apiKey);
const audioPlayer = new AudioPlayer();
const lorenz = new LorenzModulator(0.002); // faster for demo
// ParamEngine created per-schema when playing
let paramEngine: ParamEngine | null = null;

// Pre-stepped Lorenz to be near the attractor
for (let i = 0; i < 500; i++) lorenz.step();

const statusEl = document.getElementById('status')!;
const schemasEl = document.getElementById('schemas')!;

let connected = false;
let activeSchemaId: string | null = null;
let activePosition: string | null = null;

// ── Position presets ──
const POSITIONS: Record<string, { label: string; sliders: SliderState }> = {
  'calm-day': { label: 'CALM + DAY', sliders: { lightNight: 0.1, calmDrive: 0.1 } },
  'calm-night': { label: 'CALM + NIGHT', sliders: { lightNight: 0.9, calmDrive: 0.1 } },
  'drive-day': { label: 'DRIVE + DAY', sliders: { lightNight: 0.1, calmDrive: 0.85 } },
  'center': { label: 'CENTER', sliders: { lightNight: 0.45, calmDrive: 0.45 } },
};

// ── Build UI ──
for (const schema of DEMO_SCHEMAS) {
  const card = document.createElement('div');
  card.className = 'schema-card';
  card.id = `card-${schema.id}`;

  card.innerHTML = `
    <div class="schema-name">${schema.name}</div>
    <div class="schema-desc">${schema.description}</div>
    <div class="schema-buttons">
      ${Object.entries(POSITIONS)
        .map(
          ([key, { label }]) =>
            `<button class="play-btn" data-schema="${schema.id}" data-pos="${key}">${label}</button>`,
        )
        .join('')}
    </div>
    <div class="schema-details" id="details-${schema.id}"></div>
  `;

  schemasEl.appendChild(card);
}

// ── Button click handler ──
schemasEl.addEventListener('click', async (e) => {
  const btn = (e.target as HTMLElement).closest('.play-btn') as HTMLElement;
  if (!btn) return;

  const schemaId = btn.dataset.schema!;
  const posKey = btn.dataset.pos!;

  // If clicking the same button, stop
  if (activeSchemaId === schemaId && activePosition === posKey) {
    stopPlayback();
    return;
  }

  await playSchema(schemaId, posKey);
});

// ── Stop all ──
document.getElementById('stop-all')!.addEventListener('click', stopPlayback);

async function ensureConnected(): Promise<void> {
  if (connected) return;

  statusEl.textContent = 'Initializing...';
  await audioPlayer.init();

  statusEl.textContent = 'Connecting to Lyria...';
  await new Promise<void>((resolve, reject) => {
    lyria.connect({
      onAudioChunk: (pcm) => audioPlayer.pushAudio(pcm),
      onFilteredPrompt: (text, reason) => {
        console.warn(`Filtered: "${text}" — ${reason}`);
      },
      onError: (err) => {
        statusEl.textContent = `Error: ${err.message}`;
        reject(err);
      },
      onClose: () => {
        connected = false;
        statusEl.textContent = 'Disconnected';
      },
      onReady: () => {
        connected = true;
        statusEl.textContent = 'Connected';
        resolve();
      },
    });
  });
}

async function playSchema(schemaId: string, posKey: string): Promise<void> {
  await ensureConnected();

  const schema = DEMO_SCHEMAS.find((s) => s.id === schemaId)!;
  const pos = POSITIONS[posKey];
  const lorenzState = lorenz.getState();

  // Create/swap param engine with this schema's palette
  paramEngine = new ParamEngine(schema.palette);
  paramEngine.setTargets(pos.sliders, lorenzState);
  // Snap to values immediately (demo — no need to ease in)
  for (let i = 0; i < 200; i++) paramEngine.tick();
  const params = paramEngine.getSmoothedParams();

  lyria.setPrompts(params.prompts);
  lyria.setConfig(params.config);

  if (!activeSchemaId) {
    lyria.play();
  } else {
    audioPlayer.resetBuffer();
    lyria.stop();
    lyria.setPrompts(params.prompts);
    lyria.setConfig(params.config);
    lyria.play();
  }

  // Update UI
  updateActiveUI(schemaId, posKey);
  showDetails(schema, params);

  activeSchemaId = schemaId;
  activePosition = posKey;
  statusEl.textContent = `Playing: ${schema.name} — ${pos.label}`;
}

function stopPlayback(): void {
  lyria.stop();
  audioPlayer.resetBuffer();
  activeSchemaId = null;
  activePosition = null;
  updateActiveUI(null, null);
  statusEl.textContent = 'Stopped';
}

function updateActiveUI(schemaId: string | null, posKey: string | null): void {
  // Clear all active states
  document.querySelectorAll('.schema-card').forEach((c) => c.classList.remove('active'));
  document.querySelectorAll('.play-btn').forEach((b) => b.classList.remove('playing'));

  if (schemaId && posKey) {
    document.getElementById(`card-${schemaId}`)?.classList.add('active');
    const activeBtn = document.querySelector(
      `.play-btn[data-schema="${schemaId}"][data-pos="${posKey}"]`,
    );
    activeBtn?.classList.add('playing');
  }
}

function showDetails(schema: DemoSchema, params: LyriaParams): void {
  const el = document.getElementById(`details-${schema.id}`);
  if (!el) return;

  const promptLines = params.prompts
    .map((p) => `  "${p.text}" → weight: ${p.weight.toFixed(2)}`)
    .join('\n');

  el.textContent = `Prompts:\n${promptLines}\n\nConfig:\n  density: ${params.config.density.toFixed(2)}\n  brightness: ${params.config.brightness.toFixed(2)}\n  temperature: ${params.config.temperature.toFixed(2)}\n  guidance: ${params.config.guidance.toFixed(2)}`;
}
```

### Step 3: Commit

```bash
git add demo.html src/demo.ts
git commit -m "feat: add Sound Lab demo page for parameter exploration"
```

---

## Task 13: Cleanup & Polish

**Files:**
- Delete: old source files
- Modify: various for polish

### Step 1: Remove old source files

```bash
rm src/audio/engine.ts src/audio/generative.ts src/audio/presets.ts
rm src/ui/Visualizer.ts src/ui/Knob.ts src/ui/Fader.ts src/ui/MacroSlider.ts
```

### Step 2: Verify the build compiles

Run: `npx tsc --noEmit`
Expected: No errors

### Step 3: Run all tests

Run: `npx vitest run`
Expected: All tests pass

### Step 4: Verify dev server starts

Run: `npm run dev`
Expected: Vite dev server on port 3000, app loads with start overlay

### Step 5: Final commit

```bash
git add -A
git commit -m "chore: remove old Tone.js engine and 2D Canvas visualizer"
```

---

## Appendix A: Lyria API Quick Reference

### What changes in real-time (no reset needed)
- Weighted prompts (text + weight)
- `temperature` (0.0–3.0, default 1.1)
- `topK` (1–1000, default 40)
- `guidance` (0.0–6.0, default 4.0)
- `density` (0.0–1.0)
- `brightness` (0.0–1.0)
- `muteBass`, `muteDrums`, `onlyBassAndDrums`
- `musicGenerationMode` (QUALITY / DIVERSITY / VOCALIZATION)

### What requires context reset
- `bpm` (60–200)
- `scale` (C_MAJOR_A_MINOR, D_MAJOR_B_MINOR, etc.)

### Key constraints
- Full config must be sent every time (omitted fields reset to defaults)
- Weights auto-normalize (sum to 1.0)
- Weight must not be zero
- Audio: 16-bit PCM, 48kHz, stereo, base64-encoded
- v1alpha only, Google AI (not Vertex AI)
- SynthID watermark always applied
- Session limit ~10-15 minutes (reconnect as needed)

### Available music tags (non-exhaustive sample)

**Instruments:** 303 Acid Bass, 808 Hip Hop Beat, Buchla Synths, Cello, Dirty Synths, Glockenspiel, Hang Drum, Harp, Kalimba, Mellotron, Moog Oscillations, Rhodes Piano, Sitar, Smooth Pianos, Spacey Synths, Synth Pads, TR-909 Drum Machine, Vibraphone, Warm Acoustic Guitar

**Genres:** Chillout, Deep House, EDM, Indie Electronic, Lo-Fi Hip Hop, Minimal Techno, Shoegaze, Synthpop, Trance, Trip Hop, Vaporwave

**Moods:** Ambient, Bright Tones, Chill, Crunchy Distortion, Danceable, Dreamy, Echo, Ethereal Ambience, Experimental, Fat Beats, Glitchy Effects, Lo-fi, Ominous Drone, Psychedelic, Saturated Tones, Subdued Melody, Sustained Chords, Swirling Phasers, Tight Groove, Upbeat

---

## Appendix B: Control Separation — Sliders vs Lorenz

### Sliders → Config Scalars (the "feel")

| Slider | Modulates | Range | Effect |
|--------|-----------|-------|--------|
| Day ↔ Night | brightness | 0.55 → 0.25 | Tonal warmth/coolness |
| Calm ↔ Drive | density | 0.2 → 0.7 | Sparse drone → busy groove |
| Calm ↔ Drive | guidance | 3.5 → 4.3 | Loose → tight prompt following |
| Calm ↔ Drive | temperature | 1.1 → 1.35 | Predictable → creative |
| Calm ↔ Drive | mood prompt | "Chill" ↔ "Danceable" | One subtle text hint |

Sliders also shift visualization: sky elevation, particle speed, bloom intensity.

### Lorenz → Instrument Prompts (the "palette")

Each Lorenz axis blends between two instrument groups ("poles").
As the attractor wanders its butterfly wings, instruments fade in and out.

| Lorenz Axis | Pole A (axis → 0) | Pole B (axis → 1) |
|-------------|-------------------|--------------------|
| x (nx) | Synth Pads, Sustained Chords | Moog Oscillations, Buchla Synths |
| y (ny) | Rhodes Piano, Smooth Pianos, Harp | Dirty Synths, 303 Acid Bass |
| z (nz) | Spacey Synths, Echo, Swirling Phasers | Kalimba, Hang Drum, Vibraphone |

- Both poles are always present with some weight (never fully 0)
- The foundation prompt ("Electronic, Ambient, Synth") is always on at weight 1.0
- Max instrument weight is 0.7 to keep foundation dominant

### How it feels

The Lorenz attractor orbits two "wings" — x swings between them while z oscillates:
- **Right wing:** Moog + Acid Bass + Hang Drum (darker, grittier, more percussive)
- **Left wing:** Synth Pads + Rhodes + Spacey Synths (warmer, smoother, more atmospheric)
- **Transitions:** The attractor spends time in each wing then rapidly crosses to the other, creating gradual builds followed by noticeable palette shifts
- **The smoother adds ~2-3 seconds of crossfade** so even wing transitions feel natural

### Smoothing System

All values pass through `SmoothedValue` (lerp α per frame):
- **Config scalars:** α = 0.03 (~1.5 second ease)
- **Prompt weights:** α = 0.02 (~2.5 second crossfade)
- This means rapid slider movements produce smooth parameter ramps
- And Lorenz wing-crossings produce gradual instrument blends

### Speed recommendations

| Speed (dt) | Feel | Use case |
|-----------|------|----------|
| 0.0002 | Barely perceptible | Long background sessions |
| 0.0005 | Default — gentle drift | Main app |
| 0.002 | Noticeable morphing | Demo / exploration |
| 0.005 | Rapid shifting | Testing |

---

## Appendix C: Future Work (out of scope for v1)

These are mentioned in the user's brief but deferred for now:

1. **Custom tag controls** — Advanced panel where users add tags from a dropdown, with preset modulation patterns (e.g., "add this tag strong for 5 minutes", "add this tag on a 3-minute sine wave")
2. **Scale selection** — Add scale picker to advanced panel (requires context reset)
3. **Session resumption** — Handle the 10-15 minute session limit gracefully with auto-reconnect
4. **Ephemeral tokens** — Backend endpoint to create short-lived tokens so the API key isn't exposed client-side in production
5. **MIDI input** — Map MIDI controller knobs to sliders and Lorenz parameters
