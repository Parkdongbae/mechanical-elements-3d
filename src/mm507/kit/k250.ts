// 250번 마찰 줄이는 바퀴 받침 전용 키트 — 틀판 윤곽·바퀴·상태 식 (설계표 docs/mm507-sheets/250.md 「키트 추가」)
import * as THREE from 'three';
import { paint, steel } from '../../models/materials';
import { lathe, mesh, tubeProfile } from '../../models/parts/geom';
import { setMM } from './mm';

/** 250 상수 — 바퀴·축 치수와 z 층 */
export const K250 = {
  RW: 0.824, // 바퀴 테 반지름
  RS: 0.1, // 축 목 반지름
  WX: 0.608, // 바퀴 중심 x
  WY: 1.564, // 바퀴 중심 y
  SY: 2.2598, // 축 중심 y = WY + √((RW+RS)² − WX²)
  RATIO: -0.12136, // 바퀴 각/축 각 = −RS/RW (미끄럼 없는 구름, 반대 방향)
  OMEGA: 0.8, // 축 각속도 rad/s
  Z: { frameFront: 0.6, frameMid: 0.3, frameBack: -0.03, wheelL1: 0.42, wheelR1: 0.52, wheelL2: -0.07, wheelR2: -0.17, pulley: 0.12 }
} as const;

/** 상태 식(결정적): 축 각 θs = 0.8·t, 바퀴 각 θw = −0.12136·θs */
export function state250(t: number): { thetaShaft: number; thetaWheel: number } {
  const thetaShaft = K250.OMEGA * t;
  return { thetaShaft, thetaWheel: K250.RATIO * thetaShaft };
}

/** 틀판 윤곽(세계 xy): 두 귀·안장 위 테 + 축 구멍 둘·작은 창 둘·큰 아치 창 */
export function frameShape250(): THREE.Shape {
  const s = new THREE.Shape();
  const sad0 = Math.atan2(1.828 - 1.982, 0.4736); // 안장 원호 오른쪽 끝각
  const sad1 = Math.atan2(1.828 - 1.982, -0.4736); // 안장 원호 왼쪽 끝각
  s.moveTo(-0.864, 0.18);
  s.lineTo(0.864, 0.18);
  s.lineTo(0.864, 1.664);
  s.absarc(0.7, 1.664, 0.164, 0, Math.PI / 2, false); // 오른쪽 귀 둥근 모서리
  s.lineTo(0.4736, 1.828);
  s.absarc(0, 1.982, 0.4984, sad0, sad1, true); // 안장 — 가운데가 오목하게
  s.lineTo(-0.7, 1.828);
  s.absarc(-0.7, 1.664, 0.164, Math.PI / 2, Math.PI, false); // 왼쪽 귀
  s.lineTo(-0.864, 0.18);
  // 축 구멍 둘
  for (const f of [1, -1]) {
    const h = new THREE.Path();
    h.absarc(f * K250.WX, K250.WY, 0.055, 0, Math.PI * 2, true);
    s.holes.push(h);
  }
  // 작은 창 둘 — 왼쪽 점들을 x 부호로 거울
  const win: [number, number][] = [[-0.64, 1.236], [-0.32, 1.236], [-0.448, 1.06], [-0.608, 0.884], [-0.64, 0.884]];
  for (const f of [1, -1]) {
    const p = new THREE.Path();
    const [wx0, wy0] = win[0]!;
    p.moveTo(f * wx0, wy0);
    for (let i = 1; i < win.length; i++) {
      const [px, py] = win[i]!;
      p.lineTo(f * px, py);
    }
    p.closePath();
    s.holes.push(p);
  }
  // 큰 아치 창
  const arch: [number, number][] = [
    [-0.624, 0.444], [0.624, 0.444], [0.624, 0.564], [0.528, 0.804], [0.336, 0.996],
    [0, 1.108], [-0.336, 0.996], [-0.528, 0.804], [-0.624, 0.564]
  ];
  const p = new THREE.Path();
  const [ax0, ay0] = arch[0]!;
  p.moveTo(ax0, ay0);
  for (let i = 1; i < arch.length; i++) {
    const [px, py] = arch[i]!;
    p.lineTo(px, py);
  }
  p.closePath();
  s.holes.push(p);
  return s;
}

/** 바퀴 하나: 테·허브·살 4(45° 살은 노란 표지). 회전축 = z, 원점 = 바퀴 중심 */
export function wheel250(): THREE.Group {
  const g = new THREE.Group();
  // 테
  const rimGeo = lathe(tubeProfile(0.76, K250.RW, -0.035, 0.035), 64);
  rimGeo.rotateX(Math.PI / 2);
  g.add(mesh(rimGeo, steel()));
  // 허브(축 구멍 0.05)
  const hubGeo = lathe(tubeProfile(0.05, 0.1, -0.035, 0.035), 32);
  hubGeo.rotateX(Math.PI / 2);
  g.add(mesh(hubGeo, steel()));
  // 바퀴살 4 — 반지름 0.10~0.76(중심 0.43), 45° 살 하나만 노랑
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    const sp = mesh(new THREE.BoxGeometry(0.66, 0.05, 0.04), k === 0 ? paint(0xf2b619) : steel());
    sp.position.set(Math.cos(a) * 0.43, Math.sin(a) * 0.43, 0);
    sp.rotation.z = a;
    g.add(sp);
  }
  setMM(g, { kind: 'wheel', r: K250.RW, width: 0.07, axis: 'z', rim: 'flat' });
  return g;
}
