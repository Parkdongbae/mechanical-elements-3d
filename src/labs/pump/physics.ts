// 작두펌프 물리 — 준정적(느린 펌프질) 모델. 단위는 실제 SI(m, m², m³, Pa).
// 영역 A: 땅속 관(물기둥 + 위쪽 공기), 영역 B: 피스톤 아래(아래 밸브 ~ 피스톤), 영역 C: 피스톤 위(대기에 열림).
// 공기는 등온 이상기체(p·V = 일정), 관 속 물기둥은 p_관 = 대기압 − ρgz 로 평형.
// 두 체크 밸브는 압력 차가 "위로 흐르는 방향"일 때만 열린다.

export const P0 = 101325; // 대기압 [Pa]
export const RHO_G = 1000 * 9.81; // 물의 밀도 × 중력가속도 [Pa/m]
/** 대기압이 떠받칠 수 있는 물기둥의 높이(이론값) */
export const H_LIMIT = P0 / RHO_G; // ≈ 10.33 m

export const CYL_D = 0.09; // 실린더 안지름 90 mm
export const PIPE_D = 0.025; // 관 안지름 25 mm
export const STROKE = 0.2; // 피스톤 행정 200 mm
export const A_C = (Math.PI * CYL_D * CYL_D) / 4;
export const A_P = (Math.PI * PIPE_D * PIPE_D) / 4;
/** 피스톤이 맨 아래일 때 남는 틈의 부피(밸브 구멍 포함) — 이 틈 때문에 완전한 진공은 못 만든다 */
export const V_DEAD = 1.5e-5;
/** 아래 밸브가 땅 위로 올라와 있는 높이 */
export const VALVE_ABOVE_GROUND = 0.4;
/** 마중물 한 바가지 */
export const PRIME_L = 0.8;

export interface PumpEvents {
  /** 이번 프레임에 아래 밸브가 열렸는지(공기든 물이든 위로 흐름) */
  footOpen: boolean;
  /** 아래 밸브를 지나 올라온 물 [m³] */
  footWater: number;
  pistonOpen: boolean;
  /** 피스톤 밸브를 지나 위로 넘어간 물 [m³] */
  pistonWater: number;
  /** 주둥이로 쏟아진 물 [m³] */
  spill: number;
}

export class PumpPhysics {
  /** 우물 깊이(땅 ~ 지하수면) [m] */
  depth = 6;
  primed = false;
  /** 관 속 물기둥 높이(지하수면 기준) [m] */
  z = 0;
  /** 관 위쪽 공기의 양 (p·V) */
  mA = 0;
  /** 피스톤 아래 공기의 양 (p·V) */
  mB = 0;
  /** 피스톤 아래 물 [m³] */
  wB = 0;
  /** 피스톤 위 물 [m³] */
  wC = 0;
  /** 피스톤 아래 압력 [Pa] */
  pB = P0;
  /** 피스톤 높이(맨 아래 = 0) [m] */
  s = 0;
  /** 퍼 올린 물 누적 [L] */
  pumpedL = 0;
  ev: PumpEvents = { footOpen: false, footWater: 0, pistonOpen: false, pistonWater: 0, spill: 0 };
  /** 피스톤 꼭대기(맨 아래일 때)에서 주둥이 아랫면까지 높이 [m] — 3D 모델 치수에서 받는다 */
  spoutH = 0.3;

  constructor(depth = 6, spoutH = 0.3) {
    this.depth = depth;
    this.spoutH = spoutH;
    this.reset(false);
  }

  /** 올려야 할 높이(지하수면 → 아래 밸브) */
  get lift(): number {
    return this.depth + VALVE_ABOVE_GROUND;
  }

  get canReach(): boolean {
    // 남는 틈 때문에 도달 가능한 최저 압력 — 이 이상은 공기를 더 뺄 수 없다
    const pMin = (P0 * V_DEAD) / (V_DEAD + A_C * STROKE);
    return this.lift < (P0 - pMin) / RHO_G;
  }

  /** 관이 물로 가득 찼는지 */
  get pipeFull(): boolean {
    return this.z >= this.lift - 1e-6;
  }

  /** 우물을 처음 상태로(관 속은 공기, 물은 지하수면에) */
  reset(keepPrime: boolean): void {
    const L = this.lift;
    this.z = 0;
    this.mA = P0 * A_P * L;
    this.wB = 0;
    this.mB = P0 * this.vB();
    this.pB = P0;
    if (!keepPrime) {
      this.primed = false;
      this.wC = 0;
    }
  }

  setDepth(d: number): void {
    this.depth = d;
    this.reset(true);
  }

  prime(): void {
    this.primed = true;
    this.wC += PRIME_L / 1000;
    this.overflow();
  }

  private vB(): number {
    return A_C * this.s + V_DEAD;
  }

  /** 피스톤 위 물이 주둥이 높이를 넘으면 넘친 만큼 쏟아진다 */
  private overflow(): number {
    const cap = A_C * Math.max(0, this.spoutH - this.s);
    if (this.wC > cap) {
      const out = this.wC - cap;
      this.wC = cap;
      this.ev.spill += out;
      this.pumpedL += out * 1000;
      return out;
    }
    return 0;
  }

  /** 피스톤을 새 높이 s로 옮기고 밸브·물·공기 상태를 푼다 */
  step(s: number): void {
    const ev = this.ev;
    ev.footWater = ev.pistonWater = ev.spill = 0;
    ev.footOpen = ev.pistonOpen = false;
    this.s = Math.max(0, Math.min(STROKE, s));
    const VB = this.vB();

    if (!this.primed) {
      // 마른 가죽 패킹 틈으로 공기가 드나들어 피스톤 아래는 늘 대기압 — 아래 밸브가 열릴 이유가 없다
      this.pB = P0;
      this.mB = P0 * Math.max(0, VB - this.wB);
      this.overflow();
      return;
    }

    const VaB = VB - this.wB;
    let pB = VaB > 1e-12 ? this.mB / VaB : Infinity;
    if (VaB <= 1e-12 && this.mB <= 1e-12) {
      // 물로 꽉 찬 상태: 내려가면 물이 밀려 올라가고, 올라가면 압력이 떨어진다
      pB = VaB < 0 ? Infinity : 0;
    }

    if (pB > P0) {
      // 피스톤 밸브 열림: 공기가 먼저(위쪽), 그다음 물이 피스톤 위로 넘어간다
      ev.pistonOpen = true;
      if (VaB >= 0) {
        this.mB = P0 * VaB;
      } else {
        this.mB = 0;
        const excess = this.wB - VB;
        this.wB = VB;
        this.wC += excess;
        ev.pistonWater = excess;
      }
      this.pB = P0;
    } else {
      // 아래 밸브 덮개 위쪽 압력 = 피스톤 아래 공기 압력 + 그 아래 고인 물의 무게
      const pA = P0 - RHO_G * this.z;
      const pSeat = pB + RHO_G * (this.wB / A_C);
      if (pSeat < pA - 5) {
        this.mergeUp(VB);
      } else {
        this.pB = pB;
      }
    }
    this.overflow();
  }

  /** 아래 밸브가 열려 관과 피스톤 아래가 하나로 이어졌을 때의 평형 */
  private mergeUp(VB: number): void {
    const pBefore = Math.min(this.pB, P0);
    const L = this.lift;
    const m = this.mA + this.mB;
    const W0 = A_P * this.z + this.wB;
    const Vtot = A_P * L + VB;
    const topOf = (W: number): number => (W <= A_P * L ? W / A_P : L + (W - A_P * L) / A_C);
    const h = (W: number): number => {
      const Va = Vtot - W;
      const p = Va > 1e-12 ? m / Va : m > 1e-12 ? Infinity : 0;
      return p - (P0 - RHO_G * topOf(W));
    };
    let W = W0;
    if (h(Vtot) <= 0) {
      W = Vtot;
    } else {
      let lo = W0;
      let hi = Vtot;
      for (let i = 0; i < 60; i++) {
        const mid = (lo + hi) / 2;
        if (h(mid) < 0) lo = mid;
        else hi = mid;
      }
      W = lo;
    }
    const Va = Vtot - W;
    const p = Va > 1e-12 ? m / Va : Math.max(0, P0 - RHO_G * topOf(W));
    const zNew = Math.min(L, W / A_P);
    const wBNew = Math.max(0, W - A_P * L);
    const VaA = A_P * (L - zNew);
    const VaB = Math.max(0, VB - wBNew);
    this.z = zNew;
    this.wB = wBNew;
    this.mA = p * VaA;
    this.mB = p * VaB;
    this.pB = p;
    // 눈에 띄는 흐름(물 또는 공기 압력 변화)이 있을 때만 '열림'으로 본다
    this.ev.footWater = Math.max(0, W - W0);
    this.ev.footOpen = this.ev.footWater > 1e-9 || Math.abs(p - pBefore) > 20;
  }

  /** 피스톤을 들어 올리는 데 필요한 힘(마찰·피스톤 무게 무시) [N] */
  pistonForce(): number {
    return (P0 - this.pB) * A_C + this.wC * 1000 * 9.81;
  }
}
