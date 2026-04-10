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
