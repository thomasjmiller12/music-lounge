import {
  AudioEngine,
  type FrontControlName,
  type LayerName,
  type MacroAxisName,
} from './audio/engine';
import { Visualizer } from './ui/Visualizer';

const engine = new AudioEngine();
let visualizer: Visualizer | null = null;
let mutationFlashTimer = 0;

const startOverlay = document.getElementById('start-overlay')!;
const app = document.getElementById('app')!;
const surface = document.querySelector<HTMLElement>('.surface')!;
const bpmDisplay = document.getElementById('bpm-display')!;
const chordDisplay = document.getElementById('chord-display')!;
const phraseDisplay = document.getElementById('phrase-display')!;
const mutationIndicator = document.getElementById('mutation-indicator')!;
const macroSummary = document.getElementById('macro-summary')!;
const macroDescription = document.getElementById('macro-description')!;

const lightNightInput = document.querySelector<HTMLInputElement>('#macro-lightNight .macro-input')!;
const calmDriveInput = document.querySelector<HTMLInputElement>('#macro-calmDrive .macro-input')!;
const lightNightValue = document.getElementById('lightNight-value')!;
const calmDriveValue = document.getElementById('calmDrive-value')!;

const toneSlider = document.getElementById('slider-tone') as HTMLInputElement;
const spaceSlider = document.getElementById('slider-space') as HTMLInputElement;
const textureSlider = document.getElementById('slider-texture') as HTMLInputElement;

const layerPads = document.querySelectorAll<HTMLButtonElement>('.layer-pad');

const LAYER_KEYS: Record<string, LayerName> = {
  q: 'drums', w: 'bass', e: 'pad', r: 'arp', t: 'atmo',
};

(window as typeof window & { __musicLounge?: { engine: AudioEngine } }).__musicLounge = { engine };

function descriptor(value: number, words: string[]) {
  const index = Math.min(words.length - 1, Math.floor(value * words.length));
  return words[index];
}

function formatMacro(axis: MacroAxisName, value: number) {
  if (axis === 'lightNight') return descriptor(value, ['Sunlit', 'Golden', 'Dusk', 'Night']);
  return descriptor(value, ['Drift', 'Steady', 'Lifted', 'Drive']);
}

function getRoomSummary() {
  const state = engine.getEngineState();
  const light = descriptor(state.macros.lightNight, ['sunlit', 'golden', 'dusk', 'night']);
  const drive = descriptor(state.macros.calmDrive, ['drift', 'steady', 'lift', 'drive']);
  return {
    title: `${light} ${drive}`,
    description: `${Math.round(state.bpm)} BPM · ${state.currentChord.name}`,
  };
}

function mix(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function updateSurfaceTheme() {
  const state = engine.getEngineState();
  const ln = state.macros.lightNight;
  const cd = state.macros.calmDrive;
  const root = document.documentElement;

  // Surface background shifts warm→cool
  const bgR = Math.round(mix(245, 22, ln));
  const bgG = Math.round(mix(240, 24, ln));
  const bgB = Math.round(mix(232, 32, ln));
  surface.style.background = `rgba(${bgR}, ${bgG}, ${bgB}, 0.94)`;

  // Text color
  const textL = ln > 0.5 ? mix(200, 232, (ln - 0.5) * 2) : mix(26, 120, ln * 2);
  surface.style.color = ln > 0.5
    ? `rgb(${Math.round(textL)}, ${Math.round(textL - 4)}, ${Math.round(textL - 8)})`
    : `rgb(${Math.round(textL)}, ${Math.round(textL)}, ${Math.round(textL)})`;

  // Border color
  const borderA = ln > 0.5 ? 0.08 : 0.1;
  const borderC = ln > 0.5 ? 255 : 0;
  root.style.setProperty('--border-live', `rgba(${borderC}, ${borderC}, ${borderC}, ${borderA})`);

  // Orange accent shifts warmer(day) → cooler(night)
  const accentR = Math.round(mix(255, 100, ln));
  const accentG = Math.round(mix(107, 160, ln));
  const accentB = Math.round(mix(43, 240, ln));
  root.style.setProperty('--orange', `rgb(${accentR}, ${accentG}, ${accentB})`);
  root.style.setProperty('--orange-soft', `rgba(${accentR}, ${accentG}, ${accentB}, 0.15)`);

  // Slider gradient shifts with drive
  const driveHeat = mix(0.3, 1, cd);
  root.style.setProperty('--drive-heat', `${driveHeat}`);
}

function syncHud() {
  const state = engine.getEngineState();
  const summary = getRoomSummary();

  bpmDisplay.textContent = `${state.bpm} BPM`;
  chordDisplay.textContent = state.currentChord.name;
  phraseDisplay.textContent = `Phrase ${state.evolution.phraseIndex + 1}`;
  macroSummary.textContent = summary.title;
  macroDescription.textContent = summary.description;

  const queued = state.evolution.pendingDimensions[0];
  mutationIndicator.textContent = queued
    ? `${state.evolution.mutationLabel}`
    : state.evolution.mutationLabel;

  lightNightValue.textContent = formatMacro('lightNight', state.macros.lightNight);
  calmDriveValue.textContent = formatMacro('calmDrive', state.macros.calmDrive);

  layerPads.forEach((pad) => {
    const layer = pad.dataset.layer as LayerName;
    pad.classList.toggle('on', state.layers[layer].enabled);
    const bar = pad.querySelector<HTMLElement>('.layer-level-bar');
    if (bar) bar.style.height = `${Math.round(state.layers[layer].level * 100)}%`;
  });

  updateSurfaceTheme();
}

function syncSliders() {
  const state = engine.getEngineState();
  lightNightInput.value = String(Math.round(state.macros.lightNight * 1000));
  calmDriveInput.value = String(Math.round(state.macros.calmDrive * 1000));
  toneSlider.value = String(Math.round(state.frontPanel.tone * 1000));
  spaceSlider.value = String(Math.round(state.frontPanel.space * 1000));
  textureSlider.value = String(Math.round(state.frontPanel.texture * 1000));
}

function flashMutation() {
  mutationIndicator.classList.add('active');
  window.clearTimeout(mutationFlashTimer);
  mutationFlashTimer = window.setTimeout(() => mutationIndicator.classList.remove('active'), 1800);
}

function bindMacros() {
  lightNightInput.addEventListener('input', () => {
    engine.setMacroAxis('lightNight', Number(lightNightInput.value) / 1000);
    syncHud();
  });
  calmDriveInput.addEventListener('input', () => {
    engine.setMacroAxis('calmDrive', Number(calmDriveInput.value) / 1000);
    syncHud();
  });
}

function bindSliders() {
  toneSlider.addEventListener('input', () => {
    engine.setFrontControl('tone', Number(toneSlider.value) / 1000);
    syncHud();
  });
  spaceSlider.addEventListener('input', () => {
    engine.setFrontControl('space', Number(spaceSlider.value) / 1000);
    syncHud();
  });
  textureSlider.addEventListener('input', () => {
    engine.setFrontControl('texture', Number(textureSlider.value) / 1000);
    syncHud();
  });
}

function bindLayers() {
  layerPads.forEach((pad) => {
    pad.addEventListener('click', () => {
      engine.toggleLayer(pad.dataset.layer as LayerName);
      syncHud();
    });
  });
}

function bindKeyboard() {
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const key = e.key.toLowerCase();
    if (key === ' ') {
      e.preventDefault();
      if (!engine.getEngineState().playing) startApp();
    }
    if (LAYER_KEYS[key]) {
      engine.toggleLayer(LAYER_KEYS[key]);
      syncHud();
    }
  });
}

function bindEngineEvents() {
  engine.onBeat((beat, layers) => {
    if (beat === 0) syncHud();
    if (layers.kick) {
      surface.classList.remove('beat-pulse');
      void surface.offsetWidth;
      surface.classList.add('beat-pulse');
    }
  });

  engine.onPhrase(() => {
    syncHud();
    syncSliders();
  });

  engine.onMutation(() => {
    syncHud();
    syncSliders();
    flashMutation();
  });
}

async function startApp() {
  await engine.start();
  startOverlay.classList.add('hidden');
  app.classList.remove('hidden');

  if (!visualizer) {
    visualizer = new Visualizer(document.getElementById('viz-canvas') as HTMLCanvasElement, engine);
    visualizer.start();
  }

  syncHud();
  syncSliders();
}

function loopTheme() {
  updateSurfaceTheme();
  requestAnimationFrame(loopTheme);
}

bindMacros();
bindSliders();
bindLayers();
bindKeyboard();
bindEngineEvents();
syncHud();
updateSurfaceTheme();
loopTheme();

document.getElementById('start-btn')!.addEventListener('click', startApp);
