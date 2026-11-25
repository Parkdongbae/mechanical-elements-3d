// 157 연결봉 달린 벨 크랭크 — 원판 크랭크 핀 → 연결봉 → 벨 크랭크 위 팔, 옆 팔 끝 막대가 오르내린다 (판화 157번)
//  설계표 docs/mm507-sheets/157.md · 부품은 kit/k155 + kit/k092 조립만 한다
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rod, rotArrow, shaftZ, tag } from '../kit';
import { K157, bellCrank157, guidedRod, state157 } from '../kit/k155';
import { connectingRod, crankDisc, crosshead, guideFrame } from '../kit/k092';

const DEG = 180 / Math.PI;
const OX = -0.5; // 원판 축
const OY = 1.6;
const PX = OX + K157.pivot[0]; // 벨 크랭크 받침점
const PY = OY + K157.pivot[1];
const GX = PX + K157.arm; // 세로 안내선 x(= t = 1 의 눈 x)
const ZB = 0.1; // 벨 크랭크 판 가운데
const ZR = 0.18; // 연결봉·매단 막대 평면(핀 표식 넷)

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM157(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 원판 축(고정)
  const axle = shaftZ(OX, OY, 0.115, 0.055);
  axle.name = 'axle';
  g.add(axle);

  // 크랭크 원판(구동)
  const disc = crankDisc(K157.R, K157.crank, { thick: 0.08, boreR: 0.06, hubR: 0.13, pinR: K157.pinR, pinTop: 0.24, pinZ: ZR });
  disc.name = 'disc';
  disc.position.set(OX, OY, 0);
  g.add(disc);

  // 받침점 축(고정)
  const pivotShaft = shaftZ(PX, PY, 0.197, 0.048);
  pivotShaft.name = 'pivotShaft';
  g.add(pivotShaft);

  // 벨 크랭크 — 옆 팔 로컬 +X(eyePin), 위 팔 96.4°(topPin)
  const bell = bellCrank157(0.12);
  bell.name = 'bellCrank';
  bell.position.set(PX, PY, ZB);
  g.add(bell);

  // 연결봉 — 원점 = 크랭크 핀, +X 를 위 팔 끝으로. 막대 몸 끝이 핀에 닿지 않게 눈을 0.095 로
  const coupler = connectingRod(K157.coupler, { eyeR: 0.095, barHalf: 0.035, holeR: 0.046 });
  coupler.name = 'coupler';
  g.add(coupler);

  // 매단 막대 — 원점 = 옆 팔 핀, +X 를 아래 블록으로
  const hanger = connectingRod(K157.rod, { eyeR: 0.095, barHalf: 0.035, holeR: 0.046 });
  hanger.name = 'hanger';
  g.add(hanger);

  // 세로 안내틀(고정, 판화에 없는 보충)
  const guide = guideFrame(1.2, 0.24, { barH: 0.13, depth: 0.12, back: 0 });
  guide.name = 'guide';
  guide.rotation.z = Math.PI / 2;
  guide.position.set(GX, 0.32, 0);
  g.add(guide);

  // 크로스헤드
  const block = crosshead(0.26, 0.234, { faceH: 0.31, faceT: 0.03, pinZ: ZR, pinTop: 0.25 });
  block.name = 'block';
  block.rotation.z = Math.PI / 2;
  g.add(block);

  // 안내틀 받침 막대 셋
  for (const [x, y] of [[GX - 0.185, 0.92], [GX + 0.185, 0.92], [GX, 0.28]] as const) {
    g.add(rod(v(x, y, -0.3), v(x, y, -0.06), 0.03));
  }

  // 회전 방향(반시계) — 크랭크 핀·연결봉보다 앞
  const arrow = rotArrow(0.3, true);
  arrow.position.set(OX, OY, 0.26);
  g.add(arrow);

  // 이름표 5개
  const tagCoupler = tag('연결봉', v(0, 0, 0.35));
  const tagBell = tag('벨 크랭크', v(0, 0, 0.35));
  const tagRod = tag('매단 막대(왕복)', v(0, 0, 0.35));
  g.add(tag('크랭크 원판(구동)', v(-1.45, 2.35, 0.35)), tagCoupler, tagBell, tagRod, tag('안내틀', v(0.2, 0.45, 0.35)));

  const pose = (th: number): void => {
    const A = state157(th);
    disc.rotation.z = A.a;
    const cx = OX + A.pin[0];
    const cy = OY + A.pin[1];
    coupler.position.set(cx, cy, ZR);
    coupler.rotation.z = A.coupler;
    bell.rotation.z = A.lever;
    const ex = OX + A.eye[0];
    const ey = OY + A.eye[1];
    const gr = guidedRod([ex, ey], GX, K157.rod, -1);
    hanger.position.set(ex, ey, ZR);
    hanger.rotation.z = gr.angle;
    block.position.set(GX, gr.end[1], 0);
    const tx = OX + A.top[0];
    const ty = OY + A.top[1];
    tagCoupler.position.set((cx + tx) / 2 - 0.1, (cy + ty) / 2 + 0.2, 0.35);
    tagBell.position.set(tx - 0.05, ty + 0.22, 0.35);
    tagRod.position.set(GX + 0.42, gr.end[1], 0.35);
  };
  pose(0);

  return {
    group: g,
    view: { pos: [0, 1.7, 6.4], target: [0, 1.5, 0] },
    notes: () => {
      const A = state157(theta);
      const gr = guidedRod([OX + A.eye[0], OY + A.eye[1]], GX, K157.rod, -1);
      return [
        { label: '원판 회전', value: `${(theta / (2 * Math.PI)).toFixed(1)} 바퀴` },
        { label: '벨 크랭크 흔들림', value: `${(A.lever * DEG).toFixed(1)}° (−40.4°~+57.0°)` },
        { label: '전달각', value: `${(A.mu * DEG).toFixed(1)}° (최소 35.6°)` },
        { label: '블록 높이', value: `${gr.end[1].toFixed(2)} (행정 0.68)` },
        { label: '설명', value: '원판이 한 바퀴에 벨 크랭크가 한 번 앞뒤로 흔들린다 — 연결봉은 홈 대신으로, 핀이 홈에서 미끄러지는 156 과 달리 봉이 기울며 따라간다' }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      pose(theta);
    }
  };
}
