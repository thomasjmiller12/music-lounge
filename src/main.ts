import './style.css';
import { LyriaClient } from './audio/lyria-client';
import { AudioPlayer } from './audio/audio-player';
import { LorenzModulator } from './music/lorenz-modulator';
import { ParamEngine } from './music/param-engine';
import { SOUND_PALETTE, randomizeSession } from './music/sound-palette';
import { SceneManager } from './viz/scene';
import { initControls } from './ui/controls';
import { RoomManager } from './room/room-manager';
import type { SliderState, AudioAnalysis, MusicGenConfig, LorenzState } from './types';

// ── State ──
let sliderState: SliderState = { lightNight: 0.2, calmDrive: 0.2 };
let lorenzState: LorenzState = { x: 1, y: 1, z: 20, nx: 0.5, ny: 0.5, nz: 0.5 };
let playing = false;
let bpm: number | null = null;

// ── Modules ──
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const lyria = new LyriaClient(apiKey);
const audioPlayer = new AudioPlayer();
const lorenz = new LorenzModulator(0.0005, 2000);
const palette = randomizeSession(SOUND_PALETTE);
const paramEngine = new ParamEngine(palette);
const room = new RoomManager();
let scene: SceneManager | null = null;

// ── DOM refs ──
const overlay = document.getElementById('start-overlay')!;
const startDefault = document.getElementById('start-default')!;
const joinView = document.getElementById('join-view')!;
const app = document.getElementById('app')!;

// ── Status helpers ──
function setStatus(text: string): void {
  const el = document.getElementById('status-text');
  if (el) el.textContent = text;
}

function setOverlayStatus(text: string): void {
  const el = document.getElementById('overlay-status');
  if (el) el.textContent = text;
}

function showJoinError(text: string): void {
  const el = document.getElementById('join-error')!;
  el.textContent = text;
  el.classList.toggle('hidden', !text);
}

function updateRoomUI(): void {
  const roomInfo = document.getElementById('room-info')!;
  const codeDisplay = document.getElementById('room-code-display')!;
  const peerCountEl = document.getElementById('peer-count')!;

  if (room.role !== 'solo') {
    roomInfo.classList.remove('hidden');
    codeDisplay.textContent = room.roomCode;
    peerCountEl.textContent = room.isHost
      ? `${room.peerCount + 1} listening`
      : 'connected';
  }
}

// ── Controls ──
const { getSliderState, setSliderState } = initControls({
  onSliderChange: (state) => {
    sliderState = state;
    room.sendSliderChange(state);
  },
  onBpmChange: (newBpm) => {
    bpm = newBpm;
    if (playing && !room.isGuest) {
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
      if (!room.isGuest) {
        lyria.play();
      }
      audioPlayer.resume();
      playing = true;
      setStatus('Playing');
    }
  },
  onPause: () => {
    if (playing) {
      if (!room.isGuest) {
        lyria.pause();
      }
      audioPlayer.suspend();
      playing = false;
      setStatus('Paused');
    }
  },
});

// ── Room callbacks ──
room.setCallbacks({
  onSliderChange: (state) => {
    sliderState = state;
    setSliderState(state);
  },
  onStateSync: (sliders, lz) => {
    sliderState = sliders;
    lorenzState = lz;
    setSliderState(sliders);
  },
  onAudioStream: async (stream) => {
    await audioPlayer.initFromStream(stream);
    playing = true;
    setStatus('Playing');
  },
  onPeerCountChange: () => {
    updateRoomUI();
  },
  onError: (msg) => {
    setStatus(msg);
  },
});

// ── Send smoothed params to Lyria ──
function sendSmoothedParams(): void {
  const params = paramEngine.getSmoothedParams();
  lyria.setPrompts(params.prompts);

  const config: MusicGenConfig = { ...params.config };
  if (bpm !== null) (config as any).bpm = bpm;
  lyria.setConfig(config);
}

// ── Start (solo or host) ──
async function start(): Promise<void> {
  overlay.classList.add('hidden');
  app.classList.remove('hidden');

  setStatus('Initializing audio...');
  await audioPlayer.init();

  // If hosting, provide the audio stream to the room manager
  if (room.isHost) {
    const stream = audioPlayer.getOutputStream();
    if (stream) room.setAudioStream(stream);
  }

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
      // Set initial targets and snap smoothers
      paramEngine.setTargets(sliderState, lorenz.getState());
      for (let i = 0; i < 100; i++) paramEngine.tick();
      sendSmoothedParams();
      lyria.play();
      playing = true;
      setStatus(room.isHost ? `Playing — Room ${room.roomCode}` : 'Playing');
      updateRoomUI();
    },
  });
}

// ── Start as guest ──
async function startAsGuest(): Promise<void> {
  overlay.classList.add('hidden');
  app.classList.remove('hidden');

  const canvas = document.getElementById('viz-canvas') as HTMLCanvasElement;
  scene = new SceneManager(canvas);

  setStatus('Waiting for audio from host...');
  updateRoomUI();
  // Audio init happens when stream arrives (onAudioStream callback)
}

// ── Animation loop ──
let lastTime = performance.now();

function animate(): void {
  requestAnimationFrame(animate);

  const now = performance.now();
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  if (!room.isGuest) {
    // Host/Solo: advance Lorenz and update music params
    lorenz.step();
    lorenzState = lorenz.getState();
    paramEngine.setTargets(sliderState, lorenzState);
    paramEngine.tick();

    if (playing && paramEngine.shouldSend()) {
      sendSmoothedParams();
    }

    // Broadcast state to guests
    room.broadcastState(sliderState, lorenzState);
  }
  // Guest: lorenzState is updated via room.onStateSync callback

  const audio: AudioAnalysis = audioPlayer.getAnalysis();

  if (scene) {
    scene.update(sliderState, lorenzState, audio, dt);
  }
}

// ── UI Event Handlers ──

// Solo mode
document.getElementById('start-btn')!.addEventListener('click', async () => {
  await start();
  animate();
});

// Create room
document.getElementById('create-room-btn')!.addEventListener('click', async () => {
  try {
    setOverlayStatus('Creating room...');
    const code = await room.createRoom();
    setOverlayStatus(`Room ${code} — starting music...`);
    await start();
    animate();
  } catch (err: any) {
    setOverlayStatus(err.message);
  }
});

// Show join view
document.getElementById('join-room-btn')!.addEventListener('click', () => {
  startDefault.classList.add('hidden');
  joinView.classList.remove('hidden');
  (document.getElementById('room-code-input') as HTMLInputElement).focus();
});

// Back to default view
document.getElementById('join-back-btn')!.addEventListener('click', () => {
  joinView.classList.add('hidden');
  startDefault.classList.remove('hidden');
});

// Connect to room
document.getElementById('join-connect-btn')!.addEventListener('click', async () => {
  const input = document.getElementById('room-code-input') as HTMLInputElement;
  const code = input.value.trim().toUpperCase();
  if (code.length < 4) {
    showJoinError('Enter a 4-letter room code');
    return;
  }

  try {
    showJoinError('');
    input.disabled = true;
    await room.joinRoom(code);
    await startAsGuest();
    animate();
  } catch (err: any) {
    showJoinError(err.message);
    input.disabled = false;
  }
});

// Allow Enter key in code input
document.getElementById('room-code-input')!.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('join-connect-btn')!.click();
  }
});
