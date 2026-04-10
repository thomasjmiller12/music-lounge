export interface MacroSliderOptions {
  label: string;
  startLabel: string;
  endLabel: string;
  value: number;
  colorStart?: string;
  colorEnd?: string;
  formatValue?: (value: number) => string;
  onChange: (value: number) => void;
}

export class MacroSlider {
  private container: HTMLElement;
  private input!: HTMLInputElement;
  private valueLabel!: HTMLElement;
  private _value: number;
  private onChange: (value: number) => void;
  private formatValue?: (value: number) => string;

  constructor(container: HTMLElement, opts: MacroSliderOptions) {
    this.container = container;
    this._value = opts.value;
    this.onChange = opts.onChange;
    this.formatValue = opts.formatValue;
    this.build(opts);
    this.updateVisual();
    this.bindEvents();
  }

  private build(opts: MacroSliderOptions) {
    const colorStart = opts.colorStart || 'rgba(255, 192, 122, 0.55)';
    const colorEnd = opts.colorEnd || 'rgba(109, 156, 230, 0.55)';

    this.container.classList.add('macro-slider');
    this.container.innerHTML = `
      <div class="macro-header">
        <span class="macro-label">${opts.label}</span>
        <span class="macro-value">${this.getFormattedValue()}</span>
      </div>
      <div class="macro-input-shell" style="--macro-start:${colorStart}; --macro-end:${colorEnd};">
        <input class="macro-input" type="range" min="0" max="1000" value="${Math.round(this._value * 1000)}" />
      </div>
      <div class="macro-captions">
        <span>${opts.startLabel}</span>
        <span>${opts.endLabel}</span>
      </div>
    `;

    this.input = this.container.querySelector('.macro-input')!;
    this.valueLabel = this.container.querySelector('.macro-value')!;
  }

  private bindEvents() {
    this.input.addEventListener('input', () => {
      this.setValue(Number(this.input.value) / 1000);
    });
  }

  private getFormattedValue() {
    return this.formatValue ? this.formatValue(this._value) : `${Math.round(this._value * 100)}`;
  }

  private updateVisual() {
    this.input.value = `${Math.round(this._value * 1000)}`;
    this.valueLabel.textContent = this.getFormattedValue();
    this.container.style.setProperty('--macro-progress', `${this._value * 100}%`);
  }

  setValue(value: number, silent = false) {
    this._value = Math.max(0, Math.min(1, value));
    this.updateVisual();
    if (!silent) {
      this.onChange(this._value);
    }
  }

  getValue() {
    return this._value;
  }
}
