export interface InputState {
  throttle: number;
  brake: number;
  steer: number;
  shiftUp: boolean;
  shiftDown: boolean;
  handbrake: boolean;
  pause: boolean;
  tuning: boolean;
  menu: boolean;
}

export class InputManager {
  keys: Record<string, boolean> = {};
  prevKeys: Record<string, boolean> = {};
  state: InputState = {
    throttle: 0, brake: 0, steer: 0,
    shiftUp: false, shiftDown: false, handbrake: false,
    pause: false, tuning: false, menu: false,
  };

  constructor() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
    window.addEventListener('blur', () => {
      this.keys = {};
    });
  }

  isDown(code: string): boolean {
    return !!this.keys[code];
  }

  justPressed(code: string): boolean {
    return !!this.keys[code] && !this.prevKeys[code];
  }

  update(): InputState {
    this.prevKeys = { ...this.keys };

    const up = this.isDown('ArrowUp') || this.isDown('KeyW');
    const down = this.isDown('ArrowDown') || this.isDown('KeyS');
    const left = this.isDown('ArrowLeft') || this.isDown('KeyA');
    const right = this.isDown('ArrowRight') || this.isDown('KeyD');

    this.state.throttle = up ? 1 : 0;
    this.state.brake = down ? 1 : 0;
    this.state.steer = (left ? -1 : 0) + (right ? 1 : 0);
    this.state.handbrake = this.isDown('Space');
    this.state.shiftUp = this.justPressed('KeyE');
    this.state.shiftDown = this.justPressed('KeyQ');
    this.state.pause = this.justPressed('Escape');
    this.state.tuning = this.justPressed('KeyT');
    this.state.menu = this.justPressed('KeyM');

    return this.state;
  }
}
