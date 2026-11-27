// 243번 수평 축에서 수직 축 둘로 전용 키트 — 1/4 비틀린 벨트 경로(점·폭 방향), 세로 드럼
// 설계표 docs/mm507-sheets/243.md
import * as THREE from 'three';
import { brass } from '../../models/materials';
import { mesh } from '../../models/parts/geom';
import { pulley } from './pulley';
import { tagArc } from './mm';

export const K243 = {
  Y0: 1.95, // 벨트 높이
  Z_DRUM: 0.06, // 드럼 축 z
  ZF: 0.31, // 앞 평면(안내·가운데 풀리, 앞 가닥)
  ZB: -0.19, // 뒤 가닥
  X_DRUM: 1.6,
  R_DRUM_PATH: 0.25,
  X_GUIDE: 0.85,
  Y_GUIDE: 1.75,
  R_GUIDE_PATH: 0.2,
  Y_C: 1.55,
  R_C_PATH: 0.34,
  OMEGA: 0.6,
  /** 가운데 풀리 접점(오른쪽 값, 왼쪽은 x 부호 반대) */
  TC: [0.2659, 1.3381] as [number, number],
  /** 안내 풀리 접점 */
  TG: [0.6936, 1.8747] as [number, number],
  WRAP_C_DEG: 102.88,
  WRAP_G_DEG: 51.44
} as const;
const K = K243;

/** 안쪽 가닥(가운데 ↔ 안내) 접선 방향각 θ — 안쪽 접선: sin = (r1 + r2) / 중심거리 */
function innerTangentAngle(): number {
  const dx = K.X_GUIDE;
  const dy = K.Y_GUIDE - K.Y_C;
  const dist = Math.hypot(dx, dy);
  return Math.atan2(dy, dx) + Math.asin((K.R_C_PATH + K.R_GUIDE_PATH) / dist);
}

/**
 * 닫힌 벨트 경로 1~10(진행 방향). 점과 폭 방향을 같은 차례로. 이웃 구간의 겹치는 끝점은 한 번만.
 * 호 점에는 검사 표식(tagArc)을 단다.
 */
export function twistBeltPath243(): { pts: THREE.Vector3[]; dirs: THREE.Vector3[] } {
  const pts: THREE.Vector3[] = [];
  const dirs: THREE.Vector3[] = [];
  const add = (p: THREE.Vector3, d: THREE.Vector3): void => {
    pts.push(p);
    dirs.push(d);
  };
  const Z = new THREE.Vector3(0, 0, 1);
  const Y = new THREE.Vector3(0, 1, 0);
  const th = innerTangentAngle();
  const aC1 = th - Math.PI / 2; // 가운데 풀리 호 끝(−38.56°)
  const aC0 = -Math.PI - aC1; // 호 시작(−141.44°)
  const aG0 = th + Math.PI / 2; // 오른쪽 안내 풀리 호 시작(141.44°)
  const cC = new THREE.Vector3(0, K.Y_C, K.ZF);
  const cGR = new THREE.Vector3(K.X_GUIDE, K.Y_GUIDE, K.ZF);
  const cGL = new THREE.Vector3(-K.X_GUIDE, K.Y_GUIDE, K.ZF);
  const cDR = new THREE.Vector3(K.X_DRUM, K.Y0, K.Z_DRUM);
  const cDL = new THREE.Vector3(-K.X_DRUM, K.Y0, K.Z_DRUM);

  // 1. 가운데 풀리 호(반시계, 아래) 24 등분
  const arcC: THREE.Vector3[] = [];
  for (let i = 0; i <= 24; i++) {
    const a = aC0 + ((aC1 - aC0) * i) / 24;
    const p = new THREE.Vector3(K.R_C_PATH * Math.cos(a), K.Y_C + K.R_C_PATH * Math.sin(a), K.ZF);
    arcC.push(p);
    add(p, Z);
  }
  tagArc(arcC, { c: cC, r: K.R_C_PATH, ccw: true, axis: Z, wheel: 'pulleyC', src: 'twistBeltPath243' });

  // 2~3. 오른쪽 안내 풀리 호(시계) 10 등분 — 첫 점 = 안쪽 가닥 도착점
  const arcGR: THREE.Vector3[] = [];
  for (let i = 0; i <= 10; i++) {
    const a = aG0 + ((Math.PI / 2 - aG0) * i) / 10;
    const p = new THREE.Vector3(K.X_GUIDE + K.R_GUIDE_PATH * Math.cos(a), K.Y_GUIDE + K.R_GUIDE_PATH * Math.sin(a), K.ZF);
    arcGR.push(p);
    add(p, Z);
  }
  tagArc(arcGR, { c: cGR, r: K.R_GUIDE_PATH, ccw: false, axis: Z, wheel: 'guideR', src: 'twistBeltPath243' });

  // 4. 오른쪽 비틀림 가닥 20 등분(시작점은 위 호의 끝점)
  for (let i = 1; i <= 20; i++) {
    const u = i / 20;
    add(
      new THREE.Vector3(K.X_GUIDE + (K.X_DRUM - K.X_GUIDE) * u, K.Y0, K.ZF),
      new THREE.Vector3(0, Math.sin((Math.PI / 2) * u), Math.cos((Math.PI / 2) * u))
    );
  }

  // 5. 오른쪽 드럼 호: 앞 → 바깥(+X) → 뒤, 24 등분(β = 0 점은 비틀림 가닥 끝점)
  const arcDR: THREE.Vector3[] = [pts[pts.length - 1]!];
  for (let i = 1; i <= 24; i++) {
    const b = (Math.PI * i) / 24;
    const p = new THREE.Vector3(K.X_DRUM + K.R_DRUM_PATH * Math.sin(b), K.Y0, K.Z_DRUM + K.R_DRUM_PATH * Math.cos(b));
    arcDR.push(p);
    add(p, Y);
  }
  tagArc(arcDR, { c: cDR, r: K.R_DRUM_PATH, ccw: true, axis: Y, wheel: 'drumR', src: 'twistBeltPath243' });

  // 6. 뒤 가닥(끝점은 드럼 호가 넣었거나 왼쪽 드럼 호가 넣는다) 중간 점 6개
  for (let j = 1; j <= 6; j++) add(new THREE.Vector3(K.X_DRUM - (2 * K.X_DRUM * j) / 7, K.Y0, K.ZB), Y);

  // 7. 왼쪽 드럼 호: 뒤 → 바깥(−X) → 앞, β = 0 ~ π 24 등분(25점)
  const arcDL: THREE.Vector3[] = [];
  for (let i = 0; i <= 24; i++) {
    const b = (Math.PI * i) / 24;
    const p = new THREE.Vector3(-K.X_DRUM - K.R_DRUM_PATH * Math.sin(b), K.Y0, K.Z_DRUM - K.R_DRUM_PATH * Math.cos(b));
    arcDL.push(p);
    add(p, Y);
  }
  tagArc(arcDL, { c: cDL, r: K.R_DRUM_PATH, ccw: true, axis: Y, wheel: 'drumL', src: 'twistBeltPath243' });

  // 8. 왼쪽 비틀림 가닥 20 등분(시작점은 드럼 호의 끝점) — 폭 +Y → +Z
  for (let i = 1; i <= 20; i++) {
    const u = i / 20;
    add(
      new THREE.Vector3(-K.X_DRUM + (K.X_DRUM - K.X_GUIDE) * u, K.Y0, K.ZF),
      new THREE.Vector3(0, Math.cos((Math.PI / 2) * u), Math.sin((Math.PI / 2) * u))
    );
  }

  // 9. 왼쪽 안내 풀리 호(시계) 90° → 38.56°, 10 등분 — 첫 점은 비틀림 가닥의 끝점
  const arcGL: THREE.Vector3[] = [pts[pts.length - 1]!];
  for (let i = 1; i <= 10; i++) {
    const a = Math.PI / 2 - (th * i) / 10;
    const p = new THREE.Vector3(-K.X_GUIDE + K.R_GUIDE_PATH * Math.cos(a), K.Y_GUIDE + K.R_GUIDE_PATH * Math.sin(a), K.ZF);
    arcGL.push(p);
    add(p, Z);
  }
  tagArc(arcGL, { c: cGL, r: K.R_GUIDE_PATH, ccw: false, axis: Z, wheel: 'guideL', src: 'twistBeltPath243' });
  return { pts, dirs };
}

/** 세로 드럼 — 납작 림 풀리를 세운 것 + 위·아래 테두리 원판. 원점 = 드럼 가운데, 회전축 = 로컬 +Y */
export function verticalDrum243(): THREE.Group {
  const g = new THREE.Group();
  const p = pulley(0.24, { flat: true, width: 0.36, spokes: 0 });
  p.rotation.x = -Math.PI / 2; // 풀리 로컬 Z → 세계 +Y
  g.add(p);
  for (const sgn of [-1, 1]) {
    const geo = new THREE.CylinderGeometry(0.3, 0.3, 0.02, 48);
    const disc = mesh(geo, brass());
    disc.position.y = sgn * 0.19;
    disc.name = sgn < 0 ? 'drumFlangeLow' : 'drumFlangeTop';
    g.add(disc);
  }
  return g;
}
