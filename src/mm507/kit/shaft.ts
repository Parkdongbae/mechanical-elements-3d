// 축·막대·필로 블록 — 507 운동 공용 부품 (작업 지시서 16 · 3-3)
import * as THREE from 'three';
import { castIron, darkSteel, steel } from '../../models/materials';
import { extrude, hexPrism, lathe, mesh, rodProfile, roundedRect, tubeProfile } from '../../models/parts/geom';
import { STAGE } from './stand';
import { setMM } from './mm';

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}


/** 'x' 필로의 보스(구멍) 중심 높이 — 받침판 위 페데스탈 꼭대기 */
export const PILLOW_BOSS_Y = 0.21;

/** Z축 방향 축: 뒤판 앞면(z=STAGE.backZ)에서 z1까지. 뒤판 쪽 베어링 보스 + 끝 육각 너트. 그룹 원점 = (x, y, 0) */
export function shaftZ(x: number, y: number, z1 = 0.45, r = 0.045): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, 0);
  const len = z1 - STAGE.backZ;
  // 축 몸통: 양끝 모따기 (Y축 회전체 → Z축)
  const bodyGeo = lathe(rodProfile(r, 0, len, r * 0.25, r * 0.35), 32);
  bodyGeo.rotateX(Math.PI / 2);
  g.add(meshAt(bodyGeo, steel(), 0, 0, STAGE.backZ));
  // 뒤판 쪽 베어링 보스(짧은 원통)
  const bossGeo = lathe(rodProfile(r * 2.4, 0, 0.1, 0.014, 0.012), 40);
  bossGeo.rotateX(Math.PI / 2);
  g.add(meshAt(bossGeo, darkSteel(), 0, 0, STAGE.backZ));
  // 축 끝 육각 너트 — 가공된 마감
  const nutGeo = hexPrism(r * 2.2, r * 0.9, true, true, r * 1.05);
  nutGeo.rotateX(Math.PI / 2);
  g.add(meshAt(nutGeo, darkSteel(), 0, 0, z1 - r * 0.45));
  setMM(g, { kind: 'shaft', axis: 'z', r, z0: STAGE.backZ, z1 });
  return g;
}

/** 임의 두 점을 잇는 둥근 막대 (양끝 모따기) */
export function rod(a: THREE.Vector3, b: THREE.Vector3, r = 0.03): THREE.Mesh {
  const len = a.distanceTo(b);
  const geo = lathe(rodProfile(r, 0, len, r * 0.3, r * 0.3), 24);
  const m = mesh(geo, steel());
  m.position.copy(a);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  setMM(m, { kind: 'rod', r, a: [0, 0, 0], b: [0, len, 0], length: len });
  return m;
}

/** 축 받침 블록(필로). 원점 = 받침판 바닥 중심. axis: 받치는 축 방향 */
export function pillow(x: number, y: number, z: number, axis: 'x' | 'z'): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const body = castIron();
  // 받침판 (두께 0.055, 바닥이 원점)
  const plateGeo = extrude(roundedRect(-0.11, -0.11, 0.11, 0.11, 0.035), 0.055, 0.012);
  plateGeo.rotateX(Math.PI / 2);
  g.add(meshAt(plateGeo, body, 0, 0.0275, 0));
  // 구멍 난 보스 링 — 축이 통과하는 부분
  const ringGeo = lathe(tubeProfile(0.052, 0.088, -0.062, 0.062, 0.012), 36);
  if (axis === 'z') {
    ringGeo.rotateX(Math.PI / 2); // 구멍 → +Z (판 위에 눕는 플랜지 형태)
    g.add(meshAt(ringGeo, darkSteel(), 0, 0.09, 0.07));
  } else {
    ringGeo.rotateZ(Math.PI / 2); // 구멍 → X (판에서 올라온 페데스탈이 받침)
    const pedGeo = lathe(rodProfile(0.06, 0, 0.135, 0.012), 32);
    g.add(meshAt(pedGeo, body, 0, 0.055, 0));
    g.add(meshAt(ringGeo, darkSteel(), 0, PILLOW_BOSS_Y, 0));
  }
  // 고정 볼트 너트 4개
  const nutGeo = hexPrism(0.034, 0.024, true, true, 0);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) g.add(meshAt(nutGeo.clone(), darkSteel(), sx * 0.078, 0.067, sz * 0.078));
  }
  setMM(g, { kind: 'pillow', axis, bossY: axis === 'x' ? PILLOW_BOSS_Y : 0.09 });
  return g;
}
