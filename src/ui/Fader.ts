export interface FaderOptions {
  label: string;
  value: number;
  color?: string;
  formatValue?: (value: number) => string;
  onChange: (value: number) => void;
}

export class Fader {
  private container: HTMLElement;
  private fill!: HTMLElement;
  private handle!: HTMLElement;
  private _value: number;
  private onChange: (v: number) => void;
  private dragging = false;
  private dragStartX = 0;
  private dragStartValue = 0;
  private formatValue?: (value: number) => string;
  private valueLabel!: HTMLElement;

  constructor(container: HTMLElement, opts: FaderOptions) {
    this.container = container;
    this._value = opts.value;
    this.onChange = opts.onChange;
    this.formatValue = opts.formatValue;
    const color = opts.color || 'var(--accent)';
    this.build(opts.label, color);
    this.updateVisual();
    this.bindEvents();
  }

  private build(label: string, color: string) {
    this.container.classList.add('fader');
    this.container.innerHTML = `
      <span class="fader-label">${label}</span>
      <div class="fader-track-area">
        <div class="fader-track">
          <div class="fader-fill" style="--fader-color: ${color}"></div>
          <div class="fader-handle" style="--fader-color: ${color}"></div>
        </div>
      </div>
      <span class="fader-value-label">${this.getFormattedValue()}</span>
    `;
    this.fill = this.container.querySelector('.fader-fill')!;
    this.handle = this.container.querySelector('.fader-handle')!;
    this.valueLabel = this.container.querySelector('.fader-value-label')!;
  }

  private updateVisual() {
    const pct = this._value * 100;
    this.fill.style.width = `${pct}%`;
    this.handle.style.left = `${pct}%`;
    this.valueLabel.textContent = this.getFormattedValue();
  }

  private bindEvents() {
    const trackArea = this.container.querySelector('.fader-track-area')!;

    const onDown = (startX: number) => {
      this.dragging = true;
      this.dragStartX = startX;
      this.dragStartValue = this._value;
      this.container.classList.add('active');
      document.body.style.cursor = 'grabbing';
    };

    const onMove = (currentX: number) => {
      if (!this.dragging) return;
      const delta = (currentX - this.dragStartX) / 120;
      this.setValue(this.dragStartValue + delta);
    };

    const onUp = () => {
      if (!this.dragging) return;
      this.dragging = false;
      this.container.classList.remove('active');
      document.body.style.cursor = '';
    };

    trackArea.addEventListener('mousedown', (e) => {
      e.preventDefault();
      onDown((e as MouseEvent).clientX);
    });
    window.addEventListener('mousemove', (e) => onMove(e.clientX));
    window.addEventListener('mouseup', onUp);

    trackArea.addEventListener('touchstart', (e) => {
      e.preventDefault();
      onDown((e as TouchEvent).touches[0].clientX);
    }, { passive: false });
    window.addEventListener('touchmove', (e) => {
      if (this.dragging) onMove(e.touches[0].clientX);
    });
    window.addEventListener('touchend', onUp);
  }

  private getFormattedValue() {
    return this.formatValue ? this.formatValue(this._value) : Math.round(this._value * 100).toString();
  }

  setValue(v: number, silent = false) {
    this._value = Math.max(0, Math.min(1, v));
    this.updateVisual();
    if (!silent) {
      this.onChange(this._value);
    }
  }

  getValue(): number { return this._value; }
}
