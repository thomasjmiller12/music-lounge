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
