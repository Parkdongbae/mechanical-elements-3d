// 061·062 차동 두 단 속도 전용 부품 — 가로(X) 축 모형, 차동 케이지, 마찰 밴드(제동대), 3D 엇걸이 벨트 경로
import * as THREE from 'three';
import { brass, darkSteel, paint, steel } from '../../models/materials';
import { lathe, mesh, rodProfile, tubeProfile } from '../../models/parts/geom';
import { STAGE } from './stand';
import { crossedBeltPath, openBeltPath, type V2 } from './belt';
import { rod } from './shaft';
import { weight } from './misc';

const YEL = 0xf2b619;

function at(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

/** 가로(X) 축 막대. 그룹 원점 = (x0, y, z), +X 로 (x1 − x0) 뻗는다. 양끝에 밝은 키 → rotation.x 로 돌리면 회전이 보인다 */
export function shaftX(x0: number, x1: number, y: number, z: number, r = 0.045): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x0, y, z);
  const len = x1 - x0;
  const geo = lathe(rodProfile(r, 0, len, r * 0.3, r * 0.3), 32);
  geo.rotateZ(-Math.PI / 2); // 축 Y → +X
  g.add(mesh(geo, steel()));
  for (const x of [0.07, len - 0.07]) {
    g.add(at(new THREE.BoxGeometry(0.1, 0.018, 0.018), paint(YEL), x, r + 0.006, 0));
  }
  return g;
}

/** 가로 축 받침: 축을 감싸는 짧은 칼라(길이 0.1, 축 X) + 뒤판까지 이어지는 막대. 회전하지 않는다 */
export function bearingX(x: number, y: number, z: number): THREE.Group {
  const g = new THREE.Group();
  const col = lathe(tubeProfile(0.05, 0.095, -0.05, 0.05, 0.01), 36);
  col.rotateZ(-Math.PI / 2);
  g.add(at(col, darkSteel(), x, y, z));
  g.add(rod(new THREE.Vector3(x, y, z - 0.09), new THREE.Vector3(x, y, STAGE.backZ + 0.02), 0.04));
  return g;
}

/** 로컬 Z 축 속 빈 원통(관). 반지름 rIn~rOut, 로컬 z0~z1. 'brass' | 'dark' */
export function tubeZ(rIn: number, rOut: number, z0: number, z1: number, kind: 'brass' | 'dark' = 'brass'): THREE.Mesh {
  const geo = lathe(tubeProfile(rIn, rOut, 0, z1 - z0, 0.006), 40);
  geo.rotateX(Math.PI / 2); // 축 Y → +Z
  return at(geo, kind === 'brass' ? brass() : darkSteel(), 0, 0, z0);
}

/** 풀리·원통 림(반지름 r, 길이 width)에 줄 방향(로컬 Z)으로 박은 밝은 표시 막대 n 개 — 옆에서 봐도 회전이 보인다 */
export function rimMarks(r: number, width: number, n = 4, z0 = 0): THREE.Group {
  const g = new THREE.Group();
  const mat = paint(YEL);
  const len = Math.min(width * 0.5, 0.3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const m = at(new THREE.BoxGeometry(0.03, 0.012, len), mat, Math.cos(a) * (r + 0.004), Math.sin(a) * (r + 0.004), z0);
    m.rotation.z = a;
    g.add(m);
  }
  return g;
}

export interface DiffCarrierOpts {
  /** 풀리(운반대) 왼쪽 면의 x */
  xFace: number;
  /** 두 베벨의 꼭짓점 x (유성 중심 x) */
  xO: number;
  /** 베벨 피치 반지름 */
  R: number;
  /** 케이지 막대의 반지름 방향 위치(유성 뒷면 R+0.09 바깥, 벨트 안쪽 0.38 보다 작게) — 기본 0.32 */
  rc?: number;
}

/**
 * 차동 케이지(운반대): 풀리 면에서 유성 쪽으로 뻗는 막대 2개(유성 쪽 +Y, 반대쪽 −Y) + 링 + 유성 축 + 균형추.
 * 그룹 원점 = 축 위의 점 (0, yL, zc), 축 = 세계 X. 이 그룹 전체를 rotation.x = φ 로 돌린다.
 * 유성 기어는 모델이 이 그룹 안 (xO, R, 0) 에 pivot(rotation.x = +π/2)로 넣는다 — 유성 중심은 케이지 로컬 +Y 쪽.
 */
export function diffCarrier(o: DiffCarrierOpts): THREE.Group {
  const g = new THREE.Group();
  const rc = o.rc ?? 0.32;
  const xe = o.xO - 0.26; // 막대 끝(유성 왼쪽 끝 xO−0.22 바깥)
  for (const s of [1, -1]) {
    g.add(rod(new THREE.Vector3(o.xFace, s * rc, 0), new THREE.Vector3(xe, s * rc, 0), 0.025));
  }
  // 막대 끝을 잇는 링(축 X)
  const ringGeo = new THREE.TorusGeometry(rc, 0.014, 10, 48);
  ringGeo.rotateY(Math.PI / 2);
  g.add(at(ringGeo, darkSteel(), xe, 0, 0));
  // 유성 축(반지름 방향 핀): 막대에서 유성 허브 안쪽까지
  g.add(rod(new THREE.Vector3(o.xO, rc, 0), new THREE.Vector3(o.xO, o.R + 0.02, 0), 0.024));
  // 균형추: 반대쪽 막대 위 블록
  g.add(at(new THREE.BoxGeometry(0.14, 0.1, 0.12), darkSteel(), o.xO - 0.02, -rc + 0.02, 0));
  return g;
}

/**
 * 마찰 밴드(제동대): 원통(드럼 반지름 r, 가운데 x = 그룹 원점, 축 X)을 감싼 띠 + 아래 두 귀.
 * 왼쪽 귀는 뒤판 쪽 막대(고정), 오른쪽 귀에서 막대로 추가 매달림. 드럼과 따로 — 그룹은 회전하지 않는다.
 * 그룹 원점 = 드럼 중심 (x, y, z).
 */
export function brakeBand(r: number, width: number): THREE.Group {
  const g = new THREE.Group();
  const band = lathe(tubeProfile(r + 0.003, r + 0.02, -width / 2 + 0.01, width / 2 - 0.01, 0.004), 40);
  band.rotateZ(-Math.PI / 2);
  g.add(mesh(band, darkSteel()));
  // 왼쪽 귀(고정): 밴드 아래 → 뒤판
  g.add(at(new THREE.BoxGeometry(0.05, 0.05, 0.05), darkSteel(), -0.06, -(r + 0.04), 0));
  g.add(rod(new THREE.Vector3(-0.06, -(r + 0.04), -0.02), new THREE.Vector3(-0.06, -(r + 0.04), STAGE.backZ + 0.02), 0.025));
  // 오른쪽 귀 + 매다는 막대 + 추
  g.add(at(new THREE.BoxGeometry(0.05, 0.05, 0.05), darkSteel(), 0.06, -(r + 0.04), 0));
  const drop = 0.24;
  g.add(rod(new THREE.Vector3(0.06, -(r + 0.06), 0), new THREE.Vector3(0.06, -(r + 0.06) - drop, 0), 0.016));
  const w = weight(0.12, 0.14);
  w.position.set(0.06, -(r + 0.06) - drop - 0.07 - 0.02, 0);
  g.add(w);
  return g;
}

export interface LoopYZ {
  /** 닫힌 벨트 점열(월드 좌표) */
  pts: THREE.Vector3[];
  /** 점마다 띠 폭 방향(=+X) — new Belt(pts, { widthDirs }) */
  dirs: THREE.Vector3[];
}

function toWorld(path: V2[], x: number, xOff?: number[]): LoopYZ {
  const pts = path.map((p, i) => new THREE.Vector3(x + (xOff ? xOff[i]! : 0), p[0], p[1]));
  const dirs = path.map(() => new THREE.Vector3(1, 0, 0));
  return { pts, dirs };
}

/**
 * 가로(X) 축 두 풀리를 잇는 열린 벨트. 벨트 평면은 x = x(축에 수직, 평면 좌표 (y, z)). 위 풀리 중심 (yTop, zc), 아래 풀리 중심 (yBot, zc).
 * 경로는 (y, z) 평면에서 반시계 = +X 축 둘레 양(+)의 회전 방향. Belt.setOffset(+r·θ) 면 +X 둘레 θ 로 도는 풀리와 같이 흐른다.
 */
export function beltLoopYZ(yTop: number, rTop: number, yBot: number, rBot: number, zc: number, x: number): LoopYZ {
  // openBeltPath 의 c1 = 아래, c2 = 위 → 순서 그대로 (y, z) 좌표로 넣는다
  return toWorld(openBeltPath([yBot, zc], rBot, [yTop, zc], rTop, 24), x);
}

/**
 * 엇걸이 벨트: 평면 경로가 한 점에서 스스로 교차하므로 두 가닥을 폭 방향(X)으로 ±dx 어긋나게 해 통과시킨다.
 * (감김 호에서 서서히 이동 — 나선 감김). 두 풀리의 회전은 서로 반대.
 */
export function crossedLoopYZ(yTop: number, rTop: number, yBot: number, rBot: number, zc: number, x: number, dx = 0.08): LoopYZ {
  const path = crossedBeltPath([yBot, zc], rBot, [yTop, zc], rTop, 24);
  const n = path.length;
  const c2: V2 = [yTop, zc];
  const onC2 = (p: V2): boolean => Math.abs(Math.hypot(p[0] - c2[0], p[1] - c2[1]) - rTop) < 1e-6;
  let s2 = 1;
  while (s2 + 1 < n && onC2(path[s2 + 1]!)) s2++; // 위 풀리 호의 마지막(= 둘째 가닥 시작)
  const off: number[] = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    if (i <= 1) off[i] = dx; // 첫째 가닥
    else if (i < s2) off[i] = dx - (2 * dx * (i - 1)) / (s2 - 1); // 위 풀리 호: +dx → −dx
    else if (i === s2 || i === s2 + 1) off[i] = -dx; // 둘째 가닥
    else off[i] = -dx + (2 * dx * (i - (s2 + 1))) / (n - (s2 + 1)); // 아래 풀리 호: −dx → +dx (i = n 이 0 으로 닫힘)
  }
  return toWorld(path, x, off);
}
