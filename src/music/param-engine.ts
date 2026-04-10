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
