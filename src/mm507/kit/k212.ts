// 212번 제네바 스톱 전용 키트 — 별 바퀴(홈 5 + 오목 4 + 볼록 1), 손가락 바퀴(잠금 원판 + 손가락 판 + 핀), 표시등, 상태 닫힌 식
// 설계표 docs/mm507-sheets/212.md 의 수치 그대로. 215번(멈추개 변형 2)도 여기 보조 함수를 가져다 쓴다.
import * as THREE from 'three';
import { brass, bronze, darkSteel, paint, steel } from '../../models/materials';
import { annularSector, extrude, lathe, mesh, rodProfile, tubeProfile, type V2 } from '../../models/parts/geom';

const TAU = Math.PI * 2;
export const D2R = Math.PI / 180;

export const K212 = {
  OA: [0, 1.1] as [number, number], // A(손가락 바퀴) 축
  OB: [0, 2.34] as [number, number], // B(별 바퀴) 축
  d: 1.24, // 축간 거리
  Re: 0.655, // 핀이 홈에 들어가는 반지름(B 중심 기준)
  rf: 0.8077, // 핀 회전 반지름(A 축 기준)
  pinR: 0.07,
  aw: 28.466, // 물린 구간 ±(도)
  RL: 0.75, // 잠금 원판 반지름
  cutD: 1.24, // 파냄 원 중심(로컬 X)
  cutR: 0.64,
  bore: 0.05,
  hubR: 0.12,
  // 별 윤곽 63 점(B 로컬, β = 0 에서 오목 옆면 하나가 −90°)
  star: [
    [-0.3018, -0.5447], [-0.2291, -0.5175], [-0.1541, -0.4978], [-0.0775, -0.486], [0.0, -0.482], [0.0775, -0.486], [0.1541, -0.4978],
    [0.2291, -0.5175], [0.3018, -0.5447], [0.1442, -0.3278], [0.2672, -0.2385], [0.4248, -0.4553], [0.4213, -0.3778], [0.4258, -0.3004],
    [0.4382, -0.2238], [0.4584, -0.1489], [0.4861, -0.0765], [0.5211, -0.0073], [0.5629, 0.058], [0.6113, 0.1187], [0.3564, 0.0359],
    [0.3094, 0.1804], [0.5636, 0.263], [0.5459, 0.2981], [0.526, 0.332], [0.5039, 0.3646], [0.4799, 0.3957], [0.4539, 0.4252],
    [0.4261, 0.4531], [0.3967, 0.4791], [0.3656, 0.5032], [0.3331, 0.5253], [0.2992, 0.5453], [0.2642, 0.5631], [0.2281, 0.5787],
    [0.191, 0.5919], [0.1533, 0.6028], [0.1149, 0.6113], [0.076, 0.6173], [0.076, 0.35], [-0.076, 0.35], [-0.076, 0.618],
    [-0.1188, 0.5533], [-0.1679, 0.4933], [-0.223, 0.4387], [-0.2833, 0.3899], [-0.3483, 0.3476], [-0.4173, 0.3122], [-0.4895, 0.284],
    [-0.5643, 0.2633], [-0.3094, 0.1804], [-0.3564, 0.0359], [-0.6113, 0.1187], [-0.5629, 0.058], [-0.5211, -0.0073], [-0.4861, -0.0765],
    [-0.4584, -0.1489], [-0.4382, -0.2238], [-0.4258, -0.3004], [-0.4213, -0.3778], [-0.4248, -0.4553], [-0.2672, -0.2385], [-0.1442, -0.3278]
  ] as V2[],
  pa: [0.076, 0.6173] as V2, // a(위 홈 오른쪽 모서리)
  pb: [0.5636, 0.263] as V2, // b(오른쪽 홈 위 모서리)
  RB: 0.622, // 별 끝 반지름(볼록 호)
  // 구동 시간표
  alphaB: -271.48, // 반대쪽 걸림 각(도)
  alphaF: 1171.48, // 볼록 a·b 걸림 각(도)
  omega: 2.0, // rad/s
  hold: 1.5, // 멈춤 시간(초)
  // 층(z 범위)
  zStar: [0.05, 0.13] as [number, number],
  zFinger: [0.145, 0.185] as [number, number],
  zPin: [0.05, 0.146] as [number, number],
  zHub: [0.03, 0.15] as [number, number]
} as const;
const K = K212;

const SWEEP = (K.alphaF - K.alphaB) / (K.omega / D2R); // 한 방향 시간 12.592
export const T212 = 2 * (SWEEP + K.hold);

// ───────────────────────── 공용 보조(215 도 사용) ─────────────────────────

/** 점열 → Shape(구멍 반지름 holeR 이면 가운데 원 구멍) */
export function shapeOf(pts: V2[], holeR?: number): THREE.Shape {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
  s.closePath();
  if (holeR !== undefined) {
    const h = new THREE.Path();
    h.absarc(0, 0, holeR, 0, TAU, true);
    s.holes.push(h);
  }
  return s;
}

/** Z 로 압출된 지오메트리를 z0~z1 에 놓은 메시(지오메트리는 extrude 로 만든 중심 정렬 것) */
export function zMesh(geo: THREE.BufferGeometry, mat: THREE.Material, z0: number, z1: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.z = (z0 + z1) / 2;
  return m;
}

/** z0~z1 원통(Z 방향) */
export function cylZ(r: number, z0: number, z1: number, c = 0.004, seg = 40): THREE.BufferGeometry {
  const g = lathe(rodProfile(r, 0, z1 - z0, c, c), seg);
  g.rotateX(Math.PI / 2);
  g.translate(0, 0, z0);
  return g;
}

/** z0~z1 통(Z 방향, 안 rIn 밖 rOut) */
export function tubeZ(rIn: number, rOut: number, z0: number, z1: number, c = 0.004, seg = 48): THREE.BufferGeometry {
  const g = lathe(tubeProfile(rIn, rOut, 0, z1 - z0, c), seg);
  g.rotateX(Math.PI / 2);
  g.translate(0, 0, z0);
  return g;
}

/** 잠금 원판 윤곽: 원(반지름 R) − 파냄 원(중심 (cd, 0), 반지름 cr). 반시계, 뿔 두 개 */
export function lockOutline(R: number, cd: number, cr: number, nMain = 120, nCut = 28): V2[] {
  const x = (R * R - cr * cr + cd * cd) / (2 * cd);
  const y = Math.sqrt(R * R - x * x);
  const phi = Math.atan2(y, x);
  const out: V2[] = [];
  for (let i = 0; i <= nMain; i++) {
    const a = phi + ((TAU - 2 * phi) * i) / nMain;
    out.push([R * Math.cos(a), R * Math.sin(a)]);
  }
  // 파냄 호: 아래 뿔 (x, −y) → 가장 안쪽 (cd − cr, 0) → 위 뿔 (x, y). 파냄 원 위 각이 209° → 151° 로 줄어든다
  const p0 = Math.atan2(-y, x - cd) + TAU;
  const p1 = Math.atan2(y, x - cd);
  for (let i = 1; i < nCut; i++) {
    const a = p0 + ((p1 - p0) * i) / nCut;
    out.push([cd + cr * Math.cos(a), cr * Math.sin(a)]);
  }
  return out;
}

/** 원 윤곽 점열 */
export function circleOutline(r: number, n = 24, cx = 0, cy = 0): V2[] {
  const o: V2[] = [];
  for (let i = 0; i < n; i++) o.push([cx + r * Math.cos((TAU * i) / n), cy + r * Math.sin((TAU * i) / n)]);
  return o;
}

/** 표시등 판 + 등 n 개. 판 가운데 (cx, cy), 가로 세로 w×h, 등 위치 목록. 그룹 name 'lamps', 등 'lamp1'~ */
export function lampsGroup(cx: number, cy: number, w: number, h: number, pos: V2[], zLamp: number): THREE.Group {
  const g = new THREE.Group();
  g.name = 'lamps';
  const plate = mesh(new THREE.BoxGeometry(w, h, 0.03), paint(0xe8e8e8));
  plate.position.set(cx, cy, -0.285);
  g.add(plate);
  pos.forEach(([x, y], i) => {
    const lamp = mesh(new THREE.SphereGeometry(0.045, 24, 16), paint(0x6b6b6b));
    lamp.name = `lamp${i + 1}`;
    lamp.position.set(x, y, zLamp);
    g.add(lamp);
  });
  return g;
}

/** 켜진 표시등 수 n(앞에서부터) */
export function setLamps(g: THREE.Object3D, n: number, count: number): void {
  for (let i = 1; i <= count; i++) {
    const m = (g.getObjectByName(`lamp${i}`) as THREE.Mesh | undefined)?.material as THREE.MeshPhysicalMaterial | undefined;
    if (!m) continue;
    const on = i <= n;
    m.color.setHex(on ? 0xffd23a : 0x6b6b6b);
    m.emissive.setHex(on ? 0x806000 : 0x000000);
  }
}

// ───────────────────────── 별 바퀴 ─────────────────────────

/** 별 바퀴: 원점 = B 축, 회전축 Z. name `starB`(윤곽 userData.outline), 안에 `stopAB`·`ptA`·`ptB`·허브 */
export function star212(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'starB';
  const [z0, z1] = K.zStar;
  g.add(zMesh(extrude(shapeOf(K.star, K.hubR), z1 - z0, 0.006, 8), brass(), z0, z1));
  g.add(mesh(tubeZ(K.bore, K.hubR, K.zHub[0], K.zHub[1], 0.006, 40), darkSteel()));
  // 볼록 띠: 호(b 25.02° ~ a 82.98°) 안쪽 폭 0.03, 양끝은 홈 벽에서 조금 물림
  const band = mesh(
    extrude(annularSector(K.RB - 0.03, K.RB - 0.002, 26.5 * D2R, 81.5 * D2R), 0.004, 0, 20),
    paint(0x8a1c1c)
  );
  band.name = 'stopAB';
  band.position.z = z1 + 0.002;
  g.add(band);
  const sph = new THREE.SphereGeometry(0.022, 16, 12);
  const pa = mesh(sph, paint(0xffffff));
  pa.name = 'ptA';
  pa.position.set(K.pa[0], K.pa[1], 0.135);
  const pb = mesh(sph.clone(), paint(0xffffff));
  pb.name = 'ptB';
  pb.position.set(K.pb[0], K.pb[1], 0.135);
  g.add(pa, pb);
  g.userData.outline = K.star;
  return g;
}

// ───────────────────────── 손가락 바퀴 ─────────────────────────

/** 손가락 판 윤곽: 허브 원 ∪ 사다리꼴 ∪ 끝 원(반시계) */
function fingerOutline(): V2[] {
  const hw0 = 0.1;
  const hw1 = K.pinR;
  const hubR = 0.16;
  const yAt = (x: number): number => hw0 + ((hw1 - hw0) * x) / K.rf;
  let lo = 0;
  let hi: number = K.rf;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (mid * mid + yAt(mid) ** 2 < hubR * hubR) lo = mid;
    else hi = mid;
  }
  const th0 = Math.atan2(yAt(lo), lo);
  const out: V2[] = [];
  const n = 40;
  for (let i = 0; i <= n; i++) {
    const a = th0 + ((TAU - 2 * th0) * i) / n;
    out.push([hubR * Math.cos(a), hubR * Math.sin(a)]);
  }
  out.push([K.rf, -hw1]);
  for (let i = 1; i < 12; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / 12;
    out.push([K.rf + K.pinR * Math.cos(a), K.pinR * Math.sin(a)]);
  }
  out.push([K.rf, hw1]);
  return out;
}

/** 손가락 바퀴 한 몸: 원점 = A 축. name `wheelA`(윤곽 userData.outline = 잠금 원판), 안에 `fingerA`·`pinA`(윤곽 = 핀)·`key` */
export function driver212(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'wheelA';
  const [z0, z1] = K.zStar;
  const lock = lockOutline(K.RL, K.cutD, K.cutR);
  const shape = shapeOf(lock, K.bore);
  const disc = zMesh(extrude(shape, z1 - z0, 0.006, 24), steel(), z0, z1);
  disc.name = 'discA';
  g.add(disc);
  g.userData.outline = lock;

  // 손가락 판(앞 층)
  const fs = shapeOf(fingerOutline());
  const fh = new THREE.Path();
  fh.absarc(0, 0, K.bore, 0, TAU, true);
  fs.holes.push(fh);
  const finger = zMesh(extrude(fs, K.zFinger[1] - K.zFinger[0], 0.004, 16), bronze(), K.zFinger[0], K.zFinger[1]);
  finger.name = 'fingerA';
  g.add(finger);

  // 핀: 판 끝 밑에 붙어 B 의 층까지 내려간다
  const pin = new THREE.Group();
  pin.name = 'pinA';
  pin.position.set(K.rf, 0, 0);
  pin.add(mesh(cylZ(K.pinR, K.zPin[0], K.zPin[1], 0.004, 28), brass()));
  pin.userData.outline = circleOutline(K.pinR, 28);
  g.add(pin);

  // 감기 손잡이: 팔 0.30(로컬 +Y, z 0.25~0.28) + 손잡이 반지름 0.035(z 0.28~0.38)
  const key = new THREE.Group();
  key.name = 'key';
  const arm = new THREE.Shape();
  arm.absarc(0, 0, 0.05, Math.PI, TAU, false);
  arm.absarc(0, 0.3, 0.04, 0, Math.PI, false);
  arm.closePath();
  key.add(zMesh(extrude(arm, 0.03, 0.004, 16), darkSteel(), 0.25, 0.28));
  const knob = mesh(cylZ(0.035, 0.28, 0.38, 0.008, 24), paint(0xb3541e));
  knob.position.y = 0.3;
  key.add(knob);
  g.add(key);
  return g;
}

// ───────────────────────── 상태 ─────────────────────────

export type Phase212 = 'wind' | 'stopF' | 'unwind' | 'stopB';

/** 닫힌 식: t(초) → A 각 α(도), B 각 β(도), 감은 바퀴 수 turns, 단계, 멈춤 여부 */
export function state212(t: number): { alpha: number; beta: number; turns: number; phase: Phase212; stopped: boolean } {
  const w = K.omega / D2R; // 도/초
  const u = ((t % T212) + T212) % T212;
  let alpha: number;
  let phase: Phase212;
  if (u < SWEEP) {
    alpha = K.alphaB + w * u;
    phase = 'wind';
  } else if (u < SWEEP + K.hold) {
    alpha = K.alphaF;
    phase = 'stopF';
  } else if (u < 2 * SWEEP + K.hold) {
    alpha = K.alphaF - w * (u - SWEEP - K.hold);
    phase = 'unwind';
  } else {
    alpha = K.alphaB;
    phase = 'stopB';
  }
  const j = Math.floor((alpha - 90 + 180) / 360);
  const ac = 90 + 360 * j;
  const base = 144 - 72 * j;
  let beta: number;
  if (alpha < ac - K.aw) beta = base;
  else if (alpha > ac + K.aw) beta = base - 72;
  else {
    const x = K.rf * Math.cos(alpha * D2R);
    const y = -K.d + K.rf * Math.sin(alpha * D2R);
    beta = base + Math.atan2(y, x) / D2R + 54;
  }
  const turns = (alpha - K.alphaB) / 360;
  return { alpha, beta, turns, phase, stopped: phase === 'stopF' || phase === 'stopB' };
}
