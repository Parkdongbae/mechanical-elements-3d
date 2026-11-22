// 풍절음 합성(Web Audio API) — 부품별 소리 성분을 귀로 구분할 수 있게 채널을 나눈다.
//   기본 바람: 핑크 노이즈 → 저역 통과(속도↑ → 컷오프↑)
//   미러·A필러·윙(mid): 핑크 노이즈 → 대역 통과(중고역의 거친 소리)
//   도어 틈새(whistle): 노이즈 → 좁은 대역 공명 필터 + 약한 사인파(휘파람, 속도에 따라 음높이 상승)
//   돌출 손잡이(hiss): 화이트 노이즈 → 고역 통과(쉿)
//   하부·휠(rumble): 브라운 노이즈 → 저역 통과(웅웅)
// 소리 크기는 aero.ts의 맛보기 dB를 진폭으로 바꿔 쓴다(6dB = 진폭 2배).

import type { SoundKind } from './aero';
import { whistleHz } from './aero';

type Levels = Record<SoundKind | 'base', number>;
const CHANNELS: (SoundKind | 'base')[] = ['base', 'mid', 'whistle', 'hiss', 'rumble'];
const TAU_S = 0.12; // 게인 램프 시간 상수

function noiseBuffer(ctx: AudioContext, kind: 'pink' | 'brown' | 'white', seconds = 4): AudioBuffer {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;
  let last = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === 'white') d[i] = w * 0.5;
    else if (kind === 'brown') {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.2;
    } else {
      // Paul Kellet의 핑크 노이즈 근사
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  }
  // 루프 이음매 딸깍 소리 방지: 끝을 짧게 페이드
  const f = Math.min(2000, n / 10);
  for (let i = 0; i < f; i++) {
    const k = i / f;
    d[i] = d[i]! * k;
    d[n - 1 - i] = d[n - 1 - i]! * k;
  }
  return buf;
}

/** dB(맛보기) → 진폭. 70dB ≈ 0.9 (큰 소리는 뒤의 컴프레서가 눌러 준다) */
const amp = (db: number): number => (db < -100 ? 0 : Math.min(2.5, 0.9 * 10 ** ((db - 70) / 20)));

export interface AudioDebug {
  /** 출력 파형의 RMS(실제로 소리가 나가는지) */
  rms: number;
  state: string;
  gains: Record<string, number>;
  freqs: Record<string, number>;
  master: number;
}

export class WindAudio {
  private ctx: AudioContext | null = null;
  private sources: AudioScheduledSourceNode[] = [];
  private gains = new Map<SoundKind | 'base', GainNode>();
  private targets: Record<string, number> = {};
  private baseLp: BiquadFilterNode | null = null;
  private midBp: BiquadFilterNode | null = null;
  private whBp: BiquadFilterNode | null = null;
  private whBp2: BiquadFilterNode | null = null;
  private whOsc: OscillatorNode | null = null;
  private whOscGain: GainNode | null = null;
  private hissHp: BiquadFilterNode | null = null;
  private rumLp: BiquadFilterNode | null = null;
  private master: GainNode | null = null;
  analyser: AnalyserNode | null = null;
  private volume = 0.7;
  private last: { levels: Levels; kmh: number } | null = null;

  get running(): boolean {
    return this.ctx?.state === 'running';
  }

  /** 사용자 동작(클릭) 안에서 호출해야 한다 */
  async start(): Promise<boolean> {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return false;
      this.ctx = new Ctor();
      this.build(this.ctx);
      if (this.last) this.set(this.last.levels, this.last.kmh, true);
    }
    try {
      await this.ctx.resume();
    } catch {
      return false;
    }
    return this.ctx.state === 'running';
  }

  private build(ctx: AudioContext): void {
    const pink = noiseBuffer(ctx, 'pink');
    const brown = noiseBuffer(ctx, 'brown');
    const white = noiseBuffer(ctx, 'white', 2);
    const src = (buf: AudioBuffer, rate = 1): AudioBufferSourceNode => {
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.loop = true;
      s.playbackRate.value = rate;
      this.sources.push(s);
      return s;
    };
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 6;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;
    comp.connect(this.master);
    this.master.connect(this.analyser);
    this.analyser.connect(ctx.destination);

    const g = (k: SoundKind | 'base'): GainNode => {
      const n = ctx.createGain();
      n.gain.value = 0;
      n.connect(comp);
      this.gains.set(k, n);
      return n;
    };
    // 기본 바람
    this.baseLp = ctx.createBiquadFilter();
    this.baseLp.type = 'lowpass';
    this.baseLp.Q.value = 0.5;
    src(pink).connect(this.baseLp).connect(g('base'));
    // 중고역 거친 바람(미러·필러)
    this.midBp = ctx.createBiquadFilter();
    this.midBp.type = 'bandpass';
    this.midBp.Q.value = 0.9;
    src(pink, 1.07).connect(this.midBp).connect(g('mid'));
    // 휘파람: 공명 필터 두 번(더 좁게) + 사인파
    const wg = g('whistle');
    this.whBp = ctx.createBiquadFilter();
    this.whBp.type = 'bandpass';
    this.whBp.Q.value = 28;
    this.whBp2 = ctx.createBiquadFilter();
    this.whBp2.type = 'bandpass';
    this.whBp2.Q.value = 28;
    const whBoost = ctx.createGain();
    whBoost.gain.value = 9;
    src(white, 0.93).connect(this.whBp).connect(this.whBp2).connect(whBoost).connect(wg);
    this.whOsc = ctx.createOscillator();
    this.whOsc.type = 'sine';
    this.whOscGain = ctx.createGain();
    this.whOscGain.gain.value = 0.16;
    // 음높이가 살짝 떨리는 휘파람(느린 LFO)
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 4.3;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 6;
    lfo.connect(lfoGain).connect(this.whOsc.frequency);
    this.whOsc.connect(this.whOscGain).connect(wg);
    this.sources.push(this.whOsc, lfo);
    // 쉿 소리
    this.hissHp = ctx.createBiquadFilter();
    this.hissHp.type = 'highpass';
    this.hissHp.Q.value = 0.7;
    src(white, 1.13).connect(this.hissHp).connect(g('hiss'));
    // 웅웅 저음
    this.rumLp = ctx.createBiquadFilter();
    this.rumLp.type = 'lowpass';
    this.rumLp.Q.value = 1.2;
    const rumBoost = ctx.createGain();
    rumBoost.gain.value = 1.6;
    src(brown).connect(this.rumLp).connect(rumBoost).connect(g('rumble'));
    for (const s of this.sources) s.start();
  }

  /** 채널 dB와 속도로 게인·필터를 부드럽게 바꾼다 */
  set(levels: Levels, kmh: number, immediate = false): void {
    this.last = { levels: { ...levels }, kmh };
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const ramp = (p: AudioParam, v: number): void => {
      if (immediate) p.setValueAtTime(v, now);
      else p.setTargetAtTime(v, now, TAU_S);
    };
    const on = kmh > 0.5;
    for (const k of CHANNELS) {
      const gn = this.gains.get(k);
      const target = on ? amp(levels[k]) : 0;
      this.targets[k] = target;
      if (gn) ramp(gn.gain, target);
    }
    const v = Math.max(kmh, 10);
    if (this.baseLp) ramp(this.baseLp.frequency, 150 + 4 * v);
    if (this.midBp) ramp(this.midBp.frequency, 800 + 6 * v);
    const wf = whistleHz(kmh);
    if (this.whBp) ramp(this.whBp.frequency, wf);
    if (this.whBp2) ramp(this.whBp2.frequency, wf);
    if (this.whOsc) ramp(this.whOsc.frequency, wf);
    if (this.hissHp) ramp(this.hissHp.frequency, 4500 + 10 * v);
    if (this.rumLp) ramp(this.rumLp.frequency, 80 + 0.6 * v);
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  async stop(): Promise<void> {
    if (this.ctx && this.ctx.state === 'running') await this.ctx.suspend();
  }

  debug(): AudioDebug {
    const gains: Record<string, number> = {};
    for (const [k, g] of this.gains) gains[k] = g.gain.value;
    let rms = 0;
    if (this.analyser) {
      const buf = new Float32Array(this.analyser.fftSize);
      this.analyser.getFloatTimeDomainData(buf);
      for (const s of buf) rms += s * s;
      rms = Math.sqrt(rms / buf.length);
    }
    return {
      rms,
      state: this.ctx?.state ?? 'none',
      gains,
      freqs: {
        base: this.baseLp?.frequency.value ?? 0,
        mid: this.midBp?.frequency.value ?? 0,
        whistle: this.whBp?.frequency.value ?? 0,
        hiss: this.hissHp?.frequency.value ?? 0,
        rumble: this.rumLp?.frequency.value ?? 0
      },
      master: this.master?.gain.value ?? 0
    };
  }

  /** 목표 게인(램프가 끝나기 전에도 확인 가능) */
  targetGains(): Record<string, number> {
    return { ...this.targets };
  }

  dispose(): void {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        /* 이미 멈춤 */
      }
      s.disconnect();
    }
    this.sources = [];
    this.gains.clear();
    this.analyser = null;
    const c = this.ctx;
    this.ctx = null;
    if (c) void c.close();
  }
}
