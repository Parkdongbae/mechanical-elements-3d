// 165번 전용 키트 — 물결 캠(수직 축)과 흔들막대·수직 막대
//  캠: 수직 축에 꽂힌 둥근 판 + 아래로 드리운 테. 테의 아랫가장자리가 물결(5 마루 — 넓은 골 + 둥근 코). 축과 함께 돈다.
//  흔들막대: 받침점 F(고정 핀)에 걸린 곧은 막대. 오른끝 굴림대가 캠 테 아랫가장자리 앞쪽 점에 아래에서 닿고,
//  왼끝 긴 홈에 수직 막대의 핀이 든다. 수직 막대는 안내 둘 사이에서 위아래로만 움직인다.
//  수직 막대의 무게가 왼끝을 눌러 굴림대가 늘 물결에 닿는다.
//  pose165(theta): 캠 각 phi = theta(닫힌 식), 굴림대 높이는 물결 면에서 바로 계산 → 주기 2π/5 로 닫힌다.
//  굴림대 r 0.12(판화 비례 — 캠 반지름의 약 1/4). 골(위로 오목) 곡률 반지름 ≥ 0.15 > 0.12 라 굴림대가 골 바닥까지 닿는다.
import * as THREE from 'three';
import { castIron, darkSteel, paint, steel } from '../../models/materials';
import { extrude, hexPrism, lathe, mesh, rodProfile, stadiumShape, tubeProfile } from '../../models/parts/geom';
import type { V2 } from '../../models/parts/geom';
import { STAGE } from './stand';
import { markPin, setMM } from './mm';

export const K165 = {
  AX: 0.7, // 캠 축 x
  ZC: 0.25, // 캠 축 z
  R: 0.45, // 테 바깥 반지름
  Ri: 0.39, // 테 안 반지름
  Rm: 0.42, // 테 두께 가운데
  plateTop: 2.35, // 판 윗면
  plateBot: 2.3, // 판 아랫면(= 테 윗끝)
  ym: 2.09, // 물결 가운데 높이
  a: 0.07, // 물결 크기 (edge = ym + a·(cos u − b·cos 2u), u = n·ψ → ym −0.081 ~ +0.060)
  b: 0.15, // 골을 넓히고 코를 좁히는 2차 항
  n: 5, // 물결 마루 수
  shaftR: 0.05,
  shaftTop: 3.05,
  shaftBot: 1.45,
  bearUp: 2.85, // 위 받침 높이
  bearLo: 1.6, // 아래 받침 높이
  rr: 0.12, // 굴림대 반지름
  zRoll: 0.67, // 굴림대 가운데 z (두께 0.05)
  zRod: 0.73, // 흔들막대 가운데 z (두께 0.04)
  zBar: 0.66, // 수직 막대 가운데 z (네모 0.06)
  Fx: -0.5, // 받침점
  Fy: 1.54,
  Lr: 1.262, // 받침점 → 굴림대 축
  xb: -1.38, // 수직 막대 x
  barUp: 0.1, // 핀 → 막대 위 끝
  barDown: 0.9, // 핀 → 막대 아래 끝
  guideY: [1.02, 0.58] as const,
  clr: 0.003, // 굴림대 — 물결 틈
} as const;

/** 테 아랫가장자리 높이(캠 로컬 각 ψ — 로컬 점 = (r·sinψ, y, r·cosψ)) */
export function edge165(psi: number): number {
  const u = K165.n * psi;
  return K165.ym + K165.a * (Math.cos(u) - K165.b * Math.cos(2 * u));
}

/**
 * 굴림대 가운데 x 가 축에서 ox 떨어졌을 때 물결 면에 닿는 굴림대 가운데 높이.
 * 굴림대 원(반지름 rr)의 윗반원 각 점(dx)과 굴림대 두께(z) 안의 테 아랫면 높이를 세계 각 atan2 로 정확히 읽어
 * min(물결 − √(rr² − dx²)) — 굴림대 중심 궤적(물결 면의 rr 오프셋) 위의 점.
 */
export function rollY165(phi: number, ox: number, m = 48, mz = 5): number {
  const { rr, clr, zRoll, ZC, R, Ri } = K165;
  let best = Infinity;
  for (let j = 0; j < mz; j++) {
    const zr = zRoll - 0.025 + (0.05 * j) / (mz - 1) - ZC;
    for (let i = 0; i <= m; i++) {
      const dx = -rr + (2 * rr * i) / m;
      const xs = ox + dx;
      const r = Math.hypot(xs, zr);
      if (r < Ri || r > R) continue;
      const y = edge165(Math.atan2(xs, zr) - phi) - Math.sqrt(Math.max(0, rr * rr - dx * dx));
      if (y < best) best = y;
    }
  }
  return best - clr;
}

export interface Pose165 {
  /** 캠 각(rotation.y) */
  phi: number;
  /** 흔들막대 각(rotation.z, 받침점 → 굴림대 방향) */
  beta: number;
  /** 굴림대 가운데(세계 x, y) */
  roll: V2;
  /** 수직 막대 핀 높이 */
  pinY: number;
  /** 굴림대 자전 각 */
  spin: number;
}

/** 모든 자세의 닫힌 식 — 캠 각에서 굴림대 높이(물결), 그 높이에서 막대 각을 고정점 반복 4회로 */
export function pose165(theta: number): Pose165 {
  const { Fx, Fy, Lr, AX, xb, Rm, rr } = K165;
  const phi = theta;
  let beta = Math.asin((K165.ym - K165.a - rr - Fy) / Lr);
  let x = Fx + Lr * Math.cos(beta);
  let y = Fy + Lr * Math.sin(beta);
  for (let k = 0; k < 6; k++) {
    x = Fx + Lr * Math.cos(beta);
    y = rollY165(phi, x - AX);
    beta = Math.asin(Math.max(-1, Math.min(1, (y - Fy) / Lr)));
  }
  x = Fx + Lr * Math.cos(beta);
  y = Fy + Lr * Math.sin(beta);
  return { phi, beta, roll: [x, y], pinY: Fy + (xb - Fx) * Math.tan(beta), spin: (phi * Rm) / rr };
}

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}
function cylZ(r: number, z0: number, z1: number, c = 0.005, segs = 24): THREE.BufferGeometry {
  const g = lathe(rodProfile(r, z0, z1, c, c), segs);
  g.rotateX(Math.PI / 2);
  return g;
}
function tubeZ(rIn: number, rOut: number, z0: number, z1: number, c = 0.005, segs = 36): THREE.BufferGeometry {
  const g = lathe(tubeProfile(rIn, rOut, z0, z1, c), segs);
  g.rotateX(Math.PI / 2);
  return g;
}
function pinMark(name: string, x: number, y: number, z: number): THREE.Object3D {
  const o = new THREE.Object3D();
  o.name = name;
  o.position.set(x, y, z);
  return markPin(o);
}

/**
 * 물결 캠 + 수직 축(한 몸). group 원점 = (AX, 0, ZC) — 로컬 y = 세계 y. rotation.y = phi.
 * 판 r 0.45 (y 2.30~2.35), 테 r 0.39~0.45 (아랫가장자리 = edge165(ψ), 2.009~2.150), 허브 r 0.1 (2.35~2.45),
 * 축 r 0.05 (y 1.45~3.05, 아래 끝 뾰족), 위 받침 위의 깃 (2.91~2.95), 판 위 노랑 표시.
 */
export function waveCam165(): THREE.Group {
  const { R, Ri, plateBot, plateTop, n: _n } = K165;
  void _n;
  const g = new THREE.Group();
  const N = 480;
  const pos: number[] = [];
  const idx: number[] = [];
  const ring = (r: number, outward: boolean): void => {
    const base = pos.length / 3;
    for (let i = 0; i <= N; i++) {
      const psi = (i / N) * Math.PI * 2;
      const s = Math.sin(psi);
      const c = Math.cos(psi);
      pos.push(r * s, edge165(psi), r * c, r * s, plateBot + 0.002, r * c);
    }
    for (let i = 0; i < N; i++) {
      const a = base + i * 2;
      if (outward) idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      else idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  };
  ring(R, true);
  ring(Ri, false);
  // 아랫가장자리 띠(물결)
  const base = pos.length / 3;
  for (let i = 0; i <= N; i++) {
    const psi = (i / N) * Math.PI * 2;
    const s = Math.sin(psi);
    const c = Math.cos(psi);
    const y = edge165(psi);
    pos.push(Ri * s, y, Ri * c, R * s, y, R * c);
  }
  for (let i = 0; i < N; i++) {
    const a = base + i * 2;
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const iron = castIron();
  iron.side = THREE.DoubleSide;
  g.add(mesh(geo, iron));
  // 판
  g.add(mesh(lathe(rodProfile(R, plateBot, plateTop, 0.004, 0.01), 72), castIron()));
  // 허브
  g.add(mesh(lathe(rodProfile(0.1, plateTop - 0.005, plateTop + 0.1, 0, 0.012), 40), darkSteel()));
  // 축(아래 끝 뾰족)
  const sp: V2[] = [
    [0, K165.shaftBot],
    [0.02, K165.shaftBot + 0.03],
    [K165.shaftR, K165.shaftBot + 0.08],
    [K165.shaftR, K165.shaftTop - 0.012],
    [K165.shaftR - 0.012, K165.shaftTop],
    [0, K165.shaftTop],
  ];
  g.add(mesh(lathe(sp, 32), steel()));
  // 깃(위 받침 위에 얹혀 축의 높이를 잡는다) · 아래 깃(아래 받침 밑)
  g.add(mesh(lathe(rodProfile(0.08, K165.bearUp + 0.05, K165.bearUp + 0.09, 0.006, 0.006), 32), darkSteel()));
  g.add(mesh(lathe(rodProfile(0.08, K165.bearLo - 0.09, K165.bearLo - 0.05, 0.006, 0.006), 32), darkSteel()));
  // 판 윗면 표시(돌림이 보이게)
  g.add(meshAt(new THREE.BoxGeometry(0.03, 0.006, 0.22), paint(0xf2b619), 0, plateTop + 0.003, 0.27));
  g.add(pinMark('camMark', 0, plateTop, 0.3));
  setMM(g, { kind: 'cam', axis: 'y', R, waves: K165.n, amp: K165.a, fn: 'waveCam165' });
  return g;
}

/**
 * 수직 축 받침(고정). group 원점 = 링 가운데(축 위) — 모델은 (AX, y, ZC) 에 놓는다.
 * 링: 구멍 Y 방향(축 0.05 + 틈 0.004), 바깥 0.1, 높이 0.1. 팔: 뒤판 앞면에서 링 바깥면까지.
 */
export function shaftBearing165(): THREE.Group {
  const g = new THREE.Group();
  const ro = 0.1;
  g.add(mesh(lathe(tubeProfile(K165.shaftR + 0.004, ro, -0.05, 0.05, 0.008), 36), darkSteel()));
  const z0 = STAGE.backZ - K165.ZC;
  const z1 = -ro + 0.004;
  g.add(meshAt(new THREE.BoxGeometry(0.12, 0.07, z1 - z0), castIron(), 0, 0, (z0 + z1) / 2));
  setMM(g, { kind: 'pillow', axis: 'y', bossY: 0, fn: 'shaftBearing165' });
  return g;
}

/**
 * 흔들막대 + 굴림대. group 원점 = 받침점 F (세계 z 0) — 모델은 (Fx, Fy, 0) 에 놓고 rotation.z = beta.
 * 막대 판(두께 0.04, z 0.71~0.75, 반폭 0.03): 로컬 x −1.03 ~ Lr. 받침점 구멍 0.039, 왼끝 긴 홈(로컬 x −0.995 ~ −0.855, 반폭 0.021).
 * 굴림대(child `roller`, r 0.12, z 0.645~0.695)는 로컬 (Lr, 0) 에서 축 핀(r 0.016)에 돈다 — 모델이 roller.rotation.z 를 준다.
 */
export function rockRod165(): { group: THREE.Group; roller: THREE.Group } {
  const { Lr, zRod, zRoll, rr } = K165;
  const g = new THREE.Group();
  const shape = stadiumShape(-1.03, 0, Lr, 0, 0.032);
  shape.holes.push(circleHole(0, 0, 0.039));
  shape.holes.push(circleHole(Lr, 0, 0.017));
  const slot = new THREE.Path();
  const sx0 = -0.995;
  const sx1 = -0.855;
  const w = 0.021;
  slot.moveTo(sx0, -w);
  slot.absarc(sx0, 0, w, -Math.PI / 2, Math.PI / 2, true);
  slot.lineTo(sx1, w);
  slot.absarc(sx1, 0, w, Math.PI / 2, -Math.PI / 2, true);
  slot.closePath();
  shape.holes.push(slot);
  g.add(meshAt(extrude(shape, 0.04, 0.005, 24), steel(), 0, 0, zRod));
  // 굴림대 축 핀(막대에 박힘) + 앞 머리
  g.add(meshAt(cylZ(0.016, zRoll - 0.03, zRod + 0.03), darkSteel(), Lr, 0, 0));
  // 굴림대
  const roller = new THREE.Group();
  roller.position.set(Lr, 0, 0);
  roller.add(mesh(tubeZ(0.019, rr, zRoll - 0.025, zRoll + 0.025, 0.006, 40), darkSteel()));
  roller.add(meshAt(new THREE.BoxGeometry(0.012, 0.03, 0.004), paint(0xf2b619), 0, rr - 0.035, zRoll + 0.027));
  roller.name = 'roller';
  setMM(roller, { kind: 'wheel', r: rr, width: 0.05, rim: 'flat', axis: 'z' });
  g.add(roller);
  g.add(pinMark('rollAxle', Lr, 0, zRoll));
  g.add(pinMark('pivotF', 0, 0, zRod));
  setMM(g, { kind: 'lever', pivot: [0, 0, 0], tip: [Lr, 0, 0], length: Lr + 1.03 });
  return { group: g, roller };
}

function circleHole(cx: number, cy: number, r: number): THREE.Path {
  const p = new THREE.Path();
  p.absarc(cx, cy, r, 0, Math.PI * 2, true);
  return p;
}

/**
 * 수직 막대(왕복). group 원점 = 핀 가운데 — 모델은 (xb, pinY, 0) 에 놓는다(z 절대값).
 * 네모 막대 0.06 (z 0.63~0.69), 로컬 y −0.9 ~ +0.1, 핀 r 0.018 (z 0.69~0.77) + 머리, 아래 끝 누름쇠.
 */
export function bar165(): THREE.Group {
  const g = new THREE.Group();
  const { zBar, barUp, barDown, zRod } = K165;
  g.add(meshAt(new THREE.BoxGeometry(0.06, barUp + barDown, 0.06), steel(), 0, (barUp - barDown) / 2, zBar));
  g.add(meshAt(cylZ(0.018, zBar + 0.02, zRod + 0.035), darkSteel(), 0, 0, 0));
  const head = hexPrism(0.05, 0.012, true, true, 0);
  head.rotateX(Math.PI / 2);
  g.add(meshAt(head, darkSteel(), 0, 0, zRod + 0.032));
  // 아래 끝 누름쇠
  g.add(meshAt(new THREE.BoxGeometry(0.12, 0.05, 0.1), darkSteel(), 0, -barDown + 0.025, zBar));
  g.add(meshAt(new THREE.BoxGeometry(0.02, 0.12, 0.003), paint(0xf2b619), 0, -0.4, zBar + 0.0315));
  g.add(pinMark('barPin', 0, 0, zRod));
  setMM(g, { kind: 'slider', axis: 'y' });
  return g;
}

/**
 * 수직 막대 안내(고정). group 원점 = 안내 가운데(막대 축 위) — 모델은 (xb, y, 0) 에 놓는다(z 절대값).
 * 네모 고리(구멍 0.068 이 Y 방향 — 막대가 위아래로 지나간다, 바깥 0.15 × 0.15, 높이 0.08) + 뒤판까지 팔.
 */
export function barGuide165(): THREE.Group {
  const g = new THREE.Group();
  const { zBar } = K165;
  const hole = 0.034;
  const h = 0.08;
  const mat = castIron();
  // 고리 네 변(앞·뒤 벽은 x 방향, 옆 벽은 z 방향)
  g.add(meshAt(new THREE.BoxGeometry(0.15, h, 0.04), mat, 0, 0, zBar + hole + 0.02));
  g.add(meshAt(new THREE.BoxGeometry(0.15, h, 0.04), mat, 0, 0, zBar - hole - 0.02));
  g.add(meshAt(new THREE.BoxGeometry(0.041, h, 2 * hole), mat, -hole - 0.0205, 0, zBar));
  g.add(meshAt(new THREE.BoxGeometry(0.041, h, 2 * hole), mat, hole + 0.0205, 0, zBar));
  // 팔(뒤 벽 뒷면 → 뒤판)
  const z0 = STAGE.backZ;
  const z1 = zBar - hole - 0.04;
  g.add(meshAt(new THREE.BoxGeometry(0.1, 0.06, z1 - z0), mat, 0, 0, (z0 + z1) / 2));
  setMM(g, { kind: 'frame', fn: 'barGuide165' });
  return g;
}
