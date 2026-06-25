import { GameState } from '../types';
import { formatTime, formatSpeed } from '../game/Renderer';

export class HUD {
  container: HTMLElement;
  minimapCanvas: HTMLCanvasElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  show(): void {
    this.container.innerHTML = `
      <div class="hud">
        <div class="hud-panel hud-minimap">
          <canvas id="minimap" width="132" height="132"></canvas>
        </div>
        <div class="hud-panel hud-lap">
          <div class="hud-lap-time" id="hud-lap-time">0:00.000</div>
          <div class="hud-lap-best" id="hud-lap-info">LAP 0 / 0 · BEST --:--.---</div>
        </div>
        <div class="hud-panel hud-position" id="hud-position" style="display:none">P1</div>
        <div class="hud-panel hud-rpm">
          <div>RPM <span id="hud-rpm-val">0</span></div>
          <div class="hud-rpm-bar">
            <div class="hud-rpm-fill" id="hud-rpm-fill" style="width:0%"></div>
            <div class="hud-rpm-redline" id="hud-redline" style="left:85%"></div>
          </div>
        </div>
        <div class="hud-panel hud-speed">
          <div class="hud-speed-value" id="hud-speed">0</div>
          <div class="hud-speed-unit">KM/H</div>
          <div class="hud-gear" id="hud-gear">N</div>
        </div>
        <div class="hud-panel hud-telemetry">
          <div class="hud-tel-row"><span class="hud-tel-label">马力</span><span class="hud-tel-value" id="tel-hp">0 HP</span></div>
          <div class="hud-tel-row"><span class="hud-tel-label">扭矩</span><span class="hud-tel-value" id="tel-tq">0 Nm</span></div>
          <div class="hud-tel-row"><span class="hud-tel-label">涡轮</span><span class="hud-tel-value" id="tel-boost">0.0 bar</span></div>
          <div class="hud-tel-row"><span class="hud-tel-label">水温</span><span class="hud-tel-value" id="tel-coolant">0°C</span></div>
          <div class="hud-tel-row"><span class="hud-tel-label">油温</span><span class="hud-tel-value" id="tel-oil">0°C</span></div>
          <div class="hud-tel-row"><span class="hud-tel-label">空燃比</span><span class="hud-tel-value" id="tel-afr">0</span></div>
          <div class="hud-tel-row"><span class="hud-tel-label">耐久</span><span class="hud-tel-value" id="tel-dur">100%</span></div>
        </div>
        <div class="hud-tuning-hint">按 T 打开调校面板</div>
      </div>
    `;
    this.minimapCanvas = this.container.querySelector('#minimap');
  }

  update(state: GameState, position?: number): void {
    const { player, engine, tuning, mode } = state;
    const speedEl = this.container.querySelector('#hud-speed');
    const gearEl = this.container.querySelector('#hud-gear');
    const rpmVal = this.container.querySelector('#hud-rpm-val');
    const rpmFill = this.container.querySelector('#hud-rpm-fill') as HTMLElement;
    const redline = this.container.querySelector('#hud-redline') as HTMLElement;

    if (speedEl) speedEl.textContent = formatSpeed(player.speed);
    if (gearEl) gearEl.textContent = player.gear === 0 ? 'N' : `G${player.gear}`;
    if (rpmVal) rpmVal.textContent = Math.round(player.rpm).toString();

    const rpmPct = (player.rpm / tuning.ecuRevLimit) * 100;
    if (rpmFill) rpmFill.style.width = `${Math.min(100, rpmPct)}%`;
    if (redline) redline.style.left = `${(tuning.ecuRevLimit * 0.92 / tuning.ecuRevLimit) * 100}%`;

    const lapTime = this.container.querySelector('#hud-lap-time');
    const lapInfo = this.container.querySelector('#hud-lap-info');
    if (lapTime) lapTime.textContent = formatTime(player.lapTime);
    if (lapInfo) {
      const best = player.bestLap < Infinity ? formatTime(player.bestLap) : '--:--.---';
      lapInfo.textContent = `LAP ${player.lap} · BEST ${best}`;
    }

    this.setTel('tel-hp', `${Math.round(engine.horsepower)} HP`);
    this.setTel('tel-tq', `${Math.round(engine.torque)} Nm`);
    this.setTel('tel-boost', `${engine.turboPressure.toFixed(1)} bar`);
    this.setTel('tel-afr', engine.afr.toFixed(1));

    this.setTelClass('tel-coolant', `${Math.round(engine.coolantTemp)}°C`, engine.coolantTemp);
    this.setTelClass('tel-oil', `${Math.round(engine.oilTemp)}°C`, engine.oilTemp);
    this.setTelClass('tel-dur', `${Math.round(engine.durability)}%`, 100 - engine.durability, true);

    const posEl = this.container.querySelector('#hud-position') as HTMLElement;
    if (posEl && mode === 'championship' && position !== undefined) {
      posEl.style.display = 'block';
      posEl.textContent = `P${position}`;
    } else if (posEl) {
      posEl.style.display = 'none';
    }

    if (player.offTrack) {
      const speedPanel = this.container.querySelector('.hud-speed');
      if (speedPanel) (speedPanel as HTMLElement).style.borderColor = '#ff3366';
    } else {
      const speedPanel = this.container.querySelector('.hud-speed');
      if (speedPanel) (speedPanel as HTMLElement).style.borderColor = '';
    }
  }

  private setTel(id: string, text: string): void {
    const el = this.container.querySelector(`#${id}`);
    if (el) el.textContent = text;
  }

  private setTelClass(id: string, text: string, value: number, inverted = false): void {
    const el = this.container.querySelector(`#${id}`);
    if (!el) return;
    el.textContent = text;
    el.classList.remove('hot', 'warn', 'ok');
    const v = inverted ? value : value;
    if (inverted ? v > 30 : v > 120) el.classList.add('hot');
    else if (inverted ? v > 15 : v > 100) el.classList.add('warn');
    else el.classList.add('ok');
  }

  hide(): void {
    this.container.innerHTML = '';
    this.minimapCanvas = null;
  }
}

export function showCountdown(container: HTMLElement, value: string): void {
  const existing = container.querySelector('.countdown');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = 'countdown';
  el.textContent = value;
  container.appendChild(el);
  setTimeout(() => el.remove(), 800);
}

export function showModal(
  container: HTMLElement,
  title: string,
  content: string,
  buttons: { label: string; action: () => void; primary?: boolean }[],
): void {
  const modal = document.createElement('div');
  modal.className = 'overlay-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <h2>${title}</h2>
      ${content}
      <div class="modal-buttons">
        ${buttons.map((b, i) => `<button data-idx="${i}" class="${b.primary ? 'primary' : ''}">${b.label}</button>`).join('')}
      </div>
    </div>
  `;
  modal.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt((btn as HTMLElement).dataset.idx || '0');
      modal.remove();
      buttons[idx].action();
    });
  });
  container.appendChild(modal);
}
