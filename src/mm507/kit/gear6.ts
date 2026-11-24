// 507 부품 키트 6 — 046~050 (퓨지 체인과 태엽통 · 마찰 클러치 · 톱니 클러치 · 래칫 베벨 · 유니버설 조인트)
// 이 파일의 조립체(fuseeSystem·frictionClutchAssembly·dogClutchAssembly·ratchetBevelDrive·universalJointPair)는
// 부품과 운동식을 모두 안에 담고 있고, 모델 파일은 set(theta)만 부른다. 설계표: docs/mm507-sheets/046~050.md
import * as THREE from 'three';
import { brass, bronze, castIron, darkSteel, paint, steel } from '../../models/materials';
import {
  annularSector,
  circlePath,
  creased,
  extrude,
  lathe,
  merge,
  mesh,
  rodProfile,
  shapeFrom,
  tubeProfile,
  TAU
} from '../../models/parts/geom';
import { STAGE } from './stand';
import { bevelGear, meshAngle, spurGear } from './gear';
import { setMM } from './mm';

// ───────────────────────── 공용 도우미 ─────────────────────────

const OM = 1.6; // 기본 각속도 OMEGA (types.ts 와 같은 값)
const V3 = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const clamp = (x: number, a: number, b: number): number => Math.min(b, Math.max(a, x));
const mod = (a: number, n: number): number => ((a % n) + n) % n;
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
/** 3차 smoothstep 0→1 */
const sm = (u: number): number => {
  const c = clamp(u, 0, 1);
  return c * c * (3 - 2 * c);
};
/** smoothstep 의 적분 u³ − u⁴/2 */
const smInt = (u: number): number => {
  const c = clamp(u, 0, 1);
  return c * c * c - (c * c * c * c) / 2;
};
const at = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh => {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
};
const MARK = (): THREE.MeshPhysicalMaterial => paint(0xf2b619);

/** 로컬 Z 로 뻗은 원기둥(z0~z1) */
function rodZ(r: number, z0: number, z1: number, c = 0.004): THREE.BufferGeometry {
  const g = lathe(rodProfile(r, z0, z1, c, c), 28);
  g.rotateX(Math.PI / 2);
  return g;
}
/** 로컬 Z 로 뻗은 관(z0~z1) */
function tubeZ(rIn: number, rOut: number, z0: number, z1: number, c = 0.006, segs = 40): THREE.BufferGeometry {
  const g = lathe(tubeProfile(rIn, rOut, z0, z1, c), segs);
  g.rotateX(Math.PI / 2);
  return g;
}
/** 로컬 X 로 뻗은 원기둥(x0~x1) */
function rodX(r: number, x0: number, x1: number, c = 0.004): THREE.BufferGeometry {
  const g = lathe(rodProfile(r, x0, x1, c, c), 28);
  g.rotateZ(-Math.PI / 2);
  return g;
}

/** +Z 를 dir 로 보내는 회전 */
export function quatZTo(dir: THREE.Vector3): THREE.Quaternion {
  return new THREE.Quaternion().setFromUnitVectors(V3(0, 0, 1), dir.clone().normalize());
}

/** 두 점을 잇는 가는 막대(길이를 매 프레임 바꿔도 되는 단위 막대 + aim) */
function unitRod(r: number, mat: THREE.Material): THREE.Mesh {
  const g = lathe(rodProfile(r, 0, 1, 0.004, 0.004), 16);
  return mesh(g, mat);
}
function aimRod(m: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3): void {
  const d = b.clone().sub(a);
  const L = d.length();
  m.position.copy(a);
  m.quaternion.setFromUnitVectors(V3(0, 1, 0), d.multiplyScalar(1 / Math.max(L, 1e-9)));
  m.scale.set(1, L, 1);
}

// ───────────────────────── 받침 ─────────────────────────

/**
 * 뒤판 벽걸이 축받이: 뒤판(z = STAGE.backZ)에서 팔이 나와 (x, y, zc) 의 축을 감싸는 보스 링을 받친다.
 * axis: 'x' | 'y' | 방향 벡터(XY 평면 안). bore = 보스 구멍 반지름(축 반지름보다 0.005~0.01 크게)
 */
export function wallBearing(x: number, y: number, zc: number, axis: 'x' | 'y' | THREE.Vector3, bore = 0.058): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, 0);
  const body = castIron();
  const back = STAGE.backZ;
  const ro = bore + 0.05;
  const dir = axis === 'x' ? V3(1, 0, 0) : axis === 'y' ? V3(0, 1, 0) : axis.clone().normalize();
  // 벽판
  g.add(at(new THREE.BoxGeometry(0.22, 0.22, 0.035), body, 0, 0, back + 0.0175));
  // 팔: 벽에서 보스 아래까지
  g.add(at(new THREE.BoxGeometry(0.12, 0.17, zc - ro * 0.75 - back), body, 0, 0, back + (zc - ro * 0.75 - back) / 2));
  // 보스 링(회전체 Y축 → dir 로)
  const ring = lathe(tubeProfile(bore, ro, -0.07, 0.07, 0.01), 36);
  const rm = mesh(ring, darkSteel());
  rm.position.set(0, 0, zc);
  rm.quaternion.setFromUnitVectors(V3(0, 1, 0), dir);
  g.add(rm);
  // 볼트 머리
  for (const sx of [-1, 1]) g.add(at(rodZ(0.016, back, back + 0.05, 0.003), darkSteel(), sx * 0.085, 0.085, 0));
  return g;
}

/** 받침 위에 서는 축받이 기둥(X 방향 축). 바닥 y = floorY, 축 중심 (x, yAxis, zc). flare = ±1(밑이 퍼지는 쪽) */
export function pedestalX(x: number, yAxis: number, zc: number, flare: 1 | -1, floorY = 0.18, bore = 0.058): THREE.Group {
  const g = new THREE.Group();
  const body = castIron();
  const top = yAxis + 0.1;
  const H = top - floorY;
  // 기둥(얇은 판): x 두께 0.07, z 폭 0.30
  g.add(at(new THREE.BoxGeometry(0.07, H, 0.3), body, x, floorY + H / 2, zc));
  // 퍼지는 밑 — (x,y) 단면의 곡선 삼각형을 z 로 압출
  const pts: [number, number][] = [[0.035 * flare, 0]];
  const n = 10;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([0.035 * flare + flare * 0.2 * (1 - t) ** 2, H * 0.4 * t * t]);
  }
  pts.push([0.035 * flare, H * 0.4]);
  const foot = extrude(shapeFrom(pts.map(([a, b]) => [a, b] as [number, number])), 0.22, 0.004);
  g.add(at(foot, body, x, floorY, zc));
  // 보스 링
  const ring = lathe(tubeProfile(bore, bore + 0.05, -0.07, 0.07, 0.01), 36);
  ring.rotateZ(Math.PI / 2);
  g.add(at(ring, darkSteel(), x, yAxis, zc));
  return g;
}

/** 뒤판에서 나온 짧은 기둥 + 앞쪽 핀(Z 방향) — 받침점용. 핀 끝 z = zc + 0.06 */
export function wallPost(x: number, y: number, zc: number): THREE.Group {
  const g = new THREE.Group();
  const back = STAGE.backZ;
  g.add(at(new THREE.BoxGeometry(0.14, 0.14, zc - 0.03 - back), castIron(), x, y, back + (zc - 0.03 - back) / 2));
  g.add(at(rodZ(0.028, zc - 0.04, zc + 0.06, 0.004), steel(), x, y, 0));
  return g;
}

// ───────────────────────── 레버(꺾쇠) ─────────────────────────

/** 꺾인 레버: 원점 = 받침점, 팔은 +Y, 손잡이는 +X(팔과 90°). aimBellCrank 로 팔 끝을 핀에 맞춘다 */
export function bellCrank(handleLen = 0.9): THREE.Group {
  const g = new THREE.Group();
  const arm = mesh(extrude(shapeFrom([[-0.03, -0.04], [0.03, -0.04], [0.03, 1], [-0.03, 1]]), 0.04, 0.005), steel());
  arm.name = 'arm';
  g.add(arm);
  // 손잡이(+X)
  g.add(at(extrude(shapeFrom([[-0.04, -0.03], [handleLen, -0.03], [handleLen, 0.03], [-0.04, 0.03]]), 0.04, 0.005), steel(), 0, 0, 0));
  // 받침 축 머리, 손잡이 끝 세로 손잡이
  g.add(at(rodZ(0.05, -0.035, 0.035, 0.008), darkSteel(), 0, 0, 0));
  g.add(at(lathe(rodProfile(0.022, 0, 0.18, 0.006, 0.008), 20), brass(), handleLen, -0.15, 0));
  g.add(at(new THREE.BoxGeometry(0.05, 0.014, 0.012), MARK(), handleLen * 0.5, 0.0, 0.025));
  return g;
}
/** 팔 끝(+Y 쪽)이 pin 을 향하게: 팔 길이는 늘이고 줄인다(핀이 팔 끝 슬롯에서 미끄러짐) */
export function aimBellCrank(g: THREE.Group, pivot: THREE.Vector3, pin: THREE.Vector3): number {
  const dx = pin.x - pivot.x;
  const dy = pin.y - pivot.y;
  const L = Math.hypot(dx, dy);
  g.position.copy(pivot);
  g.rotation.z = -Math.atan2(dx, dy);
  const arm = g.getObjectByName('arm');
  if (arm) arm.scale.y = L;
  return L;
}

// ───────────────────────── 046 퓨지 체인과 태엽통 ─────────────────────────

export interface FuseeOpts { xBarrel?: number; xFusee?: number; zc?: number }
export interface FuseeState {
  /** 퓨지가 풀린 각(0 = 감긴 상태 → psiMax = 다 풀림) */
  psi: number;
  /** 0~1 진행 */
  spent: number;
  /** 태엽이 체인을 당기는 힘(감긴 상태 = 1 → 다 풀림 = 0.6) */
  force: number;
  /** 체인이 퓨지에서 떠나는 곳의 반지름 */
  rExit: number;
  /** 힘 × 반지름 / 최소 반지름(= 1, 일정) */
  torque: number;
  alphaE: number;
  /** 태엽통의 누적 회전각(rotation.y) */
  barrelAngle: number;
  /** 태엽통에 감긴 체인의 바퀴 수 */
  barrelTurns: number;
}
export interface FuseeSystem {
  group: THREE.Group;
  barrel: THREE.Group;
  fusee: THREE.Group;
  psiMax: number;
  chainLength: number;
  /** psi = 퓨지가 풀린 각(rad). 0 ~ psiMax */
  set(psi: number): FuseeState;
}

/** 퓨지 축·태엽통 축 위쪽 끝 y — 이름표·받이 위치용 */
export const FUSEE_Y = { base: 1.05, barrelTop: 1.78, fuseeTop: 1.83 } as const;

export function fuseeSystem(o: FuseeOpts = {}): FuseeSystem {
  const xb = o.xBarrel ?? -0.85;
  const xf = o.xFusee ?? 0.85;
  const zc = o.zc ?? 0.3;
  const D = xf - xb;
  const rB = 0.413; // 태엽통 위 체인 중심 반지름
  const pF = 0.14; // 퓨지 나선 피치(한 바퀴 오르는 높이)
  const pB = 0.15; // 태엽통 체인 줄 간격
  const yFb = FUSEE_Y.base;
  const yF0 = 1.145; // 나선 시작(α=0) 높이
  const yh = 1.669; // 태엽통 고정 끝(훅) 높이
  const aMin = 0.4 * Math.PI; // 쓰는 구간(큰 쪽 끝)
  const aW = 7.6 * Math.PI; // 쓰는 구간(작은 쪽 끝) = 감긴 상태
  const aTot = 8 * Math.PI;
  const rMin = 0.245; // 감긴 상태에서 체인이 걸리는 반지름
  const kF = 0.4; // 태엽 힘이 다 풀리면 40% 줄어듦
  const dA = aW - aMin;
  const lMax = (rMin * dA) / (1 - kF / 2);
  const psiMax = dA;
  const gamma0 = Math.PI; // 감긴 상태에서 태엽통에 감긴 체인 각(반 바퀴)

  /** 체인 중심 반지름(힘 × 반지름 = 일정이 되게 정한 곡선 원뿔) */
  const rcOf = (a: number): number => {
    const al = clamp(a, aMin, aW);
    const q = rMin * (aW - al);
    const disc = Math.max(0, 1 - (2 * kF * q) / lMax);
    const l = (lMax / kF) * (1 - Math.sqrt(disc));
    return rMin / (1 - (kF * l) / lMax);
  };
  const yAt = (a: number): number => yF0 + (pF * a) / TAU;
  // 퓨지 나선 호장 표(α=0 부터)
  const NT = 1600;
  const dAt = aTot / NT;
  const cum = new Float32Array(NT + 1);
  for (let i = 1; i <= NT; i++) {
    const r0 = rcOf((i - 1) * dAt);
    const r1 = rcOf(i * dAt);
    cum[i] = cum[i - 1]! + Math.hypot(((r0 + r1) / 2) * dAt, r1 - r0, (pF * dAt) / TAU);
  }
  const lenF = (a: number): number => {
    const t = clamp(a, 0, aTot) / dAt;
    const i = Math.min(NT - 1, Math.floor(t));
    return cum[i]! + (cum[i + 1]! - cum[i]!) * (t - i);
  };
  const sB = Math.hypot(rB, pB / TAU);
  const tangent = (rF: number): { nx: number; nz: number; a: number } => {
    const nx = (rB - rF) / D;
    const nz = Math.sqrt(1 - nx * nx);
    return { nx, nz, a: Math.atan2(-nz, nx) };
  };
  const spanLen = (rF: number, nx: number, nz: number, yF: number, yB: number): number =>
    Math.hypot(D + (rF - rB) * nx, (rF - rB) * nz, yF - yB);
  const t0 = tangent(rcOf(aW));
  const aT0 = t0.a;
  const aAnchor = aT0 + aW;
  const aH = aT0 - gamma0;
  const L =
    lenF(aW) + spanLen(rcOf(aW), t0.nx, t0.nz, yAt(aW), yh - (pB * gamma0) / TAU) + sB * gamma0;

  const group = new THREE.Group();

  // ── 퓨지(원뿔 도르래) ──
  const fusee = new THREE.Group();
  fusee.position.set(xf, 0, zc);
  fusee.name = 'fusee';
  setMM(fusee, { kind: 'part', axis: 'y' });
  {
    // 판화: 아래가 넓고 위로 갈수록 좁아지는 계단 원뿔(4단). 계단은 나선으로 오르는 턱(ledge)이고
    // 체인은 턱 위에 얹혀 위 단의 벽에 기대어 감긴다(판화에서 체인이 맨 아래 단 위·둘째 단 둘레에 걸린 모습).
    const yTop = FUSEE_Y.fuseeTop;
    const rW = 0.011; // 체인 중심 → 벽(체인 두께의 반 0.009 + 틈)
    const hW = 0.027; // 체인 중심 → 턱(체인 높이의 반 0.025 + 틈)
    const drop = 0.02; // 턱은 바깥으로 0.02 낮아진다(떠나는 가닥이 오르는 턱에 닿지 않게)
    const rCore = 0.19;
    const yFl = yFb + 0.07; // 밑 테 윗면
    fusee.add(mesh(lathe([[0, yFb], [0.45, yFb], [0.46, yFb + 0.012], [0.46, yFl - 0.01], [0.45, yFl], [0, yFl]], 56), brass()));
    fusee.add(mesh(lathe([[0, yFl - 0.01], [rCore, yFl - 0.01], [rCore, yTop - 0.012], [rCore - 0.012, yTop], [0, yTop]], 40), brass()));
    const stepMat = brass();
    stepMat.side = THREE.DoubleSide;
    const vs: number[] = [];
    const pt = (a: number, r: number, y: number): THREE.Vector3 => {
      const ang = aAnchor - a;
      return V3(r * Math.cos(ang), y, -r * Math.sin(ang));
    };
    const quad = (p: THREE.Vector3, q: THREE.Vector3, r: THREE.Vector3, t: THREE.Vector3): void => {
      vs.push(p.x, p.y, p.z, q.x, q.y, q.z, r.x, r.y, r.z, p.x, p.y, p.z, r.x, r.y, r.z, t.x, t.y, t.z);
    };
    const NS = 288;
    const sec = (a: number): THREE.Vector3[] => {
      const yL = yAt(a) - hW;
      const rIn = rcOf(a) - rW;
      const rLo = rcOf(a - TAU) - rW;
      return [pt(a, rLo, Math.min(yL - drop, yFl)), pt(a, rLo, yL - drop), pt(a, rIn, yL), pt(a, rIn, yL + pF - drop), pt(a, rCore, yL + pF - drop)];
    };
    let prev = sec(0);
    for (let i = 1; i <= NS; i++) {
      const a = (aTot * i) / NS;
      const cur = sec(a);
      if (a <= TAU + 1e-6) quad(prev[0]!, cur[0]!, cur[1]!, prev[1]!); // 첫 단 아래 몸통 벽
      quad(prev[1]!, cur[1]!, cur[2]!, prev[2]!); // 턱(체인이 얹히는 면)
      quad(prev[2]!, cur[2]!, cur[3]!, prev[3]!); // 벽(체인이 기대는 면)
      if (a > aTot - TAU + 1e-6) quad(prev[3]!, cur[3]!, cur[4]!, prev[4]!); // 맨 윗단의 윗면
      prev = cur;
    }
    {
      // 나선이 끝나는 곳(맨 위)의 마구리 벽
      const yL = yAt(aTot) - hW;
      const rIn = rcOf(aTot) - rW;
      quad(pt(aTot, rCore, yL - drop), pt(aTot, rIn, yL - drop), pt(aTot, rIn, yL + pF - drop), pt(aTot, rCore, yL + pF - drop));
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(vs, 3));
    sg.computeVertexNormals();
    const steps = mesh(creased(sg, 40), stepMat);
    steps.name = 'fuseeSteps';
    fusee.add(steps);
    fusee.add(at(lathe(rodProfile(0.045, 0, 0.24, 0.006, 0.008), 24), steel(), 0, yTop - 0.01, 0));
    fusee.add(at(new THREE.BoxGeometry(0.07, 0.07, 0.07), darkSteel(), 0, yTop + 0.26, 0)); // 감는 열쇠 자리(네모 끝)
    fusee.add(at(lathe(rodProfile(0.045, 0, 0.22, 0.006, 0.006), 24), steel(), 0, yFb - 0.2, 0));
    fusee.add(at(new THREE.BoxGeometry(0.05, 0.014, 0.04), MARK(), 0.43, yFl + 0.004, 0));
  }
  // ── 태엽통 ──
  const barrel = new THREE.Group();
  barrel.position.set(xb, 0, zc);
  barrel.name = 'barrel';
  setMM(barrel, { kind: 'part', axis: 'y' });
  {
    const yT = FUSEE_Y.barrelTop;
    const prof: [number, number][] = [
      [0, yFb], [0.44, yFb], [0.44, yFb + 0.04], [0.4, yFb + 0.04], [0.4, yT - 0.04], [0.44, yT - 0.04], [0.44, yT],
      [0.39, yT], [0.39, yT + 0.006], [0.37, yT + 0.006], [0.37, yT],
      [0.31, yT], [0.31, yT + 0.006], [0.29, yT + 0.006], [0.29, yT],
      [0.22, yT], [0.22, yT + 0.006], [0.2, yT + 0.006], [0.2, yT], [0, yT]
    ];
    barrel.add(mesh(lathe(prof, 56), bronze()));
    barrel.add(at(lathe(rodProfile(0.045, 0, 0.3, 0.006, 0.008), 24), steel(), 0, yT - 0.01, 0));
    barrel.add(at(lathe(rodProfile(0.045, 0, 0.22, 0.006, 0.006), 24), steel(), 0, yFb - 0.2, 0));
    barrel.add(at(new THREE.BoxGeometry(0.06, 0.014, 0.04), MARK(), 0.415, yT + 0.008, 0));
  }
  group.add(fusee, barrel);

  // ── 체인: 사슬 한 코 = 작은 판(길이 0.044, 축 방향 0.05/0.036 번갈아, 두께 0.018) ──
  const LS = 0.05;
  const N = Math.floor(L / LS);
  const links = new THREE.InstancedMesh(new THREE.BoxGeometry(0.044, 0.05, 0.018), steel(), N);
  links.castShadow = true;
  links.frustumCulled = false;
  links.name = 'chain';
  group.add(links);
  const CAP = 900;
  const P = new Float32Array(CAP * 3);
  const S = new Float32Array(CAP);
  const mtx = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const ex = new THREE.Vector3();
  const ey = new THREE.Vector3();
  const ez = new THREE.Vector3();
  const UP = V3(0, 1, 0);

  function set(psiIn: number): FuseeState {
    const psi = clamp(psiIn, 0, psiMax);
    const bF = -psi;
    let aT = aT0;
    let gE = gamma0;
    let aE = aW;
    let rF = rcOf(aW);
    let tg = t0;
    for (let it = 0; it < 6; it++) {
      aE = aW + bF - (aT - aT0);
      rF = rcOf(aE);
      tg = tangent(rF);
      aT = tg.a;
      gE = (L - lenF(aE) - spanLen(rF, tg.nx, tg.nz, yAt(aE), yh - (pB * gE) / TAU)) / sB;
    }
    const bB = aT - aT0 + gamma0 - gE;
    fusee.rotation.y = bF;
    barrel.rotation.y = bB;
    // 체인 중심선 점열: 퓨지 감긴 부분 → 자유 가닥 → 태엽통 감긴 부분
    let n = 0;
    const push = (x: number, y: number, z: number): void => {
      P[n * 3] = x;
      P[n * 3 + 1] = y;
      P[n * 3 + 2] = z;
      n++;
    };
    const stF = Math.max(2, Math.ceil(aE / 0.09));
    for (let k = 0; k <= stF; k++) {
      const a = (aE * k) / stF;
      const ang = aAnchor - a + bF;
      const r = rcOf(a);
      push(xf + r * Math.cos(ang), yAt(a), zc - r * Math.sin(ang));
    }
    const stB = Math.max(2, Math.ceil(gE / 0.09));
    for (let k = 0; k <= stB; k++) {
      const gm = gE * (1 - k / stB);
      const ang = aH + gm + bB;
      push(xb + rB * Math.cos(ang), yh - (pB * gm) / TAU, zc - rB * Math.sin(ang));
    }
    S[0] = 0;
    for (let i = 1; i < n; i++) {
      S[i] = S[i - 1]! + Math.hypot(P[i * 3]! - P[(i - 1) * 3]!, P[i * 3 + 1]! - P[(i - 1) * 3 + 1]!, P[i * 3 + 2]! - P[(i - 1) * 3 + 2]!);
    }
    let j = 0;
    for (let i = 0; i < N; i++) {
      const s = (i + 0.5) * LS;
      while (j < n - 2 && S[j + 1]! < s) j++;
      const u = clamp((s - S[j]!) / Math.max(1e-9, S[j + 1]! - S[j]!), 0, 1);
      pos.set(
        lerp(P[j * 3]!, P[(j + 1) * 3]!, u),
        lerp(P[j * 3 + 1]!, P[(j + 1) * 3 + 1]!, u),
        lerp(P[j * 3 + 2]!, P[(j + 1) * 3 + 2]!, u)
      );
      ex.set(P[(j + 1) * 3]! - P[j * 3]!, P[(j + 1) * 3 + 1]! - P[j * 3 + 1]!, P[(j + 1) * 3 + 2]! - P[j * 3 + 2]!).normalize();
      ey.copy(UP).addScaledVector(ex, -UP.dot(ex)).normalize();
      ez.crossVectors(ex, ey);
      mtx.makeBasis(ex, ey, ez);
      quat.setFromRotationMatrix(mtx);
      sc.set(1, i % 2 === 0 ? 1 : 0.72, 1);
      mtx.compose(pos, quat, sc);
      links.setMatrixAt(i, mtx);
    }
    links.instanceMatrix.needsUpdate = true;
    const spent = (lenF(aW) - lenF(aE)) / (lenF(aW) - lenF(aMin));
    const force = 1 - kF * clamp(spent, 0, 1);
    return {
      psi,
      spent,
      force,
      rExit: rF,
      torque: (force * rF) / rMin,
      alphaE: aE,
      barrelAngle: bB,
      barrelTurns: gE / TAU
    };
  }
  set(0);
  return { group, barrel, fusee, psiMax, chainLength: L, set };
}

// ───────────────────────── 클러치 반쪽(턱) ─────────────────────────

export interface JawHalfOpts {
  rIn?: number;
  rOut?: number;
  /** 턱 높이(축 방향) */
  height?: number;
  /** 뿌리 뒤로 뻗는 슬리브 길이 */
  sleeve?: number;
  /** 첫 턱 중심의 로컬 각 */
  phase?: number;
  /** 턱 각폭 = widthFrac × 피치각(운동식은 0.4 로 계산, 그림은 0.38 로 조금 얇게) */
  widthFrac?: number;
  driver?: boolean;
  bore?: number;
}
/** 클러치 반쪽: 로컬 Z = 축, 턱이 +Z 쪽(z 0~height), 슬리브는 −Z 쪽. 턱 중심 각 = phase + k·피치각 */
export function jawClutchHalf(teeth: number, o: JawHalfOpts = {}): THREE.Group {
  const rOut = o.rOut ?? 0.2;
  const rIn = o.rIn ?? 0.115;
  const h = o.height ?? 0.12;
  const sl = o.sleeve ?? 0.5;
  const bore = o.bore ?? 0.088;
  const p = TAU / teeth;
  const w = (o.widthFrac ?? 0.38) * p;
  const ph = o.phase ?? 0;
  const body = o.driver === true ? bronze() : brass();
  const g = new THREE.Group();
  g.add(mesh(tubeZ(bore, rOut, -sl, 0, 0.008), body));
  const geos: THREE.BufferGeometry[] = [];
  for (let k = 0; k < teeth; k++) {
    const jg = extrude(annularSector(rIn, rOut, -w / 2, w / 2), h, 0.004);
    jg.translate(0, 0, h / 2);
    jg.rotateZ(ph + k * p);
    geos.push(jg);
  }
  g.add(mesh(merge(geos), body));
  g.add(at(new THREE.BoxGeometry(0.05, 0.016, 0.03), MARK(), rOut - 0.02, 0, -sl * 0.35));
  g.userData.jaw = { teeth, height: h, pitch: p, widthFrac: 0.4 };
  return g;
}

/** 클러치에서 쓰는 이동 포크(고리 아랫반) + 아래로 내린 귀: 원점 = 축 중심, YZ 평면의 반고리 */
function shiftFork(): THREE.Group {
  const g = new THREE.Group();
  const geo = extrude(annularSector(0.185, 0.235, Math.PI, TAU), 0.04, 0.004);
  geo.rotateY(Math.PI / 2);
  g.add(mesh(geo, steel()));
  g.add(at(new THREE.BoxGeometry(0.04, 0.09, 0.07), steel(), 0, -0.26, 0));
  g.add(at(rodZ(0.022, -0.05, 0.05, 0.004), darkSteel(), 0, -0.3, 0));
  return g;
}

// 공통 X 축 조립체 좌표
const AX_Y = 1.7;
const AX_Z = 0.28;
const SHAFT_R = 0.07;

/** 가는 X 축 + 위쪽 깃(키) + 끝 표시 */
function keyedShaft(x0: number, x1: number, keyX0: number, keyX1: number, markX: number): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(rodX(SHAFT_R, x0, x1, 0.01), steel()));
  g.add(at(new THREE.BoxGeometry(keyX1 - keyX0, 0.026, 0.03), darkSteel(), (keyX0 + keyX1) / 2, SHAFT_R + 0.009, 0));
  g.add(at(new THREE.BoxGeometry(0.12, 0.012, 0.045), MARK(), markX, SHAFT_R + 0.002, 0));
  return g;
}

// ───────────────────────── 047 마찰 클러치 ─────────────────────────

export const FRICTION_PERIOD = 8; // 한 주기(초, speed 1)
export interface FrictionState {
  /** 축(원판)의 누적 회전각 — 시간이 지나도 계속 늘어난다 */
  phiS: number;
  /** 축 속도 / 상자 속도 (0~1) */
  ratio: number;
  /** 원판의 고리 테가 상자 홈에서 물러난 거리(0 = 홈에 꽉 박힘, 0.12 = 완전히 뗌 — 테 끝은 홈 안에 남는다) */
  gap: number;
  /** 눌리는 힘 (0~1) */
  press: number;
  /** 0 쉼 · 1 접근 · 2 미끄러짐 · 3 붙음 · 4 떼는 중(타성 감속) · 5 쉼(타성 끝) */
  phase: number;
}
const FR_G = 0.12;
/** 상자 각 theta(= OM·시간) → 축 각·틈·눌림. 시간표(초): 0~1 쉼, 1~1.8 접근, 1.8~3.0 미끄러짐(속도비 0→1), 3~6 붙음, 6~6.8 떼기(틈 0→0.12), 6~7.2 타성 감속(1→0), 7.2~8 쉼. 한 주기에 축은 OM·4.2 rad 돈다 */
export function frictionClutchState(theta: number): FrictionState {
  const tau = theta / OM;
  const n = Math.floor(tau / FRICTION_PERIOD);
  const t = tau - n * FRICTION_PERIOD;
  let I: number;
  let ratio: number;
  let press = 0;
  let phase = 0;
  if (t < 1.8) {
    I = 0;
    ratio = 0;
    phase = t < 1 ? 0 : 1;
  } else if (t < 3.0) {
    const u = (t - 1.8) / 1.2;
    I = 1.2 * smInt(u);
    ratio = sm(u);
    press = sm(u);
    phase = 2;
  } else if (t < 6.0) {
    I = 0.6 + (t - 3.0);
    ratio = 1;
    press = 1;
    phase = 3;
  } else if (t < 7.2) {
    const w = (t - 6.0) / 1.2;
    I = 3.6 + 1.2 * (w - smInt(w));
    ratio = 1 - sm(w);
    phase = 4;
  } else {
    I = 4.2;
    ratio = 0;
    phase = 5;
  }
  let gap: number;
  if (t < 1.0) gap = FR_G;
  else if (t < 1.8) gap = FR_G * (1 - sm((t - 1.0) / 0.8));
  else if (t < 6.0) gap = 0;
  else if (t < 6.8) gap = FR_G * sm((t - 6.0) / 0.8);
  else gap = FR_G;
  return { phiS: OM * (n * 4.2 + I), ratio, gap, press, phase };
}

export interface ClutchAssembly<S> {
  group: THREE.Group;
  /** theta = 구동 각(누적). 그룹 안 모든 부품의 자세를 다시 계산한다 */
  set(theta: number): S;
  /** 이름표 자리(월드 좌표, 정지 부품 기준) */
  anchors: Record<string, THREE.Vector3>;
}

/** 회전체(단면 [반지름, 축 방향 z] 의 닫힌 윤곽) — 로컬 Z 축. phiLen < 2π 이면 잘라낸 두 단면을 판으로 막는다(단면이 보이는 컷어웨이) */
function sectionSolid(profile: [number, number][], mat: THREE.Material, phiLen = TAU, segs = 64): THREE.Group {
  const g = new THREE.Group();
  const loop: [number, number][] = [...profile, profile[0]!];
  const body = lathe(loop, segs, 0, phiLen);
  body.rotateX(Math.PI / 2);
  g.add(mesh(body, mat));
  if (phiLen < TAU - 1e-6) {
    const capMat = mat.clone();
    capMat.side = THREE.DoubleSide;
    for (const phi of [0, phiLen]) {
      const cap = new THREE.ShapeGeometry(shapeFrom(profile));
      cap.rotateY(phi - Math.PI / 2);
      cap.rotateX(Math.PI / 2);
      g.add(mesh(cap, capMat));
    }
  }
  return g;
}

/**
 * 047 판화(단면도): 왼쪽 상자 = 판 + 가운데 보스 + 안쪽 턱(링) + 바깥 테, 안쪽 턱과 바깥 테 사이가 고리 홈.
 * 오른쪽 원판 = 판 + 가장자리에서 상자 쪽으로 뻗은 고리 테(쐐기) + 긴 보스(끝에 포크 홈). 원판의 고리 테가 상자의 고리 홈에 박혀 마찰로 문다.
 * 축은 X 방향 y 1.7, z 0.28. 상자의 1/4 을 잘라내(판화에 없음 — 단면도를 대신) 홈 안의 고리 테가 보이게 했다.
 */
export function frictionClutchAssembly(boxPhase = 0): ClutchAssembly<FrictionState> {
  const group = new THREE.Group();
  const xh = -0.8; // 상자 판 안쪽 면(= 고리 홈 바닥) x
  const xFork = 0.93; // 원판 원점 → 포크 홈 가운데
  const sh = new THREE.Group();
  sh.name = 'shaft';
  setMM(sh, { kind: 'part', axis: 'x' });
  sh.position.set(0, AX_Y, AX_Z);
  sh.add(keyedShaft(-1.9, 1.95, -0.42, 0.5, -1.7));
  group.add(sh);
  group.add(wallBearing(-1.5, AX_Y, AX_Z, 'x', 0.075), wallBearing(1.5, AX_Y, AX_Z, 'x', 0.075));

  // 구동 상자(헐겁게 도는 쪽) — 로컬 z = 축 방향(+z 가 원판 쪽), z = 0 이 홈 바닥
  const housing = new THREE.Group();
  housing.name = 'clutchBox';
  setMM(housing, { kind: 'part', axis: 'x' });
  housing.position.set(xh, AX_Y, AX_Z);
  const hc = new THREE.Group();
  hc.rotation.y = Math.PI / 2;
  housing.add(hc);
  hc.add(
    sectionSolid(
      [
        [0.088, -0.1], [0.5, -0.1], [0.5, 0.3], [0.44, 0.3], [0.425, 0], [0.375, 0], [0.36, 0.3], [0.28, 0.3],
        [0.28, 0], [0.17, 0], [0.17, 0.1], [0.088, 0.1]
      ],
      bronze({ roughness: 0.34 }),
      Math.PI * 1.5
    )
  );
  hc.add(at(new THREE.BoxGeometry(0.016, 0.08, 0.012), MARK(), 0, 0.44, -0.103));
  group.add(housing);

  // 원판(깃에 미끄러지는 쪽) — 로컬 z = 0 이 (틈 0 일 때) 상자 홈 바닥. 고리 테 끝 z 0.008, 뿌리 0.30, 판 0.36~0.45, 보스 ~1.0
  const disk = new THREE.Group();
  disk.name = 'clutchDisk';
  setMM(disk, { kind: 'part', axis: 'x' });
  disk.position.set(xh, AX_Y, AX_Z);
  const dc = new THREE.Group();
  dc.rotation.y = Math.PI / 2;
  disk.add(dc);
  dc.add(
    sectionSolid(
      [
        [0.088, 0.36], [0.3625, 0.36], [0.3625, 0.3], [0.378, 0.008], [0.422, 0.008], [0.4375, 0.3], [0.4375, 0.45],
        [0.25, 0.45], [0.25, 0.55], [0.17, 0.55], [0.17, 0.86], [0.25, 0.86], [0.25, 0.9], [0.17, 0.9], [0.17, 0.96],
        [0.25, 0.96], [0.25, 1.0], [0.088, 1.0]
      ],
      brass()
    )
  );
  dc.add(at(new THREE.BoxGeometry(0.016, 0.08, 0.012), MARK(), 0, 0.38, 0.453));
  group.add(disk);

  // 포크(정지, 원판 보스 홈 가운데) · 받침 기둥 · 꺾쇠 레버
  const fork = shiftFork();
  fork.name = 'fork';
  fork.position.set(xh + xFork, AX_Y, AX_Z);
  group.add(fork);
  const pivot = V3(xh + xFork + FR_G / 2, 0.95, AX_Z);
  group.add(wallPost(pivot.x, pivot.y, AX_Z));
  const crank = bellCrank(0.95);
  crank.name = 'lever';
  crank.position.copy(pivot);
  group.add(crank);

  const anchors: Record<string, THREE.Vector3> = {
    housing: V3(-1.05, 2.42, 0.6),
    disk: V3(-0.2, 2.42, 0.6),
    shaft: V3(1.3, 1.98, 0.45),
    lever: V3(0.95, 0.55, 0.45)
  };
  const set = (theta: number): FrictionState => {
    const s = frictionClutchState(theta);
    housing.rotation.x = theta + boxPhase; // boxPhase(선택): 잘린 창이 정면을 향하는 순간을 옮기는 각(속도는 그대로)
    sh.rotation.x = s.phiS;
    disk.position.x = xh + s.gap;
    disk.rotation.x = s.phiS;
    fork.position.x = xh + s.gap + xFork;
    aimBellCrank(crank, pivot, V3(xh + s.gap + xFork, AX_Y - 0.3, AX_Z));
    return s;
  };
  set(0);
  return { group, set, anchors };
}

// ───────────────────────── 048 톱니 맞물림 클러치 ─────────────────────────

const DOG_N = 6;
const DOG_P = TAU / DOG_N; // 턱 피치각 60°
export const DOG_GAP = 0.16; // 완전히 뗀 틈
export const DOG_DEPTH = 0.115; // 완전히 맞물린 깊이
export interface DogState {
  /** 클러치 A(헐거운 쪽) 각 중 이번 주기 진행 x = ψA − ψA0 (rad) */
  x: number;
  /** 축 B 의 회전각 − ψA0 (월드 각 = ψA0 + phiRel) */
  phiRel: number;
  /** 맞물림 깊이 d (−DOG_GAP = 뗌, 0 = 턱 끝끼리 닿음, DOG_DEPTH = 완전히 물림) */
  d: number;
  /** 0 쉼 · 1 레버 밂 · 2 턱 끝 대기 · 3 들어가며 접촉 · 4 붙어 돎 · 5 떼는 중 · 6 타성 감속 · 7 쉼 */
  phase: number;
  /** 상대 위상 rel = ΦB + p/2 − ψA 를 [−p/2, p/2) 로 접은 값 */
  rel: number;
}
/**
 * 클러치 A(헐거운 기어쪽)의 누적 진행 xTot(rad) → 축 B 각·깊이. 한 주기 = A 가 한 바퀴(6p).
 * u = x/p: 0~0.2 쉼 · 0.2~0.8 레버가 B 를 밂(d −0.16→0) · 0.8~0.9 대기 · 0.9~1.5 들어감(0→0.115; 1.1 에서 A 턱이 B 턱 옆면에 닿음)
 * · 1.1~3.5 B 가 A 와 함께 돎 · 3.0~3.5 뽑기(d→0) · 3.5~4.3 틈까지 · 3.5~4.7 B 타성 감속 · 이후 쉼. B 는 한 주기에 정확히 반 바퀴(3p)씩 앞선다.
 */
export function dogClutchState(xTot: number): DogState {
  const p = DOG_P;
  const n = Math.floor(xTot / TAU);
  const x = xTot - n * TAU;
  const u = x / p;
  let d: number;
  if (u < 0.2) d = -DOG_GAP;
  else if (u < 0.8) d = -DOG_GAP * (1 - sm((u - 0.2) / 0.6));
  else if (u < 0.9) d = 0;
  else if (u < 1.5) d = DOG_DEPTH * sm((u - 0.9) / 0.6);
  else if (u < 3.0) d = DOG_DEPTH;
  else if (u < 3.5) d = DOG_DEPTH * (1 - sm((u - 3.0) / 0.5));
  else if (u < 4.3) d = -DOG_GAP * sm((u - 3.5) / 0.8);
  else d = -DOG_GAP;
  let f: number;
  let phase: number;
  if (u < 1.1) {
    f = 0;
    phase = u < 0.2 ? 0 : u < 0.8 ? 1 : u < 0.9 ? 2 : 3;
  } else if (u < 3.5) {
    f = x - 1.1 * p;
    phase = u < 3.0 ? 4 : 5;
  } else if (u < 4.7) {
    const w = (u - 3.5) / 1.2;
    f = 2.4 * p + 1.2 * p * (w - (w * w) / 2);
    phase = 6;
  } else {
    f = 3 * p;
    phase = 7;
  }
  const phiRel = n * 3 * p + f;
  const rel = mod(phiRel + p / 2 - xTot + p / 2, p) - p / 2;
  return { x, phiRel, d, phase, rel };
}

/** 048: 위 피니언 → 아래 기어 A(+턱 반쪽, 헐거움) · 깃 있는 축 + 미끄러지는 턱 반쪽 B · 포크·꺾쇠 레버. 축 X, y 1.7, z 0.28. set(theta) 의 theta = 구동각(피니언 각 = −2.5·theta, 기어 A 각속도 = theta/2). 판화: 피니언은 기어의 1/5 쯤으로 작고 폭이 넓다 */
export function dogClutchAssembly(): ClutchAssembly<DogState & { psiA: number; pinion: number }> {
  const group = new THREE.Group();
  const M = 0.016;
  const ZP = 12;
  const ZG = 60;
  const KP = ZG / ZP / 2; // 피니언은 구동각의 2.5배로 돈다(기어 A 는 그대로 theta/2)
  const yP = AX_Y + (M * (ZP + ZG)) / 2; // 피니언 축 높이(중심 거리 0.576)
  const xG = -1.3;
  const xC = -0.5; // A 턱 끝
  const h = 0.12;
  const sh = new THREE.Group();
  sh.position.set(0, AX_Y, AX_Z);
  sh.add(keyedShaft(-1.9, 1.95, -0.7, 0.6, 1.55));
  group.add(sh);
  group.add(wallBearing(-1.78, AX_Y, AX_Z, 'x', 0.075), wallBearing(1.78, AX_Y, AX_Z, 'x', 0.075));

  // A: 기어 + 슬리브 + 턱(위상 π/2 → 월드 방위 = ψA + k·p)
  const axisA = new THREE.Group();
  axisA.position.set(xG, AX_Y, AX_Z);
  axisA.name = 'gearA';
  setMM(axisA, { kind: 'part', axis: 'x' });
  const gearA = spurGear(ZG, M, { width: 0.12, spokes: 6 });
  gearA.rotation.y = Math.PI / 2;
  axisA.add(gearA);
  const jawA = jawClutchHalf(DOG_N, { phase: Math.PI / 2, driver: true, sleeve: xC - h - xG, height: h });
  jawA.rotation.y = Math.PI / 2;
  jawA.position.x = xC - h - xG; // 로컬 x(축 방향) — 뿌리 면 x = −0.62
  axisA.add(jawA);
  group.add(axisA);

  // B: 턱(위상 0 → 월드 방위 = ΦB + p/2 + k·p) + 긴 슬리브 + 홈 플랜지
  const axisB = new THREE.Group();
  axisB.name = 'clutchB';
  setMM(axisB, { kind: 'part', axis: 'x' });
  const jawB = jawClutchHalf(DOG_N, { phase: 0, sleeve: 0.8, height: h });
  jawB.rotation.y = -Math.PI / 2;
  axisB.add(jawB);
  const fl = new THREE.Group();
  fl.rotation.y = -Math.PI / 2;
  fl.add(mesh(tubeZ(0.17, 0.26, -0.49, -0.45, 0.004), steel()));
  fl.add(mesh(tubeZ(0.17, 0.26, -0.59, -0.55, 0.004), steel()));
  axisB.add(fl);
  group.add(axisB);

  // 피니언(구동, 청동) + 그 축
  const pinion = new THREE.Group();
  pinion.position.set(xG, yP, AX_Z);
  pinion.name = 'pinion';
  setMM(pinion, { kind: 'part', axis: 'x' });
  const pg = spurGear(ZP, M, { width: 0.2, spokes: 0, driver: true });
  pg.rotation.y = Math.PI / 2;
  pinion.add(pg);
  pinion.add(mesh(rodX(0.045, -0.5, 0.4, 0.008), steel()));
  group.add(pinion);
  group.add(wallBearing(xG - 0.32, yP, AX_Z, 'x', 0.052), wallBearing(xG + 0.36, yP, AX_Z, 'x', 0.052));

  const fork = shiftFork();
  group.add(fork);
  const pivot = V3(0.165, 0.9, AX_Z);
  group.add(wallPost(pivot.x, pivot.y, AX_Z));
  const crank = bellCrank(0.95);
  group.add(crank);

  const c1: [number, number] = [-AX_Z, yP];
  const c2: [number, number] = [-AX_Z, AX_Y];
  const psi0 = meshAngle(c1, ZP, 0, c2, ZG);
  const anchors: Record<string, THREE.Vector3> = {
    pinion: V3(xG, yP + 0.34, 0.6),
    gearA: V3(xG - 0.15, AX_Y - 0.62, 0.6),
    jawA: V3(-0.78, AX_Y + 0.38, 0.62),
    jawB: V3(0.22, AX_Y + 0.4, 0.62),
    shaft: V3(1.3, AX_Y + 0.28, 0.45),
    lever: V3(1.35, 0.42, 0.45)
  };
  const set = (theta: number): DogState & { psiA: number; pinion: number } => {
    const th1 = -KP * theta;
    const psiA = meshAngle(c1, ZP, th1, c2, ZG);
    const s = dogClutchState(psiA - psi0);
    pinion.rotation.x = th1;
    axisA.rotation.x = psiA;
    const phiB = psi0 + s.phiRel;
    sh.rotation.x = phiB;
    const rootX = xC - s.d + h;
    axisB.position.set(rootX, AX_Y, AX_Z);
    axisB.rotation.x = phiB;
    const fx = rootX + 0.52;
    fork.position.set(fx, AX_Y, AX_Z);
    aimBellCrank(crank, pivot, V3(fx, AX_Y - 0.3, AX_Z));
    return { ...s, psiA, pinion: th1 };
  };
  set(0);
  return { group, set, anchors };
}

// ───────────────────────── 049 래칫 베벨 기어 전동 ─────────────────────────

/** 래칫 휠: 로컬 Z 축, 두께 width, 톱니는 반시계(+각) 방향으로 비스듬히 내려가는 비대칭 톱니(곧은 면이 각 k·q 에 있고 그 위쪽(+각)이 이끝) */
export function ratchetWheel(teeth: number, rOut: number, rRoot: number, width = 0.08, bore = 0.062): THREE.Group {
  const q = TAU / teeth;
  const outline: [number, number][] = [];
  for (let k = 0; k < teeth; k++) {
    outline.push([rRoot * Math.cos(k * q), rRoot * Math.sin(k * q)], [rOut * Math.cos(k * q), rOut * Math.sin(k * q)]);
  }
  const shape = shapeFrom(outline);
  shape.holes.push(circlePath(0, 0, bore));
  for (let i = 0; i < 5; i++) shape.holes.push(circlePath(Math.cos((i / 5) * TAU + 0.3) * (rRoot * 0.6), Math.sin((i / 5) * TAU + 0.3) * (rRoot * 0.6), rRoot * 0.2));
  const g = new THREE.Group();
  g.add(mesh(extrude(shape, width, 0.004), steel()));
  g.add(at(new THREE.BoxGeometry(0.05, 0.014, 0.01), MARK(), rRoot * 0.6, 0, width / 2 + 0.003));
  return g;
}

export const RATCHET = { S: (50 * Math.PI) / 180, q: Math.PI / 6, d: (10 * Math.PI) / 180, tauL: (20 * Math.PI) / 180, tauR: (10 * Math.PI) / 180 } as const;
export interface RatchetState {
  /** 입력축(왕복) 각 s = −S·cos(theta): 앞 행정(theta 0~π)에서 증가 */
  s: number;
  /** 출력 쪽 누적각 α(베벨 L = +α, 베벨 R = −α, 위 피니언 = +α 같은 방향) */
  alpha: number;
  /** 폴 L 이 다음 톱니 면까지 남은 각(0 = 걸려 미는 중) */
  pL: number;
  pR: number;
  /** true = 앞 행정(폴 L 이 밂) */
  forward: boolean;
}
/**
 * 왕복 입력 → 연속 출력. S=50°, 톱니 피치 q=30°(12개), 처짐 d=10°.
 * 앞 행정(0~π): L 폴이 s ≥ −S + d 부터 밀어 α 가 S(1−cosφ) − d 만큼(0 이상) 오른다.
 * 뒤 행정(π~2π): R 폴이 밀어 같은 방향으로 α 가 S(1+cosφ) − d 만큼 더 오른다. 한 주기에 α = 2(2S − d) = 180°.
 */
export function ratchetDriveState(theta: number): RatchetState {
  const { S, q, d, tauL, tauR } = RATCHET;
  const n = Math.floor(theta / TAU);
  const phi = theta - n * TAU;
  const s = -S * Math.cos(theta);
  const A = 2 * (2 * S - d);
  const f = phi <= Math.PI ? Math.max(0, S * (1 - Math.cos(phi)) - d) : 2 * S - d + Math.max(0, S * (1 + Math.cos(phi)) - d);
  const alpha = n * A + f;
  return {
    s,
    alpha,
    pL: mod(alpha + tauL - s, q),
    pR: mod(s + alpha - tauR, q),
    forward: phi <= Math.PI
  };
}

/**
 * 049 전체: 왕복 입력 레버가 붙은 가로축 · 헐겁게 끼운 베벨 L/R + 래칫 휠 · 축에 고정된 팔과 폴 · 위 세로축 베벨 · 받침 기둥.
 * 가로축 y 1.15, z 0.28, 베벨 24잇수·모듈 0.04(피치 반지름 0.48), 꼭짓점 O = (0, 1.15, 0.28). set(theta): theta = 입력 왕복 위상(한 주기 2π)
 */
export function ratchetBevelDrive(): ClutchAssembly<RatchetState> {
  const group = new THREE.Group();
  const Oy = 1.15;
  const R = 0.48;
  const TB = 24;
  const MB = 0.04;
  const pB = TAU / TB;
  const rOut = 0.3;
  const rRoot = 0.25;
  const xW = 0.7; // 래칫 휠 x
  const xA = 0.88; // 팔 x
  const rPv = 0.5;
  const dPv = 0.35;
  const { q } = RATCHET;

  // 입력 가로축(+팔·폴·왕복 레버): s 로 회전
  const axisS = new THREE.Group();
  axisS.position.set(0, Oy, AX_Z);
  axisS.name = 'inputShaft';
  setMM(axisS, { kind: 'part', axis: 'x' });
  axisS.add(mesh(rodX(0.05, -1.45, 1.45, 0.01), steel()));
  axisS.add(at(new THREE.BoxGeometry(0.12, 0.014, 0.045), MARK(), 1.32, 0.052, 0));
  // 입력 레버(왼쪽 끝) — 위쪽 +Y, 끝에 손잡이 공
  axisS.add(at(rodX(0.075, -1.33, -1.27, 0.008), darkSteel(), 0, 0, 0));
  axisS.add(mesh(extrude(shapeFrom([[-0.03, 0], [0.03, 0], [0.025, 0.55], [-0.025, 0.55]]), 0.05, 0.006), steel()).rotateY(Math.PI / 2).translateZ(-1.3));
  axisS.add(at(new THREE.SphereGeometry(0.06, 20, 14), brass(), -1.3, 0.55, 0));
  // 팔 + 폴
  const pawls: { m: THREE.Mesh; sign: 1 | -1; x: number }[] = [];
  for (const sign of [-1, 1] as const) {
    const px = sign * xW;
    const ax = sign * xA;
    const Py = rPv * Math.cos(sign * dPv);
    // L(sign −1): 피벗은 방위 −dPv(뒤쪽), R(sign +1): +dPv(앞쪽)
    const pz = rPv * Math.sin(sign * dPv);
    axisS.add(at(rodX(0.09, ax - 0.03, ax + 0.03, 0.005), darkSteel(), 0, 0, 0));
    axisS.add(aimStatic(unitRod(0.025, steel()), V3(ax, 0, 0), V3(ax, Py, pz)));
    axisS.add(aimStatic(unitRod(0.02, darkSteel()), V3(ax, Py, pz), V3(px, Py, pz)));
    const pm = unitRod(0.022, darkSteel());
    axisS.add(pm);
    pawls.push({ m: pm, sign, x: px });
  }
  group.add(axisS);

  // 베벨 L / R + 래칫 휠(같은 몸) — 부모 회전.x = ∓α
  const mk = (sign: 1 | -1): THREE.Group => {
    const ax = new THREE.Group();
    ax.position.set(sign === -1 ? -R : R, Oy, AX_Z);
    const c = new THREE.Group();
    c.rotation.y = sign === -1 ? Math.PI / 2 : -Math.PI / 2;
    ax.add(c);
    c.add(bevelGear(TB, MB, { width: 0.12, bore: 0.062, driver: sign === -1 }));
    // 래칫 휠: 월드 x = ±xW → 로컬 z = 거리(꼭짓점 쪽이 +z)
    const zW = R - xW; // 로컬 z (L: 월드 x = −R + z → z = −xW + R)
    const wheel = ratchetWheel(12, rOut, rRoot, 0.08);
    wheel.position.z = zW;
    wheel.rotation.z = sign === -1 ? RATCHET.tauL + Math.PI / 2 : Math.PI / 2 - RATCHET.tauR;
    c.add(wheel);
    // 베벨 허브 뒷면에서 래칫 휠까지 슬리브
    c.add(mesh(tubeZ(0.062, 0.1, zW, -0.1, 0.006), darkSteel()));
    return ax;
  };
  const axL = mk(-1);
  const axR = mk(1);
  axL.name = 'bevelL';
  axR.name = 'bevelR';
  setMM(axL, { kind: 'part', axis: 'x' });
  setMM(axR, { kind: 'part', axis: 'x' });
  group.add(axL, axR);

  // 위 세로축 + 베벨 피니언 — 부모 회전.y = α + p/2
  const axisP = new THREE.Group();
  axisP.position.set(0, Oy + R, AX_Z);
  axisP.name = 'bevelTop';
  setMM(axisP, { kind: 'part', axis: 'y' });
  const pc = new THREE.Group();
  pc.rotation.x = Math.PI / 2;
  axisP.add(pc);
  pc.add(bevelGear(TB, MB, { width: 0.12, bore: 0.052 }));
  pc.add(mesh(rodZ(0.045, -1.35, 0.05, 0.008), steel()));
  pc.add(mesh(tubeZ(0.045, 0.12, -1.15, -1.11, 0.004), darkSteel()));
  pc.add(at(new THREE.BoxGeometry(0.07, 0.014, 0.012), MARK(), 0.1, 0, -1.116));
  group.add(axisP);

  group.add(pedestalX(-1.05, Oy, AX_Z, -1, 0.18, 0.058), pedestalX(1.05, Oy, AX_Z, 1, 0.18, 0.058));
  group.add(wallBearing(0, Oy + R + 0.7, AX_Z, 'y', 0.052));

  const anchors: Record<string, THREE.Vector3> = {
    lever: V3(-1.5, 1.98, 0.5),
    ratchetL: V3(-1.5, 0.72, 0.62),
    ratchetR: V3(1.5, 0.72, 0.62),
    bevel: V3(0, 0.5, 0.62),
    top: V3(0.75, 2.5, 0.5),
    pawlL: V3(-0.75, 1.95, 0.5),
    pawlR: V3(0.75, 1.95, 0.5)
  };
  const T = V3(0, 0, 0);
  const Pp = V3(0, 0, 0);
  const set = (theta: number): RatchetState => {
    const st = ratchetDriveState(theta);
    axisS.rotation.x = st.s;
    axL.rotation.x = st.alpha;
    axR.rotation.x = -st.alpha;
    axisP.rotation.y = st.alpha + pB / 2;
    for (const pw of pawls) {
      const left = pw.sign === -1;
      const p = left ? st.pL : st.pR;
      const rt = rRoot + ((rOut - rRoot) * p) / q;
      T.set(pw.x, rt, 0);
      Pp.set(pw.x, rPv * Math.cos(pw.sign * dPv), rPv * Math.sin(pw.sign * dPv));
      aimRod(pw.m, Pp, T);
    }
    return st;
  };
  set(0);
  return { group, set, anchors };
}

function aimStatic(m: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3): THREE.Mesh {
  aimRod(m, a, b);
  return m;
}

// ───────────────────────── 050 유니버설 조인트 ─────────────────────────

export interface HookeState {
  /** 입력축 각(= theta) */
  phi1: number;
  /** 가운데 8자 틀의 각: tan χ = cosβ1·tan φ1 (한 조인트의 정확한 비등속식) */
  chi: number;
  /** 출력축 각: tan φ2 = tan χ / cosβ2 */
  phi2: number;
  /** χ − φ1 (rad) — 가운데 틀이 입력보다 앞서고 뒤서는 정도 */
  dChi: number;
  /** φ2 − φ1 (β1 = β2 이면 0) */
  dOut: number;
}
/** 두 조인트가 이어진 이중 후크 조인트의 각: 입력 φ1 → 틀 χ → 출력 φ2 (연속 각으로 풀어 돌려준다) */
export function hookeAngles(phi1: number, beta1: number, beta2: number): HookeState {
  const wrap = (a: number, ref: number): number => a + TAU * Math.round((ref - a) / TAU);
  const chi = wrap(Math.atan2(Math.cos(beta1) * Math.sin(phi1), Math.cos(phi1)), phi1);
  const phi2 = wrap(Math.atan2(Math.sin(chi), Math.cos(beta2) * Math.cos(chi)), chi);
  return { phi1, chi, phi2, dChi: chi - phi1, dOut: phi2 - phi1 };
}

function basisQuat(x: THREE.Vector3, y: THREE.Vector3, z: THREE.Vector3): THREE.Quaternion {
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

/** 050 포크 가지의 핀 방향 거리(축에서 가지 중심까지) */
export const YOKE_D = 0.34;

/** 후크 조인트의 한 쪽 포크(로컬: 축 +Z, 십자 중심 = 원점, 핀 방향 = 로컬 X) */
function hookeYoke(driver: boolean): THREE.Group {
  const g = new THREE.Group();
  const body = driver ? bronze() : brass();
  // 축 + 허브
  g.add(mesh(rodZ(0.05, 0.42, 1.25, 0.008), steel()));
  g.add(mesh(tubeZ(0, 0.1, 0.38, 0.5, 0.01), darkSteel()));
  // 포크 가지 두 개(핀 방향 ±YOKE_D) + 눈. 가지 사이가 틀의 고리보다 넓어야 한다(판화: 긴 고리 포크가 틀의 고리를 감쌈) —
  // 고리가 가지 쪽으로 가장 기울 때 고리 끝의 핀 방향 거리 = rOut·sin45° + 두께/2 = 0.29 < YOKE_D − 0.034
  for (const s of [-1, 1]) {
    g.add(mesh(rodZ(0.034, 0.0, 0.42, 0.006), body).translateX(s * YOKE_D));
    const eye = lathe(tubeProfile(0.026, 0.075, -0.02, 0.02, 0.004), 24);
    eye.rotateZ(Math.PI / 2);
    g.add(at(eye, body, s * (YOKE_D + 0.02), 0, 0));
  }
  g.add(at(new THREE.BoxGeometry(2 * YOKE_D + 0.07, 0.07, 0.07), body, 0, 0, 0.4));
  g.add(at(new THREE.BoxGeometry(0.05, 0.014, 0.1), MARK(), 0.0, 0.055, 1.12));
  return g;
}
/** 십자: 팔 +X(포크 핀 p 방향 — 가지 끝 눈까지 ±0.38), +Y(틀 핀 q 방향 — 틀 고리의 눈을 꿰어 ±0.38) */
function hookeCross(): THREE.Group {
  const g = new THREE.Group();
  g.add(at(new THREE.BoxGeometry(0.09, 0.09, 0.09), steel(), 0, 0, 0));
  g.add(mesh(rodX(0.024, -(YOKE_D + 0.04), YOKE_D + 0.04, 0.004), brass()));
  const y = lathe(rodProfile(0.024, -(FR8.rOut + 0.02), FR8.rOut + 0.02, 0.004, 0.004), 20);
  g.add(mesh(y, brass()));
  return g;
}

/** 050 8자 틀 치수: 십자 중심 x = ±cx, 고리 바깥 반지름·구멍 반지름·허리 반폭·두께 */
export const FR8 = { cx: 0.4, rOut: 0.36, rHole: 0.25, waist: 0.13, thick: 0.07 } as const;

export interface JointAssembly {
  group: THREE.Group;
  set(theta: number): HookeState;
  anchors: Record<string, THREE.Vector3>;
  beta1: number;
  beta2: number;
}
/**
 * 050 이중 후크 조인트(판화: 8자 틀 하나를 사이에 두고 양쪽 고리 포크). 가운데 틀은 X 축(높이 1.55, z 0.28), 십자 중심 J1(−0.40), J2(+0.40).
 * 입력축은 아래 왼쪽, 출력축은 아래 오른쪽으로 β 만큼 꺾여 있다(기본 45°·45°). set(theta): theta = 입력축 각
 */
export function universalJointPair(beta1 = (45 * Math.PI) / 180, beta2 = (45 * Math.PI) / 180): JointAssembly {
  const group = new THREE.Group();
  const Y0 = 1.55;
  const cx = FR8.cx;
  const J1 = V3(-cx, Y0, AX_Z);
  const J2 = V3(cx, Y0, AX_Z);
  const u1 = V3(-Math.cos(beta1), -Math.sin(beta1), 0);
  const eb1 = V3(Math.sin(beta1), -Math.cos(beta1), 0);
  const u2 = V3(Math.cos(beta2), -Math.sin(beta2), 0);
  const eb2 = V3(-Math.sin(beta2), -Math.cos(beta2), 0);
  const X = V3(1, 0, 0);
  const Z = V3(0, 0, 1);

  const yoke1 = hookeYoke(true);
  const yoke2 = hookeYoke(false);
  const cross1 = hookeCross();
  const cross2 = hookeCross();
  yoke1.name = 'yokeIn';
  yoke2.name = 'yokeOut';
  cross1.name = 'cross1';
  cross2.name = 'cross2';
  // 8자 틀(판화: 안경테처럼 두 고리가 잘록한 허리로 이어진 띠 고리 — 아래쪽에 보이는 띠는 따로 된 연결대가 아니라 틀의 앞쪽 변)
  const frame = new THREE.Group();
  frame.name = 'frame8';
  setMM(frame, { kind: 'part', axis: 'x' });
  {
    const pts: [number, number][] = [];
    const a0 = Math.asin(FR8.waist / FR8.rOut);
    const NA = 40;
    for (let i = 0; i <= NA; i++) {
      const a = -(Math.PI - a0) + (2 * (Math.PI - a0) * i) / NA;
      pts.push([cx + FR8.rOut * Math.cos(a), FR8.rOut * Math.sin(a)]);
    }
    for (let i = 0; i <= NA; i++) {
      const a = a0 + (2 * (Math.PI - a0) * i) / NA;
      pts.push([-cx + FR8.rOut * Math.cos(a), FR8.rOut * Math.sin(a)]);
    }
    const sh = shapeFrom(pts);
    sh.holes.push(circlePath(-cx, 0, FR8.rHole), circlePath(cx, 0, FR8.rHole));
    frame.add(mesh(extrude(sh, FR8.thick, 0.008), steel()));
    // 틀 쪽 핀이 꿰이는 눈(판화의 띠에 보이는 작은 원 — 고리마다 위·아래 두 곳)
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const eye = lathe(tubeProfile(0.024, 0.05, -0.012, 0.012, 0.003), 20);
        frame.add(at(eye, darkSteel(), sx * cx, sy * (FR8.rOut + 0.006), 0));
      }
    }
    frame.add(at(new THREE.BoxGeometry(0.06, 0.014, 0.06), MARK(), 0, FR8.waist - 0.02, FR8.thick / 2 + 0.004));
  }
  frame.position.set(0, Y0, AX_Z);
  group.add(yoke1, yoke2, cross1, cross2, frame);
  // 축받이: 입력·출력축 중간 지점을 뒤판 팔로 받친다
  const s1 = J1.clone().addScaledVector(u1, 0.95);
  const s2 = J2.clone().addScaledVector(u2, 0.95);
  group.add(wallBearing(s1.x, s1.y, AX_Z, u1, 0.058), wallBearing(s2.x, s2.y, AX_Z, u2, 0.058));

  const anchors: Record<string, THREE.Vector3> = {
    input: V3(-1.45, 0.38, 0.55),
    frame: V3(0, Y0 + 0.5, 0.55),
    output: V3(1.45, 0.38, 0.55),
    cross1: V3(-0.7, Y0 + 0.9, 0.6),
    cross2: V3(0.7, Y0 + 0.9, 0.6)
  };
  const p1 = V3(0, 0, 0);
  const q = V3(0, 0, 0);
  const p2 = V3(0, 0, 0);
  const set = (theta: number): HookeState => {
    const hs = hookeAngles(theta, beta1, beta2);
    // 입력 포크 핀 방향 p1(φ1) = cosφ1·Z + sinφ1·eb1 ; 틀 핀 q ⟂ X, p1 ; 출력 포크 핀 p2 ⟂ u2, q
    p1.copy(Z).multiplyScalar(Math.cos(hs.phi1)).addScaledVector(eb1, Math.sin(hs.phi1));
    q.crossVectors(X, p1).normalize();
    p2.crossVectors(u2, q).normalize();
    const e1 = V3(0, 0, 0).crossVectors(u1, p1);
    yoke1.position.copy(J1);
    yoke1.quaternion.copy(basisQuat(p1, e1, u1));
    cross1.position.copy(J1);
    cross1.quaternion.copy(basisQuat(p1, q, V3(0, 0, 0).crossVectors(p1, q)));
    const e2 = V3(0, 0, 0).crossVectors(u2, p2);
    yoke2.position.copy(J2);
    yoke2.quaternion.copy(basisQuat(p2, e2, u2));
    cross2.position.copy(J2);
    cross2.quaternion.copy(basisQuat(p2, q, V3(0, 0, 0).crossVectors(p2, q)));
    frame.quaternion.copy(basisQuat(X, q, V3(0, 0, 0).crossVectors(X, q)));
    void eb2;
    return hs;
  };
  set(0);
  return { group, set, anchors, beta1, beta2 };
}
