// 275 웜과 랙 전용 키트 — 비스듬한 이를 가진 랙 + 랙 안내 고리 + 세로축 받침 + 닫힌 운동식
// 설계표 docs/mm507-sheets/275.md 의 치수·식을 그대로 옮겼다.
import * as THREE from 'three';
import { brass, castIron } from '../../models/materials';
import { creased, lathe, mesh, tubeProfile } from '../../models/parts/geom';
import { setMM } from './mm';

/** 275번 상수 — 웜 축 위치 W(x, 깊이), 웜 가운데 높이 YW, 피치 P, 피치선 반지름 RP, 이 기울기 SLANT, 이 치수 TOOTH, 랙 시작 높이, 웜 진폭(rad), 주기(초) */
export const K275 = {
  W: [0.25, 0.1] as [number, number],
  YW: 1.55,
  P: 0.2,
  RP: 0.17667,
  SLANT: 0.18018,
  /** [이뿌리 x, 이끝 x, 이뿌리 반폭, 이끝 반폭] */
  TOOTH: [0.014, 0.134, 0.07249, 0.03089] as [number, number, number, number],
  YR0: 1.85,
  THETA_AMP: 9.42478,
  PERIOD: 20
};

/** 뒤판 앞면(−0.30) 안쪽으로 살짝 묻는 팔 시작 깊이 */
const ARM_Z0 = -0.305;

export interface State275 {
  /** 웜 각(rad) */
  theta: number;
  /** 랙 기준 이 가운데 높이 */
  rackY: number;
}

/** 275번 운동식(t = 초): 웜 앞으로 3 바퀴 뒤로 3 바퀴, 랙은 한 바퀴에 0.20 곧게 */
export function state275(t: number): State275 {
  const theta = K275.THETA_AMP * (1 - Math.cos((Math.PI * t) / (K275.PERIOD / 2)));
  return { theta, rackY: K275.YR0 - (K275.P / (2 * Math.PI)) * theta };
}

function box(w: number, h: number, d: number, x: number, y: number, z: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

/** 랙: 몸 + 이 9개(웜 나선을 따라 깊이 방향으로 비스듬), 로컬 원점 = 기준 이 가운데 */
export function rack275(): THREE.Mesh {
  const [xr, xt, hr, ht] = K275.TOOTH;
  const outline: [number, number][] = [
    [-0.146, -0.95],
    [xr, -0.95]
  ];
  for (let j = -4; j <= 4; j++) {
    const c = 0.2 * j;
    outline.push([xr, c - hr], [xt, c - ht], [xt, c + ht], [xr, c + hr]);
  }
  outline.push([xr, 0.95]);
  const shape = new THREE.Shape();
  outline.forEach(([x, y], i) => (i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)));
  shape.lineTo(-0.026, 0.95);
  shape.absarc(-0.026, 0.83, 0.12, Math.PI / 2, Math.PI, false);
  shape.lineTo(-0.146, -0.95);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: false, curveSegments: 24 });
  geo.translate(0, 0, 0.04);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, pos.getY(i) + K275.SLANT * (pos.getZ(i) - K275.W[1]));
  }
  pos.needsUpdate = true;
  const m = mesh(creased(geo, 34), brass());
  m.userData.outline = outline;
  return m;
}

/** 랙 안내 고리: 랙 단면을 둘러싼 네모 고리 + 뒤판 팔. y0 = 아래 면 높이(높이 0.10) */
export function rackGuide275(y0: number): THREE.Group {
  const g = new THREE.Group();
  const h = 0.1;
  const yc = y0 + h / 2;
  const geos = [
    box(0.346, h, 0.03, -0.006, yc, 0.022), // 뒤벽(깊이 0.007 ~ 0.037)
    box(0.346, h, 0.03, -0.006, yc, 0.178), // 앞벽(깊이 0.163 ~ 0.193)
    box(0.03, h, 0.126, -0.164, yc, 0.1), // 왼벽(x −0.179 ~ −0.149)
    box(0.03, h, 0.126, 0.152, yc, 0.1), // 오른벽(x 0.137 ~ 0.167)
    box(0.099, h, 0.317, -0.1295, yc, -0.1465) // 팔: 뒤판 속 −0.305 ~ 고리 뒷벽 안 0.012
  ];
  for (const geo of geos) g.add(mesh(geo, castIron()));
  setMM(g, { kind: 'part', fn: 'rackGuide275', y0 });
  return g;
}

/** 세로축 받침: 관(안 0.042 · 바깥 0.07, 축 = y) + 뒤판 팔. y0 ~ y1 */
export function bearing275(y0: number, y1: number): THREE.Group {
  const g = new THREE.Group();
  const [x, z] = K275.W;
  const tube = mesh(lathe(tubeProfile(0.042, 0.07, y0, y1, 0.003), 36), castIron());
  tube.position.set(x, 0, z);
  g.add(tube);
  // 팔: 뒤판 속 −0.305 ~ 관 뒤쪽 0.035(관 바깥 뒤끝 0.03 과 겹침 0.005)
  g.add(mesh(box(0.1, y1 - y0, 0.34, x, (y0 + y1) / 2, (ARM_Z0 + 0.035) / 2), castIron()));
  setMM(g, { kind: 'part', fn: 'bearing275', y0, y1 });
  return g;
}
