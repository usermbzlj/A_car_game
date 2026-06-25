import { TuningParams, EngineState } from '../types';
import { EngineModel } from '../tuning/EngineModel';
import { Renderer } from '../game/Renderer';

interface SliderDef {
  key: keyof TuningParams;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  format?: (v: number) => string;
}

const ENGINE_SLIDERS: SliderDef[] = [
  { key: 'fuelInjection', label: '喷油量', min: 50, max: 100, step: 1, unit: '%' },
  { key: 'ignitionTiming', label: '点火正时', min: -10, max: 15, step: 0.5, unit: '° BTDC', format: v => v.toFixed(1) },
  { key: 'turboBoost', label: '涡轮增压', min: 0.5, max: 2.5, step: 0.05, unit: 'bar', format: v => v.toFixed(2) },
  { key: 'airFuelRatio', label: '空燃比 AFR', min: 10, max: 16, step: 0.1, unit: '', format: v => v.toFixed(1) },
  { key: 'ecuAggression', label: 'ECU 油门映射', min: 0, max: 100, step: 1, unit: '%' },
  { key: 'ecuRevLimit', label: 'ECU 转速限制', min: 6000, max: 9000, step: 100, unit: ' RPM' },
  { key: 'radiatorFlow', label: '散热器流量', min: 0, max: 100, step: 1, unit: '%' },
  { key: 'oilCooler', label: '机油冷却', min: 0, max: 100, step: 1, unit: '%' },
];

const CHASSIS_SLIDERS: SliderDef[] = [
  { key: 'suspensionStiffness', label: '悬挂硬度', min: 20, max: 100, step: 1, unit: '%' },
  { key: 'suspensionHeight', label: '底盘高度', min: -30, max: 30, step: 1, unit: ' mm', format: v => (v > 0 ? '+' : '') + v.toFixed(0) },
  { key: 'diffLock', label: '差速器锁止 LSD', min: 0, max: 100, step: 1, unit: '%' },
  { key: 'brakeBalance', label: '刹车平衡 (前)', min: 40, max: 70, step: 1, unit: '%' },
  { key: 'finalDrive', label: '终传比', min: 2.5, max: 4.5, step: 0.05, unit: '', format: v => v.toFixed(2) },
];

export class TuningPanel {
  container: HTMLElement;
  overlay: HTMLElement;
  engine = new EngineModel();
  renderer: Renderer;
  onChange: (tuning: TuningParams) => void = () => {};
  onClose: () => void = () => {};
  activeTab = 'engine';
  visible = false;

  constructor(overlay: HTMLElement, renderer: Renderer) {
    this.overlay = overlay;
    this.container = document.createElement('div');
    this.container.className = 'tuning-panel';
    this.container.style.display = 'none';
    this.renderer = renderer;
  }

  mount(): void {
    this.overlay.appendChild(this.container);
  }

  show(tuning: TuningParams, engine: EngineState, rpm: number): void {
    this.visible = true;
    this.container.style.display = 'flex';
    this.render(tuning, engine, rpm);
  }

  hide(): void {
    this.visible = false;
    this.container.style.display = 'none';
  }

  update(tuning: TuningParams, engine: EngineState, rpm: number): void {
    if (!this.visible) return;
    this.updateStats(tuning, engine);
    this.updateGraph(tuning, rpm);
  }

  private render(tuning: TuningParams, engine: EngineState, rpm: number): void {
    this.container.innerHTML = `
      <div class="tuning-header">
        <h2>车辆调校</h2>
        <button class="tuning-close">ESC 关闭</button>
      </div>
      <div class="tuning-tabs">
        <button class="tuning-tab active" data-tab="engine">引擎</button>
        <button class="tuning-tab" data-tab="ecu">ECU / 散热</button>
        <button class="tuning-tab" data-tab="chassis">底盘</button>
        <button class="tuning-tab" data-tab="gears">齿比</button>
        <button class="tuning-tab" data-tab="dyno">Dyno</button>
      </div>
      <div class="tuning-body" id="tuning-body"></div>
      <div class="tuning-footer">
        <button id="tuning-reset">恢复默认</button>
        <button id="tuning-aggressive">激进设定</button>
        <button id="tuning-safe">保守设定</button>
      </div>
    `;

    this.container.querySelector('.tuning-close')?.addEventListener('click', () => this.onClose());
    this.container.querySelectorAll('.tuning-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.activeTab = (tab as HTMLElement).dataset.tab || 'engine';
        this.container.querySelectorAll('.tuning-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.renderTab(tuning);
      });
    });

    this.container.querySelector('#tuning-reset')?.addEventListener('click', () => {
      import('../types').then(({ DEFAULT_TUNING }) => {
        Object.assign(tuning, DEFAULT_TUNING);
        this.onChange(tuning);
        this.render(tuning, engine, rpm);
      });
    });

    this.container.querySelector('#tuning-aggressive')?.addEventListener('click', () => {
      tuning.fuelInjection = 95;
      tuning.turboBoost = 2.0;
      tuning.ignitionTiming = 12;
      tuning.airFuelRatio = 12.0;
      tuning.ecuAggression = 90;
      tuning.ecuRevLimit = 8500;
      this.onChange(tuning);
      this.renderTab(tuning);
    });

    this.container.querySelector('#tuning-safe')?.addEventListener('click', () => {
      tuning.fuelInjection = 75;
      tuning.turboBoost = 0.9;
      tuning.ignitionTiming = 6;
      tuning.airFuelRatio = 13.5;
      tuning.ecuAggression = 50;
      tuning.radiatorFlow = 90;
      tuning.oilCooler = 85;
      this.onChange(tuning);
      this.renderTab(tuning);
    });

    this.renderTab(tuning);
    this.updateStats(tuning, engine);
    this.updateGraph(tuning, rpm);
  }

  private renderTab(tuning: TuningParams): void {
    const body = this.container.querySelector('#tuning-body');
    if (!body) return;

    if (this.activeTab === 'engine') {
      body.innerHTML = this.buildSliders(ENGINE_SLIDERS.slice(0, 4), tuning);
    } else if (this.activeTab === 'ecu') {
      body.innerHTML = this.buildSliders(ENGINE_SLIDERS.slice(4), tuning);
    } else if (this.activeTab === 'chassis') {
      body.innerHTML = this.buildSliders(CHASSIS_SLIDERS, tuning);
    } else if (this.activeTab === 'gears') {
      body.innerHTML = `
        <div class="tuning-section">
          <div class="tuning-section-title">变速箱齿比</div>
          ${tuning.gearRatios.map((ratio, i) => `
            <div class="tuning-slider-group">
              <div class="tuning-slider-label">
                <span>${i + 1}档</span><span id="gear-val-${i}">${ratio.toFixed(2)}</span>
              </div>
              <input type="range" class="tuning-slider" data-gear="${i}"
                min="0.5" max="4" step="0.05" value="${ratio}" />
            </div>
          `).join('')}
        </div>
      `;
      body.querySelectorAll('[data-gear]').forEach(slider => {
        slider.addEventListener('input', () => {
          const idx = parseInt((slider as HTMLElement).dataset.gear || '0');
          tuning.gearRatios[idx] = parseFloat((slider as HTMLInputElement).value);
          const valEl = body.querySelector(`#gear-val-${idx}`);
          if (valEl) valEl.textContent = tuning.gearRatios[idx].toFixed(2);
          this.onChange(tuning);
        });
      });
    } else if (this.activeTab === 'dyno') {
      body.innerHTML = `
        <div class="tuning-section">
          <div class="tuning-section-title">Dyno 测功曲线</div>
          <div class="tuning-graph">
            <canvas id="dyno-canvas" width="360" height="160"></canvas>
            <div class="tuning-graph-label">蓝线 = 扭矩 (Nm) · 橙线 = 马力 (HP) · 红线 = 当前 RPM</div>
          </div>
          <div class="tuning-stats" id="dyno-stats"></div>
        </div>
      `;
      this.updateStats(tuning, { rpm: 0, torque: 0, horsepower: 0, oilTemp: 0, coolantTemp: 0, turboPressure: 0, durability: 100, knock: 0, afr: 0 });
    }

    body.querySelectorAll('.tuning-slider[data-key]').forEach(slider => {
      slider.addEventListener('input', () => {
        const key = (slider as HTMLElement).dataset.key as keyof TuningParams;
        const numVal = parseFloat((slider as HTMLInputElement).value);
        (tuning as unknown as Record<string, number>)[key] = numVal;
        const valEl = body.querySelector(`#val-${key}`);
        const def = [...ENGINE_SLIDERS, ...CHASSIS_SLIDERS].find(s => s.key === key);
        if (valEl && def) {
          valEl.textContent = (def.format ? def.format(numVal) : String(numVal)) + def.unit;
        }
        this.onChange(tuning);
      });
    });
  }

  private buildSliders(sliders: SliderDef[], tuning: TuningParams): string {
    return `<div class="tuning-section">${sliders.map(s => {
      const val = tuning[s.key] as number;
      const display = (s.format ? s.format(val) : val) + s.unit;
      return `
        <div class="tuning-slider-group">
          <div class="tuning-slider-label">
            <span>${s.label}</span><span id="val-${s.key}">${display}</span>
          </div>
          <input type="range" class="tuning-slider" data-key="${s.key}"
            min="${s.min}" max="${s.max}" step="${s.step}" value="${val}" />
        </div>
      `;
    }).join('')}</div>`;
  }

  private updateStats(tuning: TuningParams, engine: EngineState): void {
    const maxHp = this.engine.getMaxHp(tuning);
    const maxTq = this.engine.getMaxTorque(tuning);
    const statsEl = this.container.querySelector('#dyno-stats') ||
      this.container.querySelector('.tuning-body');

    const statsHtml = `
      <div class="tuning-stats">
        <div class="tuning-stat"><div class="tuning-stat-label">峰值马力</div><div class="tuning-stat-value good">${Math.round(maxHp)} HP</div></div>
        <div class="tuning-stat"><div class="tuning-stat-label">峰值扭矩</div><div class="tuning-stat-value good">${Math.round(maxTq)} Nm</div></div>
        <div class="tuning-stat"><div class="tuning-stat-label">爆震指数</div><div class="tuning-stat-value ${engine.knock > 50 ? 'danger' : engine.knock > 20 ? 'warning' : 'good'}">${Math.round(engine.knock)}</div></div>
        <div class="tuning-stat"><div class="tuning-stat-label">引擎耐久</div><div class="tuning-stat-value ${engine.durability < 50 ? 'danger' : engine.durability < 80 ? 'warning' : 'good'}">${Math.round(engine.durability)}%</div></div>
      </div>
    `;

    const existing = this.container.querySelector('.tuning-stats');
    if (existing && this.activeTab !== 'dyno') {
      existing.outerHTML = statsHtml;
    } else if (this.activeTab === 'dyno') {
      const dynoStats = this.container.querySelector('#dyno-stats');
      if (dynoStats) dynoStats.innerHTML = statsHtml.replace('<div class="tuning-stats">', '').replace('</div>', '');
    }
  }

  private updateGraph(tuning: TuningParams, rpm: number): void {
    const canvas = this.container.querySelector('#dyno-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    const curve = this.engine.computeTorqueCurve(tuning);
    this.renderer.drawTuningDyno(canvas, curve, rpm);
  }
}
