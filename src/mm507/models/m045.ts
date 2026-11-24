// 045 마찰 홈 기어 — 이가 없는 두 바퀴의 V 홈 비탈면이 서로 눌려 마찰로 전달한다 (판화 45번)
// 판화: 위 작은 바퀴(양 끝 능선·홈 5줄)와 아래 큰 바퀴(능선 5줄)가 맞닿고, 오른쪽은 맞닿는 곳을 키운 단면(정지).
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { bronze, brass, steel } from '../../models/materials';
import { extrude, mesh, shapeFrom } from '../../models/parts/geom';
import { displayStand, rod, rotArrow, tag, STAGE } from '../kit';
import { grooveWheel } from '../kit/gear5';
import { setMM } from '../kit/mm';

const RA = 0.34; // 위 바퀴(구동) 피치 반지름
const RB = 0.47; // 아래 바퀴(피동)
const ZC = 0.27;
const X0 = -0.55;
const Y2 = 1.3;
const Y1 = Y2 + RA + RB + 0.0015; // 면이 겹쳐 깜박이지 않게 틈
const AX = Math.PI / 2;

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

/** 뒤판에서 나온 기둥 + 축이 지나는 끝 고리 */
function post(x: number, y: number): THREE.Group {
  const g = new THREE.Group();
  const len = ZC - STAGE.backZ;
  const col = new THREE.CylinderGeometry(0.07, 0.07, len, 24);
  col.rotateX(Math.PI / 2);
  const c = mesh(col, steel());
  c.position.set(x, y, STAGE.backZ + len / 2);
  g.add(c);
  const ring = new THREE.CylinderGeometry(0.085, 0.085, 0.07, 28);
  ring.rotateZ(Math.PI / 2);
  const r = mesh(ring, steel());
  r.position.set(x, y, ZC);
  g.add(r);
  return g;
}

/** 확대 단면: 위 덩어리(bronze) 능선이 아래로, 아래 덩어리(brass) 홈에 끼는 지그재그 — 뒤판에 붙인 판 */
function section(): THREE.Group {
  const g = new THREE.Group();
  const P = 0.17;
  const D = 0.13;
  const NZ = 4;
  const W = NZ * P;
  const XC = 1.3;
  const YC = 1.72;
  const zig: [number, number][] = [];
  for (let i = 0; i <= NZ * 2; i++) {
    const x = -W / 2 + (i * P) / 2;
    const ridge = i % 2 === 0 ? 1 : -1; // 위 덩어리의 능선(아래로 향함) = 낮은 점
    zig.push([XC + x, YC - (D / 2) * ridge]);
  }
  const GAP = 0.004;
  const up = shapeFrom([[XC - W / 2, 2.52], [XC + W / 2, 2.52], ...zig.slice().reverse()]);
  const lo = shapeFrom([[XC - W / 2, 0.87], ...zig.map(([x, y]): [number, number] => [x, y - GAP]), [XC + W / 2, 0.87]]);
  const t = 0.14;
  for (const [s, m] of [[up, bronze()], [lo, brass()]] as const) {
    const me = mesh(extrude(s, t, 0.004), m);
    me.position.z = STAGE.backZ;
    g.add(me);
  }
  setMM(g, { kind: 'part', fn: 'section' });
  return g;
}

export default function buildM045(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  const A = grooveWheel(RA, { ridgeAtCenter: false, driver: true });
  A.name = 'wheelA';
  A.position.set(X0, Y1, ZC);
  const B = grooveWheel(RB, { ridgeAtCenter: true });
  B.name = 'wheelB';
  B.position.set(X0, Y2, ZC);
  g.add(A, B);

  for (const y of [Y1, Y2]) {
    g.add(rod(v(X0 - 0.42, y, ZC), v(X0 + 0.42, y, ZC), 0.045));
    for (const s of [-1, 1]) g.add(post(X0 + s * 0.36, y));
  }

  g.add(section());

  const ra = rotArrow(0.4, true);
  ra.rotation.y = AX;
  ra.position.set(X0 + 0.5, Y1, ZC);
  const rb = rotArrow(0.4, false);
  rb.rotation.y = AX;
  // 호의 빈 곳(110°)을 위(위 기어 화살표 쪽)로 — 시계 화살표 250° 호가 위 화살표 호와 맞닿지 않게
  rb.rotation.z = (98 * Math.PI) / 180;
  rb.position.set(X0 + 0.5, Y2, ZC);
  g.add(ra, rb);

  g.add(
    tag('구동 바퀴(V 홈)', v(-1.7, 2.11, 0.5)),
    tag('피동 바퀴(V 홈)', v(-1.7, 1.3, 0.5)),
    tag('홈의 비탈면이 서로 눌려 마찰로 전달', v(0.2, 2.8, 0.5)),
    tag('확대 단면', v(1.3, 2.75, 0.3))
  );

  const qy = new THREE.Quaternion().setFromAxisAngle(v(0, 1, 0), AX);
  const qa = new THREE.Quaternion();
  const qb = new THREE.Quaternion();
  const ex = v(1, 0, 0);

  const apply = (): void => {
    A.quaternion.copy(qa.setFromAxisAngle(ex, theta)).multiply(qy);
    B.quaternion.copy(qb.setFromAxisAngle(ex, -(RA / RB) * theta)).multiply(qy);
  };
  apply();

  return {
    group: g,
    notes: () => [
      { label: '속도비', value: '1 : 0.72 (반대 방향)' },
      { label: '전달 방식', value: '마찰(이 없음)' },
      { label: '홈', value: 'V 홈 5줄' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
