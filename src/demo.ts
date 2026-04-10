import { LyriaClient } from './audio/lyria-client';
import { AudioPlayer } from './audio/audio-player';
import { ParamEngine } from './music/param-engine';
import { LorenzModulator } from './music/lorenz-modulator';
import { DEMO_SCHEMAS } from './music/demo-schemas';
import type { SliderState, LyriaParams, DemoSchema } from './types';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const lyria = new LyriaClient(apiKey);
const audioPlayer = new AudioPlayer();
const lorenz = new LorenzModulator(0.002); // faster for demo
// ParamEngine created per-schema when playing
let paramEngine: ParamEngine | null = null;

// Pre-stepped Lorenz to be near the attractor
for (let i = 0; i < 500; i++) lorenz.step();

const statusEl = document.getElementById('status')!;
const schemasEl = document.getElementById('schemas')!;

let connected = false;
let activeSchemaId: string | null = null;
let activePosition: string | null = null;

// ── Position presets ──
const POSITIONS: Record<string, { label: string; sliders: SliderState }> = {
  'calm-day': { label: 'CALM + DAY', sliders: { lightNight: 0.1, calmDrive: 0.1 } },
  'calm-night': { label: 'CALM + NIGHT', sliders: { lightNight: 0.9, calmDrive: 0.1 } },
  'drive-day': { label: 'DRIVE + DAY', sliders: { lightNight: 0.1, calmDrive: 0.85 } },
  'center': { label: 'CENTER', sliders: { lightNight: 0.45, calmDrive: 0.45 } },
};

// ── Build UI ──
for (const schema of DEMO_SCHEMAS) {
  const card = document.createElement('div');
  card.className = 'schema-card';
  card.id = `card-${schema.id}`;

  card.innerHTML = `
    <div class="schema-name">${schema.name}</div>
    <div class="schema-desc">${schema.description}</div>
    <div class="schema-buttons">
      ${Object.entries(POSITIONS)
        .map(
          ([key, { label }]) =>
            `<button class="play-btn" data-schema="${schema.id}" data-pos="${key}">${label}</button>`,
        )
        .join('')}
    </div>
    <div class="schema-details" id="details-${schema.id}"></div>
  `;

  schemasEl.appendChild(card);
}

// ── Button click handler ──
schemasEl.addEventListener('click', async (e) => {
  const btn = (e.target as HTMLElement).closest('.play-btn') as HTMLElement;
  if (!btn) return;

  const schemaId = btn.dataset.schema!;
  const posKey = btn.dataset.pos!;

  // If clicking the same button, stop
  if (activeSchemaId === schemaId && activePosition === posKey) {
    stopPlayback();
    return;
  }

  await playSchema(schemaId, posKey);
});

// ── Stop all ──
document.getElementById('stop-all')!.addEventListener('click', stopPlayback);

async function ensureConnected(): Promise<void> {
  if (connected) return;

  statusEl.textContent = 'Initializing...';
  await audioPlayer.init();

  statusEl.textContent = 'Connecting to Lyria...';
  await new Promise<void>((resolve, reject) => {
    lyria.connect({
      onAudioChunk: (pcm) => audioPlayer.pushAudio(pcm),
      onFilteredPrompt: (text, reason) => {
        console.warn(`Filtered: "${text}" — ${reason}`);
      },
      onError: (err) => {
        statusEl.textContent = `Error: ${err.message}`;
        reject(err);
      },
      onClose: () => {
        connected = false;
        statusEl.textContent = 'Disconnected';
      },
      onReady: () => {
        connected = true;
        statusEl.textContent = 'Connected';
        resolve();
      },
    });
  });
}

async function playSchema(schemaId: string, posKey: string): Promise<void> {
  await ensureConnected();

  const schema = DEMO_SCHEMAS.find((s) => s.id === schemaId)!;
  const pos = POSITIONS[posKey];
  const lorenzState = lorenz.getState();

  // Create/swap param engine with this schema's palette
  paramEngine = new ParamEngine(schema.palette);
  paramEngine.setTargets(pos.sliders, lorenzState);
  // Snap to values immediately (demo — no need to ease in)
  for (let i = 0; i < 200; i++) paramEngine.tick();
  const params = paramEngine.getSmoothedParams();

  lyria.setPrompts(params.prompts);
  lyria.setConfig(params.config);

  if (!activeSchemaId) {
    lyria.play();
  } else {
    audioPlayer.resetBuffer();
    lyria.stop();
    lyria.setPrompts(params.prompts);
    lyria.setConfig(params.config);
    lyria.play();
  }

  // Update UI
  updateActiveUI(schemaId, posKey);
  showDetails(schema, params);

  activeSchemaId = schemaId;
  activePosition = posKey;
  statusEl.textContent = `Playing: ${schema.name} — ${pos.label}`;
}

function stopPlayback(): void {
  lyria.stop();
  audioPlayer.resetBuffer();
  activeSchemaId = null;
  activePosition = null;
  updateActiveUI(null, null);
  statusEl.textContent = 'Stopped';
}

function updateActiveUI(schemaId: string | null, posKey: string | null): void {
  // Clear all active states
  document.querySelectorAll('.schema-card').forEach((c) => c.classList.remove('active'));
  document.querySelectorAll('.play-btn').forEach((b) => b.classList.remove('playing'));

  if (schemaId && posKey) {
    document.getElementById(`card-${schemaId}`)?.classList.add('active');
    const activeBtn = document.querySelector(
      `.play-btn[data-schema="${schemaId}"][data-pos="${posKey}"]`,
    );
    activeBtn?.classList.add('playing');
  }
}

function showDetails(schema: DemoSchema, params: LyriaParams): void {
  const el = document.getElementById(`details-${schema.id}`);
  if (!el) return;

  const promptLines = params.prompts
    .map((p) => `  "${p.text}" → weight: ${p.weight.toFixed(2)}`)
    .join('\n');

  el.textContent = `Prompts:\n${promptLines}\n\nConfig:\n  density: ${params.config.density.toFixed(2)}\n  brightness: ${params.config.brightness.toFixed(2)}\n  temperature: ${params.config.temperature.toFixed(2)}\n  guidance: ${params.config.guidance.toFixed(2)}`;
}
