import type { ArpPattern, BassStep, ChordQualityName, DrumPattern } from './presets';

// ── Euclidean Rhythm Generator ──────────────────────────────

function euclidean(steps: number, pulses: number): boolean[] {
  pulses = Math.min(Math.max(Math.round(pulses), 0), steps);
  if (pulses === 0) return Array(steps).fill(false);
  if (pulses === steps) return Array(steps).fill(true);

  const pattern: boolean[] = Array(steps).fill(false);
  let bucket = 0;
  for (let i = 0; i < steps; i++) {
    bucket += pulses;
    if (bucket >= steps) {
      bucket -= steps;
      pattern[i] = true;
    }
  }
  return pattern;
}

function rotate<T>(arr: T[], amount: number): T[] {
  const n = arr.length;
  if (n === 0) return arr;
  const shift = ((Math.round(amount) % n) + n) % n;
  return [...arr.slice(shift), ...arr.slice(0, shift)];
}

/**
 * Generate a 16-step drum pattern using Euclidean distribution.
 * Each voice gets a different pulse count and rotation offset,
 * creating polyrhythmic interplay that shifts with the controls.
 */
export function generateEuclideanDrumPattern(
  density: number,
  rotation: number,
  variation: number,
): DrumPattern {
  const d = Math.max(0, Math.min(1, density));
  const r = Math.max(0, Math.min(1, rotation));
  const v = Math.max(0, Math.min(1, variation));

  const kickPulses = Math.round(2 + d * 4);
  const snarePulses = Math.round(1 + d * 2);
  const hihatPulses = Math.round(4 + d * 8);
  const openHatPulses = Math.round(d * 2);
  const percPulses = Math.round(1 + d * 3);

  const baseRot = Math.round(r * 15);

  const kickBool = rotate(euclidean(16, kickPulses), baseRot);
  const snareBool = rotate(euclidean(16, snarePulses), (baseRot + 4) % 16);
  const hihatBool = rotate(euclidean(16, hihatPulses), (baseRot + 2) % 16);
  const openHatBool = rotate(euclidean(16, openHatPulses), (baseRot + 6) % 16);
  const percBool = rotate(euclidean(16, percPulses), (baseRot + 3) % 16);

  const vel = (hit: boolean, step: number, base: number, accent: number): number => {
    if (!hit) return 0;
    const boost = step % 4 === 0 ? accent : step % 2 === 0 ? accent * 0.5 : 0;
    const jitter = (Math.random() * 2 - 1) * v * 0.15;
    return Math.max(0, Math.min(1, base + boost + jitter));
  };

  return {
    id: 'euclidean-gen',
    kick: kickBool.map((h, i) => vel(h, i, 0.82, 0.12)),
    snare: snareBool.map((h, i) => vel(h, i, 0.78, 0.1)),
    hihatClosed: hihatBool.map((h, i) => vel(h, i, 0.38, 0.14)),
    hihatOpen: openHatBool.map((h, i) => vel(h, i, 0.32, 0.08)),
    perc: percBool.map((h, i) => vel(h, i, 0.22, 0.06)),
  };
}

// ── Markov Chain Chord Progression ──────────────────────────

const ALL_ROOTS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

// Interval weights encode common harmonic movements.
// Bright favours 4ths, 5ths, major 2nds; dark favours minor 3rds, tritone subs.
const BRIGHT_WEIGHTS: [number, number][] = [
  [0, 0.3], [2, 2.0], [4, 1.5], [5, 3.0], [7, 2.5], [9, 1.8], [11, 0.6],
];

const DARK_WEIGHTS: [number, number][] = [
  [0, 0.3], [1, 1.2], [3, 3.0], [5, 2.5], [7, 1.5], [8, 2.0], [10, 1.8],
];

const BRIGHT_QUALITIES: ChordQualityName[] = ['maj7', 'maj9', 'sixNine', 'add9', 'sus2', 'sixSus2'];
const DARK_QUALITIES: ChordQualityName[] = ['m7', 'm9', 'm11', 'sevenSus4', 'dom9sus'];
const BRIDGE_QUALITIES: ChordQualityName[] = ['maj7Sharp11', 'dom9sus', 'sus2', 'sixSus2'];

export class MarkovChordProgression {
  private currentRoot: number;

  constructor(initialRoot = 'C') {
    const idx = ALL_ROOTS.indexOf(initialRoot);
    this.currentRoot = idx >= 0 ? idx : 0;
  }

  /** Advance by one chord using weighted interval probabilities. */
  next(lightNight: number, chords: number): { root: string; quality: ChordQualityName } {
    const weights = new Map<number, number>();
    for (const [interval, w] of BRIGHT_WEIGHTS) {
      weights.set(interval, (weights.get(interval) ?? 0) + w * (1 - lightNight));
    }
    for (const [interval, w] of DARK_WEIGHTS) {
      weights.set(interval, (weights.get(interval) ?? 0) + w * lightNight);
    }

    const entries = [...weights.entries()].filter(([, w]) => w > 0.05);
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let cursor = Math.random() * total;
    let interval = 5;
    for (const [iv, w] of entries) {
      cursor -= w;
      if (cursor <= 0) { interval = iv; break; }
    }

    this.currentRoot = (this.currentRoot + interval) % 12;
    return { root: ALL_ROOTS[this.currentRoot], quality: this.pickQuality(lightNight, chords) };
  }

  /** Force a dramatic root jump (minor/major 3rd or 6th). */
  leap(lightNight: number, chords: number): { root: string; quality: ChordQualityName } {
    const leaps = [3, 4, 8, 9];
    this.currentRoot = (this.currentRoot + leaps[Math.floor(Math.random() * leaps.length)]) % 12;
    return { root: ALL_ROOTS[this.currentRoot], quality: this.pickQuality(lightNight, chords) };
  }

  private pickQuality(lightNight: number, chords: number): ChordQualityName {
    let pool: ChordQualityName[];
    if (lightNight < 0.35) {
      pool = BRIGHT_QUALITIES;
    } else if (lightNight > 0.65) {
      pool = DARK_QUALITIES;
    } else {
      pool = [...BRIDGE_QUALITIES, ...(Math.random() > 0.5 ? BRIGHT_QUALITIES.slice(0, 3) : DARK_QUALITIES.slice(0, 3))];
    }
    return pool[Math.min(pool.length - 1, Math.floor(chords * pool.length))];
  }
}

// ── Lorenz Attractor Modulation ─────────────────────────────

/**
 * Classic Lorenz system producing three never-repeating, organic curves.
 * Outputs are normalised to 0-1 and used as slow modulation sources
 * for filters, reverb, and other continuous parameters.
 */
export class LorenzModulator {
  private x: number;
  private y: number;
  private z: number;
  private readonly sigma = 10;
  private readonly rho = 28;
  private readonly beta = 8 / 3;
  private readonly dt = 0.005;

  normX = 0.5;
  normY = 0.5;
  normZ = 0.5;

  constructor() {
    this.x = 1 + Math.random() * 2;
    this.y = 1 + Math.random() * 2;
    this.z = 20 + Math.random() * 5;
  }

  step(steps = 1): void {
    for (let i = 0; i < steps; i++) {
      const dx = this.sigma * (this.y - this.x);
      const dy = this.x * (this.rho - this.z) - this.y;
      const dz = this.x * this.y - this.beta * this.z;
      this.x += dx * this.dt;
      this.y += dy * this.dt;
      this.z += dz * this.dt;
    }
    this.normX = Math.max(0, Math.min(1, (this.x + 20) / 40));
    this.normY = Math.max(0, Math.min(1, (this.y + 30) / 60));
    this.normZ = Math.max(0, Math.min(1, this.z / 50));
  }

  /** Get bipolar modulation offsets scaled by amount (range: -amount .. +amount). */
  getModulation(amount: number): { x: number; y: number; z: number } {
    return {
      x: (this.normX - 0.5) * 2 * amount,
      y: (this.normY - 0.5) * 2 * amount,
      z: (this.normZ - 0.5) * 2 * amount,
    };
  }
}

// ── L-System Pattern Generator ──────────────────────────────

interface LSystemGrammar {
  axiom: string;
  rules: Record<string, string>;
}

const GRAMMARS: LSystemGrammar[] = [
  { axiom: 'A', rules: { A: 'AB', B: 'CA', C: 'BA' } },
  { axiom: 'A', rules: { A: 'ABA', B: 'BC', C: 'A' } },
  { axiom: 'AB', rules: { A: 'BC', B: 'AB', C: 'CA' } },
  { axiom: 'ABC', rules: { A: 'BA', B: 'AC', C: 'B' } },
  { axiom: 'A', rules: { A: 'ACB', B: 'A', C: 'BC' } },
];

// Rotating note-index mappings so the arp reaches all 5 chord tones
// and the mapping itself evolves across generations.
const ARP_MAPPINGS: Record<string, number>[] = [
  { A: 0, B: 1, C: 2 },
  { A: 0, B: 2, C: 4 },
  { A: 1, B: 3, C: 0 },
  { A: 4, B: 2, C: 0 },
  { A: 0, B: 3, C: 1 },
];

/**
 * Generates evolving arp and bass patterns from L-system string rewriting.
 * Each call to evolve() grows the grammar one generation, producing
 * self-similar sequences with fractal-like repetition-with-variation.
 */
export class LSystemPatternGenerator {
  private rules: Record<string, string>;
  private state: string;
  private generation = 0;

  constructor(grammarIndex = 0) {
    const g = GRAMMARS[grammarIndex % GRAMMARS.length];
    this.rules = { ...g.rules };
    this.state = g.axiom;
  }

  evolve(): void {
    let next = '';
    for (const ch of this.state) {
      next += this.rules[ch] ?? ch;
    }
    this.state = next;
    this.generation += 1;
    if (this.state.length > 64) {
      this.state = this.state.slice(-64);
    }
  }

  generateArpPattern(length = 8): ArpPattern {
    while (this.state.length < length) this.evolve();

    const map = ARP_MAPPINGS[this.generation % ARP_MAPPINGS.length];
    const offset = this.generation % Math.max(1, this.state.length - length);
    const window = this.state.slice(offset, offset + length);

    return {
      id: `lsys-${this.generation}`,
      steps: Array.from(window).map((ch) => (map[ch] ?? 0) % 5),
    };
  }

  generateBassSteps(): BassStep[] {
    while (this.state.length < 16) this.evolve();

    const intervalMap: Record<string, number> = { A: 0, B: 3, C: 5, D: 7, E: 10 };
    const offset = this.generation % Math.max(1, this.state.length - 16);
    const steps: BassStep[] = [];

    for (let i = 0; i < 16; i++) {
      const ch = this.state[(offset + i) % this.state.length];
      const strong = i === 0 || i === 8;
      const medium = i === 4 || i === 12;
      const weak = i === 6 || i === 14;

      if (strong || (medium && ch !== 'D') || (weak && ch === 'A')) {
        steps.push({
          step: i,
          dur: strong ? '4n' : medium ? '8n' : '16n',
          vel: strong ? 0.7 + Math.random() * 0.12 : 0.42 + Math.random() * 0.15,
          interval: intervalMap[ch] ?? 0,
          ...(ch === 'E' && { octave: -1 }),
        });
      }
    }

    if (steps.length === 0 || steps[0].step !== 0) {
      steps.unshift({ step: 0, dur: '4n', vel: 0.72, interval: 0 });
    }

    return steps;
  }

  switchGrammar(index: number): void {
    const g = GRAMMARS[index % GRAMMARS.length];
    this.rules = { ...g.rules };
    this.state = g.axiom;
    this.generation = 0;
  }

  getGeneration(): number {
    return this.generation;
  }
}
