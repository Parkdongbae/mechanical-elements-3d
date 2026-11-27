// 285 선반 심압대 전용 키트 — 상수, 닫힌 상태식, 앞 반쪽을 잘라 낸 관(배럴·마개), 스핀들(키 홈)+너트(나사산 단면)+센터.
// 설계표 docs/mm507-sheets/285.md. 축 = 세계 x(높이 YA, 깊이 ZC). 단면 평면 = 깊이 ZC(그 앞은 잘라 냄).
import * as THREE from 'three';
import { brass, paint, steel } from '../../models/materials';
import {
  lathe,
  merge,
  mesh,
  polygonFace,
  rodProfile,
  trapezoidThread,
  tubeProfile,
  type V2
} from '../../models/parts/geom';

export const K285 = {
  YA: 2.1, // 축 높이
  ZC: 0.18, // 축 깊이 = 단면 평면
  P: 0.12, // 피치
  RMAJ: 0.1, // 나사 바깥 반지름
  DEPTH: 0.04, // 나사산 높이
  CLR: 0.006, // 너트 나사산 반지름 틈
  XS0: -0.95, // 스핀들 왼쪽 끝면 처음 자리
  AMP: 12.56637, // θ 진폭(4 바퀴의 절반 = 2·2π)
  PERIOD: 20,
  NUT: [1.26, 1.5] as [number, number], // 스핀들 로컬 x
  KEYWAY: [0.53, 1.15] as [number, number],
  KEY_W: 0.032, // 키 홈 반폭
  KEY_FLOOR: 0.157, // 키 홈 바닥 반지름
  SP_IN: 0.14,
  SP_OUT: 0.197,
  SP_LEN: 1.5
};

const PI = Math.PI;
const SECTION_RED = 0xd2552e;
const NUT_SECTION = 0xe8743b;

export interface State285 {
  theta: number; // 바퀴·나사 각(세계 +x 둘레 오른손)
  xs: number; // 스핀들 왼쪽 끝면 x
  dir: number; // +1 늘어남 / −1 줄어듦
}

/** 닫힌 상태식 — θ = AMP(1−cos(πt/10)), 스핀들 x_s = −0.95 − (P/2π)θ */
export function state285(t: number): State285 {
  const tc = ((t % K285.PERIOD) + K285.PERIOD) % K285.PERIOD;
  const theta = K285.AMP * (1 - Math.cos((PI * tc) / (K285.PERIOD / 2)));
  const xs = K285.XS0 - (K285.P / (2 * PI)) * theta;
  return { theta, xs, dir: tc < K285.PERIOD / 2 ? 1 : -1 };
}

/** 로컬 y 축 회전체 윤곽을 뒤 반쪽(z<0)으로 돌려 세계 +x 가 축이 되게 한다. φ0~φ1 로 더 좁힐 수 있다(위쪽 φ = 3π/2) */
function halfLatheX(profile: V2[], phi0 = PI / 2, phi1 = PI * 1.5): THREE.BufferGeometry {
  return lathe(profile, 64, phi0, phi1 - phi0).rotateZ(-PI / 2);
}

function sectionMat(color: number): THREE.MeshPhysicalMaterial {
  const m = paint(color, { roughness: 0.6 });
  m.side = THREE.DoubleSide;
  return m;
}

/** 단면 평면 위 다각형(x, 축에서의 높이) → 주홍 단면판. 원점 = 축 */
function sectionFace(pts: V2[], name: string, color = SECTION_RED): THREE.Mesh {
  const m = mesh(polygonFace(pts), sectionMat(color));
  m.name = name;
  return m;
}

/** 위쪽 키 홈·구멍의 옆벽 판(축 둘레 φ = 3π/2 − δ 에서 반지름 ra~rb, x xa~xb) */
function slotWall(xa: number, xb: number, ra: number, rb: number, delta: number, body: THREE.Material, name: string): THREE.Mesh {
  const P = (x: number, r: number): [number, number, number] => [x, r * Math.cos(delta), -r * Math.sin(delta)];
  const [a, b, c, d] = [P(xa, ra), P(xb, ra), P(xb, rb), P(xa, rb)];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(12), 2));
  geo.computeVertexNormals();
  const mat = (body as THREE.MeshStandardMaterial).clone();
  mat.side = THREE.DoubleSide;
  const m = mesh(geo, mat);
  m.name = name;
  return m;
}

export interface HalfTubeOpts {
  /** 위 벽에 뚫린 세로 구멍(잠금 나사 자리)의 x 범위 — 반쪽이라 홈으로 보인다 */
  slot?: [number, number];
  name?: string;
}

/** 뒤 반쪽 관(안 rIn · 바깥 rOut, x0~x1) + 잘린 면(주홍). 원점 = 축(세계 (0, YA, ZC) 에 놓을 것) */
export function halfTube285(rIn: number, rOut: number, x0: number, x1: number, body: THREE.Material, opts: HalfTubeOpts = {}): THREE.Group {
  const g = new THREE.Group();
  const tube = (a: number, b: number, phi1 = PI * 1.5): THREE.BufferGeometry => halfLatheX(tubeProfile(rIn, rOut, a, b), PI / 2, phi1);
  const slot = opts.slot;
  const upper: V2[][] = [];
  if (!slot) {
    const shell = mesh(tube(x0, x1), body);
    shell.name = opts.name ?? 'halfTube';
    g.add(shell);
    upper.push([
      [x0, rIn],
      [x1, rIn],
      [x1, rOut],
      [x0, rOut]
    ]);
  } else {
    const delta = Math.asin((slot[1] - slot[0]) / 2 / rIn);
    const shell = mesh(merge([tube(x0, slot[0]), tube(slot[0], slot[1], PI * 1.5 - delta), tube(slot[1], x1)]), body);
    shell.name = opts.name ?? 'halfTube';
    g.add(shell);
    g.add(slotWall(slot[0], slot[1], rIn, rOut, delta, body, (opts.name ?? 'halfTube') + 'Wall'));
    upper.push(
      [
        [x0, rIn],
        [slot[0], rIn],
        [slot[0], rOut],
        [x0, rOut]
      ],
      [
        [slot[1], rIn],
        [x1, rIn],
        [x1, rOut],
        [slot[1], rOut]
      ]
    );
  }
  const nm = opts.name ?? 'halfTube';
  upper.forEach((p, i) => g.add(sectionFace(p, nm + 'CutTop' + (i === 0 ? '' : String(i + 1)))));
  g.add(
    sectionFace(
      [
        [x0, -rOut],
        [x1, -rOut],
        [x1, -rIn],
        [x0, -rIn]
      ],
      nm + 'CutBottom'
    )
  );
  return g;
}

/** 너트 잘린 면 윤곽(ξ, r>0) — 위쪽 u = frac((ξ−0.95)/0.12 + 0.25), 아래쪽은 위상 −0.25. 안쪽 곡선 + 바깥 0.14 직선으로 닫음 */
export function nutFace285(top: boolean): [number, number][] {
  const th = trapezoidThread(0.3, 0.3);
  const [a, b] = K285.NUT;
  const ph = top ? 0.25 : -0.25;
  const uOf = (xi: number): number => {
    const q = (xi - 0.95) / K285.P + ph;
    return q - Math.floor(q);
  };
  const rOf = (xi: number): number => K285.RMAJ - K285.DEPTH * (1 - th.profile(uOf(xi))) + K285.CLR;
  // 0.002 간격 + 꺾이는 점(u = 0.15·0.35·0.65·0.85 에 해당하는 ξ)
  const xs = new Set<number>();
  for (let i = 0; a + i * 0.002 <= b + 1e-9; i++) xs.add(Math.round((a + i * 0.002) * 1e6) / 1e6);
  for (let k = -3; k <= 6; k++) {
    for (const u of [0.15, 0.35, 0.65, 0.85]) {
      const xi = 0.95 + (k + u - ph) * K285.P;
      if (xi > a + 1e-6 && xi < b - 1e-6) xs.add(Math.round(xi * 1e6) / 1e6);
    }
  }
  const list = [...xs].sort((p, q) => p - q);
  const pts: [number, number][] = list.map((xi) => [xi, rOf(xi)]);
  pts.push([b, K285.SP_IN], [a, K285.SP_IN]);
  return pts;
}

/** 스핀들 묶음(원점 = 스핀들 왼쪽 끝면 중심, 로컬 x 0~1.5): 반쪽 관(키 홈) + 너트 반쪽 + 센터. 세계 위치 (xs, YA, ZC) 에 놓을 것 */
export function spindle285(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'spindleGroup';
  const { SP_IN: rIn, SP_OUT: rOut, SP_LEN: len, KEYWAY: kw, KEY_FLOOR: kf, KEY_W: kwid } = K285;
  const body = steel();

  // 스핀들 관: 키 홈 구간(0.53~1.15)은 윗벽을 옆벽까지만(φ 3π/2−δ), 홈 바닥 안쪽 얇은 고리만 위까지
  const delta = Math.asin(kwid / kf);
  const tube = (a: number, b: number, ri: number, ro: number, phi1 = PI * 1.5): THREE.BufferGeometry => halfLatheX(tubeProfile(ri, ro, a, b), PI / 2, phi1);
  const shellGeo = merge([
    tube(0, kw[0], rIn, rOut),
    tube(kw[0], kw[1], rIn, rOut, PI * 1.5 - delta),
    tube(kw[0], kw[1], rIn, kf, PI * 1.5), // 홈 바닥(안쪽 얇은 고리)
    tube(kw[1], len, rIn, rOut)
  ]);
  const shell = mesh(shellGeo, body);
  shell.name = 'spindle';
  g.add(shell);
  g.add(slotWall(kw[0], kw[1], kf, rOut, delta, body, 'spindleKeyWall'));
  // 잘린 면: 위쪽(키 홈 파냄) + 아래쪽
  g.add(
    sectionFace(
      [
        [0, rIn],
        [len, rIn],
        [len, rOut],
        [kw[1], rOut],
        [kw[1], kf],
        [kw[0], kf],
        [kw[0], rOut],
        [0, rOut]
      ],
      'spindleCutTop'
    ),
    sectionFace(
      [
        [0, -rOut],
        [len, -rOut],
        [len, -rIn],
        [0, -rIn]
      ],
      'spindleCutBottom'
    )
  );

  // 너트: 반쪽 관(안 0.106 · 바깥 0.14) + 나사산 모양 잘린 면(위·아래)
  const nutShell = mesh(halfLatheX(tubeProfile(0.106, 0.14, K285.NUT[0], K285.NUT[1])), brass());
  nutShell.name = 'nut';
  g.add(nutShell);
  const top = nutFace285(true);
  const bot = nutFace285(false).map(([x, r]): V2 => [x, -r]);
  g.add(sectionFace(top, 'nutCutTop', NUT_SECTION), sectionFace(bot, 'nutCutBottom', NUT_SECTION));

  // 센터: 원뿔(뾰족 끝이 로컬 x −0.28) + 자루(반지름 0.138, 로컬 x 0~0.25 — 스핀들 구멍 속)
  const cone = lathe(
    [
      [0, -0.28],
      [0.12, 0],
      [0.12, 0.02]
    ],
    40
  ).rotateZ(-PI / 2); // 로컬 y → 세계 +x, 뾰족 끝(y −0.28)이 왼쪽
  const shank = lathe(rodProfile(0.138, 0, 0.25), 40).rotateZ(-PI / 2);
  const centerMat = steel();
  centerMat.side = THREE.DoubleSide;
  const center = mesh(merge([cone, shank]), centerMat);
  center.name = 'center';
  g.add(center);
  return g;
}
