// 249번 관용 볼 앤드 소켓 이음 전용 키트 — 반쪽 회전체(구면 점열 윤곽), 안내 홈, 볼트, 상태 닫힌 식. 설계표 docs/mm507-sheets/249.md
import * as THREE from 'three';
import { annularSector, extrude, lathe, mesh, shapeFrom, type V2 } from '../../models/parts/geom';
import { paint, steel } from '../../models/materials';

export const K249 = {
  O: [0, 1.7] as [number, number],
  ZC: 0.55,
  RB: 0.6786,
  RBI: 0.6006,
  RI: 0.6864,
  RO: 0.7956,
  CUT_Y: -0.5304,
  OPEN_R: 0.546,
  TUBE_UP: [0.2886, 0.1716] as [number, number],
  TUBE_DN: [0.3354, 0.1716] as [number, number],
  LEN_UP: 1.4586,
  BOLT_X: 1.014,
  EAR: [0.7644, 1.287, 0.1716] as [number, number, number],
  BETA_MAX: 16,
  PERIOD: 8
};

/** 구면 (√(R²−y²), y), y 를 y0→y1 로 n 점 */
function sphere(R: number, y0: number, y1: number, n: number): V2[] {
  const p: V2[] = [];
  for (let i = 0; i < n; i++) {
    const y = y0 + ((y1 - y0) * i) / (n - 1);
    p.push([Math.sqrt(Math.max(0, R * R - y * y)), y]);
  }
  return p;
}

export const PROFILE_BALL249: [number, number][] = [
  ...sphere(K249.RB, K249.CUT_Y, 0.6142, 24),
  [0.2886, 0.6142], [0.2886, 1.4586], [0.1716, 1.4586], [0.1716, 0.5756],
  ...sphere(K249.RBI, 0.5756, K249.CUT_Y, 24)
];
export const PROFILE_TOP249: [number, number][] = [
  ...sphere(K249.RI, 0, 0.416, 12), [0.546, 0.416], [0.546, 0.5787], ...sphere(K249.RO, 0.5787, 0, 12)
];
export const PROFILE_BOT249: [number, number][] = [
  ...sphere(K249.RI, 0, -0.6646, 14), [0.1716, -0.6646], [0.1716, -1.52], [0.5, -1.52], [0.5, -1.48], [0.3354, -1.48], [0.3354, -0.7214],
  ...sphere(K249.RO, -0.7214, 0, 14)
];

function area(p: V2[]): number {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const q = p[(i + 1) % p.length]!;
    a += p[i]![0] * q[1] - q[0] * p[i]![1];
  }
  return a / 2;
}

/** 뒤 반쪽 회전체 + 잘린 면 두 조각(z 0, 앞을 봄). 닫힌 (r, y) 윤곽 */
export function halfLathe249(profile: [number, number][], segs: number, body: THREE.Material, cut: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const prof: V2[] = area(profile) < 0 ? [...profile].reverse() : [...profile];
  g.add(mesh(lathe([...prof, prof[0]!], segs, Math.PI / 2, Math.PI), body));
  cut.side = THREE.DoubleSide;
  g.add(mesh(new THREE.ShapeGeometry(shapeFrom(profile)), cut));
  g.add(mesh(new THREE.ShapeGeometry(shapeFrom([...profile].reverse().map(([r, y]) => [-r, y] as V2))), cut));
  return g;
}

/** 각도 안내: 뒤판에 붙은 굽은 홈 판 두 조각(O 가 원점) + 눈금 3개 */
export function guide249(): THREE.Group {
  const g = new THREE.Group();
  const a0 = (70 * Math.PI) / 180;
  const a1 = (110 * Math.PI) / 180;
  const mat = paint(0xe9e2cf);
  for (const [r0, r1] of [[1.34, 1.385], [1.415, 1.46]] as [number, number][]) {
    const m = mesh(extrude(annularSector(r0, r1, a0, a1), 0.03), mat);
    m.position.set(K249.O[0], K249.O[1], -0.285);
    g.add(m);
  }
  const mk = paint(0x3b4a5a);
  for (const deg of [-16, 0, 16]) {
    const a = ((90 + deg) * Math.PI) / 180;
    const r = 1.4825;
    const b = mesh(new THREE.BoxGeometry(0.012, 0.04, 0.006), mk);
    b.position.set(K249.O[0] + r * Math.cos(a), K249.O[1] + r * Math.sin(a), -0.297);
    b.rotation.z = a - Math.PI / 2;
    g.add(b);
  }
  return g;
}

/** 죔 볼트: 원점 = 단면 평면 위 볼트 중심(공 중심 높이). 대 + 머리 6각 + 너트 6각 */
export function bolt249(): THREE.Group {
  const g = new THREE.Group();
  const shaft = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 16), steel());
  shaft.position.y = -0.02;
  const hex = paint(0x7d8792);
  const head = mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 6), hex);
  head.position.y = 0.2016;
  const nutM = mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 6), paint(0x7d8792));
  nutM.position.y = -0.2016;
  g.add(shaft, head, nutM);
  return g;
}

export function state249(t: number): { beta: number; pinPos: [number, number] } {
  const beta = ((K249.BETA_MAX * Math.PI) / 180) * Math.sin((2 * Math.PI * t) / K249.PERIOD);
  return { beta, pinPos: [K249.O[0] - 1.4 * Math.sin(beta), K249.O[1] + 1.4 * Math.cos(beta)] };
}
