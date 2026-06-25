import { TuningParams, EngineState } from '../types';

const PEAK_TORQUE_RPM = 5500;
const IDLE_RPM = 800;

export interface TorquePoint {
  rpm: number;
  torque: number;
  hp: number;
}

export class EngineModel {
  basePeakTorque = 420; // Nm
  basePeakHp = 350;

  computeTorqueCurve(tuning: TuningParams): TorquePoint[] {
    const points: TorquePoint[] = [];
    const revLimit = tuning.ecuRevLimit;

    for (let rpm = 1000; rpm <= revLimit; rpm += 200) {
      const t = this.torqueAtRpm(rpm, tuning);
      points.push({ rpm, torque: t, hp: (t * rpm) / 9549 });
    }
    return points;
  }

  torqueAtRpm(rpm: number, tuning: TuningParams): number {
    const rpmNorm = rpm / PEAK_TORQUE_RPM;
    const baseCurve = Math.sin(Math.min(rpmNorm, 1) * Math.PI * 0.5) *
      Math.exp(-Math.max(0, rpmNorm - 1) * 2.5);

    const fuelFactor = tuning.fuelInjection / 100;
    const afrOptimal = 12.5;
    const afrDev = Math.abs(tuning.airFuelRatio - afrOptimal);
    const afrFactor = Math.max(0.5, 1 - afrDev * 0.08);

    const ignOptimal = 10;
    const ignDev = Math.abs(tuning.ignitionTiming - ignOptimal);
    const ignFactor = Math.max(0.6, 1 - ignDev * 0.04);

    const turboFactor = 1 + (tuning.turboBoost - 0.8) * 0.35;
    const ecuFactor = 0.85 + (tuning.ecuAggression / 100) * 0.25;

    let torque = this.basePeakTorque * baseCurve * fuelFactor * afrFactor * ignFactor * turboFactor * ecuFactor;

    if (rpm < IDLE_RPM) torque *= rpm / IDLE_RPM;
    if (rpm > tuning.ecuRevLimit * 0.95) {
      torque *= Math.max(0, 1 - (rpm - tuning.ecuRevLimit * 0.95) / (tuning.ecuRevLimit * 0.05));
    }

    return Math.max(0, torque);
  }

  update(
    engine: EngineState,
    tuning: TuningParams,
    rpm: number,
    throttle: number,
    dt: number,
  ): void {
    engine.rpm = rpm;
    engine.torque = this.torqueAtRpm(rpm, tuning) * throttle;
    engine.horsepower = (engine.torque * rpm) / 9549;

    const loadFactor = throttle * (rpm / tuning.ecuRevLimit);
    engine.turboPressure = tuning.turboBoost * loadFactor * (0.3 + 0.7 * Math.min(rpm / 4000, 1));

    engine.afr = tuning.airFuelRatio + (1 - throttle) * 2.2;

    const targetCoolant = 75 + loadFactor * 45 - (tuning.radiatorFlow / 100) * 25;
    engine.coolantTemp += (targetCoolant - engine.coolantTemp) * dt * 0.5;

    const targetOil = 80 + loadFactor * 50 - (tuning.oilCooler / 100) * 20;
    engine.oilTemp += (targetOil - engine.oilTemp) * dt * 0.4;

    const overTemp = Math.max(0, engine.coolantTemp - 115) + Math.max(0, engine.oilTemp - 130);
    engine.knock = Math.min(100, overTemp * 2 + Math.max(0, tuning.ignitionTiming - 12) * 5);

    const afrStress = Math.abs(tuning.airFuelRatio - 12.5) > 2 ? 0.3 : 0;
    const knockStress = engine.knock / 100;
    const tempStress = overTemp * 0.05;
    engine.durability = Math.max(0, engine.durability - (afrStress + knockStress + tempStress) * dt * 0.02);

    if (engine.durability < 50) {
      engine.torque *= 0.7 + engine.durability / 100 * 0.3;
    }
  }

  getMaxHp(tuning: TuningParams): number {
    const curve = this.computeTorqueCurve(tuning);
    return Math.max(...curve.map(p => p.hp));
  }

  getMaxTorque(tuning: TuningParams): number {
    const curve = this.computeTorqueCurve(tuning);
    return Math.max(...curve.map(p => p.torque));
  }
}

export function rpmToSpeed(rpm: number, gear: number, tuning: TuningParams, wheelRadius = 0.33): number {
  const ratio = tuning.gearRatios[gear - 1] * tuning.finalDrive;
  return (rpm * 2 * Math.PI * wheelRadius) / (ratio * 60);
}

export function speedToRpm(speed: number, gear: number, tuning: TuningParams, wheelRadius = 0.33): number {
  const ratio = tuning.gearRatios[gear - 1] * tuning.finalDrive;
  return (speed * ratio * 60) / (2 * Math.PI * wheelRadius);
}
