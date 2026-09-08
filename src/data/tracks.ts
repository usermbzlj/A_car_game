import { TrackData } from '../types';

function oval(cx: number, cy: number, rx: number, ry: number, segments: number): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
  }
  return pts;
}

function figure8(cx: number, cy: number, size: number, segments: number): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const scale = 1 / (1 + Math.sin(t) ** 2 * 0.3);
    pts.push({
      x: cx + Math.sin(t) * size * scale,
      y: cy + Math.sin(t) * Math.cos(t) * size * 1.4 * scale,
    });
  }
  return pts;
}

function complexCircuit(): { x: number; y: number }[] {
  return [
    { x: 200, y: 600 }, { x: 400, y: 580 }, { x: 700, y: 520 },
    { x: 950, y: 450 }, { x: 1100, y: 350 }, { x: 1150, y: 200 },
    { x: 1100, y: 80 }, { x: 950, y: 30 }, { x: 750, y: 50 },
    { x: 550, y: 120 }, { x: 400, y: 200 }, { x: 300, y: 280 },
    { x: 200, y: 350 }, { x: 150, y: 450 }, { x: 180, y: 550 },
  ];
}

export const TRACKS: TrackData[] = [
  {
    name: 'APEX 环道',
    points: oval(600, 400, 450, 280, 48),
    width: 90,
    startAngle: 0,
    checkpoints: [0, 12, 24, 36],
    lapCount: 3,
  },
  {
    name: '双环交叉赛道',
    points: figure8(600, 400, 380, 56),
    width: 80,
    startAngle: -Math.PI / 2,
    checkpoints: [0, 14, 28, 42],
    lapCount: 3,
  },
  {
    name: '山脊大奖赛',
    points: complexCircuit(),
    width: 85,
    startAngle: 0,
    checkpoints: [0, 4, 8, 12],
    lapCount: 3,
  },
];

export function getTrackLength(track: TrackData): number {
  let len = 0;
  for (let i = 0; i < track.points.length; i++) {
    const a = track.points[i];
    const b = track.points[(i + 1) % track.points.length];
    len += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return len;
}

export function getPointOnTrack(track: TrackData, progress: number): { x: number; y: number; angle: number } {
  const total = getTrackLength(track);
  let dist = (progress % 1) * total;
  for (let i = 0; i < track.points.length; i++) {
    const a = track.points[i];
    const b = track.points[(i + 1) % track.points.length];
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    if (dist <= segLen) {
      const t = dist / segLen;
      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        angle: Math.atan2(b.y - a.y, b.x - a.x),
      };
    }
    dist -= segLen;
  }
  const a = track.points[0];
  const b = track.points[1];
  return { x: a.x, y: a.y, angle: Math.atan2(b.y - a.y, b.x - a.x) };
}
