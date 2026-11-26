// 214번 멈추개 변형 1 — 이 12 : 10 두 기어 앞면의 손가락 둘(눈물방울판), 바퀴 수 표시등, 닫힌 식 상태
// 설계표 docs/mm507-sheets/214.md 의 수치 그대로.
import * as THREE from 'three';
import { darkSteel, paint, steel } from '../../models/materials';
import { extrude, lathe, mesh, rodProfile, type V2 } from '../../models/parts/geom';

const D2R = Math.PI / 180;

export const K214 = {
  CL: [-0.75, 1.7] as V2,
  CR: [0.68, 1.7] as V2,
  m: 0.13,
  LL: 0.93, // 왼 손가락 길이(큰 원 중심 ~ 작은 원 중심)
  rL: 0.17,
  LR: 0.85,
  rR: 0.15,
  rSmall: 0.02,
  fingerRDeg: 342.0, // 오른 손가락의 오른 기어 로컬 각
  thB: -325.4,
  thF: 1405.4,
  omega: 2.0,
  hold: 1.5
} as const;
const K = K214;
const W_DEG_S = K.omega / D2R;
const TW = (K.thF - K.thB) / W_DEG_S;
const T_CYCLE = 2 * (TW + K.hold);

/** 눈물방울 윤곽(로컬, 반시계): 큰 원(원점) + 작은 원(중심 (L, 0)) 볼록 껍질 */
export function teardrop214(L: number, r0: number, r1: number): V2[] {
  const phi = Math.acos((r0 - r1) / L);
  const out: V2[] = [];
  const N = 24;
  for (let i = 0; i <= N; i++) {
    const a = phi + ((2 * Math.PI - 2 * phi) * i) / N; // 큰 원 호 φ → 2π−φ (180° 지남)
    out.push([r0 * Math.cos(a), r0 * Math.sin(a)]);
  }
  const M = 8;
  for (let i = 0; i <= M; i++) {
    const a = -phi + (2 * phi * i) / M; // 작은 원 호 −φ → φ
    out.push([L + r1 * Math.cos(a), r1 * Math.sin(a)]);
  }
  return out;
}

/** 손가락: 원점 = 기어 축, 판 z 0.12~0.16 + 네모 축 덩이 z 0.16~0.22. userData.mat = 재질 */
export function finger214(left: boolean): THREE.Group {
  const g = new THREE.Group();
  g.name = left ? 'fingerL' : 'fingerR';
  const out = teardrop214(left ? K.LL : K.LR, left ? K.rL : K.rR, K.rSmall);
  const s = new THREE.Shape();
  out.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
  s.closePath();
  const mat = steel();
  const plate = mesh(extrude(s, 0.04, 0.004, 16), mat);
  plate.position.z = 0.14;
  g.add(plate);
  const blk = mesh(new THREE.BoxGeometry(0.14, 0.14, 0.06), darkSteel());
  blk.position.z = 0.19;
  g.add(blk);
  g.userData.outline = out;
  g.userData.mat = mat;
  return g;
}

/** 왼쪽 축 앞 손잡이: 원점 = 왼 축, 이름 `key` (팔 0.28 로컬 −X, z 0.28~0.31 + 둥근 손잡이 z 0.31~0.41) */
export function key214(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'key';
  const arm = mesh(new THREE.BoxGeometry(0.28, 0.08, 0.03), darkSteel());
  arm.position.set(-0.14, 0, 0.295);
  g.add(arm);
  const kg = lathe(rodProfile(0.035, 0, 0.1, 0.008, 0.008), 24);
  kg.rotateX(Math.PI / 2);
  kg.translate(0, 0, 0.31);
  const knob = mesh(kg, paint(0xb3541e));
  knob.position.x = -0.28;
  g.add(knob);
  return g;
}

/** 바퀴 수 표시등: 판 + 등 4 개(`lamp1`~`lamp4`). userData.setLit(k) 로 앞 k 개를 켠다 */
export function lamps214(n = 4): THREE.Group {
  const g = new THREE.Group();
  g.name = 'lamps';
  const plate = mesh(new THREE.BoxGeometry(1.1, 0.16, 0.03), paint(0xe8e8e8));
  plate.position.set(0, 0.45, -0.285);
  g.add(plate);
  const lamps: THREE.Mesh[] = [];
  for (let i = 0; i < n; i++) {
    const lg = lathe(rodProfile(0.045, 0, 0.04, 0.004, 0.004), 24);
    lg.rotateX(Math.PI / 2);
    lg.translate(0, 0, -0.27);
    const m = mesh(lg, paint(0x6b6b6b));
    m.name = `lamp${i + 1}`;
    m.position.set(-0.45 + 0.3 * i, 0.45, 0);
    g.add(m);
    lamps.push(m);
  }
  g.userData.setLit = (k: number): void => {
    lamps.forEach((m, i) => {
      const mat = m.material as THREE.MeshPhysicalMaterial;
      const on = i < k;
      mat.color.setHex(on ? 0xffd23a : 0x6b6b6b);
      mat.emissive.setHex(on ? 0x806000 : 0x000000);
    });
  };
  return g;
}

export interface State214 {
  th1: number;
  th2: number;
  turns: number;
  phase: 'wind' | 'holdF' | 'unwind' | 'holdB';
  stopped: boolean;
}

/** 시각 t(초) → 상태. 각은 도. θ2 = 126 − 1.2·θ1 (이 12 : 10 물림) */
export function state214(t: number): State214 {
  const u = ((t % T_CYCLE) + T_CYCLE) % T_CYCLE;
  let th1: number;
  let phase: State214['phase'];
  if (u < TW) {
    th1 = K.thB + W_DEG_S * u;
    phase = 'wind';
  } else if (u < TW + K.hold) {
    th1 = K.thF;
    phase = 'holdF';
  } else if (u < 2 * TW + K.hold) {
    th1 = K.thF - W_DEG_S * (u - TW - K.hold);
    phase = 'unwind';
  } else {
    th1 = K.thB;
    phase = 'holdB';
  }
  return { th1, th2: 126 - 1.2 * th1, turns: (th1 - K.thB) / 360, phase, stopped: phase === 'holdF' || phase === 'holdB' };
}
