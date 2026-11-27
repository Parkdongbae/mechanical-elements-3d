// 227 체인과 체인 풀리 — 별 모양 바퀴의 골에는 판 고리가 눕고, 별의 이는 판과 직각으로 선 철사 고리의 구멍으로 들어가
// 체인이 미끄러지지 않고 바퀴를 따라 오르내린다. 설계표 docs/mm507-sheets/227.md
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, tag, weight } from '../kit';
import { K227, chainLoop227, chainPlate227, starWheel227, state227 } from '../kit/k227';
import { lathe, mesh, rodProfile } from '../../models/parts/geom';
import { darkSteel, steel } from '../../models/materials';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const K = K227;
const [CX, CY] = K.C;
const Z0 = K.Z0;

/** 추 고리: 끝 판 구멍에 걸린 둥근 고리 + 막대 + 막대 끝 빈 점(name tip) */
function hook(name: string, tipName: string): { g: THREE.Group; tip: THREE.Object3D } {
  const g = new THREE.Group();
  g.name = name;
  const ring = mesh(new THREE.TorusGeometry(0.03, 0.008, 10, 24), darkSteel());
  ring.rotation.y = Math.PI / 2;
  ring.position.set(0, -0.026, 0);
  const rod = mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.04, 16), darkSteel());
  rod.position.set(0, -0.08, 0);
  const tip = new THREE.Object3D();
  tip.name = tipName;
  tip.position.set(0, -0.1, 0);
  g.add(ring, rod, tip);
  return { g, tip };
}

export default function buildM227(): MovementModel {
  const g = new THREE.Group();
  let t = 0;
  g.add(displayStand());

  // 고정 축 + 뒤판 플랜지 + 앞 캡
  const axle = new THREE.Group();
  axle.name = 'axle';
  const axBody = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.55, 32), steel());
  axBody.rotation.x = Math.PI / 2;
  axBody.position.set(CX, CY, -0.025);
  const flange = mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.03, 40), darkSteel());
  flange.rotation.x = Math.PI / 2;
  flange.position.set(CX, CY, -0.285);
  const capGeo = lathe(rodProfile(0.093, 0, 0.02, 0.003, 0.003), 32);
  capGeo.rotateX(Math.PI / 2);
  const cap = mesh(capGeo, steel());
  cap.position.set(CX, CY, 0.21);
  axle.add(axBody, flange, cap);
  g.add(axle);

  // 별 모양 바퀴
  const star = starWheel227();
  star.name = 'star';
  star.position.set(CX, CY, Z0);
  g.add(star);

  // 체인: 판 고리 9(칸 짝수) + 철사 고리 8(칸 홀수)
  const plates: Record<number, THREE.Mesh> = {};
  const loops: Record<number, THREE.Mesh> = {};
  for (let i = -8; i <= 8; i++) {
    if (((i % 2) + 2) % 2 === 0) {
      const p = chainPlate227();
      p.name = `plate${i / 2}`;
      plates[i] = p;
      g.add(p);
    } else {
      const l = chainLoop227();
      l.name = `loop${(i - 1) / 2}`;
      loops[i] = l;
      g.add(l);
    }
  }

  // 추 + 추 고리
  const loadW = weight(0.2, 0.24);
  loadW.name = 'loadW';
  loadW.children[0]!.name = 'loadRing';
  const counterW = weight(0.14, 0.16);
  counterW.name = 'counterW';
  counterW.children[0]!.name = 'counterRing';
  const lh = hook('loadHook', 'loadHookTip');
  const ch = hook('counterHook', 'counterHookTip');
  g.add(loadW, counterW, lh.g, ch.g);

  g.add(
    leaderTo(tag('별 모양 풀리', v(-1.45, 3.0, 0.3)), 'star'),
    leaderTo(tag('판 고리', v(1.35, 3.05, 0.3)), 'plate0'),
    leaderTo(tag('철사 고리', v(1.45, 2.25, 0.3)), 'loop0'),
    leaderTo(tag('짐 추', v(-1.25, 0.6, 0.3)), 'loadW'),
    leaderTo(tag('반대쪽 추', v(1.35, 0.75, 0.3)), 'counterW')
  );

  let st = state227(0);
  const apply = (): void => {
    st = state227(t);
    const J = st.J;
    star.rotation.z = st.theta;
    for (let i = -8; i <= 8; i++) {
      const P = J[i - K.I_MIN]!;
      const Q = J[i + 1 - K.I_MIN]!;
      const o = plates[i] ?? loops[i]!;
      o.position.set(CX + (P[0] + Q[0]) / 2, CY + (P[1] + Q[1]) / 2, Z0);
      o.rotation.z = Math.atan2(Q[1] - P[1], Q[0] - P[0]);
    }
    const L = J[0]!; // 마디 −8
    const R = J[K.I_MAX - K.I_MIN]!; // 마디 9
    lh.g.position.set(CX + L[0], CY + L[1], Z0);
    ch.g.position.set(CX + R[0], CY + R[1], Z0);
    loadW.position.set(CX + L[0], CY + L[1] - 0.272, Z0);
    counterW.position.set(CX + R[0], CY + R[1] - 0.2164, Z0);
  };
  apply();

  return {
    group: g,
    notes: () => [
      { label: '바퀴 각', value: ((st.theta * 180) / Math.PI).toFixed(0) + '° (±60°)' },
      { label: '짐 높이', value: (CY + st.J[0]![1]).toFixed(3) },
      { label: '고리', value: '판 고리 9(구멍 사이 0.221) · 철사 고리 8(0.276) 번갈아' },
      { label: '원리', value: '판 고리는 골에 눕고, 별의 이는 직각으로 선 철사 고리 구멍에 들어가 체인을 끈다' }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed;
      apply();
    },
    view: { pos: [1.2, 2.3, 5.3], target: [0, 1.72, 0.15] }
  };
}
