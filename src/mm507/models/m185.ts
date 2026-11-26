// 185 기관차 링크 밸브 장치 — 편심 둘(전진·후진)이 굽은 홈 링크를 흔들고, 역전 레버로 링크를 들고 내려
// 홈 속 슬라이드(다이)의 자리를 바꾸면 밸브 막대가 움직이는 폭과 방향이 바뀐다 (판화 185번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, shaftZ, tag } from '../kit';
import { DRIVE185, K185, LEN185, SLEEPER185, VALVE185, bar185, die185, driveWheel185, eccRod185, eccentric185, frame185, gear185, lever185, link185, linkMotion185, mainRod185, piston185, ports185, rocker185, shaftRateAt185, track185, valveStem185 } from '../kit/k185';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const ang = (a: [number, number], b: [number, number]): number => Math.atan2(b[1] - a[1], b[0] - a[0]);

export default function buildM185(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  // 고정 틀(증기실 덩이·패킹 상자·레버 받침대·톱니 사분원·흔들 레버 받침 가로대)
  const frame = frame185();
  frame.name = 'frame';
  g.add(frame);

  // 기관 축(= 구동 바퀴 축) + 편심 둘(뒤 = 후진, 앞 = 전진) + 구동 바퀴(앞)
  const S = K185.S;
  const shaft = shaftZ(S[0], S[1], DRIVE185.zW1 + 0.046, 0.05);
  shaft.name = 'shaft';
  const eccB = eccentric185(false);
  eccB.name = 'eccBack';
  eccB.position.set(S[0], S[1], K185.zB);
  const eccF = eccentric185(true);
  eccF.name = 'eccFwd';
  eccF.position.set(S[0], S[1], K185.zF);
  const wheel = driveWheel185();
  wheel.name = 'driveWheel';
  wheel.position.set(S[0], S[1], 0);
  g.add(shaft, eccB, eccF, wheel);

  // 연결봉(메인 로드): 크로스헤드 핀 → 크랭크 핀(맨 앞 층)
  const mainRod = mainRod185();
  mainRod.name = 'mainRod';
  g.add(mainRod);

  // 짧은 선로(자갈 둑·레일 고정, 침목이 흘러 기관차가 가는 것을 보인다)
  const track = track185();
  g.add(track.fixed, ...track.sleepers);

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

  // 피스톤 + 피스톤 막대 + 크로스헤드(한 덩어리, 증기실 아래 실린더 속 → 오른쪽 안내봉 사이)
  const piston = piston185();
  piston.name = 'piston';
  g.add(piston);

  // 증기 색 표시판(틀 안): 열린 증기 구멍 = 주황(증기 들어감), 배기 쪽 = 파랑
  const fillOf = (n: string): THREE.Mesh => frame.getObjectByName(n) as THREE.Mesh;
  const portL = fillOf('portL');
  const portR = fillOf('portR');
  const exhaust = fillOf('exhaust');
  const cylL = fillOf('cylL');
  const cylR = fillOf('cylR');
  const valve = stem.getObjectByName('slideValve') as THREE.Object3D;

  // 회전 화살표(축): 정방향 = 반시계, 역방향 = 시계, 멈추면 숨김
  const arrowF = rotArrow(0.3, true);
  arrowF.position.set(S[0], S[1], 0.72);
  const arrowR = rotArrow(0.3, false);
  arrowR.position.set(S[0], S[1], 0.72);
  g.add(arrowF, arrowR);

  // 이름표 14개(z 0.75): 위 줄 = 레버·밸브 장치, 왼쪽 = 증기실 속, 아래 두 줄 = 링크·구동 장치, 오른쪽 = 바퀴
  const crosshead = piston.getObjectByName('crosshead') as THREE.Object3D;
  const crankPin = wheel.getObjectByName('pinC') as THREE.Object3D;
  const Z = 0.75;
  // 다이·링크 이름표는 그 부품을 따라 좌우로 움직인다
  const dieTag = leaderTo(tag('슬라이드(다이)', v(-0.95, 0.92, Z)), die);
  const linkTag = leaderTo(tag('굽은 홈 링크', v(0.5, 0.92, Z)), link);
  g.add(
    leaderTo(tag('역전 레버(손잡이)', v(-1.3, 3.05, Z)), lever),
    leaderTo(tag('편심 2개(기관 축)', v(0.85, 3.05, Z)), eccF),
    leaderTo(tag('밸브 막대', v(-0.5, 2.62, Z)), stem),
    leaderTo(tag('흔들 레버', v(0.8, 2.62, Z)), rocker),
    leaderTo(tag('구동 바퀴', v(1.72, 2.5, Z)), wheel),
    leaderTo(tag('크랭크 핀', v(1.72, 2.08, Z)), crankPin),
    leaderTo(tag('미끄럼 밸브', v(-2.0, 2.45, Z)), valve),
    leaderTo(tag('증기 구멍', v(-2.05, 1.85, Z)), portL),
    leaderTo(tag('배기 구멍', v(-2.05, 1.3, Z)), exhaust),
    dieTag,
    linkTag,
    leaderTo(tag('크로스헤드', v(-1.55, 0.5, Z)), crosshead),
    leaderTo(tag('연결봉(메인 로드)', v(0.1, 0.5, Z)), mainRod),
    leaderTo(tag('레일', v(1.66, 0.48, Z)), track.fixed)
  );

  const OFF = new THREE.Color(0x3a3d42);
  const LIVE = new THREE.Color(0xffa040);
  const EXH = new THREE.Color(0x5aa0e0);
  const paintFill = (m: THREE.Mesh, s: number): void => {
    const mat = m.material as THREE.MeshStandardMaterial;
    const f = Math.min(1, Math.abs(s) * 1.6);
    mat.color.copy(OFF).lerp(s > 0 ? LIVE : EXH, f);
    mat.emissive.copy(mat.color);
    mat.emissiveIntensity = 0.15 + 0.5 * f;
  };

  let st = linkMotion185(0);
  let rate = 1;
  let vp = 0; // 피스톤 속도(앞 그림과의 차)
  let ptNow = ports185(st.dV);
  const apply = (): void => {
    const xp0 = st.xp;
    st = linkMotion185(theta);
    vp = st.xp - xp0;
    shaft.rotation.z = st.phi;
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
    piston.position.set(st.xp, VALVE185.rodY, VALVE185.zc);
    wheel.rotation.z = st.psi;
    mainRod.position.set(st.xc, DRIVE185.yc, DRIVE185.zRod);
    mainRod.rotation.z = st.rodAng;
    // 침목: 바퀴가 반시계(전진)로 돌면 땅이 오른쪽으로 흐른다(= 기관차가 왼쪽, 실린더 쪽으로 나아감)
    const span = SLEEPER185.pitch * SLEEPER185.n;
    const off = st.phi * DRIVE185.Rw;
    track.sleepers.forEach((sl, i) => {
      let u = (i * SLEEPER185.pitch + off) % span;
      if (u < 0) u += span;
      sl.position.x = SLEEPER185.x0 + u;
      // 양 끝에서 좁아졌다 넓어져 갑자기 나타나지 않게
      const edge = Math.min(u, SLEEPER185.x1 - SLEEPER185.x0 - u) / SLEEPER185.w;
      sl.scale.x = Math.max(0.02, Math.min(1, edge));
      sl.visible = u <= SLEEPER185.x1 - SLEEPER185.x0;
    });
    const pt = ports185(st.dV);
    ptNow = pt;
    paintFill(portL, pt.left);
    paintFill(portR, pt.right);
    paintFill(cylL, pt.left);
    paintFill(cylR, pt.right);
    paintFill(exhaust, -Math.max(Math.abs(pt.left), Math.abs(pt.right)));
    cylL.position.x = VALVE185.boreX0;
    cylL.scale.x = Math.max(0.001, st.xp - VALVE185.pT - VALVE185.boreX0);
    cylR.position.x = st.xp + VALVE185.pT;
    cylR.scale.x = Math.max(0.001, VALVE185.boreX1 - st.xp - VALVE185.pT);
    dieTag.position.x = st.D[0] - 1.2;
    linkTag.position.x = st.link[0] + 0.27;
    rate = shaftRateAt185(theta);
    arrowF.visible = rate > 0.05;
    arrowR.visible = rate < -0.05;
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
    notes: () => {
      const run = rate > 0.05 ? 'fwd' : rate < -0.05 ? 'rev' : 'stop';
      const open = Math.max(Math.abs(ptNow.left), Math.abs(ptNow.right));
      const steamL = ptNow.left > 0;
      const steam = run === 'stop' || open < 0.15 ? '밸브가 거의 닫힘 — 증기가 거의 안 든다' : `실린더 ${steamL ? '왼쪽' : '오른쪽'} 방(주황) → 피스톤을 ${steamL ? '오른쪽' : '왼쪽'}으로 민다, 반대쪽 방은 배기(파랑)`;
      const pist = Math.abs(vp) < 1e-5 ? '멈춤' : vp > 0 ? '오른쪽으로' : '왼쪽으로';
      return [
        { label: '순서', value: '① 증기가 피스톤을 민다 → ② 피스톤 막대·크로스헤드·연결봉이 크랭크 핀을 밀어 구동 바퀴를 돌린다 → ③ 같은 축의 편심이 링크·밸브를 움직여 다음 증기를 반대쪽 방에 넣는다' },
        { label: '지금', value: run === 'fwd' ? `전진 — 바퀴 반시계, 기관차는 왼쪽(실린더 쪽)으로 감${rate < 0.95 ? ' (느려지는 중)' : ''}` : run === 'rev' ? `후진 — 바퀴 시계, 기관차는 오른쪽으로 감${rate > -0.95 ? ' (느려지는 중)' : ''}` : '정지 — 레버 가운데, 바퀴·피스톤 멈춤' },
        { label: '증기 든 쪽', value: steam },
        { label: '피스톤', value: `${pist} (크로스헤드가 안내봉 사이를 함께 미끄러짐)` },
        { label: '레버 자리', value: gearText(gear185(theta)) },
        { label: '역전', value: '레버를 반대로 넘기면 링크가 다른 편심 쪽으로 옮겨 증기 넣는 때가 반 바퀴 바뀌고 바퀴가 거꾸로 돈다. 가운데면 밸브가 거의 안 열려 멈춘다' }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
