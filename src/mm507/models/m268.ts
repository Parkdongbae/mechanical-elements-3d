// 268 크랭크와 흔들막대 — 원판이 돌면 크랭크 핀이 막대 오른쪽 끝을 끌고 다니고,
// 막대는 왼쪽 고정 축 도르래 꼭대기에 얹혀 미끄러지며 기울어 왼쪽 끝이 오르내리고 앞뒤로 왕복한다.
// 설계표 docs/mm507-sheets/268.md, 키트 kit/k268.ts
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, markAnchor, rotArrow, setMM, shaftZ, tag } from '../kit';
import { K268, rodPlate268, state268 } from '../kit/k268';
import { brass, bronze, paint, steel } from '../../models/materials';
import { lathe, mesh, shapeFrom, extrude, tubeProfile, type V2 } from '../../models/parts/geom';

const K = K268;
const PI = Math.PI;
const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

/** z 방향 회전체(프로파일 [r, z]) */
const latheZ = (prof: V2[]): THREE.BufferGeometry => lathe(prof, 48).rotateX(PI / 2);
const tubeZ = (rIn: number, rOut: number, z0: number, z1: number, c = 0): THREE.BufferGeometry =>
  lathe(tubeProfile(rIn, rOut, z0, z1, c), 48).rotateX(PI / 2);

/** 크랭크 팔 윤곽: 중심 원(0.07)과 핀 원((0.336, 0), 0.045)의 볼록 껍질 */
function armOutline(): V2[] {
  const R = 0.07;
  const r = 0.045;
  const d = K.RC;
  const g = Math.acos((R - r) / d);
  const pts: V2[] = [];
  const N = 20;
  for (let i = 0; i <= N; i++) {
    const a = g + ((2 * PI - 2 * g) * i) / N;
    pts.push([R * Math.cos(a), R * Math.sin(a)]);
  }
  for (let i = 0; i <= N; i++) {
    const a = -g + ((2 * g) * i) / N;
    pts.push([d + r * Math.cos(a), r * Math.sin(a)]);
  }
  return pts;
}

export default function buildM268(): MovementModel {
  const g = new THREE.Group();
  let tm = 0;
  g.add(displayStand());

  // ── 원판 축(뒤판 보스 + 끝 너트) + 칼라 ──
  const discShaft = shaftZ(K.D[0], K.D[1], 0.156, 0.05);
  discShaft.name = 'discShaft';
  const dCollar = mesh(tubeZ(0.05, 0.075, -0.2, -0.081), steel());
  dCollar.name = 'discCollar';
  discShaft.add(dCollar);
  g.add(discShaft);

  // ── 크랭크 원판 묶음(원판·허브·표시 + 팔 + 핀) ──
  const crank = new THREE.Group();
  crank.name = 'crank';
  crank.position.set(K.D[0], K.D[1], 0);
  setMM(crank, { kind: 'crank' });
  const disc = mesh(tubeZ(0.05, 0.456, 0, 0.06, 0.008), brass());
  disc.name = 'crankDisc';
  const hub = mesh(tubeZ(0.05, 0.09, -0.08, 0), brass());
  hub.name = 'crankHub';
  const discMark = mesh(new THREE.BoxGeometry(0.06, 0.016, 0.006), paint(0xf2b619));
  discMark.name = 'crankMark';
  discMark.position.set(-0.38, 0, 0.0635); // 핀 반대쪽
  crank.add(disc, hub, discMark);

  const armG = new THREE.Group();
  armG.name = 'crankArmG';
  armG.rotation.z = K.PHI0;
  const arm = mesh(extrude(shapeFrom(armOutline()), 0.04, 0, 24), steel());
  arm.name = 'crankArm';
  arm.position.z = 0.08;
  const armBoss = mesh(tubeZ(0.05, 0.07, 0.06, 0.11), steel());
  armBoss.name = 'crankArmBoss';
  armG.add(arm, armBoss);

  const crankPin = new THREE.Group();
  crankPin.name = 'crankPin';
  crankPin.position.set(K.RC, 0, 0);
  const pinBody = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.15, 24).rotateX(PI / 2).translate(0, 0, 0.175), steel());
  pinBody.name = 'pinBody'; // 깊이 0.10~0.25
  const pinCollar = mesh(tubeZ(0.025, 0.04, 0.1, 0.168), steel());
  pinCollar.name = 'pinCollar';
  const pinHead = mesh(latheZ([[0, 0.232], [0.04, 0.232], [0.04, 0.252], [0, 0.252]]), steel());
  pinHead.name = 'pinHead';
  crankPin.add(pinBody, pinCollar, pinHead);
  markAnchor(crankPin, [0, 0, 0.2]);
  armG.add(crankPin);
  crank.add(armG);
  g.add(crank);

  // ── 흔들막대 ──
  const rodG = new THREE.Group();
  rodG.name = 'rodAssy';
  const rod = rodPlate268();
  rod.name = 'rod';
  const rodEye = new THREE.Object3D();
  rodEye.name = 'rodEye';
  markAnchor(rodEye, [0, 0, 0.2]);
  const rodTip = mesh(new THREE.BoxGeometry(0.032, 0.1, 0.064), paint(0xd2352e));
  rodTip.name = 'rodTip';
  rodTip.position.set(-3.086, 0, 0.2); // x −3.102~−3.07
  rodG.add(rod, rodEye, rodTip);
  g.add(rodG);

  // ── 받침 도르래: 축 + 칼라 + 도르래(홈) ──
  const rollerShaft = shaftZ(K.O[0], K.O[1], 0.3, 0.03);
  rollerShaft.name = 'rollerShaft';
  const rCollar = mesh(tubeZ(0.03, 0.05, -0.2, 0.129), steel());
  rCollar.name = 'rollerCollar';
  rollerShaft.add(rCollar);
  g.add(rollerShaft);

  const prof: V2[] = [
    [0.031, 0.13], [0.06, 0.13], [0.06, 0.14], [0.24, 0.14], [0.24, 0.155], [0.208, 0.155],
    [0.208, 0.245], [0.24, 0.245], [0.24, 0.26], [0.06, 0.26], [0.06, 0.272], [0.031, 0.272], [0.031, 0.13]
  ];
  const roller = mesh(latheZ(prof), bronze());
  roller.name = 'roller';
  roller.position.set(K.O[0], K.O[1], 0);
  const rMark = mesh(new THREE.BoxGeometry(0.05, 0.014, 0.006), paint(0xf2b619));
  rMark.name = 'rollerMark';
  rMark.position.set(0.15, 0, 0.2635);
  roller.add(rMark);
  setMM(roller, { kind: 'wheel', fn: 'roller268', axis: 'z', r: 0.208, width: 0.12, span: [0.14, 0.26], rim: 'flat', bottom: 0.208, outer: 0.24 });
  g.add(roller);

  // ── 표시 ──
  const arrow = rotArrow(0.55, true);
  arrow.position.set(K.D[0], K.D[1], 0.3);
  g.add(arrow);

  g.add(
    leaderTo(tag('크랭크 원판', v(1.45, 0.85, 0.4)), 'crankDisc'),
    leaderTo(tag('크랭크', v(1.55, 2.55, 0.4)), 'crankArm'),
    leaderTo(tag('흔들막대', v(0.3, 2.5, 0.4)), 'rod'),
    leaderTo(tag('받침 도르래', v(-0.75, 0.85, 0.4)), 'roller'),
    leaderTo(tag('막대 끝(왕복)', v(-1.2, 2.55, 0.4)), 'rodTip')
  );

  let st = state268(0);
  const apply = (): void => {
    st = state268(tm);
    discShaft.rotation.z = st.phi;
    crank.rotation.z = st.phi - K.PHI0;
    rodG.position.set(st.A[0], st.A[1], 0);
    rodG.rotation.z = st.alpha;
    roller.rotation.z = st.thetaR;
  };
  apply();

  return {
    group: g,
    notes: () => {
      const deg = (((st.phi * 180) / PI) % 360 + 360) % 360;
      return [
        { label: '크랭크 각', value: deg.toFixed(0) + '°' },
        { label: '막대 기울기', value: ((st.alpha * 180) / PI).toFixed(1) + '°' },
        { label: '막대 끝 높이', value: st.tip[1].toFixed(3) },
        { label: '원리', value: '핀의 원운동이 도르래 위에서 미끄러지는 막대를 흔들어, 막대 끝이 오르내리며 앞뒤로 왕복한다 — 도르래는 구르며 마찰을 줄인다' }
      ];
    },
    update(dt: number, speed: number): void {
      tm += dt * speed;
      apply();
    },
    view: { pos: [0.2, 2.1, 5.2], target: [0.05, 1.65, 0.1] }
  };
}
