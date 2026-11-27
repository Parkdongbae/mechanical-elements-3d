// 229 체인과 체인 풀리 3 — 고리의 갈고리 이가 14각형 바퀴의 꼭짓점 홈에 들어가 바퀴가 체인을 한 고리씩 끈다.
// 설계표 docs/mm507-sheets/229.md
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, tag, weight } from '../kit';
import { K229, notchWheel229, state229, toothedLink229 } from '../kit/k229';
import { lathe, mesh, rodProfile } from '../../models/parts/geom';
import { darkSteel, steel } from '../../models/materials';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const K = K229;
const [CX, CY] = K.C;
const Z0 = K.Z0;

/** 추 고리: 핀을 감싼 고리 + 막대 + 막대 끝 빈 점 */
function hook(name: string, tipName: string): THREE.Group {
  const g = new THREE.Group();
  g.name = name;
  const ring = mesh(new THREE.TorusGeometry(0.026, 0.007, 10, 24), darkSteel());
  ring.position.set(0, -0.007, 0);
  const rod = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.04, 16), darkSteel());
  rod.position.set(0, -0.06, 0);
  const tip = new THREE.Object3D();
  tip.name = tipName;
  tip.position.set(0, -0.08, 0);
  g.add(ring, rod, tip);
  return g;
}

export default function buildM229(): MovementModel {
  const g = new THREE.Group();
  let t = 0;
  g.add(displayStand());

  // 고정 축 + 뒤판 플랜지 + 앞 캡
  const axle = new THREE.Group();
  axle.name = 'axle';
  const axBody = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.55, 32), steel());
  axBody.rotation.x = Math.PI / 2;
  axBody.position.set(CX, CY, -0.025);
  const flange = mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.03, 40), darkSteel());
  flange.rotation.x = Math.PI / 2;
  flange.position.set(CX, CY, -0.285);
  const capGeo = lathe(rodProfile(0.07, 0, 0.02, 0.003, 0.003), 32);
  capGeo.rotateX(Math.PI / 2);
  const cap = mesh(capGeo, steel());
  cap.position.set(CX, CY, 0.21);
  axle.add(axBody, flange, cap);
  g.add(axle);

  // 홈 바퀴
  const sprocket = notchWheel229();
  sprocket.name = 'sprocket';
  sprocket.position.set(CX, CY, Z0);
  g.add(sprocket);

  // 고리 16 + 핀 17
  const links: Record<number, THREE.Group> = {};
  const pins: Record<number, THREE.Group> = {};
  for (let k = K.I_MIN; k < K.I_MAX; k++) {
    const l = toothedLink229(k);
    l.name = `link${k}`;
    links[k] = l;
    g.add(l);
  }
  for (let i = K.I_MIN; i <= K.I_MAX; i++) {
    const p = new THREE.Group();
    p.name = `pin${i}`;
    const body = new THREE.CylinderGeometry(0.012, 0.012, 0.184, 16);
    body.rotateX(Math.PI / 2);
    p.add(mesh(body, darkSteel()));
    for (const s of [-1, 1]) {
      const hg = new THREE.CylinderGeometry(0.02, 0.02, 0.006, 20);
      hg.rotateX(Math.PI / 2);
      const hm = mesh(hg, darkSteel());
      hm.position.z = s * 0.091;
      p.add(hm);
    }
    pins[i] = p;
    g.add(p);
  }

  // 추 + 추 고리
  const loadW = weight(0.18, 0.2);
  loadW.name = 'loadW';
  loadW.children[0]!.name = 'loadRing';
  const counterW = weight(0.12, 0.14);
  counterW.name = 'counterW';
  counterW.children[0]!.name = 'counterRing';
  const lh = hook('loadHook', 'loadHookTip');
  const ch = hook('counterHook', 'counterHookTip');
  g.add(loadW, counterW, lh, ch);

  g.add(
    leaderTo(tag('톱니 바퀴', v(-1.45, 3.0, 0.3)), 'sprocket'),
    leaderTo(tag('고리의 이', v(1.35, 3.05, 0.3)), 'link0'),
    leaderTo(tag('고리 판', v(1.5, 1.95, 0.3)), 'link3'),
    leaderTo(tag('짐 추', v(-1.25, 0.5, 0.3)), 'loadW'),
    leaderTo(tag('반대쪽 추', v(1.4, 0.55, 0.3)), 'counterW')
  );

  let st = state229(0);
  const apply = (): void => {
    st = state229(t);
    const J = st.J;
    sprocket.rotation.z = st.theta;
    for (let i = K.I_MIN; i <= K.I_MAX; i++) {
      const P = J[i - K.I_MIN]!;
      pins[i]!.position.set(CX + P[0], CY + P[1], Z0);
      if (i < K.I_MAX) {
        const Q = J[i + 1 - K.I_MIN]!;
        const l = links[i]!;
        l.position.set(CX + (P[0] + Q[0]) / 2, CY + (P[1] + Q[1]) / 2, Z0);
        l.rotation.z = Math.atan2(Q[1] - P[1], Q[0] - P[0]);
      }
    }
    const L = J[0]!;
    const R = J[K.I_MAX - K.I_MIN]!;
    lh.position.set(CX + L[0], CY + L[1], Z0);
    ch.position.set(CX + R[0], CY + R[1], Z0);
    loadW.position.set(CX + L[0], CY + L[1] - 0.2268, Z0);
    counterW.position.set(CX + R[0], CY + R[1] - 0.1812, Z0);
  };
  apply();

  return {
    group: g,
    notes: () => [
      { label: '바퀴 각', value: ((st.theta * 180) / Math.PI).toFixed(0) + '° (±60°)' },
      { label: '짐 높이', value: (CY + st.J[0]![1]).toFixed(3) },
      { label: '체인', value: '갈고리 이 달린 고리 16(핀 사이 0.280), 바퀴 홈 14' },
      { label: '원리', value: '고리의 갈고리 이가 바퀴 홈에 들어가 바퀴가 체인을 한 고리씩 끈다' }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed;
      apply();
    },
    view: { pos: [0.5, 2.1, 5.2], target: [0, 1.75, 0.15] }
  };
}
