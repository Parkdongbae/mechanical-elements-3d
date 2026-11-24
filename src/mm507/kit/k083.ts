// 83·84·85번 전용 키트
//   083 톱니 부채꼴 두 개(앞·뒤)로 면 래칫 바퀴 돌리기 — 면 래칫 바퀴, 톱니 부채꼴(창성 윤곽), 들림 풀이
//   084 조속기용 이중 랙 틀 — 랙 틀, 한 손가락 캠, 멍에 막대, 밀기 진행 표
//   085 캠(와이퍼)으로 들어 올리는 낙하 막대 — 인벌류트 와이퍼 캠, 스탬프 막대, 기둥 틀
// 순수 계산 함수(…State, …Outline)는 three 물체를 만들지 않는다 → shots/_verify/s083*.mjs 가 번들로 불러 침범을 잰다.
import * as THREE from 'three';
import { brass, bronze, castIron, darkSteel, paint, steel } from '../../models/materials';
import { circlePath, extrude, lathe, mesh, pathFrom, rodProfile, shapeFrom, stadiumShape, tubeProfile, type V2 } from '../../models/parts/geom';
import { setMM } from './mm';

const TAU = Math.PI * 2;
const MARK = 0xf2b619;

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

/** 윤곽(V2[])을 두께 thick 로 눌러 낸 판(z 가운데 = 0). userData.outline = 윤곽 */
function plate(outline: V2[], holes: THREE.Path[], thick: number, mat: THREE.Material): THREE.Mesh {
  const shape = shapeFrom(outline);
  for (const h of holes) shape.holes.push(h);
  const m = mesh(extrude(shape, thick, Math.min(0.006, thick * 0.12)), mat);
  m.userData.outline = outline;
  return m;
}

function rectPath(x0: number, y0: number, x1: number, y1: number): THREE.Path {
  return pathFrom([
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1]
  ]);
}

/** 둥근 모서리 사각형 점열(반시계) */
function roundRectPts(x0: number, y0: number, x1: number, y1: number, r: number, n = 10): V2[] {
  const pts: V2[] = [];
  const corner = (cx: number, cy: number, a0: number): void => {
    for (let i = 0; i <= n; i++) {
      const a = a0 + (i / n) * (Math.PI / 2);
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  };
  corner(x1 - r, y0 + r, -Math.PI / 2);
  corner(x1 - r, y1 - r, 0);
  corner(x0 + r, y1 - r, Math.PI / 2);
  corner(x0 + r, y0 + r, Math.PI);
  return pts;
}

// ════════════════════════════ 083 톱니 부채꼴 두 개 ════════════════════════════

/**
 * 083 치수. 좌표는 로커 축 B 를 원점으로 한 정면(xy) — 부채꼴이 흔들리는 평면.
 * 바퀴 D 는 세로축(x = 0) 면 래칫. 부채꼴 판은 바퀴 축에서 앞(+z)·뒤(−z)로 ZR 떨어진 평면에 있다.
 */
export const K83 = {
  /** 바퀴 톱니 수 */
  N: 30,
  /** 부채꼴 판 평면과 바퀴 축의 거리 */
  ZR: 0.4,
  /** 부채꼴 판 두께 */
  T: 0.05,
  /** 톱니 높이 */
  H: 0.045,
  /** 톱니의 가파른 면이 차지하는 피치 비율 */
  RISE: 0.15,
  /** 부채꼴 피치 반지름(B → 바퀴 톱니 중간 높이) */
  RP: 0.62,
  /** 한 번 흔들 때(끝 → 끝) 바퀴가 가는 톱니 수 */
  STEP: 4,
  /** 부채꼴 톱니 수 */
  ARC_TEETH: 9,
  /** 창성 때 남기는 틈 */
  CLEAR: 0.004,
  /** 넘어갈 때 남기는 틈 */
  RIDE: 0.002,
  /** 바퀴 톱니 고리 안·밖 반지름 */
  RING_IN: 0.34,
  RING_OUT: 0.46,
  /** 로커 축 사각 키 반폭, 부채꼴 허브 바깥 반지름, 들림 홈 여유 */
  KEY: 0.045,
  HUB: 0.095,
  SLOT: 0.07,
  /** 레버 길이(B → 막대 A 핀), 막대 A 길이(핀 → 크로스헤드 핀), 크로스헤드 높이(B 기준) */
  LEVER: 0.28,
  ROD: 1.3,
  SLIDE_Y: -0.04
} as const;

/** 바퀴 톱니 각 피치 */
export const K83_PP = TAU / K83.N;
/** 흔들림 반각 Φ: 2Φ·RP = STEP·(ZR·PP) */
export const K83_PHI = (K83.STEP * K83.ZR * K83_PP) / (2 * K83.RP);
/** 부채꼴 톱니 각 피치 */
export const K83_PA = (K83.ZR * K83_PP) / K83.RP;
/** 바퀴 톱니 뿌리 평면의 높이(B 기준, 음수) */
export const K83_YROOT = -K83.RP - K83.H / 2;

/** 톱니 단면: u(피치 단위) → 0~1. 0 → RISE 는 가파르게 오르고, RISE → 1 은 비스듬히 내려간다 */
export function k83Saw(u: number): number {
  const f = u - Math.floor(u);
  return f < K83.RISE ? f / K83.RISE : 1 - (f - K83.RISE) / (1 - K83.RISE);
}

/** 바퀴 축에서 z 만큼 앞선 평면에서, 가로 x 자리의 바퀴 톱니 윗면 높이(B 기준). psiW = 바퀴 누적 회전각 */
export function k83WheelTop(x: number, z: number, psiW: number): number {
  return K83_YROOT + K83.H * k83Saw((Math.atan2(x, z) - psiW) / K83_PP);
}

const K83_ZS = [K83.ZR - K83.T / 2, K83.ZR, K83.ZR + K83.T / 2] as const;

/** 부채꼴 톱니 한 피치의 반지름 표 r(α) (α = −PA/2 … PA/2, BINS 칸). 바퀴 톱니가 굴러 지나가며 깎아 낸(창성) 윤곽 */
const K83_BINS = 96;
let k83ToothCache: number[] | null = null;
function k83Tooth(): number[] {
  if (k83ToothCache !== null) return k83ToothCache;
  const out: number[] = [];
  const ratio = K83.RP / K83.ZR;
  const ok = (r: number, beta: number, psi: number): boolean => {
    const x = r * Math.sin(beta);
    const y = -r * Math.cos(beta);
    for (const z of K83_ZS) if (y < k83WheelTop(x, z, psi) + K83.CLEAR) return false;
    return true;
  };
  for (let i = 0; i < K83_BINS; i++) {
    const alpha = -K83_PA / 2 + ((i + 0.5) / K83_BINS) * K83_PA;
    let rMin = K83.RP + K83.H;
    for (let beta = -0.42; beta <= 0.42; beta += 0.0015) {
      const psi = ratio * (beta - alpha);
      let lo = K83.RP - K83.H * 1.5;
      let hi = rMin;
      if (ok(hi, beta, psi)) continue;
      for (let k = 0; k < 16; k++) {
        const mid = (lo + hi) / 2;
        if (ok(mid, beta, psi)) lo = mid;
        else hi = mid;
      }
      rMin = lo;
    }
    out.push(rMin);
  }
  k83ToothCache = out;
  return out;
}

/** 부채꼴 이 쪽 가장자리의 점열(극좌표 α → 반지름), α 는 아래(−y)에서 +x 쪽으로 잰 각. mirror 면 뒤쪽 부채꼴(좌우 뒤집힘) */
export function k83ArcTeeth(mirror = false): V2[] {
  const tooth = k83Tooth();
  const half = (K83.ARC_TEETH / 2) * K83_PA;
  const pts: V2[] = [];
  const n = K83.ARC_TEETH * K83_BINS;
  for (let j = 0; j < n; j++) {
    const alpha = -half + ((j + 0.5) / n) * 2 * half;
    const u = (alpha + K83_PA / 2) / K83_PA;
    const i = Math.min(K83_BINS - 1, Math.floor((u - Math.floor(u)) * K83_BINS));
    const r = tooth[i]!;
    const a = mirror ? -alpha : alpha;
    pts.push([r * Math.sin(a), -r * Math.cos(a)]);
  }
  if (mirror) pts.reverse();
  return pts;
}

/** 부채꼴 판 윤곽(반시계 닫힌 점열, 원점 = 로커 축 B, 들리지 않은 자리) */
export function k83ArcOutline(mirror = false): V2[] {
  const pts = k83ArcTeeth(mirror); // −x 끝 → +x 끝 (아래 가장자리, 반시계)
  const half = (K83.ARC_TEETH / 2) * K83_PA;
  const rEdge = K83.RP - K83.H / 2 - K83.CLEAR - 0.004;
  pts.push([rEdge * Math.sin(half), -rEdge * Math.cos(half)]);
  // 허브: 아래로 길쭉한 고리(들림 홈을 품는다). 오른쪽 아래(중심 (0, −SLOT)) → 위 반원(중심 (0, 0)) → 왼쪽 아래
  const n = 8;
  for (let i = 0; i <= n; i++) {
    const a = -0.5 + (i / n) * 0.5;
    pts.push([K83.HUB * Math.cos(a), -K83.SLOT + K83.HUB * Math.sin(a)]);
  }
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI;
    pts.push([K83.HUB * Math.cos(a), K83.HUB * Math.sin(a)]);
  }
  for (let i = 0; i <= n; i++) {
    const a = Math.PI + (i / n) * 0.5;
    pts.push([K83.HUB * Math.cos(a), -K83.SLOT + K83.HUB * Math.sin(a)]);
  }
  pts.push([-rEdge * Math.sin(half), -rEdge * Math.cos(half)]);
  return pts;
}

/** 구동각 theta → 부채꼴 각 φ(반시계 +), 바퀴 누적각 ψ(위에서 보아 반시계 = 앞면이 +x 로) */
function k83Phase(theta: number): { phi: number; psi: number; stroke: number } {
  const k = Math.floor(theta / Math.PI);
  const w = theta - k * Math.PI;
  const travel = K83_PHI * (2 * k + 1 - Math.cos(w));
  return { phi: -K83_PHI * Math.cos(theta), psi: (K83.RP / K83.ZR) * (travel - K83_PHI), stroke: k };
}

/** 앞 부채꼴이 바퀴 톱니를 넘으려면 들려야 하는 높이(부채꼴 축 방향). 밀 때는 0 */
function k83LiftFront(theta: number): number {
  const { phi, psi } = k83Phase(theta);
  const pts = k83ArcTeeth(false);
  const c = Math.cos(phi);
  const s = Math.sin(phi);
  const gap = (lift: number): number => {
    let m = Infinity;
    for (let i = 0; i < pts.length; i += 2) {
      const p = pts[i]!;
      const lx = p[0];
      const ly = p[1] + lift;
      const x = lx * c - ly * s;
      if (Math.abs(x) > 0.3) continue;
      const y = lx * s + ly * c;
      for (const z of K83_ZS) m = Math.min(m, y - k83WheelTop(x, z, psi));
    }
    return m;
  };
  if (gap(0) >= K83.RIDE) return 0;
  let lo = 0;
  let hi = K83.H + 0.02;
  for (let k = 0; k < 16; k++) {
    const mid = (lo + hi) / 2;
    if (gap(mid) >= K83.RIDE) hi = mid;
    else lo = mid;
  }
  return hi;
}

export interface K83State {
  /** 로커 축(부채꼴·레버) 각, 반시계 + */
  phi: number;
  /** 바퀴 D 누적 회전각 — crownRatchetWheel 의 rotation.y */
  psi: number;
  /** 앞·뒤 부채꼴의 들림(부채꼴 로컬 +y) */
  liftFront: number;
  liftBack: number;
  /** 지금 미는 쪽 */
  driving: 'front' | 'back';
  /** 레버 끝 핀, 크로스헤드 핀(B 기준 xy) */
  pin: V2;
  slide: V2;
}

/** 083 의 모든 자세 = theta 의 닫힌 식(들림만 수치 풀이). 한 주기 2π 에 바퀴는 톱니 2·STEP 개 */
export function k83State(theta: number): K83State {
  const { phi, psi, stroke } = k83Phase(theta);
  const pin: V2 = [-K83.LEVER * Math.sin(phi), K83.LEVER * Math.cos(phi)];
  const dy = pin[1] - K83.SLIDE_Y;
  const slide: V2 = [pin[0] + Math.sqrt(K83.ROD * K83.ROD - dy * dy), K83.SLIDE_Y];
  const even = ((stroke % 2) + 2) % 2 === 0;
  return {
    phi,
    psi,
    liftFront: k83LiftFront(theta),
    liftBack: k83LiftFront(theta + Math.PI),
    driving: even ? 'front' : 'back',
    pin,
    slide
  };
}

/**
 * 면 래칫 바퀴 D: 회전축 = 로컬 Y, 원점 = 축 위·톱니 뿌리 평면 높이. 톱니는 윗면 고리(RING_IN~RING_OUT)에 반지름 방향으로 난다.
 * rotation.y = k83State().psi. thick = 원판 두께(뿌리 평면 아래로)
 */
export function crownRatchetWheel(thick = 0.1): THREE.Group {
  const g = new THREE.Group();
  const pos: number[] = [];
  const P = (rho: number, psi: number, y: number): [number, number, number] => [rho * Math.sin(psi), y, rho * Math.cos(psi)];
  const quad = (a: number[], b: number[], c: number[], d: number[]): void => {
    pos.push(...a, ...b, ...c, ...a, ...c, ...d);
  };
  // 한 톱니: 뿌리(0) → 가파른 면 꼭대기(RISE) → 다음 뿌리(1)
  const us = [0, K83.RISE, 1];
  for (let k = 0; k < K83.N; k++) {
    for (let j = 0; j < 2; j++) {
      const p0 = (k + us[j]!) * K83_PP;
      const p1 = (k + us[j + 1]!) * K83_PP;
      const h0 = j === 0 ? 0 : K83.H;
      const h1 = j === 0 ? K83.H : 0;
      // 윗면(법선 위쪽), 바깥벽, 안벽
      quad(P(K83.RING_IN, p0, h0), P(K83.RING_OUT, p0, h0), P(K83.RING_OUT, p1, h1), P(K83.RING_IN, p1, h1));
      quad(P(K83.RING_OUT, p0, 0), P(K83.RING_OUT, p1, 0), P(K83.RING_OUT, p1, h1), P(K83.RING_OUT, p0, h0));
      quad(P(K83.RING_IN, p1, 0), P(K83.RING_IN, p0, 0), P(K83.RING_IN, p0, h0), P(K83.RING_IN, p1, h1));
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  const teeth = mesh(geo, brass());
  (teeth.material as THREE.Material).side = THREE.DoubleSide;
  g.add(teeth);
  // 원판 + 아래 허브
  g.add(mesh(lathe(rodProfile(K83.RING_OUT, -thick, 0, 0.008, 0), 64), brass()));
  g.add(mesh(lathe(rodProfile(0.13, -thick - 0.07, -thick, 0.008, 0), 40), darkSteel()));
  // 표시점(회전이 보이게)
  g.add(meshAt(new THREE.BoxGeometry(0.02, 0.006, 0.12), paint(MARK), 0, 0.003, 0.2));
  setMM(g, { kind: 'ratchet', face: true, teeth: K83.N, axis: 'y', rIn: K83.RING_IN, rOut: K83.RING_OUT, toothH: K83.H });
  return g;
}

/**
 * 톱니 부채꼴 C: 원점 = 로커 축 B(들리지 않은 자리), 이가 아래(−y). 허브에 사각 키가 지나는 세로 긴 구멍(들림 홈, 키 아래로 SLOT)과 창 두 개.
 * mirror = 뒤쪽 부채꼴(이 방향 반대). 들림은 position.y(로커 그룹 안에서) 로 준다.
 */
export function ratchetArc(mirror = false, driver = false): THREE.Mesh {
  const outline = k83ArcOutline(mirror);
  const k = K83.KEY + 0.003;
  // 긴 구멍은 키 아래로 SLOT 만큼 길다 — 쉴 때는 구멍 윗변이 키 위에 걸리고, 들리면 키가 구멍 안에서 아래로 간다
  const holes: THREE.Path[] = [rectPath(-k, -k - K83.SLOT, k, k)];
  // 창 두 개(판화의 세모 창): 가운데 살(폭 0.07)을 사이에 둔 부채꼴 창
  const half = (K83.ARC_TEETH / 2) * K83_PA;
  const rIn = 0.24;
  const rOut = K83.RP - K83.H / 2 - 0.09;
  for (const sgn of [1, -1]) {
    const w: V2[] = [];
    const a0 = 0.07;
    const a1 = half - 0.17;
    w.push([sgn * 0.035, -rIn]);
    for (let i = 0; i <= 12; i++) {
      const a = a0 + (i / 12) * (a1 - a0);
      w.push([sgn * rOut * Math.sin(a), -rOut * Math.cos(a)]);
    }
    w.push([sgn * (0.035 + 0.05), -rIn]);
    holes.push(pathFrom(sgn > 0 ? w : w.reverse()));
  }
  const m = plate(outline, holes, K83.T, driver ? bronze({ roughness: 0.34 }) : brass());
  setMM(m, { kind: 'ratchetArc', teeth: K83.ARC_TEETH, rp: K83.RP, mirror });
  return m;
}

/** 로커 축의 사각 키 블록(부채꼴 허브의 긴 구멍에 끼어 돌림힘을 전하고 들림을 허용). 원점 = 축 중심, z 길이 len */
export function rockKey(len = 0.09): THREE.Mesh {
  const m = mesh(new THREE.BoxGeometry(K83.KEY * 2, K83.KEY * 2, len), darkSteel());
  setMM(m, { kind: 'key', half: K83.KEY });
  return m;
}

/** 로커 레버: 원점 = 축 B, +y 로 length. 끝에 핀 구멍 눈. 두께 thick */
export function rockLever(length = K83.LEVER, thick = 0.03): THREE.Group {
  const g = new THREE.Group();
  const shape = stadiumShape(0, 0, 0, length, 0.045);
  shape.holes.push(circlePath(0, length, 0.022));
  g.add(mesh(extrude(shape, thick, 0.006), steel()));
  const hub = lathe(tubeProfile(0.04, 0.085, -thick / 2 - 0.01, thick / 2 + 0.01, 0.006), 32);
  hub.rotateX(Math.PI / 2);
  g.add(mesh(hub, darkSteel()));
  setMM(g, { kind: 'lever', length, pivot: [0, 0, 0], tip: [0, length, 0] });
  return g;
}

/** 납작한 연결 막대: 원점 = 한쪽 핀, +x 로 length 에 다른 핀. 양 끝 눈 + 핀(뒤로 pinBack, 앞으로 0.012 나옴) */
export function eyeBar(length: number, thick = 0.04, halfW = 0.03, pinBack = 0.012): THREE.Group {
  const g = new THREE.Group();
  const shape = stadiumShape(0, 0, length, 0, halfW);
  g.add(mesh(extrude(shape, thick, 0.006), steel()));
  for (const x of [0, length]) {
    const pin = lathe(rodProfile(0.02, -thick / 2 - pinBack, thick / 2 + 0.012, 0.004, 0.004), 20);
    pin.rotateX(Math.PI / 2);
    g.add(meshAt(pin, darkSteel(), x, 0, 0));
  }
  setMM(g, { kind: 'link', length, a: [0, 0, 0], b: [length, 0, 0] });
  return g;
}

/** 세로 축(Y): 로컬 y0 ~ y1, 반지름 r */
export function shaftY(y0: number, y1: number, r = 0.045): THREE.Mesh {
  const m = mesh(lathe(rodProfile(r, y0, y1, r * 0.25, r * 0.25), 32), steel());
  setMM(m, { kind: 'shaft', axis: 'y', r, y0, y1 });
  return m;
}

/** 바닥 축받이(세로 축의 밑을 받치는 발판 베어링). 원점 = 바닥면 중심, 높이 h, 구멍 반지름 bore */
export function footBearing(h = 0.16, bore = 0.05): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(lathe(rodProfile(0.17, 0, 0.04, 0.008, 0.008), 40), castIron()));
  g.add(mesh(lathe(tubeProfile(bore, bore + 0.05, 0.04, h, 0.008), 36), darkSteel()));
  setMM(g, { kind: 'bearing', axis: 'y', bore });
  return g;
}

/**
 * 바닥에 선 안내 기둥: 원점 = 바닥면 중심. 높이 height 꼭대기에 가로(x) 안내 홈 블록(길이 len)이 있어 크로스헤드가 미끄러진다.
 * 안내 중심선 높이 = height
 */
export function guidePost(height: number, len = 0.5): THREE.Group {
  const g = new THREE.Group();
  const body = castIron();
  g.add(meshAt(new THREE.BoxGeometry(0.24, 0.03, 0.09), body, 0, 0.015, 0));
  g.add(meshAt(new THREE.BoxGeometry(0.08, height - 0.07, 0.07), body, 0, (height - 0.07) / 2, 0));
  // 아래 레일 + 위 레일(사이 0.08 로 크로스헤드가 지난다)
  g.add(meshAt(new THREE.BoxGeometry(len, 0.03, 0.09), darkSteel(), 0, height - 0.055, 0));
  g.add(meshAt(new THREE.BoxGeometry(len, 0.03, 0.09), darkSteel(), 0, height + 0.055, 0));
  for (const sx of [-1, 1]) g.add(meshAt(new THREE.BoxGeometry(0.03, 0.14, 0.09), darkSteel(), (sx * (len - 0.03)) / 2, height, -0.0001));
  setMM(g, { kind: 'guide', axis: 'x', len });
  return g;
}

/** 크로스헤드(미끄럼 블록): 원점 = 핀 중심. 0.14 × 0.08 × 0.06 */
export function crosshead(): THREE.Mesh {
  const m = mesh(new THREE.BoxGeometry(0.14, 0.078, 0.06), bronze({ roughness: 0.4 }));
  setMM(m, { kind: 'slider' });
  return m;
}

// ════════════════════════════ 084 이중 랙 틀 ════════════════════════════

/** 084 치수. 좌표 원점 = 캠 축 중심. 틀 로컬 원점 = 틀 가운데 */
export const K84 = {
  /** 캠 손가락 끝 원의 중심 반지름, 끝 둥글림 반지름 */
  A: 0.31,
  RHO: 0.02,
  /** 캠 허브 반지름 */
  HUB: 0.085,
  /** 중립 때 랙 이끝의 높이(±), 막대 A 가 올리고 내리는 거리 */
  TIP0: 0.36,
  DELTA: 0.07,
  /** 랙 피치, 이 높이, 이 밑변 폭, 이끝 평평한 폭 */
  P: 0.2,
  TH: 0.07,
  TW: 0.14,
  FLAT: 0.012,
  /** 랙 이 수(한쪽) */
  TEETH: 8,
  /** 한 방향으로 미는 횟수(= 틀이 가는 피치 수) */
  PUSHES: 2,
  /** 한 주기의 캠 회전수 */
  REVS: 6,
  /** 틀: 바깥 반길이, 살 두께, 윗 홈 막대(반길이·높이), 홈 중심 높이·반높이, 멍에 핀 x */
  HALF: 1.1,
  BAR: 0.08,
  TOP_HALF: 0.75,
  TOP_H: 0.2,
  SLOT_Y: 0.61,
  SLOT_R: 0.04,
  PIN_X: 0.38,
  /** 옆 막대: 끝 x, 반폭 */
  ARM_END: 1.7,
  ARM_HW: 0.04
} as const;

/** 캠 손가락 윤곽(반시계, 손가락이 +x 를 가리킴). 허브 원 + 곧은 손가락 + 둥근 끝 */
export function k84CamOutline(): V2[] {
  const pts: V2[] = [];
  const a0 = Math.asin(K84.RHO / K84.HUB);
  // 손가락 끝 반원(−90° → 90°)
  for (let i = 0; i <= 12; i++) {
    const a = -Math.PI / 2 + (i / 12) * Math.PI;
    pts.push([K84.A + K84.RHO * Math.cos(a), K84.RHO * Math.sin(a)]);
  }
  // 허브 원(a0 → 2π − a0)
  for (let i = 0; i <= 40; i++) {
    const a = a0 + (i / 40) * (TAU - 2 * a0);
    pts.push([K84.HUB * Math.cos(a), K84.HUB * Math.sin(a)]);
  }
  return pts;
}

/** 윗랙이 물렸을 때(틀이 DELTA 내려옴) 캠 각 alpha 에서 이의 곧은 면이 있을 수 있는 가장 오른쪽 x */
function k84Contact(alpha: number): number {
  const yTip = K84.TIP0 - K84.DELTA;
  const c = Math.cos(alpha);
  const s = Math.sin(alpha);
  let m = Infinity;
  const test = (lx: number, ly: number): void => {
    const y = lx * s + ly * c;
    if (y >= yTip) m = Math.min(m, lx * c - ly * s);
  };
  // 손가락 끝 반원 + 옆선을 촘촘히
  for (let i = 0; i <= 48; i++) {
    const a = -Math.PI / 2 + (i / 48) * Math.PI;
    test(K84.A + K84.RHO * Math.cos(a), K84.RHO * Math.sin(a));
  }
  for (let i = 0; i <= 40; i++) {
    const x = K84.A - (i / 40) * 0.12;
    test(x, K84.RHO);
    test(x, -K84.RHO);
  }
  return m;
}

const K84_N = 720; // 반 바퀴(0 ~ π)를 0.25° 간격
let k84TableCache: { push: number[]; exit: number } | null = null;
function k84Table(): { push: number[]; exit: number } {
  if (k84TableCache !== null) return k84TableCache;
  const xs: number[] = [];
  let run = Infinity;
  for (let i = 0; i <= K84_N; i++) {
    run = Math.min(run, k84Contact((i / K84_N) * Math.PI));
    xs.push(run);
  }
  const exit = run;
  const rest = exit + K84.P;
  k84TableCache = { push: xs.map((x) => Math.max(0, rest - Math.min(rest, x))), exit };
  return k84TableCache;
}

/** 다 밀고 난 뒤 윗랙 이의 곧은 면이 서는 자리(캠 축 기준 x, 음수). 랙 이의 자리를 정하는 기준 */
export function k84ExitX(): number {
  return k84Table().exit;
}

/** 손가락이 랙 쪽 반 바퀴(0 ~ 1)를 지나는 동안 민 거리(0 → P) */
function k84Push(frac: number): number {
  if (frac <= 0) return 0;
  if (frac >= 1) return K84.P;
  const t = k84Table().push;
  const u = frac * K84_N;
  const i = Math.floor(u);
  return t[i]! + (t[Math.min(K84_N, i + 1)]! - t[i]!) * (u - i);
}

const smooth = (x: number): number => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
};

export interface K84State {
  /** 틀의 가로 자리(캠 축 기준), 세로 자리(+ 올림, − 내림) */
  x: number;
  y: number;
  /** 캠 각(반시계, 손가락이 +x 에서 잰 각) */
  alpha: number;
  /** 'down' 윗랙 물림(왼쪽으로) · 'neutral' · 'up' 아랫랙 물림(오른쪽으로) · 'move' 막대 A 가 움직이는 중 */
  mode: 'down' | 'neutral' | 'up' | 'move';
}

/**
 * 084 시간표(캠 REVS = 6 바퀴가 한 주기, thetaE = 캠 누적각):
 *  바퀴 0 ~ 1.45 내림(윗랙, 0.25·1.25 에 한 피치씩 왼쪽) → 1.45 ~ 1.55 중립으로 → ~ 2.45 중립 → 2.45 ~ 2.55 올림
 *  → ~ 4.45 올림(아랫랙, 2.75·3.75 에 한 피치씩 오른쪽) → 4.45 ~ 4.55 중립으로 → ~ 5.45 중립 → 5.45 ~ 5.55 내림 → ~ 6 내림
 */
export function k84State(thetaE: number): K84State {
  const rev = thetaE / TAU;
  const cyc = Math.floor(rev / K84.REVS);
  const r = rev - cyc * K84.REVS;
  const seg = (): [number, K84State['mode']] => {
    if (r < 1.45) return [-1, 'down'];
    if (r < 1.55) return [-1 + smooth((r - 1.45) / 0.1), 'move'];
    if (r < 2.45) return [0, 'neutral'];
    if (r < 2.55) return [smooth((r - 2.45) / 0.1), 'move'];
    if (r < 4.45) return [1, 'up'];
    if (r < 4.55) return [1 - smooth((r - 4.45) / 0.1), 'move'];
    if (r < 5.45) return [0, 'neutral'];
    if (r < 5.55) return [-smooth((r - 5.45) / 0.1), 'move'];
    return [-1, 'down'];
  };
  const [y, mode] = seg();
  // 위쪽 밀기: 바퀴 0.0 ~ 0.5, 1.0 ~ 1.5 (손가락이 위 반 바퀴) / 아래쪽 밀기: 2.5 ~ 3.0, 3.5 ~ 4.0
  let left = 0;
  for (let j = 0; j < K84.PUSHES; j++) left += k84Push((r - j) / 0.5);
  let right = 0;
  for (let j = 0; j < K84.PUSHES; j++) right += k84Push((r - 2.5 - j) / 0.5);
  const x0 = (K84.PUSHES * K84.P) / 2;
  return { x: x0 - left + right, y: y * K84.DELTA, alpha: thetaE, mode };
}

/** 랙 이 하나(윗랙, 곧은 면이 x = xf, 이끝이 아래). 반시계 점열 */
function k84Tooth(xf: number): V2[] {
  const yr = K84.TIP0 + K84.TH;
  const yt = K84.TIP0;
  return [
    [xf, yr],
    [xf - K84.TW, yr],
    [xf - K84.FLAT, yt],
    [xf, yt]
  ];
}

/** 윗랙·아랫랙의 이 다각형들(틀 로컬 좌표). 아랫랙은 윗랙을 180° 돌린 것 */
export function k84RackTeeth(): { upper: V2[][]; lower: V2[][] } {
  const x0 = (K84.PUSHES * K84.P) / 2;
  const base = k84ExitX() - x0 + K84.P; // 틀이 x0 에 있을 때 첫 이가 '쉬는 자리'(exit + P)에 오도록
  const upper: V2[][] = [];
  const k0 = 1 - Math.floor(K84.TEETH / 2);
  for (let k = k0; k < k0 + K84.TEETH; k++) upper.push(k84Tooth(base + k * K84.P));
  const lower = upper.map((t) => t.map(([x, y]): V2 => [-x, -y]));
  return { upper, lower };
}

/**
 * 이중 랙 틀 B: 원점 = 틀 가운데(중립·가운데 자리에서 캠 축과 겹침). 창 위·아래 가장자리에 랙 이, 위에 가로 홈 두 개가 난 막대, 양옆 납작 막대.
 * userData.outlines = { rackUpper0…, rackLower0… } (이 다각형 — 침범 검사용)
 */
export function rackFrame(thick = 0.06): THREE.Group {
  const g = new THREE.Group();
  const mat = brass();
  const yIn = K84.TIP0 + K84.TH;
  const yOut = yIn + K84.BAR;
  const win = K84.HALF - K84.BAR;
  // 몸: 둥근 바깥 + 둥근 창
  const shape = shapeFrom(roundRectPts(-K84.HALF, -yOut, K84.HALF, yOut, 0.3));
  shape.holes.push(pathFrom(roundRectPts(-win, -yIn, win, yIn, 0.2).reverse()));
  g.add(mesh(extrude(shape, thick, 0.006), mat));
  // 랙 이(창 가장자리에서 안쪽으로)
  const { upper, lower } = k84RackTeeth();
  const outlines: Record<string, V2[]> = {};
  const toothMat = bronze({ roughness: 0.36 });
  upper.forEach((t, i) => {
    g.add(mesh(extrude(shapeFrom(t), thick, 0.003), toothMat));
    outlines[`rackUpper${i}`] = t;
  });
  lower.forEach((t, i) => {
    g.add(mesh(extrude(shapeFrom(t), thick, 0.003), toothMat));
    outlines[`rackLower${i}`] = t;
  });
  // 윗 홈 막대(가로 홈 두 개)
  const top = shapeFrom(roundRectPts(-K84.TOP_HALF, yOut - 0.01, K84.TOP_HALF, yOut + K84.TOP_H, 0.04));
  for (const sx of [-1, 1]) {
    const slot = stadiumShape(sx * (K84.PIN_X - 0.24), K84.SLOT_Y, sx * (K84.PIN_X + 0.24), K84.SLOT_Y, K84.SLOT_R);
    top.holes.push(pathFrom(slot.getPoints(10).map((p): V2 => [p.x, p.y])));
  }
  g.add(mesh(extrude(top, thick - 0.008, 0.005), mat));
  // 양옆 납작 막대(안내 블록을 지난다)
  for (const sx of [-1, 1]) {
    const arm = shapeFrom(roundRectPts(Math.min(sx * (K84.HALF - 0.05), sx * K84.ARM_END), -K84.ARM_HW, Math.max(sx * (K84.HALF - 0.05), sx * K84.ARM_END), K84.ARM_HW, 0.012, 4));
    g.add(mesh(extrude(arm, thick - 0.012, 0.005), steel()));
  }
  g.userData.outlines = outlines;
  setMM(g, { kind: 'rackFrame', pitch: K84.P, teeth: K84.TEETH });
  return g;
}

/** 캠 D(손가락 하나): 원점 = 축, 손가락이 +x. rotation.z = k84State().alpha */
export function fingerCam(thick = 0.05): THREE.Group {
  const g = new THREE.Group();
  const p = plate(k84CamOutline(), [], thick, bronze({ roughness: 0.34 }));
  g.add(p);
  g.userData.outline = p.userData.outline as V2[];
  p.userData.outline = undefined;
  g.add(meshAt(new THREE.BoxGeometry(0.12, 0.014, 0.008), paint(MARK), K84.A - 0.1, 0, thick / 2 + 0.002));
  setMM(g, { kind: 'cam', fingers: 1, reach: K84.A + K84.RHO });
  return g;
}

/**
 * 멍에 막대 A: 원점 = 두 핀의 가운데(틀 홈 중심 높이). 반원 멍에(반지름 PIN_X) + 위로 선 막대(길이 stem) + 핀 두 개(z 방향, 뒤로 pinBack 만큼).
 * 판은 핀보다 앞(로컬 z = 0), 핀은 z −pinBack ~ +0.02
 */
export function yokeRod(stem = 0.5, pinBack = 0.12): THREE.Group {
  const g = new THREE.Group();
  const R = K84.PIN_X;
  const w = 0.035;
  const pts: V2[] = [];
  for (let i = 0; i <= 32; i++) {
    const a = (i / 32) * Math.PI;
    pts.push([(R + w) * Math.cos(a), (R + w) * Math.sin(a)]);
  }
  pts.push([-(R + w), -0.03], [-(R - w), -0.03]);
  for (let i = 32; i >= 0; i--) {
    const a = (i / 32) * Math.PI;
    pts.push([(R - w) * Math.cos(a), (R - w) * Math.sin(a)]);
  }
  pts.push([R - w, -0.03], [R + w, -0.03]);
  g.add(mesh(extrude(shapeFrom(pts), 0.04, 0.005), steel()));
  g.add(mesh(extrude(shapeFrom(roundRectPts(-0.035, R - 0.02, 0.035, R + stem, 0.01, 4)), 0.04, 0.005), steel()));
  for (const sx of [-1, 1]) {
    const pin = lathe(rodProfile(K84.SLOT_R - 0.004, -pinBack, 0.03, 0.004, 0.004), 20);
    pin.rotateX(Math.PI / 2);
    g.add(meshAt(pin, darkSteel(), sx * R, 0, 0));
  }
  setMM(g, { kind: 'yoke', pins: [[-R, 0, 0], [R, 0, 0]] });
  return g;
}

/**
 * 뒤판에서 나온 안내 블록: 원점 = 안내 구멍 중심(x, y, z 는 모델이 position 으로). 뒤판 앞면까지의 거리 back 만큼 팔이 뒤로 뻗는다.
 * 구멍 = 가로 w × 세로 h 의 네모(막대가 지나감), 블록 x 두께 0.1
 */
export function wallGuide(w: number, h: number, back: number, axis: 'x' | 'y' = 'x'): THREE.Group {
  const g = new THREE.Group();
  const body = castIron();
  const t = 0.035; // 벽 두께
  const lx = axis === 'x' ? 0.1 : w + 2 * t;
  const ly = axis === 'x' ? h + 2 * t : 0.1;
  const dz = 0.1;
  if (axis === 'x') {
    g.add(meshAt(new THREE.BoxGeometry(lx, t, dz), body, 0, h / 2 + t / 2, 0));
    g.add(meshAt(new THREE.BoxGeometry(lx, t, dz), body, 0, -h / 2 - t / 2, 0));
    g.add(meshAt(new THREE.BoxGeometry(lx, ly, 0.02), body, 0, 0, -dz / 2 - 0.01));
  } else {
    g.add(meshAt(new THREE.BoxGeometry(t, ly, dz), body, w / 2 + t / 2, 0, 0));
    g.add(meshAt(new THREE.BoxGeometry(t, ly, dz), body, -w / 2 - t / 2, 0, 0));
    g.add(meshAt(new THREE.BoxGeometry(lx, ly, 0.02), body, 0, 0, -dz / 2 - 0.01));
  }
  // 뒤판까지의 팔 + 벽판
  const armLen = back - dz / 2 - 0.02;
  g.add(meshAt(new THREE.BoxGeometry(0.07, 0.07, armLen), body, 0, 0, -dz / 2 - 0.02 - armLen / 2));
  g.add(meshAt(new THREE.BoxGeometry(0.2, 0.2, 0.03), body, 0, 0, -back + 0.015));
  setMM(g, { kind: 'guide', axis, w, h });
  return g;
}

// ════════════════════════════ 085 캠으로 들어 올리는 낙하 막대 ════════════════════════════

/** 085 치수. 좌표 원점 = 캠 축 중심 */
export const K85 = {
  /** 인벌류트 기초원 반지름(= 캠 축에서 들어 올리는 세로선까지의 거리) */
  RB: 0.2,
  /** 와이퍼 끝 반지름, 허브 반지름 */
  RT: 0.32,
  RH: 0.1,
  /** 돌기 B 밑면의 x 범위(캠 축 기준), 돌기 높이 */
  BX0: -0.27,
  BX1: -0.17,
  BH: 0.07,
  /** 돌기가 쉬는 높이 = RB·T0 (캠 축 위) */
  T0: 0.25,
  /** 떨어지는 데 드는 캠 각(rad) */
  DROP: 0.3,
  /** 막대 A 중심선 x(캠 축 기준), 막대 반폭 */
  ROD_X: -0.224,
  ROD_HW: 0.055
} as const;

/** 인벌류트 끝의 매개변수 */
export const K85_TMAX = Math.sqrt((K85.RT / K85.RB) ** 2 - 1);
/** 와이퍼 끝이 돌기 오른쪽 모서리(BX1)를 벗어나는 캠 각 */
export const K85_BEND = K85_TMAX - Math.atan(K85_TMAX) + Math.acos(-K85.BX1 / K85.RT);
/** 가장 높이 들린 높이(쉬는 자리 기준) */
export const K85_LIFT = Math.sqrt(K85.RT * K85.RT - K85.BX1 * K85.BX1) - K85.RB * K85.T0;

/** 캠 누적각 thetaE(시계 방향으로 돈 각) → 막대의 들린 높이(0 ~ K85_LIFT). 반 바퀴(π)마다 되풀이 */
export function k85Lift(thetaE: number): number {
  const b = thetaE - Math.floor(thetaE / Math.PI) * Math.PI;
  if (b <= K85.T0) return 0;
  if (b <= K85_TMAX) return K85.RB * (b - K85.T0); // 인벌류트: 등속 상승
  if (b <= K85_BEND) return K85.RT * Math.sin(Math.atan(K85_TMAX) + (b - K85_TMAX)) - K85.RB * K85.T0; // 끝 모서리가 밑면을 쓸며 조금 더
  const u = (b - K85_BEND) / K85.DROP;
  return u >= 1 ? 0 : K85_LIFT * (1 - u * u); // 자기 무게로 떨어짐
}

/** 지금 구간: 'rest' 쉼 · 'lift' 들어 올림 · 'drop' 떨어짐 */
export function k85Mode(thetaE: number): 'rest' | 'lift' | 'drop' {
  const b = thetaE - Math.floor(thetaE / Math.PI) * Math.PI;
  if (b <= K85.T0) return 'rest';
  if (b <= K85_BEND) return 'lift';
  return b < K85_BEND + K85.DROP ? 'drop' : 'rest';
}

/** 와이퍼 캠 윤곽(반시계, thetaE = 0 자세. 모델은 rotation.z = −thetaE 로 시계 방향으로 돌린다) */
export function k85CamOutline(): V2[] {
  const pts: V2[] = [];
  const P = (r: number, a: number): V2 => [r * Math.cos(a), r * Math.sin(a)];
  const arm = (g0: number): void => {
    // 일하는 면(인벌류트): 기초원 위 t = 0 → 끝 t = TMAX. 폴라 각은 g0 → g0 + TMAX − atan(TMAX) (반시계로 감)
    // 뿌리는 반지름 방향 선(허브 → 기초원) — 이 선은 언제나 돌기 밑면보다 낮다(RB·sin β < RB·β)
    pts.push(P(K85.RH, g0));
    for (let i = 0; i <= 28; i++) {
      const t = (i / 28) * K85_TMAX;
      const a = g0 + t;
      pts.push([K85.RB * (Math.cos(a) + t * Math.sin(a)), K85.RB * (Math.sin(a) - t * Math.cos(a))]);
    }
    // 등 쪽: 끝 → 허브(오목한 굽이)
    const tip = pts[pts.length - 1]!;
    const tipA = Math.atan2(tip[1], tip[0]);
    const end = P(K85.RH, tipA + 0.95);
    const ctl = P(0.15, tipA + 0.1);
    for (let i = 1; i <= 14; i++) {
      const u = i / 14;
      pts.push([(1 - u) * (1 - u) * tip[0] + 2 * u * (1 - u) * ctl[0] + u * u * end[0], (1 - u) * (1 - u) * tip[1] + 2 * u * (1 - u) * ctl[1] + u * u * end[1]]);
    }
    // 허브 원을 따라 다음 팔의 시작(g0 + π)까지
    const aEnd = tipA + 0.95;
    const aNext = g0 + Math.PI;
    let span = aNext - aEnd;
    while (span < 0) span += TAU;
    while (span >= TAU) span -= TAU;
    for (let i = 1; i < 8; i++) pts.push(P(K85.RH, aEnd + (span * i) / 8));
  };
  arm(Math.PI);
  arm(TAU);
  return pts;
}

/** 돌기 B 윤곽(캠 축 기준, 쉬는 자리) */
export function k85StudOutline(): V2[] {
  const y0 = K85.RB * K85.T0;
  return [
    [K85.BX0, y0],
    [K85.BX1, y0],
    [K85.BX1, y0 + K85.BH],
    [K85.BX0, y0 + K85.BH]
  ];
}

/** 와이퍼 캠(팔 둘): 원점 = 축. rotation.z = −thetaE */
export function wiperCam(thick = 0.07): THREE.Group {
  const g = new THREE.Group();
  const p = plate(k85CamOutline(), [], thick, bronze({ roughness: 0.34 }));
  g.add(p);
  g.userData.outline = p.userData.outline as V2[];
  p.userData.outline = undefined;
  const hub = lathe(tubeProfile(0.05, K85.RH + 0.012, -thick / 2 - 0.012, thick / 2 + 0.012, 0.006), 32);
  hub.rotateX(Math.PI / 2);
  g.add(mesh(hub, darkSteel()));
  setMM(g, { kind: 'cam', arms: 2, rb: K85.RB, rt: K85.RT });
  return g;
}

/**
 * 스탬프 막대 A: 원점 = 캠 축 높이의 막대 중심선(쉬는 자리). 네모 막대(로컬 y: yBottom ~ yTop) + 앞면의 돌기 B + 아래 머리(사다리꼴).
 * 돌기는 막대 앞면(로컬 z = +ROD_HW)에서 앞으로 studLen 만큼 나온다. 모델은 position.y 에 k85Lift 를 더한다.
 * userData.outline = 돌기 B 윤곽(막대 로컬 xy)
 */
export function stampRod(yBottom: number, yTop: number, studLen = 0.11): THREE.Group {
  const g = new THREE.Group();
  const hw = K85.ROD_HW;
  g.add(meshAt(new THREE.BoxGeometry(hw * 2, yTop - yBottom, hw * 2), steel(), 0, (yTop + yBottom) / 2, 0));
  // 돌기 B
  const y0 = K85.RB * K85.T0;
  const bx0 = K85.BX0 - K85.ROD_X;
  const bx1 = K85.BX1 - K85.ROD_X;
  g.add(meshAt(new THREE.BoxGeometry(bx1 - bx0, K85.BH, studLen), darkSteel(), (bx0 + bx1) / 2, y0 + K85.BH / 2, hw + studLen / 2));
  g.userData.outline = [
    [bx0, y0],
    [bx1, y0],
    [bx1, y0 + K85.BH],
    [bx0, y0 + K85.BH]
  ] as V2[];
  // 머리(사다리꼴 쇳덩이): 밑면이 yBottom − 0.25
  const head: V2[] = [
    [-0.225, yBottom - 0.25],
    [0.225, yBottom - 0.25],
    [0.12, yBottom],
    [-0.12, yBottom]
  ];
  g.add(mesh(extrude(shapeFrom(head), 0.26, 0.012), castIron()));
  setMM(g, { kind: 'stamp', headBottom: [0, yBottom - 0.25, 0], stud: [(bx0 + bx1) / 2, y0, hw + studLen / 2] });
  return g;
}

/**
 * 기둥 틀: 원점 = 바닥면, 기둥 왼쪽 면이 x = 0. 기둥(폭 0.11) + 뒤(+x)로 휜 버팀 + 안내 팔 두 개(왼쪽으로 armLen, 높이 armYs).
 * 안내 팔 끝에는 막대(반폭 ROD_HW)가 지나는 네모 구멍. height = 기둥 높이
 */
export function stampFrame(height: number, armLen: number, armYs: [number, number], depth = 0.2): THREE.Group {
  const g = new THREE.Group();
  const body = castIron();
  // 기둥 + 버팀(옆모습 윤곽)
  const pts: V2[] = [
    [0, 0],
    [0.95, 0],
    [0.95, 0.05]
  ];
  for (let i = 0; i <= 16; i++) {
    const u = i / 16;
    // 아래에서 넓고 위로 갈수록 기둥에 붙는 굽이(판화의 휜 등)
    const x = 0.11 + 0.84 * (1 - u) ** 2.6 + 0.2 * Math.sin(Math.PI * u) * (1 - u);
    pts.push([Math.max(0.11, x), 0.05 + (height - 0.05) * u]);
  }
  pts.push([0, height]);
  g.add(mesh(extrude(shapeFrom(pts), depth * 0.5, 0.008), body));
  g.add(meshAt(new THREE.BoxGeometry(0.11, height, depth), body, 0.055, height / 2, 0));
  // 안내 팔: 기둥에서 왼쪽으로, 끝에 네모 구멍(벽 두께 0.035)
  const hw = K85.ROD_HW + 0.004;
  const t = 0.035;
  for (const y of armYs) {
    const xc = -armLen; // 막대 중심선
    g.add(meshAt(new THREE.BoxGeometry(armLen - hw, 0.09, t), body, -(armLen - hw) / 2, y, -hw - t / 2));
    g.add(meshAt(new THREE.BoxGeometry(armLen - hw, 0.09, t), body, -(armLen - hw) / 2, y, hw + t / 2));
    g.add(meshAt(new THREE.BoxGeometry(t, 0.09, 2 * hw + 2 * t), body, xc - hw - t / 2, y, 0));
    g.add(meshAt(new THREE.BoxGeometry(t, 0.09, 2 * hw + 2 * t), body, xc + hw + t / 2, y, 0));
  }
  setMM(g, { kind: 'frame', height, armLen });
  return g;
}

/** 모루(받침쇠): 원점 = 바닥면 중심. 폭 w, 높이 h */
export function anvilBlock(w = 0.56, h = 0.09, d = 0.34): THREE.Mesh {
  const m = mesh(new THREE.BoxGeometry(w, h, d), darkSteel());
  m.position.y = h / 2;
  setMM(m, { kind: 'anvil', top: [0, h / 2, 0] });
  return m;
}
