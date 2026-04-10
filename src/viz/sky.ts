import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import type { AudioAnalysis } from '../types';

/**
 * Day/night sky system using Three.js physically-based Sky shader.
 * Maps lightNight (0=day, 1=night) to sun elevation, creating
 * natural sunrise/sunset/moonrise transitions.
 *
 * Layers:
 * - Sky shader sphere (atmosphere scattering)
 * - Star field (fades in at night)
 * - Sun orb (emissive mesh, tracks sky sun position)
 * - Moon orb (opposite side, fades in at night)
 */
export class SkySystem {
  private sky: Sky;
  private sunPosition = new THREE.Vector3();
  private stars: THREE.Points;
  private sunMesh: THREE.Mesh;
  private moonMesh: THREE.Mesh;
  private starMaterial: THREE.PointsMaterial;
  private sunMaterial: THREE.MeshBasicMaterial;
  private moonMaterial: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene) {
    // ── Sky shader ──
    this.sky = new Sky();
    this.sky.scale.setScalar(5000);
    scene.add(this.sky);

    const uniforms = this.sky.material.uniforms;
    uniforms['turbidity'].value = 1.8;
    uniforms['rayleigh'].value = 1.0;
    uniforms['mieCoefficient'].value = 0.003;
    uniforms['mieDirectionalG'].value = 0.7;

    // ── Stars ──
    const starCount = 1500;
    const starPositions = new Float32Array(starCount * 3);
    const starSizes = new Float32Array(starCount);
    for (let i = 0; i < starCount; i++) {
      // Distribute on a sphere
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 2000 + Math.random() * 500;
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = Math.abs(r * Math.cos(phi)); // upper hemisphere
      starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      starSizes[i] = Math.random() * 2 + 0.5;
    }
    const starGeom = new THREE.BufferGeometry();
    starGeom.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeom.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));
    this.starMaterial = new THREE.PointsMaterial({
      color: 0xCCD8FF,
      size: 1.5,
      transparent: true,
      opacity: 0,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.stars = new THREE.Points(starGeom, this.starMaterial);
    scene.add(this.stars);

    // ── Sun orb ──
    this.sunMaterial = new THREE.MeshBasicMaterial({
      color: 0xFFE4B5,
      transparent: true,
      opacity: 1,
    });
    this.sunMesh = new THREE.Mesh(
      new THREE.SphereGeometry(8, 32, 32),
      this.sunMaterial,
    );
    scene.add(this.sunMesh);

    // ── Moon orb ──
    this.moonMaterial = new THREE.MeshBasicMaterial({
      color: 0xD4E5FF,
      transparent: true,
      opacity: 0,
    });
    this.moonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(10, 32, 32),
      this.moonMaterial,
    );
    scene.add(this.moonMesh);
  }

  update(lightNight: number, audio: AudioAnalysis): void {
    // ── Sun elevation from lightNight ──
    // Camera faces -Z. Sun is behind camera (+Z side) so it lights the
    // sky without being in the viewport.
    // 0.0 → 12° (warm low sun — golden-hour feel, not overhead wash)
    // 0.3 → 5° (deep golden hour)
    // 0.5 → -5° (just set)
    // 1.0 → -20° (deep night)
    const elevation = 12 - lightNight * 32;
    const azimuth = 30 - lightNight * 40;

    const phi = THREE.MathUtils.degToRad(90 - elevation);
    const theta = THREE.MathUtils.degToRad(azimuth);
    this.sunPosition.setFromSphericalCoords(1, phi, theta);
    this.sky.material.uniforms['sunPosition'].value.copy(this.sunPosition);

    // ── Sky tuning based on time of day ──
    const uniforms = this.sky.material.uniforms;
    // Low rayleigh keeps the sky from going white
    const goldenFactor = 1 - Math.abs(lightNight - 0.35) * 3;
    uniforms['rayleigh'].value = 0.6 + Math.max(0, goldenFactor) * 0.8;
    uniforms['mieCoefficient'].value = 0.003 + Math.max(0, goldenFactor) * 0.004;
    uniforms['turbidity'].value = 1.2 - lightNight * 0.5;

    // ── Sun orb position and visibility ──
    const sunDir = this.sunPosition.clone().normalize();
    this.sunMesh.position.copy(sunDir.multiplyScalar(800));
    this.sunMaterial.opacity = Math.max(0, 1 - lightNight * 2);
    // Audio reactive: bass makes sun pulse slightly
    const sunScale = 1 + audio.lowEnergy * 0.15;
    this.sunMesh.scale.setScalar(sunScale);

    // ── Moon — in FRONT of camera (-Z side, azimuth ~180°) ──
    // Rises as night deepens, centered in the viewer's sky
    const moonElevation = -30 + lightNight * 55; // at night=1: 25° up
    const moonAzimuth = 190 - lightNight * 15;   // roughly centered in view
    const moonPhi = THREE.MathUtils.degToRad(90 - moonElevation);
    const moonTheta = THREE.MathUtils.degToRad(moonAzimuth);
    const moonDir = new THREE.Vector3().setFromSphericalCoords(1, moonPhi, moonTheta).normalize();
    this.moonMesh.position.copy(moonDir.multiplyScalar(900));
    // Moon fades in starting at lightNight > 0.35
    this.moonMaterial.opacity = Math.max(0, (lightNight - 0.35) / 0.4);

    // ── Stars: fade in during night ──
    // Start appearing at lightNight > 0.45
    const starOpacity = Math.max(0, (lightNight - 0.45) / 0.55);
    this.starMaterial.opacity = starOpacity * 0.8;
    // Subtle twinkle via slight rotation
    this.stars.rotation.y += 0.00003;
  }

  dispose(): void {
    this.sky.geometry.dispose();
    (this.sky.material as THREE.ShaderMaterial).dispose();
    this.stars.geometry.dispose();
    this.starMaterial.dispose();
    this.sunMesh.geometry.dispose();
    this.sunMaterial.dispose();
    this.moonMesh.geometry.dispose();
    this.moonMaterial.dispose();
  }
}
