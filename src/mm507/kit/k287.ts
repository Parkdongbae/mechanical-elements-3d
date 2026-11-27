// 287 피커링 조속기 전용 키트 — 판스프링 셋·공 셋·미끄럼 슬리브·조절 지레·고정 받침과 닫힌 식 운동 state287
// 설계표 docs/mm507-sheets/287.md 의 치수·식을 그대로 옮겼다. 회전 묶음(spin) 로컬: 원점 = 스핀들 축(세계 x 0, z ZC), y = 세계 높이.
import * as THREE from 'three';
import { brass, bronze, castIron, steel } from '../../models/materials';
import { lathe, merge, mesh, sweep, tubeProfile, type V2 } from '../../models/parts/geom';

export const K287 = {
  ZC: 0.275,
  R0: 0.15,
  YA: 2.715,
  L0: 1.30231,
  BMIN: 0.08,
  BMAX: 0.23,
  KB: 0.0625,
  C_TABLE: [1.29016, 1.28692, 1.2833, 1.27929, 1.27488, 1.27009, 1.26491, 1.25932, 1.25334, 1.24696, 1.24017, 1.23297, 1.22536, 1.21733, 1.20888, 1.2] as number[],
  PIVOT: [0.75, 1.235] as V2,
  ARM: 0.75,
  YCROWN: 0.72,
  PINION: [0.24, 0.87] as V2
};

export interface State287 {
  thetaP: number;
  spin: number;
  omegaS: number;
  b: number;
  c: number;
  yB: number;
  gamma: number;
}

/** 스프링 길이 L(b, c) = L0 을 푸는 c (이분법) */
export function chord287(b: number): number {
  const L = (c: number): number => {
    let sum = 0;
    const n = 200;
    for (let k = 0; k < n; k++) {
      const s = (k + 0.5) / n;
      sum += Math.hypot(c, Math.PI * b * Math.sin(2 * Math.PI * s));
    }
    return sum / n;
  };
  let lo = 0.5;
  let hi = K287.L0;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (L(mid) < K287.L0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** 287번 운동식(t = 초, 한 주기 10 초) */
export function state287(t: number): State287 {
  const ph = (2 * Math.PI * t) / 10;
  const thetaP = 2.0 * t - 1.909859 * (Math.cos(ph) - 1);
  const omegaP = 2.0 + 1.2 * Math.sin(ph);
  const omegaS = omegaP / 2;
  const b = K287.BMIN + K287.KB * (omegaS * omegaS - 0.16);
  const c = chord287(b);
  const yB = K287.YA - c;
  const gamma = -Math.asin((yB - 0.235 - K287.PIVOT[1]) / K287.ARM);
  return { thetaP, spin: thetaP / 2 + Math.PI / 2, omegaS, b, c, yB, gamma };
}

// ───────────────────────── 판스프링·공 ─────────────────────────

const SPRING_SEGS = 40;
const SPRING_PROFILE: V2[] = [
  [-0.006, -0.035],
  [0.006, -0.035],
  [0.006, 0.035],
  [-0.006, 0.035]
];

/** 세 띠(120° 간격) 한 지오메트리. 양 끝은 칼라 속으로 0.012 박힘 */
export function springs287(b: number, c: number): THREE.BufferGeometry {
  const path: V2[] = [[K287.R0, K287.YA + 0.012]];
  for (let k = 0; k <= SPRING_SEGS; k++) {
    const s = k / SPRING_SEGS;
    path.push([K287.R0 + b * Math.sin(Math.PI * s) ** 2, K287.YA - c * s]);
  }
  path.push([K287.R0, K287.YA - c - 0.012]);
  const parts: THREE.BufferGeometry[] = [];
  for (let j = 0; j < 3; j++) {
    const phi = (j * 2 * Math.PI) / 3;
    const cs = Math.cos(phi);
    const sn = Math.sin(phi);
    const pts: THREE.Vector3[] = [];
    const ns: THREE.Vector3[] = [];
    const bs: THREE.Vector3[] = [];
    for (let k = 0; k < path.length; k++) {
      const p = path[k]!;
      const a = path[Math.max(0, k - 1)]!;
      const d = path[Math.min(path.length - 1, k + 1)]!;
      const tr = d[0] - a[0];
      const ty = d[1] - a[1];
      const l = Math.hypot(tr, ty) || 1;
      pts.push(new THREE.Vector3(p[0] * cs, p[1], -p[0] * sn));
      ns.push(new THREE.Vector3((ty / l) * cs, -tr / l, -(ty / l) * sn));
      bs.push(new THREE.Vector3(-sn, 0, -cs));
    }
    parts.push(sweep(pts, ns, bs, SPRING_PROFILE, false, true));
  }
  return merge(parts);
}

export function springsMesh287(b: number, c: number): THREE.Mesh {
  const m = mesh(springs287(b, c), steel());
  m.name = 'springs';
  return m;
}

function ballsGeo(b: number, c: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let j = 0; j < 3; j++) {
    const phi = (j * 2 * Math.PI) / 3;
    const rc = K287.R0 + b;
    const g = new THREE.SphereGeometry(1, 32, 20);
    g.scale(0.135, 0.09, 0.11);
    g.rotateY(phi);
    g.translate(rc * Math.cos(phi), K287.YA - c / 2, -rc * Math.sin(phi));
    parts.push(g);
  }
  return merge(parts);
}

export function balls287(): THREE.Mesh {
  const m = mesh(ballsGeo(K287.BMIN, 1.29016), brass());
  m.name = 'balls';
  return m;
}

export function setBalls287(m: THREE.Mesh, b: number, c: number): void {
  m.geometry.dispose();
  m.geometry = ballsGeo(b, c);
}

// ───────────────────────── 슬리브·칼라 ─────────────────────────

/** 슬리브(관 + 플랜지 둘, steel, name sleeve)와 아래 칼라(bronze, name bottomCollar). 원점 = y_B */
export function sleeve287(): THREE.Group {
  const g = new THREE.Group();
  const body = merge([
    lathe(tubeProfile(0.037, 0.06, -0.43, -0.04, 0.004), 48),
    lathe(tubeProfile(0.037, 0.11, -0.2, -0.17, 0.004), 48),
    lathe(tubeProfile(0.037, 0.11, -0.3, -0.27, 0.004), 48)
  ]);
  const s = mesh(body, steel());
  s.name = 'sleeve';
  const col = mesh(lathe(tubeProfile(0.037, 0.18, -0.07, 0, 0.004), 56), bronze());
  col.name = 'bottomCollar';
  g.add(s, col);
  return g;
}

/** 위 칼라(bronze, name topCollar) + 꼭지 너트(brass, name nut). 세계 y 좌표 그대로 */
export function topCollar287(): THREE.Group {
  const g = new THREE.Group();
  const c = mesh(lathe(tubeProfile(0.035, 0.18, 2.715, 2.785, 0.004), 56), bronze());
  c.name = 'topCollar';
  const nut = mesh(
    lathe(
      [
        [0, 2.783],
        [0.07, 2.783],
        [0.07, 2.81],
        [0.045, 2.84],
        [0.06, 2.87],
        [0.03, 2.9],
        [0, 2.9]
      ],
      40
    ),
    brass()
  );
  nut.name = 'nut';
  g.add(c, nut);
  return g;
}

// ───────────────────────── 조절 지레 ─────────────────────────

const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): THREE.BufferGeometry => {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
};

/** 조절 지레 한 메시(name forkLever). 원점 = 받침 핀, 지레는 −x 로 뻗음 */
export function forkLever287(): THREE.Mesh {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(box(-0.55, -0.035, -0.025, 0.025, -0.02, 0.02));
  parts.push(box(0.035, 0.25, -0.025, 0.025, -0.02, 0.02));
  const eye = lathe(tubeProfile(0.022, 0.045, -0.022, 0.022, 0.003), 32);
  eye.rotateX(Math.PI / 2);
  parts.push(eye);
  parts.push(box(-0.58, -0.535, -0.022, 0.022, -0.153, 0.153));
  for (const sg of [1, -1]) {
    const z0 = sg > 0 ? 0.125 : -0.155;
    parts.push(box(-0.77, -0.53, -0.025, 0.025, z0, z0 + 0.03));
    const pin = lathe([[0, 0], [0.02, 0], [0.02, 0.055], [0, 0.055]], 20);
    pin.rotateX(Math.PI / 2);
    if (sg > 0) pin.translate(-0.75, 0, 0.075);
    else {
      pin.rotateX(Math.PI);
      pin.translate(-0.75, 0, -0.075);
    }
    parts.push(pin);
  }
  const m = mesh(merge(parts), steel());
  m.name = 'forkLever';
  return m;
}

// ───────────────────────── 고정 받침 ─────────────────────────

/** 베어링 링·피니언 축 링·지레 받침(castIron, 뒤판 팔). 세계 좌표 그대로 */
export function frame287(): THREE.Group {
  const g = new THREE.Group();
  const ZC = K287.ZC;
  const zBack = -0.3;
  const ringY = (y0: number, y1: number): THREE.BufferGeometry => {
    const r = lathe(tubeProfile(0.038, 0.08, y0, y1, 0.004), 40);
    r.translate(0, 0, ZC);
    const a = box(-0.045, 0.045, y0 + 0.005, y1 - 0.005, zBack, ZC - 0.045);
    return merge([r, a]);
  };
  const low = mesh(ringY(0.53, 0.59), castIron());
  low.name = 'bearingLow';
  const top = mesh(ringY(2.95, 3.01), castIron());
  top.name = 'bearingTop';
  const ringX = lathe(tubeProfile(0.033, 0.08, -0.035, 0.035, 0.004), 40);
  ringX.rotateZ(-Math.PI / 2);
  ringX.translate(0.8, 0.87, ZC);
  const armX = box(0.775, 0.825, 0.84, 0.9, zBack, ZC - 0.045);
  const pb = mesh(merge([ringX, armX]), castIron());
  pb.name = 'pinionBearing';
  const post = box(0.7, 0.8, 1.19, 1.28, zBack, 0.22);
  const pin = lathe([[0, 0.21], [0.02, 0.21], [0.02, 0.33], [0, 0.33]], 20);
  pin.rotateX(Math.PI / 2);
  pin.translate(K287.PIVOT[0], K287.PIVOT[1], 0);
  const lp = mesh(merge([post, pin]), castIron());
  lp.name = 'leverPost';
  g.add(low, top, pb, lp);
  return g;
}
