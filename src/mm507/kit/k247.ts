// 247번 측연추 분리 장치 전용 키트 — 반쪽 회전체(뒤 반쪽 + 잘린 면), 막대 아래 몸·걸쇠·밀대·공·판 스프링, 상태 닫힌 식. 설계표 docs/mm507-sheets/247.md
import * as THREE from 'three';
import { darkSteel, paint, steel } from '../../models/materials';
import { circlePath, extrude, lathe, mesh, rodProfile, shapeFrom, type V2 } from '../../models/parts/geom';

export const K247 = {
  ZC: 0.17,
  ROD_R: 0.1375,
  BALL_R: 0.41,
  HOLE_R: 0.145,
  BALL_C: 0.7747,
  BALL_REST: 0.6835,
  PIVOT: [0.06, 0.56] as [number, number],
  STROKE: 0.03316,
  DELTA_MAX: 22,
  DELTA_WALL: 16.21,
  MUD: 0.3,
  FOOT: -0.26,
  PEN: 0.06,
  Y_TOP: 1.2,
  PERIOD: 14
};

/** 걸쇠 윤곽(핀 기준, δ 0) */
export const CATCH247: [number, number][] = [
  [-0.11, -0.015], [-0.03, -0.015], [0.09, -0.235], [0.145, -0.235], [0.145, -0.205], [0.105, -0.205],
  [0.03, -0.07], [0.03, 0.02], [-0.065, 0.235], [-0.1, 0.225], [-0.03, 0.015], [-0.11, 0.015]
];

const ss = (x: number): number => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};

/** 밀대가 걸쇠 팔 밑을 밀어 올려야 하는 높이 s(δ) */
export function sOfDelta247(deg: number): number {
  const d = (deg * Math.PI) / 180;
  return (0.085 * Math.sin(d) - 0.015) / Math.cos(d) + 0.015;
}

export interface State247 {
  tc: number;
  Yr: number;
  s: number;
  delta: number;
  ballY: number;
  ballOpacity: number;
  mud: number;
  mudOpacity: number;
  phase: string;
}

/** 시간표(설계표 「구동」) — 14 초 주기 */
export function state247(t: number): State247 {
  const P = K247.PERIOD;
  const tc = ((t % P) + P) % P;
  const { STROKE: S, BALL_C: BC, BALL_REST: BR, Y_TOP: TOP, PEN, DELTA_MAX, DELTA_WALL } = K247;
  const YR_HIT = 0.56;
  const YR_PEN = YR_HIT - PEN;
  let Yr = TOP;
  let s = 0;
  let delta = 0;
  let ballY = TOP + BC;
  let mud = 0;
  let ballOpacity = 1;
  let mudOpacity = 1;
  let phase = '내려감';
  if (tc < 4) {
    Yr = TOP - ((TOP - YR_HIT) * tc) / 4;
    ballY = Yr + BC;
  } else if (tc < 4.6) {
    const u = (tc - 4) / 0.6;
    Yr = YR_HIT - PEN * u;
    mud = PEN * u;
    ballY = Yr + BC;
    phase = '바닥에 닿음';
  } else if (tc < 5.2) {
    const u = ss((tc - 4.6) / 0.6);
    delta = DELTA_MAX * u;
    s = sOfDelta247(delta);
    Yr = YR_PEN - s;
    mud = PEN;
    ballY = Yr + BC;
    phase = '걸쇠 빠짐';
  } else if (tc < 7) {
    Yr = YR_PEN - S;
    s = S;
    delta = DELTA_MAX;
    mud = PEN;
    phase = '추 떨어짐';
    if (tc < 5.7) {
      const u = (tc - 5.2) / 0.5;
      const top = Yr + BC;
      ballY = top - (top - BR) * u * u;
    } else ballY = BR;
  } else if (tc < 7.3) {
    const f = (tc - 7) / 0.3;
    Yr = YR_PEN - S + S * f;
    s = S * (1 - f);
    delta = DELTA_MAX - (DELTA_MAX - DELTA_WALL) * f;
    mud = PEN;
    ballY = BR;
    phase = '시료 들고 올라옴';
  } else if (tc < 11) {
    const u = ss((tc - 7.3) / 3.7);
    Yr = YR_PEN + (TOP - YR_PEN) * u;
    s = 0;
    delta = Yr < 0.782 ? DELTA_WALL : DELTA_WALL * (1 - ss((Yr - 0.782) / 0.05));
    mud = PEN;
    ballY = BR;
    phase = '시료 들고 올라옴';
  } else if (tc < 12) {
    mud = PEN;
    ballY = BR;
    ballOpacity = 1 - (tc - 11);
    phase = '다시';
  } else if (tc < 13) {
    mud = PEN;
    ballOpacity = tc - 12;
    mudOpacity = 1 - (tc - 12);
    phase = '다시';
  } else phase = '다시';
  return { tc, Yr, s, delta, ballY, ballOpacity, mud, mudOpacity, phase };
}

function area(p: V2[]): number {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const q = p[(i + 1) % p.length]!;
    a += p[i]![0] * q[1] - q[0] * p[i]![1];
  }
  return a / 2;
}

/**
 * 뒤 반쪽 회전체 + 잘린 면 두 조각(z 0 평면, 앞을 보게). 윤곽은 닫힌 (r, y) 다각형.
 * 회전체는 바깥 법선이 나오게 윤곽 방향(반시계)을 맞춘다.
 */
export function halfLathe247(profile: [number, number][], segs: number, body: THREE.Material, cut: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const prof: V2[] = area(profile) < 0 ? [...profile].reverse() : [...profile];
  g.add(mesh(lathe(prof, segs, Math.PI / 2, Math.PI), body));
  cut.side = THREE.DoubleSide;
  const right = new THREE.ShapeGeometry(shapeFrom(profile));
  const left = new THREE.ShapeGeometry(shapeFrom([...profile].reverse().map(([r, y]) => [-r, y] as V2)));
  g.add(mesh(right, cut), mesh(left, cut));
  return g;
}

/** 단면 위에 겹쳐 그려지게 하는 재질 보정(잘린 면끼리 같은 평면일 때) */
export function cutOver247(m: THREE.Material): THREE.Material {
  m.polygonOffset = true;
  m.polygonOffsetFactor = -2;
  m.polygonOffsetUnits = -2;
  return m;
}

const quad = (x0: number, y0: number, x1: number, y1: number, z: number, mat: THREE.Material): THREE.Mesh => {
  const m = mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), mat);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, z);
  return m;
};
const quadX = (x: number, y0: number, y1: number, z0: number, z1: number, mat: THREE.Material): THREE.Mesh => {
  const m = mesh(new THREE.PlaneGeometry(z1 - z0, y1 - y0), mat);
  m.rotation.y = Math.PI / 2;
  m.position.set(x, (y0 + y1) / 2, (z0 + z1) / 2);
  return m;
};
const quadY = (y: number, x0: number, x1: number, z0: number, z1: number, mat: THREE.Material): THREE.Mesh => {
  const m = mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
  return m;
};

/** 막대 아래 몸(y 0~1.25): 뒤 반쪽 + 잘린 면 두 조각(창·밀대 홈은 비움) + 창 홈 바닥·옆벽 */
export function rodLower247(): THREE.Group {
  const g = new THREE.Group();
  const R = K247.ROD_R;
  g.add(mesh(lathe(rodProfile(R, 0, 1.25), 32, Math.PI / 2, Math.PI), steel()));
  const cut = cutOver247(paint(0xd99a3a));
  cut.side = THREE.DoubleSide;
  const left: V2[] = [[-R, 0], [-0.047, 0], [-0.047, 0.19], [-0.065, 0.19], [-0.065, 1.055], [R, 1.055], [R, 1.25], [-R, 1.25]];
  const right: V2[] = [[-0.003, 0], [R, 0], [R, 0.19], [-0.003, 0.19]];
  g.add(mesh(new THREE.ShapeGeometry(shapeFrom(left)), cut), mesh(new THREE.ShapeGeometry(shapeFrom(right)), cut));
  const wall = paint(0x9a6a2a);
  wall.side = THREE.DoubleSide;
  const xr = 0.133; // 막대 표면(z −0.03 에서 x 0.134) 안쪽
  g.add(quad(-0.065, 0.19, xr, 1.055, -0.03, wall)); // 창 바닥
  g.add(quad(-0.047, 0, -0.003, 0.19, -0.025, wall)); // 밀대 홈 바닥
  g.add(quadX(-0.065, 0.19, 1.055, -0.03, 0, wall));
  g.add(quadY(1.055, -0.065, xr, -0.03, 0, wall));
  g.add(quadY(0.19, -0.065, -0.047, -0.03, 0, wall));
  g.add(quadY(0.19, -0.003, xr, -0.03, 0, wall));
  g.add(quadX(-0.047, 0, 0.19, -0.025, 0, wall));
  g.add(quadX(-0.003, 0, 0.19, -0.025, 0, wall));
  return g;
}

/** 측연추 공: 뒤 반쪽 + 잘린 면. 위치 = 공 중심, 재질은 투명 가능 */
export function ball247(): THREE.Group {
  const R = K247.BALL_R;
  const yl = Math.sqrt(R * R - K247.HOLE_R * K247.HOLE_R);
  const prof: [number, number][] = [];
  const n = 24;
  for (let i = 0; i < n; i++) {
    const y = -yl + (2 * yl * i) / (n - 1);
    prof.push([Math.sqrt(Math.max(0, R * R - y * y)), y]);
  }
  const g = halfLathe247(prof, 40, paint(0x8a94a3), paint(0xc8553d));
  g.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | undefined;
    if (m) m.transparent = true;
  });
  return g;
}

/** 걸쇠: 핀 기준 윤곽 압출(z −0.025~0.025). 윤곽은 userData.outline */
export function catch247(): THREE.Mesh {
  const sh = shapeFrom(CATCH247);
  sh.holes.push(circlePath(0, 0, 0.0155)); // 핀 구멍
  const m = mesh(extrude(sh, 0.05, 0.003), paint(0xf2b619));
  m.userData.outline = CATCH247;
  return m;
}

/** 밀대(원점 = 막대 속 중심선, s 일 때 위로 s): 대·멈춤 고리·머리·컵(foot)·진흙(sample) */
export function plunger247(): THREE.Group {
  const g = new THREE.Group();
  const stem = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.705, 20), steel());
  stem.position.y = 0.1825;
  const ring = mesh(new THREE.BoxGeometry(0.06, 0.02, 0.05), steel());
  ring.position.y = 0.2;
  const head = mesh(new THREE.BoxGeometry(0.05, 0.02, 0.05), steel());
  head.position.y = 0.535;
  g.add(stem, ring, head);
  const cup = cutOver247(paint(0xe0c050));
  const foot = halfLathe247([[0, -0.16], [0.09, -0.16], [0.09, -0.26], [0.07, -0.26], [0.07, -0.18], [0, -0.18]], 28, steel(), cup);
  foot.name = 'foot';
  g.add(foot);
  // 진흙 시료: 반지름 0.068 뒤 반쪽 반원기둥(높이 1 을 y 로 늘림) + 잘린 면
  const sample = new THREE.Group();
  sample.name = 'sample';
  const mudBody = paint(0x7a5a3a);
  mudBody.transparent = true;
  const mudCut = cutOver247(paint(0x5e4630));
  mudCut.transparent = true;
  mudCut.side = THREE.DoubleSide;
  const half = new THREE.CylinderGeometry(0.068, 0.068, 1, 24, 1, false, Math.PI / 2, Math.PI);
  half.translate(0, 0.5, 0);
  const face = new THREE.PlaneGeometry(0.136, 1);
  face.translate(0, 0.5, 0);
  sample.add(mesh(half, mudBody), mesh(face, mudCut));
  sample.position.y = K247.FOOT;
  g.add(sample);
  return g;
}

/** 판 스프링: (0.01, 1.055) → 조절점 (0.075, 0.95) → 걸쇠 위 팔 끝 U(δ) 의 2차 베지에 관 */
export function spring247(deltaDeg: number): THREE.TubeGeometry {
  const [px, py] = K247.PIVOT;
  const a = (-deltaDeg * Math.PI) / 180;
  const vx = -0.0825;
  const vy = 0.23;
  const ux = px + vx * Math.cos(a) - vy * Math.sin(a);
  const uy = py + vx * Math.sin(a) + vy * Math.cos(a);
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0.01, 1.055, 0), new THREE.Vector3(0.075, 0.95, 0), new THREE.Vector3(ux, uy, 0));
  return new THREE.TubeGeometry(curve, 24, 0.008, 6, false);
}

export const catchPinGeo247 = (): THREE.BufferGeometry => {
  const geo = new THREE.CylinderGeometry(0.015, 0.015, 0.07, 16);
  geo.rotateX(Math.PI / 2);
  return geo;
};

export const pinMat247 = darkSteel;
