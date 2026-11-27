// 272 비스듬한 원판 캠 전용 키트 — 축에 20° 비스듬히 끼운 두꺼운 원판이 돌면 면이 앞뒤로 흔들려, 그 면에 공 끝이 기댄 막대가 안내를 따라 왕복한다.
// 설계표: docs/mm507-sheets/272.md. 세계 좌표, 축·원판·막대 모두 깊이 ZC = 0.25 평면 둘레. 자세는 축 각 θ 의 절대 함수(닫힌 식).
import * as THREE from 'three';
import { bronze, castIron, paint, steel } from '../../models/materials';
import { extrude, lathe, mesh, roundedRect, tubeProfile, rodProfile } from '../../models/parts/geom';
import { setMM } from './mm';

const DEG = Math.PI / 180;

export const K272 = {
  O: [0.3, 1.3, 0.25] as [number, number, number],
  ALPHA: 20 * DEG,
  W: 0.1,
  R: 0.45,
  RB: 0.06,
  BETA: 33 * DEG,
  D: [Math.cos(33 * DEG), -Math.sin(33 * DEG), 0] as [number, number, number],
  P_REF: [0.18294, 1.54, 0.25] as [number, number, number],
  OMEGA: 1.2,
  GUIDE_L: -0.55,
  GUIDE_U: -1.0,
  ROD_LEN: 1.25
} as const;
const K = K272;

export interface State272 {
  theta: number;
  s: number;
  ball: [number, number, number];
}

/** 축 각 θ 에서 막대가 안내를 따라 나간 길이 s 와 공 중심 */
export function state272(theta: number): State272 {
  const n: [number, number, number] = [Math.cos(K.ALPHA), -Math.sin(K.ALPHA) * Math.cos(theta), -Math.sin(K.ALPHA) * Math.sin(theta)];
  const dot = (a: readonly number[], b: readonly number[]): number => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
  const rel: [number, number, number] = [K.P_REF[0] - K.O[0], K.P_REF[1] - K.O[1], K.P_REF[2] - K.O[2]];
  const s = (-(K.W / 2 + K.RB) - dot(n, rel)) / dot(n, K.D);
  return { theta, s, ball: [K.P_REF[0] + s * K.D[0], K.P_REF[1] + s * K.D[1], K.P_REF[2]] };
}

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

/** 비스듬한 원판: 원점 = 원판 가운데, 법선이 로컬 x 에서 −20°(θ = 0 에서 (cos 20°, −sin 20°, 0)). 왼쪽 면에 노란 표시 */
export function swashDisc272(): THREE.Group {
  const g = new THREE.Group();
  const geo = lathe(tubeProfile(0.04, K.R, -K.W / 2, K.W / 2, 0.008), 72);
  geo.rotateZ(-Math.PI / 2); // 원기둥 축 y → x
  const body = mesh(geo, bronze());
  body.name = 'camDiscBody';
  g.add(body);
  // 왼쪽 면(로컬 x = −0.05) 반지름 0.40 의 노란 표시
  g.add(meshAt(new THREE.BoxGeometry(0.006, 0.06, 0.02), paint(0xf2b619), -K.W / 2 - 0.003, 0.4, 0));
  g.rotation.z = -K.ALPHA;
  setMM(g, { kind: 'wheel', fn: 'swashDisc272', axis: 'x', r: K.R, width: K.W });
  return g;
}

/** 팔: 뒤판 앞면(z = −0.30)에서 zEnd 까지, x 폭 w × y 높이 h, 가운데 (cx, cy). 월드 좌표 기준 */
function armBox(cx: number, cy: number, w: number, h: number, zEnd: number, mat: THREE.Material): THREE.Mesh {
  const z0 = -0.3;
  const m = mesh(extrude(roundedRect(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2, 0.008), zEnd - z0, 0.005), mat);
  m.position.z = (z0 + zEnd) / 2;
  return m;
}

/** 축 받침: 관(안 0.042 · 밖 0.08, 길이 0.10) + 뒤판 팔. 원점 = (x, 1.30, 0.25) 관 가운데 */
export function hanger272(x: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, K.O[1], K.O[2]);
  const tube = lathe(tubeProfile(0.042, 0.08, -0.05, 0.05, 0.005), 40);
  tube.rotateZ(-Math.PI / 2);
  g.add(mesh(tube, castIron()));
  const arm = armBox(0, 0, 0.08, 0.1, 0.175, castIron());
  arm.position.z -= K.O[2];
  // 팔 xy 는 관 가운데 기준(armBox 가 월드 z 로 만들므로 z 만 보정)
  g.add(arm);
  return g;
}

/** 기운 안내 부시(관 안 0.042 · 밖 0.075, 길이 0.10, 축선 d) + 뒤판 팔(상자 0.08 × 0.08). 원점 = 부시 가운데 */
export function guide272(): THREE.Group {
  const g = new THREE.Group();
  const tube = lathe(tubeProfile(0.042, 0.075, -0.05, 0.05, 0.005), 40);
  tube.rotateZ(57 * DEG); // 축 y → −d 와 같은 선
  g.add(mesh(tube, castIron()));
  const arm = armBox(0, 0, 0.08, 0.08, 0.175, castIron());
  arm.position.z -= K.O[2];
  g.add(arm);
  return g;
}

/** 막대: 원점 = 공 중심, 로컬 +x = 막대 위쪽(−d 쪽). 둥근 막대 반지름 0.04 + 아래 끝 공 `rodBall`(청동) + 위 끝 멈춤 고리 */
export function followerRod272(): THREE.Group {
  const g = new THREE.Group();
  const x0 = Math.sqrt(K.RB * K.RB - 0.04 * 0.04); // 공 표면이 막대 옆면과 만나는 자리
  const rod = lathe(rodProfile(0.04, x0, K.ROD_LEN, 0, 0.004), 28);
  rod.rotateZ(-Math.PI / 2);
  const rodMesh = mesh(rod, steel());
  rodMesh.name = 'followerRodBody';
  g.add(rodMesh);
  const ball = mesh(new THREE.SphereGeometry(K.RB, 40, 28), bronze());
  ball.name = 'rodBall';
  g.add(ball);
  const ring = lathe(tubeProfile(0.04, 0.06, K.ROD_LEN - 0.05, K.ROD_LEN - 0.02, 0.003), 32);
  ring.rotateZ(-Math.PI / 2);
  const ringMesh = mesh(ring, castIron());
  ringMesh.name = 'stopRing';
  g.add(ringMesh);
  g.rotation.z = 147 * DEG;
  return g;
}
