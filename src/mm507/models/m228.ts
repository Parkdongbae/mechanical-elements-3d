// 228 체인과 체인 풀리 2 — 드럼 테 위의 쐐기 이 사이에 사다리 체인의 가로대가 끼어 체인이 미끄럼 없이 오르내린다.
// 설계표 docs/mm507-sheets/228.md
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, tag, weight } from '../kit';
import { K228, state228, wedge228 } from '../kit/k228';
import { lathe, mesh, tubeProfile } from '../../models/parts/geom';
import { brass, darkSteel, steel } from '../../models/materials';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const K = K228;
const [CX, CY] = K.C;
const Z0 = K.Z0;

/** 축 z 의 속 빈 원통(안 반지름 rIn)을 z0 ~ z1 에(그룹 로컬 z) */
function tubeZ(rIn: number, rOut: number, z0: number, z1: number, mat: THREE.Material, c = 0.003): THREE.Mesh {
  const geo = lathe(tubeProfile(rIn, rOut, 0, z1 - z0, c), 40);
  geo.rotateX(Math.PI / 2);
  const m = mesh(geo, mat);
  m.position.z = z0;
  return m;
}

function yoke(name: string, tipName: string): { g: THREE.Group; tip: THREE.Object3D } {
  const g = new THREE.Group();
  g.name = name;
  for (const s of [-1, 1]) {
    const b = mesh(new THREE.BoxGeometry(0.02, 0.1, 0.02), darkSteel());
    b.position.set(0, -0.05, s * 0.175);
    g.add(b);
  }
  const bar = mesh(new THREE.BoxGeometry(0.02, 0.02, 0.37), darkSteel());
  bar.position.set(0, -0.1, 0);
  g.add(bar);
  const tip = new THREE.Object3D();
  tip.name = tipName;
  tip.position.set(0, -0.11, 0);
  g.add(tip);
  return { g, tip };
}

export default function buildM228(): MovementModel {
  const g = new THREE.Group();
  let t = 0;
  g.add(displayStand());

  // 뒤판 축받이(고정): 플랜지 + 보스, 구멍 0.05 (세계 z)
  const wb = new THREE.Group();
  wb.name = 'wallBearing';
  wb.position.set(CX, CY, 0);
  wb.add(tubeZ(0.05, 0.15, -0.3, -0.27, darkSteel()), tubeZ(0.05, 0.09, -0.27, -0.12, darkSteel()));
  g.add(wb);

  // 드럼 그룹(회전, 로컬 z = 세계 z − 0.15)
  const spin = new THREE.Group();
  spin.name = 'drumSpin';
  spin.position.set(CX, CY, Z0);
  const drum = tubeZ(0.05, K.R_DRUM, -0.15, 0.15, brass(), 0.008);
  drum.name = 'drum';
  const hub = tubeZ(0.05, 0.1, 0.15, 0.19, brass(), 0.004);
  const axGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.75, 32);
  axGeo.rotateX(Math.PI / 2);
  const axle = mesh(axGeo, steel());
  axle.name = 'drumAxle';
  axle.position.z = -0.075; // 세계 z −0.30 ~ 0.45
  const collar = tubeZ(0.05, 0.08, 0.19, 0.23, steel(), 0.004); // 세계 z 0.34 ~ 0.38
  spin.add(drum, hub, axle, collar);
  for (let k = 0; k < 12; k++) {
    const w = wedge228();
    w.name = `wedge${k}`;
    w.rotation.z = ((15 + 30 * k) * Math.PI) / 180;
    spin.add(w);
  }
  g.add(spin);

  // 사다리 체인
  const rungs: Record<number, THREE.Group> = {};
  const sideA: Record<number, THREE.Mesh> = {};
  const sideB: Record<number, THREE.Mesh> = {};
  for (let i = K.I_MIN; i <= K.I_MAX; i++) {
    const r = new THREE.Group();
    r.name = `rung${i}`;
    const cg = new THREE.CylinderGeometry(0.02, 0.02, 0.35, 20);
    cg.rotateX(Math.PI / 2);
    r.add(mesh(cg, steel()));
    for (const s of [-1, 1]) {
      const sp = mesh(new THREE.SphereGeometry(0.026, 16, 12), steel());
      sp.position.z = s * 0.175;
      r.add(sp);
    }
    rungs[i] = r;
    g.add(r);
    if (i < K.I_MAX) {
      const a = mesh(new THREE.CylinderGeometry(0.012, 0.012, K.P, 12), steel());
      a.name = `sideA${i}`;
      const b = mesh(new THREE.CylinderGeometry(0.012, 0.012, K.P, 12), steel());
      b.name = `sideB${i}`;
      sideA[i] = a;
      sideB[i] = b;
      g.add(a, b);
    }
  }

  // 추 + 멍에
  const loadW = weight(0.18, 0.2);
  loadW.name = 'loadW';
  loadW.children[0]!.name = 'loadRing';
  const counterW = weight(0.12, 0.14);
  counterW.name = 'counterW';
  counterW.children[0]!.name = 'counterRing';
  const ly = yoke('loadYoke', 'loadHookTip');
  const cy = yoke('counterYoke', 'counterHookTip');
  g.add(loadW, counterW, ly.g, cy.g);

  g.add(
    leaderTo(tag('드럼 바퀴', v(1.4, 3.0, 0.3)), 'drum'),
    leaderTo(tag('쐐기 이', v(-1.4, 3.05, 0.3)), 'wedge0'),
    leaderTo(tag('가로대', v(-1.6, 1.95, 0.3)), 'rung-3'),
    leaderTo(tag('사다리 체인', v(1.6, 1.8, 0.3)), 'sideA4'),
    leaderTo(tag('짐 추', v(-1.45, 0.8, 0.3)), 'loadW'),
    leaderTo(tag('반대쪽 추', v(1.55, 0.55, 0.3)), 'counterW')
  );

  let st = state228(0);
  const apply = (): void => {
    st = state228(t);
    const J = st.J;
    spin.rotation.z = st.theta;
    for (let i = K.I_MIN; i <= K.I_MAX; i++) {
      const P = J[i - K.I_MIN]!;
      rungs[i]!.position.set(CX + P[0], CY + P[1], Z0);
      if (i < K.I_MAX) {
        const Q = J[i + 1 - K.I_MIN]!;
        const mx = CX + (P[0] + Q[0]) / 2;
        const my = CY + (P[1] + Q[1]) / 2;
        const rz = Math.atan2(Q[1] - P[1], Q[0] - P[0]) - Math.PI / 2;
        sideA[i]!.position.set(mx, my, Z0 + 0.175);
        sideB[i]!.position.set(mx, my, Z0 - 0.175);
        sideA[i]!.rotation.z = rz;
        sideB[i]!.rotation.z = rz;
      }
    }
    const L = J[0]!;
    const R = J[K.I_MAX - K.I_MIN]!;
    ly.g.position.set(CX + L[0], CY + L[1], Z0);
    cy.g.position.set(CX + R[0], CY + R[1], Z0);
    loadW.position.set(CX + L[0], CY + L[1] - 0.2568, Z0);
    counterW.position.set(CX + R[0], CY + R[1] - 0.2112, Z0);
  };
  apply();

  return {
    group: g,
    notes: () => [
      { label: '드럼 각', value: ((st.theta * 180) / Math.PI).toFixed(0) + '° (±60°)' },
      { label: '짐 높이', value: (CY + st.J[0]![1]).toFixed(3) },
      { label: '체인', value: '양쪽 줄 + 가로대 15(간격 0.297), 쐐기 12' },
      { label: '원리', value: '가로대가 쐐기 사이에 끼어 드럼이 돌면 체인이 미끄럼 없이 따라간다' }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed;
      apply();
    },
    view: { pos: [-2.0, 3.0, 4.6], target: [0, 1.72, 0.15] }
  };
}
