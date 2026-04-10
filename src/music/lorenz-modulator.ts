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
