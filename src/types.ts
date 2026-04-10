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
