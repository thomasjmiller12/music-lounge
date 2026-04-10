import type { SliderState } from '../types';

export interface ControlCallbacks {
  onSliderChange: (state: SliderState) => void;
  onBpmChange: (bpm: number | null) => void;
  onVolumeChange: (volume: number) => void;
  onLorenzSpeedChange: (speed: number) => void;
  onPlay: () => void;
  onPause: () => void;
}

/**
 * Binds UI controls to callbacks and manages the control panel state.
 */
export function initControls(callbacks: ControlCallbacks): {
  getSliderState: () => SliderState;
} {
  const lightNightEl = document.getElementById('light-night') as HTMLInputElement;
  const calmDriveEl = document.getElementById('calm-drive') as HTMLInputElement;
  const bpmSelect = document.getElementById('bpm-select') as HTMLSelectElement;
  const volumeEl = document.getElementById('volume') as HTMLInputElement;
  const lorenzSpeedEl = document.getElementById('lorenz-speed') as HTMLInputElement;
  const playBtn = document.getElementById('play-btn')!;
  const pauseBtn = document.getElementById('pause-btn')!;
  const advancedToggle = document.getElementById('advanced-toggle')!;
  const advancedPanel = document.getElementById('advanced-panel')!;

  const getSliderState = (): SliderState => ({
    lightNight: parseInt(lightNightEl.value) / 1000,
    calmDrive: parseInt(calmDriveEl.value) / 1000,
  });

  // Slider events
  const onSliderInput = () => callbacks.onSliderChange(getSliderState());
  lightNightEl.addEventListener('input', onSliderInput);
  calmDriveEl.addEventListener('input', onSliderInput);

  // BPM
  bpmSelect.addEventListener('change', () => {
    const val = bpmSelect.value;
    callbacks.onBpmChange(val ? parseInt(val) : null);
  });

  // Volume
  volumeEl.addEventListener('input', () => {
    callbacks.onVolumeChange(parseInt(volumeEl.value) / 100);
  });

  // Lorenz speed
  lorenzSpeedEl.addEventListener('input', () => {
    // Map 1-100 to 0.0001-0.005
    const raw = parseInt(lorenzSpeedEl.value);
    const speed = 0.0001 + (raw / 100) * 0.0049;
    callbacks.onLorenzSpeedChange(speed);
  });

  // Transport
  playBtn.addEventListener('click', () => {
    playBtn.classList.add('active');
    pauseBtn.classList.remove('active');
    callbacks.onPlay();
  });
  pauseBtn.addEventListener('click', () => {
    pauseBtn.classList.add('active');
    playBtn.classList.remove('active');
    callbacks.onPause();
  });

  // Advanced panel toggle
  advancedToggle.addEventListener('click', () => {
    advancedPanel.classList.toggle('hidden');
    advancedToggle.textContent = advancedPanel.classList.contains('hidden')
      ? 'ADVANCED'
      : 'HIDE ADVANCED';
  });

  // Update slider track fills for visual feedback
  const updateTrackFill = (el: HTMLInputElement) => {
    const pct = (parseInt(el.value) / parseInt(el.max)) * 100;
    el.style.setProperty('--fill', `${pct}%`);
  };
  [lightNightEl, calmDriveEl].forEach((el) => {
    el.addEventListener('input', () => updateTrackFill(el));
    updateTrackFill(el);
  });

  return { getSliderState };
}
