// 195 웜으로 구동하는 이송 롤러 — 웜 하나가 위·아래 웜 휠 두 개와 맞물려 돌리고, 마주 보는 롤러 면이 같은 방향으로 움직여 막대를 밀어 보낸다 (판화 195번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, leaderTo, rod, rotArrow, shaftZ, tag, wormScrew, wormWheel, STAGE } from '../kit';
import { castIron, paint, rubber, steel } from '../../models/materials';
import { extrude, lathe, mesh, roundedRect, tubeProfile } from '../../models/parts/geom';

const MOD = 0.04;
const NW = 28; // 웜 휠 잇수 — 피치 반지름 0.56
const RW = (NW * MOD) / 2;
const RWP = 0.14; // 웜 피치 반지름
const YW = 1.75; // 웜 축·막대 높이
const ZW = 0.08; // 웜 축·웜 휠 중심 z
const YU = YW + RWP + RW; // 위 휠 중심
const YL = YW - RWP - RW; // 아래 휠 중심
const RR = RW + RWP - 0.04; // 롤러 반지름(두 롤러 사이 틈 0.08 = 막대 지름 + 여유)
const ZR = 0.32; // 롤러·막대 z (웜 앞)
const ROD_R = 0.033;
const OMEGA_W = OMEGA * 3;
const S = (Math.PI * 2) / NW;
const TAN_LEAD = (Math.PI * MOD) / (2 * Math.PI * RWP);
const SPAN = 3.4; // 막대 길이

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

function bearingBlock(x: number): THREE.Mesh {
  const depth = ZW + 0.09 - STAGE.backZ;
  const geo = extrude(roundedRect(-0.09, -0.11, 0.09, 0.11, 0.025), depth, 0.01);
  const m = mesh(geo, castIron());
  m.position.set(x, YW, STAGE.backZ + depth / 2);
  return m;
}

export default function buildM195(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  // 웜: 왼나사(031번과 같은 식), 가로 축
  const worm = wormScrew(RWP - 1.25 * MOD, RWP + MOD, Math.PI * MOD, 0.62, { driver: true, leftHand: true });
  worm.name = 'worm';
  worm.position.set(0, YW, ZW);
  g.add(worm);
  g.add(rod(v(-1.18, YW, ZW), v(1.18, YW, ZW), 0.04), bearingBlock(-0.95), bearingBlock(0.95));

  // 웜 휠 + 같은 축의 이송 롤러(앞쪽) — 한 몸으로 돈다
  const mk = (name: string, y: number, lead: number): THREE.Group => {
    const u = new THREE.Group();
    u.name = name;
    u.position.set(0, y, 0);
    const wheel = wormWheel(NW, MOD, { width: 0.14, spokes: 6, tanLead: lead });
    wheel.position.z = ZW;
    // 롤러: 고무 테 고리(웜 휠이 안으로 보이게) + 가운데 허브와 바퀴살 한 개
    const roller = new THREE.Group();
    const ringGeo = lathe(tubeProfile(RR - 0.07, RR, -0.05, 0.05, 0.008), 96);
    ringGeo.rotateX(Math.PI / 2);
    roller.add(mesh(ringGeo, rubber()));
    const hubGeo = lathe(tubeProfile(0.02, 0.1, -0.05, 0.06, 0.008), 32);
    hubGeo.rotateX(Math.PI / 2);
    roller.add(mesh(hubGeo, steel()));
    for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const b = mesh(new THREE.BoxGeometry(RR - 0.1, 0.03, 0.03), steel());
      b.position.set(Math.cos(a) * (RR / 2 + 0.0), Math.sin(a) * (RR / 2), 0);
      b.rotation.z = a;
      b.scale.x = 1;
      roller.add(b);
    }
    roller.position.z = ZR;
    u.add(wheel, roller);
    return u;
  };
  const up = mk('wheelU', YU, -TAN_LEAD); // 웜이 휠 아래 → 031 과 반대 비틀림
  const lo = mk('wheelL', YL, TAN_LEAD);
  g.add(up, lo, shaftZ(0, YU, 0.36, 0.045), shaftZ(0, YL, 0.36, 0.045));

  // 이송 막대(고정 높이 YW) + 흐름 표시 고리
  const stock = rod(v(-SPAN / 2, YW, ZR), v(SPAN / 2, YW, ZR), ROD_R);
  stock.name = 'stock';
  g.add(stock);
  const marks: THREE.Mesh[] = [];
  const nMark = 6;
  const gap = SPAN / nMark;
  for (let i = 0; i < nMark; i++) {
    const m = rod(v(-0.02, 0, 0), v(0.02, 0, 0), ROD_R + 0.0025);
    m.material = paint(0xf2b619);
    m.position.set(-SPAN / 2 + gap * (i + 0.5), YW, ZR);
    marks.push(m);
    g.add(m);
  }

  // 회전 화살표: 위 휠 반시계, 아래 휠 시계(정면에서 볼 때), 웜
  const au = rotArrow(0.3, true);
  au.position.set(0, YU, ZR + 0.1);
  const al = rotArrow(0.3, false);
  al.position.set(0, YL, ZR + 0.1);
  const aw = rotArrow(0.2, true);
  aw.rotation.y = Math.PI / 2;
  aw.position.set(0.6, YW, ZW);
  g.add(au, al, aw);

  g.add(
    leaderTo(tag('웜(구동)', v(-0.95, YW + 0.45, 0.4)), worm),
    leaderTo(tag('위 웜 휠·롤러', v(1.0, 2.6, 0.4)), up),
    leaderTo(tag('아래 웜 휠·롤러', v(1.0, 0.9, 0.4)), lo),
    leaderTo(tag('이송 막대', v(-1.5, YW - 0.3, 0.4)), stock)
  );

  const vRod = (): number => (RR * theta) / NW;
  return {
    group: g,
    view: { pos: [0, 1.75, 6.4], target: [0, 1.65, 0] },
    notes: () => [
      { label: '잇수', value: `웜 1줄 : 웜 휠 ${NW}(둘 다 같은 모양)` },
      { label: '속도비', value: `웜 ${NW}바퀴에 두 휠 각각 1바퀴` },
      { label: '방향', value: '위 휠 반시계, 아래 휠 시계 — 마주 보는 면이 같은 쪽(오른쪽)으로 움직인다' },
      { label: '막대 이송', value: `${vRod().toFixed(2)}` }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA_W * speed * dt;
      worm.rotation.x = theta;
      lo.rotation.z = -theta / NW + Math.PI / 2 - S / 2; // 031 과 같은 식(웜이 위)
      up.rotation.z = theta / NW - Math.PI / 2; // 웜이 아래: 나사산이 반 피치 어긋나고 반대로 돈다
      const d = vRod();
      marks.forEach((m, i) => {
        const p = (((i + 0.5) * gap + d + SPAN / 2) % SPAN + SPAN) % SPAN;
        m.position.x = -SPAN / 2 + p;
        m.visible = p > 0.05 && p < SPAN - 0.05;
      });
    }
  };
}
