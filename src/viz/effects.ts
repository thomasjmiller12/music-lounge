import * as THREE from 'three';
import {
  EffectComposer,
  EffectPass,
  RenderPass,
  BloomEffect,
  VignetteEffect,
  BlendFunction,
} from 'postprocessing';

/**
 * Creates the postprocessing pipeline:
 * - Render pass (base scene)
 * - Bloom (audio-reactive glow on sun/moon/lorenz marker)
 * - Vignette (subtle edge darkening for focus)
 */
export function createEffectComposer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
): EffectComposer {
  const composer = new EffectComposer(renderer);

  // Base render
  composer.addPass(new RenderPass(scene, camera));

  // Bloom — makes emissive objects glow
  const bloom = new BloomEffect({
    blendFunction: BlendFunction.ADD,
    intensity: 0.4,
    luminanceThreshold: 0.85,
    luminanceSmoothing: 0.2,
    mipmapBlur: true,
  });

  // Vignette — subtle darkened edges
  const vignette = new VignetteEffect({
    offset: 0.35,
    darkness: 0.5,
  });

  composer.addPass(new EffectPass(camera, bloom, vignette));

  // Expose bloom for audio-reactive intensity updates
  (composer as any).__bloom = bloom;

  return composer;
}

/**
 * Update bloom intensity based on audio.
 * Call from the animation loop.
 */
export function updateBloom(composer: EffectComposer, lowEnergy: number, beatIntensity: number): void {
  const bloom = (composer as any).__bloom as BloomEffect | undefined;
  if (bloom) {
    bloom.intensity = 0.6 + lowEnergy * 0.8 + beatIntensity * 0.4;
  }
}
