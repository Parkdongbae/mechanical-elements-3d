// 198 이음 맹글 랙 — 피니언은 고정 축에서 제자리로 돌고, 피니언 축(끝 굴림대)이 홈 틀 바닥의 닫힌 안내 홈 속에 들어 있다.
// 피니언이 안쪽 이 줄을 물고 굴러가는 동안 홈 틀은 그 홈을 따라 움직인다 — 곧은 홈에서는 가로로, 끝 반원 홈에서는 들리거나 내려와 반대편 줄로 넘어간다.
// 홈 틀은 두 막대로 미끄럼 틀에 이어져 달아나지 않고, 미끄럼 틀은 네 롤러 사이로 왕복한다 (판화 198번, 설계표 docs/mm507-sheets/198.md)
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, spurGear, tag } from '../kit';
import { K198, PIN_W198, axle198, link198, path198, rackFrame198, slide198, solve198, spool198 } from '../kit/k198';
import { darkSteel, paint } from '../../models/materials';
import { lathe, mesh, rodProfile, tubeProfile } from '../../models/parts/geom';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const S_T1 = 0.257; // t = 1 에서 피니언이 위 줄 가운데 왼쪽(판화 자세)

export default function buildM198(): MovementModel {
  const K = K198;
  const g = new THREE.Group();
  g.add(displayStand());

  // 미끄럼 틀 + 롤러 4
  const { slide, pinT: sPinT, pinB: sPinB } = slide198();
  slide.name = 'slide';
  g.add(slide);
  const rollers: { w: THREE.Group; sgn: number }[] = [];
  for (const sx of [-K.ROLL_X, K.ROLL_X]) {
    for (const sy of [1, -1]) {
      const y = K.YC + sy * (K.HS + K.ROLL_R);
      const ax = axle198(0.025, -0.13, 0.055, true);
      ax.position.set(sx, y, 0);
      g.add(ax);
      const w = spool198();
      w.name = `roller${sx > 0 ? 'R' : 'L'}${sy > 0 ? 'U' : 'D'}`;
      w.position.set(sx, y, 0);
      g.add(w);
      rollers.push({ w, sgn: sy });
    }
  }

  // 홈 틀
  const P = rackFrame198();
  P.frame.name = 'rackFrame';
  g.add(P.frame);

  // 피니언 + 축 + 홈 속 굴림대 (함께 돎), 뒤판 보스(고정)
  const drive = new THREE.Group();
  drive.position.set(0, K.YC, 0);
  const pinion = spurGear(K.N, K.M, { width: 0.054, spokes: 0, driver: true });
  pinion.name = 'pinion';
  pinion.position.z = K.zP;
  drive.add(pinion);
  const shaftGeo = lathe(rodProfile(K.SHAFT_R, 0, 0.242, 0, 0.004), 24);
  shaftGeo.rotateX(Math.PI / 2);
  const shaft = mesh(shaftGeo, darkSteel());
  shaft.position.z = -0.3;
  drive.add(shaft);
  const rollGeo = lathe(tubeProfile(K.SHAFT_R, K.GUIDE_R, 0, 0.036, 0.003), 28);
  rollGeo.rotateX(Math.PI / 2);
  const guide = mesh(rollGeo, darkSteel());
  guide.name = 'guideRoller';
  guide.position.z = -0.149;
  drive.add(guide);
  // 축 끝 빨간 덮개(피니언 앞면, z −0.0545~−0.0505) — 축이 늘 홈 중심선 위에 있는 것이 보이게
  const capGeo = lathe(rodProfile(0.03, 0, 0.004, 0, 0.0015), 24);
  capGeo.rotateX(Math.PI / 2);
  const cap = mesh(capGeo, paint(0xd8362f));
  cap.position.z = K.zP + 0.027;
  drive.add(cap);
  g.add(drive);
  const bossGeo = lathe(tubeProfile(K.SHAFT_R, 0.06, 0, 0.1, 0.008), 32);
  bossGeo.rotateX(Math.PI / 2);
  const boss = mesh(bossGeo, darkSteel());
  boss.name = 'pinionBoss';
  boss.position.set(0, K.YC, -0.3);
  g.add(boss);

  // 막대 2
  const rodU = link198(K.LR);
  rodU.name = 'rodU';
  const rodD = link198(K.LR);
  rodD.name = 'rodD';
  g.add(rodU, rodD);
  // 검사용 핀 이름
  sPinT.name = 'pinSU';
  sPinB.name = 'pinSD';
  P.pinT.name = 'pinFU';
  P.pinB.name = 'pinFD';

  const arrow = rotArrow(0.17, true);
  arrow.position.set(0, K.YC, 0.04);
  g.add(arrow);

  const tPin = leaderTo(tag('피니언(제자리에서 돎)', v(-1.5, 3.02, 0.3)), 'pinion');
  const tGroove = leaderTo(tag('안내 홈(축이 홈을 따라감)', v(0.9, 3.02, 0.3)), 'groove');
  const tFrame = leaderTo(tag('홈 틀(이 줄)', v(-1.2, 0.42, 0.3)), 'rackFrame');
  const tRod = leaderTo(tag('붙듦 막대', v(0, 0.42, 0.3)), 'rodU');
  const tSlide = leaderTo(tag('미끄럼 틀(롤러 사이)', v(1.25, 0.42, 0.3)), 'slide');
  g.add(tPin, tGroove, tFrame, tRod, tSlide);

  // 판화 자세(t = 1): 피니언이 위 줄 가운데 왼쪽
  let theta = solveTheta(S_T1) - PIN_W198 * 1;
  let st = solve198(theta);

  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const placeRod = (rod: THREE.Object3D, a: THREE.Object3D, b: THREE.Object3D): void => {
    a.getWorldPosition(tmpA);
    b.getWorldPosition(tmpB);
    rod.position.set(tmpA.x, tmpA.y, 0);
    rod.rotation.z = Math.atan2(tmpB.y - tmpA.y, tmpB.x - tmpA.x);
  };

  const apply = (): void => {
    st = solve198(theta);
    P.frame.position.set(st.X, st.Y, 0);
    P.frame.rotation.z = st.phi;
    slide.position.set(st.xs, K.YC, 0);
    drive.rotation.z = theta;
    for (const { w, sgn } of rollers) w.rotation.z = sgn * (st.xs / K.ROLL_R);
    g.updateMatrixWorld(true);
    placeRod(rodU, sPinT, P.pinT);
    placeRod(rodD, P.pinB, sPinB);
    tGroove.position.x = st.X + 0.9;
    tFrame.position.x = st.X - 1.2;
    tRod.position.x = st.xs;
    tSlide.position.x = st.xs + 1.25;
  };
  apply();

  const where = (): string => {
    const seg = path198(st.s).seg;
    return seg === 0 ? '위 줄(틀이 왼쪽으로)' : seg === 1 ? '오른쪽 끝 반원 홈(틀이 들림)' : seg === 2 ? '아래 줄(틀이 오른쪽으로)' : '왼쪽 끝 반원 홈(틀이 내려옴)';
  };

  return {
    group: g,
    notes: () => [
      { label: '피니언이 문 곳', value: where() },
      { label: '틀 위치 x', value: `${st.xs.toFixed(2)} (왕복 ±${(K.LH + K.H).toFixed(2)})` },
      { label: '홈 틀 높이', value: `${(st.Y - K.YC).toFixed(2)} (±${K.H.toFixed(2)}, 기울기 ${((st.phi * 180) / Math.PI).toFixed(1)}°)` },
      { label: '원리', value: '고정 축이 홈 틀의 닫힌 홈 속에 있어, 피니언이 돌면 틀이 그 홈대로 움직여 끝에서 반대편 이 줄로 넘어간다' }
    ],
    update(dt: number, speed: number): void {
      theta += PIN_W198 * speed * dt;
      apply();
    },
    view: { pos: [0, 1.75, 6.0], target: [0, 1.72, 0] }
  };
}

/** 홈 위치 s 가 되는 피니언 각 */
function solveTheta(s: number): number {
  // theta = s/RP + phi(s): solve198 의 역 — phi 는 s 의 함수이므로 한 번 계산
  let th = s / K198.RP;
  for (let i = 0; i < 6; i++) {
    const p = solve198(th);
    th += (s - p.s) / K198.RP;
  }
  return th;
}
