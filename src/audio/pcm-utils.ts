/**
 * Decode base64-encoded 16-bit signed PCM into normalized Float32Array.
 * Lyria outputs 48kHz stereo interleaved (L,R,L,R,...).
 */
export function decodeBase64PCM(base64: string): Float32Array {
  if (!base64) return new Float32Array(0);

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 32768;
  }

  return float32;
}
