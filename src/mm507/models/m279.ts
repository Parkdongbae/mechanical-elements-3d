// 279 홈 있는 십자머리 크랭크와 클레이턴 미끄럼 저널 상자 — 크랭크 손목에 낀 상자가 십자머리 세로 홈 속을 오르내리고(스카치 요크),
// 쐐기(지브) 둘을 나사로 끌어 올리면 안감은 핀 쪽으로, 쐐기는 홈 벽 쪽으로 밀려 닳은 틈이 없어진다.
// 설계표 docs/mm507-sheets/279.md · 키트 kit/k279.ts
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, tag, shaftZ } from '../kit';
import { bronze, castIron, darkSteel, steel } from '../../models/materials';
import { circlePath, extrude, hexPrism, lathe, mesh, rodProfile, tubeProfile, type V2 } from '../../models/parts/geom';
import { markPin } from '../kit/mm';
import { K279, crossFrame279, gib279, lining279, state279 } from '../kit/k279';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

/** 모양을 z0~z1 깊이로 압출(깊이 가운데로 옮김) */
function zExt(shape: THREE.Shape, z0: number, z1: number, c: number, seg = 24): THREE.BufferGeometry {
  const g = extrude(shape, z1 - z0, c, seg);
  g.translate(0, 0, (z0 + z1) / 2);
  return g;
}

/** z 축 둘레 원통(깊이 z0~z1) */
function zRod(r: number, z0: number, z1: number, c0 = 0, c1 = 0): THREE.BufferGeometry {
  const g = lathe(rodProfile(r, z0, z1, c0, c1), 40);
  g.rotateX(Math.PI / 2);
  return g;
}

function zTube(rIn: number, rOut: number, z0: number, z1: number, c = 0): THREE.BufferGeometry {
  const g = lathe(tubeProfile(rIn, rOut, z0, z1, c), 48);
  g.rotateX(Math.PI / 2);
  return g;
}

/** 크랭크 팔: 스타디움 + 평형추 반달, 구멍 0.06 (좌표 = 크랭크 중심) */
function armShape(): THREE.Shape {
  const s = new THREE.Shape();
  const r = 0.14;
  const rw = 0.2;
  s.moveTo(0.38, -r);
  s.absarc(0.38, 0, r, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(0, r);
  s.absarc(0, 0, r, Math.PI / 2, (3 * Math.PI) / 4, false);
  s.lineTo(rw * Math.cos((3 * Math.PI) / 4), rw * Math.sin((3 * Math.PI) / 4));
  s.absarc(0, 0, rw, (3 * Math.PI) / 4, (5 * Math.PI) / 4, false);
  s.lineTo(r * Math.cos((5 * Math.PI) / 4), r * Math.sin((5 * Math.PI) / 4));
  s.absarc(0, 0, r, (5 * Math.PI) / 4, (3 * Math.PI) / 2, false);
  s.closePath();
  s.holes.push(circlePath(0, 0, 0.0595));
  return s;
}

/** 위 판: x ±0.198, 깊이 −0.02~0.12, 높이 0.13~0.17, 나사 자리 홈(가장자리에서 트임) */
function capGeometry(): THREE.BufferGeometry {
  const gz0 = 0.0365;
  const gz1 = 0.0635;
  const w = 0.198;
  const g0 = 0.152;
  const s = new THREE.Shape();
  const pts: V2[] = [
    [-w, -0.02],
    [w, -0.02],
    [w, gz0],
    [g0, gz0],
    [g0, gz1],
    [w, gz1],
    [w, 0.12],
    [-w, 0.12],
    [-w, gz1],
    [-g0, gz1],
    [-g0, gz0],
    [-w, gz0]
  ];
  pts.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
  s.closePath();
  const geo = extrude(s, 0.04, 0.002, 4);
  geo.rotateX(Math.PI / 2); // 모양의 y → 세계 z, 압출 방향 → 세계 −y
  geo.translate(0, 0.15, 0);
  return geo;
}

/** 조절 나사(세로, 반지름 0.012, y 0.115~0.36) — 나사산 표시 홈 고리 6. 원점 = (나사 x, s = 0 의 높이 0, 깊이 가운데) */
function screwGeometry(): THREE.BufferGeometry {
  const r = 0.012;
  const rg = 0.0105;
  const prof: V2[] = [
    [0, 0.115],
    [r, 0.115]
  ];
  for (let k = 0; k < 6; k++) {
    const y = 0.24 + 0.02 * k;
    prof.push([r, y - 0.003], [rg, y - 0.002], [rg, y + 0.002], [r, y + 0.003]);
  }
  prof.push([r, 0.358], [r - 0.002, 0.36], [0, 0.36]);
  return lathe(prof, 28);
}

export default function buildM279(): MovementModel {
  const g = new THREE.Group();
  let t = 0;
  g.add(displayStand());

  // ── 크랭크 축·팔·손목 핀 ──
  const crank = shaftZ(0, K279.C[1], -0.046, 0.06);
  crank.name = 'crankShaft';
  const arm = mesh(zExt(armShape(), -0.16, -0.1, 0.004), steel({ color: 0xd9dee4 }));
  arm.name = 'crankArm';
  crank.add(arm);
  const pin = mesh(zRod(K279.WRIST_R, -0.14, 0.19, 0, 0.01), steel());
  pin.name = 'wristPin';
  pin.position.set(K279.R, 0, 0);
  markPin(pin, [0, 0, 0]);
  const collar = mesh(zTube(0.079, 0.11, -0.1, -0.022, 0.003), steel());
  collar.name = 'wristCollar';
  collar.position.set(K279.R, 0, 0);
  const washer = mesh(zTube(0.079, 0.11, 0.122, 0.14, 0.003), steel());
  washer.name = 'wristWasher';
  washer.position.set(K279.R, 0, 0);
  const nutGeo = hexPrism(0.12, 0.035, true, true, 0.079);
  nutGeo.rotateX(Math.PI / 2);
  const wristNut = mesh(nutGeo, darkSteel());
  wristNut.name = 'wristNut';
  wristNut.position.set(K279.R, 0, 0.1575);
  crank.add(pin, collar, washer, wristNut);
  g.add(crank);

  // ── 고정: 안내 부시 둘과 받침 ──
  for (const sd of [-1, 1] as const) {
    const nm = sd < 0 ? 'L' : 'R';
    const bg = lathe(tubeProfile(0.052, 0.1, 0, 0.16, 0.004), 56);
    bg.rotateZ(-Math.PI / 2); // 축 y → x
    const bush = mesh(bg, bronze());
    bush.name = `bush${nm}`;
    bush.position.set(sd < 0 ? -1.16 : 1.0, K279.C[1], 0.05);
    const post = mesh(new THREE.BoxGeometry(0.1, 1.49 - 0.175, 0.1), castIron({ color: 0x59616b }));
    post.name = `post${nm}`;
    post.position.set(sd * 1.08, (1.49 + 0.175) / 2, 0.05);
    g.add(bush, post);
  }

  // ── 십자머리(틀 + 막대 둘) ──
  const head = new THREE.Group();
  head.name = 'crosshead';
  head.position.set(0, K279.C[1], 0);
  const frameMat = castIron({ color: 0x6b747f });
  frameMat.transparent = true;
  frameMat.opacity = 0.45;
  frameMat.depthWrite = false;
  const frame = mesh(zExt(crossFrame279(), -0.02, 0.12, 0.01), frameMat);
  frame.castShadow = false;
  frame.name = 'crossFrame';
  head.add(frame);
  for (const sd of [-1, 1] as const) {
    const rg = lathe(rodProfile(0.05, 0, 1.03, 0.008, 0.008), 40);
    rg.rotateZ(-Math.PI / 2); // 축 y → x
    const rod = mesh(rg, steel());
    rod.name = sd < 0 ? 'rodL' : 'rodR';
    rod.position.set(sd < 0 ? -1.56 : 0.53, 0, 0.05);
    head.add(rod);
  }
  g.add(head);

  // ── 저널 상자(돌지 않고 손목을 따라 움직임) ──
  const box = new THREE.Group();
  box.name = 'journalBox';
  g.add(box);
  const bronzeMat = bronze();
  const cap = mesh(capGeometry(), bronzeMat);
  cap.name = 'boxCap';
  box.add(cap);
  const gibs: THREE.Mesh[] = [];
  const screws: THREE.Mesh[] = [];
  const nuts: THREE.Mesh[] = [];
  const sgnList = [-1, 1] as const;
  for (const sd of sgnList) {
    const nm = sd < 0 ? 'L' : 'R';
    const mir = sd > 0;
    const lin = mesh(zExt(lining279(mir), -0.02, 0.12, 0.0015, 40), bronze());
    lin.name = `lining${nm}`;
    const gib = mesh(zExt(gib279(mir), -0.02, 0.12, 0.0015), steel({ roughness: 0.3 }));
    gib.name = `gib${nm}`;
    const gibPts: V2[] = [
      [-0.2, 0.12],
      [-0.169, 0.12],
      [-0.1315, -0.13],
      [-0.2, -0.13]
    ];
    gib.userData.outline = gibPts.map(([x, y]) => [mir ? -x : x, y] as V2);
    const screw = mesh(screwGeometry(), steel());
    screw.name = `screw${nm}`;
    const nutG = hexPrism(0.03, 0.025, true, true, 0.0115);
    const nut = mesh(nutG, darkSteel());
    nut.name = `nut${nm}`;
    const cp = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.055, 16), steel());
    cp.name = `boxPin${nm}`;
    cp.position.set(sd * 0.08, 0.1275, 0.05);
    box.add(lin, gib, screw, nut, cp);
    gibs.push(gib);
    screws.push(screw);
    nuts.push(nut);
  }

  // ── 화살표 ──
  const arrRun = rotArrow(0.22, true);
  arrRun.position.set(-0.62, 0.62, 0.15);
  g.add(arrRun);
  const arrLoose = rotArrow(0.055, false);
  const arrTight = rotArrow(0.055, true);
  for (const a of [arrLoose, arrTight]) {
    a.position.set(0, 0.28, 0.16);
    box.add(a);
  }

  // ── 이름표 7(이름표 표 그대로) ──
  g.add(
    leaderTo(tag('십자머리(홈 틀)', v(-1.35, 2.75, 0.35)), 'crossFrame'),
    leaderTo(tag('크랭크 핀', v(-1.35, 2.15, 0.35)), 'wristPin'),
    leaderTo(tag('피스톤 막대', v(-1.3, 0.95, 0.35)), 'rodL'),
    leaderTo(tag('조절 나사', v(1.55, 2.75, 0.35)), 'screwR'),
    leaderTo(tag('안감 조각', v(1.55, 2.3, 0.35)), 'liningR'),
    leaderTo(tag('쐐기 지브', v(1.55, 1.9, 0.35)), 'gibR'),
    leaderTo(tag('안내 부시', v(1.35, 0.95, 0.35)), 'bushR')
  );

  let st = state279(0);
  const apply = (): void => {
    st = state279(t);
    crank.rotation.z = st.theta;
    head.position.x = st.X;
    box.position.set(st.W[0], st.W[1], 0);
    const { s, dx } = st;
    for (let i = 0; i < 2; i++) {
      const sd = i === 0 ? -1 : 1;
      gibs[i]!.position.set(sd < 0 ? dx : -dx, s, 0);
      screws[i]!.position.set(sd * 0.1845 + (sd < 0 ? dx : -dx), s, 0.05);
      nuts[i]!.position.set(sd * 0.1845 + (sd < 0 ? dx : -dx), 0.1825, 0.05);
      nuts[i]!.rotation.y = sd < 0 ? st.nutAngle : -st.nutAngle;
    }
    arrRun.visible = st.tc < 10;
    arrLoose.visible = st.phase === 1 || st.phase === 2;
    arrTight.visible = st.phase === 3;
  };
  apply();

  return {
    group: g,
    view: { pos: [0.15, 1.75, 5.4], target: [0, 1.6, 0] },
    notes: () => {
      const deg = (((st.theta * 180) / Math.PI) % 360 + 360) % 360;
      return [
        { label: '크랭크 각', value: deg.toFixed(0) + '°' },
        { label: '십자머리 위치 X', value: st.X.toFixed(3) },
        { label: '쐐기와 홈 벽 틈', value: st.gap.toFixed(3) },
        { label: '단계', value: st.phase === 0 ? '운전' : st.phase === 3 ? '나사를 조여 틈을 없앰' : '닳아 틈이 생김' },
        { label: '원리', value: '쐐기가 아래로 갈수록 두꺼워(기울기 0.15) 나사로 끌어 올리면 안감은 핀 쪽으로, 쐐기는 홈 벽 쪽으로 밀린다' }
      ];
    },
    update(dt: number, speed: number): void {
      t += dt * speed;
      apply();
    }
  };
}
