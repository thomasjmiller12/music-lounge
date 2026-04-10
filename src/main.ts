import './style.css';
import { LyriaClient } from './audio/lyria-client';
import { AudioPlayer } from './audio/audio-player';
import { LorenzModulator } from './music/lorenz-modulator';
import { ParamEngine } from './music/param-engine';
import { SOUND_PALETTE, randomizeSession } from './music/sound-palette';
import { SceneManager } from './viz/scene';
import { initControls } from './ui/controls';
import type { SliderState, AudioAnalysis, MusicGenConfig } from './types';

// ── State ──
let sliderState: SliderState = { lightNight: 0.2, calmDrive: 0.2 };
let playing = false;
let bpm: number | null = null;

// ── Modules (session-randomized palette) ──
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const lyria = new LyriaClient(apiKey);
const audioPlayer = new AudioPlayer();
const lorenz = new LorenzModulator(0.0005, 2000);
const palette = randomizeSession(SOUND_PALETTE);
const paramEngine = new ParamEngine(palette);
let scene: SceneManager | null = null;

// ── Status ──
function setStatus(text: string): void {
  const el = document.getElementById('status-text');
  if (el) el.textContent = text;
}

// ── Start ──
async function start(): Promise<void> {
  const overlay = document.getElementById('start-overlay')!;
  const app = document.getElementById('app')!;
  overlay.classList.add('hidden');
  app.classList.remove('hidden');

  setStatus('Initializing audio...');
  await audioPlayer.init();

  const canvas = document.getElementById('viz-canvas') as HTMLCanvasElement;
  scene = new SceneManager(canvas);

  setStatus('Connecting to Lyria...');

  await lyria.connect({
    onAudioChunk: (pcm) => audioPlayer.pushAudio(pcm),
    onFilteredPrompt: (text, reason) => {
      console.warn(`Prompt filtered: "${text}" — ${reason}`);
    },
    onWarning: (msg) => console.warn('Lyria warning:', msg),
    onError: (err) => {
      console.error('Lyria error:', err);
      setStatus('Connection error — refresh to retry');
    },
    onClose: () => {
      setStatus('Disconnected');
      playing = false;
    },
    onReady: () => {
      setStatus('Ready');
      // Set initial targets and immediately send
      paramEngine.setTargets(sliderState, lorenz.getState());
      for (let i = 0; i < 100; i++) paramEngine.tick(); // snap to initial
      sendSmoothedParams();
      lyria.play();
      playing = true;
      setStatus('Playing');
    },
  });
}

// ── Send smoothed params to Lyria ──
function sendSmoothedParams(): void {
  const params = paramEngine.getSmoothedParams();
  lyria.setPrompts(params.prompts);

  const config: MusicGenConfig = { ...params.config };
  if (bpm !== null) (config as any).bpm = bpm;
  lyria.setConfig(config);
}

// ── Animation loop ──
let lastTime = performance.now();

function animate(): void {
  requestAnimationFrame(animate);

  const now = performance.now();
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  // Advance Lorenz attractor
  lorenz.step();
  const lorenzState = lorenz.getState();

  // Update targets (cheap — just sets target values)
  paramEngine.setTargets(sliderState, lorenzState);

  // Advance smoothers (every frame — this is what makes transitions gradual)
  paramEngine.tick();

  // Send smoothed params to Lyria at rate-limited interval
  if (playing && paramEngine.shouldSend()) {
    sendSmoothedParams();
  }

  // Audio analysis for visualization
  const audio: AudioAnalysis = audioPlayer.getAnalysis();

  // Update Three.js scene
  if (scene) {
    scene.update(sliderState, lorenzState, audio, dt);
  }
}

// ── Controls ──
const { getSliderState } = initControls({
  onSliderChange: (state) => {
    sliderState = state;
  },
  onBpmChange: (newBpm) => {
    bpm = newBpm;
    if (playing) {
      sendSmoothedParams();
      lyria.resetContext();
      audioPlayer.resetBuffer();
      setStatus('Resetting for new BPM...');
      setTimeout(() => setStatus('Playing'), 2000);
    }
  },
  onVolumeChange: (vol) => audioPlayer.setVolume(vol),
  onLorenzSpeedChange: (speed) => lorenz.setSpeed(speed),
  onPlay: () => {
    if (!playing) {
      lyria.play();
      audioPlayer.resume();
      playing = true;
      setStatus('Playing');
    }
  },
  onPause: () => {
    if (playing) {
      lyria.pause();
      playing = false;
      setStatus('Paused');
    }
  },
});

// ── Init ──
document.getElementById('start-btn')!.addEventListener('click', async () => {
  await start();
  animate();
});
