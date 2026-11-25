// 037 원뿔 스터드 기어 — 일정하게 도는 홈 원뿔이 다른 원뿔 위 돌기(스터드)들을 차례로 밀어 출력 속도가 변한다 (판화 37번)
// 두 원뿔은 평행한 세로축, 마주 보는 모선이 평행하다(피치 반지름 합 pL + pR = D 일정).
// 돌기 i 가 맞물리는 동안 출력/입력 속도비 = pL(y_i) / pR(y_i).
// 판화는 아래에서 위로 올라가는 나선 한 줄이지만, 한 바퀴째 맨 위 → 맨 아래로 한 번에 넘어가면 속도비가 1.8 → 0.46 으로 뛰어
// 막 빠져나가는 돌기를 뒤 리브가 2.5 cm 뚫고 지나간다(수치 검사). 그래서 12개는 판화처럼 올라가고(앞면에서 왼쪽 아래 → 오른쪽 위)
// 뒤쪽 6개가 내려와 닫힌다. 돌기 사이 높이 차가 작아 리브를 뚫지 않는다.
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { brass, castIron, darkSteel, paint, steel } from '../../models/materials';
import { lathe, merge, mesh, TAU } from '../../models/parts/geom';
import { displayStand, flutedCone, leaderTo, rod, tag } from '../kit';

const ZC = 0.3; // 축이 지나는 깊이(원뿔 반지름이 깊이 방향으로 나오므로 앞으로 당긴다) — 원뿔이 z −0.18 ~ 0.78 안에 든다
const D = 0.656; // 축 사이 거리 = pL + pR
const XL = -D / 2; // 구동(왼쪽) 원뿔 축
const XR = XL + D;
const YB = 1.1; // 원뿔 바닥
const H = 1.25; // 원뿔 높이
const PL0 = 0.136; // 왼쪽 피치 반지름: 바닥 → 위
const PL1 = 0.456;
const ZF = 18; // 구동 원뿔 홈 수
const NS = 18; // 돌기 수
const DELTA = TAU / ZF;
const AMP = 0.33; // 돌기 나선: 가운데 높이 ± AMP

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const pL = (y: number): number => PL0 + ((PL1 - PL0) * y) / H; // y = 바닥에서 잰 높이
const pR = (y: number): number => D - pL(y);
const ratioAt = (y: number): number => pL(y) / pR(y);

// 돌기 높이: 번호 순으로 12개 올라가고 6개 내려오는 닫힌 나선(반코사인 두 토막).
// 합 Σ ratio_j = ZF 가 되도록 ym 을 이분법으로 맞춘다(오른쪽 원뿔이 입력 1회전에 정확히 1회전 — 돌기가 다시 같은 홈 자리로 돌아온다)
const RISE = 12 / 18; // 한 바퀴 중 돌기가 올라가는 몫 — 12개는 올라가고 6개는 내려온다
const helixY = (ym: number, j: number): number => {
  const u = j / NS;
  const h = u < RISE ? -Math.cos((Math.PI * u) / RISE) : Math.cos((Math.PI * (u - RISE)) / (1 - RISE));
  return ym + AMP * h;
};

function solveYm(): number {
  const sum = (ym: number): number => {
    let s = 0;
    for (let j = 0; j < NS; j++) s += ratioAt(helixY(ym, j));
    return s;
  };
  let lo = AMP + 0.01;
  let hi = H - AMP - 0.01;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (sum(mid) < ZF) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export default function buildM037(): MovementModel {
  const g = new THREE.Group();
  let theta = 0; // 구동 원뿔 각(누적)
  let curIdx = 0;
  g.add(displayStand());

  const ym = solveYm();
  const ys: number[] = [];
  const ratio: number[] = [];
  const prefix: number[] = []; // prefix[i] = Σ_{j<i} ratio_j
  let acc = 0;
  for (let j = 0; j < NS; j++) {
    const y = helixY(ym, j);
    ys.push(y);
    ratio.push(ratioAt(y));
    prefix.push(acc);
    acc += ratio[j]!;
  }
  // 돌기 i 의 오른쪽 원뿔 위 방위: 구간 i 한가운데에서 정확히 두 축을 잇는 선(방위 π)에 오도록
  const psi = ys.map((_, i) => Math.PI + DELTA * (prefix[i]! + ratio[i]! / 2));

  // 왼쪽 구동 원뿔(홈 18개)
  const left = flutedCone(ZF, PL0, PL1, H, { driver: true, bore: 0.05 });
  left.position.set(XL, YB, ZC);
  g.add(left);

  // 오른쪽 피동 원뿔(매끈한 원뿔대) + 돌기들
  const right = new THREE.Group();
  right.position.set(XR, YB, ZC);
  // 몸통 반지름: 왼쪽 리브 끝(1.05·pL)이 닿지 않게 피치선보다 0.06·pL + 4 mm 안쪽
  const rbody = (y: number): number => pR(y) - 0.06 * pL(y) - 0.004;
  const rb0 = rbody(0);
  const rb1 = rbody(H);
  const coneGeo = lathe(
    [
      [0.05, 0],
      [rb0 - 0.008, 0],
      [rb0, 0.008],
      [rb1, H - 0.008],
      [rb1 - 0.008, H],
      [0.05, H],
      [0.05, 0]
    ],
    64
  );
  right.add(mesh(coneGeo, brass()));
  const studs: THREE.BufferGeometry[] = [];
  for (let i = 0; i < NS; i++) {
    const y = ys[i]!;
    const r0 = rbody(y) - 0.012;
    // 끝은 왼쪽 피치선 너머 0.055·pL — 홈 바닥(0.93·pL)에 닿지 않게
    const r1 = pR(y) + 0.055 * pL(y);
    const len = r1 - r0;
    const cyl = new THREE.CylinderGeometry(0.016, 0.016, len, 14);
    cyl.rotateZ(-Math.PI / 2); // +Y → +X
    cyl.translate(r0 + len / 2, y, 0);
    cyl.rotateY(psi[i]!);
    studs.push(cyl);
  }
  const studMesh = mesh(merge(studs), steel());
  right.add(studMesh);
  right.add(mesh(new THREE.BoxGeometry(0.1, 0.012, 0.03), paint(0xf2b619)).translateX(rb1 * 0.6).translateY(H + 0.002));
  g.add(right);

  // 세로축 + 아래 받침(주철 기둥) + 위 받침(뒤판에서 나온 막대와 링)
  for (const x of [XL, XR]) {
    g.add(rod(v(x, 0.62, ZC), v(x, 2.7, ZC), 0.045));
    const ped = mesh(new THREE.BoxGeometry(0.22, 0.42, 0.22), castIron());
    ped.position.set(x, 0.39, ZC);
    g.add(ped);
    const boss = mesh(lathe([[0.046, 0], [0.09, 0], [0.09, 0.07], [0.046, 0.07], [0.046, 0]], 28), darkSteel());
    boss.position.set(x, 0.6, ZC);
    g.add(boss);
    // 팔 막대는 링 벽(반지름 0.046~0.085) 속에서 끝난다 — 링 가운데까지 가면 세로축 속에 박힌다
    g.add(rod(v(x, 2.72, -0.3), v(x, 2.72, ZC - 0.065), 0.03));
    const ring = mesh(lathe([[0.046, -0.04], [0.085, -0.04], [0.085, 0.04], [0.046, 0.04], [0.046, -0.04]], 28), darkSteel());
    ring.position.set(x, 2.72, ZC);
    g.add(ring);
  }

  g.add(
    tag('홈 원뿔(구동, 일정 속도)', v(XL - 0.35, 2.95, 0.7)),
    tag('돌기 원뿔(피동, 속도 변함)', v(XR + 0.85, 2.95, 0.7)),
    leaderTo(tag('나선 모양 돌기', v(XR + 0.9, 1.1, 0.85)), studMesh)
  );

  return {
    group: g,
    view: { pos: [0.9, 2.9, 6.0], target: [0.1, 1.7, 0.3] },
    notes: () => [
      { label: '입력', value: '일정한 속도' },
      { label: '지금 속도비', value: `${ratio[curIdx]!.toFixed(2)} (출력/입력)` },
      { label: '맞물린 돌기', value: `${curIdx + 1} / ${NS}` }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      const w = Math.floor(theta / DELTA);
      const q = Math.floor(w / NS);
      const i = w - q * NS;
      const u = theta - w * DELTA;
      curIdx = i;
      left.rotation.y = theta;
      right.rotation.y = -(q * TAU + prefix[i]! * DELTA + ratio[i]! * u);
    }
  };
}
