// 250 마찰 줄이는 바퀴 받침 — 축 목이 두 바퀴 테 사이 골짜기에 얹혀 마찰로 구른다(축 1바퀴에 바퀴 0.121바퀴, 반대 방향).
// 틀판 3장(z 층)의 구멍으로 바퀴 축 둘이 바퀴 넷을 꿰고, 축은 테 접점 위에 얹힌다 — 설계표 docs/mm507-sheets/250.md
import * as THREE from 'three';
import type { MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, setMM, shaftZ, tag } from '../kit';
import { K250, frameShape250, state250, wheel250 } from '../kit/k250';
import { darkSteel, glow, paint, steel } from '../../models/materials';
import { extrude, lathe, mesh, rodProfile, tubeProfile } from '../../models/parts/geom';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const K = K250;

export default function buildM250(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  // 틀판 3장 + 바닥 띠 2개 — 한 묶음(서로 이어진 섬)
  const frames = new THREE.Group();
  frames.name = 'frames';
  setMM(frames, { kind: 'frame' });
  for (const [nm, zc] of [['frameFront', 0.625], ['frameMid', 0.325], ['frameBack', -0.005]] as [string, number][]) {
    const fp = new THREE.Group();
    fp.name = nm;
    fp.position.z = zc;
    fp.add(mesh(extrude(frameShape250(), 0.05, 0.006), paint(0x8a9aa8)));
    frames.add(fp);
  }
  // 앞판에만 축 구멍 둘레 보스 고리 (세계 z 0.65~0.67)
  const ff = frames.getObjectByName('frameFront')!;
  for (const sx of [-1, 1]) {
    const ringGeo = lathe(tubeProfile(0.055, 0.104, 0, 0.02), 32);
    ringGeo.rotateX(Math.PI / 2);
    const ring = mesh(ringGeo, paint(0x8a9aa8));
    ring.position.set(sx * K.WX, K.WY, 0.025);
    ff.add(ring);
  }
  // 바닥 띠 — 틀판 3장을 이음 (z −0.03~0.65)
  for (const sx of [-1, 1]) {
    const strap = mesh(new THREE.BoxGeometry(0.08, 0.08, 0.68), paint(0x8a9aa8));
    strap.position.set(sx * 0.78, 0.22, 0.31);
    frames.add(strap);
  }
  g.add(frames);

  // 바퀴 축 둘(고정) — 뒤판에서 z 0.68 까지 틀판·바퀴를 꿴다
  const axleL = shaftZ(-K.WX, K.WY, 0.68, 0.05);
  axleL.name = 'axleL';
  const axleR = shaftZ(K.WX, K.WY, 0.68, 0.05);
  axleR.name = 'axleR';
  g.add(axleL, axleR);

  // 바퀴 4개 — 각자 rotation.z = θw
  const wheels: THREE.Group[] = [];
  for (const [nm, x, z] of [
    ['wheelL1', -K.WX, K.Z.wheelL1], ['wheelR1', K.WX, K.Z.wheelR1],
    ['wheelL2', -K.WX, K.Z.wheelL2], ['wheelR2', K.WX, K.Z.wheelR2]
  ] as [string, number, number][]) {
    const w = wheel250();
    w.name = nm;
    w.position.set(x, K.WY, z);
    wheels.push(w);
    g.add(w);
  }

  // 축(구동, rotation.z = θs) — 두 테 골짜기에 얹힘, 칼라 둘로 축 방향 잠금
  const shaft = new THREE.Group();
  shaft.name = 'shaft';
  shaft.position.set(0, K.SY, 0);
  setMM(shaft, { kind: 'shaft', axis: 'z', r: K.RS, z0: -0.25, z1: 0.75 });
  const bodyGeo = lathe(rodProfile(K.RS, -0.25, 0.75, 0.02, 0.02), 32);
  bodyGeo.rotateX(Math.PI / 2);
  shaft.add(mesh(bodyGeo, steel()));
  for (const z0 of [0.565, -0.245]) {
    const colGeo = lathe(tubeProfile(K.RS, 0.15, 0, 0.03), 32);
    colGeo.rotateX(Math.PI / 2);
    const col = mesh(colGeo, steel());
    col.position.z = z0;
    shaft.add(col);
  }
  const bar = mesh(new THREE.BoxGeometry(0.08, 0.015, 0.01), paint(0xf2b619));
  bar.position.set(0.04, 0, 0.755);
  shaft.add(bar);

  // 풀리(축에 붙어 함께 돎) — 노란 점·홈 고리로 회전이 보이게
  const pulley = new THREE.Group();
  pulley.name = 'pulley';
  const plGeo = lathe(tubeProfile(K.RS, 0.64, K.Z.pulley, K.Z.pulley + 0.08, 0.01), 64);
  plGeo.rotateX(Math.PI / 2);
  pulley.add(mesh(plGeo, paint(0x9fb0c0)));
  const groove = mesh(new THREE.TorusGeometry(0.52, 0.006, 12, 64), darkSteel());
  groove.position.z = 0.202;
  pulley.add(groove);
  const dotGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.01, 24);
  dotGeo.rotateX(Math.PI / 2);
  const dot = mesh(dotGeo, paint(0xf2b619));
  dot.position.set(0.5, 0, 0.205);
  pulley.add(dot);
  shaft.add(pulley);
  g.add(shaft);

  // 접점 표시(고정) — 축 목이 두 테에 닿은 곳
  for (const [nm, sx] of [['contactL', -1], ['contactR', 1]] as [string, number][]) {
    const c = mesh(new THREE.SphereGeometry(0.022, 16, 12), glow(0xd8362f));
    c.name = nm;
    c.position.set(sx * 0.0658, 2.1845, 0.57);
    g.add(c);
  }

  // 회전 화살표 — 축 반시계, 바퀴 시계
  const arrShaft = rotArrow(0.22, true);
  arrShaft.position.set(0, K.SY, 0.78);
  const arrL = rotArrow(0.35, false);
  arrL.position.set(-K.WX, K.WY, 0.7);
  const arrR = rotArrow(0.35, false);
  arrR.position.set(K.WX, K.WY, 0.7);
  g.add(arrShaft, arrL, arrR);

  // 이름표 7개 — 이름표 표 그대로
  g.add(
    leaderTo(tag('축(얹힘)', v(-1.4, 3.05, 0.85)), 'shaft'),
    leaderTo(tag('맞닿아 구름', v(0, 3.12, 0.85)), 'contactR'),
    leaderTo(tag('풀리', v(1.3, 3.0, 0.85)), 'pulley'),
    leaderTo(tag('왼쪽 바퀴', v(-1.6, 2.55, 0.85)), 'wheelL1'),
    leaderTo(tag('오른쪽 바퀴', v(1.6, 2.55, 0.85)), 'wheelR1'),
    leaderTo(tag('받침 틀', v(-1.75, 0.55, 0.85)), 'frameFront'),
    leaderTo(tag('바퀴 축', v(1.75, 0.75, 0.85)), 'axleR')
  );

  const apply = (): void => {
    shaft.rotation.z = theta;
    for (const w of wheels) w.rotation.z = K.RATIO * theta;
  };
  apply();

  return {
    group: g,
    notes: () => {
      const st = state250(theta / K.OMEGA);
      return [
        { label: '축 돈 바퀴 수', value: (st.thetaShaft / (2 * Math.PI)).toFixed(2) },
        { label: '바퀴 돈 바퀴 수', value: (Math.abs(st.thetaWheel) / (2 * Math.PI)).toFixed(3) },
        { label: '비율(바퀴/축)', value: '0.10 / 0.824 = 0.121 (반대 방향)' },
        { label: '원리', value: '맞닿은 곳에서 미끄럼 없이 구름 — 축 둘레 속도 = 바퀴 테 속도' }
      ];
    },
    update(dt: number, speed: number): void {
      theta += K.OMEGA * speed * dt;
      apply();
    },
    view: { pos: [0.0, 1.95, 7.0], target: [0.0, 1.72, 0.2] }
  };
}
