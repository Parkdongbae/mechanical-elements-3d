// 231 드래그 링크 — 위 크랭크(황동, 구동)가 일정히 돌면 긴 파란 링크가 아래 흰 크랭크를 잡아당겨
// 한 바퀴씩 따라 돌게 한다(빨라졌다 느려졌다 0.50~2.06배). 뒤판 눈금 12개는 크랭크 1 이 30°마다
// 크랭크 2 가 오는 자리(간격 불균일). 층: 크랭크 1(뒤) → 링크(가운데) → 크랭크 2(앞).
// 설계표: docs/mm507-sheets/231.md
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { circleIntersect, displayStand, leaderTo, rotArrow, shaftZ, tag, type V2 } from '../kit';
import { mesh } from '../../models/parts/geom';
import { brass, darkSteel, paint, steel } from '../../models/materials';

// 상수 — 설계표 그대로
const O1: V2 = [0, 2.15]; // 축 1(뒤판)
const O2: V2 = [0, 1.71]; // 축 2(앞 받침) — 축 간 0.44
const A1 = 0.94; // 크랭크 1 (O1 → 핀 1)
const LINK = 1.23; // 링크 (핀 1 → 핀 2, 가장 긴 막대)
const C2 = 0.98; // 크랭크 2 (O2 → 핀 2)
const PHI0 = 1.7314; // t=0 크랭크 1 각(rad) = 99.2°, 판화 자세
const W1 = 0.8; // 크랭크 1 각속도(rad/s) — 한 바퀴 7.854초
const PI = Math.PI;
const DEG = PI / 180;
// 뒤판 눈금 각(도, O2 기준): k=0..11 은 크랭크 1 이 30°·k 일 때 크랭크 2 각
const TICK_ANGLES = [100.14, 115.1, 131.24, 150.01, 172.33, 198.73, 229.97, 268.12, 317.89, 17.98, 60.85, 83.9];

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

/** 각을 (−π, π] 로 접음 — Δθ2 용 */
const foldPi = (a: number): number => {
  const d = a % (2 * PI);
  return d > PI ? d - 2 * PI : d < -PI ? d + 2 * PI : d;
};

/** Z축 방향 원기둥 메시 */
const cyl = (r: number, h: number, mat: THREE.Material, seg = 16): THREE.Mesh => {
  const geo = new THREE.CylinderGeometry(r, r, h, seg);
  geo.rotateX(PI / 2);
  return mesh(geo, mat);
};

/** 크랭크 판: 원 r0.12(축쪽) + 원 r0.08(d, 핀쪽) 바깥 접선 윤곽. 두께 0.06, 판 중심 z=0 */
function crankPlate(d: number, mat: THREE.Material): THREE.Mesh {
  const b = Math.acos(0.04 / d); // 접선 점 각(87.5° 근처)
  const s = new THREE.Shape();
  s.moveTo(0.12 * Math.cos(b), 0.12 * Math.sin(b));
  s.absarc(0, 0, 0.12, b, 2 * PI - b, false); // 큰 원: b → 360−b 반시계
  s.lineTo(d + 0.08 * Math.cos(b), -0.08 * Math.sin(b));
  s.absarc(d, 0, 0.08, -b, b, false); // 작은 원: −b → b 반시계
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: false, curveSegments: 32 });
  geo.translate(0, 0, -0.03);
  return mesh(geo, mat);
}

/** 한 시각의 자세 — t 만으로 결정적 */
interface Pose {
  phi: number;
  th2: number;
  p1x: number;
  p1y: number;
  p2x: number;
  p2y: number;
}

function solve(tt: number): Pose | null {
  const phi = PHI0 + W1 * tt;
  const p1x = A1 * Math.cos(phi);
  const p1y = O1[1] + A1 * Math.sin(phi);
  // 마지막 인자 false 고정 — true 면 다른 가지라 판화와 다른 자세(설계표 경고)
  const p2 = circleIntersect([p1x, p1y], LINK, O2, C2, false);
  if (p2 === null) return null; // 일어나지 않음(|P1−O2| = 0.50~1.38, 두 원 항상 만남)
  return { phi, p1x, p1y, p2x: p2[0], p2y: p2[1], th2: Math.atan2(p2[1] - O2[1], p2[0]) };
}

export default function buildM231(): MovementModel {
  const g = new THREE.Group();
  let t = 0;
  let cur: Pose = { phi: PHI0, th2: 0, p1x: 0, p1y: 0, p2x: 0, p2y: 0 };
  let k = 1; // 따르는/돌리는 빠르기 비

  g.add(displayStand());

  // 축 1: 뒤판 보스 → z 0.03(크랭크 1 판 속)
  const shaft1 = shaftZ(O1[0], O1[1], 0.03, 0.05);
  shaft1.name = 'shaft1';
  g.add(shaft1);

  // 크랭크 1(황동, 구동) + 노란 표지 + 핀 1
  const crank1 = new THREE.Group();
  crank1.name = 'crank1';
  crank1.position.set(O1[0], O1[1], 0.03);
  crank1.add(crankPlate(A1, brass()));
  const mark1 = mesh(new THREE.BoxGeometry(0.3, 0.04, 0.006), paint(0xf2b619));
  mark1.name = 'crank1Mark';
  mark1.position.set(0.4, 0, 0.033);
  crank1.add(mark1);
  const pin1 = cyl(0.04, 0.141, steel());
  pin1.name = 'pin1';
  pin1.position.set(A1, 0, 0.0405); // 세계 z 0.00~0.141
  const head1 = cyl(0.06, 0.015, paint(0xf2b619)); // 머리, 세계 z 0.141~0.156
  head1.position.set(0, 0, 0.078);
  pin1.add(head1);
  crank1.add(pin1);
  g.add(crank1);

  // 링크(파랑): 그룹 원점 = 핀 1 눈 중심, +X 가 핀 2 방향. 세계 z 0.08~0.14
  const link = new THREE.Group();
  link.name = 'link';
  const ls = new THREE.Shape();
  ls.moveTo(0, -0.07);
  ls.lineTo(LINK, -0.07);
  ls.absarc(LINK, 0, 0.07, -PI / 2, PI / 2, false);
  ls.lineTo(0, 0.07);
  ls.absarc(0, 0, 0.07, PI / 2, (3 * PI) / 2, false);
  const linkGeo = new THREE.ExtrudeGeometry(ls, { depth: 0.06, bevelEnabled: false, curveSegments: 32 });
  linkGeo.translate(0, 0, -0.03);
  link.add(mesh(linkGeo, paint(0x5b84b1)));
  g.add(link);

  // 크랭크 2(흰색, 종동) + 노란 끝 표지 + 핀 2. 세계 z 0.17~0.23
  const crank2 = new THREE.Group();
  crank2.name = 'crank2';
  crank2.position.set(O2[0], O2[1], 0.2);
  crank2.add(crankPlate(C2, paint(0xeef1f4)));
  const tip2 = mesh(new THREE.BoxGeometry(0.04, 0.16, 0.006), paint(0xf2b619));
  tip2.name = 'crank2Tip';
  tip2.position.set(0.8, 0, 0.033);
  crank2.add(tip2);
  const pin2 = cyl(0.04, 0.166, steel());
  pin2.name = 'pin2';
  pin2.position.set(C2, 0, -0.053); // 세계 z 0.064~0.23
  const head2 = cyl(0.06, 0.015, paint(0xf2b619)); // 머리, 세계 z 0.064~0.079
  head2.position.set(0, 0, -0.0755);
  pin2.add(head2);
  crank2.add(pin2);
  g.add(crank2);

  // 축 2: z 0.20~0.60, 크랭크 2 와 함께 돈다
  const shaft2 = cyl(0.05, 0.4, steel(), 24);
  shaft2.name = 'shaft2';
  shaft2.position.set(O2[0], O2[1], 0.4);
  g.add(shaft2);

  // 앞 받침(고정): 기둥 y 0.18~1.71(받침대 위) + 베어링 고리 z 0.44~0.56
  const frontStand = new THREE.Group();
  frontStand.name = 'frontStand';
  const column = mesh(new THREE.BoxGeometry(0.1, 1.53, 0.1), darkSteel());
  column.position.set(0, 0.945, 0.5);
  const bearing = cyl(0.1, 0.12, darkSteel(), 32);
  bearing.position.set(0, O2[1], 0.5);
  frontStand.add(column, bearing);
  g.add(frontStand);

  // 뒤판 눈금 12개(고정): 반지름 1.16, 긴 쪽이 반지름 방향. k=0 막대만 노랑
  const ticks = new THREE.Group();
  ticks.name = 'ticks';
  TICK_ANGLES.forEach((deg, i) => {
    const bar = mesh(new THREE.BoxGeometry(0.12, 0.022, 0.01), paint(i === 0 ? 0xf2b619 : 0xffffff));
    const a = deg * DEG;
    bar.position.set(1.16 * Math.cos(a), O2[1] + 1.16 * Math.sin(a), -0.295);
    bar.rotation.z = a;
    ticks.add(bar);
  });
  g.add(ticks);

  // 회전 화살표 둘(반시계, 맨 앞 공중 — 표시물)
  const arrow1 = rotArrow(0.2, true);
  arrow1.position.set(O1[0], O1[1], 0.65);
  const arrow2 = rotArrow(0.2, true);
  arrow2.position.set(O2[0], O2[1], 0.65);
  g.add(arrow1, arrow2);

  // 이름표 5 개 — 이름표 표대로
  g.add(
    leaderTo(tag('돌리는 크랭크', v(-1.96, 3.08, 0.3)), 'crank1'),
    leaderTo(tag('따르는 크랭크', v(2.22, 1.05, 0.3)), 'crank2'),
    leaderTo(tag('드래그 링크', v(2.14, 2.98, 0.3)), 'link'),
    leaderTo(tag('두 축 어긋남', v(-2.06, 0.46, 0.3)), 'shaft2'),
    leaderTo(tag('눈금: 30°마다', v(-2.0, 1.73, 0.0)), 'ticks')
  );

  const apply = (): void => {
    const p = solve(t);
    if (p === null) return; // 설계상 일어나지 않음 — 이전 자세 유지
    cur = p;
    // 빠르기 비 k: t+0.001 에서 한 번 더 풀어 Δθ2/Δφ (Δθ2 는 −π~π 로 접음)
    const q = solve(t + 0.001);
    if (q !== null) k = foldPi(q.th2 - p.th2) / (W1 * 0.001);
    crank1.rotation.z = p.phi;
    shaft1.rotation.z = p.phi;
    crank2.rotation.z = p.th2;
    shaft2.rotation.z = p.th2;
    link.position.set(p.p1x, p.p1y, 0.11);
    link.rotation.z = Math.atan2(p.p2y - p.p1y, p.p2x - p.p1x);
  };
  apply();

  return {
    group: g,
    notes: () => [
      { label: '돌리는 크랭크 각', value: `${(((cur.phi * 180) / PI) % 360).toFixed(0)}°` },
      { label: '따르는 크랭크 각', value: `${(((cur.th2 * 180) / PI + 360) % 360).toFixed(0)}°` },
      { label: '따르는 / 돌리는 빠르기', value: `${k.toFixed(2)}배 (0.50~2.06)` },
      { label: '한 바퀴', value: '돌리는 쪽 1 바퀴 = 따르는 쪽 1 바퀴' }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed;
      apply();
    },
    view: { pos: [-0.8, 2.75, 7.0], target: [0.0, 1.85, 0.15] }
  };
}
