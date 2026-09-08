export type GameMode = 'menu' | 'practice' | 'time_trial' | 'championship' | 'free_tuning';

export interface TuningParams {
  fuelInjection: number;    // 0-100 喷油量 %
  ignitionTiming: number; // -10 to +15 度 BTDC
  turboBoost: number;       // 0-2.5 bar
  airFuelRatio: number;     // 10-16 AFR
  gearRatios: number[];     // 6 gears
  finalDrive: number;       // 2.5-4.5
  suspensionStiffness: number; // 0-100
  suspensionHeight: number;    // -30 to +30 mm
  diffLock: number;         // 0-100 % LSD lock
  brakeBalance: number;     // 40-70 % front
  ecuAggression: number;    // 0-100 throttle map aggression
  ecuRevLimit: number;      // 6000-9000 RPM
  radiatorFlow: number;     // 0-100 cooling %
  oilCooler: number;        // 0-100
}

export const DEFAULT_TUNING: TuningParams = {
  fuelInjection: 85,
  ignitionTiming: 8,
  turboBoost: 1.2,
  airFuelRatio: 12.5,
  gearRatios: [3.2, 2.1, 1.6, 1.25, 1.0, 0.85],
  finalDrive: 3.6,
  suspensionStiffness: 65,
  suspensionHeight: 0,
  diffLock: 45,
  brakeBalance: 58,
  ecuAggression: 70,
  ecuRevLimit: 7800,
  radiatorFlow: 70,
  oilCooler: 60,
};

export interface EngineState {
  rpm: number;
  torque: number;
  horsepower: number;
  oilTemp: number;
  coolantTemp: number;
  turboPressure: number;
  durability: number;
  knock: number;
  afr: number;
}

export interface CarState {
  x: number;
  y: number;
  angle: number;
  speed: number;
  vx: number;
  vy: number;
  gear: number;
  rpm: number;
  throttle: number;
  brake: number;
  steer: number;
  drift: number;
  lap: number;
  lapTime: number;
  bestLap: number;
  lastLap: number;
  checkpoint: number;
  lastProgress: number;
  finished: boolean;
  offTrack: boolean;
}

export interface TrackPoint {
  x: number;
  y: number;
}

export interface TrackData {
  name: string;
  points: TrackPoint[];
  width: number;
  startAngle: number;
  checkpoints: number[];
  lapCount: number;
}

export interface AIEntry {
  name: string;
  skill: number;
  tuning: TuningParams;
  state: CarState;
  color: string;
}

export interface ChampionshipRound {
  trackIndex: number;
  completed: boolean;
  playerPosition: number;
  playerTime: number;
}

export interface GameState {
  mode: GameMode;
  paused: boolean;
  tuningOpen: boolean;
  countdown: number;
  raceStarted: boolean;
  raceFinished: boolean;
  currentTrack: number;
  tuning: TuningParams;
  engine: EngineState;
  player: CarState;
  ai: AIEntry[];
  championship: {
    round: number;
    points: number;
    standings: { name: string; points: number }[];
    rounds: ChampionshipRound[];
  };
  timeTrialBest: number;
  sessionBest: number;
}

export function createInitialCarState(sx: number, sy: number, angle: number): CarState {
  return {
    x: sx, y: sy, angle, speed: 0, vx: 0, vy: 0,
    gear: 1, rpm: 800, throttle: 0, brake: 0, steer: 0, drift: 0,
    lap: 0, lapTime: 0, bestLap: Infinity, lastLap: 0,
    checkpoint: 0, lastProgress: 0, finished: false, offTrack: false,
  };
}

export function createInitialEngineState(): EngineState {
  return {
    rpm: 800, torque: 0, horsepower: 0,
    oilTemp: 85, coolantTemp: 82,
    turboPressure: 0, durability: 100, knock: 0, afr: 14.7,
  };
}
