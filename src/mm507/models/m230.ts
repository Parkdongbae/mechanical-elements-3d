// 230 데드 포인트를 피하는 연결봉 — 위·아래 축을 연결봉 두 쌍으로 잇고 두 쌍을 90° 어긋나 놓아,
// 한 쌍이 사점(크랭크가 세로)일 때 다른 쌍이 수평(힘 팔 최대) → 플라이휠 없이 연속 회전 (판화 230번).
// 설계표 docs/mm507-sheets/230.md — 키트 추가 없음, THREE 기본 도형만.
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, tag } from '../kit';
import { mesh } from '../../models/parts/geom';
import { brass, darkSteel, paint, steel } from '../../models/materials';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

// ── 상수 (설계표 「부품과 치수」) ──
const O1Y = 2.45; // 위 축 y
const O2Y = 0.95; // 아래 축 y
const MIDY = (O1Y + O2Y) / 2; // 1.70 — 두 축 가운데(연결봉 중심)
const CR = 0.30; // 크랭크 반지름 — 원판 핀·뒤 크랭크 핀 공통
const LEN = 1.50; // 축 간 거리 = 연결봉 길이
const DISC_R = 0.42; // 원판 반지름
const PHI0 = Math.PI / 3; // t=0 원판 핀 각 60°(판화 자세)
const OMEGA = 0.7; // 구동 각속도 rad/s — 한 바퀴 8.98 초
const DEAD = 0.17; // |cos각| < DEAD 면 사점(세로 ±10° 안)
const ZF = 0.59; // 앞 연결봉 z (0.56~0.62)
const ZB = -0.15; // 뒤 연결봉 z (−0.18~−0.12)

/** 뒤 크랭크 팔 윤곽: 허브 원(0,0 r 0.09)과 핀 원(0.30,0 r 0.065)의 바깥 접선 모양 */
function crankArmGeo(): THREE.BufferGeometry {
  const HUB = 0.09;
  const PINR = 0.065;
  const beta = Math.acos((HUB - PINR) / CR); // 85.22°
  const s = new THREE.Shape();
  s.moveTo(HUB * Math.cos(beta), HUB * Math.sin(beta)); // (0.0075, 0.0897)
  s.absarc(0, 0, HUB, beta, 2 * Math.PI - beta, false); // 허브 왼쪽(180°) 지나 (0.0075, −0.0897)
  s.absarc(CR, 0, PINR, -beta, beta, false); // 핀 원 오른쪽(0°) 지나 (0.3054, 0.0648)
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: false, curveSegments: 24 });
  geo.translate(0, 0, -0.03); // 로컬 z −0.03~0.03
  return geo;
}

export default function buildM230(): MovementModel {
  const g = new THREE.Group();
  g.add(displayStand());

  // 연결봉 재질 두 개를 미리 만든다(사점 빨강 전환 — 매 프레임 새로 만들지 않음)
  const rodBrass = brass();
  const rodRed = paint(0xd8362f);

  // 받침 기둥 + 팔 둘 + 베어링 고리 둘 (고정 — 판화에 없는 보충)
  const column = mesh(new THREE.BoxGeometry(0.12, 2.44, 0.12), darkSteel());
  column.name = 'column';
  column.position.set(1.15, 1.40, 0.20); // 받침대 윗면(y 0.18)에 섬
  g.add(column);
  for (const [i, y] of [[1, O1Y], [2, O2Y]] as const) {
    const arm = mesh(new THREE.BoxGeometry(1.0, 0.10, 0.08), darkSteel());
    arm.name = `arm${i}`;
    arm.position.set(0.59, y, 0.20); // x 0.09~1.09 — 기둥 면과 고리에 닿음
    g.add(arm);
    const ringGeo = new THREE.CylinderGeometry(0.10, 0.10, 0.12, 32);
    ringGeo.rotateX(Math.PI / 2);
    const ring = mesh(ringGeo, darkSteel());
    ring.name = `bearing${i}`;
    ring.position.set(0, y, 0.20); // z 0.14~0.26 — 축 가운데 층
    g.add(ring);
  }

  // 축 둘 (rotation.z = φ)
  const shafts: THREE.Mesh[] = [];
  for (const [i, y] of [[1, O1Y], [2, O2Y]] as const) {
    const geo = new THREE.CylinderGeometry(0.05, 0.05, 0.67, 24);
    geo.rotateX(Math.PI / 2);
    const s = mesh(geo, steel());
    s.name = `shaft${i}`;
    s.position.set(0, y, 0.22); // z −0.115~0.555
    g.add(s);
    shafts.push(s);
  }

  /** 원판 그룹: 판 + 노란 표지 + 앞 핀(노란 머리) — rotation.z = φ */
  const mkDisc = (name: string, pinName: string, y: number): THREE.Group => {
    const grp = new THREE.Group();
    grp.name = name;
    grp.position.set(0, y, 0.53);
    const plateGeo = new THREE.CylinderGeometry(DISC_R, DISC_R, 0.06, 48);
    plateGeo.rotateX(Math.PI / 2);
    grp.add(mesh(plateGeo, paint(0x8fa3b8))); // 밝은 청회색 — 검은 재질 금지(설계표)
    const mark = mesh(new THREE.BoxGeometry(0.24, 0.03, 0.006), paint(0xf2b619));
    mark.position.set(0.15, 0, 0.033); // 중심에서 핀 쪽으로
    grp.add(mark);
    const pinGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.09, 16);
    pinGeo.rotateX(Math.PI / 2);
    const pin = mesh(pinGeo, steel());
    pin.name = pinName;
    pin.position.set(CR, 0, 0.045); // 세계 z 0.53~0.62
    const headGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.025, 16);
    headGeo.rotateX(Math.PI / 2);
    const head = mesh(headGeo, paint(0xf2b619));
    head.position.set(0, 0, 0.0575); // 세계 z 0.62~0.645 (층 표 기준 — 핀 중심 0.045 만큼 뺀 핀 로컬)
    pin.add(head);
    grp.add(pin);
    return grp;
  };
  const disc1 = mkDisc('disc1', 'pinF1', O1Y);
  const disc2 = mkDisc('disc2', 'pinF2', O2Y);
  g.add(disc1, disc2);

  // 뒤 크랭크 둘 (rotation.z = ψ)
  const armGeo = crankArmGeo();
  const mkCrank = (name: string, pinName: string, y: number): THREE.Group => {
    const grp = new THREE.Group();
    grp.name = name;
    grp.position.set(0, y, -0.09);
    grp.add(mesh(armGeo, brass())); // 팔: 세계 z −0.12~−0.06
    const pinGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.145, 16);
    pinGeo.rotateX(Math.PI / 2);
    const pin = mesh(pinGeo, steel());
    pin.name = pinName;
    pin.position.set(CR, 0, -0.0425); // 세계 z −0.205~−0.06
    const headGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.025, 16);
    headGeo.rotateX(Math.PI / 2);
    const head = mesh(headGeo, paint(0xf2b619));
    head.position.set(0, 0, -0.06); // 세계 z −0.205~−0.18
    pin.add(head);
    grp.add(pin);
    return grp;
  };
  const crankB1 = mkCrank('crankB1', 'pinB1', O1Y);
  const crankB2 = mkCrank('crankB2', 'pinB2', O2Y);
  g.add(crankB1, crankB2);

  /** 연결봉: 막대 + 눈 둘 — 회전 없이 평행 이동(늘 세로), 사점에 빨강 */
  const mkRod = (name: string, z: number): { grp: THREE.Group; meshes: THREE.Mesh[] } => {
    const grp = new THREE.Group();
    grp.name = name;
    const bar = mesh(new THREE.BoxGeometry(0.06, LEN, 0.06), rodBrass);
    grp.add(bar);
    const meshes: THREE.Mesh[] = [bar];
    for (const ey of [-LEN / 2, LEN / 2]) {
      const eyeGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.06, 24);
      eyeGeo.rotateX(Math.PI / 2);
      const eye = mesh(eyeGeo, rodBrass);
      eye.position.set(0, ey, 0); // 핀 눈 — 핀 축선과 같은 변수로 맞춰진다
      grp.add(eye);
      meshes.push(eye);
    }
    grp.position.set(0, MIDY, z);
    return { grp, meshes };
  };
  const rodF = mkRod('rodF', ZF);
  const rodB = mkRod('rodB', ZB);
  g.add(rodF.grp, rodB.grp);

  // 사점 중심선 — 뒤판 앞면의 흰 세로선(두 축 O1·O2 를 잇는다)
  const deadLine = mesh(new THREE.BoxGeometry(0.025, 2.50, 0.006), paint(0xffffff));
  deadLine.name = 'deadLine';
  deadLine.position.set(0, MIDY, -0.297);
  g.add(deadLine);

  // 회전 화살표 (원판 반지름 0.42 보다 커서 둘레 밖에 보임)
  const arr1 = rotArrow(0.55, true);
  arr1.position.set(0, O1Y, 0.70);
  const arr2 = rotArrow(0.55, true);
  arr2.position.set(0, O2Y, 0.70);
  g.add(arr1, arr2);

  // 이름표 6개 — leaderTo 로 부품을 직접 가리킨다(자리는 설계표 이름표 표)
  g.add(
    leaderTo(tag('위 원판(돌림)', v(1.73, 2.85, 0.6)), 'disc1'),
    leaderTo(tag('아래 원판', v(2.01, 0.67, 0.6)), 'disc2'),
    leaderTo(tag('앞 연결봉', v(1.94, 1.60, 0.6)), 'rodF'),
    leaderTo(tag('뒤 연결봉', v(-1.19, 2.42, 0.0)), 'rodB'),
    leaderTo(tag('사점 중심선', v(-1.21, 1.24, 0.0)), 'deadLine'),
    leaderTo(tag('두 쌍은 90° 어긋남', v(-0.35, 3.11, 0.0)), 'crankB1')
  );

  // ── 동작: φ = π/3 + 0.7t, ψ = φ + 90° (결정적 — t 만으로 다시 계산) ──
  let th = 0; // speed 를 반영한 누적각
  let stNow = { phi: PHI0, fF: 0.5, fB: 0.866 };
  let redF = false;
  let redB = false;
  const apply = (): void => {
    const phi = PHI0 + th;
    const psi = phi + Math.PI / 2;
    const cf = Math.cos(phi);
    const sf = Math.sin(phi);
    const cb = Math.cos(psi);
    const sb = Math.sin(psi);
    for (const s of shafts) s.rotation.z = phi;
    disc1.rotation.z = phi;
    disc2.rotation.z = phi;
    crankB1.rotation.z = psi;
    crankB2.rotation.z = psi;
    // 핀 위치와 눈 위치가 같은 변수에서 나오므로 두 연결봉은 늘 세로(길이 1.500 정확)
    rodF.grp.position.set(CR * cf, MIDY + CR * sf, ZF);
    rodB.grp.position.set(CR * cb, MIDY + CR * sb, ZB);
    // 사점 빨강 전환(바뀔 때만 끼운다)
    const fF = Math.abs(cf);
    const fB = Math.abs(cb);
    const nF = fF < DEAD;
    const nB = fB < DEAD;
    if (nF !== redF) {
      redF = nF;
      for (const m of rodF.meshes) m.material = nF ? rodRed : rodBrass;
    }
    if (nB !== redB) {
      redB = nB;
      for (const m of rodB.meshes) m.material = nB ? rodRed : rodBrass;
    }
    stNow = { phi, fF, fB };
  };
  apply();

  return {
    group: g,
    update(dt: number, speed: number): void {
      th += OMEGA * speed * dt;
      apply();
    },
    notes: () => [
      { label: '위 축 각', value: `${(((stNow.phi * 180) / Math.PI) % 360).toFixed(0)}°` },
      { label: '앞 쌍(원판) 힘 팔', value: stNow.fF.toFixed(2) + (stNow.fF < DEAD ? ' 사점' : '') },
      { label: '뒤 쌍(크랭크) 힘 팔', value: stNow.fB.toFixed(2) + (stNow.fB < DEAD ? ' 사점' : '') },
      { label: '지금 돌리는 쪽', value: stNow.fF < DEAD ? '뒤 쌍' : stNow.fB < DEAD ? '앞 쌍' : '두 쌍 함께' }
    ],
    view: { pos: [-2.45, 2.55, 4.15], target: [0.2, 1.7, 0.15] }
  };
}
