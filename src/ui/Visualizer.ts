import type { AudioEngine } from '../audio/engine';

interface DriftBand {
  y: number;
  height: number;
  speed: number;
  amplitude: number;
  phase: number;
  blur: number;
}

interface Spark {
  x: number;
  y: number;
  size: number;
  twinkle: number;
  drift: number;
  phase: number;
}

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function mixColor(a: [number, number, number], b: [number, number, number], amount: number) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * amount),
    Math.round(a[1] + (b[1] - a[1]) * amount),
    Math.round(a[2] + (b[2] - a[2]) * amount),
  ] as [number, number, number];
}

function rgba(color: [number, number, number], alpha: number) {
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
}

export class Visualizer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private engine: AudioEngine;
  private running = false;
  private rafId = 0;

  private beatIntensity = 0;
  private bpmPulsePhase = 0;
  private bands: DriftBand[] = [];
  private sparks: Spark[] = [];
  private grainSeed = 0;

  constructor(canvas: HTMLCanvasElement, engine: AudioEngine) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.engine = engine;

    this.bands = Array.from({ length: 4 }, (_, i) => ({
      y: 0.1 + i * 0.18,
      height: 0.1 + i * 0.025,
      speed: 0.0012 + i * 0.0005,
      amplitude: 18 + i * 10,
      phase: Math.random() * Math.PI * 2,
      blur: 16 + i * 10,
    }));

    this.sparks = Array.from({ length: 50 }, () => ({
      x: Math.random(),
      y: Math.random() * 0.8 + 0.05,
      size: Math.random() * 2.4 + 0.6,
      twinkle: Math.random() * 0.8 + 0.2,
      drift: Math.random() * 0.0012 + 0.0003,
      phase: Math.random() * Math.PI * 2,
    }));

    this.resize();
    window.addEventListener('resize', () => this.resize());

    engine.onBeat((_beat, layers) => {
      if (layers.kick) this.beatIntensity = 1;
      else if (layers.snare) this.beatIntensity = Math.max(this.beatIntensity, 0.6);
      else if (layers.hihat) this.beatIntensity = Math.max(this.beatIntensity, 0.15);
    });
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.draw();
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio, 2);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
  }

  private draw = () => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.draw);

    const dpr = Math.min(window.devicePixelRatio, 2);
    const width = this.canvas.width / dpr;
    const height = this.canvas.height / dpr;
    const visual = this.engine.getVisualState();
    const fft = this.engine.getFFTValues();
    const waveform = this.engine.getWaveformValues();

    const lowEnergy = this.getEnergy(fft, 0, 18);
    const midEnergy = this.getEnergy(fft, 18, 52);
    const highEnergy = this.getEnergy(fft, 52, fft.length);

    this.bpmPulsePhase += (visual.bpm / 60) * (Math.PI * 2 / 60);
    const bpmPulse = Math.sin(this.bpmPulsePhase) * 0.5 + 0.5;

    this.ctx.clearRect(0, 0, width, height);
    this.drawBackdrop(width, height, visual.lightNight, visual.glow, bpmPulse);
    this.drawGlow(width, height, visual.lightNight, visual.glow, lowEnergy, bpmPulse);
    this.drawBands(width, height, visual.motion, visual.lightNight, midEnergy);
    this.drawWaveform(width, height, waveform, visual, midEnergy);
    this.drawSparks(width, height, visual, highEnergy);
    this.drawBloom(width, height, visual, lowEnergy, bpmPulse);
    this.drawGrain(width, height, visual.grain);

    this.beatIntensity *= 0.9;
  };

  private getEnergy(data: Float32Array, start: number, end: number) {
    let sum = 0;
    for (let i = start; i < end; i++) sum += clamp((data[i] + 110) / 85);
    return sum / Math.max(1, end - start);
  }

  private drawBackdrop(w: number, h: number, ln: number, glow: number, pulse: number) {
    // Day: warm amber/peach → Night: deep navy/indigo
    const top = mixColor([246, 221, 184], [12, 18, 38], ln);
    const mid = mixColor([248, 167, 112], [24, 36, 72], ln);
    const bot = mixColor([85, 58, 39], [8, 12, 26], ln);

    const g = this.ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, rgba(top, 1));
    g.addColorStop(0.45, rgba(mid, 1));
    g.addColorStop(1, rgba(bot, 1));
    this.ctx.fillStyle = g;
    this.ctx.fillRect(0, 0, w, h);

    // Horizon haze
    const haze = this.ctx.createLinearGradient(0, h * 0.5, 0, h);
    const hazeColor = mixColor([255, 219, 176], [36, 58, 104], ln);
    haze.addColorStop(0, rgba(hazeColor, 0));
    haze.addColorStop(1, rgba(hazeColor, 0.12 + glow * 0.06 + pulse * 0.015));
    this.ctx.fillStyle = haze;
    this.ctx.fillRect(0, h * 0.4, w, h * 0.6);
  }

  private drawGlow(w: number, h: number, ln: number, glow: number, low: number, pulse: number) {
    // Sun/moon glow
    const x = w * (ln < 0.5 ? 0.22 : 0.76);
    const y = h * (ln < 0.5 ? 0.2 : 0.16);
    const r = h * (0.16 + glow * 0.14 + low * 0.06 + pulse * 0.02);
    const color = mixColor([255, 210, 150], [150, 185, 245], ln);

    const g = this.ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(color, 0.3 + glow * 0.18 + this.beatIntensity * 0.06));
    g.addColorStop(0.55, rgba(color, 0.1 + glow * 0.08));
    g.addColorStop(1, rgba(color, 0));
    this.ctx.fillStyle = g;
    this.ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  private drawBands(w: number, h: number, motion: number, ln: number, mid: number) {
    const color = mixColor([255, 214, 171], [100, 150, 230], ln);

    this.bands.forEach((band, i) => {
      band.phase += band.speed * (0.8 + motion * 3);
      const y = h * band.y;
      const amp = band.amplitude * (0.7 + motion * 0.6 + mid * 0.4);
      const alpha = 0.04 + i * 0.02 + mid * 0.05;

      this.ctx.save();
      this.ctx.filter = `blur(${band.blur}px)`;
      this.ctx.fillStyle = rgba(color, alpha);
      this.ctx.beginPath();
      this.ctx.moveTo(-60, y);

      for (let x = -60; x <= w + 60; x += w / 8) {
        const wave = Math.sin(band.phase + x * 0.003 + i * 0.5) * amp;
        this.ctx.quadraticCurveTo(x, y + wave, x + w / 16, y + wave * 0.8 + band.height * h);
      }

      this.ctx.lineTo(w + 60, y + band.height * h + 80);
      this.ctx.lineTo(-60, y + band.height * h + 80);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.restore();
    });
  }

  private drawWaveform(w: number, h: number, waveform: Float32Array, visual: ReturnType<AudioEngine['getVisualState']>, mid: number) {
    const accent = mixColor([255, 198, 136], [130, 175, 245], visual.lightNight);
    const y0 = h * (0.56 - visual.calmDrive * 0.06);
    const amp = h * (0.06 + visual.motion * 0.04 + mid * 0.03);

    // Filled area below waveform
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.moveTo(0, y0);

    const step = 6;
    for (let i = 0; i < waveform.length; i += step) {
      const x = (i / (waveform.length - step)) * w;
      this.ctx.lineTo(x, y0 + waveform[i] * amp);
    }

    this.ctx.lineTo(w, h);
    this.ctx.lineTo(0, h);
    this.ctx.closePath();

    const fill = this.ctx.createLinearGradient(0, y0, 0, h);
    fill.addColorStop(0, rgba(accent, 0.14 + this.beatIntensity * 0.06));
    fill.addColorStop(1, rgba(accent, 0));
    this.ctx.fillStyle = fill;
    this.ctx.fill();

    // Stroke line
    this.ctx.beginPath();
    for (let i = 0; i < waveform.length; i += step) {
      const x = (i / (waveform.length - step)) * w;
      if (i === 0) this.ctx.moveTo(x, y0 + waveform[i] * amp);
      else this.ctx.lineTo(x, y0 + waveform[i] * amp);
    }
    this.ctx.strokeStyle = rgba(accent, 0.35 + this.beatIntensity * 0.1);
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();
    this.ctx.restore();
  }

  private drawSparks(w: number, h: number, visual: ReturnType<AudioEngine['getVisualState']>, high: number) {
    const color = mixColor([255, 240, 210], [160, 195, 255], visual.lightNight);
    const drift = 0.3 + visual.motion * 0.8;

    for (const s of this.sparks) {
      s.phase += s.drift * (1 + visual.motion * 2);
      const x = ((s.x + s.phase * drift) % 1) * w;
      const y = s.y * h + Math.sin(s.phase * 2 + s.twinkle) * (2 + visual.motion * 3);
      const twinkle = Math.sin(s.phase * 5 + s.twinkle * 3) * 0.3 + 0.7;
      const alpha = (0.08 + s.twinkle * 0.12 + high * 0.1) * twinkle;
      const r = s.size * (0.7 + visual.glow * 0.6);

      this.ctx.beginPath();
      this.ctx.fillStyle = rgba(color, alpha);
      this.ctx.arc(x, y, r, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  private drawBloom(w: number, h: number, visual: ReturnType<AudioEngine['getVisualState']>, low: number, pulse: number) {
    const intensity = this.beatIntensity * 0.5 + pulse * 0.1;
    if (intensity < 0.03) return;

    const color = mixColor([200, 150, 100], [90, 130, 200], visual.lightNight);
    const r = w * (0.08 + low * 0.04 + this.beatIntensity * 0.05);
    const y = h * 0.72;
    const g = this.ctx.createRadialGradient(w * 0.5, y, 0, w * 0.5, y, r);
    g.addColorStop(0, rgba(color, intensity * 0.18));
    g.addColorStop(1, rgba(color, 0));
    this.ctx.fillStyle = g;
    this.ctx.fillRect(w * 0.5 - r, y - r, r * 2, r * 2);
  }

  private drawGrain(w: number, h: number, grain: number) {
    this.grainSeed += 1;
    if (this.grainSeed % 3 !== 0) return;

    const pts = Math.round(25 + grain * 60);
    this.ctx.save();
    this.ctx.globalAlpha = 0.02 + grain * 0.025;

    const seed = this.grainSeed;
    for (let i = 0; i < pts; i++) {
      const s = (seed * 9301 + 49297 + i * 233) % 233280;
      const x = (s / 233280) * w;
      const y = ((s * 49297 + i * 9301) % 233280) / 233280 * h;
      this.ctx.fillStyle = `rgba(255,255,255,${((s + i) % 50) / 100})`;
      this.ctx.fillRect(x, y, ((s + i) % 14) / 10, ((s + i) % 14) / 10);
    }

    this.ctx.restore();
  }
}
