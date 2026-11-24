// 027 다중 기어 — 롤러 3개 달린 작은 삼각 바퀴가 큰 바퀴의 방사형 홈 6개 속을 미끄러지며 큰 바퀴를 돌린다 (판화 27번)
// 판화 그대로: 작은 바퀴는 큰 바퀴 **앞에 겹쳐** 있고, 작은 바퀴 축은 큰 바퀴 중심에서 롤러 원 반지름(a)만큼 떨어져 있다.
// 그러면 롤러 원이 큰 바퀴 중심을 지나고, 롤러 k 의 위치(큰 바퀴 중심 기준)는
//   a·(cos ψ, sin ψ − 1) = −2a·sin(u/2)·(cos(u/2), sin(u/2)),  u = ψ − π/2 = θ + 2πk/3
// 이라서 큰 바퀴가 θ/2 로 돌면 롤러는 늘 각 θ/2 + k·60° 의 지름(홈) 위에 있다(카르단 직선 운동).
// → 큰 바퀴는 **같은 방향, 정확히 절반 속도, 일정한 속도**로 돈다. 롤러 3개는 언제나 홈 안에 있다.
// (검증에서 고침: 처음에는 바퀴 밖에서 무는 간헐식 제네바로 만들었으나 판화의 배치·회전 방향과 달랐다.)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, multiGenevaDriver, rod, rotArrow, shaftZ, tag } from '../kit';
import { brass, castIron, darkSteel, paint } from '../../models/materials';
import { circlePts, lathe, loft, mesh, tubeProfile, type V2 } from '../../models/parts/geom';

const A = 0.36; // 롤러 원 반지름 = 두 축 사이 거리
const O2 = { x: 0, y: 1.8 }; // 큰 바퀴 중심
const O1 = { x: 0, y: 1.8 - A }; // 작은 바퀴(구동) 중심 — 큰 바퀴 중심 바로 아래
const R = 0.84; // 큰 바퀴 바깥 반지름
const RI = 0.7; // 테두리 안쪽 반지름(쐐기 구멍의 바깥 호)
const HS = 0.045; // 홈 반폭(롤러 반지름 0.035 + 틈 0.01)
const XE = 2 * A + 0.005; // 홈 끝 반원의 중심 반지름(롤러가 가장 멀리 가는 곳 2a)
const WS = 0.085; // 살 반폭(홈 양옆 레일 0.04 씩)
const T = 0.09; // 큰 바퀴 두께
const GD = 0.05; // 홈 깊이
const ZF = 0.12; // 큰 바퀴 앞면 z
const ZD = ZF + 0.06; // 작은 바퀴 판 뒷면 z (롤러는 여기서 −Z 로 0.10 → 홈 바닥 위 0.01)
const ZP = 0.5; // 앞 받침 기둥 z

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const rot = (x: number, y: number, a: number): V2 => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];

/** 살 사이 쐐기 구멍 j (살 j 와 살 j+1 사이, 반시계 점열) */
function wedgeHole(j: number): V2[] {
  const a0 = (j * Math.PI) / 3;
  const a1 = a0 + Math.PI / 3;
  const d = Math.asin(WS / RI);
  const pts: V2[] = [rot(2 * WS, 0, a0 + Math.PI / 6)]; // 꼭짓점: 두 살 벽이 만나는 곳
  for (let k = 0; k <= 10; k++) {
    const a = a0 + d + ((a1 - a0 - 2 * d) * k) / 10;
    pts.push([RI * Math.cos(a), RI * Math.sin(a)]);
  }
  return pts;
}

/** 홈 6개(지름 3개)가 중심에서 만나는 별 모양 구멍(반시계 점열) */
function starHole(): V2[] {
  const pts: V2[] = [];
  for (let j = 0; j < 6; j++) {
    const a = (j * Math.PI) / 3;
    pts.push(rot(2 * HS * Math.cos(Math.PI / 6), -HS, a)); // 앞 홈 벽과 만나는 안쪽 모서리
    for (let k = 0; k <= 8; k++) {
      const t = -Math.PI / 2 + (Math.PI * k) / 8;
      pts.push(rot(XE + HS * Math.cos(t), HS * Math.sin(t), a));
    }
  }
  return pts;
}

/** 큰 바퀴: 테두리 + 홈 파인 살 6개 + 쐐기 구멍. 로컬 Z = 회전축, 앞면 z = 0, 홈 j 는 로컬 각 j·60° */
function slottedWheel(): THREE.Group {
  const g = new THREE.Group();
  const body = brass();
  const rim = circlePts(R, 96);
  const wedges = [0, 1, 2, 3, 4, 5].map(wedgeHole);
  // 뒤층(홈 바닥): 쐐기 구멍만 뚫림
  g.add(mesh(loft(rim, wedges, [
    { z: -T, s: 0.993, hs: 1 },
    { z: -T + 0.006, s: 1, hs: 1 },
    { z: -GD, s: 1, hs: 1 }
  ]), body));
  // 앞층(레일): 쐐기 구멍 + 별 모양 홈
  g.add(mesh(loft(rim, [starHole(), ...wedges], [
    { z: -GD, s: 1, hs: 1 },
    { z: -0.006, s: 1, hs: 1 },
    { z: 0, s: 0.993, hs: 1 }
  ]), body));
  // 뒤 허브(축이 뒤에서 끼워진다 — 앞쪽 중심은 롤러가 지나가므로 비워 둔다)
  const hub = lathe(tubeProfile(0.045, 0.12, -T - 0.03, -T + 0.002, 0.008), 32);
  hub.rotateX(Math.PI / 2);
  g.add(mesh(hub, darkSteel()));
  // 회전 표시: 테두리 앞면(홈 0 과 홈 1 사이)
  const mark = mesh(new THREE.BoxGeometry(0.1, 0.03, 0.008), paint(0xd8362f));
  const [mx, my] = rot(0.77, 0, Math.PI / 6);
  mark.position.set(mx, my, 0.004);
  mark.rotation.z = Math.PI / 6;
  g.add(mark);
  return g;
}

export default function buildM027(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 큰 바퀴 — 축은 뒤판에서 나와 바퀴 뒤쪽에 끼워진다(앞으로 나오지 않는다)
  const wheel = slottedWheel();
  wheel.position.set(O2.x, O2.y, ZF);
  g.add(wheel, shaftZ(O2.x, O2.y, ZF - GD - 0.005, 0.045));

  // 작은 삼각 바퀴(구동) — 큰 바퀴 앞. 롤러(로컬 각 π/2 + 2πk/3, 반지름 a)가 홈 속으로 들어간다
  const driver = multiGenevaDriver(2 * A, { driver: true });
  driver.position.set(O1.x, O1.y, ZD);
  g.add(driver);
  // 구동축은 앞으로 나온다(뒤로는 도는 큰 바퀴가 가로막는다) — 받침에서 올라온 앞 기둥의 고리가 받친다
  const dShaft = new THREE.Group();
  dShaft.position.set(O1.x, O1.y, 0);
  dShaft.add(rod(v(0, 0, ZD - 0.008), v(0, 0, 0.6), 0.045));
  const flag = mesh(new THREE.BoxGeometry(0.02, 0.09, 0.02), paint(0xf2b619));
  flag.position.set(0, 0.06, 0.4);
  dShaft.add(flag);
  g.add(dShaft);
  const ring = lathe(tubeProfile(0.047, 0.085, -0.05, 0.05, 0.008), 36);
  ring.rotateX(Math.PI / 2);
  const ringMesh = mesh(ring, darkSteel());
  ringMesh.position.set(O1.x, O1.y, ZP);
  const colH = O1.y - 0.08 - 0.18;
  const col = mesh(new THREE.BoxGeometry(0.08, colH, 0.08), castIron());
  col.position.set(O1.x, 0.18 + colH / 2, ZP);
  const foot = mesh(new THREE.BoxGeometry(0.3, 0.05, 0.2), castIron());
  foot.position.set(O1.x, 0.205, ZP);
  g.add(ringMesh, col, foot);

  const a1 = rotArrow(0.2, true);
  a1.position.set(O1.x, O1.y, 0.3);
  const a2 = rotArrow(0.93, true);
  a2.position.set(O2.x, O2.y, ZF + 0.01);
  g.add(a1, a2);

  g.add(
    tag('작은 삼각 바퀴(구동)', v(1.35, 0.8, 0.3)),
    tag('큰 바퀴(홈 6개)', v(1.35, 2.75, 0.2)),
    tag('롤러(홈을 따라 미끄러짐)', v(-1.3, 0.8, 0.3))
  );

  return {
    group: g,
    view: { pos: [-1.7, 2.9, 5.2], target: [0, 1.65, 0.1] },
    notes: () => [
      { label: '구동 : 종동', value: '2 : 1 (롤러 3개 · 홈 6개)' },
      { label: '큰 바퀴 속도', value: '구동의 1/2 (일정)' },
      { label: '회전 방향', value: '같은 방향' },
      { label: '큰 바퀴 회전', value: (theta / 2 / (2 * Math.PI)).toFixed(2) + ' 바퀴' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      driver.rotation.z = theta;
      dShaft.rotation.z = theta;
      wheel.rotation.z = theta / 2; // 롤러 k 는 늘 홈 각 θ/2 + k·60° 의 지름 위
    }
  };
}
