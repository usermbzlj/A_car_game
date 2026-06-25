import {
  GameState, GameMode, DEFAULT_TUNING, createInitialCarState,
  createInitialEngineState, AIEntry, TuningParams,
} from '../types';
import { TRACKS, getPointOnTrack } from '../data/tracks';
import { InputManager } from './Input';
import { CarPhysics, isOnTrack, checkCheckpoint, applyOffTrackPenalty, getTrackProgress, resetCheckpointTracking } from './Physics';
import { EngineModel } from '../tuning/EngineModel';
import { Renderer, formatTime } from './Renderer';
import { EngineAudio, playBeep } from './Audio';
import { MenuUI } from '../ui/Menu';
import { HUD, showCountdown, showModal } from '../ui/HUD';
import { TuningPanel } from '../ui/TuningPanel';

const AI_NAMES = ['SAITO', 'WEBER', 'MULLER', 'ROSSI', 'TANAKA'];
const AI_COLORS = ['#ff4444', '#ff8800', '#aa44ff', '#44ff88', '#ff44aa'];

function cloneTuning(t: TuningParams): TuningParams {
  return { ...t, gearRatios: [...t.gearRatios] };
}

function createAI(count: number): AIEntry[] {
  return AI_NAMES.slice(0, count).map((name, i) => ({
    name,
    skill: 0.6 + i * 0.08,
    tuning: cloneTuning({
      ...DEFAULT_TUNING,
      fuelInjection: 80 + i * 3,
      turboBoost: 1.0 + i * 0.15,
      ecuAggression: 60 + i * 8,
    }),
    state: createInitialCarState(0, 0, 0),
    color: AI_COLORS[i],
  }));
}

export class Game {
  canvas: HTMLCanvasElement;
  overlay: HTMLElement;
  renderer: Renderer;
  input: InputManager;
  physics = new CarPhysics();
  engineModel = new EngineModel();
  audio = new EngineAudio();
  menu: MenuUI;
  hud: HUD;
  tuningPanel: TuningPanel;

  state: GameState;
  running = false;
  lastTime = 0;
  countdownTimer = 0;
  dynoRpm = 2000;
  dynoThrottle = 0;
  dynoDir = 1;

  constructor(canvas: HTMLCanvasElement, overlay: HTMLElement) {
    this.canvas = canvas;
    this.overlay = overlay;
    this.renderer = new Renderer(canvas);
    this.input = new InputManager();
    this.menu = new MenuUI(overlay);
    this.hud = new HUD(overlay);
    this.tuningPanel = new TuningPanel(overlay, this.renderer);

    this.state = this.createInitialState();

    this.menu.onSelect = (mode) => this.startMode(mode);
    this.tuningPanel.onChange = (t) => { this.state.tuning = t; };
    this.tuningPanel.onClose = () => { this.state.tuningOpen = false; this.tuningPanel.hide(); };
    this.tuningPanel.mount();

    canvas.addEventListener('click', () => this.audio.init());
  }

  createInitialState(): GameState {
    return {
      mode: 'menu',
      paused: false,
      tuningOpen: false,
      countdown: 0,
      raceStarted: false,
      raceFinished: false,
      currentTrack: 0,
      tuning: cloneTuning(DEFAULT_TUNING),
      engine: createInitialEngineState(),
      player: createInitialCarState(0, 0, 0),
      ai: [],
      championship: {
        round: 0,
        points: 0,
        standings: [{ name: 'YOU', points: 0 }, ...AI_NAMES.map(n => ({ name: n, points: 0 }))],
        rounds: [],
      },
      timeTrialBest: Infinity,
      sessionBest: Infinity,
    };
  }

  start(): void {
    this.running = true;
    this.menu.show(this.state);
    requestAnimationFrame((t) => this.loop(t));
  }

  startMode(mode: GameMode): void {
    this.audio.init();
    this.audio.resume();
    this.state = { ...this.createInitialState(), mode, tuning: cloneTuning(this.state.tuning) };
    this.state.championship = this.createInitialState().championship;

    if (mode === 'championship') {
      this.state.currentTrack = this.state.championship.round % TRACKS.length;
    } else if (mode === 'time_trial') {
      this.state.currentTrack = 0;
    } else {
      this.state.currentTrack = 0;
    }

    this.menu.hide();
    this.resetRace();

    if (mode === 'free_tuning') {
      this.state.raceStarted = true;
      this.hud.hide();
      this.state.tuningOpen = true;
      this.tuningPanel.show(this.state.tuning, this.state.engine, this.dynoRpm);
    } else {
      this.hud.show();
      this.state.countdown = 3;
      this.countdownTimer = 3;
      showCountdown(this.overlay, '3');
    }
  }

  resetRace(): void {
    const track = TRACKS[this.state.currentTrack];
    const start = track.points[0];
    const next = track.points[1];
    const angle = Math.atan2(next.y - start.y, next.x - start.x);

    resetCheckpointTracking();
    this.state.player = createInitialCarState(start.x, start.y, angle);
    this.state.engine = createInitialEngineState();
    this.state.raceFinished = false;
    this.state.raceStarted = false;
    this.state.paused = false;

    const aiCount = this.state.mode === 'championship' ? 5 : this.state.mode === 'time_trial' ? 0 : 3;
    this.state.ai = createAI(aiCount);
    this.state.ai.forEach((ai, i) => {
      const offset = (i + 1) * 25;
      const perpX = -Math.sin(angle) * offset;
      const perpY = Math.cos(angle) * offset;
      ai.state = createInitialCarState(start.x + perpX, start.y + perpY - (i + 1) * 20, angle);
    });
  }

  loop(time: number): void {
    if (!this.running) return;
    const dt = Math.min((time - this.lastTime) / 1000, 0.05);
    this.lastTime = time;

    this.update(dt);
    this.render();

    requestAnimationFrame((t) => this.loop(t));
  }

  update(dt: number): void {
    if (this.state.mode === 'menu') return;

    const input = this.input.update();

    if (input.pause && !this.state.raceFinished) {
      this.state.paused = !this.state.paused;
      if (this.state.paused) {
        showModal(this.overlay, '暂停', '<p>游戏已暂停</p>', [
          { label: '继续', action: () => { this.state.paused = false; }, primary: true },
          { label: '主菜单', action: () => this.goToMenu() },
        ]);
      }
    }

    if (input.tuning) {
      this.state.tuningOpen = !this.state.tuningOpen;
      if (this.state.tuningOpen) {
        this.tuningPanel.show(this.state.tuning, this.state.engine, this.state.player.rpm);
      } else {
        this.tuningPanel.hide();
      }
    }

    if (this.state.paused || this.state.raceFinished) return;

    // Countdown
    if (this.state.countdown > 0) {
      this.countdownTimer -= dt;
      if (this.countdownTimer <= 0) {
        this.state.countdown--;
        if (this.state.countdown > 0) {
          showCountdown(this.overlay, this.state.countdown.toString());
          this.countdownTimer = 1;
        } else {
          showCountdown(this.overlay, 'GO!');
          playBeep();
          this.state.raceStarted = true;
        }
      }
      return;
    }

    if (this.state.mode === 'free_tuning') {
      this.updateDyno(dt, input);
      this.tuningPanel.update(this.state.tuning, this.state.engine, this.dynoRpm);
      return;
    }

    if (!this.state.raceStarted) return;

    const { player, tuning } = this.state;
    const track = TRACKS[this.state.currentTrack];

    // Player physics
    if (input.shiftUp) this.physics.shiftUp(player, tuning);
    if (input.shiftDown) this.physics.shiftDown(player, tuning);

    this.physics.update(
      player, tuning,
      input.throttle, input.brake, input.steer, input.handbrake, dt,
    );

    const onTrack = isOnTrack(track, player.x, player.y);
    applyOffTrackPenalty(player, onTrack, dt);

    player.lapTime += dt;
    checkCheckpoint(track, player);

    this.engineModel.update(this.state.engine, tuning, player.rpm, input.throttle, dt);
    this.audio.update(player.rpm, input.throttle, player.speed);

    // AI update
    this.updateAI(dt, track);

    // Race finish check
    const totalLaps = this.state.mode === 'time_trial' ? 1 : track.lapCount;
    if (player.lap >= totalLaps && !player.finished) {
      player.finished = true;
      this.finishRace();
    }

    // HUD
    const position = this.getPlayerPosition();
    this.hud.update(this.state, position);

    if (this.state.tuningOpen) {
      this.tuningPanel.update(this.state.tuning, this.state.engine, player.rpm);
    }
  }

  updateDyno(dt: number, input: { throttle: number }): void {
    this.dynoThrottle = input.throttle;
    if (this.dynoThrottle > 0) {
      this.dynoRpm = Math.min(this.state.tuning.ecuRevLimit, this.dynoRpm + dt * 3000 * this.dynoThrottle);
    } else {
      this.dynoRpm = Math.max(800, this.dynoRpm - dt * 2000);
    }
    this.engineModel.update(this.state.engine, this.state.tuning, this.dynoRpm, this.dynoThrottle || 0.3, dt);
    this.audio.update(this.dynoRpm, this.dynoThrottle || 0.3, 0);
  }

  updateAI(dt: number, track: typeof TRACKS[0]): void {
    for (const ai of this.state.ai) {
      const progress = getTrackProgress(track, ai.state.x, ai.state.y);
      const lookAhead = 0.02 + ai.skill * 0.03;
      const target = getPointOnTrack(track, progress + lookAhead);
      const targetAngle = Math.atan2(target.y - ai.state.y, target.x - ai.state.x);
      let angleDiff = targetAngle - ai.state.angle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      const steer = Math.max(-1, Math.min(1, angleDiff * 2));
      const throttle = 0.7 + ai.skill * 0.3;
      const brake = Math.abs(angleDiff) > 0.5 ? 0.5 : 0;

      this.physics.update(ai.state, ai.tuning, throttle, brake, steer, false, dt);
      this.physics.autoShift(ai.state, ai.tuning);

      const onTrack = isOnTrack(track, ai.state.x, ai.state.y);
      applyOffTrackPenalty(ai.state, onTrack, dt);
      ai.state.lapTime += dt;
      checkCheckpoint(track, ai.state);
    }
  }

  getPlayerPosition(): number {
    const all = [this.state.player, ...this.state.ai.map(a => a.state)];
    const track = TRACKS[this.state.currentTrack];
    const scored = all.map((car, i) => ({
      idx: i,
      score: car.lap * 10000 + getTrackProgress(track, car.x, car.y) - (car.finished ? 100000 : 0),
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.findIndex(s => s.idx === 0) + 1;
  }

  finishRace(): void {
    this.state.raceFinished = true;
    const track = TRACKS[this.state.currentTrack];
    const position = this.getPlayerPosition();
    const time = this.state.player.lapTime;

    if (this.state.mode === 'time_trial') {
      if (time < this.state.timeTrialBest) this.state.timeTrialBest = time;
      showModal(this.overlay, '计时赛完成', `
        <div class="result-time">${formatTime(time)}</div>
        <p>最佳: ${formatTime(this.state.timeTrialBest)}</p>
      `, [
        { label: '再来一圈', action: () => { this.resetRace(); this.state.countdown = 3; this.countdownTimer = 3; this.state.raceFinished = false; showCountdown(this.overlay, '3'); }, primary: true },
        { label: '主菜单', action: () => this.goToMenu() },
      ]);
    } else if (this.state.mode === 'championship') {
      const points = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1][position - 1] || 0;
      this.state.championship.points += points;
      this.state.championship.standings[0].points = this.state.championship.points;

      for (let i = 0; i < this.state.ai.length; i++) {
        const aiPos = this.getAIPosition(i);
        const aiPts = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1][aiPos - 1] || 0;
        this.state.championship.standings[i + 1].points += aiPts;
      }

      this.state.championship.round++;
      const isLastRound = this.state.championship.round >= 3;

      const standingsHtml = this.state.championship.standings
        .sort((a, b) => b.points - a.points)
        .map((s, i) => `<tr class="${s.name === 'YOU' ? 'highlight' : ''}"><td class="pos">${i + 1}</td><td>${s.name}</td><td>${s.points}</td></tr>`)
        .join('');

      showModal(this.overlay, isLastRound ? '锦标赛结束' : `第 ${this.state.championship.round} 站完成`, `
        <p>${track.name} · 名次 P${position} · +${points} 分</p>
        <div class="result-time">${formatTime(time)}</div>
        <table class="standings-table">
          <tr><th>#</th><th>车手</th><th>积分</th></tr>
          ${standingsHtml}
        </table>
      `, isLastRound ? [
        { label: '主菜单', action: () => this.goToMenu(), primary: true },
      ] : [
        { label: '下一站', action: () => { this.state.currentTrack = this.state.championship.round % TRACKS.length; this.resetRace(); this.state.raceFinished = false; this.state.countdown = 3; this.countdownTimer = 3; showCountdown(this.overlay, '3'); }, primary: true },
        { label: '主菜单', action: () => this.goToMenu() },
      ]);
    } else {
      showModal(this.overlay, '练习完成', `
        <p>${track.name} · ${track.lapCount} 圈</p>
        <div class="result-time">${formatTime(time)}</div>
        <p>最快圈: ${this.state.player.bestLap < Infinity ? formatTime(this.state.player.bestLap) : '--'}</p>
      `, [
        { label: '继续练习', action: () => { this.resetRace(); this.state.raceFinished = false; this.state.raceStarted = true; }, primary: true },
        { label: '主菜单', action: () => this.goToMenu() },
      ]);
    }
  }

  getAIPosition(aiIndex: number): number {
    const all = [this.state.player, ...this.state.ai.map(a => a.state)];
    const track = TRACKS[this.state.currentTrack];
    const scored = all.map((car, i) => ({
      idx: i,
      score: car.lap * 10000 + getTrackProgress(track, car.x, car.y),
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.findIndex(s => s.idx === aiIndex + 1) + 1;
  }

  goToMenu(): void {
    this.state.mode = 'menu';
    this.state.paused = false;
    this.state.tuningOpen = false;
    this.state.raceFinished = false;
    this.hud.hide();
    this.tuningPanel.hide();
    this.overlay.querySelectorAll('.overlay-modal, .countdown').forEach(el => el.remove());
    this.menu.show(this.state);
    this.audio.stop();
  }

  render(): void {
    if (this.state.mode === 'menu') return;

    const track = TRACKS[this.state.currentTrack];
    const { player, ai } = this.state;

    this.renderer.clear();

    if (this.state.mode !== 'free_tuning') {
      this.renderer.setCamera(player.x, player.y, player.speed);
      this.renderer.drawTrack(track);
      this.renderer.drawSpeedLines(player.speed);

      for (const a of ai) {
        this.renderer.drawCar(a.state, a.color);
      }
      this.renderer.drawCar(player, '#00e5ff', true);

      if (this.hud.minimapCanvas) {
        this.renderer.drawMinimap(track, player, ai, this.hud.minimapCanvas);
      }
    } else {
      // Dyno background
      const ctx = this.renderer.ctx;
      ctx.fillStyle = '#0a0e14';
      ctx.fillRect(0, 0, this.renderer.width, this.renderer.height);
      ctx.fillStyle = 'rgba(0,229,255,0.05)';
      ctx.font = '14px Orbitron';
      ctx.textAlign = 'center';
      ctx.fillText('DYNO 测功模式 — 按住 W 加速引擎', this.renderer.width / 2, this.renderer.height / 2 - 40);
      ctx.font = '48px Orbitron';
      ctx.fillStyle = '#00e5ff';
      ctx.fillText(`${Math.round(this.dynoRpm)} RPM`, this.renderer.width / 2, this.renderer.height / 2 + 20);
      ctx.font = '24px JetBrains Mono';
      ctx.fillStyle = '#ffaa00';
      ctx.fillText(`${Math.round(this.state.engine.horsepower)} HP / ${Math.round(this.state.engine.torque)} Nm`, this.renderer.width / 2, this.renderer.height / 2 + 70);
    }
  }
}
