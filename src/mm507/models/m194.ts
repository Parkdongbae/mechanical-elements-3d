// 194 맹글 휠 3 — 이(구멍)의 줄이 하나뿐이라 두 방향의 속도가 같다. 피니언 축은 휠의 안내 홈과 세운 막대의 홈이 붙들고, 피니언의 이 못이 타원 구멍에 들어가 휠을 정·역으로 돌린다 (판화 194번)
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { castIron, darkSteel, paint, steel } from '../../models/materials';
import { extrude, lathe, mesh, rodProfile, roundedRect, tubeProfile } from '../../models/parts/geom';
import { displayStand, leaderTo, mangleTrack, rod, shaftZ, spurGear, tag } from '../kit';
import { K194, PITCH194, RING194, RP194, slotWheel194 } from '../kit/k194';

const TAU = Math.PI * 2;
const XC = 0;
const YC = 1.85;
const PIN_W = 3.2; // 피니언 각속도(rad/s)
const S = TAU / K194.nz;
const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const at = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh => {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
};
const cylZ = (r: number, z0: number, z1: number, seg = 24): THREE.BufferGeometry => {
  const g = lathe(rodProfile(r, z0, z1, 0.004, 0.004), seg);
  g.rotateX(Math.PI / 2);
  return g;
};

export default function buildM194(): MovementModel {
  const g = new THREE.Group();
  g.add(displayStand());

  // 운동식: mangleTrack(rib) 의 순수 구름 풀이(R1 − R2 = 2rp 라 두 팔이 같은 고리 R1 − rp = R2 + rp 를 문다)
  const track = mangleTrack({ pinionTeeth: K194.nz, module: K194.m, rOuter: K194.R1, rInner: K194.R2, loopTeeth: K194.loop, width: 0.09, rib: true, plateR: 1.07, hubR: 0.2 });
  // 구멍 위치: 바깥 팔에서 피니언 이가 위(휠 중심 쪽)를 향하는 시각마다 접점의 휠 기준 각 ψ = −π/2 − 휠 각
  const per = (K194.loop / K194.nz) * TAU;
  const N = 60000;
  const psis: number[] = [];
  let theta0 = 0;
  let best = 9;
  let pf: number | null = null;
  const up0 = Math.PI / 2 - S / 2;
  for (let i = 0; i <= N; i++) {
    const th = (per * i) / N;
    const u = (th - up0) / S;
    const f = u - Math.floor(u);
    const r = track.solve(th);
    if (pf !== null && f < pf && Math.abs(r.dist - K194.R1) < 1e-4) {
      const psi = -Math.PI / 2 - r.wheel;
      psis.push(psi);
      if (Math.abs(psi) < best) {
        best = Math.abs(psi);
        theta0 = th;
      }
    }
    pf = f;
  }
  // 등차수열로 고른다(첫 값 + j·Δψ)
  const dpsi = PITCH194 / RING194;
  const ps = psis.map((_, j) => psis[0]! + j * dpsi);

  // 휠: 구멍 판 + 테두리 + 허브 + 표시점
  const wheel = new THREE.Group();
  wheel.name = 'wheel';
  wheel.position.set(XC, YC, 0);
  wheel.add(slotWheel194(ps));
  const hubGeo = lathe(rodProfile(0.15, K194.z0, K194.zPlate + 0.08, 0.012, 0.012), 40);
  hubGeo.rotateX(Math.PI / 2);
  wheel.add(at(hubGeo, darkSteel(), 0, 0, 0));
  wheel.add(at(new THREE.BoxGeometry(0.1, 0.03, 0.012), paint(0xf2b619), 1.02, 0, K194.zPlate + 0.006));
  g.add(wheel, shaftZ(XC, YC, 0.4, 0.04));

  // 피니언: 앞 층의 얇은 기어 + 이마다 뒤로 난 못(구멍에 들어간다) + 축
  const pinion = new THREE.Group();
  pinion.name = 'pinion';
  const zFront = K194.zPlate + 0.015; // 피니언 판 뒷면 z
  const pegs = new THREE.Group();
  pegs.name = 'pegs';
  const gear = spurGear(K194.nz, K194.m, { width: 0.04, spokes: 0, driver: true });
  gear.position.z = zFront + 0.02;
  pinion.add(gear);
  for (let j = 0; j < K194.nz; j++) {
    const a = (j + 0.5) * S;
    pegs.add(at(cylZ(0.021, K194.zPlate - 0.045, zFront + 0.005, 16), steel(), Math.cos(a) * RP194, Math.sin(a) * RP194, 0));
  }
  pinion.add(pegs);
  pinion.add(rod(v(0, 0, zFront + 0.03), v(0, 0, 0.3), 0.022));
  pinion.position.set(XC, YC - K194.R1, 0);
  g.add(pinion);

  // 세운 고정 막대(홈) + 받침 — 피니언 축 안내(홈 길이 = 피니언 중심이 오르내리는 범위 R2 ~ R1)
  const yHi = YC - K194.R2 + 0.02;
  const yLo = YC - K194.R1 - 0.02;
  const barShape = roundedRect(-0.07, 0.33, 0.07, 1.62, 0.03);
  const slot = new THREE.Path();
  slot.absarc(0, yHi, 0.032, 0, Math.PI, false);
  slot.lineTo(-0.032, yLo);
  slot.absarc(0, yLo, 0.032, Math.PI, 2 * Math.PI, false);
  slot.closePath();
  barShape.holes.push(slot);
  g.add(at(extrude(barShape, 0.04, 0.008), steel(), 0, 0, 0.34));
  g.add(at(new THREE.BoxGeometry(0.34, 0.14, 0.26), castIron(), 0, 0.25, 0.32));
  const washer = lathe(tubeProfile(0.02, 0.05, 0, 0.012, 0.003), 24);
  washer.rotateX(Math.PI / 2);
  pinion.add(at(washer, darkSteel(), 0, 0, 0.275));

  g.add(
    leaderTo(tag('맹글 휠', v(1.35, 2.75, 0.35)), wheel),
    leaderTo(tag('피니언', v(0.85, 0.85, 0.5)), pinion),
    tag('세운 막대(홈)', v(-0.75, 0.62, 0.5)),
    tag('이 구멍 고리', v(-1.4, 2.4, 0.35))
  );

  let thetaP = theta0;
  let wheelAng = 0;
  let dir = 0;
  let dist = K194.R1;
  const place = (): void => {
    const r = track.solve(thetaP);
    dir = Math.sign(r.wheel - wheelAng) * (Math.abs(r.wheel - wheelAng) > 1e-6 ? 1 : 0);
    wheelAng = r.wheel;
    dist = r.dist;
    wheel.rotation.z = r.wheel;
    pinion.position.y = YC - r.dist;
    pinion.rotation.z = thetaP;
    // 고리 둘레(구멍이 있는 곳)에 든 못만 보인다 — 나머지 이는 판 위(앞 층)에서 구멍 없는 면 위를 지난다
    const cy = YC - r.dist;
    pegs.children.forEach((c, j) => {
      const a = (j + 0.5) * S + thetaP;
      const d = Math.hypot(Math.cos(a) * RP194, cy - YC + Math.sin(a) * RP194);
      c.visible = Math.abs(d - RING194) < 0.1;
    });
  };
  place();
  dir = 0;

  return {
    group: g,
    view: { pos: [0.6, 2.3, 6.2], target: [0, 1.75, 0] },
    notes: () => [
      { label: '피니언', value: '한 방향으로 계속 회전' },
      { label: '휠', value: dir > 0 ? '반시계로 회전' : dir < 0 ? '시계로 회전' : '정지' },
      { label: '속도', value: '바깥 팔·안쪽 팔 모두 같은 고리를 물어 정·역 속도가 같다' },
      { label: '피니언 중심 거리', value: `${dist.toFixed(2)} (${K194.R2} ~ ${K194.R1})` }
    ],
    update(dt: number, speed: number): void {
      thetaP += PIN_W * speed * dt;
      place();
    }
  };
}
