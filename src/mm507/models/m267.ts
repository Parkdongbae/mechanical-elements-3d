// 267 마찰 풀리(일방향 클러치) — 테가 반시계면 팔 끝 신발이 쐐기처럼 끼어 허브·축이 함께 돌고, 시계면 팔이 물러나 테만 돈다.
// 16초 시간표(잠김 6 · 멈춤 2 · 헛돎 6 · 멈춤 2). 설계표 docs/mm507-sheets/267.md
import * as THREE from 'three';
import type { MovementModel } from '../types';
import { Belt, beltPathAround, coilSpring, displayStand, leaderTo, planar, pulley, rotArrow, setMM, shaftZ, tag } from '../kit';
import { frictionArm267, hubPlate267, K267, state267 } from '../kit/k267';
import { lathe, mesh, tubeProfile, type V2 } from '../../models/parts/geom';
import { bronze, castIron, darkSteel, paint, steel } from '../../models/materials';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const D2R = Math.PI / 180;
const rot = (p: [number, number], a: number): [number, number] => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];

/** Y 축 회전체를 Z 축으로 눕힌 메시 */
function zLathe(profile: V2[], segs: number, mat: THREE.Material): THREE.Mesh {
  const geo = lathe(profile, segs);
  geo.rotateX(Math.PI / 2);
  return mesh(geo, mat);
}

export default function buildM267(): MovementModel {
  const g = new THREE.Group();
  g.add(displayStand());
  const [cx, cy] = K267.C;

  // 주축(허브와 한 몸) + 칼라(테 부시를 뒤에서 받침)
  const mainShaft = shaftZ(cx, cy, 0.175, 0.06);
  mainShaft.name = 'mainShaft';
  mainShaft.add(zLathe(tubeProfile(0.06, 0.09, -0.2, -0.182), 36, steel()));
  g.add(mainShaft);

  // 테 묶음(축 위에서 헛돎)
  const rim = new THREE.Group();
  rim.name = 'rim';
  rim.position.set(cx, cy, 0);
  const band = zLathe(
    [
      [0.8, -0.1],
      [0.852, -0.1],
      [0.86, -0.092],
      [0.86, 0.092],
      [0.852, 0.1],
      [0.8, 0.1],
      [0.8, -0.1]
    ],
    96,
    castIron()
  );
  band.name = 'rimBand';
  rim.add(band);
  const web = zLathe(tubeProfile(0.11, 0.805, -0.1, -0.06), 96, castIron());
  web.name = 'rimWeb';
  rim.add(web);
  const bush = zLathe(tubeProfile(0.062, 0.11, -0.18, -0.06), 48, bronze());
  bush.name = 'rimBush';
  rim.add(bush);
  for (let k = 0; k < 4; k++) {
    const a = 45 * D2R + (k * Math.PI) / 2;
    const m = mesh(new THREE.BoxGeometry(0.05, 0.014, 0.006), paint(0xf2b619));
    m.position.set(0.83 * Math.cos(a), 0.83 * Math.sin(a), 0.103);
    m.rotation.z = a;
    rim.add(m);
  }
  setMM(rim, { kind: 'wheel', fn: 'frictionRim267', axis: 'z', r: 0.86, width: 0.2, span: [-0.1, 0.1], rim: 'flat', bottom: 0.86, outer: 0.86 });
  g.add(rim);

  // 허브 묶음(축과 함께 돎)
  const hub = new THREE.Group();
  hub.name = 'hub';
  hub.position.set(cx, cy, 0);
  const plate = hubPlate267();
  plate.name = 'hubPlate';
  hub.add(plate);
  const boss = zLathe(tubeProfile(0.06, 0.12, -0.048, 0.12), 48, darkSteel());
  boss.name = 'hubBoss';
  hub.add(boss);
  const hubMark = mesh(new THREE.BoxGeometry(0.05, 0.014, 0.006), paint(0xf2b619));
  hubMark.position.set(0.09, 0, 0.1235);
  hub.add(hubMark);

  const pivotProfile: V2[] = [
    [0, -0.045],
    [0.022, -0.045],
    [0.022, 0.072],
    [0.04, 0.072],
    [0.04, 0.09],
    [0, 0.09]
  ];
  const arms: THREE.Group[] = [];
  const springs: THREE.Mesh[] = [];
  const hk: [number, number][] = [];
  const dHat: [number, number] = [Math.cos(113.49 * D2R), Math.sin(113.49 * D2R)];
  for (let k = 0; k < 4; k++) {
    const qa = (k * Math.PI) / 2;
    const P = rot(K267.P0, qa);
    const H = rot(K267.H0, qa);
    hk.push(H);
    // 피벗 볼트
    const bolt = zLathe(pivotProfile, 24, steel());
    bolt.name = `pivot${k}`;
    bolt.position.set(P[0], P[1], 0);
    hub.add(bolt);
    // 편심 팔
    const arm = frictionArm267();
    arm.name = `arm${k}`;
    arm.position.set(P[0], P[1], 0);
    arm.rotation.z = qa;
    hub.add(arm);
    arms.push(arm);
    // 스프링 받침: 중심 = H − 0.015·d̂
    const seat = mesh(new THREE.BoxGeometry(0.03, 0.05, 0.08), darkSteel());
    seat.name = `springSeat${k}`;
    const sc = rot([K267.H0[0] - 0.015 * dHat[0], K267.H0[1] - 0.015 * dHat[1]], qa);
    seat.position.set(sc[0], sc[1], 0.03);
    seat.rotation.z = 113.49 * D2R + qa;
    hub.add(seat);
    // 스프링(매 프레임 H → A 로 다시 놓음)
    const sp = coilSpring(0.014, 0.004, 7);
    sp.name = `spring${k}`;
    sp.position.set(H[0], H[1], 0.035);
    hub.add(sp);
    springs.push(sp);
  }
  g.add(hub);

  // 구동 풀리 축 + 칼라
  const driveShaft = shaftZ(K267.CD[0], K267.CD[1], 0.1615, 0.045);
  driveShaft.name = 'driveShaft';
  driveShaft.add(zLathe(tubeProfile(0.045, 0.07, -0.2, -0.121), 32, steel()));
  g.add(driveShaft);

  // 구동 풀리(키트 납작 림)
  const drivePulley = pulley(0.22, { flat: true, width: 0.2, spokes: 4, hub: 0.045, driver: true });
  drivePulley.name = 'drivePulley';
  drivePulley.position.set(K267.CD[0], K267.CD[1], 0);
  drivePulley.children[0]!.name = 'driveRim';
  g.add(drivePulley);

  // 평벨트(닫힌 고리, 반시계)
  const path = planar(
    beltPathAround(
      [
        { c: K267.C, r: 0.87, ccw: true },
        { c: K267.CD, r: 0.23, ccw: true }
      ],
      48
    ),
    0
  );
  const belt = new Belt(path, {
    style: 'flat',
    width: 0.16,
    thickness: 0.02,
    widthDirs: path.map(() => new THREE.Vector3(0, 0, 1)),
    marks: 8
  });
  belt.group.name = 'belt';
  belt.group.children[0]!.name = 'beltStrip';
  g.add(belt.group);

  // 화살표: 판화(고정, 시계) + 지금 테 방향
  const fixedArrow = rotArrow(0.16, false);
  fixedArrow.position.set(0.8, 2.72, 0.15);
  g.add(fixedArrow);
  const arrowCcw = rotArrow(0.32, true);
  const arrowCw = rotArrow(0.32, false);
  for (const a of [arrowCcw, arrowCw]) {
    a.position.set(K267.CD[0], K267.CD[1], 0.2);
    g.add(a);
  }

  // 이름표 6개 — 이름표 표대로
  g.add(
    leaderTo(tag('테(풀리)', v(-1.45, 2.6, 0.3)), 'rimBand'),
    leaderTo(tag('편심 팔', v(1.45, 2.55, 0.3)), 'arm0'),
    leaderTo(tag('스프링', v(1.5, 1.9, 0.3)), 'spring0'),
    leaderTo(tag('허브', v(-1.5, 1.5, 0.3)), 'hubPlate'),
    leaderTo(tag('평벨트', v(-1.35, 0.95, 0.3)), 'beltStrip'),
    leaderTo(tag('구동 풀리', v(1.2, 0.55, 0.3)), 'driveRim')
  );

  // 팔·스프링 자세(스프링 끝 A_k(δ) = P_k + Rot(kπ/2 + δ)·A0_REL)
  const apply = (t: number): ReturnType<typeof state267> => {
    const s = state267(t);
    rim.rotation.z = s.phiR;
    hub.rotation.z = s.thetaS;
    mainShaft.rotation.z = s.thetaS;
    for (let k = 0; k < 4; k++) {
      const qa = (k * Math.PI) / 2;
      arms[k]!.rotation.z = qa + s.delta;
      const P = rot(K267.P0, qa);
      const r = rot(K267.A0_REL, qa + s.delta);
      const H = hk[k]!;
      const dx = P[0] + r[0] - H[0];
      const dy = P[1] + r[1] - H[1];
      const sp = springs[k]!;
      sp.rotation.z = Math.atan2(dy, dx);
      sp.scale.x = Math.hypot(dx, dy);
    }
    driveShaft.rotation.z = s.phiD;
    drivePulley.rotation.z = s.phiD;
    belt.setOffset(0.87 * s.phiR);
    arrowCcw.visible = s.phase === 'lock';
    arrowCw.visible = s.phase === 'free';
    return s;
  };
  let time = 0;
  let cur = apply(0);

  return {
    group: g,
    view: { pos: [0.6, 2.1, 5.0], target: [0, 1.6, 0] },
    notes: () => [
      { label: '테', value: cur.phase === 'lock' ? '반시계(화살표 반대)' : cur.phase === 'free' ? '시계(화살표 방향)' : '멈춤' },
      { label: '축', value: cur.phase === 'lock' ? '테와 함께 돎' : '멈춤' },
      { label: '축 누적 회전', value: cur.thetaS.toFixed(2) + ' rad' },
      { label: '원리', value: '반시계면 팔 끝이 테에 쐐기처럼 끼고(버팀선 15.5°), 시계면 팔이 피벗에서 물러나 미끄러진다' }
    ],
    update(dt: number, speed: number): void {
      time += dt * speed;
      cur = apply(time);
    }
  };
}
