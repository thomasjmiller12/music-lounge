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
