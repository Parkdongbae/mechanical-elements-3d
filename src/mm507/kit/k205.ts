// 205번 두 이빨 피니언 전용 키트 — 바퀴 앞·뒤 면의 엇갈린 두 줄 이(막대 12 + 12), 두 층 캠(깎아 낸 비원형 윤곽 72 점)
// 설계표 docs/mm507-sheets/205.md 의 수치 그대로. 캠 윤곽은 표(CAM_R)를 그대로 쓴다.
import * as THREE from 'three';
import { brass, bronze, castIron, darkSteel, glow, paint, steel } from '../../models/materials';
import { extrude, lathe, mesh, rodProfile, tubeProfile, type V2 } from '../../models/parts/geom';

const TAU = Math.PI * 2;
const D2R = Math.PI / 180;

export const K205 = {
  W: [0, 1.95] as const, // 바퀴 중심
  P: [0, 0.61] as const, // 피니언 중심
  D: 1.34, // 축간 거리
  ZW: 0.15, // 바퀴 가운데 면
  TEETH: 12, // 한 줄 이 수
  R_PLATE: 0.99,
  R_IN: 0.84, // 이 안쪽 끝
  R_TIP: 1.18, // 이 끝 반원 중심
  TOOTH_HW: 0.04,
  HUB_R: 0.12,
  WHEEL_BORE: 0.055, // 축 반지름 0.05 + 틈 0.005
  PIN_BORE: 0.048, // 축 반지름 0.045 + 틈 0.003
  CAM_RMAX: 0.4,
  PUSH_FROM: 48, // 앞 캠이 미는 구간(도)
  PUSH_TO: 228,
  OMEGA_P: 2.4,
  // 층(z 범위)
  zB: [0.04, 0.12] as const,
  zPlate: [0.12, 0.18] as const,
  zF: [0.18, 0.26] as const,
  zCamB: [0.05, 0.11] as const,
  zTube: [0.11, 0.19] as const,
  zCamF: [0.19, 0.25] as const
} as const;
const K = K205;

/** 앞 캠 윤곽 r(β), β = 0°, 5°, … 355° (설계표 그대로) */
export const CAM_R: number[] = [
  0.257, 0.247, 0.238, 0.229, 0.219, 0.21, 0.201, 0.191, 0.182, 0.172, 0.162, 0.153, 0.144, 0.135, 0.128, 0.122, 0.117, 0.115, 0.114, 0.115,
  0.117, 0.122, 0.128, 0.135, 0.144, 0.153, 0.162, 0.172, 0.182, 0.191, 0.201, 0.21, 0.219, 0.229, 0.238, 0.247, 0.257, 0.266, 0.275, 0.284,
  0.293, 0.302, 0.311, 0.32, 0.329, 0.338, 0.347, 0.356, 0.365, 0.374, 0.383, 0.392, 0.4, 0.4, 0.4, 0.4, 0.4, 0.392, 0.383, 0.374,
  0.365, 0.356, 0.347, 0.338, 0.329, 0.32, 0.311, 0.302, 0.293, 0.284, 0.275, 0.266
];

/** 캠 윤곽 72 점(로컬, 반시계). flip 이면 180° 돌린 것 */
export function camOutline205(flip: boolean): V2[] {
  const out: V2[] = [];
  for (let i = 0; i < CAM_R.length; i++) {
    const b = i * 5 * D2R;
    const r = CAM_R[i]!;
    out.push(flip ? [-r * Math.cos(b), -r * Math.sin(b)] : [r * Math.cos(b), r * Math.sin(b)]);
  }
  return out;
}

const shapeOf = (pts: V2[], holeR?: number): THREE.Shape => {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
  s.closePath();
  if (holeR !== undefined) {
    const h = new THREE.Path();
    h.absarc(0, 0, holeR, 0, TAU, true);
    s.holes.push(h);
  }
  return s;
};
const zMesh = (geo: THREE.BufferGeometry, mat: THREE.Material, z0: number, z1: number): THREE.Mesh => {
  const m = mesh(geo, mat);
  m.position.z = (z0 + z1) / 2;
  return m;
};
const cylZ = (r: number, z0: number, z1: number, c = 0.006, seg = 40): THREE.BufferGeometry => {
  const g = lathe(rodProfile(r, 0, z1 - z0, c, c), seg);
  g.rotateX(Math.PI / 2);
  g.translate(0, 0, z0);
  return g;
};
const tubeZ = (rIn: number, rOut: number, z0: number, z1: number, c = 0.006, seg = 40): THREE.BufferGeometry => {
  const g = lathe(tubeProfile(rIn, rOut, 0, z1 - z0, c), seg);
  g.rotateX(Math.PI / 2);
  g.translate(0, 0, z0);
  return g;
};

/** 이(막대): 로컬 +X 방향, r 0.84 ~ 1.18 직사각 + 끝 반원(이끝 1.22) */
function toothShape(): THREE.Shape {
  const hw = K.TOOTH_HW;
  const s = new THREE.Shape();
  s.moveTo(K.R_IN, -hw);
  s.lineTo(K.R_TIP, -hw);
  s.absarc(K.R_TIP, 0, hw, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(K.R_IN, hw);
  s.closePath();
  return s;
}

/** 바퀴: 원점 = 바퀴 축, 회전축 = Z. 이름 `wheel`, 이 `toothF0~11`(앞) `toothB0~11`(뒤) */
export function wheel205(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'wheel';
  const [zp0, zp1] = K.zPlate;
  // 바퀴판: 반지름 0.91 원판(구멍 6 + 허브 자리) + 테 고리 0.91~0.99
  const plate = new THREE.Shape();
  plate.absarc(0, 0, 0.91, 0, TAU, false);
  const hubHole = new THREE.Path();
  hubHole.absarc(0, 0, K.HUB_R, 0, TAU, true);
  plate.holes.push(hubHole);
  for (let k = 0; k < 6; k++) {
    const a = (30 + 60 * k) * D2R;
    const h = new THREE.Path();
    h.absarc(Math.cos(a) * 0.55, Math.sin(a) * 0.55, 0.16, 0, TAU, true);
    plate.holes.push(h);
  }
  g.add(zMesh(extrude(plate, zp1 - zp0, 0.006, 48), steel(), zp0, zp1));
  g.add(mesh(tubeZ(0.91, K.R_PLATE, zp0, zp1, 0.008, 96), castIron()));
  // 허브: 반지름 0.12, z 0.04~0.30, 구멍(축 + 틈 0.005)
  g.add(mesh(tubeZ(K.WHEEL_BORE, K.HUB_R, 0.04, 0.3, 0.008, 40), darkSteel()));
  // 노란 반지름 띠(+X 쪽 0.15~0.85, 폭 0.04, z 0.181)
  const band = new THREE.BoxGeometry(0.7, 0.04, 0.003);
  band.translate(0.5, 0, 0.1815);
  g.add(mesh(band, paint(0xf2b619)));
  // 이: 앞 줄(놋쇠, z 0.18~0.26), 뒤 줄(짙은 쇠, z 0.04~0.12, +15°)
  const tGeo = extrude(toothShape(), 0.08, 0.006, 16);
  for (let j = 0; j < K.TEETH; j++) {
    const f = mesh(tGeo.clone(), brass());
    f.name = `toothF${j}`;
    f.position.z = (K.zF[0] + K.zF[1]) / 2;
    f.rotation.z = (30 * j - 90) * D2R;
    g.add(f);
    const b = mesh(tGeo.clone(), darkSteel());
    b.name = `toothB${j}`;
    b.position.z = (K.zB[0] + K.zB[1]) / 2;
    b.rotation.z = (30 * j - 75) * D2R;
    g.add(b);
  }
  return g;
}

/** 캠 하나(앞 flip=false / 뒤 flip=true): 원점 = 피니언 축 */
function cam205(flip: boolean): THREE.Group {
  const g = new THREE.Group();
  g.name = flip ? 'camB' : 'camF';
  const [z0, z1] = flip ? K.zCamB : K.zCamF;
  const out = camOutline205(flip);
  // 윤곽 평면 = 이 그룹의 원점 평면. 두 캠 그룹을 z 로 0.4 벌려 두어(메시는 반대로 되돌림) 서로 다른 층의 윤곽끼리 겹침 검사가 되지 않게 한다
  const oz = flip ? -0.1 : 0.3;
  const body = zMesh(extrude(shapeOf(out, K.PIN_BORE), z1 - z0, 0.005, 8), flip ? castIron() : bronze({ roughness: 0.34 }), z0, z1);
  body.position.z -= oz;
  g.position.z = oz;
  g.add(body);
  g.userData.outline = out;
  return g;
}

/** 노란 테: 각 캠 앞면(z + 0.002)에 윤곽을 0.02 안쪽으로 민 폭 0.015 띠 */
function glow205(flip: boolean): THREE.Mesh {
  const out = camOutline205(flip);
  const ring = (d: number): V2[] =>
    out.map(([x, y]) => {
      const r = Math.hypot(x, y);
      return [(x * (r - d)) / r, (y * (r - d)) / r] as V2;
    });
  const s = shapeOf(ring(0.02));
  const h = new THREE.Path();
  ring(0.035)
    .reverse()
    .forEach(([x, y], i) => (i === 0 ? h.moveTo(x, y) : h.lineTo(x, y)));
  h.closePath();
  s.holes.push(h);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.003, bevelEnabled: false });
  const m = mesh(geo, glow(0xffc83a, 0.9));
  m.name = flip ? 'glowB' : 'glowF';
  m.position.z = (flip ? K.zCamB[1] : K.zCamF[1]) + 0.002;
  return m;
}

/** 피니언: 원점 = 피니언 축, 이름 `pinion` (두 캠 + 사이 통 + 노란 테 + 손잡이) */
export function pinion205(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'pinion';
  g.add(cam205(true), cam205(false));
  g.add(mesh(tubeZ(K.PIN_BORE, 0.1, K.zTube[0], K.zTube[1], 0.005, 40), steel()));
  g.add(glow205(false), glow205(true));
  // 손잡이: 축 앞 끝 팔 0.25(로컬 +X, z 0.28~0.31) + 둥근 손잡이(반지름 0.035, z 0.31~0.41)
  const crank = new THREE.Group();
  crank.name = 'crank';
  const arm = new THREE.Shape();
  arm.absarc(0, 0, 0.05, Math.PI / 2, (3 * Math.PI) / 2, false);
  arm.absarc(0.25, 0, 0.04, -Math.PI / 2, Math.PI / 2, false);
  arm.closePath();
  crank.add(zMesh(extrude(arm, 0.03, 0.004, 16), darkSteel(), 0.28, 0.31));
  const knob = mesh(cylZ(0.035, 0.31, 0.41, 0.008, 24), paint(0xb3541e));
  knob.position.x = 0.25;
  crank.add(knob);
  g.add(crank);
  return g;
}

/** 상태: ψ = π + 2.4 t, θw = −ψ/12, 미는 캠 = ψ mod 360° ∈ [48°, 228°) 이면 앞 */
export function state205(t: number): { psi: number; thetaW: number; front: boolean } {
  const psi = Math.PI + K.OMEGA_P * t;
  const k = (((psi / D2R) % 360) + 360) % 360;
  return { psi, thetaW: -psi / 12, front: k >= K.PUSH_FROM && k < K.PUSH_TO };
}
