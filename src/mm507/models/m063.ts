// 063 점프(간헐) 회전 — 핀 원판 · 드롭 레버 · 폴 · 별 바퀴 (판화 63번)
// 설계표 063 '안 B'(수치 검증분). 별 바퀴 이는 판화대로 10개(2026-11-26 결정: 12라고 적힌 곳을 10으로 계산).
// 핀 원판이 시계 방향으로 돌아 핀으로 드롭을 들어 올리고, 핀이 빠지면 스프링이 드롭을 던져
// 드롭의 핀이 폴을 쳐 별 바퀴를 한 이(36°)만큼 순식간에 돌린다.
import * as THREE from 'three';
import type { MovementModel } from '../types';
import { coilSpring, displayStand, rotArrow, shaftZ, tag, type V2 } from '../kit';
import { dropOutline, pawlOutline, pinDisc, plateFrom, starWheel } from '../kit/k063';
import { lathe, mesh, tubeProfile } from '../../models/parts/geom';
import { brass, darkSteel, steel } from '../../models/materials';

const D = Math.PI / 180;
const OMEGA = 0.9; // 설계표 구동 각속도 — 원판 120°(핀 1개)당 2.33초

// ── 기준점·치수(설계표 '좌표계·치수') ──
const CD: V2 = [1.003, 1.538]; // 핀 원판 중심
const SC: V2 = [-0.128, 1.112]; // 별 바퀴 중심
const PDC: V2 = [-0.57, 2.74]; // 드롭 피벗
const QL: V2 = [1.2807, -0.3364]; // 폴 힌지(드롭 로컬)
const LQ = 1.0464; // 폴 길이(힌지→끝)
const TEETH = 10; // 별 바퀴 이 수
const RO = 0.78, RI = 0.43; // 이끝·이뿌리 반지름
const RC = 0.52; // 폴 끝 접촉 반지름
const KOFF = -0.013; // 접촉 보정(rad)
const PITCH = (2 * Math.PI) / TEETH; // 이 간격 36°
const AR = 42 * D; // 폴 끝 쉼 극각(별 중심 기준)
const AE = AR + PITCH; // 들어가는(밀기 시작) 극각
const UE = 54, DU = 19; // 올림 끝(°), 스냅 길이(°)
const DE = 0.299; // 올림 끝에서의 드롭 각(rad)
const DISC0 = 57.25 * D; // θ = 0 원판 각 — 첫 핀이 드롭 아랫면에 닿는 순간
const AZ: V2 = [-1.73, 2.15]; // 스프링 고정 못
const TL: V2 = [-0.34, -0.50]; // 드롭 꼬리 핀(드롭 로컬)
const ZD = 0.06, ZS = 0.30, ZDR = 0.165; // 원판·별·드롭/스프링 깊이

const rot2 = (p: V2, a: number): V2 => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];
const add2 = (a: V2, b: V2): V2 => [a[0] + b[0], a[1] + b[1]];
/** 폴 힌지 위치 Qof(δ) — 드롭이 δ 만큼 돈 상태 */
const qof = (delta: number): V2 => add2(PDC, rot2(QL, delta));
const Q0 = qof(0);
const R0: V2 = add2(SC, [RC * Math.cos(AR), RC * Math.sin(AR)]); // 폴 끝 쉼점
const EPS0 = Math.atan2(R0[1] - Q0[1], R0[0] - Q0[0]); // 폴 쉼 절대각
/** 광선 풀이: 별 중심에서 극각 a 로 나가는 반직선과 폴 끝 원(중심 Qof(δ), 반지름 LQ)의 교점 중 별 쪽 */
function ray(delta: number, a: number): V2 {
  const u: V2 = [Math.cos(a), Math.sin(a)];
  const q = qof(delta);
  const w: V2 = [SC[0] - q[0], SC[1] - q[1]];
  const b = w[0] * u[0] + w[1] * u[1];
  const c = w[0] * w[0] + w[1] * w[1] - LQ * LQ;
  const r = -b - Math.sqrt(b * b - c);
  return add2(SC, [r * u[0], r * u[1]]);
}
/** 별 이끝각: 점 (a, r) 를 지나는 이 옆면을 가진 이의 이끝 각 */
const bt = (a: number, r: number): number => a - (PITCH / 2) * (RO - r) / (RO - RI) - KOFF / r;
const PHISTART = bt(AE, RC); // 밀기 직전 별 자세(k = 0)
const AEND = (() => {
  const p = ray(DE, AE), q = qof(DE);
  return Math.atan2(p[1] - q[1], p[0] - q[0]);
})(); // 휘두름 끝 폴 절대각

// 올림 단계 드롭 각 표(ud° : δ rad) — 핀이 드롭 아랫면과 핀 반지름 이상 떨어지게 하는 최소 각
const DTAB: [number, number][] = [
  [0, 0], [2, 0.017], [4, 0.03], [6, 0.042], [8, 0.055], [10, 0.068], [12, 0.08], [14, 0.093], [16, 0.106], [18, 0.119],
  [20, 0.131], [22, 0.144], [24, 0.156], [26, 0.168], [28, 0.18], [30, 0.191], [32, 0.202], [34, 0.213], [36, 0.223],
  [38, 0.234], [40, 0.243], [42, 0.253], [44, 0.261], [46, 0.27], [48, 0.278], [50, 0.285], [52, 0.292], [54, 0.299]
];
function deltaOf(ud: number): number {
  for (let i = 0; i < DTAB.length - 1; i++) {
    const [u0, d0] = DTAB[i]!;
    const [u1, d1] = DTAB[i + 1]!;
    if (ud <= u1) return d0 + ((d1 - d0) * (ud - u0)) / (u1 - u0);
  }
  return 0;
}
const smooth = (t: number): number => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};
const gcd = (x: number, y: number): number => (y === 0 ? x : gcd(y, x % y));

/** Z축 원통(z0~z1) 을 (x, y) 에 놓는다 */
function cylAt(r: number, z0: number, z1: number, mat: THREE.Material, x: number, y: number): THREE.Mesh {
  const m = mesh(new THREE.CylinderGeometry(r, r, z1 - z0, 24).rotateX(Math.PI / 2), mat);
  m.position.set(x, y, (z0 + z1) / 2);
  return m;
}

export default function buildM063(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 핀 원판(구동, 시계 방향) — 핀 3개, 로컬각 100°·−20°·−140°
  const disc = pinDisc(0.76, [
    { r: 0.53, a: 100 * D }, { r: 0.53, a: -20 * D }, { r: 0.53, a: -140 * D }
  ]);
  disc.position.set(CD[0], CD[1], ZD);
  // 원판 판은 드롭·별 판과 다른 z 층에서 겹쳐 보이는 판화 배치 — 2D 윤곽 침범 검사(같은 층 가정) 대상에서 뺀다
  disc.traverse((o) => { o.userData.outline = undefined; });

  // 별 바퀴(종동) — 이끝이 로컬 0°
  const star = starWheel(TEETH, RO, RI);
  star.position.set(SC[0], SC[1], ZS);

  // 드롭 레버 판(피벗 Pd) + 때리는 핀(장식)·꼬리 핀·폴 힌지 핀과 스페이서 고리
  const drop = new THREE.Group();
  drop.position.set(PDC[0], PDC[1], 0);
  const dropPlate = plateFrom(dropOutline(), [{ x: 0, y: 0, r: 0.1 }], 0.05, 'bronze');
  dropPlate.position.z = ZDR;
  dropPlate.userData.outline = undefined; // 폴 판 위를 지나는 다른 z 층 — 윤곽 검사 제외(k065 선례)
  drop.add(dropPlate);
  drop.add(cylAt(0.04, 0.19, 0.3, steel(), 0.36, -0.16)); // 때리는 핀 — 이 모델에서 장식
  drop.add(cylAt(0.018, 0.1, 0.23, steel(), TL[0], TL[1])); // 꼬리 핀 — 스프링 코일(안지름 0.023) 안에 들어가게 가늘게
  drop.add(cylAt(0.04, 0.19, 0.34, steel(), QL[0], QL[1])); // 폴 힌지 핀
  const spacer = mesh(lathe(tubeProfile(0.041, 0.07, -0.0375, 0.0375, 0.006), 24).rotateX(Math.PI / 2), darkSteel());
  spacer.position.set(QL[0], QL[1], 0.2275); // 폴 아래 스페이서 고리(드롭 판과 폴 판 사이)
  drop.add(spacer);

  // 폴(갈고리 칼날) — 드롭의 자식이 아니라 세계 좌표에 따로
  const pawl = new THREE.Group();
  const pawlPlate = plateFrom(pawlOutline(LQ), [{ x: 0, y: 0, r: 0.046 }], 0.07, 'steel'); // 힌지 구멍 — 핀(r 0.04)이 지나가게
  pawlPlate.position.z = ZS;
  pawl.add(pawlPlate);

  // 스프링(코일) — 고정 못 A 에서 드롭 꼬리 핀 T(δ) 까지 늘어남 + 못
  const spring = coilSpring(0.035, 0.012, 14);
  spring.position.set(AZ[0], AZ[1], ZDR);
  const nail = cylAt(0.018, 0.1, 0.23, steel(), AZ[0], AZ[1]); // 스프링 코일(안지름 0.023) 안에 들어가게 가늘게

  g.add(
    disc, star, drop, pawl, spring, nail,
    shaftZ(CD[0], CD[1], 0.26, 0.05),
    shaftZ(SC[0], SC[1], 0.4, 0.05),
    shaftZ(PDC[0], PDC[1], 0.24, 0.04),
    shaftZ(AZ[0], AZ[1], 0.22, 0.03)
  );

  // 슬롯 나사 머리(피벗 위, 드롭 판을 누른다)
  const head = cylAt(0.17, 0.19, 0.23, brass(), PDC[0], PDC[1]);
  const slot = mesh(new THREE.BoxGeometry(0.3, 0.03, 0.012), darkSteel());
  slot.rotation.z = Math.PI / 4;
  slot.position.set(PDC[0], PDC[1], 0.236);
  g.add(head, slot);

  // 회전 방향 화살표(둘 다 시계) + 이름표(움직임 밖 고정)
  const arrowD = rotArrow(0.55, false);
  arrowD.position.set(CD[0], CD[1], 0.26);
  const arrowS = rotArrow(0.45, false);
  arrowS.position.set(SC[0], SC[1], 0.4);
  g.add(arrowD, arrowS);
  g.add(
    tag('핀 원판', new THREE.Vector3(1.45, 0.6, 0.45)),
    tag('별 바퀴', new THREE.Vector3(-1.55, 0.8, 0.45)),
    tag('드롭(레버)', new THREE.Vector3(-1.62, 2.95, 0.45)),
    tag('폴(칼날)', new THREE.Vector3(1.6, 2.45, 0.45)),
    tag('스프링', new THREE.Vector3(-1.54, 1.5, 0.45)) // 고정 못 축 가까이 — 늘어나는 spring 그룹을 따라가지 않는 자리
  );

  let phase = '쉼';
  let kLast = 0;
  const ratio = 120 / gcd(120, (360 / TEETH) | 0);
  const ratioS = ((360 / TEETH) | 0) / gcd(120, (360 / TEETH) | 0);

  return {
    group: g,
    notes: () => [
      { label: '핀 1개당', value: `별 1이(${Math.round(360 / TEETH)}°)` },
      { label: '속도비', value: `원판 ${ratio} : 별 ${ratioS}` },
      { label: '별 바퀴 이 수', value: String(TEETH) },
      { label: '도약 횟수', value: `${kLast}회 · ${phase}` }
    ],
    update(dt: number, speed: number): void {
      // 절대 각도 θ 에서 모든 자세를 다시 계산 — 증분 누적 없음
      theta += OMEGA * speed * dt;
      const thDeg = theta / D;
      const k = Math.floor(thDeg / 120);
      const ud = thDeg - 120 * k;
      const f = (ud - UE) / DU;
      let delta = 0;
      let abs = EPS0;
      let starZ = PHISTART - PITCH * k;
      if (ud < UE) {
        // 1 올림: 핀이 드롭 아랫면을 밀어 드롭·폴을 같이 올린다, 별 정지
        delta = deltaOf(ud);
        abs = EPS0 + delta;
        phase = '올림';
      } else if (ud < UE + 0.3 * DU) {
        // 2 뒤로 휘두름: 핀이 폴에서 빠지고 폴 끝이 이끝 위(반지름 0.85 이상)를 지나 별 틈 위로
        delta = DE;
        abs = EPS0 + DE + (AEND - (EPS0 + DE)) * smooth((ud - UE) / (0.3 * DU));
        phase = '휘두름';
      } else if (ud < UE + 0.62 * DU) {
        // 3 떨어짐: 폴 끝이 별 틈 가운데 반직선(극각 AE)을 따라 곧게 내려앉는다, 별 정지
        delta = DE * (1 - smooth((f - 0.3) / 0.32));
        const tip = ray(delta, AE), q = qof(delta);
        abs = Math.atan2(tip[1] - q[1], tip[0] - q[0]);
        phase = '떨어짐';
      } else if (ud < UE + DU) {
        // 4 밀기: 스프링이 던진 드롭의 핀이 폴을 쳐 폴 끝이 이 옆면을 따라 밀며 별이 1이(36°) 돈다
        const a = AE - PITCH * smooth((f - 0.62) / 0.38);
        const tip = ray(0, a);
        const r = Math.hypot(tip[0] - SC[0], tip[1] - SC[1]);
        abs = Math.atan2(tip[1] - Q0[1], tip[0] - Q0[0]);
        starZ = Math.min(bt(a, r), PHISTART) - PITCH * k; // 접촉 전까지는 쉼 자세(백래시)
        phase = '밀기';
      } else {
        // 5 쉼: 폴 끝이 R0 에 앉아 다음 핀을 기다린다
        starZ = PHISTART - PITCH * (k + 1);
        phase = '쉼';
      }
      kLast = k;
      const q = qof(delta);
      disc.rotation.z = DISC0 - theta; // 시계 방향이라 −
      star.rotation.z = starZ; // 이끝이 로컬 0° 이므로 그대로
      drop.rotation.z = delta;
      pawl.position.set(q[0], q[1], 0);
      pawl.rotation.z = abs;
      const t2 = add2(PDC, rot2(TL, delta)); // 꼬리 핀 T(δ)
      spring.rotation.z = Math.atan2(t2[1] - AZ[1], t2[0] - AZ[0]);
      spring.scale.x = Math.hypot(t2[0] - AZ[0], t2[1] - AZ[1]); // coilSpring 은 +X 길이 1
    }
  };
}
