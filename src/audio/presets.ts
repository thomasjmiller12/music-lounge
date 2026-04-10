export type ChordQualityName =
  | 'maj7'
  | 'maj9'
  | 'sixNine'
  | 'add9'
  | 'sus2'
  | 'sixSus2'
  | 'm7'
  | 'm9'
  | 'm11'
  | 'maj7Sharp11'
  | 'dom9sus'
  | 'sevenSus4';

export interface ProgressionSlot {
  dayRoot: string;
  dayQualities: ChordQualityName[];
  nightRoot: string;
  nightQualities: ChordQualityName[];
}

export interface ProgressionTemplate {
  id: string;
  bias: number;
  slots: ProgressionSlot[];
}

export interface DrumPattern {
  id: string;
  kick: number[];
  snare: number[];
  hihatClosed: number[];
  hihatOpen: number[];
  perc: number[];
}

export interface BassStep {
  step: number;
  dur: string;
  vel: number;
  interval: number;
  octave?: number;
}

export interface BassPattern {
  id: string;
  steps: BassStep[];
}

export interface ArpPattern {
  id: string;
  steps: number[];
}

export const CHORD_QUALITIES: Record<ChordQualityName, number[]> = {
  maj7: [0, 4, 7, 11],
  maj9: [0, 4, 7, 11, 14],
  sixNine: [0, 4, 7, 9, 14],
  add9: [0, 4, 7, 14],
  sus2: [0, 2, 7, 14],
  sixSus2: [0, 2, 7, 9, 14],
  m7: [0, 3, 7, 10],
  m9: [0, 3, 7, 10, 14],
  m11: [0, 3, 7, 10, 14, 17],
  maj7Sharp11: [0, 4, 7, 11, 18],
  dom9sus: [0, 5, 7, 10, 14],
  sevenSus4: [0, 5, 7, 10],
};

export const PROGRESSION_BANK: ProgressionTemplate[] = [
  {
    id: 'amber-loop',
    bias: 0.2,
    slots: [
      {
        dayRoot: 'C',
        dayQualities: ['maj7', 'maj9', 'sixNine'],
        nightRoot: 'A',
        nightQualities: ['m7', 'm9', 'm11'],
      },
      {
        dayRoot: 'A',
        dayQualities: ['m7', 'm9', 'm11'],
        nightRoot: 'F',
        nightQualities: ['maj7', 'maj7Sharp11', 'maj9'],
      },
      {
        dayRoot: 'F',
        dayQualities: ['maj7', 'maj9', 'add9'],
        nightRoot: 'C',
        nightQualities: ['add9', 'maj7Sharp11', 'sus2'],
      },
      {
        dayRoot: 'G',
        dayQualities: ['sus2', 'sixSus2', 'dom9sus'],
        nightRoot: 'E',
        nightQualities: ['m7', 'm9', 'sevenSus4'],
      },
    ],
  },
  {
    id: 'window-glow',
    bias: 0.38,
    slots: [
      {
        dayRoot: 'G',
        dayQualities: ['maj7', 'maj9', 'sixNine'],
        nightRoot: 'E',
        nightQualities: ['m7', 'm9', 'm11'],
      },
      {
        dayRoot: 'E',
        dayQualities: ['m7', 'm9', 'm11'],
        nightRoot: 'C',
        nightQualities: ['maj7', 'maj7Sharp11', 'add9'],
      },
      {
        dayRoot: 'C',
        dayQualities: ['maj7', 'add9', 'maj9'],
        nightRoot: 'G',
        nightQualities: ['add9', 'sus2', 'maj7Sharp11'],
      },
      {
        dayRoot: 'D',
        dayQualities: ['sus2', 'sixSus2', 'dom9sus'],
        nightRoot: 'B',
        nightQualities: ['m7', 'm9', 'sevenSus4'],
      },
    ],
  },
  {
    id: 'paper-lantern',
    bias: 0.55,
    slots: [
      {
        dayRoot: 'D',
        dayQualities: ['maj7', 'maj9', 'sixNine'],
        nightRoot: 'B',
        nightQualities: ['m7', 'm9', 'm11'],
      },
      {
        dayRoot: 'B',
        dayQualities: ['m7', 'm9', 'm11'],
        nightRoot: 'G',
        nightQualities: ['maj7', 'maj7Sharp11', 'maj9'],
      },
      {
        dayRoot: 'G',
        dayQualities: ['maj7', 'maj9', 'add9'],
        nightRoot: 'D',
        nightQualities: ['add9', 'sus2', 'maj7Sharp11'],
      },
      {
        dayRoot: 'A',
        dayQualities: ['sus2', 'dom9sus', 'sixSus2'],
        nightRoot: 'F#',
        nightQualities: ['m7', 'm9', 'sevenSus4'],
      },
    ],
  },
  {
    id: 'street-lights',
    bias: 0.78,
    slots: [
      {
        dayRoot: 'F',
        dayQualities: ['maj7', 'maj9', 'sixNine'],
        nightRoot: 'D',
        nightQualities: ['m7', 'm9', 'm11'],
      },
      {
        dayRoot: 'D',
        dayQualities: ['m7', 'm9', 'm11'],
        nightRoot: 'Bb',
        nightQualities: ['maj7', 'maj7Sharp11', 'maj9'],
      },
      {
        dayRoot: 'Bb',
        dayQualities: ['maj7', 'maj9', 'add9'],
        nightRoot: 'F',
        nightQualities: ['add9', 'sus2', 'maj7Sharp11'],
      },
      {
        dayRoot: 'C',
        dayQualities: ['sus2', 'dom9sus', 'sixSus2'],
        nightRoot: 'A',
        nightQualities: ['m7', 'm9', 'sevenSus4'],
      },
    ],
  },
];

export const DRUM_PATTERNS: DrumPattern[] = [
  {
    id: 'dusty-pocket',
    kick: [0.92, 0, 0, 0, 0, 0, 0.45, 0, 0.88, 0, 0, 0.35, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 0.82, 0, 0, 0, 0, 0, 0, 0, 0.86, 0, 0, 0.22],
    hihatClosed: [0.42, 0.25, 0.48, 0.24, 0.44, 0.26, 0.5, 0.22, 0.43, 0.24, 0.52, 0.26, 0.45, 0.24, 0.5, 0.28],
    hihatOpen: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.34, 0],
    perc: [0, 0, 0, 0.2, 0, 0, 0.15, 0, 0, 0, 0.18, 0, 0, 0, 0, 0.14],
  },
  {
    id: 'coffee-bounce',
    kick: [0.9, 0, 0, 0, 0.2, 0, 0, 0.65, 0.82, 0, 0.18, 0, 0, 0.25, 0, 0],
    snare: [0, 0, 0, 0, 0.85, 0, 0, 0.15, 0, 0, 0, 0, 0.88, 0, 0, 0],
    hihatClosed: [0.5, 0.35, 0.54, 0.35, 0.5, 0.34, 0.55, 0.36, 0.52, 0.36, 0.58, 0.34, 0.52, 0.36, 0.6, 0.34],
    hihatOpen: [0, 0, 0, 0, 0, 0, 0.18, 0, 0, 0, 0, 0, 0, 0, 0.42, 0],
    perc: [0, 0.16, 0, 0, 0, 0.18, 0, 0, 0, 0, 0.2, 0, 0, 0.16, 0, 0],
  },
  {
    id: 'night-roll',
    kick: [0.92, 0, 0, 0.16, 0, 0, 0.52, 0, 0.82, 0, 0, 0.26, 0.24, 0, 0.12, 0],
    snare: [0, 0, 0, 0, 0.78, 0, 0.12, 0, 0, 0, 0, 0, 0.84, 0, 0, 0.18],
    hihatClosed: [0.34, 0.24, 0.38, 0.24, 0.34, 0.24, 0.44, 0.24, 0.36, 0.24, 0.46, 0.24, 0.34, 0.24, 0.48, 0.26],
    hihatOpen: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.18, 0, 0, 0, 0.38, 0],
    perc: [0, 0, 0.12, 0, 0, 0, 0.14, 0, 0, 0.12, 0, 0.15, 0, 0, 0.1, 0],
  },
  {
    id: 'lifted-steps',
    kick: [0.9, 0, 0.12, 0, 0.18, 0, 0, 0.58, 0.78, 0, 0.18, 0, 0.24, 0, 0, 0.16],
    snare: [0, 0, 0, 0, 0.84, 0, 0, 0, 0, 0, 0, 0.16, 0.88, 0, 0, 0],
    hihatClosed: [0.56, 0.4, 0.6, 0.38, 0.56, 0.4, 0.62, 0.38, 0.58, 0.42, 0.64, 0.4, 0.58, 0.42, 0.66, 0.4],
    hihatOpen: [0, 0, 0, 0.1, 0, 0, 0.12, 0, 0, 0, 0, 0.1, 0, 0, 0.46, 0],
    perc: [0, 0.14, 0, 0, 0, 0.2, 0, 0, 0, 0.14, 0, 0.18, 0, 0.16, 0, 0],
  },
  {
    id: 'late-glide',
    kick: [0.9, 0, 0, 0, 0, 0.14, 0.36, 0, 0.8, 0, 0, 0.18, 0, 0, 0.2, 0],
    snare: [0, 0, 0, 0, 0.8, 0, 0, 0, 0, 0, 0.1, 0, 0.86, 0, 0, 0.12],
    hihatClosed: [0.3, 0.18, 0.34, 0.18, 0.3, 0.2, 0.36, 0.2, 0.32, 0.2, 0.38, 0.18, 0.32, 0.2, 0.4, 0.2],
    hihatOpen: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.32, 0],
    perc: [0, 0, 0.08, 0, 0, 0, 0.12, 0, 0, 0, 0.1, 0, 0, 0, 0.08, 0],
  },
];

export const BASS_PATTERNS: BassPattern[] = [
  {
    id: 'held-roots',
    steps: [
      { step: 0, dur: '2n', vel: 0.78, interval: 0 },
      { step: 8, dur: '4n', vel: 0.56, interval: 7 },
      { step: 14, dur: '16n', vel: 0.46, interval: 5 },
    ],
  },
  {
    id: 'walking-soft',
    steps: [
      { step: 0, dur: '8n', vel: 0.74, interval: 0 },
      { step: 4, dur: '8n', vel: 0.48, interval: 3 },
      { step: 8, dur: '8n', vel: 0.64, interval: 5 },
      { step: 12, dur: '8n', vel: 0.46, interval: 7 },
    ],
  },
  {
    id: 'night-pulse',
    steps: [
      { step: 0, dur: '8n', vel: 0.76, interval: 0, octave: -1 },
      { step: 6, dur: '8n', vel: 0.42, interval: 0 },
      { step: 8, dur: '8n', vel: 0.62, interval: 7 },
      { step: 10, dur: '16n', vel: 0.36, interval: 10 },
      { step: 14, dur: '16n', vel: 0.4, interval: 5 },
    ],
  },
  {
    id: 'lifted-octaves',
    steps: [
      { step: 0, dur: '8n', vel: 0.74, interval: 0 },
      { step: 3, dur: '16n', vel: 0.32, interval: 12 },
      { step: 8, dur: '8n', vel: 0.62, interval: 7 },
      { step: 11, dur: '16n', vel: 0.34, interval: 14 },
      { step: 14, dur: '16n', vel: 0.4, interval: 5 },
    ],
  },
];

export const ARP_PATTERNS: ArpPattern[] = [
  { id: 'up-down', steps: [0, 1, 2, 3, 4, 3, 2, 1] },
  { id: 'woven', steps: [0, 2, 1, 3, 2, 4, 3, 1] },
  { id: 'glass', steps: [0, 3, 1, 4, 2, 3, 1, 2] },
  { id: 'twilight', steps: [4, 3, 2, 1, 0, 1, 2, 3] },
  { id: 'skip-lights', steps: [0, 2, 4, 2, 1, 3, 4, 1] },
  { id: 'spiral', steps: [0, 1, 3, 4, 2, 3, 1, 4] },
];
