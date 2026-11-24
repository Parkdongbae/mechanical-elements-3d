// 038 부분 이 기어 변속 — 한 바퀴 중 대부분은 1:1 로 일정하게, 나머지는 3배 빠르게 → 1/3 로 느리게 (판화 38번)
// 판화(4배 확대 대조): 두 바퀴가 똑같이 세 구간으로 되어 있다.
//  ① 둘레의 약 235° 는 보통 원호 이(피치 반지름 = 중심 거리의 절반) — 서로 물려 1:1.
//  ② 약 31° 는 반지름이 긴 부채꼴(끝에 이 4개) — 상대 바퀴의 ③ 과 물린다.
//  ③ 약 94° 는 허브 가까이의 짧은 반지름 이(4개) — 상대 바퀴의 ② 와 물린다.
// 긴 반지름 + 짧은 반지름 = 중심 거리. 긴 쪽이 몰면 3배 빠르고, 짧은 쪽이 몰면 1/3 로 느리다.
// 판화의 굵은 가로선은 두 중심을 잇는 선(이 순간 ②·③ 의 경계가 물림 자리에 있다) — theta = 0 이 그 자세.
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { brass, bronze, darkSteel, steel } from '../../models/materials';
import { extrude, lathe, mesh, rodProfile, stadiumShape, TAU } from '../../models/parts/geom';
import { displayStand, rotArrow, shaftZ, tag, type V2 } from '../kit';

const C = 1.2; // 중심 거리
const R0 = C / 2; // 원호 구간 피치 반지름
const RB = 0.9; // 긴 부채꼴 피치 반지름
const RS = C - RB; // 짧은 구간 피치 반지름(0.3) — RB : RS = 3 : 1
const N0 = 20; // 원호 구간 이 수
const NS = 4; // 긴·짧은 구간 이 수(같은 호 길이)
// 세 구간의 이 간격(호 길이)을 같게: R0·A0/N0 = RB·AB/NS, A0 + AB + 3·AB = 360°
const AB = (R0 * TAU) / N0 / (RB / NS + (4 * R0) / N0); // 긴 부채꼴 각 ≈ 31.3°
const AS = (AB * RB) / RS; // 짧은 구간 각 ≈ 93.9°
const A0 = TAU - AB - AS; // 원호 구간 각 ≈ 234.8°
const ADD = 0.04;
const DED = 0.05;
const CA: V2 = [-C / 2, 1.75]; // 구동(왼쪽)
const CB: V2 = [C / 2, 1.75]; // 피동(오른쪽)
const GZ = 0.06;
const TH = 0.12; // 바퀴 두께

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

interface Sec {
  r: number;
  a0: number;
  a1: number;
  n: number;
  f: number; // 이 중심 위치(간격의 몇 분의 몇)
  trim: number; // 구간 양 끝에서 덜어 낸 이 수
}

/**
 * 구간별 반지름이 다른 톱니 바퀴의 외곽선(반시계).
 * 구간이 바뀌는 순간에는 새 구간의 첫 이가 옛 속도비로 다가오므로, 긴 부채꼴과 원호 구간은 양 끝 이를 하나씩 덜어야 부딪치지 않는다
 * (shots/_verify/c038t.mjs 로 한 바퀴 침범 0 확인).
 */
function wheelShape(secs: Sec[]): THREE.Shape {
  const pts: V2[] = [];
  const put = (r: number, a: number): void => {
    pts.push([r * Math.cos(a), r * Math.sin(a)]);
  };
  const arc = (r: number, a: number, b: number): void => {
    const m = Math.max(1, Math.ceil((b - a) / 0.05));
    for (let i = 0; i <= m; i++) put(r, a + ((b - a) * i) / m);
  };
  for (const s of secs) {
    const pa = (s.a1 - s.a0) / s.n;
    const rr = s.r - DED;
    const rt = s.r + ADD;
    let a = s.a0;
    for (let k = s.trim; k < s.n - s.trim; k++) {
      const c = s.a0 + (k + s.f) * pa;
      arc(rr, a, c - 0.27 * pa);
      put(rt, c - 0.16 * pa);
      put(rt, c + 0.16 * pa);
      a = c + 0.27 * pa;
    }
    arc(rr, a, s.a1);
  }
  const sh = new THREE.Shape();
  pts.forEach(([x, y], i) => (i === 0 ? sh.moveTo(x, y) : sh.lineTo(x, y)));
  sh.closePath();
  return sh;
}

function wheel(secs: Sec[], mat: THREE.Material): THREE.Group {
  const w = new THREE.Group();
  w.add(mesh(extrude(wheelShape(secs), TH, 0.006), mat));
  const hub = lathe(rodProfile(0.13, 0, 0.05, 0.008, 0.012), 40);
  hub.rotateX(Math.PI / 2);
  const hm = mesh(hub, darkSteel());
  hm.position.z = TH;
  w.add(hm);
  return w;
}

/** 피동 각(구동 각 th 의 함수) — 구간별 속도비 3, 1, 1/3. 한 바퀴에 정확히 한 바퀴 */
function angleB(th: number): number {
  const q = Math.floor(th / TAU);
  const t = th - q * TAU;
  let k: number;
  if (t < AB) k = 3 * t;
  else if (t < AB + A0) k = AS + (t - AB);
  else k = AS + A0 + (t - AB - A0) / 3;
  return -(q * TAU + k);
}

function ratioAt(th: number): number {
  const t = th - Math.floor(th / TAU) * TAU;
  return t < AB ? 3 : t < AB + A0 ? 1 : 1 / 3;
}

export default function buildM038(): MovementModel {
  const g = new THREE.Group();
  let theta = 0; // 구동 바퀴 각(누적)
  g.add(displayStand());

  // 구동(왼쪽): 물림 자리 = 로컬 각 −theta. 긴 부채꼴 [−AB, 0] → 원호 → 짧은 구간 [0, AS] 순서로 물린다
  const ga = wheel(
    [
      { r: RB, a0: -AB, a1: 0, n: NS, f: 0.25, trim: 1 },
      { r: RS, a0: 0, a1: AS, n: NS, f: 0.75, trim: 0 },
      { r: R0, a0: AS, a1: TAU - AB, n: N0, f: 0.75, trim: 1 }
    ],
    bronze()
  );
  ga.position.set(CA[0], CA[1], GZ);
  // 피동(오른쪽): 물림 자리 = 로컬 각 π − (피동 각). 짧은 구간 [π, π+AS] → 원호 → 긴 부채꼴 [π−AB, π]
  const gb = wheel(
    [
      { r: RS, a0: Math.PI, a1: Math.PI + AS, n: NS, f: 0.25, trim: 0 },
      { r: R0, a0: Math.PI + AS, a1: Math.PI + AS + A0, n: N0, f: 0.75, trim: 1 },
      { r: RB, a0: Math.PI + AS + A0, a1: Math.PI + TAU, n: NS, f: 0.75, trim: 1 }
    ],
    brass()
  );
  gb.position.set(CB[0], CB[1], GZ);
  g.add(ga, gb, shaftZ(CA[0], CA[1], 0.3, 0.045), shaftZ(CB[0], CB[1], 0.3, 0.045));

  // 두 중심을 잇는 연결대(판화의 굵은 가로선 — 중심 거리 고정, 바퀴 뒤)
  const link = mesh(extrude(stadiumShape(CA[0], CA[1], CB[0], CB[1], 0.045), 0.03, 0.006), steel());
  link.position.z = -0.016; // z −0.031 ~ −0.001 — 바퀴 뒷면(z 0) 바로 뒤(전에는 0.015 겹쳐 도는 바퀴를 뚫었다)
  g.add(link);

  const a1 = rotArrow(0.42, true);
  a1.position.set(CA[0], CA[1], 0.3);
  const a2 = rotArrow(0.42, false);
  a2.position.set(CB[0], CB[1], 0.3);
  g.add(a1, a2);
  g.add(
    tag('구동 바퀴(일정 속도)', v(CA[0] - 0.35, 0.72, 0.35)),
    tag('피동 바퀴(속도 변함)', v(CB[0] + 0.35, 0.72, 0.35)),
    tag('긴 부채꼴 ↔ 짧은 이: 3배·1/3배', v(0, 2.9, 0.35))
  );

  const pose = (): void => {
    ga.rotation.z = theta;
    gb.rotation.z = angleB(theta);
  };
  pose();

  return {
    group: g,
    view: { pos: [0.6, 2.2, 6.2], target: [0, 1.75, 0] },
    notes: () => {
      const r = ratioAt(theta);
      const name = r > 1 ? '긴 부채꼴이 밂 — 3배 빠름' : r < 1 ? '짧은 이가 밂 — 1/3 로 느림' : '원호 이 — 일정';
      return [
        { label: '구간(구동 각)', value: `1:1 ${((A0 * 360) / TAU).toFixed(0)}° · 3배 ${((AB * 360) / TAU).toFixed(0)}° · 1/3배 ${((AS * 360) / TAU).toFixed(0)}°` },
        { label: '지금 속도비', value: `${r.toFixed(2)} (피동/구동) — ${name}` },
        { label: '피동 회전수', value: `${(-angleB(theta) / TAU).toFixed(2)}바퀴 (구동 ${(theta / TAU).toFixed(2)}바퀴)` }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      pose();
    }
  };
}
