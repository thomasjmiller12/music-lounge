import { describe, it, expect } from 'vitest';
import { decodeBase64PCM } from '../pcm-utils';

describe('decodeBase64PCM', () => {
  it('converts base64 16-bit PCM to Float32Array', () => {
    // 16-bit signed PCM: [0, 16384 (0.5), -16384 (-0.5), 32767 (~1.0)]
    // as little-endian bytes: [0x00,0x00, 0x00,0x40, 0x00,0xC0, 0xFF,0x7F]
    const bytes = new Uint8Array([0x00, 0x00, 0x00, 0x40, 0x00, 0xC0, 0xFF, 0x7F]);
    const base64 = btoa(String.fromCharCode(...bytes));

    const result = decodeBase64PCM(base64);

    expect(result).toBeInstanceOf(Float32Array);
    expect(result.length).toBe(4);
    expect(result[0]).toBeCloseTo(0, 4);
    expect(result[1]).toBeCloseTo(0.5, 2);
    expect(result[2]).toBeCloseTo(-0.5, 2);
    expect(result[3]).toBeCloseTo(1.0, 2);
  });

  it('returns empty Float32Array for empty input', () => {
    const result = decodeBase64PCM('');
    expect(result.length).toBe(0);
  });
});
