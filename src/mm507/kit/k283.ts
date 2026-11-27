// 283 손잡이로 구동하는 두 개의 랙 전용 키트 (설계표 docs/mm507-sheets/283.md)
// 손잡이가 붙은 피니언이 θ 로 흔들리고, 왼쪽·오른쪽 랙이 서로 반대로 오르내린다(YL = −0.45θ, YR = +0.45θ).
import * as THREE from 'three';
import { brass, bronze, castIron, darkSteel, paint, rubber, steel } from '../../models/materials';
import { extrude, lathe, merge, mesh, rodProfile, shapeFrom, tubeProfile } from '../../models/parts/geom';
import type { V2 } from './belt';
import { setMM } from './mm';

/** 설계표 상수 — 세계 좌표, 피니언 중심 C, 모듈 0.05(피치 0.15708), 흔들림 진폭 0.5rad·주기 5초 */
export const K283 = {
  C: [0, 2.15], // 피니언 중심
  N: 18, // 피니언 이수
  M: 0.05, // 모듈
  RP: 0.45, // 피니언 피치 반지름
  P: 0.15708, // 랙 피치(π·M)
  AMP: 0.5, // 손잡이 진폭(rad, 28.65°)
  W: 1.256637, // 진동 각진동수(rad/s)
  TOOTH: [-0.0625, 0.05, 0.06202, 0.02107], // 랙 이: 뿌리 x · 끝 x · 뿌리 반폭 · 끝 반폭
  RACK_Y: [-0.95, 0.75], // 랙 몸 세로 범위(로컬)
  ROD: 0.62 // 피스톤 막대 길이
} as const;

/** 구동 상태(닫힌 식): θ = 0.5·sin(1.256637·t) → 왼쪽 랙 YL = −0.45θ, 오른쪽 YR = +0.45θ */
export function state283(t: number): { theta: number; yL: number; yR: number } {
  const theta = K283.AMP * Math.sin(K283.W * t);
  return { theta, yL: -K283.RP * theta, yR: K283.RP * theta };
}

const posOf = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number): T => {
  o.position.set(x, y, z);
  return o;
};

/** 랙 윤곽(로컬): 이가 +X 쪽, 원점 = 피치선 위 기준 이(k=0) 가운데. side −1 이면 x 를 뒤집는다(오른쪽 랙, 위 끝 반원) */
export function rackOutline283(side: 1 | -1): V2[] {
  const [xr, xt, wr, wt] = K283.TOOTH;
  const [y0, y1] = K283.RACK_Y;
  const xb = -0.20; // 몸 뒷면
  const pts: V2[] = [
    [xb, y0],
    [xr, y0]
  ];
  for (let k = -4; k <= 4; k++) {
    const c = k * K283.P;
    pts.push([xr, c - wr], [xt, c - wt], [xt, c + wt], [xr, c + wr]);
  }
  const xc = (xb + xr) / 2; // 몸 가운데 x
  const r = (xr - xb) / 2; // 0.1375 — 몸 너비의 절반
  if (side === -1) {
    // 위 끝 반원(판화의 둥근 오른쪽 랙)
    for (let i = 1; i < 12; i++) {
      const a = (Math.PI * i) / 12;
      pts.push([xc + Math.cos(a) * r, y1 + Math.sin(a) * r]);
    }
    pts.push([xb, y1]);
  } else {
    // 위 끝 모서리 0.02 둥글림
    const rc = 0.02;
    for (let i = 1; i < 4; i++) {
      const a = (Math.PI * i) / 8;
      pts.push([xr - rc + Math.cos(a) * rc, y1 - rc + Math.sin(a) * rc]);
    }
    for (let i = 1; i < 4; i++) {
      const a = Math.PI / 2 + (Math.PI * i) / 8;
      pts.push([xb + rc + Math.cos(a) * rc, y1 - rc + Math.sin(a) * rc]);
    }
  }
  if (side === 1) return pts;
  return pts.map(([x, y]) => [-x, y] as V2).reverse(); // x 뒤집고 반시계 유지
}

/** 랙 + 피스톤 막대·피스톤·노란 띠(한 몸). side 1 = 왼쪽 랙(이가 +X), −1 = 오른쪽 랙(이가 −X, 위 끝 반원) */
export function rack283(side: 1 | -1): THREE.Group {
  const g = new THREE.Group();
  const outline = rackOutline283(side);
  const body = mesh(extrude(shapeFrom(outline), 0.1, 0.004), brass());
  body.userData.outline = outline; // 침범 검사용 윤곽
  body.name = side === 1 ? 'rackL' : 'rackR';
  g.add(body);
  const cx = -0.13 * side; // 몸 가운데선(로컬 x — side −1 이면 +0.13)
  // 피스톤 막대: 위 끝 랙 아래면(−0.95)에 박힘
  const rodM = mesh(lathe(rodProfile(0.03, -0.945, -0.95 - K283.ROD + 0.005, 0.003, 0.003), 20), steel());
  rodM.name = side === 1 ? 'rodL' : 'rodR';
  rodM.position.x = cx;
  g.add(rodM);
  // 피스톤(막대 끝에 붙음) + 고무 띠(피스톤 가운데)
  const pisM = mesh(lathe(rodProfile(0.135, -1.63, -1.57, 0.006, 0.006), 36), bronze());
  pisM.name = side === 1 ? 'pistonL' : 'pistonR';
  pisM.position.x = cx;
  g.add(pisM);
  g.add(posOf(mesh(lathe(tubeProfile(0.128, 0.137, -1.61, -1.59, 0.002), 36), rubber()), cx, 0, 0));
  // 노란 표시 띠 — 몸 앞면(0.05)에 대고 앞면이 깊이 0.052
  const strip = mesh(new THREE.BoxGeometry(0.08, 0.02, 0.004), paint(0xf2b619));
  strip.position.set(cx, -0.7, 0.05);
  g.add(strip);
  setMM(g, { kind: 'rack', fn: 'rack283', module: K283.M, axis: 'y', side });
  return g;
}

/** 손잡이: 허브 관 + 볼트 2 + 휜 팔(가운데선 5점 곡선의 평행선 윤곽) + 빨간 알. 피니언 앞면에 볼트로 붙어 같이 돈다 */
export function handle283(): THREE.Group {
  const g = new THREE.Group();
  // 허브 관(뒷면 0.048 — 피니언 앞면 0.05 에 0.002 박아 볼트 고정, 같은 평면 떨림 방지)
  const hubGeo = lathe(tubeProfile(0.063, 0.11, 0.048, 0.112, 0.006), 32);
  hubGeo.rotateX(Math.PI / 2);
  g.add(mesh(hubGeo, steel()));
  // 볼트 머리 2개(각 ±90°, 반지름 0.085)
  const boltGeo = lathe(rodProfile(0.015, 0.112, 0.124, 0.002, 0.002), 12);
  boltGeo.rotateX(Math.PI / 2);
  for (const s of [-1, 1]) g.add(posOf(mesh(boltGeo, darkSteel()), 0, s * 0.085, 0));
  // 휜 팔: 가운데선(반지름, 각°) 5점을 부드러운 곡선으로 이어 양쪽 평행선
  const MID: [number, number][] = [
    [0.1, 131],
    [0.3, 128],
    [0.5, 127],
    [0.7, 129],
    [0.85, 134]
  ];
  const d = Math.PI / 180;
  const curve = new THREE.CatmullRomCurve3(MID.map(([r, a]) => new THREE.Vector3(r * Math.cos(a * d), r * Math.sin(a * d), 0)));
  const n = 48;
  const sm = curve.getPoints(n);
  const left: V2[] = [];
  const right: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const hw = 0.035 - 0.01 * u; // 반폭 0.035 → 0.025(폭 0.07 → 끝 0.05)
    const p0 = sm[i === 0 ? 0 : i - 1]!;
    const p1 = sm[i === n ? n : i + 1]!;
    const tx = p1.x - p0.x;
    const ty = p1.y - p0.y;
    const L = Math.hypot(tx, ty) || 1;
    left.push([sm[i]!.x - (ty / L) * hw, sm[i]!.y + (tx / L) * hw]);
    right.push([sm[i]!.x + (ty / L) * hw, sm[i]!.y - (tx / L) * hw]);
  }
  const armGeo = extrude(shapeFrom([...left, ...right.reverse()]), 0.04, 0.004);
  armGeo.translate(0, 0, 0.082); // 깊이 0.062 ~ 0.102
  g.add(mesh(armGeo, steel()));
  // 끝 손잡이 알(빨강, 축 = 깊이, 가운데선 끝점)
  const knobGeo = lathe(rodProfile(0.035, 0.1, 0.2, 0.008, 0.008), 24);
  knobGeo.rotateX(Math.PI / 2);
  const [er, ea] = MID[MID.length - 1]!;
  const knob = mesh(knobGeo, paint(0xc0392b));
  knob.name = 'handleKnob';
  knob.position.set(er * Math.cos(ea * d), er * Math.sin(ea * d), 0);
  g.add(knob);
  return g;
}

/** 네모 안내 고리: 안쪽 x0~x1 · 깊이 ±0.053(랙과 틈 0.003), 높이 0.07, 바깥벽에서 뒤판(−0.30)까지 팔 */
export function rackGuide283(x0: number, x1: number, y0: number): THREE.Group {
  const g = new THREE.Group();
  const H = 0.07; // 고리 높이
  const T = 0.03; // 벽 두께
  const zi = 0.053; // 안쪽 깊이 반폭
  const box = (bx0: number, bx1: number, bz0: number, bz1: number): THREE.BufferGeometry => {
    const geo = new THREE.BoxGeometry(bx1 - bx0, H, bz1 - bz0);
    geo.translate((bx0 + bx1) / 2, y0 + H / 2, (bz0 + bz1) / 2);
    return geo;
  };
  const armC = (x0 + x1) / 2 < 0 ? x0 - T / 2 : x1 + T / 2; // 팔은 바깥쪽 벽 x 가운데(폭 0.10)
  g.add(
    mesh(
      merge([
        box(x0 - T, x1 + T, zi, zi + T), // 앞벽
        box(x0 - T, x1 + T, -zi - T, -zi), // 뒷벽
        box(x0 - T, x0, -zi, zi), // 기어 쪽 벽
        box(x1, x1 + T, -zi, zi), // 바깥쪽 벽
        box(armC - 0.05, armC + 0.05, -0.3, -zi - T + 0.005) // 뒤판 팔(고리 뒷벽과 0.005 겹침)
      ]),
      castIron()
    )
  );
  setMM(g, { kind: 'part', fn: 'rackGuide283', x0, x1, y0 });
  return g;
}
