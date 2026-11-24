// 019 도르래 배열 — 위 도르래 A(고정)·B·C 가 왼쪽 아래로 층층이, 짐 위에 작은 도르래 3개가 나란히 (판화 19번)
// 줄 3개: 각 줄은 위 블록 아랫 눈에 매여 내려와 → 짐 도르래 밑을 감고 올라가 → 그 위 도르래를 넘어 → 다음 블록 윗 눈(마지막 줄은 손)으로 간다.
// 줄 장력 T : 3T : 9T, 짐을 드는 가닥 2T + 6T + 18T = 26T (3³ − 1)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { Rope, arcPoints, ceilingBeam, displayStand, pulleyBlock, rod, ropeEnd, rotArrow, tag, weight } from '../kit';

const Z = 0.22; // 도르래·줄 중심 면(모든 줄이 한 면 — 교차 없음)
const ROPE = 0.012; // 줄 반지름
const HOOK = 0.06; // 눈고리 중심 = 바퀴 둘레에서 0.06 바깥
const HOOK_D = 0.05; // 짐 도르래 아랫 눈
// 위 도르래 반지름(위로 갈수록 크다). 짐 도르래는 그 절반이라 모든 가닥이 수직이다
const RA = 0.25;
const RB = 0.185;
const RC = 0.125;
const R1 = RC / 2; // D1 (C 와 짝)
const R2 = RB / 2; // D2 (B 와 짝)
const R3 = RA / 2; // D3 (A 와 짝)
// 중심 x — B 윗 눈은 A 왼쪽 접선 아래, C 윗 눈은 B 왼쪽 접선 아래
const AX = 0.3;
const BX = AX - RA; // 0.05
const CX = BX - RB; // −0.135
const D1X = CX + R1;
const D2X = BX + R2;
const D3X = AX + R3;
const AY = 2.58; // A 중심(고정)
const BY0 = 2.02; // B 중심 처음 높이
const CY0 = 1.58; // C 중심 처음 높이
const DY0 = 0.8; // 짐 도르래 중심 처음 높이
const BAR_DROP = 0.24; // 짐 도르래 중심 → 추 윗면
const BAR_W = 0.86;
const BAR_H = 0.22;
const BAR_X = (CX + AX + RA) / 2; // 가닥들의 한가운데
const U_MAX = 0.04; // 짐이 오르는 높이
const PHI = (25 * Math.PI) / 180; // 당기는 줄이 수직에서 왼쪽으로 기운 각
const LEAVE = Math.PI - PHI; // 당기는 줄이 C 를 떠나는 접점 각
const FREE0 = 0.35; // 당기는 가닥의 처음 길이
/** 짐이 1 오를 때 손이 줄 방향으로 움직이는 거리: C 를 지나는 줄 18 + C 가 내려오는 8 의 줄 방향 성분 */
const GAIN = 18 + 8 * Math.cos(PHI);

const v = (x: number, y: number, z = Z): THREE.Vector3 => new THREE.Vector3(x, y, z);

/** theta → 당김 위상 p(0~1) */
function phase(theta: number): number {
  return (1 - Math.cos(theta * 0.5)) / 2;
}

export default function buildM019(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  let u = 0; // notes() 가 읽는 현재 짐 상승량

  g.add(displayStand());
  g.add(ceilingBeam(-0.6, 1.0, 3.0, [AX])); // 고리 아랫점 (AX, 2.94, 0.22)

  // A 고정 도르래 — 윗 눈은 들보 고리에, 아랫 눈에는 줄 1 의 고정 끝
  const blockA = pulleyBlock(RA, { hookUp: HOOK, hookDown: HOOK });
  blockA.position.set(AX, AY, Z);
  g.add(blockA);
  g.add(rod(v(AX, AY + RA + HOOK), v(AX, 2.94), 0.008));

  // B·C — 윗 눈은 위 줄의 끝에 매달리고, 아랫 눈에는 자기 줄의 고정 끝
  const blockB = pulleyBlock(RB, { hookUp: HOOK, hookDown: HOOK });
  const blockC = pulleyBlock(RC, { hookUp: HOOK, hookDown: HOOK });
  g.add(blockB, blockC);

  // 짐: 넓은 추 하나 + 그 위에 작은 도르래 3개(한 몸으로 오르내린다). 원점 = 짐 도르래 중심 높이
  const load = new THREE.Group();
  const bar = weight(BAR_W, BAR_H);
  bar.scale.z = 0.5; // 앞뒤로 얇게
  bar.traverse((o) => {
    // 가운데 큰 고리는 쓰지 않는다(도르래 3개가 추를 든다)
    if ((o as THREE.Mesh).geometry?.type === 'TorusGeometry') o.visible = false;
  });
  bar.position.set(BAR_X, -BAR_DROP - BAR_H / 2, 0);
  load.add(bar);
  const blockD: THREE.Group[] = [];
  for (const [x, r] of [[D1X, R1], [D2X, R2], [D3X, R3]] as const) {
    const b = pulleyBlock(r, { hookDown: HOOK_D, width: 0.05, spokes: 3 });
    b.position.set(x, 0, 0);
    load.add(b);
    load.add(rod(v(x, -(r + HOOK_D), 0), v(x, -BAR_DROP, 0), 0.008)); // 아랫 눈 → 추 윗면
    blockD.push(b);
  }
  g.add(load);

  // 줄 3개(각각 따로) + 고정 끝·매단 끝의 매듭
  const rope1 = new Rope(ROPE);
  const rope2 = new Rope(ROPE);
  const rope3 = new Rope(ROPE);
  g.add(rope1.group, rope2.group, rope3.group);
  const knotMat = new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.9 });
  const knotGeo = new THREE.SphereGeometry(0.019, 14, 10);
  const knots: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const k = new THREE.Mesh(knotGeo, knotMat);
    k.castShadow = true;
    knots.push(k);
    g.add(k);
  }

  // 당기는 끝 손잡이(줄 방향으로 기울임)
  const handle = ropeEnd();
  handle.rotation.z = -PHI;
  g.add(handle);

  // A 앞 회전 방향 화살표(반시계)
  const arrow = rotArrow(0.32, true);
  arrow.position.set(AX, AY, 0.4);
  g.add(arrow);

  // 이름표 — 움직이는 부품 것은 매 프레임 따라간다
  const tagA = tag('A 고정 도르래', v(AX + RA + 0.62, AY + 0.12, 0.4));
  const tagB = tag('B 도르래', v(0, 0, 0.4));
  const tagC = tag('C 도르래', v(0, 0, 0.4));
  const tagD = tag('짐 도르래 3개', v(0, 0, 0.4));
  const tagW = tag('짐', v(0, 0, 0.4));
  const tagP = tag('당기는 곳', v(0, 0, 0.4));
  g.add(tagA, tagB, tagC, tagD, tagW, tagP);

  const sheaveA = blockA.userData.sheave as THREE.Group;
  const sheaveB = blockB.userData.sheave as THREE.Group;
  const sheaveC = blockC.userData.sheave as THREE.Group;
  const sheaveD = blockD.map((b) => b.userData.sheave as THREE.Group);

  /** theta 하나에서 모든 부품의 절대 자세를 다시 계산 */
  function apply(): void {
    u = U_MAX * phase(theta);
    const yD = DY0 + u; // 짐(도르래 3개 + 추)이 u 오른다
    const yB = BY0 - 2 * u; // 줄 1: D3 양쪽 가닥이 u 씩 줄어 B 가 2u 내려온다
    const yC = CY0 - 8 * u; // 줄 2: B–D2 사이가 3u 줄어 6u 가 넘어온다 → C 는 2u + 6u
    const free = FREE0 + 18 * u; // 줄 3: C–D1 사이가 9u 줄어 18u 가 손 쪽으로 나온다

    blockB.position.set(BX, yB, Z);
    blockC.position.set(CX, yC, Z);
    load.position.set(0, yD, Z);

    // 도르래 회전(모두 반시계 +) = 바퀴를 지나간 줄 길이 ÷ 반지름
    sheaveD[2]!.rotation.z = u / R3;
    sheaveA.rotation.z = (2 * u) / RA;
    sheaveD[1]!.rotation.z = (3 * u) / R2;
    sheaveB.rotation.z = (6 * u) / RB;
    sheaveD[0]!.rotation.z = (9 * u) / R1;
    sheaveC.rotation.z = (18 * u) / RC;

    // 줄 1: A 아랫 눈(고정) → D3 밑 → A 위를 넘어 → B 윗 눈
    const a0 = v(AX, AY - RA - HOOK);
    const b1 = v(BX, yB + RB + HOOK);
    rope1.setPath([
      a0,
      v(AX, yD),
      ...arcPoints([D3X, yD], R3, Math.PI, 2 * Math.PI, Z),
      v(AX + RA, yD),
      v(AX + RA, AY),
      ...arcPoints([AX, AY], RA, 0, Math.PI, Z),
      v(BX, AY),
      b1
    ]);
    // 줄 2: B 아랫 눈 → D2 밑 → B 위를 넘어 → C 윗 눈
    const b0 = v(BX, yB - RB - HOOK);
    const c1 = v(CX, yC + RC + HOOK);
    rope2.setPath([
      b0,
      v(BX, yD),
      ...arcPoints([D2X, yD], R2, Math.PI, 2 * Math.PI, Z),
      v(BX + RB, yD),
      v(BX + RB, yB),
      ...arcPoints([BX, yB], RB, 0, Math.PI, Z),
      v(CX, yB),
      c1
    ]);
    // 줄 3: C 아랫 눈 → D1 밑 → C 위를 넘어(접점 각 LEAVE 까지만) → 왼쪽 아래로 비스듬히 손까지
    const c0 = v(CX, yC - RC - HOOK);
    const tx = CX + RC * Math.cos(LEAVE);
    const ty = yC + RC * Math.sin(LEAVE);
    const ex = tx - free * Math.sin(PHI);
    const ey = ty - free * Math.cos(PHI);
    rope3.setPath([
      c0,
      v(CX, yD),
      ...arcPoints([D1X, yD], R1, Math.PI, 2 * Math.PI, Z),
      v(CX + RC, yD),
      v(CX + RC, yC),
      ...arcPoints([CX, yC], RC, 0, LEAVE, Z),
      v(ex, ey)
    ]);
    handle.position.set(ex, ey, Z);
    [a0, b1, b0, c1, c0].forEach((p, i) => knots[i]!.position.copy(p));

    // 이름표가 움직이는 부품을 따라간다
    tagB.position.set(BX - RB - 0.55, yB + 0.12, 0.4);
    tagC.position.set(CX - RC - 0.55, yC + 0.2, 0.4);
    tagD.position.set(AX + RA + 0.75, yD + 0.05, 0.4);
    tagW.position.set(BAR_X + BAR_W / 2 + 0.3, yD - BAR_DROP - BAR_H / 2 - 0.08, 0.4);
    tagP.position.set(ex - 0.55, ey - 0.02, 0.4);
  }

  apply(); // 첫 프레임 전 초기 자세

  return {
    group: g,
    notes: () => [
      { label: '이득', value: '약 ' + GAIN.toFixed(0) + '배 (곧게 내려 당기면 26 = 3³ − 1)' },
      { label: '줄의 힘 (C·B·A 를 넘는 줄)', value: 'T : 3T : 9T → 짐 2T + 6T + 18T' },
      { label: '당긴 줄 : 오른 높이', value: (GAIN * u).toFixed(2) + " : " + u.toFixed(3) }
    ],
    update(dt: number, speed: number): void {
      // 절대 위상에서 전체 자세 재계산 — 역회전·누적 오차 없음
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
