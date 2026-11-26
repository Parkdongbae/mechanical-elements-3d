// 163 물레방아 조속기 2 — 공 조속기의 슬리브가 꺾인 지레를 흔들어 벨트 포크로 벨트를 풀리 셋(위·아래 고정, 가운데 헐거움) 사이로 옮긴다.
//  빠르면 아래 풀리 → 건너편 아래 베벨 기어가 수문 축을 한쪽으로, 느리면 위 풀리 → 위 베벨 기어가 반대로 돌린다 (판화 163번)
//  설계표 docs/mm507-sheets/163.md · 부품은 kit/k163 · kit/k162(조속기) · kit/k155(지레) · 공용 키트
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { Belt, bevelGear, displayStand, leaderTo, openBeltPath, pulley, rod, rotArrow, shaftZ, tag } from '../kit';
import { wallBearing } from '../kit/gear6';
import { connectingRod } from '../kit/k092';
import { elbowLever } from '../kit/k155';
import { addGovernor162 } from '../kit/k162';
import { GX163, K163, bearingsY163, collar163, fork163, state163 } from '../kit/k163';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const DEG = 180 / Math.PI;
const SX = K163.sx;
const ZC = K163.zc;
const XF = K163.xf;
const YB = K163.yb0;
const PH = Math.PI / 16; // 16이 피니언 반 피치(이골이 접점에)
const LC = Math.hypot(K163.C0[0] - K163.P[0], K163.C0[1] - K163.P[1]);
const GC = Math.atan2(K163.C0[1] - K163.P[1], K163.C0[0] - K163.P[0]);

/** 세로축 풀리(그룹 rotation.y 로 돈다) */
function vPulley(name: string, x: number, y: number, driver: boolean): THREE.Group {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(x, y, ZC);
  const p = pulley(K163.rg, { width: K163.pw, spokes: 4, flat: true, hub: 0.033, driver });
  p.rotation.x = -Math.PI / 2;
  g.add(p);
  return g;
}

export default function buildM163(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());
  g.add(bearingsY163(SX, [0.78, 1.2]), bearingsY163(XF, [0.68, 1.33]));

  // 조속기 스핀들(도는 한 몸) — 위·아래 풀리는 고정
  const spin = new THREE.Group();
  spin.name = 'spin';
  spin.position.set(SX, 0, ZC);
  spin.add(rod(v(0, 0.72, 0), v(0, K163.hy + 0.08, 0), 0.03));
  const sleeve = addGovernor162(spin, K163.hy);
  sleeve.add(collar163());
  for (const [nm, y] of [['pulleyUp', YB + K163.p], ['pulleyLow', YB - K163.p]] as const) {
    const p = vPulley(nm, 0, y, true);
    p.position.z = 0;
    spin.add(p);
  }
  g.add(spin);
  // 가운데 헐거운 풀리(스핀들 위에서 헛돈다 — 벨트가 오면 멈춰 있다)
  g.add(vPulley('pulleyLoose', SX, YB, false));

  // 건너편 풀리 셋 + 세로축 + 베벨 기어 둘
  const farLow = vPulley('farLow', XF, YB - K163.p, false);
  const bLow = bevelGear(K163.gz, K163.gm, { width: 0.05, bore: 0.031 });
  bLow.rotation.x = -Math.PI / 2; // 이가 위로
  bLow.position.y = YB - K163.gR - (YB - K163.p);
  farLow.add(bLow);
  const farUp = vPulley('farUp', XF, YB + K163.p, false);
  const bUp = bevelGear(K163.gz, K163.gm, { width: 0.05, bore: 0.031 });
  bUp.rotation.x = Math.PI / 2; // 이가 아래로
  bUp.position.y = YB + K163.gR - (YB + K163.p);
  farUp.add(bUp);
  g.add(farLow, farUp, vPulley('farLoose', XF, YB, false));
  g.add(rod(v(XF, 0.6, ZC), v(XF, YB + 0.045, ZC), 0.03)); // 아래 세로축(아래 풀리·아래 베벨)
  g.add(rod(v(XF, YB + 0.045, ZC), v(XF, 1.42, ZC), 0.03)); // 위 세로축(위 풀리·위 베벨)

  // 수문 축 피니언(두 베벨 사이, 이가 −X) + 축 + 받침
  const gateShaft = new THREE.Group();
  gateShaft.name = 'gateShaft';
  gateShaft.position.set(XF + K163.gR, YB, ZC);
  const gp = bevelGear(K163.gz, K163.gm, { width: 0.05, bore: 0.026, driver: true });
  gp.rotation.y = -Math.PI / 2;
  gateShaft.add(gp);
  gateShaft.add(rod(v(0.05, 0, 0), v(0.75, 0, 0), 0.025));
  g.add(gateShaft);
  g.add(wallBearing(XF + 0.62, YB, ZC, 'x', 0.032));

  // 꺾인 지레(받침점 P) — 홈 고리 쪽 팔 끝 핀이 고리 홈에, 옆 팔 끝 핀에 연결봉
  const lever = elbowLever(
    [
      { len: K163.La, angle: 0, endR: 0.035, rootR: 0.045, pin: { r: 0.022, z0: -0.02, z1: 0.085, name: 'leverPin', at: K163.zK - K163.zL } },
      { len: LC, angle: GC, endR: 0.032, rootR: 0.045, pin: { r: 0.01, z0: -0.065, z1: 0.02, name: 'collarPin', at: -0.05 } }
    ],
    { hubR: 0.06, boreR: 0.034, thick: 0.05, blend: 8, metal: 'iron' }
  );
  lever.name = 'lever';
  lever.position.set(K163.P[0], K163.P[1], K163.zL);
  g.add(lever);
  const pivot = shaftZ(K163.P[0], K163.P[1], 0.47, 0.03);
  pivot.name = 'pivotShaft';
  g.add(pivot);

  // 세로 연결봉(옆 팔 끝 → 포크 핀)
  const link = connectingRod(K163.Lk, { eyeR: 0.07, barHalf: 0.025, holeR: 0.026, thick: 0.04 });
  link.name = 'link';
  g.add(link);

  // 벨트 포크 + 세로 안내봉(뒤판 받침 둘)
  const fork = fork163();
  g.add(fork);
  g.add(rod(v(GX163 + 0.1, 0.74, 0.47), v(GX163 + 0.1, 1.3, 0.47), 0.012));
  for (const y of [0.718, 1.322]) g.add(rod(v(GX163 + 0.1, y, -0.3), v(GX163 + 0.1, y, 0.49), 0.022));

  // 평벨트(가로 평면, 폭은 세로) — 포크 높이로 통째 오르내린다
  const r = K163.rg + K163.bt / 2;
  const path = openBeltPath([SX, ZC], r, [XF, ZC], r, 28).map(([a, b]) => v(a, 0, b));
  const belt = new Belt(path, { width: K163.bw, thickness: K163.bt, style: 'flat', marks: 6, widthDirs: path.map(() => v(0, 1, 0)) });
  belt.group.name = 'belt';
  g.add(belt.group);

  // 회전 화살표 — 스핀들(위에서 반시계)
  const arrow = rotArrow(0.17, true);
  arrow.rotation.x = -Math.PI / 2;
  arrow.position.set(SX, 1.4, ZC);
  g.add(arrow);

  // 이름표 6개
  const tagBall = tag('공', v(0, 0, 0.6));
  const tagLever = tag('꺾인 지레', v(0, 0, 0.6));
  const tagFork = tag('벨트 포크', v(0, 0, 0.6));
  // 벨트·벨트 포크 이름표가 같은 곳(포크 끝)을 가리키던 것 — 대상을 따로 정하고 자리도 떼어 놓는다(사용자 지적)
  const tagBelt = tag('벨트', v(0, 0, 0.6));
  leaderTo(tagBelt, 'belt');
  leaderTo(tagFork, 'fork');
  g.add(tag('풀리 셋', v(-1.45, YB, 0.6)), tagBelt, tag('수문 기어', v(1.6, 1.55, 0.6)), tagBall, tagLever, tagFork);

  const pose = (th: number): void => {
    const s = state163(th);
    spin.rotation.y = s.phiS;
    const armR = spin.getObjectByName('armR');
    if (armR) armR.rotation.z = s.alpha;
    const armL = spin.getObjectByName('armL');
    if (armL) armL.rotation.z = -s.alpha;
    sleeve.position.y = s.sy;
    const linkR = spin.getObjectByName('linkR');
    if (linkR) {
      linkR.position.set(s.lugR, s.lugY, 0);
      linkR.rotation.z = -s.linkG;
    }
    const linkL = spin.getObjectByName('linkL');
    if (linkL) {
      linkL.position.set(-s.lugR, s.lugY, 0);
      linkL.rotation.z = s.linkG;
    }
    farLow.rotation.y = s.gate;
    farUp.rotation.y = -s.gate;
    gateShaft.rotation.x = s.gate + PH;
    lever.rotation.z = s.beta;
    link.position.set(s.A[0], s.A[1], K163.zK);
    link.rotation.z = s.linkAng;
    fork.position.set(GX163, s.yF, 0);
    belt.group.position.y = s.yF;
    belt.setOffset(-r * s.beltAng);
    tagBall.position.set(SX + 0.75, s.ballY + 0.12, 0.6);
    tagLever.position.set(s.A[0] + 0.55, s.A[1] + 0.1, 0.6);
    tagFork.position.set(GX163 + 0.55, s.yF + 0.3, 0.6);
    // 벨트 이름표는 두 풀리 사이 벨트 가운데 아래 — 포크와 떨어진 자리
    tagBelt.position.set(XF - 0.75, s.yF - 0.35, 0.6);
  };
  pose(0);

  const beltText = (b: 'low' | 'up' | 'loose'): string =>
    b === 'low' ? '빠름 — 아래 풀리, 수문 올림' : b === 'up' ? '느림 — 위 풀리, 수문 내림' : '알맞음 — 헐거운 풀리, 쉼';

  return {
    group: g,
    view: { pos: [0.15, 1.65, 6.4], target: [0.15, 1.5, 0] },
    notes: () => {
      const s = state163(theta);
      return [
        { label: '속도 인자', value: `${s.w.toFixed(2)} (느림 2.5 ~ 빠름 5.5)` },
        { label: '팔 각', value: `${(s.alpha * DEG).toFixed(1)}°` },
        { label: '벨트', value: beltText(s.belt) },
        { label: '수문 축', value: `${(s.gate * DEG).toFixed(0)}°` },
        { label: '설명', value: '빠르면 공이 벌어져 슬리브가 오르고 지레가 포크를 내려 벨트를 아래 풀리로, 느리면 위 풀리로 옮긴다 — 건너편 두 베벨 기어가 수문 축을 서로 반대로 돌린다' }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      pose(theta);
    }
  };
}
