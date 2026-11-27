// 213번 다른 종류의 멈추개 전용 키트 — 홈 6개 멈춤 원판 B, 비스듬한 톱니바퀴(핀 하나), 바퀴 수 표시등, 닫힌 식 상태
// 설계표 docs/mm507-sheets/213.md 의 수치 그대로. 윤곽 60 점은 표를 그대로 쓴다.
import * as THREE from 'three';
import { brass, darkSteel, paint, steel } from '../../models/materials';
import { extrude, lathe, mesh, rodProfile, stadiumShape, type V2 } from '../../models/parts/geom';

const TAU = Math.PI * 2;
const D2R = Math.PI / 180;

export const K213 = {
  OA: [0, 1.35] as const, // 아래 톱니바퀴 중심(제네바 배치: 핀이 홈에 깊이 들어가도록 B 에 가깝게)
  OB: [0, 2.3] as const, // B 중심
  d: 0.95,
  rf: 0.148613, // 핀 회전 반지름 = d·sin9°
  Re: 0.938304, // 핀이 홈에 수직으로 들어서는 거리 = d·cos9°
  pinR: 0.05,
  hw: 0.0555, // 홈 반폭 (핀과 틈 0.0055)
  Rl: 0.877, // 홈 줄 호 반지름
  Rh: 0.947, // 높은 테 반지름
  bottom: 0.7424, // 홈 바닥 반지름
  half: 81, // 핀이 홈 속에 있는 구간 ±(도)
  beta0: 54,
  alphaB: -166.0,
  alphaF: 2146.0,
  omega: 3.0, // rad/s
  hold: 1.5,
  zA: [0.02, 0.08] as const,
  zB: [0.1, 0.16] as const,
  zPin: [0.08, 0.17] as const
} as const;
const K = K213;
const WIND_DEG_S = K.omega / D2R; // 171.887°/s
const TW = (K.alphaF - K.alphaB) / WIND_DEG_S; // 한 방향 시간
const T_CYCLE = 2 * (TW + K.hold);

/** B 윤곽(로컬, 반시계): 높은 테 333°→207°, 낮은 호 207°→333° 에 홈 6개(가운데 225°+18°·i) */
function outlineB213(): V2[] {
  const pts: V2[] = [];
  const at = (phi: number, a: number, l: number): V2 => {
    const c = Math.cos(phi * D2R);
    const s = Math.sin(phi * D2R);
    return [a * c - l * s, a * s + l * c];
  };
  for (let a = 333; a <= 567.001; a += 3) pts.push([K.Rh * Math.cos(a * D2R), K.Rh * Math.sin(a * D2R)]);
  const arcA = Math.asin(K.hw / K.Rl) / D2R;
  const aa = Math.sqrt(K.Rl * K.Rl - K.hw * K.hw);
  const lowArc = (from: number, to: number): void => {
    for (let x = from; x < to - 1e-9; x += 3) pts.push([K.Rl * Math.cos(x * D2R), K.Rl * Math.sin(x * D2R)]);
  };
  let cur = 207;
  for (let i = 0; i < 6; i++) {
    const s = 225 + 18 * i;
    lowArc(cur, s - arcA);
    pts.push(at(s, aa, -K.hw), at(s, K.bottom, -K.hw), at(s, K.bottom, K.hw), at(s, aa, K.hw));
    cur = s + arcA;
  }
  lowArc(cur, 333);
  pts.push([K.Rl * Math.cos(333 * D2R), K.Rl * Math.sin(333 * D2R)]);
  return pts;
}
export const OUTLINE_B213: V2[] = outlineB213();

const shapeOf = (pts: V2[]): THREE.Shape => {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
  s.closePath();
  return s;
};
const holeAt = (x: number, y: number, r: number): THREE.Path => {
  const h = new THREE.Path();
  h.absarc(x, y, r, 0, TAU, true);
  return h;
};
const cylZ = (r: number, z0: number, z1: number, c = 0.004, seg = 40): THREE.BufferGeometry => {
  const g = lathe(rodProfile(r, 0, z1 - z0, c, c), seg);
  g.rotateX(Math.PI / 2);
  g.translate(0, 0, z0);
  return g;
};

/** 멈춤 원판 B: 원점 = B 축, 이름 `stopWheel`, 계단 표지 `stepF`·`stepB`(userData.mat = 재질) */
export function stopWheel213(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'stopWheel';
  const [z0, z1] = K.zB;
  const shape = shapeOf(OUTLINE_B213);
  shape.holes.push(holeAt(0, 0, 0.05));
  const body = mesh(extrude(shape, z1 - z0, 0.005, 8), brass());
  body.position.z = (z0 + z1) / 2;
  g.add(body);
  g.userData.outline = OUTLINE_B213;
  // 가운데 돋움(반지름 0.43, z 0.16~0.175) — 축 구멍 자리를 비움
  const hubShape = new THREE.Shape();
  hubShape.absarc(0, 0, 0.43, 0, TAU, false);
  hubShape.holes.push(holeAt(0, 0, 0.05));
  const hub = mesh(extrude(hubShape, 0.015, 0.003, 48), paint(0xd9c27a));
  hub.position.z = 0.1675;
  g.add(hub);
  // 새긴 줄(판화의 좁은 홈): 로컬 90° 방향 반지름 0.43~0.90, 폭 0.10, 두께 0.004
  const line = mesh(new THREE.BoxGeometry(0.1, 0.47, 0.004), darkSteel());
  line.position.set(0, 0.665, 0.162);
  g.add(line);
  // 계단 표지 2개
  const mk = (name: string, deg: number): void => {
    const mat = paint(0x8a1c1c);
    const m = mesh(new THREE.BoxGeometry(0.06, 0.1, 0.01), mat);
    m.name = name;
    m.position.set(0.84 * Math.cos(deg * D2R), 0.84 * Math.sin(deg * D2R), 0.165);
    m.rotation.z = (deg - 90) * D2R;
    m.userData.mat = mat;
    g.add(m);
  };
  mk('stepF', 336);
  mk('stepB', 204);
  return g;
}

/** 톱니바퀴 윤곽(로컬, 반시계): 비스듬한 톱니 24개, 곧은 면이 각 15°·k */
function sawOutline(): V2[] {
  const out: V2[] = [];
  for (let k = 0; k < 24; k++) {
    const a = 15 * k * D2R;
    out.push([0.62 * Math.cos(a), 0.62 * Math.sin(a)]);
    out.push([0.7 * Math.cos(a), 0.7 * Math.sin(a)]);
  }
  return out;
}

/** 아래 톱니바퀴: 원점 = A 축, 이름 `ratchet`, 핀 `pin`(로컬 (0.5229, 0)), 손잡이 `key` */
export function sawWheel213(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'ratchet';
  const [z0, z1] = K.zA;
  const shape = shapeOf(sawOutline());
  for (let k = 0; k < 5; k++) {
    const a = (36 + 72 * k) * D2R;
    shape.holes.push(holeAt(0.33 * Math.cos(a), 0.33 * Math.sin(a), 0.09));
  }
  const body = mesh(extrude(shape, z1 - z0, 0.004, 8), steel());
  body.position.z = (z0 + z1) / 2;
  g.add(body);
  // 네모 축 덩이 z 0.00~0.10
  const blk = mesh(new THREE.BoxGeometry(0.16, 0.16, 0.1), darkSteel());
  blk.position.z = 0.05;
  g.add(blk);
  // 핀 z 0.08~0.18
  const pin = mesh(cylZ(0.05, K.zPin[0], K.zPin[1], 0.005, 24), brass());
  pin.name = 'pin';
  pin.position.x = K.rf;
  g.add(pin);
  // 손잡이: 팔 0.30(로컬 −X, z 0.27~0.30) + 둥근 손잡이(반지름 0.035, z 0.30~0.40)
  const key = new THREE.Group();
  key.name = 'key';
  const arm = mesh(extrude(stadiumShape(0, 0, -0.3, 0, 0.04), 0.03, 0.004, 16), darkSteel());
  arm.position.z = 0.285;
  key.add(arm);
  const knob = mesh(cylZ(0.035, 0.3, 0.4, 0.008, 24), paint(0xb3541e));
  knob.position.x = -0.3;
  key.add(knob);
  g.add(key);
  return g;
}

/** 바퀴 수 표시등: 판 + 등 n 개(`lamp1`~). userData.setLit(k) 로 앞 k 개를 켠다 */
export function lamps213(n = 6): THREE.Group {
  const g = new THREE.Group();
  g.name = 'lamps';
  const plate = mesh(new THREE.BoxGeometry(0.16, 1.55, 0.03), paint(0xe8e8e8));
  plate.position.set(1.3, 1.225, -0.285);
  g.add(plate);
  const lamps: THREE.Mesh[] = [];
  for (let i = 1; i <= n; i++) {
    const m = mesh(cylZ(0.045, -0.27, -0.23, 0.004, 24), paint(0x6b6b6b));
    m.name = `lamp${i}`;
    m.position.set(1.3, 0.55 + 0.27 * (i - 1), 0);
    g.add(m);
    lamps.push(m);
  }
  g.userData.setLit = (k: number): void => {
    lamps.forEach((m, i) => {
      const mat = m.material as THREE.MeshPhysicalMaterial;
      const on = i < k;
      mat.color.setHex(on ? 0xffd23a : 0x6b6b6b);
      mat.emissive.setHex(on ? 0x806000 : 0x000000);
    });
  };
  return g;
}

export interface State213 {
  alpha: number;
  beta: number;
  turns: number;
  done: number; // 홈 속을 지나 B 를 민 횟수
  phase: 'wind' | 'holdF' | 'unwind' | 'holdB';
  stopped: 'F' | 'B' | null;
}

/** 핀(A 로컬 α°)의 B 중심 기준 위치 */
export function pinRel213(alpha: number): V2 {
  return [K.rf * Math.cos(alpha * D2R), -K.d + K.rf * Math.sin(alpha * D2R)];
}

/** B 각(도) — 핀이 k 번째 홈(α = 90 + 360k ± 81°) 속에 있을 때만 핀 방향으로 홈을 풀고, 그 밖에서는 정지 */
export function betaOf213(alpha: number): number {
  const k = Math.round((alpha - 90) / 360);
  const ac = 90 + 360 * k;
  if (k < 0) return K.beta0;
  if (k > 5) return K.beta0 - 108;
  const base = K.beta0 - 18 * k;
  if (alpha < ac - K.half) return base;
  if (alpha > ac + K.half) return base - 18;
  const [x, y] = pinRel213(alpha);
  return base + Math.atan2(y, x) / D2R + 81;
}

/** 시각 t(초) → 상태. α·β 는 도 */
export function state213(t: number): State213 {
  const u = ((t % T_CYCLE) + T_CYCLE) % T_CYCLE;
  const aB = K.alphaB;
  const aF = K.alphaF;
  let alpha: number;
  let phase: State213['phase'];
  if (u < TW) {
    alpha = aB + WIND_DEG_S * u;
    phase = 'wind';
  } else if (u < TW + K.hold) {
    alpha = aF;
    phase = 'holdF';
  } else if (u < 2 * TW + K.hold) {
    alpha = aF - WIND_DEG_S * (u - TW - K.hold);
    phase = 'unwind';
  } else {
    alpha = aB;
    phase = 'holdB';
  }
  return { alpha, beta: betaOf213(alpha), turns: (alpha - aB) / 360, done: Math.max(0, Math.min(6, Math.floor((alpha - 90 - K.half) / 360) + 1)), phase, stopped: phase === 'holdF' ? 'F' : phase === 'holdB' ? 'B' : null };
}
