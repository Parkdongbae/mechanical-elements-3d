// 156 홈 있는 벨 크랭크 — 원판의 크랭크 핀이 벨 크랭크 홈 속을 미끄러져 레버를 흔들고, 짧은 팔 끝 막대가 오르내린다 (판화 156번)
//  설계표 docs/mm507-sheets/156.md · 부품은 kit/k155 + kit/k092 조립만 한다
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rod, rotArrow, shaftZ, tag } from '../kit';
import { K156, guidedRod, slottedBellCrank156, state156 } from '../kit/k155';
import { connectingRod, crankDisc, crosshead, guideFrame } from '../kit/k092';

const DEG = 180 / Math.PI;
const OX = -0.25; // 원판 축
const OY = 1.95;
const PX = OX + K156.pivot[0]; // 벨 크랭크 받침점
const PY = OY + K156.pivot[1];
const GX = 0.5388; // 세로 안내선 x(= t = 1 의 눈 x)
const ZL = 0.16; // 벨 크랭크 판 가운데
const ZR = 0.255; // 매단 막대 평면(눈 핀·손목 핀 표식)
const HEAD = K156.slotArm + 0.11; // 받침점 ~ 홈 난 팔 머리 끝

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM156(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 원판 축(고정) — 너트가 벨 크랭크 뒷면(0.125)보다 뒤
  const axle = shaftZ(OX, OY, 0.115, 0.055);
  axle.name = 'axle';
  g.add(axle);

  // 크랭크 원판(구동) — 핀이 앞으로 솟아 벨 크랭크 홈에 끼인다
  const disc = crankDisc(K156.R, K156.crank, { thick: 0.08, boreR: 0.06, hubR: 0.13, pinR: K156.pinR, pinTop: 0.215, pinZ: ZL });
  disc.name = 'disc';
  disc.position.set(OX, OY, 0);
  g.add(disc);

  // 받침점 축(고정)
  const pivotShaft = shaftZ(PX, PY, 0.262, 0.062);
  pivotShaft.name = 'pivotShaft';
  g.add(pivotShaft);

  // 홈 있는 벨 크랭크 — 홈 난 팔이 로컬 +X, 짧은 팔이 −Y
  const bell = slottedBellCrank156(0.125);
  bell.name = 'bellCrank';
  bell.position.set(PX, PY, ZL);
  g.add(bell);

  // 매단 막대 — 원점 = 눈 핀, +X 를 아래 블록 쪽으로
  const hanger = connectingRod(K156.rod, { eyeR: 0.095, barHalf: 0.035, holeR: 0.046 });
  hanger.name = 'hanger';
  g.add(hanger);

  // 세로 안내틀(고정, 판화에 없는 보충)
  const guide = guideFrame(1.15, 0.24, { barH: 0.13, depth: 0.12, back: 0 });
  guide.name = 'guide';
  guide.rotation.z = Math.PI / 2;
  guide.position.set(GX, 0.35, 0);
  g.add(guide);

  // 크로스헤드 — 안내틀 틈 속을 오르내린다
  const block = crosshead(0.26, 0.234, { faceH: 0.31, faceT: 0.03, pinZ: ZR, pinTop: 0.29 });
  block.name = 'block';
  block.rotation.z = Math.PI / 2;
  g.add(block);

  // 안내틀 받침 막대 셋 — 뒤판 앞면에서 틀 뒷면까지
  for (const [x, y] of [[GX - 0.185, 0.9], [GX + 0.185, 0.9], [GX, 0.31]] as const) {
    g.add(rod(v(x, y, -0.3), v(x, y, -0.06), 0.03));
  }

  // 회전 방향(반시계) — 원판 테 바깥, 원판 평면에 두어 앞의 벨 크랭크를 가리지 않는다
  const arrow = rotArrow(0.5, true);
  arrow.position.set(OX, OY, 0.05);
  g.add(arrow);

  // 이름표 4개 — 벨 크랭크·막대는 따라간다
  const tagBell = tag('홈 난 벨 크랭크', v(0, 0, 0.35));
  const tagRod = tag('막대(왕복)', v(0, 0, 0.35));
  g.add(tag('원판(구동)', v(-1.35, 1.05, 0.35)), tagBell, tagRod, tag('안내틀', v(1.35, 0.5, 0.35)));

  /** theta 의 닫힌 식으로 전체 자세 */
  const pose = (th: number): void => {
    const A = state156(th);
    disc.rotation.z = A.a;
    bell.rotation.z = A.lever;
    const ex = OX + A.eye[0];
    const ey = OY + A.eye[1];
    const gr = guidedRod([ex, ey], GX, K156.rod, -1);
    hanger.position.set(ex, ey, ZR);
    hanger.rotation.z = gr.angle;
    block.position.set(GX, gr.end[1], 0);
    tagBell.position.set(PX + HEAD * Math.cos(A.lever) - 0.15, PY + HEAD * Math.sin(A.lever) + 0.25, 0.35);
    tagRod.position.set(GX + 0.85, gr.end[1], 0.35);
  };
  pose(0);

  return {
    group: g,
    view: { pos: [0, 1.7, 6.4], target: [0, 1.5, 0] },
    notes: () => {
      const A = state156(theta);
      const gr = guidedRod([OX + A.eye[0], OY + A.eye[1]], GX, K156.rod, -1);
      return [
        { label: '원판 회전', value: `${(theta / (2 * Math.PI)).toFixed(1)} 바퀴` },
        { label: '벨 크랭크 각', value: `${(A.lever * DEG).toFixed(1)}° (82.5°~138.4°)` },
        { label: '핀의 홈 안 거리', value: A.slide.toFixed(2) },
        { label: '막대 높이', value: `${gr.end[1].toFixed(2)} (행정 0.58)` },
        { label: '설명', value: '핀이 홈을 따라 미끄러지며 벨 크랭크를 흔든다 — 핀이 받침점에 가까울수록 빨리 흔들려 막대 속도가 고르지 않다' }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      pose(theta);
    }
  };
}
