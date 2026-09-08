import { TrackData, CarState, AIEntry, EngineState, TuningParams } from '../types';

export class Renderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width = 0;
  height = 0;
  cameraX = 0;
  cameraY = 0;
  cameraZoom = 1;
  shake = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D not supported');
    this.ctx = ctx;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  worldToScreen(wx: number, wy: number): { x: number; y: number } {
    const sx = (wx - this.cameraX) * this.cameraZoom + this.width / 2;
    const sy = (wy - this.cameraY) * this.cameraZoom + this.height / 2;
    return { x: sx, y: sy };
  }

  setCamera(x: number, y: number, speed: number): void {
    this.cameraX += (x - this.cameraX) * 0.12;
    this.cameraY += (y - this.cameraY) * 0.12;
    this.cameraZoom = 0.55 + Math.min(speed / 120, 0.15);
    this.shake = Math.min(speed / 100, 0.5) * 3;
  }

  clear(): void {
    this.ctx.fillStyle = '#0a0e14';
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  drawTrack(track: TrackData): void {
    const ctx = this.ctx;
    const pts = track.points;
    const hw = track.width / 2;

    ctx.save();
    const shakeX = (Math.random() - 0.5) * this.shake;
    const shakeY = (Math.random() - 0.5) * this.shake;
    ctx.translate(shakeX, shakeY);

    // Grass
    ctx.fillStyle = '#1a2a1a';
    ctx.fillRect(0, 0, this.width, this.height);

    // Track surface
    this.drawRibbon(pts, hw + 8, '#333');
    this.drawRibbon(pts, hw, '#2a2a2a');

    // Kerbs
    this.drawKerbs(pts, hw);

    // Racing line hint
    this.drawRibbon(pts, 2, 'rgba(0,229,255,0.15)');

    // Start line
    const start = pts[0];
    const next = pts[1];
    const angle = Math.atan2(next.y - start.y, next.x - start.x);
    const perpX = -Math.sin(angle) * hw;
    const perpY = Math.cos(angle) * hw;
    const s1 = this.worldToScreen(start.x + perpX, start.y + perpY);
    const s2 = this.worldToScreen(start.x - perpX, start.y - perpY);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(s1.x, s1.y);
    ctx.lineTo(s2.x, s2.y);
    ctx.stroke();

    // Checkered pattern on start
    for (let i = -4; i < 4; i++) {
      for (let j = 0; j < 2; j++) {
        if ((i + j) % 2 === 0) {
          const t = i / 8;
          const cx = start.x + perpX * t + Math.cos(angle) * j * 8;
          const cy = start.y + perpY * t + Math.sin(angle) * j * 8;
          const sc = this.worldToScreen(cx, cy);
          ctx.fillStyle = '#fff';
          ctx.fillRect(sc.x - 4, sc.y - 4, 8, 8);
        }
      }
    }

    ctx.restore();
  }

  drawRibbon(pts: { x: number; y: number }[], halfWidth: number, color: string): void {
    const ctx = this.ctx;
    const left: { x: number; y: number }[] = [];
    const right: { x: number; y: number }[] = [];

    for (let i = 0; i < pts.length; i++) {
      const prev = pts[(i - 1 + pts.length) % pts.length];
      const curr = pts[i];
      const next = pts[(i + 1) % pts.length];
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len * halfWidth;
      const ny = dx / len * halfWidth;
      left.push({ x: curr.x + nx, y: curr.y + ny });
      right.push({ x: curr.x - nx, y: curr.y - ny });
    }

    ctx.fillStyle = color;
    ctx.beginPath();
    const sl = this.worldToScreen(left[0].x, left[0].y);
    ctx.moveTo(sl.x, sl.y);
    for (let i = 1; i < left.length; i++) {
      const s = this.worldToScreen(left[i].x, left[i].y);
      ctx.lineTo(s.x, s.y);
    }
    for (let i = right.length - 1; i >= 0; i--) {
      const s = this.worldToScreen(right[i].x, right[i].y);
      ctx.lineTo(s.x, s.y);
    }
    ctx.closePath();
    ctx.fill();
  }

  drawKerbs(pts: { x: number; y: number }[], halfWidth: number): void {
    const ctx = this.ctx;
    for (let i = 0; i < pts.length; i += 3) {
      const curr = pts[i];
      const next = pts[(i + 1) % pts.length];
      const angle = Math.atan2(next.y - curr.y, next.x - curr.x);
      const perpX = -Math.sin(angle);
      const perpY = Math.cos(angle);

      for (const side of [-1, 1]) {
        for (let k = 0; k < 4; k++) {
          const t = k / 4;
          const bx = curr.x + (next.x - curr.x) * t;
          const by = curr.y + (next.y - curr.y) * t;
          const kx = bx + perpX * halfWidth * side;
          const ky = by + perpY * halfWidth * side;
          const sc = this.worldToScreen(kx, ky);
          ctx.fillStyle = k % 2 === 0 ? '#ff3333' : '#ffffff';
          ctx.fillRect(sc.x - 3, sc.y - 3, 6, 6);
        }
      }
    }
  }

  drawCar(car: CarState, color: string, isPlayer = false): void {
    const ctx = this.ctx;
    const sc = this.worldToScreen(car.x, car.y);
    const scale = this.cameraZoom;

    ctx.save();
    ctx.translate(sc.x, sc.y);
    ctx.rotate(car.angle);
    ctx.scale(scale, scale);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(-22, -10, 44, 20);

    // Body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(24, 0);
    ctx.lineTo(10, -11);
    ctx.lineTo(-18, -11);
    ctx.lineTo(-22, -7);
    ctx.lineTo(-22, 7);
    ctx.lineTo(-18, 11);
    ctx.lineTo(10, 11);
    ctx.closePath();
    ctx.fill();

    // Cockpit
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(-5, -7, 14, 14);

    // Rear wing
    ctx.fillStyle = '#111';
    ctx.fillRect(-20, -13, 4, 26);

    // Headlights
    ctx.fillStyle = '#ffffcc';
    ctx.fillRect(20, -8, 4, 4);
    ctx.fillRect(20, 4, 4, 4);

    // Brake lights
    if (car.brake > 0) {
      ctx.fillStyle = '#ff0000';
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 10;
      ctx.fillRect(-21, -9, 3, 5);
      ctx.fillRect(-21, 4, 3, 5);
      ctx.shadowBlur = 0;
    }

    // Player indicator
    if (isPlayer) {
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Drift smoke
    if (car.drift > 0.2) {
      ctx.fillStyle = `rgba(200,200,200,${car.drift * 0.3})`;
      ctx.beginPath();
      ctx.arc(-15, 0, 8 + car.drift * 5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  drawSpeedLines(speed: number): void {
    if (speed < 15) return;
    const ctx = this.ctx;
    const intensity = Math.min((speed - 15) / 50, 1);
    ctx.save();
    ctx.strokeStyle = `rgba(0,229,255,${intensity * 0.15})`;
    ctx.lineWidth = 1;
    for (let i = 0; i < 20 * intensity; i++) {
      const x = Math.random() * this.width;
      const y = Math.random() * this.height;
      const len = 30 + Math.random() * 60;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawMinimap(track: TrackData, player: CarState, ai: AIEntry[], canvas: HTMLCanvasElement): void {
    const mctx = canvas.getContext('2d');
    if (!mctx) return;
    const w = canvas.width;
    const h = canvas.height;

    mctx.fillStyle = '#111';
    mctx.fillRect(0, 0, w, h);

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of track.points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    const pad = 20;
    const scaleX = (w - pad * 2) / (maxX - minX);
    const scaleY = (h - pad * 2) / (maxY - minY);
    const scale = Math.min(scaleX, scaleY);

    const tx = (x: number) => pad + (x - minX) * scale;
    const ty = (y: number) => pad + (y - minY) * scale;

    mctx.strokeStyle = '#444';
    mctx.lineWidth = 3;
    mctx.beginPath();
    mctx.moveTo(tx(track.points[0].x), ty(track.points[0].y));
    for (let i = 1; i < track.points.length; i++) {
      mctx.lineTo(tx(track.points[i].x), ty(track.points[i].y));
    }
    mctx.closePath();
    mctx.stroke();

    for (const a of ai) {
      mctx.fillStyle = a.color;
      mctx.beginPath();
      mctx.arc(tx(a.state.x), ty(a.state.y), 3, 0, Math.PI * 2);
      mctx.fill();
    }

    mctx.fillStyle = '#00e5ff';
    mctx.beginPath();
    mctx.arc(tx(player.x), ty(player.y), 4, 0, Math.PI * 2);
    mctx.fill();
  }

  drawTuningDyno(
    canvas: HTMLCanvasElement,
    curve: { rpm: number; torque: number; hp: number }[],
    currentRpm: number,
  ): void {
    const ctx = canvas.getContext('2d');
    if (!ctx || curve.length === 0) return;
    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = '#0a0e14';
    ctx.fillRect(0, 0, w, h);

    const maxTorque = Math.max(...curve.map(p => p.torque), 1);
    const maxHp = Math.max(...curve.map(p => p.hp), 1);
    const maxRpm = curve[curve.length - 1].rpm;

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = (h - 20) * (i / 4) + 10;
      ctx.beginPath();
      ctx.moveTo(30, y);
      ctx.lineTo(w - 10, y);
      ctx.stroke();
    }

    // Torque curve
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < curve.length; i++) {
      const x = 30 + (curve[i].rpm / maxRpm) * (w - 40);
      const y = h - 15 - (curve[i].torque / maxTorque) * (h - 25);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // HP curve
    ctx.strokeStyle = '#ffaa00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < curve.length; i++) {
      const x = 30 + (curve[i].rpm / maxRpm) * (w - 40);
      const y = h - 15 - (curve[i].hp / maxHp) * (h - 25);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Current RPM marker
    const rx = 30 + (currentRpm / maxRpm) * (w - 40);
    ctx.strokeStyle = '#ff3366';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(rx, 10);
    ctx.lineTo(rx, h - 10);
    ctx.stroke();
    ctx.setLineDash([]);

    // Legend
    ctx.font = '9px JetBrains Mono';
    ctx.fillStyle = '#00e5ff';
    ctx.fillText('扭矩 Nm', 35, 18);
    ctx.fillStyle = '#ffaa00';
    ctx.fillText('马力 HP', 100, 18);
  }
}

export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return '--:--.---';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toFixed(3).padStart(6, '0')}`;
}

export function formatSpeed(ms: number): string {
  return Math.round(ms * 3.6).toString();
}
