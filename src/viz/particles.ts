import * as THREE from 'three';
import type { SliderState, AudioAnalysis } from '../types';

/**
 * Environmental particle system that shifts character with day/night:
 * - Day: warm dust motes / pollen drifting upward in sunlight
 * - Night: cool fireflies / tiny stars drifting gently
 *
 * Particles are audio-reactive: bass energy affects drift speed,
 * high energy affects twinkle rate.
 */
export class ParticleSystem {
  private points: THREE.Points;
  private geometry: THREE.BufferGeometry;
  private material: THREE.PointsMaterial;
  private count: number;
  private velocities: Float32Array;
  private phases: Float32Array;
  private sizes: Float32Array;
  private time = 0;

  constructor(scene: THREE.Scene, count = 300) {
    this.count = count;

    const positions = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);
    this.phases = new Float32Array(count);
    this.sizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Spread particles in a box around the camera
      positions[i * 3] = (Math.random() - 0.5) * 80;
      positions[i * 3 + 1] = Math.random() * 50 - 5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 60 - 10;

      this.velocities[i * 3] = (Math.random() - 0.5) * 0.02;
      this.velocities[i * 3 + 1] = Math.random() * 0.015 + 0.003;
      this.velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.01;

      this.phases[i] = Math.random() * Math.PI * 2;
      this.sizes[i] = Math.random() * 0.3 + 0.1;
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    this.material = new THREE.PointsMaterial({
      color: 0xFFE8C8,
      size: 0.3,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    scene.add(this.points);
  }

  update(sliders: SliderState, audio: AudioAnalysis, dt: number): void {
    this.time += dt;
    const positions = this.geometry.attributes.position.array as Float32Array;
    const { lightNight, calmDrive } = sliders;

    // Color shift: warm gold (day) → cool blue-white (night)
    const r = 1.0 - lightNight * 0.4;
    const g = 0.91 - lightNight * 0.15;
    const b = 0.78 + lightNight * 0.22;
    this.material.color.setRGB(r, g, b);

    // Opacity and size affected by audio
    this.material.opacity = 0.3 + audio.highEnergy * 0.4 + lightNight * 0.2;
    this.material.size = 0.2 + calmDrive * 0.15 + audio.lowEnergy * 0.1;

    // Move speed affected by drive and bass
    const speedMult = 0.5 + calmDrive * 1.0 + audio.lowEnergy * 0.5;

    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3;
      this.phases[i] += dt * (0.5 + audio.highEnergy * 2);

      // Base drift + gentle sine wobble
      positions[i3] += this.velocities[i3] * speedMult
        + Math.sin(this.phases[i] * 0.7) * 0.003;
      positions[i3 + 1] += this.velocities[i3 + 1] * speedMult
        + Math.sin(this.phases[i]) * 0.002;
      positions[i3 + 2] += this.velocities[i3 + 2] * speedMult;

      // Wrap particles that drift out of bounds
      if (positions[i3 + 1] > 45) {
        positions[i3 + 1] = -5;
        positions[i3] = (Math.random() - 0.5) * 80;
        positions[i3 + 2] = (Math.random() - 0.5) * 60 - 10;
      }
      if (Math.abs(positions[i3]) > 45) {
        positions[i3] = -Math.sign(positions[i3]) * 44;
      }
    }

    this.geometry.attributes.position.needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
