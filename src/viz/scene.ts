import * as THREE from 'three';
import { EffectComposer } from 'postprocessing';
import { SkySystem } from './sky';
import { ParticleSystem } from './particles';
import { LorenzViz } from './lorenz-viz';
import { createEffectComposer } from './effects';
import type { AudioAnalysis, LorenzState, SliderState } from '../types';

/**
 * Top-level Three.js scene manager. Creates and orchestrates all
 * visual layers: sky, particles, Lorenz trail, and postprocessing.
 */
export class SceneManager {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private composer: EffectComposer;

  private sky: SkySystem;
  private particles: ParticleSystem;
  private lorenzViz: LorenzViz;

  // Smooth breathing camera drift
  private cameraTime = 0;

  constructor(canvas: HTMLCanvasElement) {
    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.5;

    // Scene
    this.scene = new THREE.Scene();

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      60,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      10000,
    );
    this.camera.position.set(0, 5, 35);
    this.camera.lookAt(0, 8, 0);

    // Sub-systems
    this.sky = new SkySystem(this.scene);
    this.particles = new ParticleSystem(this.scene);
    this.lorenzViz = new LorenzViz(this.scene);

    // Postprocessing
    this.composer = createEffectComposer(this.renderer, this.scene, this.camera);

    // Handle resize
    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());
  }

  private handleResize(): void {
    const canvas = this.renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
  }

  /**
   * Called every animation frame.
   */
  update(
    sliders: SliderState,
    lorenz: LorenzState,
    audio: AudioAnalysis,
    dt: number,
  ): void {
    // Gentle camera breathing
    this.cameraTime += dt * 0.15;
    this.camera.position.y = 5 + Math.sin(this.cameraTime) * 0.3;
    this.camera.position.x = Math.sin(this.cameraTime * 0.7) * 0.5;

    // Update sub-systems
    this.sky.update(sliders.lightNight, audio);
    this.particles.update(sliders, audio, dt);
    this.lorenzViz.update(lorenz);

    // Render with postprocessing
    this.composer.render(dt);
  }

  dispose(): void {
    this.sky.dispose();
    this.particles.dispose();
    this.lorenzViz.dispose();
    this.renderer.dispose();
  }
}
