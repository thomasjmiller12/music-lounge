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
