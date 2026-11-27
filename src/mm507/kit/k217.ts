// 217·218번 양모 빗질 기계의 롤러 구동 전용 키트 — 하트 홈 캠 + 스터드 지레 + 걸쇠 + 홈 8개 바퀴 + 롤러
// 설계표 docs/mm507-sheets/217.md(정답지)·218.md. 두 번호가 machine217()·state217() 을 함께 쓴다.
import * as THREE from 'three';
import { brass, darkSteel, paint, steel } from '../../models/materials';
import { annularSector, circlePath, extrude, lathe, mesh, pathFrom, shapeFrom, tubeProfile, type V2 } from '../../models/parts/geom';
import { rotArrow } from './misc';
import { shaftZ } from './shaft';

const D2R = Math.PI / 180;

/** 217·218 공용 상수(세계 좌표) */
export const K217 = {
  H: [-0.45, 2.3] as V2, // 롤러 축
  K: [0.284, 1.816] as V2, // 캠 축
  L: 0.685, // 지레 A 팔
  RF: 0.55, // 홈 바퀴 반지름
  nNotch: 8,
  notchPhi0: 122.9, // 도
  notchPitch: 45,
  notchW: 0.09,
  notchDepth: 0.07,
  E: [0.1775, 0.6149] as V2, // 걸쇠 눈 핀(지레 로컬)
  TIP: [-0.2634, 0.4073] as V2, // 갈고리 끝(지레 로컬)
  N: [-0.0853, 0.6948] as V2, // 돌출부(지레 로컬, 0.70∠97°)
  KR: -8.029, // 걸쇠가 평평한 면에 얹힌 각(도)
  UX: 356.087, // 갈고리가 홈에서 빠지는 u
  camR: 1.38,
  colStop: 0x9ca3af,
  colBack: 0xef4444,
  colFwd: 0x22c55e,
  colYellow: 0xf2b619,
  colCatch: 0xd94a3a,
  colLug: 0xf59e0b,
  colCam: 0xece4d0,
  colFloor: 0x4b5563
} as const;
const K = K217;

// 홈 바깥 벽(캠 로컬, 반시계)
export const OUTER217: V2[] = [[0.016,1.29],[-0.0079,1.2867],[-0.115,1.264],[-0.2005,1.2383],[-0.283,1.2066],[-0.3594,1.1706],[-0.4322,1.1295],[-0.5029,1.0824],[-0.5691,1.0309],[-0.6303,0.9752],[-0.6864,0.916],[-0.7372,0.8536],[-0.7836,0.7866],[-0.8241,0.7173],[-0.8586,0.6461],[-0.8875,0.5718],[-0.9101,0.4965],[-0.9269,0.417],[-0.9368,0.3379],[-0.9397,0.2597],[-0.9359,0.1813],[-0.925,0.1035],[-0.9076,0.0286],[-0.8833,-0.0443],[-0.8524,-0.1142],[-0.814,-0.1822],[-0.7688,-0.2461],[-0.7207,-0.3022],[-0.6686,-0.3515],[-0.6113,-0.3953],[-0.5504,-0.432],[-0.487,-0.4609],[-0.4211,-0.4821],[-0.3626,-0.4937],[-0.3043,-0.4985],[-0.2466,-0.4966],[-0.1912,-0.4878],[-0.1171,-0.4638],[-0.0519,-0.427],[-0.0239,-0.4043],[0.0005,-0.3794],[0.021,-0.3524],[0.0368,-0.3242],[0.0878,-0.3385],[0.1397,-0.3473],[0.1936,-0.3507],[0.2474,-0.3486],[0.3011,-0.341],[0.3546,-0.328],[0.407,-0.3095],[0.4573,-0.2862],[0.516,-0.2512],[0.5705,-0.2098],[0.621,-0.1618],[0.6669,-0.1078],[0.707,-0.0491],[0.7415,0.0144],[0.7694,0.0812],[0.7911,0.1516],[0.808,0.2379],[0.8153,0.3274],[0.8128,0.4176],[0.8004,0.5087],[0.7784,0.5985],[0.7472,0.6859],[0.7068,0.7711],[0.6581,0.852],[0.6017,0.928],[0.5375,0.9994],[0.4657,1.0656],[0.3883,1.1247],[0.306,1.1765],[0.2183,1.2215],[0.1258,1.259],[0.0308,1.2882]];

// 섬(홈 안쪽 벽, 캠 로컬, 반시계)
export const ISLAND217: V2[] = [[0.0139,1.1788],[-0.0584,1.1646],[-0.13,1.1455],[-0.1993,1.1218],[-0.266,1.0938],[-0.3298,1.0617],[-0.3925,1.0245],[-0.4516,0.9836],[-0.5069,0.9393],[-0.5582,0.8919],[-0.6067,0.8401],[-0.6506,0.7857],[-0.6909,0.7275],[-0.7261,0.6674],[-0.7561,0.6059],[-0.7816,0.5417],[-0.8016,0.4769],[-0.8168,0.4083],[-0.8261,0.3402],[-0.8297,0.2713],[-0.8274,0.2041],[-0.8193,0.1373],[-0.8053,0.0715],[-0.7853,0.0076],[-0.7603,-0.0522],[-0.73,-0.1089],[-0.6947,-0.1618],[-0.6525,-0.214],[-0.6064,-0.2598],[-0.5578,-0.2985],[-0.5066,-0.3306],[-0.4526,-0.3562],[-0.3981,-0.3744],[-0.3341,-0.3864],[-0.2705,-0.3881],[-0.2103,-0.3794],[-0.1559,-0.3606],[-0.1156,-0.3373],[-0.0837,-0.3086],[-0.061,-0.2736],[-0.0522,-0.2333],[-0.046,-0.2201],[-0.0309,-0.2044],[-0.0108,-0.1958],[0.018,-0.1975],[0.0679,-0.2186],[0.117,-0.2322],[0.1603,-0.2389],[0.204,-0.2407],[0.2539,-0.2373],[0.3041,-0.2278],[0.353,-0.2126],[0.4011,-0.1915],[0.4502,-0.1629],[0.496,-0.1287],[0.5382,-0.0893],[0.5768,-0.0446],[0.6108,0.0043],[0.6403,0.0577],[0.6644,0.1142],[0.683,0.1729],[0.6983,0.248],[0.7052,0.3264],[0.7033,0.406],[0.6928,0.4856],[0.6738,0.5643],[0.6467,0.6411],[0.6112,0.7165],[0.5683,0.7884],[0.5185,0.856],[0.4614,0.9199],[0.3985,0.9783],[0.3307,1.0308],[0.2572,1.0777],[0.1799,1.118],[0.0982,1.152]];

// 캠 바퀴 돌기(캠 로컬, 14점)
export const LUG217: V2[] = [[1.0767,0.2219],[1.078,0.2419],[1.079,0.262],[1.0796,0.2822],[1.0798,0.3024],[1.0796,0.3228],[1.0791,0.3433],[1.1458,0.3645],[1.1467,0.3429],[1.1472,0.3213],[1.1473,0.2999],[1.147,0.2785],[1.1463,0.2572],[1.1453,0.2361]];

/** 돌기가 걸쇠 돌출부를 미는 구간 [uu, κ] 24쌍 */
export const KAPPA_PUSH217: [number, number][] = [
  [353.25, 0], [353.5, -0.804], [353.75, -1.604], [354.0, -2.389], [354.25, -3.16], [354.5, -3.926], [354.75, -4.687], [355.0, -5.434],
  [355.25, -6.167], [355.5, -6.886], [355.75, -7.592], [356.0, -8.285], [356.25, -8.958], [356.5, -9.61], [356.75, -10.25], [357.0, -10.856],
  [357.25, -11.443], [357.5, -11.992], [357.75, -12.509], [358.0, -12.983], [358.25, -13.4], [358.5, -13.743], [358.75, -13.985], [358.95, -14.047]
];

/** 지레 각 λ(u)(도, H 에서 본 스터드 A 방향) */
export function lambda217(u: number): number {
  if (u < 90) return -137 + (47 * u) / 90;
  if (u < 180) return -90 + (45 * (u - 90)) / 90;
  return -45 - (92 * (u - 180)) / 180;
}

/** 캠 로컬 홈 가운데선 p(u) */
export function groovePoint217(u: number): V2 {
  const lam = lambda217(u) * D2R;
  const ax = K.H[0] + K.L * Math.cos(lam) - K.K[0];
  const ay = K.H[1] + K.L * Math.sin(lam) - K.K[1];
  const psi = (90 - u) * D2R;
  const c = Math.cos(psi);
  const s = Math.sin(psi);
  return [ax * c + ay * s, -ax * s + ay * c];
}

const smooth = (x: number): number => x * x * (3 - 2 * x);

/** 걸쇠 각 κ(u)(도, 0 = 홈에 걸림, 음수 = 들림) */
export function kappa217(u: number): number {
  const uu = u >= 180 ? u : u + 360;
  if (uu < 353.25) return 0;
  if (uu < 358.95) {
    const T = KAPPA_PUSH217;
    for (let i = 1; i < T.length; i++) {
      if (uu <= T[i]![0]) {
        const a = T[i - 1]!;
        const b = T[i]!;
        return a[1] + ((b[1] - a[1]) * (uu - a[0])) / (b[0] - a[0]);
      }
    }
    return T[T.length - 1]![1];
  }
  if (uu < 382) {
    const x = (uu - 358.95) / 23.05;
    return K.KR + (-14.047 - K.KR) * (1 - x * x);
  }
  if (uu < 448) return K.KR;
  if (uu < 452) return K.KR * (1 - smooth((uu - 448) / 4));
  return 0;
}

export interface State217 {
  /** 주기 위치(도, 0~360) */
  u: number;
  n: number;
  /** 캠 각(도, 반시계 양수) */
  psi: number;
  /** 지레 각 λ(도) */
  lambda: number;
  /** 롤러 각(도, 반시계 양수) */
  Phi: number;
  /** 걸쇠 각(도) */
  kappa: number;
  phase: 'stop' | 'back' | 'fwd';
}

/** 결정적 동작 — t(초, 캠 45°/s) */
export function state217(t: number): State217 {
  const U = 270 + 45 * t;
  const n = Math.floor(U / 360);
  const u = U - 360 * n;
  const psi = 90 - U;
  const lambda = lambda217(u);
  let Delta: number;
  let phase: 'stop' | 'back' | 'fwd';
  if (u < 90) {
    Delta = 0;
    phase = 'stop';
  } else if (u < 180) {
    Delta = lambda + 90;
    phase = 'back';
  } else if (u < K.UX) {
    Delta = 45 + (lambda + 45);
    phase = 'fwd';
  } else {
    Delta = -45;
    phase = 'stop';
  }
  return { u, n, psi, lambda, Phi: -45 * n + Delta, kappa: kappa217(u), phase };
}

// ── 만들기 도우미 ──

function cylZ(r: number, len: number): THREE.CylinderGeometry {
  const g = new THREE.CylinderGeometry(r, r, len, 28);
  g.rotateX(Math.PI / 2);
  return g;
}

/** 원판 shape(구멍 선택) */
function disc(r: number, hole = 0, cx = 0, cy = 0): THREE.Shape {
  const s = new THREE.Shape();
  s.absarc(cx, cy, r, 0, Math.PI * 2, false);
  if (hole > 0) s.holes.push(circlePath(cx, cy, hole));
  return s;
}

/** 홈 8개가 든 바퀴 윤곽(바퀴 로컬, 반시계) */
export function wheelOutline217(): V2[] {
  const pts: V2[] = [];
  const hw = K.notchW / 2;
  const rb = K.RF - K.notchDepth;
  const rc = Math.sqrt(K.RF * K.RF - hw * hw);
  const half = Math.asin(hw / K.RF);
  const arcPts = (a0: number, a1: number): void => {
    const m = Math.max(2, Math.ceil(((a1 - a0) * 180) / Math.PI / 2));
    for (let i = 1; i < m; i++) {
      const a = a0 + ((a1 - a0) * i) / m;
      pts.push([K.RF * Math.cos(a), K.RF * Math.sin(a)]);
    }
  };
  for (let k = 0; k < K.nNotch; k++) {
    const phi = (K.notchPhi0 + K.notchPitch * k) * D2R;
    const d: V2 = [Math.cos(phi), Math.sin(phi)];
    const nn: V2 = [-Math.sin(phi), Math.cos(phi)];
    // 홈 시작 벽(시계 쪽): 바깥 → 바닥, 반대 벽: 바닥 → 바깥
    pts.push([d[0] * rc - nn[0] * hw, d[1] * rc - nn[1] * hw]);
    pts.push([d[0] * rb - nn[0] * hw, d[1] * rb - nn[1] * hw]);
    pts.push([d[0] * rb + nn[0] * hw, d[1] * rb + nn[1] * hw]);
    pts.push([d[0] * rc + nn[0] * hw, d[1] * rc + nn[1] * hw]);
    const a1 = phi + half;
    const a2 = (K.notchPhi0 + K.notchPitch * (k + 1)) * D2R - half;
    arcPts(a1, a2);
  }
  // 첫 점이 시계 쪽 벽이므로 마지막 호가 이어짐(닫힘)
  return pts;
}

/** 중심선 점열 + 반폭 → 둥근 끝의 띠 윤곽(꺾인 점은 마이터) */
function stripOutline(path: V2[], hw: number): V2[] {
  const n = path.length;
  const dir: V2[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = path[i + 1]![0] - path[i]![0];
    const dy = path[i + 1]![1] - path[i]![1];
    const l = Math.hypot(dx, dy);
    dir.push([dx / l, dy / l]);
  }
  const left: V2[] = [];
  const right: V2[] = [];
  for (let i = 0; i < n; i++) {
    const d0 = dir[Math.max(0, i - 1)]!;
    const d1 = dir[Math.min(n - 2, i)]!;
    let nx = -(d0[1] + d1[1]);
    let ny = d0[0] + d1[0];
    const l = Math.hypot(nx, ny);
    nx /= l;
    ny /= l;
    const cosHalf = nx * -d1[1] + ny * d1[0];
    const m = hw / Math.max(0.5, cosHalf);
    left.push([path[i]![0] + nx * m, path[i]![1] + ny * m]);
    right.push([path[i]![0] - nx * m, path[i]![1] - ny * m]);
  }
  const out: V2[] = [...left];
  const cap = (c: V2, d: V2): void => {
    const a0 = Math.atan2(d[0], -d[1]); // 왼쪽 법선 각
    for (let j = 1; j < 12; j++) {
      const a = a0 - (Math.PI * j) / 12;
      out.push([c[0] + hw * Math.cos(a), c[1] + hw * Math.sin(a)]);
    }
  };
  cap(path[n - 1]!, dir[n - 2]!);
  for (let i = n - 1; i >= 0; i--) out.push(right[i]!);
  cap(path[0]!, [-dir[0]![0], -dir[0]![1]]);
  return out;
}

function ribbon(u0: number, u1: number, mat: THREE.Material, dz = 0): THREE.Mesh {
  const us: number[] = [];
  const steps = Math.max(2, Math.ceil((u1 - u0) / 0.5));
  for (let i = 0; i <= steps; i++) us.push(u0 + ((u1 - u0) * i) / steps);
  const hw = 0.05;
  const zt = 0.043 + dz; // 띠마다 높이를 조금씩 달리해 꺾인 모서리에서 겹친 색이 깜빡이지 않게(2026-11-27 사용자 지적)
  const zb = 0.041 + dz;
  const pos: number[] = [];
  const idx: number[] = [];
  const P = us.map((u) => groovePoint217(u));
  for (let i = 0; i < P.length; i++) {
    const a = P[Math.max(0, i - 1)]!;
    const b = P[Math.min(P.length - 1, i + 1)]!;
    const tx = b[0] - a[0];
    const ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1;
    const nx = -ty / l;
    const ny = tx / l;
    const c = P[i]!;
    // 0 오른쪽 위, 1 왼쪽 위, 2 오른쪽 아래, 3 왼쪽 아래
    pos.push(c[0] - nx * hw, c[1] - ny * hw, zt, c[0] + nx * hw, c[1] + ny * hw, zt, c[0] - nx * hw, c[1] - ny * hw, zb, c[0] + nx * hw, c[1] + ny * hw, zb);
  }
  for (let i = 0; i < P.length - 1; i++) {
    const a = i * 4;
    const b = (i + 1) * 4;
    idx.push(a, b, b + 1, a, b + 1, a + 1); // 위(+z)
    idx.push(a + 2, a + 3, b + 3, a + 2, b + 3, b + 2); // 아래
    idx.push(a, a + 2, b + 2, a, b + 2, b); // 오른쪽 옆
    idx.push(a + 1, b + 1, b + 3, a + 1, b + 3, a + 3); // 왼쪽 옆
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.receiveShadow = true;
  return m;
}

export interface Machine217 {
  group: THREE.Group;
  apply(s: State217): void;
}

/** 기계 전체(캠·지레·걸쇠·홈 바퀴·롤러·받침). 이름표·시점은 모델이 붙인다 */
export function machine217(): Machine217 {
  const g = new THREE.Group();
  const [HX, HY] = K.H;
  const [KX, KY] = K.K;
  const [EX, EY] = K.E;

  // ── 캠 ──
  const cam = new THREE.Group();
  cam.name = 'cam';
  cam.position.set(KX, KY, 0);
  g.add(cam);

  const floor = mesh(extrude(disc(K.camR, 0.065), 0.06, 0), paint(K.colFloor));
  floor.name = 'camFloor';
  floor.position.z = 0.01;
  cam.add(floor);

  const rib = new THREE.Group();
  rib.name = 'grooveRibbon';
  const gray = paint(K.colStop);
  const red = paint(K.colBack);
  const green = paint(K.colFwd);
  rib.add(ribbon(0, 90, gray, 0), ribbon(90, 180, red, 0.0008), ribbon(180, K.UX, green, 0.0016), ribbon(K.UX, 360, gray, 0.0004));
  cam.add(rib);

  const landShape = disc(K.camR);
  landShape.holes.push(pathFrom(OUTER217));
  const land = mesh(extrude(landShape, 0.04, 0), paint(K.colCam));
  land.name = 'camLand';
  land.position.z = 0.06;
  cam.add(land);

  const islShape = shapeFrom(ISLAND217);
  islShape.holes.push(circlePath(0, 0, 0.065));
  const island = mesh(extrude(islShape, 0.04, 0), paint(K.colCam));
  island.name = 'camIsland';
  island.position.z = 0.06;
  cam.add(island);

  const hubGeo = lathe(tubeProfile(0.065, 0.12, 0.08, 0.11, 0.005), 40);
  hubGeo.rotateX(Math.PI / 2);
  cam.add(mesh(hubGeo, darkSteel()));

  const lug = mesh(extrude(shapeFrom(LUG217), 0.05, 0.004), paint(K.colLug));
  lug.name = 'lug';
  lug.position.z = 0.105;
  lug.userData.outline = LUG217;
  cam.add(lug);

  const marks: [string, V2][] = [
    ['markE', [0.0168, 1.235]],
    ['markC', [-0.734, -0.201]],
    ['markD', [0.0004, -0.2496]],
    ['markB', [0.746, 0.2009]]
  ];
  for (const [nm, p] of marks) {
    const m = mesh(new THREE.CircleGeometry(0.03, 20), paint(0xffffff));
    m.name = nm;
    m.position.set(p[0], p[1], 0.044);
    m.castShadow = false;
    cam.add(m);
  }

  const camShaft = shaftZ(KX, KY, 0.12, 0.06);
  camShaft.name = 'camShaft';
  g.add(camShaft);

  // ── 홈 바퀴 F ──
  const wheel = new THREE.Group();
  wheel.name = 'wheelF';
  wheel.position.set(HX, HY, 0.17);
  const wOut = wheelOutline217();
  const wShape = shapeFrom(wOut);
  wShape.holes.push(circlePath(0, 0, 0.045));
  wheel.add(mesh(extrude(wShape, 0.06, 0.003), brass()));
  const band = mesh(new THREE.BoxGeometry(0.3, 0.03, 0.006), paint(K.colYellow));
  band.position.set(0.15, 0, 0.033);
  wheel.add(band);
  const flat = new THREE.Object3D();
  flat.name = 'markFlat';
  flat.position.set(K.RF * Math.cos(145.4 * D2R), K.RF * Math.sin(145.4 * D2R), 0);
  wheel.add(flat);
  wheel.userData.outline = wOut;
  g.add(wheel);

  // ── 롤러 축·롤러 ──
  const rShaft = mesh(cylZ(0.045, 0.5), steel());
  rShaft.name = 'rollerShaft';
  rShaft.position.set(HX, HY, 0.39);
  g.add(rShaft);

  const roller = new THREE.Group();
  roller.name = 'roller';
  roller.position.set(HX, HY, 0.41);
  roller.add(mesh(cylZ(0.14, 0.22), paint(0xf5e9d0)));
  const stripe = mesh(new THREE.BoxGeometry(0.03, 0.02, 0.22), paint(0xd8362f));
  stripe.position.set(0, 0.135, 0);
  roller.add(stripe);
  g.add(roller);

  const matStop = paint(K.colStop);
  const matBack = paint(K.colBack);
  const matFwd = paint(K.colFwd);
  const lamp = mesh(cylZ(0.14, 0.01), matStop);
  lamp.name = 'rollerLamp';
  lamp.position.set(HX, HY, 0.525);
  g.add(lamp);

  // ── H 받침(고정) ──
  const br = new THREE.Group();
  br.name = 'hBracket';
  const col = mesh(new THREE.BoxGeometry(0.1, 0.1, 0.92), darkSteel());
  col.position.set(-1.55, HY, 0.16);
  const arm = mesh(new THREE.BoxGeometry(1.01, 0.08, 0.06), darkSteel());
  arm.position.set(-1.045, HY, 0.59);
  const ringGeo = lathe(tubeProfile(0.046, 0.09, 0.55, 0.63, 0.006), 32);
  ringGeo.rotateX(Math.PI / 2);
  const ring = mesh(ringGeo, darkSteel());
  ring.position.set(HX, HY, 0);
  br.add(col, arm, ring);
  g.add(br);

  // ── 지레(H 에 헐겁게) ──
  const lever = new THREE.Group();
  lever.name = 'lever';
  lever.position.set(HX, HY, 0);
  g.add(lever);
  const centre: V2[] = [[0, -K.L], [-0.07, -0.36], [0, 0], [0.085, 0.31], [EX, EY]];
  const strip = shapeFrom(stripOutline(centre, 0.0375));
  strip.holes.push(circlePath(0, 0, 0.05), circlePath(EX, EY, 0.025));
  const stripM = mesh(extrude(strip, 0.04, 0.003), darkSteel());
  stripM.position.z = 0.24;
  lever.add(stripM);
  const hubM = mesh(extrude(disc(0.1, 0.05), 0.04, 0.003), darkSteel());
  hubM.position.z = 0.24;
  const eyeLow = mesh(extrude(disc(0.065, 0, 0, -K.L), 0.04, 0.003), darkSteel());
  eyeLow.position.z = 0.24;
  const eyeUp = mesh(extrude(disc(0.06, 0.025, EX, EY), 0.04, 0.003), darkSteel());
  eyeUp.position.z = 0.24;
  lever.add(hubM, eyeLow, eyeUp);

  const stud = mesh(cylZ(0.045, 0.215), steel());
  stud.name = 'studA';
  stud.position.set(0, -K.L, 0.1525);
  const studHead = mesh(cylZ(0.05, 0.02), paint(K.colYellow));
  studHead.position.z = 0.27 - 0.1525;
  stud.add(studHead);
  lever.add(stud);

  const pinE = mesh(cylZ(0.025, 0.13), steel());
  pinE.name = 'pinE';
  pinE.position.set(EX, EY, 0.205);
  lever.add(pinE);

  // ── 걸쇠 G(눈 핀 E 둘레) ──
  const catchG = new THREE.Group();
  catchG.name = 'catchG';
  catchG.position.set(EX, EY, 0);
  lever.add(catchG);
  const catchMat = paint(K.colCatch);
  const onH = (geo: THREE.BufferGeometry): THREE.Mesh => {
    const m = mesh(geo, catchMat);
    m.position.set(-EX, -EY, 0.17); // H 중심 도형을 E 기준 로컬로
    return m;
  };
  const armM = onH(extrude(annularSector(0.585, 0.665, 73.9 * D2R, 127 * D2R), 0.06, 0.003));
  catchG.add(armM);
  const eyeBoss = mesh(extrude(disc(0.055, 0.025), 0.06, 0.003), catchMat);
  eyeBoss.position.z = 0.17;
  catchG.add(eyeBoss);

  const ph = K.notchPhi0 * D2R;
  const hd: V2 = [Math.cos(ph), Math.sin(ph)];
  const hn: V2 = [-Math.sin(ph), Math.cos(ph)];
  const hook: V2[] = [
    [hd[0] * 0.485 - hn[0] * 0.035, hd[1] * 0.485 - hn[1] * 0.035],
    [hd[0] * 0.6 - hn[0] * 0.035, hd[1] * 0.6 - hn[1] * 0.035],
    [hd[0] * 0.6 + hn[0] * 0.035, hd[1] * 0.6 + hn[1] * 0.035],
    [hd[0] * 0.485 + hn[0] * 0.035, hd[1] * 0.485 + hn[1] * 0.035]
  ];
  const hookM = onH(extrude(shapeFrom(hook), 0.06, 0.002));
  hookM.name = 'hookG';
  hookM.userData.outline = hook;
  catchG.add(hookM);

  const NX = K.N[0];
  const NY = K.N[1];
  const nBoss = onH(extrude(disc(0.045, 0, NX, NY), 0.06, 0.003));
  catchG.add(nBoss);
  const knob = mesh(cylZ(0.03, 0.105), paint(K.colCatch));
  knob.name = 'knobG';
  knob.position.set(NX - EX, NY - EY, 0.1475);
  const knobHead = mesh(cylZ(0.04, 0.015), paint(K.colYellow));
  knobHead.position.z = 0.2075 - 0.1475;
  knob.add(knobHead);
  catchG.add(knob);

  // ── 화살표 ──
  const camArrow = rotArrow(0.3, false);
  camArrow.position.set(KX, KY, 0.3);
  const arrBack = rotArrow(0.22, true);
  const arrFwd = rotArrow(0.22, false);
  for (const a of [arrBack, arrFwd]) a.position.set(HX, HY, 0.66);
  g.add(camArrow, arrBack, arrFwd);

  const apply = (s: State217): void => {
    cam.rotation.z = s.psi * D2R;
    camShaft.rotation.z = s.psi * D2R;
    lever.rotation.z = (s.lambda + 90) * D2R;
    const phi = s.Phi * D2R;
    wheel.rotation.z = phi;
    rShaft.rotation.z = phi;
    roller.rotation.z = phi;
    catchG.rotation.z = s.kappa * D2R;
    lamp.material = s.phase === 'back' ? matBack : s.phase === 'fwd' ? matFwd : matStop;
    arrBack.visible = s.phase === 'back';
    arrFwd.visible = s.phase === 'fwd';
  };
  apply(state217(0));
  return { group: g, apply };
}
