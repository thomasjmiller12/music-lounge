import * as THREE from 'three';
import type { LorenzState } from '../types';

/**
 * Renders the Lorenz attractor as a glowing 3D trail in the scene.
 * Shows the full trajectory history as a fading line, with a bright
 * marker at the current position.
 *
 * The attractor is scaled and positioned to sit as a central
 * decorative element — the "heart" of the visualization that shows
 * exactly where in the chaotic system the music modulation currently is.
 */
export class LorenzViz {
  private trailLine: THREE.Line;
  private trailGeometry: THREE.BufferGeometry;
  private trailMaterial: THREE.LineBasicMaterial;
  private markerMesh: THREE.Mesh;
  private markerMaterial: THREE.MeshBasicMaterial;
  private glowMesh: THREE.Mesh;
  private glowMaterial: THREE.MeshBasicMaterial;

  private maxPoints = 2000;
  private positions: Float32Array;
  private colors: Float32Array;
  private pointCount = 0;

  // Scale and offset to position the attractor nicely in the scene
  private scale = 0.4;
  private offset = new THREE.Vector3(0, 12, -15);

  constructor(scene: THREE.Scene) {
    // ── Trail line ──
    this.positions = new Float32Array(this.maxPoints * 3);
    this.colors = new Float32Array(this.maxPoints * 3);

    this.trailGeometry = new THREE.BufferGeometry();
    this.trailGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage),
    );
    this.trailGeometry.setAttribute(
      'color',
      new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage),
    );

    this.trailMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.trailLine = new THREE.Line(this.trailGeometry, this.trailMaterial);
    scene.add(this.trailLine);

    // ── Current position marker (bright dot) ──
    this.markerMaterial = new THREE.MeshBasicMaterial({
      color: 0xFFFFFF,
      transparent: true,
      opacity: 0.9,
    });
    this.markerMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 16, 16),
      this.markerMaterial,
    );
    scene.add(this.markerMesh);

    // ── Glow around marker ──
    this.glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x88CCFF,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.glowMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.0, 16, 16),
      this.glowMaterial,
    );
    scene.add(this.glowMesh);
  }

  update(lorenz: LorenzState): void {
    // Transform Lorenz coordinates to scene space
    const sx = lorenz.x * this.scale + this.offset.x;
    const sy = lorenz.z * this.scale + this.offset.y; // z → up
    const sz = lorenz.y * this.scale + this.offset.z;

    // ── Update trail ──
    if (this.pointCount < this.maxPoints) {
      const idx = this.pointCount * 3;
      this.positions[idx] = sx;
      this.positions[idx + 1] = sy;
      this.positions[idx + 2] = sz;
      this.pointCount++;
    } else {
      // Shift all points left by one and append new point at end
      this.positions.copyWithin(0, 3);
      const idx = (this.maxPoints - 1) * 3;
      this.positions[idx] = sx;
      this.positions[idx + 1] = sy;
      this.positions[idx + 2] = sz;
    }

    // Color gradient: older points are dim/cool, newer are bright/warm
    const count = Math.min(this.pointCount, this.maxPoints);
    for (let i = 0; i < count; i++) {
      const t = i / count; // 0 = oldest, 1 = newest
      const fade = t * t; // exponential fade — recent points much brighter
      this.colors[i * 3] = 0.2 + fade * 0.6;     // R: warm at tip
      this.colors[i * 3 + 1] = 0.3 + fade * 0.5;  // G
      this.colors[i * 3 + 2] = 0.8 - fade * 0.3;  // B: cool at tail
    }

    this.trailGeometry.attributes.position.needsUpdate = true;
    this.trailGeometry.attributes.color.needsUpdate = true;
    this.trailGeometry.setDrawRange(0, count);

    // ── Update marker position ──
    this.markerMesh.position.set(sx, sy, sz);
    this.glowMesh.position.set(sx, sy, sz);

    // Marker color shifts with normalized state
    this.markerMaterial.color.setRGB(
      0.5 + lorenz.nx * 0.5,
      0.6 + lorenz.ny * 0.4,
      1.0 - lorenz.nz * 0.3,
    );
    this.glowMaterial.color.copy(this.markerMaterial.color);
  }

  dispose(): void {
    this.trailGeometry.dispose();
    this.trailMaterial.dispose();
    this.markerMesh.geometry.dispose();
    this.markerMaterial.dispose();
    this.glowMesh.geometry.dispose();
    this.glowMaterial.dispose();
  }
}
