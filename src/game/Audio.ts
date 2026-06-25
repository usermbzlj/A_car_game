export class EngineAudio {
  ctx: AudioContext | null = null;
  masterGain: GainNode | null = null;
  osc: OscillatorNode | null = null;
  osc2: OscillatorNode | null = null;
  noiseGain: GainNode | null = null;
  filter: BiquadFilterNode | null = null;
  started = false;

  init(): void {
    if (this.started) return;
    try {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.25;
      this.masterGain.connect(this.ctx.destination);

      this.osc = this.ctx.createOscillator();
      this.osc.type = 'sawtooth';
      this.osc.frequency.value = 80;

      this.osc2 = this.ctx.createOscillator();
      this.osc2.type = 'square';
      this.osc2.frequency.value = 40;

      this.filter = this.ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.value = 800;
      this.filter.Q.value = 2;

      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

      const noise = this.ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      noise.loop = true;
      this.noiseGain = this.ctx.createGain();
      this.noiseGain.gain.value = 0.05;

      this.osc.connect(this.filter);
      this.osc2.connect(this.filter);
      noise.connect(this.noiseGain);
      this.noiseGain.connect(this.filter);
      this.filter.connect(this.masterGain);

      this.osc.start();
      this.osc2.start();
      noise.start();
      this.started = true;
    } catch {
      // Audio unavailable
    }
  }

  resume(): void {
    this.ctx?.resume();
  }

  update(rpm: number, throttle: number, speed: number): void {
    if (!this.started || !this.osc || !this.osc2 || !this.filter || !this.noiseGain || !this.masterGain) return;

    const baseFreq = 60 + (rpm / 8000) * 400;
    this.osc.frequency.setTargetAtTime(baseFreq, this.ctx!.currentTime, 0.05);
    this.osc2.frequency.setTargetAtTime(baseFreq * 0.5, this.ctx!.currentTime, 0.05);

    const filterFreq = 400 + (rpm / 8000) * 3000 + throttle * 1000;
    this.filter.frequency.setTargetAtTime(filterFreq, this.ctx!.currentTime, 0.05);

    this.noiseGain.gain.setTargetAtTime(0.03 + throttle * 0.12 + (rpm / 8000) * 0.05, this.ctx!.currentTime, 0.05);
    this.masterGain.gain.setTargetAtTime(0.15 + throttle * 0.15 + Math.min(speed / 80, 0.1), this.ctx!.currentTime, 0.1);
  }

  stop(): void {
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(0, this.ctx!.currentTime, 0.3);
    }
  }
}

export function playBeep(): void {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.value = 0.2;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // ignore
  }
}
