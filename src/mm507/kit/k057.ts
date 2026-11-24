// 57·58번 전용 부품 — 캐리어 팔, 링 기어 뒷 플랜지, 받침 롤러, 속 빈 축(Z), 뒤판 축받이 팔(X축용)
import * as THREE from 'three';
import { brass, castIron, darkSteel, paint, steel } from '../../models/materials';
import { annularSector, extrude, lathe, mesh, rodProfile, stadiumShape, tubeProfile } from '../../models/parts/geom';
import { STAGE } from './stand';

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

/**
 * 캐리어 팔(플래닛 받침대): 회전축 = 로컬 Z, 원점 = 중심(허브), +X 쪽 끝 len 에 핀 보스.
 * z ∈ [-0.02, 0.02] 의 얇은 스타디움 막대 + 양끝 보스. 핀 막대는 모델이 rod 로 따로 세운다.
 */
export function carrierArm(len: number, hubR = 0.075): THREE.Group {
  const g = new THREE.Group();
  const barGeo = extrude(stadiumShape(0, 0, len, 0, 0.045), 0.04, 0.008);
  g.add(meshAt(barGeo, castIron({ roughness: 0.5 }), 0, 0, -0.02));
  const hub = lathe(tubeProfile(0.046, hubR, -0.034, 0.034, 0.008), 32);
  hub.rotateX(Math.PI / 2);
  g.add(mesh(hub, darkSteel()));
  const boss = lathe(rodProfile(0.058, -0.034, 0.034, 0.008, 0.008), 28);
  boss.rotateX(Math.PI / 2);
  g.add(meshAt(boss, darkSteel(), len, 0, 0));
  g.add(meshAt(new THREE.BoxGeometry(0.06, 0.014, 0.008), paint(0xf2b619), len * 0.5, 0, 0.022));
  return g;
}

/**
 * 링 기어 뒷 플랜지: 링 기어(internalGear)에 붙어 함께 도는 얇은 황동 테. 회전축 = 로컬 Z,
 * 반지름 [rIn, rOut], 두께 t(z ∈ [-t/2, t/2]). 받침 롤러가 이 테두리를 받친다.
 */
export function ringFlange(rIn: number, rOut: number, t = 0.022): THREE.Group {
  const g = new THREE.Group();
  const geo = extrude(annularSector(rIn, rOut, 0, Math.PI * 2 - 1e-4), t, 0.004, 96);
  g.add(meshAt(geo, brass({ roughness: 0.4 }), 0, 0, -t / 2));
  return g;
}

/** 받침 롤러: 테두리 홈이 있는 작은 강철 바퀴. 회전축 = 로컬 Z, 원점 중심, 폭 w. 표시점 1개 */
export function guideRoller(r: number, w = 0.08): THREE.Group {
  const g = new THREE.Group();
  const prof: [number, number][] = [
    [0.02, -w / 2],
    [r, -w / 2],
    [r * 0.82, -w * 0.16],
    [r * 0.82, w * 0.16],
    [r, w / 2],
    [0.02, w / 2]
  ];
  const geo = lathe(prof, 28);
  geo.rotateX(Math.PI / 2);
  g.add(mesh(geo, steel()));
  g.add(meshAt(new THREE.BoxGeometry(r * 0.5, 0.012, 0.006), paint(0xf2b619), r * 0.55, 0, w / 2 + 0.002));
  return g;
}

/** 속 빈 축(슬리브): 회전축 = 로컬 Z, z ∈ [0, length], 바깥 반지름 rOut, 안 반지름 rIn */
export function sleeveZ(rOut: number, rIn: number, length: number): THREE.Group {
  const g = new THREE.Group();
  const geo = lathe(tubeProfile(rIn, rOut, 0, length, rOut * 0.14), 32);
  geo.rotateX(Math.PI / 2);
  g.add(mesh(geo, brass({ roughness: 0.36 })));
  // 이음 표시줄 — 슬리브가 도는 것이 보이게
  const stripe = new THREE.BoxGeometry(0.012, 0.012, length * 0.7);
  g.add(meshAt(stripe, paint(0xf2b619), rOut + 0.002, 0, length / 2));
  return g;
}

/**
 * 뒤판 축받이 팔(X 방향 축용): 뒤판 앞면(z = backZ)에서 축 높이 zc 까지 뻗은 주철 팔 + 축이 지나는 베어링 링.
 * 반환 그룹의 원점 = (x, y, 0) (축 위치의 x, y). 축은 (x, y, zc) 를 X 방향으로 지난다.
 */
export function wallBracket(x: number, y: number, zc: number, halfH = 0.065): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, 0);
  const len = zc - STAGE.backZ + 0.02;
  g.add(meshAt(new THREE.BoxGeometry(0.1, halfH * 2, len), castIron(), 0, 0, STAGE.backZ + len / 2));
  const ring = lathe(tubeProfile(0.043, 0.082, -0.06, 0.06, 0.01), 36);
  ring.rotateZ(Math.PI / 2);
  g.add(meshAt(ring, darkSteel(), 0, 0, zc));
  return g;
}
