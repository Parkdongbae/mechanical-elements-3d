// 185 기관차 링크 밸브 장치 — 편심 둘(전진·후진)이 굽은 홈 링크를 흔들고, 역전 레버로 링크를 들고 내려
// 홈 속 슬라이드(다이)의 자리를 바꾸면 밸브 막대가 움직이는 폭과 방향이 바뀐다 (판화 185번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, shaftZ, tag } from '../kit';
import { K185, LEN185, bar185, die185, eccRod185, eccentric185, frame185, gear185, lever185, link185, linkMotion185, rocker185, valveStem185 } from '../kit/k185';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const ang = (a: [number, number], b: [number, number]): number => Math.atan2(b[1] - a[1], b[0] - a[0]);

export default function buildM185(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  // 고정 틀(증기실 덩이·패킹 상자·레버 받침대·톱니 사분원·흔들 레버 받침 가로대)
  const frame = frame185();
  frame.name = 'frame';
  g.add(frame);

  // 기관 축 + 편심 둘(뒤 = 후진, 앞 = 전진)
  const S = K185.S;
  const shaft = shaftZ(S[0], S[1], 0.27, 0.05);
  shaft.name = 'shaft';
  const eccB = eccentric185(false);
  eccB.name = 'eccBack';
  eccB.position.set(S[0], S[1], K185.zB);
  const eccF = eccentric185(true);
  eccF.name = 'eccFwd';
  eccF.position.set(S[0], S[1], K185.zF);
  g.add(shaft, eccB, eccF);

  // 편심 막대 둘(앞 막대 → 링크 위 핀 T, 뒤 막대 → 링크 아래 핀 B)
  const rodF = eccRod185(LEN185.rodT);
  rodF.name = 'rodFwd';
  const rodB = eccRod185(LEN185.rodB);
  rodB.name = 'rodBack';
  g.add(rodF, rodB);

  // 굽은 홈 링크 + 다이 + 흔들 레버 + 밸브 연결봉 + 밸브 막대
  const link = link185();
  link.name = 'link';
  const die = die185();
  die.name = 'die';
  const rocker = rocker185();
  rocker.name = 'rocker';
  rocker.position.set(K185.R[0], K185.R[1], K185.zR);
  const vLink = bar185(K185.Lv, 'brass');
  vLink.name = 'valveLink';
  const stem = valveStem185();
  stem.name = 'valveStem';
  g.add(link, die, rocker, vLink, stem);

  // 역전 레버 + 들기 막대
  const lever = lever185();
  lever.name = 'lever';
  lever.position.set(K185.P[0], K185.P[1], K185.zLv);
  const lift = bar185(LEN185.lift);
  lift.name = 'liftRod';
  g.add(lever, lift);

  // 회전 화살표(축, 반시계)
  const arrow = rotArrow(0.4, true);
  arrow.position.set(S[0], S[1], 0.3);
  g.add(arrow);

  // 이름표 6개(링크·다이는 따라간다)
  const linkTag = leaderTo(tag('굽은 홈 링크', v(0.8, 0.75, 0.6)), link);
  const dieTag = leaderTo(tag('슬라이드(다이)', v(-0.7, 0.75, 0.6)), die);
  g.add(
    leaderTo(tag('편심 2개(기관 축)', v(1.55, 2.3, 0.6)), eccF),
    leaderTo(tag('역전 레버(손잡이)', v(-1.3, 3.0, 0.6)), lever),
    leaderTo(tag('밸브 막대', v(-0.35, 2.7, 0.6)), stem),
    leaderTo(tag('흔들 레버', v(0.8, 2.15, 0.6)), rocker),
    linkTag,
    dieTag
  );

  let st = linkMotion185(0);
  const apply = (): void => {
    st = linkMotion185(theta);
    shaft.rotation.z = theta;
    eccF.rotation.z = st.phiF;
    eccB.rotation.z = st.phiB;
    rodF.position.set(st.Ef[0], st.Ef[1], K185.zF);
    rodF.rotation.z = ang(st.Ef, st.T);
    rodB.position.set(st.Eb[0], st.Eb[1], K185.zB);
    rodB.rotation.z = ang(st.Eb, st.B);
    link.position.set(st.link[0], st.link[1], K185.zL);
    link.rotation.z = st.link[2];
    die.position.set(st.D[0], st.D[1], K185.zL);
    die.rotation.z = st.dieAng;
    rocker.rotation.z = st.rock;
    vLink.position.set(st.U[0], st.U[1], K185.zV);
    vLink.rotation.z = ang(st.U, st.V);
    stem.position.set(st.V[0], st.V[1], K185.zR);
    lever.rotation.z = st.lam;
    lift.position.set(st.Q[0], st.Q[1], K185.zLift);
    lift.rotation.z = ang(st.Q, st.H);
    linkTag.position.set(st.link[0] + 0.75, 0.75, 0.6);
    dieTag.position.set(st.D[0] - 0.75, 0.75, 0.6);
  };
  apply();

  const gearText = (gv: number): string => {
    if (Math.abs(gv) < 0.05) return '가운데 — 밸브 거의 멈춤';
    const pct = Math.round(Math.abs(gv) * 100);
    return `${gv > 0 ? '전진' : '후진'} ${pct} %${Math.abs(gv) > 0.95 ? ' (끝 — 증기 오래 들어감)' : ' (팽창 사용)'}`;
  };

  return {
    group: g,
    view: { pos: [0, 1.8, 6.4], target: [0, 1.75, 0] },
    notes: () => [
      { label: '축', value: `${(theta / TAU).toFixed(1)} 바퀴` },
      { label: '레버 자리', value: gearText(gear185(theta)) },
      { label: '다이 자리', value: `홈 가운데에서 ${st.sDie >= 0 ? '위' : '아래'}로 ${Math.abs(st.sDie).toFixed(2)}` },
      { label: '밸브 막대 위치', value: st.V[0].toFixed(3) },
      { label: '원리', value: '다이가 홈 끝에 가까울수록 밸브가 크게 움직이고, 가운데면 거의 멈춘다' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
