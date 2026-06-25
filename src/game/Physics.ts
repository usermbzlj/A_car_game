import { CarState, TuningParams, TrackData } from '../types';
import { EngineModel, rpmToSpeed, speedToRpm } from '../tuning/EngineModel';

const MASS = 1280;
const WHEELBASE = 2.6;
const MAX_STEER = 0.55;
const DRAG = 0.35;
const ROLL_RES = 12;

export class CarPhysics {
  engine = new EngineModel();

  update(
    car: CarState,
    tuning: TuningParams,
    throttle: number,
    brake: number,
    steer: number,
    handbrake: boolean,
    dt: number,
  ): void {
    const maxRpm = tuning.ecuRevLimit;
    const revLimit = maxRpm;

    if (car.gear === 0) {
      car.rpm = Math.min(revLimit, car.rpm + (throttle * 3000 - car.rpm * 0.5) * dt);
    } else {
      const wheelRpm = speedToRpm(Math.max(0, car.speed), car.gear, tuning);
      car.rpm = Math.max(800, wheelRpm);
      if (throttle > 0.1 && car.rpm < wheelRpm + 500) {
        car.rpm += throttle * 2000 * dt;
      }
    }

    car.rpm = Math.min(revLimit, Math.max(800, car.rpm));
    car.throttle = throttle;
    car.brake = brake;
    car.steer = steer;

    const torque = this.engine.torqueAtRpm(car.rpm, tuning);
    const ecuThrottle = throttle * (0.5 + (tuning.ecuAggression / 100) * 0.5);
    let driveForce = 0;

    if (car.gear > 0 && throttle > 0) {
      const ratio = tuning.gearRatios[car.gear - 1] * tuning.finalDrive;
      driveForce = (torque * ecuThrottle * ratio) / 0.33;
    }

    const brakeForce = brake * 12000 * (tuning.brakeBalance / 100 + 0.3);
    const handbrakeForce = handbrake ? 8000 : 0;

    const gripBase = 1.0 + (tuning.suspensionStiffness / 100) * 0.3;
    const heightPenalty = Math.abs(tuning.suspensionHeight) * 0.005;
    const grip = gripBase - heightPenalty;

    const speedMs = car.speed;
    const dragForce = DRAG * speedMs * speedMs + ROLL_RES;
    let totalForce = driveForce - dragForce - brakeForce - handbrakeForce;

    if (speedMs < 0.5 && brake > 0) totalForce = -speedMs * MASS / dt;

    const accel = totalForce / MASS;
    car.speed = Math.max(0, car.speed + accel * dt);

    const maxSpeed = rpmToSpeed(revLimit, car.gear || 1, tuning);
    car.speed = Math.min(car.speed, maxSpeed * 1.05);

    const steerAngle = steer * MAX_STEER * (1 - Math.min(speedMs / 60, 0.7));
    const turnRate = (speedMs / WHEELBASE) * Math.tan(steerAngle);

    const diffFactor = 1 + (tuning.diffLock / 100) * 0.15;
    const yawRate = turnRate * grip * diffFactor;

    if (handbrake && speedMs > 2) {
      car.drift = Math.min(1, car.drift + dt * 3);
      car.angle += yawRate * dt * 1.8;
    } else {
      car.drift = Math.max(0, car.drift - dt * 2);
      car.angle += yawRate * dt;
    }

    car.vx = Math.cos(car.angle) * car.speed;
    car.vy = Math.sin(car.angle) * car.speed;
    car.x += car.vx * dt;
    car.y += car.vy * dt;
  }

  shiftUp(car: CarState, tuning: TuningParams): void {
    if (car.gear < tuning.gearRatios.length) {
      car.gear++;
      car.rpm = speedToRpm(car.speed, car.gear, tuning);
    }
  }

  shiftDown(car: CarState, tuning: TuningParams): void {
    if (car.gear > 1) {
      car.gear--;
      car.rpm = speedToRpm(Math.max(0.1, car.speed), car.gear, tuning);
    }
  }

  autoShift(car: CarState, tuning: TuningParams): void {
    if (car.gear === 0) return;
    const rpm = car.rpm;
    if (rpm > tuning.ecuRevLimit * 0.92 && car.gear < tuning.gearRatios.length) {
      this.shiftUp(car, tuning);
    }
  }
}

export function distToTrackCenter(track: TrackData, x: number, y: number): { dist: number; segment: number; t: number } {
  let minDist = Infinity;
  let bestSeg = 0;
  let bestT = 0;

  for (let i = 0; i < track.points.length; i++) {
    const a = track.points[i];
    const b = track.points[(i + 1) % track.points.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / len2));
    const px = a.x + dx * t;
    const py = a.y + dy * t;
    const d = Math.hypot(x - px, y - py);
    if (d < minDist) {
      minDist = d;
      bestSeg = i;
      bestT = t;
    }
  }

  return { dist: minDist, segment: bestSeg, t: bestT };
}

export function isOnTrack(track: TrackData, x: number, y: number): boolean {
  const { dist } = distToTrackCenter(track, x, y);
  return dist < track.width / 2;
}

export function getTrackProgress(track: TrackData, x: number, y: number): number {
  const { segment, t } = distToTrackCenter(track, x, y);
  let dist = 0;
  for (let i = 0; i < segment; i++) {
    const a = track.points[i];
    const b = track.points[(i + 1) % track.points.length];
    dist += Math.hypot(b.x - a.x, b.y - a.y);
  }
  const a = track.points[segment];
  const b = track.points[(segment + 1) % track.points.length];
  dist += Math.hypot(b.x - a.x, b.y - a.y) * t;
  return dist / getTrackLength(track);
}

function getTrackLength(track: TrackData): number {
  let len = 0;
  for (let i = 0; i < track.points.length; i++) {
    const a = track.points[i];
    const b = track.points[(i + 1) % track.points.length];
    len += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return len;
}

export function resetCheckpointTracking(): void {
  // Per-car progress tracked via car.lastProgress
}

export function checkCheckpoint(track: TrackData, car: CarState): boolean {
  const progress = getTrackProgress(track, car.x, car.y);
  const cpCount = track.checkpoints.length;
  const cpProgress = track.checkpoints.map(cp => cp / track.points.length);

  if (car.lastProgress > 0.85 && progress < 0.15 && car.checkpoint >= cpCount - 1) {
    car.lastLap = car.lapTime;
    if (car.lapTime < car.bestLap) car.bestLap = car.lapTime;
    car.lapTime = 0;
    car.lap++;
    car.checkpoint = 0;
    car.lastProgress = progress;
    return true;
  }

  const nextCpIdx = car.checkpoint % cpCount;
  const nextCpProgress = cpProgress[nextCpIdx];
  const prevCpProgress = nextCpIdx === 0 ? 0 : cpProgress[nextCpIdx - 1];

  if (progress >= nextCpProgress && progress > prevCpProgress + 0.01 && car.lastProgress < progress) {
    car.checkpoint++;
  }

  car.lastProgress = progress;
  return false;
}

export function applyOffTrackPenalty(car: CarState, onTrack: boolean, dt: number): void {
  car.offTrack = !onTrack;
  if (!onTrack) {
    car.speed *= 1 - dt * 1.5;
    car.speed = Math.max(0, car.speed - dt * 5);
  }
}
