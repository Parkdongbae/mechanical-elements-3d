// 학습용 단순 주행 모델 — 엔진 토크(단순화한 곡선) × 기어비 → 구동력, 주행 저항 → 가속.
// 수동: 마찰 클러치(미끄럼/붙음 두 상태). 자동: 유체 토크 컨버터 + 속도·가속 페달 기준 자동 변속.
// 실제 차의 성능을 재현하려는 것이 아니라 "기어비에 따라 rpm·속도·힘이 어떻게 바뀌는지"를 안정적으로 보여 주는 것이 목적이다.

import { SPEC, gearRatio, rpmFromSpeed, type ForwardGear, type GearId } from './spec';

export type DriveMode = 'manual' | 'auto';
export type Selector = 'P' | 'R' | 'N' | 'D';

const TAU = Math.PI * 2;
const RPM = 60 / TAU; // rad/s → rpm
const MASS = 1250; // kg (사람 포함 가정)
const TYRE_R = SPEC.tyreCirc / TAU; // m
const ETA = 0.9; // 변속기·종감속 전달 효율(가정)
const ROLL = 0.012 * MASS * 9.81; // 구름 저항 N
const AERO = 0.39; // ½ρCdA (N·s²/m²)
const I_ENG = 0.25; // 엔진+플라이휠 관성 kg·m²
const CLUTCH_MAX = 220; // 클러치 최대 전달 토크 N·m
const BRAKE_MAX = 9000; // N
const STALL_RPM = 450;
const TC_CAP = 40; // 토크 컨버터 용량 계수 N·m/(1000rpm)²

/** 단순화한 최대 토크 곡선 (rpm, N·m) */
const TORQUE_PTS: [number, number][] = [
  [0, 0], [600, 72], [1000, 100], [2000, 122], [3000, 133], [4000, 140], [5000, 137], [6000, 124], [6500, 112]
];

export function maxTorque(rpm: number): number {
  if (rpm <= 0) return 0;
  for (let i = 1; i < TORQUE_PTS.length; i++) {
    const [r1, t1] = TORQUE_PTS[i]!;
    const [r0, t0] = TORQUE_PTS[i - 1]!;
    if (rpm <= r1) return t0 + ((t1 - t0) * (rpm - r0)) / (r1 - r0);
  }
  return TORQUE_PTS[TORQUE_PTS.length - 1]![1];
}

const friction = (rpm: number): number => 8 + 0.0035 * Math.max(0, rpm);
const clamp = (x: number, a: number, b: number): number => Math.min(b, Math.max(a, x));

export type Warning = 'stall' | 'redline' | 'lug' | null;

export interface SimEvent {
  kind: 'stall' | 'shift' | 'info';
  text: string;
}

export class CarSim {
  mode: DriveMode = 'manual';
  // 입력
  throttleHeld = false;
  brakeHeld = false;
  clutchHeld = false;
  /** 클러치 페달을 손으로 끌어 직접 정한 위치(끄는 중이 아니면 null) */
  clutchDirect: number | null = null;
  // 페달 실제 위치 0~1 (누르는 깊이)
  throttle = 0;
  brake = 0;
  clutch = 0;
  // 상태
  v = 0; // m/s, 앞(+) 뒤(-)
  wEng = (SPEC.idleRpm / RPM);
  engineOn = true;
  gear: GearId = 'N';
  selector: Selector = 'P';
  locked = false;
  /** 변속기 입력축 각속도(rad/s): 중립일 때 시각화용 */
  wInput = 0;
  private shiftCool = 0;
  private fastRelease = false;
  private fastTimer = 0;
  shiftBlend = 0; // 자동 변속 직후 토크가 잠깐 줄어드는 시간
  private redTime = 0;
  events: SimEvent[] = [];

  reset(mode: DriveMode): void {
    this.mode = mode;
    this.throttleHeld = this.brakeHeld = this.clutchHeld = false;
    this.throttle = this.brake = this.clutch = 0;
    this.clutchDirect = null;
    this.v = 0;
    this.wEng = SPEC.idleRpm / RPM;
    this.engineOn = true;
    this.gear = 'N';
    this.selector = 'P';
    this.locked = false;
    this.wInput = 0;
    this.shiftCool = 0;
    this.shiftBlend = 0;
    this.redTime = 0;
    this.fastRelease = false;
    this.fastTimer = 0;
    this.events = [];
  }

  get kmh(): number {
    return this.v * 3.6;
  }
  get engineRpm(): number {
    return this.wEng * RPM;
  }
  /** 바퀴(구동축) 회전수 rpm, 앞으로 갈 때 + */
  get wheelRpm(): number {
    return (this.v / SPEC.tyreCirc) * 60;
  }
  /** 변속기 출력축 rpm = 바퀴 rpm × 종감속비 */
  get outputRpm(): number {
    return this.wheelRpm * SPEC.finalDrive;
  }
  /** 변속기 입력축 rpm(수동: 클러치 뒤, 자동: 터빈) */
  get inputRpm(): number {
    return this.wInput * RPM;
  }
  /** 후진 포함 부호 있는 기어비 */
  private signedRatio(g: GearId): number {
    return g === 'R' ? -gearRatio('R') : gearRatio(g);
  }
  /** 바퀴 속도로부터 정해지는 변속기 입력축 각속도 */
  private wGearbox(g: GearId): number {
    return (this.v / TYRE_R) * this.signedRatio(g) * SPEC.finalDrive;
  }
  /** 클러치 연결 정도 0(끊김)~1(완전 연결) */
  get engagement(): number {
    return clamp((0.78 - this.clutch) / 0.78, 0, 1);
  }

  /** 수동: 레버로 단을 고른다. 성공하면 null, 실패하면 이유 문장 */
  selectGear(g: GearId): string | null {
    if (this.mode !== 'manual' || g === this.gear) return null;
    if (this.clutch < 0.7) return '클러치 페달을 끝까지 밟아야 기어를 바꿀 수 있어요.';
    if (g === 'R' && Math.abs(this.kmh) > 1) return '후진(R)은 차가 완전히 멈춘 뒤에 넣어요.';
    if (g !== 'N' && g !== 'R' && this.kmh < -1) return '뒤로 움직이는 중에는 전진 기어를 넣지 않아요. 먼저 멈추세요.';
    if (g !== 'N' && g !== 'R') {
      const rpm = rpmFromSpeed(this.kmh, gearRatio(g));
      if (rpm > SPEC.maxRpm) {
        return `지금 속도(${Math.round(this.kmh)} km/h)에서 ${g}단은 엔진이 ${Math.round(rpm).toLocaleString()} rpm까지 올라가 위험해요.`;
      }
    }
    this.gear = g;
    this.locked = false;
    return null;
  }

  /** 자동: P·R·N·D 선택 */
  setSelector(s: Selector): string | null {
    if (this.mode !== 'auto' || s === this.selector) return null;
    if ((s === 'P' || s === 'R') && Math.abs(this.kmh) > 1.5) return `${s}는 차가 멈춘 뒤에 넣어요. 먼저 브레이크로 세우세요.`;
    if (s === 'D' && this.kmh < -1.5) return '뒤로 움직이는 중이에요. 먼저 멈춘 뒤 D로 바꾸세요.';
    this.selector = s;
    if (s === 'D') this.gear = 1;
    else if (s === 'R') this.gear = 'R';
    else this.gear = 'N';
    this.shiftCool = 0.6;
    return null;
  }

  startEngine(): string | null {
    if (this.engineOn) return null;
    if (this.mode === 'manual' && this.gear !== 'N' && this.clutch < 0.7) return '클러치를 밟거나 중립(N)에서 시동을 걸어요.';
    this.engineOn = true;
    this.wEng = Math.max(this.wEng, SPEC.idleRpm / RPM);
    this.locked = false;
    return null;
  }

  step(dt: number): void {
    // 페달 움직임(밟는 속도·떼는 속도)
    this.throttle = this.throttleHeld ? Math.min(1, this.throttle + dt * 0.9) : Math.max(0, this.throttle - dt * 3);
    this.brake = this.brakeHeld ? Math.min(1, this.brake + dt * 2.5) : Math.max(0, this.brake - dt * 5);
    const prevClutch = this.clutch;
    this.clutch = this.nextClutch(dt);
    // 물리는 구간을 빠르게(초당 2 이상) 지나가면 '급히 뗌'으로 본다 — 완전히 붙은 뒤 1초가 지나면 잊는다
    if (this.clutchDirect !== null && this.clutch < 0.8 && this.clutch > 0 && (prevClutch - this.clutch) / dt > 2) this.fastRelease = true;
    if (this.clutch > 0.8) this.fastRelease = false;
    if (this.clutch === 0 && this.locked) this.fastTimer += dt;
    else this.fastTimer = 0;
    if (this.fastTimer > 1) this.fastRelease = false;
    this.shiftCool = Math.max(0, this.shiftCool - dt);
    this.shiftBlend = Math.max(0, this.shiftBlend - dt);

    const n = Math.max(1, Math.round(dt / (1 / 480)));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      if (this.mode === 'manual') this.stepManual(h);
      else this.stepAuto(h);
    }
    if (this.mode === 'auto' && this.selector === 'D') this.autoShift();

    if (this.engineRpm > 6000) this.redTime += dt;
    else this.redTime = 0;
  }

  /**
   * 클러치 페달 위치. 손으로 끌면(clutchDirect) 그 위치 그대로 — 급히 떼면 시동이 꺼질 수 있다.
   * 그냥 놓으면 "천천히 떼는 발"을 흉내 낸다: 물리기 시작하는 구간(반클러치)은 느리게,
   * 1단·후진 출발 때는 엔진 회전이 떨어지면 잠시 멈춰 기다린다.
   */
  private nextClutch(dt: number): number {
    if (this.clutchDirect !== null) return this.clutchDirect;
    const c = this.clutch;
    if (this.clutchHeld) return Math.min(1, c + dt * 6);
    if (c <= 0) return 0;
    const careful = (this.gear === 1 || this.gear === 'R') && !this.locked && this.engineOn;
    if (careful && c < 0.8 && this.engineRpm < 700) return c;
    const rate = c > 0.8 ? 3 : c > 0.15 ? 0.55 : 2;
    return Math.max(0, c - dt * rate);
  }

  /** 엔진이 스스로 내는 토크(공회전 유지 제어 포함) − 내부 마찰 */
  private engineTorque(): number {
    const rpm = this.engineRpm;
    if (!this.engineOn) return -friction(rpm) * (rpm > 1 ? 1 : 0);
    const idle = clamp(0.115 + (SPEC.idleRpm - rpm) * 0.006, 0, 0.95);
    let thr = Math.max(this.throttle, idle);
    if (rpm > SPEC.maxRpm) thr = 0; // 회전 제한(연료 차단)
    return thr * maxTorque(rpm) - friction(rpm);
  }

  private resist(): number {
    return ROLL * Math.tanh(this.v / 0.3) + AERO * this.v * Math.abs(this.v);
  }

  /** 구동력 F를 받아 속도를 갱신 — 정지 상태에서 브레이크·구름저항보다 힘이 작으면 그대로 멈춰 있다 */
  private applyForce(F: number, h: number, mTot: number, park = false): void {
    const hold = park ? Infinity : this.brake * BRAKE_MAX + ROLL;
    if (Math.abs(this.v) < 0.05) {
      if (Math.abs(F) <= hold) {
        this.v = 0;
        return;
      }
      this.v += ((F - Math.sign(F) * hold) / mTot) * h;
      return;
    }
    const brakeF = this.brake * BRAKE_MAX * Math.sign(this.v);
    const nv = this.v + ((F - this.resist() - brakeF) / mTot) * h;
    // 브레이크가 차를 반대로 밀지는 않는다
    this.v = Math.sign(nv) !== Math.sign(this.v) && Math.abs(F) <= hold ? 0 : nv;
  }

  private stallReason(g: GearId): string {
    const name = g === 'R' ? '후진(R)' : `${String(g)}단`;
    if (this.fastRelease) return '클러치를 너무 급히 떼서 시동이 꺼졌어요. 클러치는 천천히 떼요.';
    if (Math.abs(this.kmh) < 4) {
      if (this.locked) return '차가 멈추는데 클러치를 밟지 않아 시동이 꺼졌어요. 멈출 때는 클러치를 밟아요.';
      if (g === 1 || g === 'R') return '엔진 힘이 모자라 시동이 꺼졌어요. 가속 페달을 살짝 밟으며 클러치를 떼 보세요.';
      return `${name}으로 출발하기에는 힘이 모자라 시동이 꺼졌어요. 출발은 1단으로!`;
    }
    return `속도에 비해 ${name}이 너무 높아 엔진 회전이 떨어져 시동이 꺼졌어요. 단을 내려요.`;
  }

  private stall(reason: string): void {
    if (!this.engineOn) return;
    this.engineOn = false;
    this.events.push({ kind: 'stall', text: reason });
  }

  private stepManual(h: number): void {
    const g = this.gear;
    const inGear = g !== 'N';
    const e = this.engagement;
    const tcap = CLUTCH_MAX * e * e;
    const tEng = this.engineTorque();
    const G = inGear ? this.signedRatio(g) * SPEC.finalDrive : 0; // 엔진 1rad당 바퀴 회전 비의 역수
    if (!inGear) {
      this.locked = false;
      this.wEng = Math.max(0, this.wEng + (tEng / I_ENG) * h);
      // 중립: 입력축은 클러치가 붙어 있으면 엔진을 따라가고, 끊기면 서서히 멈춘다
      this.wInput = e > 0.5 ? this.wEng : this.wInput * Math.exp(-h * 0.8);
      this.applyForce(0, h, MASS);
    } else if (this.locked) {
      // 붙음: 엔진·변속기·바퀴가 한 몸
      const k = G / TYRE_R; // v → 엔진 각속도 비
      const mTot = MASS + I_ENG * k * k;
      const F = (tEng * G * ETA) / TYRE_R;
      this.applyForce(F, h, mTot);
      this.wEng = this.wGearbox(g);
      this.wInput = this.wEng;
      // 실제 클러치가 전달하는 토크가 한계를 넘으면 미끄럼으로
      const aEng = (k * ((F - this.resist()) / mTot));
      const tCl = tEng - I_ENG * aEng;
      if (Math.abs(tCl) > tcap + 1 || e < 0.05) this.locked = false;
      if (this.engineOn && this.engineRpm < STALL_RPM) {
        this.stall(this.stallReason(g));
      }
    } else {
      // 미끄럼: 클러치 판이 미끄러지며 토크를 전달
      const wG = this.wGearbox(g);
      const slip = this.wEng - wG;
      const tCl = clamp(slip * 60, -tcap, tcap);
      const wE1 = Math.max(0, this.wEng + ((tEng - tCl) / I_ENG) * h);
      this.applyForce((tCl * G * ETA) / TYRE_R, h, MASS);
      const wG1 = this.wGearbox(g);
      this.wEng = wE1;
      this.wInput = wG1;
      const slip1 = wE1 - wG1;
      if (e > 0.05 && (Math.sign(slip1) !== Math.sign(slip) || Math.abs(slip1) < 1.5)) {
        this.locked = true;
        this.wEng = wG1;
      }
      if (this.engineOn && this.engineRpm < STALL_RPM && e > 0.2) {
        this.stall(this.stallReason(g));
      }
    }
  }

  private stepAuto(h: number): void {
    const s = this.selector;
    const tEng = this.engineTorque();
    if (s === 'P' || s === 'N') {
      this.wEng = Math.max(0, this.wEng + (tEng / I_ENG) * h);
      this.wInput = this.wEng;
      this.applyForce(0, h, MASS, s === 'P');
      return;
    }
    const g = this.gear;
    const G = this.signedRatio(g) * SPEC.finalDrive;
    const wT = this.wGearbox(g);
    const nE = this.engineRpm;
    const nT = wT * RPM;
    // 토크 컨버터: 펌프(엔진 쪽)와 터빈(변속기 쪽)의 회전 차이만큼 유체가 토크를 전달한다
    const sr = nE > 50 ? nT / nE : 1;
    const phi = clamp((1 - sr) / 0.12, -1, 1);
    const tPump = TC_CAP * (nE / 1000) ** 2 * phi;
    const tr = tPump > 0 && sr < 0.85 ? 1 + (1 - sr / 0.85) : 1;
    const cut = this.shiftBlend > 0 ? 0.45 : 1;
    this.wEng = Math.max(0, this.wEng + ((tEng - tPump) / I_ENG) * h);
    this.applyForce((tPump * tr * cut * G * ETA) / TYRE_R, h, MASS);
    this.wInput = this.wGearbox(g);
  }

  /** D 레인지 변속 선도: 터빈 rpm이 가속 페달 깊이에 따른 기준을 넘으면 올리고, 밑돌면 내린다 */
  private autoShift(): void {
    if (this.shiftCool > 0) return;
    const g = this.gear;
    if (g === 'N' || g === 'R') return;
    const thr = this.throttle;
    const up = 2000 + 3600 * thr;
    const down = 1000 + 1700 * thr;
    const nT = rpmFromSpeed(this.kmh, gearRatio(g));
    if (g < 5 && nT > up) {
      this.shiftTo((g + 1) as ForwardGear, '올림');
    } else if (g > 1) {
      const lower = (g - 1) as ForwardGear;
      const nLower = rpmFromSpeed(this.kmh, gearRatio(lower));
      if ((nT < down || this.kmh < 3) && nLower < 5600) this.shiftTo(lower, '내림');
    }
  }

  private shiftTo(g: ForwardGear, word: string): void {
    this.gear = g;
    this.shiftCool = 0.8;
    this.shiftBlend = 0.3;
    this.events.push({ kind: 'shift', text: `${g}단으로 ${word}` });
  }

  get warning(): Warning {
    if (!this.engineOn) return 'stall';
    if (this.engineRpm > 6000) return 'redline';
    if (this.mode === 'manual' && this.locked && typeof this.gear === 'number' && this.gear >= 2 && this.engineRpm < 1100 && this.throttle > 0.2) return 'lug';
    return null;
  }

  /** 지금 속도에 알맞은 단(2000~3000rpm 부근이 되는 가장 높은 단) */
  recommendedGear(): ForwardGear {
    const kmh = Math.max(0, this.kmh);
    let best: ForwardGear = 1;
    for (const g of [1, 2, 3, 4, 5] as ForwardGear[]) {
      if (rpmFromSpeed(kmh, gearRatio(g)) >= 1700) best = g;
    }
    return best;
  }

  get redlineTime(): number {
    return this.redTime;
  }
}
