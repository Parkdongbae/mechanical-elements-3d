// 물레방아 운동·계산 — 순수 TS(three·DOM 없음). 길이 m, 질량 kg, 각도 rad, 시간 s.
// 공이의 움직임은 누름대(캠) 기하 + 방아채(지레) 운동 방정식에서만 나온다(곡선 끼워 맞춤 없음).
import { G_ACC, RHO, MILL } from './types';
import type { BeamState, DriveMode, MillState, Readout, Strike } from './types';

const D2R = Math.PI / 180;
const TWO_PI = Math.PI * 2;
const BETA_REST = MILL.betaRest * D2R;
const SUB_DT = 1 / 600;
const EPS = 1e-12;
const STOP_AFTER = 0.3; // s

// 5-2 상수: 방아채 중력 토크 계수 G, 관성 모멘트 I
const G_TORQ = G_ACC * (MILL.pestleMass * MILL.pestleArm + MILL.beamMass * 0.5);
const I_BEAM = MILL.pestleMass * MILL.pestleArm ** 2 + (MILL.beamMass * MILL.beamLen ** 2) / 12 + MILL.beamMass * 0.5 ** 2;

// 5-3 상수
const PHI_IN = MILL.phiIn * D2R;
const PHI_OUT = MILL.phiOut * D2R;
const DPHI = PHI_OUT - PHI_IN;
const DCOS = Math.cos(PHI_IN) - Math.cos(PHI_OUT);
const M_MAX = (RHO * MILL.bucketCap * MILL.blades * DPHI) / TWO_PI;
const T_W_COEF = (G_ACC * MILL.rMean * DCOS) / DPHI; // Tw = M × 이 값
const K_WATER = RHO * G_ACC * MILL.rMean * DCOS;

/** 누름대 끝 위치 (z, y) */
export function tipPos(tipAngle: number): { z: number; y: number } {
  return { z: MILL.armR * Math.sin(tipAngle), y: MILL.axisY + MILL.armR * Math.cos(tipAngle) };
}

/** 그 끝이 방아채 꼬리를 누를 때의 β. 닿지 않으면 null */
export function betaCam(tipAngle: number): number | null {
  const c = tipPos(tipAngle);
  const dz = MILL.pivotZ - c.z;
  const dy = MILL.pivotY - c.y;
  if (dz <= 0) return null;
  if (Math.hypot(dz, dy) > MILL.tailLen + EPS) return null;
  const b = Math.atan2(dy, dz);
  if (b < BETA_REST - EPS) return null;
  return b;
}

/** dβcam/dθ (끝 각이 θ와 같은 속도로 변하므로 φ에 대한 미분과 같다) */
function dBetaCam(tipAngle: number): number {
  const c = tipPos(tipAngle);
  const dz = MILL.pivotZ - c.z;
  const dy = MILL.pivotY - c.y;
  const r2 = dz * dz + dy * dy;
  return (dz * MILL.armR * Math.sin(tipAngle) + dy * MILL.armR * Math.cos(tipAngle)) / r2;
}

function bisect(f: (x: number) => number, lo: number, hi: number): number {
  let a = lo;
  let b = hi;
  const fa = f(a);
  for (let i = 0; i < 80; i++) {
    const m = 0.5 * (a + b);
    if ((f(m) > 0) === (fa > 0)) a = m;
    else b = m;
  }
  return 0.5 * (a + b);
}

function buildCam() {
  const phiOnFn = (p: number) => {
    const c = tipPos(p);
    return Math.atan2(MILL.pivotY - c.y, MILL.pivotZ - c.z) - BETA_REST;
  };
  const phiOffFn = (p: number) => {
    const c = tipPos(p);
    return Math.hypot(MILL.pivotZ - c.z, MILL.pivotY - c.y) - MILL.tailLen;
  };
  const on = bisect(phiOnFn, 100 * D2R, 130 * D2R);
  const off = bisect(phiOffFn, 125 * D2R, 160 * D2R);
  const c = tipPos(off);
  const betaOff = Math.atan2(MILL.pivotY - c.y, MILL.pivotZ - c.z);
  return {
    on, off, betaOff,
    lift: MILL.pestleArm * (Math.sin(betaOff) - Math.sin(BETA_REST)),
    liftEnergy: G_TORQ * (Math.sin(betaOff) - Math.sin(BETA_REST)),
    G: G_TORQ,
    I: I_BEAM,
  };
}
/** 각은 라디안. on/off = 누름대 끝 각(굴통 각 θ + 방아채 오프셋) */
export const CAM = buildCam();

/** 한결같이 돌 때의 굴통 각속도 rad/s: dragC ω² + (마찰 + 평균 캠 토크) ω − K Q = 0 의 양의 해 */
export function steadyOmega(q: number): number {
  if (q <= 0) return 0;
  const tCam = (4 * CAM.liftEnergy) / TWO_PI;
  const b = MILL.frictionT + tCam;
  return (-b + Math.sqrt(b * b + 4 * MILL.dragC * K_WATER * q)) / (2 * MILL.dragC);
}

/** 물이 칸에 실려 내려가는 동안 내놓는 일률 W */
export function waterPower(q: number): number {
  return RHO * G_ACC * q * MILL.rMean * DCOS;
}

type BeamMode = 'rest' | 'press' | 'free';
interface BeamInt { mode: BeamMode; beta: number; bd: number; dbdth: number; tRel: number; peak: number }

function liftOf(beta: number): number {
  return MILL.pestleArm * (Math.sin(beta) - Math.sin(BETA_REST));
}

function newBeam(): BeamInt {
  return { mode: 'rest', beta: BETA_REST, bd: 0, dbdth: 0, tRel: 0, peak: 0 };
}

export class MillPhysics {
  readonly state: MillState;
  q: number = MILL.qStd;
  gateOpen = false;
  mode: DriveMode = 'water';
  timeScale = 1;

  private bm: [BeamInt, BeamInt] = [newBeam(), newBeam()];
  private pending = 0;            // 손으로 돌린 각(다음 step에서 적용)
  private lastMode: DriveMode = 'water';
  private hT: number[] = [];
  private hTh: number[] = [];
  private lastMoveT = -Infinity;  // 굴통 각이 마지막으로 바뀐 시각(멈추면 숫자판이 바로 '정지')

  constructor() {
    this.state = {
      t: 0, theta: 100 * D2R, omega: 0, waterMass: 0, flow: 0,
      beams: [this.beamState(0), this.beamState(1)],
      strikes: [0, 0], last: [null, null],
    };
    this.reset();
  }

  private beamState(i: 0 | 1): BeamState {
    const b = this.bm[i];
    return { beta: b.beta, betaDot: b.bd, engaged: b.mode === 'press', lift: b.mode === 'rest' ? 0 : liftOf(b.beta) };
  }

  private syncBeams(): void {
    this.state.beams[0] = this.beamState(0);
    this.state.beams[1] = this.beamState(1);
  }

  reset(): void {
    const s = this.state;
    s.t = 0; s.theta = 100 * D2R; s.omega = 0; s.waterMass = 0; s.flow = 0;
    s.strikes = [0, 0]; s.last = [null, null];
    this.bm = [newBeam(), newBeam()];
    this.pending = 0;
    this.lastMode = this.mode;
    this.syncBeams();
    this.resetHistory();
  }

  private resetHistory(): void {
    this.hT = [this.state.t];
    this.hTh = [this.state.theta];
    this.lastMoveT = -Infinity;
  }

  /** 누름대 끝 2개 중 방아채 i를 누르는 끝의 (β, dβ/dθ). 없으면 null */
  private cam(i: 0 | 1, theta: number): { b: number; d: number } | null {
    const base = theta + MILL.armOffset[i] * D2R;
    for (let k = 0; k < 2; k++) {
      const phi = base + k * Math.PI;
      const b = betaCam(phi);
      if (b !== null) return { b, d: dBetaCam(phi) };
    }
    return null;
  }

  pose(theta: number): void {
    const s = this.state;
    s.theta = theta; s.omega = 0; s.waterMass = 0; s.flow = 0;
    this.pending = 0;
    for (const i of [0, 1] as const) {
      const c = this.cam(i, theta);
      const b = this.bm[i];
      b.bd = 0; b.dbdth = 0; b.peak = 0;
      if (c) { b.mode = 'press'; b.beta = c.b; b.dbdth = c.d; } else { b.mode = 'rest'; b.beta = BETA_REST; }
    }
    this.syncBeams();
    this.resetHistory();
  }

  handTurn(dTheta: number): boolean {
    if (dTheta < 0) return false;
    this.pending += dTheta;
    return true;
  }

  /** 방아채 한 개를 h초 진행. 찧었으면 기록을 돌려준다 */
  private stepBeam(i: 0 | 1, h: number, omega: number, t0: number): Strike | null {
    const b = this.bm[i];
    const th = this.state.theta;
    const wasPress = b.mode === 'press';
    const betaPrev = b.beta;
    let betaNew = b.beta;
    if (b.mode !== 'rest') {
      // 자유 운동: β'' = −G cos β / I
      const acc0 = (-G_TORQ * Math.cos(b.beta)) / I_BEAM;
      betaNew = b.beta + b.bd * h + 0.5 * acc0 * h * h;
      const acc1 = (-G_TORQ * Math.cos(betaNew)) / I_BEAM;
      b.bd += 0.5 * (acc0 + acc1) * h;
    }
    const c = this.cam(i, th);
    if (c && c.b >= betaNew - EPS) {
      // 누름대가 누르고 있다: 꼬리를 따라간다
      b.mode = 'press';
      b.beta = c.b;
      b.dbdth = c.d;
      b.bd = c.d * omega;
      return null;
    }
    if (wasPress) {
      // 꼬리 끝을 벗어난 순간 — 자유 운동으로 넘어가며 올라가던 속도를 이어받는다
      b.mode = 'free';
      b.tRel = t0;
      b.peak = Math.max(liftOf(betaPrev), liftOf(betaNew));
      b.dbdth = 0;
      b.beta = betaNew;
      return null;
    }
    if (b.mode === 'free') {
      b.peak = Math.max(b.peak, liftOf(betaNew));
      if (betaNew <= BETA_REST) {
        // 확 속 곡식에 닿아 멈춤 — 닿은 순간을 선형으로 보간
        const f = betaPrev > betaNew ? (betaPrev - BETA_REST) / (betaPrev - betaNew) : 1;
        const tHit = t0 + f * h;
        const bdAt = this.hitSpeedBd(b.bd, f, h, betaPrev);
        const strike: Strike = {
          beam: i,
          speed: -bdAt * MILL.pestleArm,
          energy: 0.5 * I_BEAM * bdAt * bdAt,
          fallTime: tHit - b.tRel,
          peakLift: b.peak,
          t: tHit,
        };
        b.mode = 'rest';
        b.beta = BETA_REST;
        b.bd = 0;
        return strike;
      }
      b.beta = betaNew;
    }
    return null;
  }

  /** 닿는 순간의 β': 이번 단계 끝 속도에서 거꾸로 (1−f)h 만큼 되돌린 값 */
  private hitSpeedBd(bdEnd: number, f: number, h: number, beta: number): number {
    const acc = (-G_TORQ * Math.cos(beta)) / I_BEAM;
    return bdEnd - acc * (1 - f) * h;
  }

  step(dt: number): Strike[] {
    const out: Strike[] = [];
    const dts = dt * this.timeScale;
    if (!(dts > 0)) return out;
    const s = this.state;
    if (this.mode !== this.lastMode) {
      if (this.mode === 'water') { s.omega = 0; this.pending = 0; } else { s.waterMass = 0; s.flow = 0; s.omega = 0; }
      this.lastMode = this.mode;
    }
    const hand = this.mode === 'hand';
    let n = Math.max(1, Math.ceil(dts / SUB_DT - 1e-9));
    if (hand) n = Math.max(n, Math.ceil(this.pending / (1 * D2R)));
    const h = dts / n;
    const dthHand = hand ? this.pending / n : 0;
    const omegaHand = hand ? this.pending / dts : 0;
    this.pending = 0;
    const qSet = Math.min(Math.max(this.q, 0), MILL.qMax);
    for (let k = 0; k < n; k++) {
      const t0 = s.t;
      if (hand) {
        s.flow = 0; s.waterMass = 0;
        s.omega = omegaHand;
        s.theta += dthHand;
      } else {
        // 수문: 0.8초에 걸쳐 열리고 닫힌다
        const target = this.gateOpen ? qSet : 0;
        const rate = Math.max(qSet, s.flow, 0.02) / 0.8;
        if (s.flow < target) s.flow = Math.min(target, s.flow + rate * h);
        else if (s.flow > target) s.flow = Math.max(target, s.flow - rate * h);
        // 바퀴에 실린 물
        let m = s.waterMass + (RHO * s.flow - (s.waterMass * s.omega) / DPHI) * h;
        m = Math.min(Math.max(m, 0), M_MAX);
        s.waterMass = m;
        // 굴통이 받는 반대 토크(눌리는 방아채마다)
        let tCam = 0;
        for (const b of this.bm) if (b.mode === 'press') tCam += G_TORQ * Math.cos(b.beta) * b.dbdth;
        const net = m * T_W_COEF - MILL.frictionT - MILL.dragC * s.omega - tCam;
        if (s.omega <= 0 && net <= 0) {
          s.omega = 0;
        } else {
          const inertia = MILL.wheelInertia + m * MILL.rMean * MILL.rMean;
          s.omega = Math.max(0, s.omega + (net / inertia) * h);
        }
        s.theta += s.omega * h;
      }
      for (const i of [0, 1] as const) {
        const st = this.stepBeam(i, h, s.omega, t0);
        if (st) {
          s.strikes[i] += 1;
          s.last[i] = st;
          out.push(st);
        }
      }
      s.t = t0 + h;
    }
    this.syncBeams();
    this.pushHistory();
    return out;
  }

  private pushHistory(): void {
    const s = this.state;
    if (s.theta > this.hTh[this.hTh.length - 1]! + 1e-9) this.lastMoveT = s.t;
    this.hT.push(s.t);
    this.hTh.push(s.theta);
    const lim = s.theta - TWO_PI;
    while (this.hT.length > 2 && (this.hTh[1]! <= lim || this.hT[1]! < s.t - 60)) {
      this.hT.shift();
      this.hTh.shift();
    }
  }

  stats(): { rpm: number; revTime: number; strikesPerMin: number; avgOver: number } {
    const s = this.state;
    const n = this.hT.length;
    // 굴통이 0.3초 넘게 움직이지 않았으면 평균이 남아 있어도 정지로 본다
    if (s.t - this.lastMoveT > STOP_AFTER) return { rpm: 0, revTime: Infinity, strikesPerMin: 0, avgOver: 0 };
    let dT = 0;
    let dTh = 0;
    if (n >= 2 && s.theta - this.hTh[0]! >= TWO_PI) {
      // 최근 한 바퀴: 현재 각 − 2π 인 때를 보간
      const lim = s.theta - TWO_PI;
      let k = 0;
      while (k + 1 < n - 1 && this.hTh[k + 1]! <= lim) k++;
      const span = this.hTh[k + 1]! - this.hTh[k]!;
      const f = span > 0 ? (lim - this.hTh[k]!) / span : 0;
      const tAt = this.hT[k]! + f * (this.hT[k + 1]! - this.hT[k]!);
      dT = s.t - tAt;
      dTh = TWO_PI;
    } else {
      // 한 바퀴가 안 됐으면 최근 2초
      let k = 0;
      while (k < n - 1 && this.hT[k]! < s.t - 2) k++;
      dT = s.t - this.hT[k]!;
      dTh = s.theta - this.hTh[k]!;
    }
    if (!(dT > 1e-9) || dTh <= 0) return { rpm: 0, revTime: Infinity, strikesPerMin: 0, avgOver: Math.max(dT, 0) };
    const rpm = (dTh / TWO_PI / dT) * 60;
    // 누름대 끝이 방아채마다 2개 → 한 바퀴에 공이 하나가 2번
    return { rpm, revTime: 60 / rpm, strikesPerMin: 2 * rpm, avgOver: dT };
  }
}

const f1 = (v: number) => v.toFixed(1);
const f2 = (v: number) => v.toFixed(2);

/** 8-2 숫자판 */
export function readouts(p: MillPhysics): Readout[] {
  const s = p.state;
  const st = p.stats();
  const lastRec = [s.last[0], s.last[1]].filter((x): x is Strike => x !== null).sort((a, b) => b.t - a.t)[0] ?? null;
  const dropT = Math.sqrt((2 * CAM.lift) / G_ACC);
  const dropV = Math.sqrt(2 * G_ACC * CAM.lift);
  const hit = Math.sqrt(2 * G_ACC * MILL.head);
  const power = (4 * CAM.liftEnergy * st.rpm) / 60 / 1000;
  const turning = st.rpm > 0.05;
  return [
    { key: 'flow', label: '물의 양', value: `${Math.round(s.flow * 1000)} L/s`, basis: '1초에 흘러오는 물의 부피' },
    { key: 'hitSpeed', label: '바퀴에 닿는 물의 빠르기', value: `${f2(hit)} m/s`, basis: `√(2 × 9.81 × 낙차 ${f2(MILL.head)})` },
    { key: 'water', label: '바퀴에 실린 물', value: `${Math.round(s.waterMass)} kg`, basis: '지금 칸에 담겨 있는 물' },
    {
      key: 'waterPower', label: '물이 내놓는 일률', value: `${f1(waterPower(s.flow) / 1000)} kW`,
      basis: `1000 × 9.81 × ${f2(s.flow)} × ${f2(MILL.rMean * DCOS)}(물이 칸에 실려 내려가는 높이 ${f2(MILL.rMean * DCOS)} m) — 모형`,
    },
    {
      key: 'rpm', label: '바퀴 회전',
      value: turning ? `${f1(st.rpm)}회/분 · 한 바퀴 ${f1(st.revTime)}초` : '정지',
      basis: '최근 한 바퀴 평균',
    },
    {
      key: 'strikes', label: '찧는 횟수',
      value: turning ? `공이 하나 ${Math.round(st.strikesPerMin)}회/분` : '—',
      basis: '누름대 끝이 2개라 한 바퀴에 2번',
    },
    {
      key: 'lift', label: '공이 높이(지금)',
      value: `공이 1 ${f2(s.beams[0].lift)} m · 공이 2 ${f2(s.beams[1].lift)} m`,
      basis: `${MILL.pestleArm} × (sin β − sin(${MILL.betaRest}°))`,
    },
    {
      key: 'camLift', label: '누름대가 들어 올리는 높이', value: `${f2(CAM.lift)} m`,
      basis: `누름대가 꼬리 끝을 벗어날 때(굴통 각 ${f1((CAM.off - CAM.on) / D2R)}° 동안 누름)`,
    },
    {
      key: 'fallTime', label: '떨어지는 시간', value: lastRec ? `${f2(lastRec.fallTime)}초` : '—',
      basis: `마지막으로 찧은 기록. 그냥 떨어뜨리면 ${f2(dropT)}초(방아채는 볼씨를 중심으로 돌며 떨어져 조금 다르다)`,
    },
    {
      key: 'impactSpeed', label: '확에 닿는 빠르기', value: lastRec ? `${f1(lastRec.speed)} m/s` : '—',
      basis: `그냥 떨어뜨리면 √(2 × 9.81 × ${f2(CAM.lift)}) = ${f1(dropV)} m/s`,
    },
    {
      key: 'energy', label: '한 번 찧는 에너지', value: lastRec ? `${Math.round(lastRec.energy)} J` : '—',
      basis: '½ × I × (도는 빠르기)²',
    },
    {
      key: 'usedPower', label: '방아가 쓰는 일률', value: `${f2(power)} kW`,
      basis: `4 × ${Math.round(CAM.liftEnergy)} J × 회전수 ÷ 60`,
    },
  ];
}
