const ARC_START = (3 / 4) * Math.PI;   // 135° - bottom-left (7 o'clock)
const ARC_RANGE = (3 / 2) * Math.PI;   // 270° sweep
const R = 38;                            // SVG radius
const CX = 50, CY = 50;                 // SVG center
const STROKE_W = 5;

function polarToXY(angleDeg: number): [number, number] {
  const rad = angleDeg * Math.PI / 180;
  return [CX + R * Math.cos(rad), CY + R * Math.sin(rad)];
}

// Angles in degrees, measured clockwise from 3 o'clock (standard SVG)
const START_DEG = 135;  // 7 o'clock
const END_DEG = 45;     // 5 o'clock (going CW through top)

function valueToAngle(v: number): number {
  // 0 → 135°, 1 → 405° (45° + 360°), wrapping CW through top
  return START_DEG + v * 270;
}

function describeArc(startAngle: number, endAngle: number): string {
  const [sx, sy] = polarToXY(startAngle);
  const [ex, ey] = polarToXY(endAngle % 360);
  const sweep = endAngle - startAngle;
  const largeArc = sweep > 180 ? 1 : 0;
  return `M ${sx} ${sy} A ${R} ${R} 0 ${largeArc} 1 ${ex} ${ey}`;
}

export interface KnobOptions {
  label: string;
  value: number;
  color?: string;
  formatValue?: (value: number) => string;
  onChange: (value: number) => void;
}

export class Knob {
  private container: HTMLElement;
  private valueArc!: SVGPathElement;
  private dot!: SVGCircleElement;
  private valueLabel!: HTMLSpanElement;
  private _value: number;
  private onChange: (v: number) => void;
  private dragging = false;
  private dragStartY = 0;
  private dragStartValue = 0;
  private color: string;
  private formatValue?: (value: number) => string;

  constructor(container: HTMLElement, opts: KnobOptions) {
    this.container = container;
    this._value = opts.value;
    this.onChange = opts.onChange;
    this.color = opts.color || 'var(--accent)';
    this.formatValue = opts.formatValue;
    this.build(opts.label);
    this.updateVisual();
    this.bindEvents();
  }

  private build(label: string) {
    this.container.classList.add('knob');
    this.container.innerHTML = `
      <svg viewBox="0 0 100 100" class="knob-svg">
        <path class="knob-track" d="${describeArc(START_DEG, START_DEG + 270)}"
              fill="none" stroke="var(--border)" stroke-width="${STROKE_W}" stroke-linecap="round"/>
        <path class="knob-value" d=""
              fill="none" stroke="${this.color}" stroke-width="${STROKE_W}" stroke-linecap="round"/>
        <circle class="knob-dot" cx="0" cy="0" r="5" fill="${this.color}"/>
        <circle cx="${CX}" cy="${CY}" r="3" fill="var(--text-muted)" opacity="0.3"/>
      </svg>
      <span class="knob-label">${label}</span>
      <span class="knob-value-label">${this.getFormattedValue()}</span>
    `;
    this.valueArc = this.container.querySelector('.knob-value')!;
    this.dot = this.container.querySelector('.knob-dot')!;
    this.valueLabel = this.container.querySelector('.knob-value-label')!;
  }

  private updateVisual() {
    const angle = valueToAngle(this._value);
    // Value arc
    if (this._value > 0.005) {
      this.valueArc.setAttribute('d', describeArc(START_DEG, angle));
      this.valueArc.style.display = '';
    } else {
      this.valueArc.style.display = 'none';
    }
    // Dot position
    const [dx, dy] = polarToXY(angle % 360);
    this.dot.setAttribute('cx', dx.toString());
    this.dot.setAttribute('cy', dy.toString());
    // Label
    this.valueLabel.textContent = this.getFormattedValue();
  }

  private bindEvents() {
    const onDown = (startY: number) => {
      this.dragging = true;
      this.dragStartY = startY;
      this.dragStartValue = this._value;
      this.container.classList.add('active');
      document.body.style.cursor = 'grabbing';
    };

    const onMove = (currentY: number) => {
      if (!this.dragging) return;
      const delta = (this.dragStartY - currentY) / 150;
      this.setValue(this.dragStartValue + delta);
    };

    const onUp = () => {
      if (!this.dragging) return;
      this.dragging = false;
      this.container.classList.remove('active');
      document.body.style.cursor = '';
    };

    // Mouse
    this.container.addEventListener('mousedown', (e) => {
      e.preventDefault();
      onDown(e.clientY);
    });
    window.addEventListener('mousemove', (e) => onMove(e.clientY));
    window.addEventListener('mouseup', onUp);

    // Touch
    this.container.addEventListener('touchstart', (e) => {
      e.preventDefault();
      onDown(e.touches[0].clientY);
    }, { passive: false });
    window.addEventListener('touchmove', (e) => {
      if (this.dragging) onMove(e.touches[0].clientY);
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
