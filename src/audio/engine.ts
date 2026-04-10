import * as Tone from 'tone';
import {
  ARP_PATTERNS,
  BASS_PATTERNS,
  CHORD_QUALITIES,
  DRUM_PATTERNS,
  PROGRESSION_BANK,
  type ArpPattern,
  type BassStep,
  type ChordQualityName,
  type DrumPattern,
} from './presets';
import {
  generateEuclideanDrumPattern,
  MarkovChordProgression,
  LorenzModulator,
  LSystemPatternGenerator,
} from './generative';

export type LayerName = 'drums' | 'bass' | 'pad' | 'arp' | 'atmo';
export type MacroAxisName = 'lightNight' | 'calmDrive';
export type FrontControlName = 'tone' | 'groove' | 'chords' | 'arp' | 'space' | 'texture';
export type EvolutionDimension = 'drums' | 'bass' | 'harmony' | 'arp' | 'fx';

export interface MacroState {
  lightNight: number;
  calmDrive: number;
}

export interface FrontPanelState {
  tone: number;
  groove: number;
  chords: number;
  arp: number;
  space: number;
  texture: number;
}

export interface LayerOverrideState {
  enabled: boolean;
  level: number;
  paramA: number;
  paramB: number;
}

export interface ChordInfo {
  name: string;
  quality: ChordQualityName;
  notes: string[];
  root: string;
  arpNotes: string[];
}

export interface EvolutionState {
  phraseIndex: number;
  bar: number;
  barsPerPhrase: number;
  barsPerChord: number;
  lastMutationAtBar: number;
  activeDimension: EvolutionDimension | null;
  pendingDimensions: EvolutionDimension[];
  tension: number;
  stability: number;
  mutationLabel: string;
  patternIndexes: {
    progression: number;
    drums: number;
    bass: number;
    arp: number;
    harmony: number;
  };
}

export interface EngineState {
  playing: boolean;
  bpm: number;
  macros: MacroState;
  frontPanel: FrontPanelState;
  layers: Record<LayerName, LayerOverrideState>;
  evolution: EvolutionState;
  currentChord: ChordInfo;
  beat: number;
}

export interface VisualState {
  lightNight: number;
  calmDrive: number;
  tone: number;
  groove: number;
  chords: number;
  arp: number;
  space: number;
  texture: number;
  motion: number;
  glow: number;
  grain: number;
  intensity: number;
  mutationFlash: number;
  bpm: number;
}

export interface MutationPayload {
  dimension: EvolutionDimension;
  label: string;
  phraseIndex: number;
  bar: number;
}

type BeatLayers = { kick: boolean; snare: boolean; hihat: boolean };

export type BeatCallback = (beat: number, layers: BeatLayers) => void;
export type PhraseCallback = (state: { index: number; bar: number; barsPerPhrase: number; barsPerChord: number }) => void;
export type MutationCallback = (payload: MutationPayload) => void;

const DEFAULT_MACROS: MacroState = {
  lightNight: 0.28,
  calmDrive: 0.36,
};

const DEFAULT_FRONT_PANEL: FrontPanelState = {
  tone: 0.58,
  groove: 0.42,
  chords: 0.46,
  arp: 0.5,
  space: 0.52,
  texture: 0.48,
};

const DEFAULT_LAYERS: Record<LayerName, LayerOverrideState> = {
  drums: { enabled: true, level: 0.74, paramA: 0.38, paramB: 0.56 },
  bass: { enabled: true, level: 0.68, paramA: 0.42, paramB: 0.48 },
  pad: { enabled: true, level: 0.54, paramA: 0.56, paramB: 0.52 },
  arp: { enabled: true, level: 0.56, paramA: 0.48, paramB: 0.42 },
  atmo: { enabled: true, level: 0.34, paramA: 0.46, paramB: 0.5 },
};

const ROOT_TO_SEMITONE: Record<string, number> = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
};

const CHORD_QUALITY_LABELS: Record<ChordQualityName, string> = {
  maj7: 'maj7',
  maj9: 'maj9',
  sixNine: '6/9',
  add9: 'add9',
  sus2: 'sus2',
  sixSus2: '6sus2',
  m7: 'm7',
  m9: 'm9',
  m11: 'm11',
  maj7Sharp11: 'maj7#11',
  dom9sus: '9sus',
  sevenSus4: '7sus4',
};

const MUTATION_LABELS: Record<EvolutionDimension, string[]> = {
  drums: ['Groove shifted', 'Rhythm reorganized', 'Beat restructured', 'Pattern evolved'],
  bass: ['Bass line turned', 'Low end evolved', 'Bass pattern grew'],
  harmony: ['Harmony leapt', 'Chord color shifted', 'New harmonic ground', 'Voicings drifted'],
  arp: ['Arp pattern branched', 'Top line evolved', 'Arp motion grew'],
  fx: ['The room widened', 'Air thickened', 'Space bloomed'],
};

const LAYER_ORDER: LayerName[] = ['drums', 'bass', 'pad', 'arp', 'atmo'];

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function lerp(start: number, end: number, amount: number) {
  return start + (end - start) * amount;
}

function randomSigned(amount: number) {
  return (Math.random() * 2 - 1) * amount;
}

function noteNameToSemitone(note: string) {
  const semitone = ROOT_TO_SEMITONE[note];
  if (semitone === undefined) {
    throw new Error(`Unsupported note name: ${note}`);
  }
  return semitone;
}

function midiToNote(midi: number) {
  return Tone.Frequency(midi, 'midi').toNote();
}

function uniqueSorted(values: number[]) {
  return [...new Set(values)].sort((a, b) => a - b);
}

function weightedPick<T extends string>(entries: Array<[T, number]>, exclude?: T): T {
  const filtered = entries.filter(([key]) => key !== exclude);
  const total = filtered.reduce((sum, [, weight]) => sum + weight, 0);
  let cursor = Math.random() * total;
  for (const [key, weight] of filtered) {
    cursor -= weight;
    if (cursor <= 0) return key;
  }
  return filtered[filtered.length - 1][0];
}

export type SceneId = 'sunrise' | 'golden' | 'drift' | 'pulse' | 'haze' | 'midnight';

export interface SceneDefinition {
  id: SceneId;
  label: string;
  macros: MacroState;
  frontPanel: Partial<FrontPanelState>;
}

export const SCENES: SceneDefinition[] = [
  {
    id: 'sunrise',
    label: 'Sunrise',
    macros: { lightNight: 0.08, calmDrive: 0.22 },
    frontPanel: { tone: 0.72, groove: 0.3, chords: 0.38, arp: 0.52, space: 0.6, texture: 0.28 },
  },
  {
    id: 'golden',
    label: 'Golden',
    macros: { lightNight: 0.25, calmDrive: 0.42 },
    frontPanel: { tone: 0.62, groove: 0.48, chords: 0.5, arp: 0.56, space: 0.48, texture: 0.42 },
  },
  {
    id: 'drift',
    label: 'Drift',
    macros: { lightNight: 0.42, calmDrive: 0.18 },
    frontPanel: { tone: 0.54, groove: 0.26, chords: 0.58, arp: 0.38, space: 0.72, texture: 0.52 },
  },
  {
    id: 'pulse',
    label: 'Pulse',
    macros: { lightNight: 0.35, calmDrive: 0.74 },
    frontPanel: { tone: 0.58, groove: 0.72, chords: 0.44, arp: 0.68, space: 0.38, texture: 0.46 },
  },
  {
    id: 'haze',
    label: 'Haze',
    macros: { lightNight: 0.65, calmDrive: 0.32 },
    frontPanel: { tone: 0.38, groove: 0.34, chords: 0.62, arp: 0.42, space: 0.78, texture: 0.68 },
  },
  {
    id: 'midnight',
    label: 'Midnight',
    macros: { lightNight: 0.88, calmDrive: 0.28 },
    frontPanel: { tone: 0.32, groove: 0.36, chords: 0.72, arp: 0.46, space: 0.68, texture: 0.58 },
  },
];

export class AudioEngine {
  private macros: MacroState = { ...DEFAULT_MACROS };
  private frontPanel: FrontPanelState = { ...DEFAULT_FRONT_PANEL };
  private layers: Record<LayerName, LayerOverrideState> = {
    drums: { ...DEFAULT_LAYERS.drums },
    bass: { ...DEFAULT_LAYERS.bass },
    pad: { ...DEFAULT_LAYERS.pad },
    arp: { ...DEFAULT_LAYERS.arp },
    atmo: { ...DEFAULT_LAYERS.atmo },
  };

  private evolution: EvolutionState = {
    phraseIndex: 0,
    bar: 0,
    barsPerPhrase: 16,
    barsPerChord: 2,
    lastMutationAtBar: 0,
    activeDimension: null,
    pendingDimensions: [],
    tension: 0.28,
    stability: 0.72,
    mutationLabel: 'Settling in',
    patternIndexes: {
      progression: 0,
      drums: 0,
      bass: 0,
      arp: 0,
      harmony: 0,
    },
  };

  private beatCallbacks: BeatCallback[] = [];
  private phraseCallbacks: PhraseCallback[] = [];
  private mutationCallbacks: MutationCallback[] = [];
  private chordChangeCallbacks: Array<(chord: ChordInfo) => void> = [];

  private masterLimiter!: Tone.Limiter;
  private masterComp!: Tone.Compressor;
  private masterDrive!: Tone.Distortion;
  private masterToneFilter!: Tone.Filter;

  private reverbSend!: Tone.Reverb;
  private delaySend!: Tone.FeedbackDelay;

  private kick!: Tone.MembraneSynth;
  private snareBody!: Tone.MembraneSynth;
  private snareNoise!: Tone.NoiseSynth;
  private hihat!: Tone.MetalSynth;
  private hihatOpen!: Tone.MetalSynth;
  private perc!: Tone.MembraneSynth;
  private drumBus!: Tone.Channel;
  private drumFilter!: Tone.Filter;

  private bass!: Tone.MonoSynth;
  private bassBus!: Tone.Channel;
  private bassFilter!: Tone.Filter;
  private bassDuck!: Tone.Gain;

  private pad!: Tone.PolySynth;
  private padBus!: Tone.Channel;
  private padFilter!: Tone.Filter;
  private padChorus!: Tone.Chorus;
  private padDuck!: Tone.Gain;

  private arp!: Tone.Synth;
  private arpSub!: Tone.Synth;
  private arpBus!: Tone.Channel;
  private arpFilter!: Tone.Filter;
  private arpDelay!: Tone.FeedbackDelay;
  private arpChorus!: Tone.Chorus;

  private noise!: Tone.Noise;
  private atmoBus!: Tone.Channel;
  private atmoFilter!: Tone.AutoFilter;

  private masterGain!: Tone.Gain;
  private fftAnalyser!: Tone.FFT;
  private waveformAnalyser!: Tone.Waveform;

  private vinylNoise!: Tone.Noise;
  private vinylFilter!: Tone.Filter;
  private vinylGain!: Tone.Gain;
  private tapeWobbleLfo!: Tone.LFO;
  private padBreathLfo!: Tone.LFO;
  private arpBreathLfo!: Tone.LFO;
  private tapeSaturator!: Tone.Distortion;

  private activeDrumPattern: DrumPattern = DRUM_PATTERNS[0];
  private activeArpPattern: ArpPattern = ARP_PATTERNS[0];
  private activeBassSteps: BassStep[] = BASS_PATTERNS[0].steps;
  private markovChords = new MarkovChordProgression('C');
  private lorenz = new LorenzModulator();
  private arpLSystem = new LSystemPatternGenerator(0);
  private bassLSystem = new LSystemPatternGenerator(1);
  private currentMarkovChord: { root: string; quality: ChordQualityName } | null = null;

  private barLoopId: number | null = null;
  private drumSeqId: number | null = null;
  private bassSeqId: number | null = null;
  private arpSeqId: number | null = null;

  private currentBar = 0;
  private currentBeat = 0;
  private currentChordIndex = 0;
  private barsIntoChord = 0;
  private nextPhraseAtBar = 16;
  private lastMutationWallClock = 0;
  private lastSchedulerTick = 0;
  private transportWatchdogId: number | null = null;

  private playing = false;
  private initialized = false;
  private activeScene: SceneId | null = null;
  private sceneTransitionId: number | null = null;
  private drumTimingOffsets: number[] = new Array(16).fill(0);

  async init() {
    if (this.initialized) return;
    await Tone.start();
    await Tone.getContext().resume();
    this.initialized = true;

    this.masterGain = new Tone.Gain(1).toDestination();
    this.masterLimiter = new Tone.Limiter(-1).connect(this.masterGain);
    this.masterComp = new Tone.Compressor({
      threshold: -20,
      ratio: 3.5,
      attack: 0.01,
      release: 0.25,
    }).connect(this.masterLimiter);

    this.masterDrive = new Tone.Distortion({
      distortion: 0.08,
      wet: 0.16,
    }).connect(this.masterComp);

    this.masterToneFilter = new Tone.Filter({
      frequency: 16000,
      type: 'lowpass',
      rolloff: -24,
      Q: 0.8,
    }).connect(this.masterDrive);

    this.reverbSend = new Tone.Reverb({
      decay: 3.2,
      wet: 0.28,
      preDelay: 0.02,
    }).connect(this.masterToneFilter);
    await this.reverbSend.ready;

    this.delaySend = new Tone.FeedbackDelay({
      delayTime: '8n.',
      feedback: 0.22,
      wet: 0.14,
    }).connect(this.masterToneFilter);

    this.fftAnalyser = new Tone.FFT(128);
    this.waveformAnalyser = new Tone.Waveform(512);
    this.masterComp.connect(this.fftAnalyser);
    this.masterComp.connect(this.waveformAnalyser);

    this.initDrums();
    this.initBass();
    this.initPad();
    this.initArp();
    this.initAtmosphere();
    this.initLoFi();

    const transport = Tone.getTransport();
    transport.timeSignature = 4;
    transport.swingSubdivision = '16n';
    transport.bpm.value = this.getTargetBpm();

    this.applyContinuousState(true);
    this.syncEvolutionMetrics();
  }

  private initDrums() {
    this.drumBus = new Tone.Channel({ volume: -7 }).connect(this.masterToneFilter);
    this.drumFilter = new Tone.Filter({ frequency: 9000, type: 'lowpass' }).connect(this.drumBus);

    this.kick = new Tone.MembraneSynth({
      pitchDecay: 0.06,
      octaves: 5.5,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.003, decay: 0.42, sustain: 0.01, release: 0.4, attackCurve: 'exponential' },
    }).connect(this.drumFilter);

    this.snareBody = new Tone.MembraneSynth({
      pitchDecay: 0.012,
      octaves: 3.5,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.002, decay: 0.18, sustain: 0, release: 0.15 },
    }).connect(this.drumFilter);

    this.snareNoise = new Tone.NoiseSynth({
      noise: { type: 'pink' },
      envelope: { attack: 0.002, decay: 0.2, sustain: 0, release: 0.16 },
    }).connect(this.drumFilter);

    this.hihat = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.06, release: 0.02 },
      harmonicity: 5.1,
      modulationIndex: 22,
      resonance: 3400,
      octaves: 1.4,
      volume: -14,
    }).connect(this.drumFilter);
    this.hihat.frequency.value = 400;

    this.hihatOpen = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.32, release: 0.08 },
      harmonicity: 5.1,
      modulationIndex: 20,
      resonance: 3200,
      octaves: 1.5,
      volume: -16,
    }).connect(this.drumFilter);
    this.hihatOpen.frequency.value = 390;

    this.perc = new Tone.MembraneSynth({
      pitchDecay: 0.015,
      octaves: 2.2,
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.002, decay: 0.1, sustain: 0, release: 0.08 },
    }).connect(this.drumFilter);

    this.drumBus.connect(this.reverbSend);
  }

  private initBass() {
    this.bassBus = new Tone.Channel({ volume: -10 }).connect(this.masterToneFilter);
    this.bassDuck = new Tone.Gain(1).connect(this.bassBus);
    this.bassFilter = new Tone.Filter({
      frequency: 520,
      type: 'lowpass',
      rolloff: -24,
      Q: 2,
    }).connect(this.bassDuck);

    this.bass = new Tone.MonoSynth({
      oscillator: { type: 'fatsawtooth', count: 2, spread: 18 },
      filter: { Q: 2.5, type: 'lowpass', rolloff: -24 },
      envelope: { attack: 0.01, decay: 0.18, sustain: 0.55, release: 0.35 },
      filterEnvelope: {
        attack: 0.01,
        decay: 0.18,
        sustain: 0.35,
        release: 0.24,
        baseFrequency: 70,
        octaves: 2.8,
      },
    }).connect(this.bassFilter);
  }

  private initPad() {
    this.padBus = new Tone.Channel({ volume: -14 }).connect(this.masterToneFilter);
    this.padDuck = new Tone.Gain(1).connect(this.padBus);
    this.padFilter = new Tone.Filter({
      frequency: 2200,
      type: 'lowpass',
      rolloff: -12,
    }).connect(this.padDuck);

    this.padChorus = new Tone.Chorus({
      frequency: 1.2,
      delayTime: 3.4,
      depth: 0.68,
      wet: 0.38,
    }).connect(this.padFilter);
    this.padChorus.start();

    this.pad = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 1.005,
      modulationIndex: 0.8,
      oscillator: { type: 'sine' },
      envelope: {
        attack: 1.6,
        decay: 0.8,
        sustain: 0.92,
        release: 4.2,
        attackCurve: 'sine' as Tone.EnvelopeCurve,
        releaseCurve: 'exponential' as Tone.EnvelopeCurve,
      },
      modulation: { type: 'sine' },
      modulationEnvelope: {
        attack: 2.4,
        decay: 0.6,
        sustain: 0.65,
        release: 3.0,
      },
    }).connect(this.padChorus);

    this.padBus.connect(this.reverbSend);
    this.padBus.connect(this.delaySend);
  }

  private initArp() {
    this.arpBus = new Tone.Channel({ volume: -11 }).connect(this.masterToneFilter);
    this.arpFilter = new Tone.Filter({
      frequency: 2400,
      type: 'lowpass',
      rolloff: -24,
    }).connect(this.arpBus);

    this.arpChorus = new Tone.Chorus({
      frequency: 0.8,
      delayTime: 2.8,
      depth: 0.45,
      wet: 0.28,
    }).connect(this.arpFilter);
    this.arpChorus.start();

    this.arpDelay = new Tone.FeedbackDelay({
      delayTime: '16n',
      feedback: 0.24,
      wet: 0.26,
    }).connect(this.arpChorus);

    this.arp = new Tone.Synth({
      oscillator: { type: 'sine4' },
      envelope: { attack: 0.02, decay: 0.22, sustain: 0.12, release: 0.5 },
      volume: -8,
    }).connect(this.arpDelay);

    this.arpSub = new Tone.Synth({
      oscillator: { type: 'sine3' },
      envelope: { attack: 0.03, decay: 0.24, sustain: 0.1, release: 0.6 },
      volume: -14,
    }).connect(this.arpDelay);

    this.arpBus.connect(this.reverbSend);
    this.arpBus.connect(this.delaySend);
  }

  private initAtmosphere() {
    this.atmoBus = new Tone.Channel({ volume: -22 }).connect(this.masterToneFilter);
    this.atmoFilter = new Tone.AutoFilter({
      frequency: '2m',
      baseFrequency: 160,
      octaves: 3,
      wet: 1,
    }).connect(this.atmoBus);
    this.atmoFilter.start();

    this.noise = new Tone.Noise('brown').connect(this.atmoFilter);
    this.atmoBus.connect(this.reverbSend);
  }

  private initLoFi() {
    this.vinylGain = new Tone.Gain(0.018).connect(this.masterToneFilter);
    this.vinylFilter = new Tone.Filter({
      frequency: 3200,
      type: 'bandpass',
      Q: 0.8,
    }).connect(this.vinylGain);
    this.vinylNoise = new Tone.Noise('white').connect(this.vinylFilter);

    this.tapeSaturator = new Tone.Distortion({
      distortion: 0.06,
      wet: 0.12,
    }).connect(this.masterComp);

    this.tapeWobbleLfo = new Tone.LFO({
      frequency: 0.18,
      min: -6,
      max: 6,
      type: 'sine',
    });

    this.padBreathLfo = new Tone.LFO({
      frequency: 0.08,
      min: -200,
      max: 200,
      type: 'sine',
    });

    this.arpBreathLfo = new Tone.LFO({
      frequency: 0.12,
      min: -150,
      max: 150,
      type: 'sine',
    });
  }

  async start() {
    if (this.playing) return;
    await this.init();

    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel();
    transport.position = 0;

    this.currentBar = 0;
    this.currentBeat = 0;
    this.currentChordIndex = 0;
    this.barsIntoChord = 0;
    this.evolution.phraseIndex = 0;
    this.evolution.bar = 0;
    this.evolution.lastMutationAtBar = 0;
    this.evolution.activeDimension = null;
    this.evolution.pendingDimensions = [];
    this.evolution.mutationLabel = 'Settling in';
    this.evolution.barsPerPhrase = this.getTargetBarsPerPhrase();
    this.evolution.barsPerChord = this.getTargetBarsPerChord();
    this.nextPhraseAtBar = this.evolution.barsPerPhrase;

    this.evolution.patternIndexes.progression = 0;
    this.evolution.patternIndexes.drums = 0;
    this.evolution.patternIndexes.bass = 0;
    this.evolution.patternIndexes.arp = 0;
    this.evolution.patternIndexes.harmony = 0;
    this.lastSchedulerTick = performance.now();

    this.markovChords = new MarkovChordProgression('C');
    this.lorenz = new LorenzModulator();
    this.arpLSystem = new LSystemPatternGenerator(Math.floor(Math.random() * 5));
    this.bassLSystem = new LSystemPatternGenerator(Math.floor(Math.random() * 5));
    this.activeDrumPattern = generateEuclideanDrumPattern(
      this.macros.calmDrive,
      this.macros.lightNight,
      this.frontPanel.texture,
    );
    this.arpLSystem.evolve();
    this.activeArpPattern = this.arpLSystem.generateArpPattern();
    this.bassLSystem.evolve();
    this.activeBassSteps = this.bassLSystem.generateBassSteps();
    this.currentMarkovChord = this.markovChords.next(this.macros.lightNight, this.frontPanel.chords);

    this.syncEvolutionMetrics();

    this.scheduleBars();
    this.scheduleDrums();
    this.scheduleBass();
    this.scheduleArp();

    if (this.layers.atmo.enabled && this.noise.state !== 'started') {
      this.noise.start();
    }

    if (this.vinylNoise.state !== 'started') this.vinylNoise.start();

    this.triggerIntro();
    transport.start();
    this.playing = true;
    this.applyContinuousState(true);
    this.armTransportWatchdog();
  }

  stop() {
    if (!this.playing) return;
    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel();
    if (this.noise.state === 'started') this.noise.stop();
    if (this.vinylNoise.state === 'started') this.vinylNoise.stop();
    this.pad.releaseAll();
    this.playing = false;
    this.barLoopId = null;
    this.drumSeqId = null;
    this.bassSeqId = null;
    this.arpSeqId = null;
    if (this.transportWatchdogId !== null) {
      window.clearInterval(this.transportWatchdogId);
      this.transportWatchdogId = null;
    }
  }

  toggle() {
    if (this.playing) this.stop();
    else this.start();
    return this.playing;
  }

  setScene(sceneId: SceneId) {
    const scene = SCENES.find((s) => s.id === sceneId);
    if (!scene) return;

    if (this.sceneTransitionId !== null) {
      window.clearInterval(this.sceneTransitionId);
    }

    this.activeScene = sceneId;
    const targetMacros = { ...scene.macros };
    const targetFront = { ...DEFAULT_FRONT_PANEL, ...scene.frontPanel };
    const steps = 30;
    let step = 0;

    this.sceneTransitionId = window.setInterval(() => {
      step += 1;
      const t = step / steps;
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

      this.macros.lightNight = lerp(this.macros.lightNight, targetMacros.lightNight, ease * 0.12);
      this.macros.calmDrive = lerp(this.macros.calmDrive, targetMacros.calmDrive, ease * 0.12);

      for (const key of Object.keys(targetFront) as FrontControlName[]) {
        this.frontPanel[key] = lerp(this.frontPanel[key], targetFront[key], ease * 0.12);
      }

      this.markPending('drums', 'bass', 'harmony', 'arp', 'fx');
      this.applyContinuousState();

      if (step >= steps) {
        window.clearInterval(this.sceneTransitionId!);
        this.sceneTransitionId = null;
      }
    }, 28);
  }

  getActiveScene(): SceneId | null {
    return this.activeScene;
  }

  onBeat(callback: BeatCallback) {
    this.beatCallbacks.push(callback);
  }

  onPhrase(callback: PhraseCallback) {
    this.phraseCallbacks.push(callback);
  }

  onMutation(callback: MutationCallback) {
    this.mutationCallbacks.push(callback);
  }

  onChordChange(callback: (chord: ChordInfo) => void) {
    this.chordChangeCallbacks.push(callback);
  }

  setMacroAxis(axis: MacroAxisName, value: number) {
    this.macros[axis] = clamp(value);
    if (axis === 'lightNight') {
      this.markPending('harmony', 'fx');
    } else {
      this.markPending('drums', 'arp', 'bass');
    }
    this.applyContinuousState();
  }

  setFrontControl(control: FrontControlName, value: number) {
    this.frontPanel[control] = clamp(value);
    switch (control) {
      case 'groove':
        this.markPending('drums', 'bass');
        break;
      case 'chords':
        this.markPending('harmony');
        break;
      case 'arp':
        this.markPending('arp');
        break;
      case 'space':
      case 'texture':
        this.markPending('fx');
        break;
      default:
        break;
    }
    this.applyContinuousState();
  }

  setLayerOverride(layer: LayerName, patch: Partial<LayerOverrideState>) {
    const current = this.layers[layer];
    this.layers[layer] = {
      enabled: patch.enabled ?? current.enabled,
      level: clamp(patch.level ?? current.level),
      paramA: clamp(patch.paramA ?? current.paramA),
      paramB: clamp(patch.paramB ?? current.paramB),
    };

    if (layer === 'atmo' && this.playing) {
      if (this.layers.atmo.enabled && this.noise.state !== 'started') this.noise.start();
      if (!this.layers.atmo.enabled && this.noise.state === 'started') this.noise.stop();
    }

    if (layer === 'pad' && !this.layers.pad.enabled && this.playing) {
      this.pad.releaseAll();
    }

    this.applyContinuousState();
  }

  toggleLayer(layer: LayerName) {
    const enabled = !this.layers[layer].enabled;
    this.setLayerOverride(layer, { enabled });
    return enabled;
  }

  getEngineState(): EngineState {
    const liveBpm = this.initialized ? Math.round(Tone.getTransport().bpm.value) : this.getTargetBpm();
    return {
      playing: this.playing,
      bpm: liveBpm,
      macros: { ...this.macros },
      frontPanel: { ...this.frontPanel },
      layers: {
        drums: { ...this.layers.drums },
        bass: { ...this.layers.bass },
        pad: { ...this.layers.pad },
        arp: { ...this.layers.arp },
        atmo: { ...this.layers.atmo },
      },
      evolution: {
        ...this.evolution,
        pendingDimensions: [...this.evolution.pendingDimensions],
        patternIndexes: { ...this.evolution.patternIndexes },
      },
      currentChord: this.getCurrentChord(),
      beat: this.currentBeat,
    };
  }

  getVisualState(): VisualState {
    const motion = clamp(this.macros.calmDrive * 0.58 + this.frontPanel.groove * 0.26 + this.frontPanel.arp * 0.16);
    const glow = clamp((1 - this.macros.lightNight) * 0.52 + this.frontPanel.space * 0.3 + this.frontPanel.texture * 0.18);
    const grain = clamp(this.frontPanel.texture * 0.58 + this.macros.lightNight * 0.22 + (1 - this.frontPanel.tone) * 0.2);
    const intensity = clamp(this.macros.calmDrive * 0.54 + this.frontPanel.groove * 0.22 + this.frontPanel.texture * 0.12 + this.frontPanel.arp * 0.12);
    const mutationAge = Math.max(0, Date.now() - this.lastMutationWallClock);
    const mutationFlash = this.lastMutationWallClock === 0 ? 0 : clamp(1 - mutationAge / 2800);

    const liveBpm = this.initialized ? Math.round(Tone.getTransport().bpm.value) : this.getTargetBpm();

    return {
      lightNight: this.macros.lightNight,
      calmDrive: this.macros.calmDrive,
      tone: this.frontPanel.tone,
      groove: this.frontPanel.groove,
      chords: this.frontPanel.chords,
      arp: this.frontPanel.arp,
      space: this.frontPanel.space,
      texture: this.frontPanel.texture,
      motion,
      glow,
      grain,
      intensity,
      mutationFlash,
      bpm: liveBpm,
    };
  }

  getFFTValues() {
    if (!this.initialized) return new Float32Array(128);
    return this.fftAnalyser.getValue() as Float32Array;
  }

  getWaveformValues() {
    if (!this.initialized) return new Float32Array(512);
    return this.waveformAnalyser.getValue() as Float32Array;
  }

  private scheduleBars() {
    if (this.barLoopId !== null) {
      Tone.getTransport().clear(this.barLoopId);
    }

    this.barLoopId = Tone.getTransport().scheduleRepeat((time) => {
      try {
        this.lastSchedulerTick = performance.now();
        const bar = this.currentBar;
        this.evolution.bar = bar;

        if (bar === 0) {
          this.emitPhraseState(time);
        } else if (bar >= this.nextPhraseAtBar) {
          this.handlePhraseBoundary(time, bar);
        }

        const nextBarsPerChord = this.getTargetBarsPerChord();
        this.evolution.barsPerChord = nextBarsPerChord;

        if (bar === 0 || this.barsIntoChord >= nextBarsPerChord) {
          if (bar !== 0) {
            this.currentMarkovChord = this.markovChords.next(this.macros.lightNight, this.frontPanel.chords);
          }
          this.barsIntoChord = 0;
        }

        const chord = this.getCurrentChord();
        if (this.chordChangeCallbacks.length > 0) {
          Tone.getDraw().schedule(() => {
            this.chordChangeCallbacks.forEach((cb) => cb(chord));
          }, time);
        }

        if (this.layers.pad.enabled) {
          this.pad.releaseAll(time + 0.08);
          this.pad.triggerAttack(chord.notes, time + 0.1, this.layers.pad.level * 0.46);
        }

        this.barsIntoChord += 1;
        this.currentBar += 1;
      } catch {
        this.currentBar += 1;
      }
    }, '1m');
  }

  private scheduleDrums() {
    if (this.drumSeqId !== null) {
      Tone.getTransport().clear(this.drumSeqId);
    }

    let step = 0;
    this.drumSeqId = Tone.getTransport().scheduleRepeat((time) => {
      try {
        this.lastSchedulerTick = performance.now();
        if (step % 4 === 0) this.lorenz.step(4);
        const pattern = this.activeDrumPattern;
        const density = clamp(0.28 + this.macros.calmDrive * 0.3 + this.frontPanel.groove * 0.24 + this.layers.drums.paramA * 0.18);
        const vol = this.layers.drums.level;

        const kickHit = this.layers.drums.enabled && this.shouldTrigger(pattern.kick[step], density, true);
        const snareHit = this.layers.drums.enabled && this.shouldTrigger(pattern.snare[step], density * 0.95, true);
        const hihatHit = this.layers.drums.enabled && this.shouldTrigger(pattern.hihatClosed[step], density + 0.18, false);

        this.currentBeat = step;
        if (this.beatCallbacks.length > 0) {
          const payload: BeatLayers = { kick: kickHit, snare: snareHit, hihat: hihatHit };
          Tone.getDraw().schedule(() => {
            this.beatCallbacks.forEach((callback) => callback(step, payload));
          }, time);
        }

        if (!this.layers.drums.enabled) {
          step = (step + 1) % 16;
          return;
        }

        const ht = time + (this.drumTimingOffsets[step] || 0);

        if (kickHit) {
          this.kick.triggerAttackRelease('C1', '8n', time, pattern.kick[step] * vol);
          this.triggerSidechainDuck(time);
        }

        if (snareHit) {
          const velocity = pattern.snare[step] * vol;
          this.snareBody.triggerAttackRelease('E2', '16n', ht, velocity);
          this.snareNoise.triggerAttackRelease('16n', ht, velocity * 0.68);
        }

        if (hihatHit) {
          const hatVel = pattern.hihatClosed[step] * vol * 0.58 * (step % 4 === 0 ? 1.12 : step % 4 === 2 ? 0.88 : 1);
          this.hihat.triggerAttackRelease('16n', ht, hatVel);
        }

        if (this.shouldTrigger(pattern.hihatOpen[step], density * 0.82, false)) {
          this.hihatOpen.triggerAttackRelease('8n', ht, pattern.hihatOpen[step] * vol * 0.42);
        }

        if (this.shouldTrigger(pattern.perc[step], density * 0.74, false)) {
          this.perc.triggerAttackRelease('G4', '32n', ht, pattern.perc[step] * vol * 0.48);
        }

        step = (step + 1) % 16;
      } catch {
        step = (step + 1) % 16;
      }
    }, '16n');
  }

  private scheduleBass() {
    if (this.bassSeqId !== null) {
      Tone.getTransport().clear(this.bassSeqId);
    }

    let step = 0;
    this.bassSeqId = Tone.getTransport().scheduleRepeat((time) => {
      try {
        this.lastSchedulerTick = performance.now();
        const density = clamp(0.36 + this.macros.calmDrive * 0.24 + this.frontPanel.groove * 0.18);
        const vol = this.layers.bass.level;

        if (this.layers.bass.enabled) {
          const chord = this.getCurrentChord();
          for (const bassStep of this.activeBassSteps) {
            if (bassStep.step !== step) continue;
            if (bassStep.vel < 0.45 && Math.random() > density) continue;
            const octaveShift = (bassStep.octave ?? 0) * 12;
            const frequency = Tone.Frequency(chord.root).transpose(bassStep.interval + octaveShift);
            this.bass.triggerAttackRelease(frequency.toFrequency(), bassStep.dur, time, bassStep.vel * vol);
          }
        }

        step = (step + 1) % 16;
      } catch {
        step = (step + 1) % 16;
      }
    }, '16n');
  }

  private scheduleArp() {
    if (this.arpSeqId !== null) {
      Tone.getTransport().clear(this.arpSeqId);
    }

    let step = 0;
    let patternCursor = 0;

    this.arpSeqId = Tone.getTransport().scheduleRepeat((time) => {
      try {
        this.lastSchedulerTick = performance.now();
        const stride = this.getArpStride();
        if (step % stride !== 0) {
          step = (step + 1) % 16;
          return;
        }

        const density = clamp(
          0.62 + this.frontPanel.arp * 0.22 + this.macros.calmDrive * 0.1 + this.frontPanel.texture * 0.06,
          0.62,
          1,
        );
        const isDownbeat = step === 0 || step === 8;
        const isPatternStart = patternCursor === 0;
        const shouldPlay = isDownbeat || isPatternStart || Math.random() <= density;
        const pattern = this.activeArpPattern;

        if (this.layers.arp.enabled && shouldPlay) {
          const chord = this.getCurrentChord();
          const noteIndex = pattern.steps[patternCursor % pattern.steps.length];
          const note = chord.arpNotes[noteIndex % chord.arpNotes.length];
          const octaveLift = this.getArpOctaveLift(patternCursor);
          const duration = this.getArpDuration();
          const velocity = clamp(0.58 + this.frontPanel.arp * 0.24 + (patternCursor % 3) * 0.04, 0.5, 0.95);
          const frequency = Tone.Frequency(note).transpose(octaveLift);
          this.arp.triggerAttackRelease(frequency.toNote(), duration, time, velocity);
          if (this.layers.arp.paramB > 0.2) {
            const subFreq = Tone.Frequency(note).transpose(octaveLift + 12);
            this.arpSub.triggerAttackRelease(subFreq.toNote(), duration, time, velocity * 0.5);
          }
          patternCursor += 1;
        }

        step = (step + 1) % 16;
        if (step === 0) {
          patternCursor = patternCursor % pattern.steps.length;
        }
      } catch {
        step = (step + 1) % 16;
      }
    }, '16n');
  }

  private handlePhraseBoundary(time: number, bar: number) {
    this.regenerateTimingOffsets();

    this.reverbSend.wet.setValueAtTime(this.reverbSend.wet.value, time);
    this.reverbSend.wet.linearRampToValueAtTime(
      Math.min(0.82, (this.reverbSend.wet.value as number) + 0.25),
      time + 0.5,
    );
    this.reverbSend.wet.linearRampToValueAtTime(
      0.12 + this.frontPanel.space * 0.36 + this.frontPanel.texture * 0.08,
      time + 3.5,
    );

    const dominant = this.consumeNextMutation();
    const dimensions = [dominant];
    const allowSecondTurn = this.macros.calmDrive > 0.78 && Math.random() > 0.5;
    if (allowSecondTurn) {
      dimensions.push(this.consumeNextMutation(dominant));
    }

    for (const dimension of dimensions) {
      this.applyMutationDimension(dimension);
    }

    this.evolution.phraseIndex += 1;
    this.evolution.bar = bar;
    this.evolution.lastMutationAtBar = bar;
    this.evolution.activeDimension = dominant;
    this.evolution.barsPerPhrase = this.getTargetBarsPerPhrase();
    this.nextPhraseAtBar = bar + this.evolution.barsPerPhrase;
    this.evolution.mutationLabel = this.getMutationLabel(dominant);
    this.lastMutationWallClock = Date.now();
    this.syncEvolutionMetrics();

    Tone.getDraw().schedule(() => {
      this.emitPhraseState();
      const payload: MutationPayload = {
        dimension: dominant,
        label: this.evolution.mutationLabel,
        phraseIndex: this.evolution.phraseIndex,
        bar,
      };
      this.mutationCallbacks.forEach((callback) => callback(payload));
    }, time);
  }

  private emitPhraseState(time?: number) {
    const call = () => {
      this.phraseCallbacks.forEach((callback) =>
        callback({
          index: this.evolution.phraseIndex,
          bar: this.evolution.bar,
          barsPerPhrase: this.evolution.barsPerPhrase,
          barsPerChord: this.evolution.barsPerChord,
        }),
      );
    };

    if (time !== undefined) {
      Tone.getDraw().schedule(call, time);
    } else {
      call();
    }
  }

  private consumeNextMutation(exclude?: EvolutionDimension): EvolutionDimension {
    const pending = this.evolution.pendingDimensions.find((dimension) => dimension !== exclude);
    if (pending) {
      this.evolution.pendingDimensions = this.evolution.pendingDimensions.filter((dimension) => dimension !== pending);
      return pending;
    }

    return weightedPick<EvolutionDimension>(
      [
        ['drums', 1.1 + this.frontPanel.groove + this.macros.calmDrive * 0.7],
        ['bass', 0.8 + this.frontPanel.groove * 0.4 + this.macros.calmDrive * 0.4],
        ['harmony', 1 + this.frontPanel.chords + this.macros.lightNight * 0.4],
        ['arp', 0.9 + this.frontPanel.arp + this.macros.calmDrive * 0.5],
        ['fx', 0.95 + this.frontPanel.space + this.frontPanel.texture * 0.7],
      ],
      exclude,
    );
  }

  private applyMutationDimension(dimension: EvolutionDimension) {
    switch (dimension) {
      case 'drums':
        this.activeDrumPattern = generateEuclideanDrumPattern(
          this.frontPanel.groove * 0.55 + this.macros.calmDrive * 0.45,
          this.macros.lightNight + randomSigned(0.12),
          this.frontPanel.texture,
        );
        this.evolution.patternIndexes.drums += 1;
        break;
      case 'bass':
        this.bassLSystem.evolve();
        this.activeBassSteps = this.bassLSystem.generateBassSteps();
        this.evolution.patternIndexes.bass += 1;
        break;
      case 'harmony':
        this.currentMarkovChord = this.markovChords.leap(this.macros.lightNight, this.frontPanel.chords);
        this.evolution.patternIndexes.harmony = (this.evolution.patternIndexes.harmony + 1) % 3;
        break;
      case 'arp':
        this.arpLSystem.evolve();
        this.activeArpPattern = this.arpLSystem.generateArpPattern();
        this.evolution.patternIndexes.arp += 1;
        break;
      case 'fx':
        this.frontPanel.space = clamp(this.frontPanel.space + randomSigned(0.08));
        this.frontPanel.texture = clamp(this.frontPanel.texture + randomSigned(0.06));
        break;
    }

    this.applyContinuousState();
  }

  private morphIndex(current: number, total: number, targetBias: number) {
    const center = Math.round(clamp(targetBias) * (total - 1));
    const step = center === current ? (Math.random() > 0.5 ? 1 : -1) : Math.sign(center - current);
    const next = current + step;
    return clamp(next, 0, total - 1);
  }

  private markPending(...dimensions: EvolutionDimension[]) {
    for (const dimension of dimensions) {
      if (!this.evolution.pendingDimensions.includes(dimension)) {
        this.evolution.pendingDimensions.push(dimension);
      }
    }
  }

  private shouldTrigger(value: number, density: number, alwaysKeepStrongHits: boolean) {
    if (value <= 0) return false;
    if (alwaysKeepStrongHits && value >= 0.72) return true;
    const probability = clamp(value * 0.9 + density * 0.5);
    return Math.random() <= probability;
  }

  private applyContinuousState(skipRamps = false) {
    if (!this.initialized) return;

    const brightness = clamp(this.frontPanel.tone * 0.62 + (1 - this.macros.lightNight) * 0.38);
    const darkness = 1 - brightness;
    const drive = this.macros.calmDrive;
    const toneTime = skipRamps ? 0 : 0.6;
    const lorenzMod = this.lorenz.getModulation(this.frontPanel.texture * 0.3);

    Tone.getTransport().bpm.rampTo(this.getTargetBpm(), skipRamps ? 0.01 : 1.8);
    Tone.getTransport().swing = clamp(0.01 + this.frontPanel.groove * 0.11 + drive * 0.05 + this.layers.drums.paramA * 0.04, 0, 0.22);

    this.masterToneFilter.frequency.rampTo(lerp(2600, 16800, brightness), toneTime);
    this.masterToneFilter.Q.rampTo(0.6 + darkness * 1.6 + this.layers.bass.paramA * 0.6, toneTime);
    this.masterDrive.distortion = clamp(0.03 + (1 - this.frontPanel.tone) * 0.16 + drive * 0.05 + darkness * 0.06, 0, 0.35);
    this.masterDrive.wet.rampTo(0.06 + this.frontPanel.texture * 0.16 + darkness * 0.08, toneTime);

    this.drumFilter.frequency.rampTo(lerp(2200, 13500, brightness) + this.layers.drums.paramB * 2200, toneTime);
    this.bassFilter.frequency.rampTo(lerp(180, 980, brightness) + this.layers.bass.paramB * 220, toneTime);
    this.bassFilter.Q.rampTo(1.4 + this.layers.bass.paramA * 4.5 + drive * 1.2, toneTime);
    this.bass.set({
      filterEnvelope: {
        octaves: 1.6 + this.frontPanel.tone * 1.2 + this.layers.bass.paramB * 2.2,
      },
    });

    this.padFilter.frequency.rampTo(lerp(700, 5200, brightness) + this.frontPanel.texture * 900 + lorenzMod.x * 600, toneTime);
    this.padChorus.depth = clamp(0.26 + this.frontPanel.texture * 0.46 + this.layers.pad.paramA * 0.18, 0, 1);
    this.padChorus.delayTime = 1.8 + this.layers.pad.paramB * 5.4 + this.frontPanel.space * 1.6;
    this.padChorus.wet.rampTo(0.18 + this.frontPanel.texture * 0.22 + this.frontPanel.space * 0.08, toneTime);
    this.pad.set({
      harmonicity: 1.002 + this.layers.pad.paramA * 0.012 + brightness * 0.004,
      modulationIndex: 0.4 + this.frontPanel.texture * 1.2 + darkness * 0.9,
    } as never);

    this.arpFilter.frequency.rampTo(lerp(800, 3800, brightness) + this.frontPanel.arp * 400 + lorenzMod.z * 400, toneTime);
    this.arpDelay.feedback.rampTo(0.16 + this.frontPanel.space * 0.32 + this.layers.arp.paramB * 0.08, toneTime);
    this.arpDelay.wet.rampTo(0.14 + this.frontPanel.space * 0.18 + this.frontPanel.texture * 0.06, toneTime);
    this.arpChorus.depth = clamp(0.2 + this.frontPanel.space * 0.4 + this.layers.arp.paramB * 0.2, 0, 1);
    this.arpChorus.wet.rampTo(0.16 + this.frontPanel.texture * 0.2 + this.frontPanel.space * 0.1, toneTime);
    this.arp.set({
      oscillator: {
        type: 'custom',
        partials: this.macros.lightNight > 0.58
          ? [1, 0.3, 0.12, 0.06, 0.02, 0.14, 0.01, 0.08]
          : [1, 0.5, 0.2, 0.1, 0.04, 0.1, 0.03, 0.05],
      } as { type: 'custom'; partials: number[] },
      envelope: {
        attack: 0.006 + (1 - this.frontPanel.arp) * 0.012,
        decay: 0.14 + this.frontPanel.arp * 0.08,
        sustain: 0.12 + this.layers.arp.paramA * 0.2,
        release: this.getArpRelease(),
      },
    });

    this.atmoFilter.baseFrequency = 110 + brightness * 180;
    this.atmoFilter.octaves = 1.8 + this.frontPanel.texture * 3.8 + this.layers.atmo.paramB * 1.2;
    this.atmoFilter.frequency.rampTo(0.05 + drive * 1.5 + this.layers.atmo.paramA * 0.9, toneTime);

    this.reverbSend.decay = 1.8 + this.frontPanel.space * 4.6 + darkness * 1.2 + lorenzMod.y * 1.2;
    this.reverbSend.wet.rampTo(0.12 + this.frontPanel.space * 0.36 + this.frontPanel.texture * 0.08, toneTime);
    this.delaySend.feedback.rampTo(0.12 + this.frontPanel.space * 0.32, toneTime);
    this.delaySend.wet.rampTo(0.06 + this.frontPanel.space * 0.22 + drive * 0.04, toneTime);

    if (this.vinylGain) {
      this.vinylGain.gain.rampTo(0.008 + this.frontPanel.texture * 0.022 + this.macros.lightNight * 0.012, toneTime);
    }
    if (this.tapeSaturator) {
      this.tapeSaturator.wet.rampTo(0.06 + this.frontPanel.texture * 0.14 + darkness * 0.06, toneTime);
    }

    this.applyLayerLevels();
    this.syncEvolutionMetrics();
  }

  private applyLayerLevels() {
    const brightness = clamp(this.frontPanel.tone * 0.5 + (1 - this.macros.lightNight) * 0.5);
    const darkness = 1 - brightness;

    const targets: Record<LayerName, number> = {
      drums: -6.5 + this.macros.calmDrive * 2.4 + this.frontPanel.groove * 1.2,
      bass: -8.5 + this.macros.calmDrive * 1.8 + this.frontPanel.tone * 0.8,
      pad: -12.5 + this.frontPanel.space * 1.6 + brightness * 1.2,
      arp: -8 + this.frontPanel.arp * 3.2 + this.macros.calmDrive * 1.2,
      atmo: -24 + this.frontPanel.texture * 4.5 + darkness * 2,
    };

    for (const layer of LAYER_ORDER) {
      const state = this.layers[layer];
      const db = state.enabled && state.level > 0 ? Tone.gainToDb(state.level) + targets[layer] : -72;

      switch (layer) {
        case 'drums':
          this.drumBus.volume.rampTo(db, 0.12);
          break;
        case 'bass':
          this.bassBus.volume.rampTo(db, 0.12);
          break;
        case 'pad':
          this.padBus.volume.rampTo(db, 0.12);
          break;
        case 'arp':
          this.arpBus.volume.rampTo(db, 0.12);
          break;
        case 'atmo':
          this.atmoBus.volume.rampTo(db, 0.12);
          break;
      }
    }
  }

  private syncEvolutionMetrics() {
    this.evolution.barsPerPhrase = this.getTargetBarsPerPhrase();
    this.evolution.barsPerChord = this.getTargetBarsPerChord();
    this.evolution.tension = clamp(
      this.macros.lightNight * 0.32 +
        this.macros.calmDrive * 0.26 +
        this.frontPanel.chords * 0.2 +
        this.frontPanel.texture * 0.12 +
        this.evolution.patternIndexes.harmony * 0.08,
    );
    this.evolution.stability = clamp(
      1 -
        (this.macros.calmDrive * 0.22 +
          this.frontPanel.texture * 0.16 +
          this.frontPanel.arp * 0.08 +
          this.evolution.pendingDimensions.length * 0.08),
    );
  }

  private getCurrentChord(): ChordInfo {
    if (this.currentMarkovChord) {
      return this.buildChordFromMarkov(this.currentMarkovChord.root, this.currentMarkovChord.quality);
    }
    const progression = PROGRESSION_BANK[this.evolution.patternIndexes.progression];
    return this.buildChordInfo(progression.slots[this.currentChordIndex]);
  }

  private buildChordInfo(slot: (typeof PROGRESSION_BANK)[number]['slots'][number]): ChordInfo {
    const darkness = clamp(this.macros.lightNight * 0.75 + this.evolution.tension * 0.25);
    const useNightSide =
      darkness > 0.56 ||
      (darkness > 0.38 &&
        (this.evolution.phraseIndex + this.currentChordIndex + this.evolution.patternIndexes.harmony) % 2 === 1);

    const rootName = useNightSide ? slot.nightRoot : slot.dayRoot;
    const qualityPool = useNightSide ? slot.nightQualities : slot.dayQualities;

    const colorIndex = Math.min(
      qualityPool.length - 1,
      Math.floor(clamp(this.frontPanel.chords * 0.68 + this.evolution.patternIndexes.harmony * 0.16) * qualityPool.length),
    );
    const quality = qualityPool[colorIndex];

    const rootSemitone = noteNameToSemitone(rootName);
    const intervals = CHORD_QUALITIES[quality];
    const openness = clamp(this.frontPanel.chords * 0.56 + this.frontPanel.space * 0.2 + (1 - this.macros.lightNight) * 0.24);
    const baseMidi = Math.round(lerp(33, 38, 1 - this.macros.lightNight)) + rootSemitone;

    const padNotes = uniqueSorted(
      intervals.map((interval, index) => {
        let midi = baseMidi + interval;
        if (index >= 2 && openness > 0.28) midi += 12;
        if (index >= 4 && openness > 0.62) midi += 12;
        if (this.macros.lightNight > 0.7 && index === 0) midi -= 12;
        return midi;
      }),
    ).slice(0, 6);

    const arpBase = Math.round(lerp(40, 46, this.frontPanel.arp)) + rootSemitone;
    const arpNotes = uniqueSorted(
      intervals.slice(0, 5).map((interval) => arpBase + interval),
    ).slice(0, 6);

    const bassBase = Math.round(lerp(22, 27, 1 - this.macros.lightNight)) + rootSemitone;

    return {
      name: `${rootName}${CHORD_QUALITY_LABELS[quality]}`,
      quality,
      notes: padNotes.map(midiToNote),
      root: midiToNote(bassBase),
      arpNotes: arpNotes.map(midiToNote),
    };
  }

  private buildChordFromMarkov(rootName: string, quality: ChordQualityName): ChordInfo {
    const rootSemitone = noteNameToSemitone(rootName);
    const intervals = CHORD_QUALITIES[quality];
    const openness = clamp(this.frontPanel.chords * 0.56 + this.frontPanel.space * 0.2 + (1 - this.macros.lightNight) * 0.24);
    const baseMidi = Math.round(lerp(33, 38, 1 - this.macros.lightNight)) + rootSemitone;

    const padNotes = uniqueSorted(
      intervals.map((interval, index) => {
        let midi = baseMidi + interval;
        if (index >= 2 && openness > 0.28) midi += 12;
        if (index >= 4 && openness > 0.62) midi += 12;
        if (this.macros.lightNight > 0.7 && index === 0) midi -= 12;
        return midi;
      }),
    ).slice(0, 6);

    const arpBase = Math.round(lerp(40, 46, this.frontPanel.arp)) + rootSemitone;
    const arpNotes = uniqueSorted(
      intervals.slice(0, 5).map((interval) => arpBase + interval),
    ).slice(0, 6);

    const bassBase = Math.round(lerp(22, 27, 1 - this.macros.lightNight)) + rootSemitone;

    return {
      name: `${rootName}${CHORD_QUALITY_LABELS[quality]}`,
      quality,
      notes: padNotes.map(midiToNote),
      root: midiToNote(bassBase),
      arpNotes: arpNotes.map(midiToNote),
    };
  }

  private pickInitialProgressionIndex() {
    return this.pickProgressionIndex(true);
  }

  private pickProgressionIndex(initial = false) {
    const targetBias = clamp(this.macros.lightNight * 0.8 + this.frontPanel.chords * 0.2);
    let bestIndex = 0;
    let bestScore = Infinity;

    PROGRESSION_BANK.forEach((progression, index) => {
      const continuityPenalty = initial ? 0 : Math.abs(index - this.evolution.patternIndexes.progression) * 0.08;
      const score = Math.abs(progression.bias - targetBias) + continuityPenalty + Math.random() * (initial ? 0.04 : 0.1);
      if (score < bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });

    return bestIndex;
  }

  private getTargetBpm() {
    return Math.round(lerp(70, 100, clamp(this.macros.calmDrive * 0.88 + this.frontPanel.groove * 0.12)));
  }

  private getTargetBarsPerPhrase() {
    return this.macros.calmDrive > 0.58 ? 8 : 16;
  }

  private getTargetBarsPerChord() {
    return this.macros.calmDrive > 0.52 ? 1 : 2;
  }

  private getArpStride() {
    const intensity = clamp(this.frontPanel.arp * 0.7 + this.macros.calmDrive * 0.2 + this.layers.arp.paramA * 0.1);
    if (intensity < 0.2) return 4;
    if (intensity < 0.58) return 2;
    return 1;
  }

  private getArpDuration() {
    const blend = clamp(this.frontPanel.arp * 0.66 + this.layers.arp.paramA * 0.2 + this.frontPanel.space * 0.14);
    if (blend < 0.24) return '4n';
    if (blend < 0.7) return '8n';
    return '16n';
  }

  private getArpRelease() {
    return 0.2 + this.frontPanel.space * 0.18 + this.layers.arp.paramA * 0.16;
  }

  private getArpOctaveLift(cursor: number) {
    const spread = clamp(this.frontPanel.arp * 0.56 + this.layers.arp.paramB * 0.32 + this.macros.calmDrive * 0.12);
    if (spread < 0.22) return 0;
    if (spread < 0.52) return cursor % 2 === 0 ? 0 : 12;
    if (spread < 0.78) return cursor % 3 === 0 ? 12 : 0;
    return cursor % 4 === 0 ? 24 : 12;
  }

  private regenerateTimingOffsets() {
    this.drumTimingOffsets = Array.from({ length: 16 }, (_, i) => {
      if (i === 0) return 0;
      if (i === 4 || i === 12) return 0;
      const swing = i % 2 === 1 ? 0.012 : -0.003;
      const jitter = (Math.random() * 2 - 1) * 0.007;
      return swing + jitter;
    });
  }

  private triggerSidechainDuck(time: number) {
    const duckAmount = 0.35 + this.macros.calmDrive * 0.15;
    const releaseTime = 0.16 + (1 - this.macros.calmDrive) * 0.08;
    this.padDuck.gain.setValueAtTime(duckAmount, time);
    this.padDuck.gain.linearRampToValueAtTime(1, time + releaseTime);
    this.bassDuck.gain.setValueAtTime(duckAmount + 0.1, time);
    this.bassDuck.gain.linearRampToValueAtTime(1, time + releaseTime * 0.8);
  }

  private getMutationLabel(dimension: EvolutionDimension) {
    const options = MUTATION_LABELS[dimension];
    return options[(this.evolution.phraseIndex + this.evolution.patternIndexes.harmony + options.length) % options.length];
  }

  private triggerIntro() {
    const now = Tone.now() + 0.04;
    const chord = this.getCurrentChord();

    if (this.layers.pad.enabled) {
      this.pad.releaseAll(now);
      this.pad.triggerAttack(chord.notes, now, this.layers.pad.level * 0.52);
    }

    if (this.layers.bass.enabled) {
      this.bass.triggerAttackRelease(chord.root, '8n', now + 0.02, this.layers.bass.level * 0.62);
    }

    if (this.layers.drums.enabled) {
      this.kick.triggerAttackRelease('C1', '8n', now + 0.04, this.layers.drums.level * 0.72);
      this.hihat.triggerAttackRelease('16n', now + 0.14, this.layers.drums.level * 0.28);
    }

    if (this.layers.arp.enabled && this.frontPanel.arp > 0.18) {
      this.arp.triggerAttackRelease(chord.arpNotes[0], '8n', now + 0.2, clamp(this.layers.arp.level * 0.72));
    }
  }

  private armTransportWatchdog() {
    if (this.transportWatchdogId !== null) {
      window.clearInterval(this.transportWatchdogId);
    }

    this.transportWatchdogId = window.setInterval(() => {
      if (!this.playing) return;

      const stalled = performance.now() - this.lastSchedulerTick > 2000;
      if (stalled) {
        this.recoverTransport();
      }
    }, 2500);
  }

  private recoverTransport() {
    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel();
    transport.position = 0;

    this.currentBar = 0;
    this.currentBeat = 0;
    this.currentChordIndex = 0;
    this.barsIntoChord = 0;
    this.evolution.bar = 0;
    this.lastSchedulerTick = performance.now();

    this.scheduleBars();
    this.scheduleDrums();
    this.scheduleBass();
    this.scheduleArp();

    this.triggerIntro();
    transport.start();
    this.armTransportWatchdog();
  }
}
