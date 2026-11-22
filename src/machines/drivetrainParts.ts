// 자동차 구동방식 5종(FF·FR·AWD·싱글 모터·듀얼 모터) 공용 절차 모델.
// STL(상자·원기둥 수준)을 대체한다. 5종의 바퀴·차체는 반드시 이 파일의 빌더를 써서 동일하게 보이게 한다.
//
// ── 좌표 규약 (모든 빌더 공통) ──
//  - 단위: three 단위(1 ≈ 실물 0.4m). 기계 파일의 root 그룹(씬 y=CAR.rootY=0.13) 기준 로컬 좌표.
//  - Y 위, 차의 앞 = -Z, 뒤 = +Z, 좌우 = ±X. 바퀴 바닥은 root y = CAR.groundY(-0.13) = 씬 바닥.
//  - 바퀴 중심: (±CAR.halfTrack, CAR.axleY, CAR.frontZ | CAR.rearZ) = (±0.73, 0.12, ∓0.65). 반지름 0.25, 폭 0.16.
//  - 각 빌더는 THREE.Group을 새로 만들어 돌려준다(재질도 호출마다 새 인스턴스 — 인트로 페이드·플래시를 개별 적용).
//
// ── export 요약 (10-B가 사용 — 시그니처 고정) ──
//  CAR                                  치수 상수(위 좌표 규약의 숫자)
//  buildWheel(side, opts?)              회전부 바퀴: 타이어(트레드·옆면 굴곡)+5스포크 알로이 휠+브레이크 디스크+허브.
//                                       원점=바퀴 중심, 회전축=로컬 X. side=+1이면 바깥 면이 +X(오른쪽 바퀴), -1이면 -X.
//                                       opts.marker=true → 타이어 옆면에 작은 주황 회전 표시.
//  buildCaliper(side)                   고정부 브레이크 캘리퍼(회전 피벗 밖, 바퀴 중심 위치에 둔다). 원점=바퀴 중심.
//  buildLadderFrame()                   사다리형 프레임+사이드 실(root 좌표 그대로, 원점 이동 불필요). 불투명.
//  buildCarShell()                      반투명 세단 셸(ghost, 그림자·레이캐스트 없음). root 좌표 그대로.
//  buildHalfShaft(length, opts?)        등속 조인트(안·밖)+주름 부트 구동 반축. 로컬 +X 방향, x=0(디퍼렌셜 쪽)~length(바퀴 쪽).
//  buildHalfShaftBetween(a, b, opts?)   위 반축을 a(디퍼렌셜 쪽)→b(바퀴 허브 쪽)로 배치한 그룹(position=a). 축 = a→b.
//  buildPropShaft(length, opts?)        양끝 유니버설 조인트(요크·십자축) 프로펠러 샤프트. 로컬 +X, 0~length.
//  buildPropShaftBetween(a, b, opts?)   위 샤프트를 a→b로 배치(position=a).
//  buildLiveAxleShaft(length)           차축 하우징 안 반축(직선 축+바퀴 플랜지). 로컬 +X, 0~length.
//  buildTorsionBeamAxle(halfLen?)       비구동 토션빔 차축(트레일링 암·스프링·쇼크). 원점=차축 중심(0, axleY, z축선).
//  buildBeamAxle(halfLen?)              비구동 빔 차축(너클·타이로드·스프링). 원점=차축 중심.
//  buildStrutCorner(side, z)            고정부 맥퍼슨 스트럿 코너(너클 링·A암·코일오버). root 좌표 그대로.
//  setOpacityFactor(obj, k)             인트로 페이드: 원래 불투명도 × k (k=1이면 원래 투명 설정으로 복귀).
//  disableRaycast(obj)                  클릭/레이캐스트 대상에서 제외.
//  applyIntro / finishIntroItems / hideIntroItems / IntroItem / INTRO_DROP / INTRO_DUR
//                                       순차 낙하·페이드 인트로 도우미(선택 사용). fixGhostShadows(root): 반투명 메시 그림자 끔.
//  기하 도우미: latheX, latheZ, cylX, rbox, alignY, rodBetween, barBetween, tubeThrough, coilSpring, bellowsProfile, MeshBatch
//  (내연기관 전용 — 10-A) buildInline4Engine, buildTransmission, buildFFTransaxle, buildRearDiff, buildTransferCase,
//  buildDiffWithHalfShafts

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { aluminum, castIron, chrome, darkSteel, ghost, glow, paint, plastic, rubber, steel } from '../models/materials';
import { creased, extrude, lathe, merge, mesh, rodProfile, shapeFrom, TAU, type V2 } from '../models/parts/geom';

// ─────────────────────────── 상수 ───────────────────────────

export const CAR = {
  rootY: 0.13,
  groundY: -0.13,
  axleY: 0.12,
  frontZ: -0.65,
  rearZ: 0.65,
  halfTrack: 0.73,
  wheelR: 0.25,
  wheelW: 0.16,
  /** 바퀴 허브 안쪽 면 |x| — 반축 바깥 끝을 여기에 맞춘다 */
  hubInnerX: 0.67,
  /** 사다리 프레임 레일 중심 |x|, 높이 y */
  railX: 0.5,
  railY: 0.28
} as const;

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);

// ─────────────────────────── 지오메트리 도구 ───────────────────────────

/** (r, x) 프로파일을 X축 둘레로 회전 */
export function latheX(profile: V2[], segs = 48, crease = 36): THREE.BufferGeometry {
  const g = lathe(profile, segs, 0, TAU, crease);
  g.rotateZ(-Math.PI / 2); // 로컬 Y축 → +X
  return g;
}

/** (r, z) 프로파일을 Z축 둘레로 회전 */
export function latheZ(profile: V2[], segs = 48, crease = 36): THREE.BufferGeometry {
  const g = lathe(profile, segs, 0, TAU, crease);
  g.rotateX(Math.PI / 2); // 로컬 Y축 → +Z
  return g;
}

/** X축 원기둥(모따기) x0~x1 */
export function cylX(r: number, x0: number, x1: number, segs = 32, c = 0): THREE.BufferGeometry {
  return latheX(rodProfile(r, x0, x1, c, c), segs);
}

export function rbox(w: number, h: number, d: number, r: number, segs = 2): THREE.BufferGeometry {
  return new RoundedBoxGeometry(w, h, d, segs, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4));
}

/** +Y 방향으로 만든 지오메트리(원점 중심)를 a→b 선분에 맞춘다 */
export function alignY(geo: THREE.BufferGeometry, a: THREE.Vector3, b: THREE.Vector3): THREE.BufferGeometry {
  const dir = b.clone().sub(a).normalize();
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y_AXIS, dir));
  const mid = a.clone().add(b).multiplyScalar(0.5);
  geo.translate(mid.x, mid.y, mid.z);
  return geo;
}

/** a→b 원기둥 */
export function rodBetween(a: THREE.Vector3, b: THREE.Vector3, r: number, segs = 16): THREE.BufferGeometry {
  return alignY(new THREE.CylinderGeometry(r, r, a.distanceTo(b), segs), a, b);
}

/** a→b 둥근 각재 (w: 로컬 X 폭, d: 로컬 Z 두께) */
export function barBetween(a: THREE.Vector3, b: THREE.Vector3, w: number, d: number, r = 0.008): THREE.BufferGeometry {
  return alignY(rbox(w, a.distanceTo(b), d, r), a, b);
}

/** 점열을 지나는 관 */
export function tubeThrough(pts: THREE.Vector3[], r: number, segs = 32, radial = 12, closed = false): THREE.BufferGeometry {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed, 'centripetal'), segs, r, radial, closed);
}

class HelixCurve extends THREE.Curve<THREE.Vector3> {
  constructor(private r: number, private h: number, private turns: number) {
    super();
  }
  override getPoint(t: number, target = new THREE.Vector3()): THREE.Vector3 {
    const a = t * this.turns * TAU;
    return target.set(this.r * Math.cos(a), t * this.h, this.r * Math.sin(a));
  }
}

/** 코일 스프링(로컬 Y, y=0~h) */
export function coilSpring(r: number, h: number, turns: number, wire: number): THREE.BufferGeometry {
  return new THREE.TubeGeometry(new HelixCurve(r, h, turns), Math.ceil(turns * 28), wire, 8, false);
}

/** 주름 부트(벨로즈) 프로파일 — (r, x) x0→x1, 반지름 r0→r1, 주름 수 folds */
export function bellowsProfile(x0: number, x1: number, r0: number, r1: number, folds: number): V2[] {
  const p: V2[] = [[0, x0], [r0 * 0.85, x0]];
  const n = folds * 2;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const r = r0 + (r1 - r0) * t;
    p.push([i % 2 === 0 ? r * 0.82 : r, x0 + (x1 - x0) * t]);
  }
  p.push([r1 * 0.85, x1], [0, x1]);
  return p;
}

/** 지오메트리 목록을 재질별로 모아 병합 메시로 만드는 도우미 (드로콜 절약) */
export class MeshBatch {
  private lists = new Map<THREE.Material, THREE.BufferGeometry[]>();
  add(material: THREE.Material, ...geos: THREE.BufferGeometry[]): void {
    const list = this.lists.get(material) ?? [];
    list.push(...geos);
    this.lists.set(material, list);
  }
  flush(parent: THREE.Object3D): void {
    for (const [m, list] of this.lists) {
      if (list.length === 0) continue;
      mesh(list.length === 1 ? list[0]! : merge(list), m, parent);
    }
    this.lists.clear();
  }
}

// ─────────────────────────── 유틸 ───────────────────────────

interface FadeData {
  baseOpacity: number;
  baseTransparent: boolean;
}

/** 인트로 페이드: 메시 재질의 불투명도를 원래 값 × k 로 만든다. k ≥ 1 이면 원래 상태로 복귀. */
export function setOpacityFactor(obj: THREE.Object3D, k: number): void {
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh && !(o as THREE.Line).isLine) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      if (!mat) continue;
      const ud = mat.userData as { fade?: FadeData };
      if (!ud.fade) ud.fade = { baseOpacity: mat.opacity, baseTransparent: mat.transparent };
      if (k >= 1) {
        mat.opacity = ud.fade.baseOpacity;
        mat.transparent = ud.fade.baseTransparent;
      } else {
        mat.transparent = true;
        mat.opacity = ud.fade.baseOpacity * Math.max(0, k);
      }
    }
  });
}

const noRaycast = (): void => {};
/** 클릭/레이캐스트 대상에서 제외(반투명 셸이 부품 선택을 가로막지 않게) */
export function disableRaycast(obj: THREE.Object3D): void {
  obj.traverse((o) => {
    o.raycast = noRaycast;
  });
}

// ─────────────────────────── 바퀴 ───────────────────────────

const TYRE_R = CAR.wheelR;
const TYRE_HW = CAR.wheelW / 2;

/** 타이어 단면 (r, x) — 둥근 숄더, 옆면 굴곡, 원주 홈 3줄 */
function tyreProfile(): { prof: V2[]; v0: number; v1: number } {
  const R = TYRE_R;
  const hw = TYRE_HW;
  const p: V2[] = [
    [0.171, -hw + 0.012],
    [0.182, -hw + 0.001],
    [0.2, -hw - 0.004],
    [0.218, -hw - 0.005],
    [0.234, -hw + 0.0],
    [R - 0.005, -hw + 0.012],
    [R, -hw + 0.024]
  ];
  for (const gy of [-0.032, 0, 0.032]) {
    p.push([R, gy - 0.0075], [R - 0.009, gy - 0.005], [R - 0.009, gy + 0.005], [R, gy + 0.0075]);
  }
  p.push([R, hw - 0.024], [R - 0.005, hw - 0.012], [0.234, hw - 0.0], [0.218, hw + 0.005], [0.2, hw + 0.004], [0.182, hw - 0.001], [0.171, hw - 0.012], [0.171, -hw + 0.012]);
  const n = p.length - 1;
  return { prof: p, v0: 6 / n, v1: (n - 7) / n };
}

let treadTex: THREE.CanvasTexture | null = null;
/** 트레드 블록 범프맵 — u = 원주, v = 단면 진행 방향(트레드 띠 v0~v1 에만 가로 홈) */
function treadTexture(v0: number, v1: number): THREE.CanvasTexture | null {
  if (treadTex) return treadTex;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 64, 256);
  // flipY: 캔버스 위쪽 = v 1
  const y0 = (1 - v1) * 256;
  const y1 = (1 - v0) * 256;
  ctx.fillStyle = '#1a1a1a';
  for (let k = 0; k < 2; k++) {
    const x = k * 32;
    // 숄더 가로 홈
    ctx.fillRect(x + 6, y0, 5, (y1 - y0) * 0.28);
    ctx.fillRect(x + 22, y1 - (y1 - y0) * 0.28, 5, (y1 - y0) * 0.28);
    // 가운데 사선 사이프
    ctx.save();
    ctx.translate(x + 16, (y0 + y1) / 2);
    ctx.rotate(0.55);
    ctx.fillRect(-1.5, -(y1 - y0) * 0.22, 3, (y1 - y0) * 0.44);
    ctx.restore();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(40, 1);
  treadTex = tex;
  return tex;
}

/**
 * 회전부 바퀴. 원점=바퀴 중심, 회전축=로컬 X. side=+1: 바깥 면이 +X.
 * 회전 피벗(그룹)에 그대로 물리면 된다. 캘리퍼는 고정부라 buildCaliper로 따로 둔다.
 */
export function buildWheel(side: 1 | -1 = 1, opts: { marker?: boolean } = {}): THREE.Group {
  const g = new THREE.Group();
  g.name = 'wheel';
  const inner = new THREE.Group();
  if (side < 0) inner.rotation.y = Math.PI; // 바깥 면을 -X로
  g.add(inner);
  const hw = TYRE_HW;

  // 타이어
  const { prof, v0, v1 } = tyreProfile();
  const tyreMat = rubber({ roughness: 0.9, grain: false });
  const tex = treadTexture(v0, v1);
  if (tex) {
    tyreMat.bumpMap = tex;
    tyreMat.bumpScale = 1.6;
  }
  // UV(트레드 범프)를 유지해야 하므로 lathe() 대신 LatheGeometry + creased 직접 사용
  const lg = creased(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 96), 40);
  lg.rotateZ(-Math.PI / 2);
  mesh(lg, tyreMat, inner);

  const rimMat = aluminum({ color: 0xc9ced6, roughness: 0.26 });
  const batch = new MeshBatch();

  // 림 배럴 + 플랜지
  batch.add(
    rimMat,
    latheX(
      [
        [0.155, -hw + 0.01],
        [0.176, -hw + 0.006],
        [0.179, -hw + 0.016],
        [0.163, -hw + 0.024],
        [0.163, hw - 0.024],
        [0.179, hw - 0.016],
        [0.176, hw - 0.006],
        [0.155, hw - 0.01],
        [0.155, -hw + 0.01]
      ],
      72
    )
  );

  // 5 스포크 면 — 바깥쪽으로 살짝 오목하게 두 겹(스포크 + 중심 보스)
  const face = new THREE.Shape();
  face.absarc(0, 0, 0.159, 0, TAU, false);
  for (let i = 0; i < 5; i++) {
    const sa = (i / 5) * TAU;
    const sb = ((i + 1) / 5) * TAU;
    const hole = new THREE.Path();
    hole.absarc(0, 0, 0.142, sa + 0.19, sb - 0.19, false);
    hole.absarc(0, 0, 0.066, sb - 0.46, sa + 0.46, true);
    hole.closePath();
    face.holes.push(hole);
  }
  const faceGeo = new THREE.ExtrudeGeometry(face, { depth: 0.016, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: 2, curveSegments: 36 });
  faceGeo.rotateY(Math.PI / 2); // 압출 Z → +X
  faceGeo.translate(hw - 0.042, 0, 0);
  batch.add(rimMat, faceGeo);
  // 중심 보스
  batch.add(
    rimMat,
    latheX(
      [
        [0, hw - 0.05],
        [0.062, hw - 0.05],
        [0.062, hw - 0.03],
        [0.05, hw - 0.018],
        [0, hw - 0.016]
      ],
      40
    )
  );
  batch.flush(inner);

  // 센터 캡 + 휠 너트 5개
  const chromeMat = chrome();
  const cap = latheX(
    [
      [0, hw - 0.02],
      [0.028, hw - 0.02],
      [0.026, hw - 0.012],
      [0.016, hw - 0.008],
      [0, hw - 0.007]
    ],
    28
  );
  const nuts: THREE.BufferGeometry[] = [cap];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + Math.PI / 5;
    const n = new THREE.CylinderGeometry(0.0075, 0.0075, 0.016, 6).rotateZ(Math.PI / 2);
    n.translate(hw - 0.022, Math.cos(a) * 0.042, Math.sin(a) * 0.042);
    nuts.push(n);
  }
  mesh(merge(nuts), chromeMat, inner);

  // 브레이크 디스크(벤틸레이티드 2장 + 햇) + 허브
  const discMat = steel({ color: 0x8f969d, roughness: 0.5 });
  const discBatch = new MeshBatch();
  discBatch.add(
    discMat,
    latheX(
      [
        [0.07, -0.05],
        [0.136, -0.05],
        [0.136, -0.043],
        [0.08, -0.043],
        [0.08, -0.032],
        [0.136, -0.032],
        [0.136, -0.025],
        [0.07, -0.025],
        [0.062, -0.0],
        [0.062, 0.008],
        [0.05, 0.008],
        [0.05, -0.05],
        [0.07, -0.05]
      ],
      64
    )
  );
  discBatch.flush(inner);
  mesh(cylX(0.045, -0.06, hw - 0.05, 28, 0.004), darkSteel(), inner);

  if (opts.marker) {
    // 타이어 바깥 옆면의 작은 회전 표시
    const mk = new THREE.Mesh(rbox(0.006, 0.034, 0.014, 0.002), glow(0xff5a3c, 0.6));
    mk.position.set(hw + 0.004, 0.207, 0);
    mk.castShadow = false;
    inner.add(mk);
  }
  return g;
}

/** 고정부 브레이크 캘리퍼(뒤-위 45°). 원점=바퀴 중심. side=+1이면 오른쪽 바퀴(바깥 +X) */
export function buildCaliper(side: 1 | -1 = 1): THREE.Group {
  const g = new THREE.Group();
  g.name = 'caliper';
  const body = new THREE.Mesh(rbox(0.05, 0.042, 0.1, 0.012, 3), paint(0xb8352d, { roughness: 0.35 }));
  body.position.set(-0.0375 * side, 0.0849, 0.0849);
  body.rotation.x = Math.PI / 4;
  body.castShadow = true;
  g.add(body);
  return g;
}

// ─────────────────────────── 차체: 프레임 ───────────────────────────

/** 사다리형 프레임 + 사이드 실(바닥 윤곽). root 좌표 그대로. 크로스멤버는 프로펠러 샤프트 위(레일 높이)를 지난다 */
export function buildLadderFrame(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'frame';
  const frameMat = paint(0x48505a, { roughness: 0.55, metalness: 0.3 });
  const sillMat = paint(0x5a636e, { roughness: 0.5, metalness: 0.3 });
  const b = new MeshBatch();
  const X = CAR.railX;
  const Y = CAR.railY;
  // 사이드 레일(각관): 앞뒤 끝은 살짝 안쪽·아래로
  const railProfile: V2[] = [
    [-0.03, -0.02],
    [0.03, -0.02],
    [0.03, 0.02],
    [-0.03, 0.02]
  ];
  for (const s of [-1, 1]) {
    const pts = [
      new THREE.Vector3(s * (X - 0.05), Y - 0.02, -1.2),
      new THREE.Vector3(s * X, Y, -0.95),
      new THREE.Vector3(s * X, Y, 0.95),
      new THREE.Vector3(s * (X - 0.04), Y - 0.01, 1.16)
    ];
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const geo = new THREE.ExtrudeGeometry(shapeFrom(railProfile), { steps: 40, bevelEnabled: false, extrudePath: curve });
    b.add(frameMat, geo);
  }
  // 앞·뒤 범퍼 빔
  b.add(frameMat, alignY(rbox(0.05, 1.2, 0.05, 0.016), new THREE.Vector3(-0.6, Y - 0.02, -1.215), new THREE.Vector3(0.6, Y - 0.02, -1.215)));
  b.add(frameMat, alignY(rbox(0.05, 1.12, 0.05, 0.016), new THREE.Vector3(-0.56, Y - 0.01, 1.175), new THREE.Vector3(0.56, Y - 0.01, 1.175)));
  // 가운데 크로스멤버(레일 높이 — 프로펠러 샤프트보다 위)
  b.add(frameMat, alignY(rbox(0.045, 2 * X, 0.05, 0.012), new THREE.Vector3(-X, Y, 0.25), new THREE.Vector3(X, Y, 0.25)));
  // 사이드 실(문 아래 바닥 테두리) + 아웃리거
  for (const s of [-1, 1]) {
    b.add(sillMat, alignY(rbox(0.06, 0.74, 0.06, 0.018), new THREE.Vector3(s * 0.72, 0.1, -0.37), new THREE.Vector3(s * 0.72, 0.1, 0.37)));
    for (const z of [-0.3, 0.0, 0.3]) {
      b.add(frameMat, barBetween(new THREE.Vector3(s * (X + 0.02), Y - 0.02, z), new THREE.Vector3(s * 0.7, 0.11, z), 0.03, 0.03, 0.008));
    }
  }
  b.flush(g);
  return g;
}

// ─────────────────────────── 차체: 반투명 셸 ───────────────────────────

/** 표 보간(Catmull-Rom, 균일 매개) */
function tableAt(table: V2[], z: number): number {
  const n = table.length;
  if (z <= table[0]![0]) return table[0]![1];
  if (z >= table[n - 1]![0]) return table[n - 1]![1];
  let i = 0;
  while (i < n - 2 && z > table[i + 1]![0]) i++;
  const p1 = table[i]!;
  const p2 = table[i + 1]!;
  const p0 = table[Math.max(0, i - 1)]!;
  const p3 = table[Math.min(n - 1, i + 2)]!;
  const t = (z - p1[0]) / (p2[0] - p1[0]);
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
}

/** 단면 함수(z → 점열, 점 개수 고정)를 Z로 이어 붙인 열린 곡면 */
function loftZ(zs: number[], section: (z: number) => V2[]): THREE.BufferGeometry {
  const pos: number[] = [];
  let m = 0;
  for (const z of zs) {
    const sec = section(z);
    m = sec.length;
    for (const [x, y] of sec) pos.push(x, y, z);
  }
  const idx: number[] = [];
  for (let k = 0; k < zs.length - 1; k++) {
    for (let j = 0; j < m - 1; j++) {
      const a = k * m + j;
      const b = (k + 1) * m + j;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const SHELL_ZF = -1.28;
const SHELL_ZR = 1.23;
// 아래 차체 윗선(보닛 → 벨트라인 → 트렁크)
const BODY_TOP: V2[] = [
  [-1.28, 0.46],
  [-1.12, 0.55],
  [-0.75, 0.59],
  [-0.38, 0.615],
  [0.2, 0.63],
  [0.8, 0.645],
  [1.05, 0.66],
  [1.23, 0.6]
];
// 지붕선(앞유리 → 지붕 → 뒷유리)
const CABIN_TOP: V2[] = [
  [-0.36, 0.615],
  [-0.2, 0.74],
  [-0.02, 0.9],
  [0.14, 0.97],
  [0.42, 0.97],
  [0.62, 0.86],
  [0.82, 0.648]
];

function endFactor(z: number, z0: number, z1: number, e0: number, e1: number): number {
  if (z < z0 + e0) return Math.sqrt(Math.max(0, 1 - ((z0 + e0 - z) / e0) ** 2));
  if (z > z1 - e1) return Math.sqrt(Math.max(0, 1 - ((z - (z1 - e1)) / e1) ** 2));
  return 1;
}

function bodyBottom(z: number): number {
  let y = 0.05;
  if (z < -1.0) y = 0.05 + (-(z + 1.0) / 0.28) * 0.12; // 앞 범퍼 아래 올라감
  if (z > 1.02) y = 0.05 + ((z - 1.02) / 0.21) * 0.1;
  const archR = 0.305;
  for (const zw of [CAR.frontZ, CAR.rearZ]) {
    const dz = z - zw;
    if (Math.abs(dz) < archR) y = Math.max(y, CAR.axleY + Math.sqrt(archR * archR - dz * dz));
  }
  return y;
}

/** 아래 차체 단면: 왼쪽 아래 → 지붕(보닛) → 오른쪽 아래 */
function bodySection(z: number): V2[] {
  const f = endFactor(z, SHELL_ZF, SHELL_ZR, 0.2, 0.17);
  const ytB = tableAt(BODY_TOP, z);
  const ybB = bodyBottom(z);
  const mid = (ytB + ybB) / 2;
  const top = mid + (ytB - mid) * f;
  const bot = mid - (mid - ybB) * f;
  const W = 0.8 * (0.86 + 0.14 * f);
  const Wt = W * 0.95;
  const rr = Math.min(0.12, (top - bot) * 0.45, Wt * 0.5);
  const half: V2[] = [];
  for (let i = 0; i <= 3; i++) {
    const t = i / 3;
    const y = bot + (top - rr - bot) * t;
    half.push([-(W - (W - Wt) * t * t), y]);
  }
  for (let i = 1; i <= 6; i++) {
    const a = Math.PI - (i / 6) * (Math.PI / 2);
    half.push([-(Wt - rr) + rr * Math.cos(a), top - rr + rr * Math.sin(a)]);
  }
  for (let i = 1; i <= 3; i++) {
    const x = -(Wt - rr) * (1 - i / 4);
    half.push([x, top + 0.012 * (1 - (x / Wt) ** 2) * f]);
  }
  const right = [...half].reverse().map(([x, y]) => [-x, y] as V2);
  return [...half, [0, top + 0.012 * f], ...right];
}

/** 캐빈(유리 부분) 단면 */
function cabinSection(z: number): V2[] {
  const belt = tableAt(BODY_TOP, z) - 0.006;
  const roof = Math.max(belt, tableAt(CABIN_TOP, z));
  const h = roof - belt;
  const Wb = 0.74;
  const Wr = 0.6;
  const rr = Math.min(0.08, h * 0.45);
  const half: V2[] = [];
  for (let i = 0; i <= 3; i++) {
    const t = i / 3;
    half.push([-(Wb + (Wr + rr * 0.3 - Wb) * t), belt + (h - rr) * t]);
  }
  for (let i = 1; i <= 5; i++) {
    const a = Math.PI - (i / 5) * (Math.PI / 2);
    half.push([-(Wr - rr * 0.7) + rr * Math.cos(a), roof - rr + rr * Math.sin(a)]);
  }
  for (let i = 1; i <= 3; i++) {
    const x = -(Wr - rr * 0.7) * (1 - i / 4);
    half.push([x, roof + 0.01 * (1 - (x / Wr) ** 2) * Math.min(1, h * 10)]);
  }
  const right = [...half].reverse().map(([x, y]) => [-x, y] as V2);
  return [...half, [0, roof + 0.01 * Math.min(1, h * 10)], ...right];
}

/** 반투명 세단 셸 — 보닛·지붕·트렁크·바퀴 아치가 읽히는 윤곽 + 실루엣 선 */
export function buildCarShell(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'carShell';
  const zs: number[] = [];
  for (let i = 0; i <= 120; i++) zs.push(SHELL_ZF + ((SHELL_ZR - SHELL_ZF) * i) / 120);
  const bodyMat = ghost(0xa3b8ce, 0.17);
  bodyMat.side = THREE.DoubleSide;
  const body = new THREE.Mesh(loftZ(zs, bodySection), bodyMat);
  body.renderOrder = 2;
  g.add(body);

  const czs: number[] = [];
  for (let i = 0; i <= 60; i++) czs.push(-0.36 + (1.18 * i) / 60);
  const cabinMat = ghost(0x5d7896, 0.2);
  cabinMat.side = THREE.DoubleSide;
  const cabin = new THREE.Mesh(loftZ(czs, cabinSection), cabinMat);
  cabin.renderOrder = 3;
  g.add(cabin);

  // 실루엣 선: 벨트라인·지붕 가장자리·바퀴 아치 윤곽(투시도 느낌)
  const lineMat = new THREE.LineBasicMaterial({ color: 0x5f7896, transparent: true, opacity: 0.7, depthWrite: false });
  const linePts = (fn: (z: number) => THREE.Vector3 | null, z0: number, z1: number, n = 80): THREE.Vector3[] => {
    const out: THREE.Vector3[] = [];
    for (let i = 0; i <= n; i++) {
      const p = fn(z0 + ((z1 - z0) * i) / n);
      if (p) out.push(p);
    }
    return out;
  };
  const segs: THREE.Vector3[][] = [];
  for (const s of [-1, 1]) {
    // 측면 윤곽: 아래 차체 단면 0번(아래)·3번(벨트 직하)·지붕
    segs.push(linePts((z) => { const p = bodySection(z)[0]!; return new THREE.Vector3(s * -p[0], p[1], z); }, SHELL_ZF + 0.02, SHELL_ZR - 0.02, 120));
    segs.push(linePts((z) => { const p = bodySection(z)[5]!; return new THREE.Vector3(s * -p[0], p[1], z); }, SHELL_ZF + 0.01, SHELL_ZR - 0.01, 120));
    segs.push(linePts((z) => { const p = cabinSection(z)[6]!; return new THREE.Vector3(s * -p[0], p[1], z); }, -0.35, 0.81, 60));
  }
  const lineGeo = new THREE.BufferGeometry();
  const lp: number[] = [];
  for (const seg of segs) {
    for (let i = 0; i < seg.length - 1; i++) {
      const a = seg[i]!;
      const b = seg[i + 1]!;
      lp.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
  }
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
  const lines = new THREE.LineSegments(lineGeo, lineMat);
  lines.renderOrder = 4;
  g.add(lines);

  g.traverse((o) => {
    o.castShadow = false;
    o.receiveShadow = false;
    o.userData.noAO = true;
  });
  disableRaycast(g);
  return g;
}

// ─────────────────────────── 축류 ───────────────────────────

export interface ShaftOpts {
  /** 회전 표시 줄무늬(기본 true) */
  stripe?: boolean;
  /** 축 재질 색 */
  color?: number;
}

/**
 * 구동 반축: 안쪽 트리포드 등속 조인트(플랜지 포함) + 부트 + 축 + 부트 + 바깥 버필드 등속 조인트.
 * 로컬 +X, x=0(디퍼렌셜 쪽 플랜지 면) ~ length(바퀴 허브 쪽 끝). 회전축 = 로컬 X.
 */
export function buildHalfShaft(length: number, opts: ShaftOpts = {}): THREE.Group {
  const g = new THREE.Group();
  g.name = 'halfShaft';
  const L = Math.max(0.3, length);
  const jointMat = steel({ color: 0xb9c1ca, roughness: 0.3 });
  const shaftMat = darkSteel({ color: opts.color ?? 0x6d7782 });
  const bootMat = rubber({ roughness: 0.7 });
  const b = new MeshBatch();
  // 안쪽 조인트: 플랜지 + 컵
  b.add(
    jointMat,
    latheX(
      [
        [0, 0],
        [0.044, 0],
        [0.044, 0.01],
        [0.034, 0.014],
        [0.034, 0.058],
        [0.028, 0.066],
        [0, 0.066]
      ],
      36
    )
  );
  // 플랜지 볼트 6개
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    const bolt = new THREE.CylinderGeometry(0.0055, 0.0055, 0.012, 6).rotateZ(Math.PI / 2);
    bolt.translate(0.012, Math.cos(a) * 0.036, Math.sin(a) * 0.036);
    b.add(jointMat, bolt);
  }
  // 바깥 조인트: 종 모양 + 스플라인 스텁
  b.add(
    jointMat,
    latheX(
      [
        [0, L - 0.075],
        [0.022, L - 0.075],
        [0.036, L - 0.055],
        [0.038, L - 0.035],
        [0.032, L - 0.016],
        [0.016, L - 0.012],
        [0.016, L],
        [0, L]
      ],
      36,
      50
    )
  );
  b.add(bootMat, latheX(bellowsProfile(0.06, 0.15, 0.03, 0.014, 4), 32, 70));
  b.add(bootMat, latheX(bellowsProfile(L - 0.16, L - 0.068, 0.014, 0.031, 4).map(([r, x]) => [r, x] as V2), 32, 70));
  b.add(shaftMat, cylX(0.0115, 0.13, L - 0.14, 20, 0.002));
  b.flush(g);
  if (opts.stripe !== false) {
    const sl = Math.max(0.05, L - 0.36) * 0.6;
    const st = new THREE.Mesh(rbox(sl, 0.005, 0.008, 0.002), glow(0xff5a3c, 0.55));
    st.position.set(L / 2, 0.0115, 0);
    g.add(st);
  }
  return g;
}

function placeAlong(obj: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3): void {
  obj.position.copy(a);
  obj.quaternion.setFromUnitVectors(X_AXIS, b.clone().sub(a).normalize());
}

/** 반축을 a(디퍼렌셜 쪽) → b(바퀴 쪽)에 배치. 반환 그룹 position=a, 로컬 X = a→b */
export function buildHalfShaftBetween(a: THREE.Vector3, b: THREE.Vector3, opts: ShaftOpts = {}): THREE.Group {
  const holder = new THREE.Group();
  holder.add(buildHalfShaft(a.distanceTo(b), opts));
  placeAlong(holder, a, b);
  return holder;
}

/** 유니버설 조인트 1조: x=x0 에 플랜지 요크(귀 ±Y), 십자축, 축 요크(귀 ±Z) — dir=+1이면 +X로 진행 */
function addUJoint(b: MeshBatch, yokeMat: THREE.Material, crossMat: THREE.Material, x0: number, dir: 1 | -1): void {
  const X = (d: number): number => x0 + d * dir;
  // 플랜지(컴패니언) + 요크 바닥
  const fl = cylX(0.04, Math.min(X(0), X(0.012)), Math.max(X(0), X(0.012)), 32, 0.002);
  b.add(yokeMat, fl);
  for (const s of [-1, 1]) {
    const ear = rbox(0.036, 0.012, 0.03, 0.005);
    ear.translate(X(0.03), s * 0.027, 0);
    b.add(yokeMat, ear);
    const ear2 = rbox(0.036, 0.03, 0.012, 0.005);
    ear2.translate(X(0.05), 0, s * 0.027);
    b.add(yokeMat, ear2);
  }
  // 십자축 + 베어링 컵
  const cx = X(0.04);
  const armY = new THREE.CylinderGeometry(0.0075, 0.0075, 0.05, 12);
  armY.translate(cx, 0, 0);
  const armZ = new THREE.CylinderGeometry(0.0075, 0.0075, 0.05, 12).rotateX(Math.PI / 2);
  armZ.translate(cx, 0, 0);
  b.add(crossMat, armY, armZ);
  for (const s of [-1, 1]) {
    const cupY = new THREE.CylinderGeometry(0.011, 0.011, 0.012, 14);
    cupY.translate(cx, s * 0.027, 0);
    const cupZ = new THREE.CylinderGeometry(0.011, 0.011, 0.012, 14).rotateX(Math.PI / 2);
    cupZ.translate(cx, 0, s * 0.027);
    b.add(crossMat, cupY, cupZ);
  }
  // 축 요크 바닥(관 쪽)
  const yb0 = X(0.064);
  const yb1 = X(0.08);
  b.add(yokeMat, cylX(0.034, Math.min(yb0, yb1), Math.max(yb0, yb1), 28, 0.003));
}

/**
 * 프로펠러 샤프트: 양끝 플랜지 + 유니버설 조인트(요크·십자축) + 관(양끝 용접 링) + 밸런스 웨이트.
 * 로컬 +X, 0~length. 회전축 = 로컬 X.
 */
export function buildPropShaft(length: number, opts: ShaftOpts = {}): THREE.Group {
  const g = new THREE.Group();
  g.name = 'propShaft';
  const L = Math.max(0.25, length);
  const yokeMat = steel({ color: 0xaab3bd, roughness: 0.32 });
  const crossMat = darkSteel({ color: 0x4a525b });
  const tubeMat = darkSteel({ color: opts.color ?? 0x5d6772, roughness: 0.38 });
  const b = new MeshBatch();
  addUJoint(b, yokeMat, crossMat, 0, 1);
  addUJoint(b, yokeMat, crossMat, L, -1);
  // 관: 양끝 테이퍼 + 용접 링
  b.add(
    tubeMat,
    latheX(
      [
        [0, 0.078],
        [0.03, 0.078],
        [0.03, 0.095],
        [0.027, 0.105],
        [0.027, L - 0.105],
        [0.03, L - 0.095],
        [0.03, L - 0.078],
        [0, L - 0.078]
      ],
      32
    )
  );
  // 밸런스 웨이트
  const bw = rbox(0.03, 0.006, 0.018, 0.002);
  bw.translate(L * 0.32, 0.028, 0);
  b.add(crossMat, bw);
  b.flush(g);
  if (opts.stripe !== false) {
    const st = new THREE.Mesh(rbox((L - 0.24) * 0.7, 0.005, 0.01, 0.002), glow(0xff5a3c, 0.55));
    st.position.set(L / 2, 0.0275, 0);
    g.add(st);
  }
  return g;
}

/** 프로펠러 샤프트를 a → b에 배치 (position=a, 로컬 X = a→b) */
export function buildPropShaftBetween(a: THREE.Vector3, b: THREE.Vector3, opts: ShaftOpts = {}): THREE.Group {
  const holder = new THREE.Group();
  holder.add(buildPropShaft(a.distanceTo(b), opts));
  placeAlong(holder, a, b);
  return holder;
}

/** 차축 하우징 안의 반축: 디퍼렌셜 사이드 기어 스플라인(x=0) ~ 바퀴 플랜지(x=length). 로컬 +X */
export function buildLiveAxleShaft(length: number, opts: ShaftOpts = {}): THREE.Group {
  const g = new THREE.Group();
  g.name = 'axleShaft';
  const L = length;
  const m = steel({ color: opts.color ?? 0xb4bcc5, roughness: 0.3 });
  const b = new MeshBatch();
  b.add(
    m,
    latheX(
      [
        [0, 0],
        [0.014, 0],
        [0.016, 0.006],
        [0.016, 0.05],
        [0.013, 0.06],
        [0.013, L - 0.05],
        [0.02, L - 0.03],
        [0.05, L - 0.022],
        [0.05, L - 0.008],
        [0.03, L],
        [0, L]
      ],
      32
    )
  );
  // 휠 볼트 5개
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    const s = new THREE.CylinderGeometry(0.005, 0.005, 0.02, 8).rotateZ(Math.PI / 2);
    s.translate(L + 0.004, Math.cos(a) * 0.034, Math.sin(a) * 0.034);
    b.add(m, s);
  }
  b.flush(g);
  if (opts.stripe !== false) {
    const st = new THREE.Mesh(rbox((L - 0.12) * 0.6, 0.005, 0.008, 0.002), glow(0xff5a3c, 0.55));
    st.position.set(L * 0.5, 0.013, 0);
    g.add(st);
  }
  return g;
}

// ─────────────────────────── 비구동 차축 ───────────────────────────

function springAndShock(b: MeshBatch, springMat: THREE.Material, shockMat: THREE.Material, rodMat: THREE.Material, base: THREE.Vector3, top: THREE.Vector3, r = 0.034): void {
  const h = top.y - base.y;
  const sp = coilSpring(r, h, 4.2, 0.0065);
  sp.translate(base.x, base.y, base.z);
  b.add(springMat, sp);
  // 스프링 시트
  for (const y of [base.y, top.y]) {
    const seat = new THREE.CylinderGeometry(r + 0.008, r + 0.008, 0.006, 24);
    seat.translate(base.x, y, base.z);
    b.add(shockMat, seat);
  }
  // 스프링 안 댐퍼
  const body = new THREE.CylinderGeometry(0.014, 0.014, h * 0.6, 16);
  body.translate(base.x, base.y + h * 0.3, base.z);
  b.add(shockMat, body);
  const rod = new THREE.CylinderGeometry(0.006, 0.006, h * 0.45, 10);
  rod.translate(base.x, base.y + h * 0.75, base.z);
  b.add(rodMat, rod);
}

/**
 * 비구동 토션빔 차축(FF·싱글 모터의 뒤 차축). 원점 = 차축 중심(바퀴 중심선 위, x=0).
 * 트레일링 암은 앞쪽(-Z)으로 뻗어 프레임 레일 아래 부싱에 붙는다. 스핀들 끝 |x| = halfLen.
 */
export function buildTorsionBeamAxle(halfLen = CAR.hubInnerX + 0.01): THREE.Group {
  const g = new THREE.Group();
  g.name = 'torsionBeamAxle';
  const armMat = paint(0x2e3238, { roughness: 0.5, metalness: 0.35 });
  const spindleMat = steel({ roughness: 0.3 });
  const springMat = paint(0xb8452f, { roughness: 0.4 });
  const shockMat = darkSteel({ color: 0x3d434a });
  const b = new MeshBatch();
  const railLocalY = CAR.railY - CAR.axleY - 0.036; // 레일 아랫면(로컬)
  // V(∩)형 빔
  const beamShape = shapeFrom([
    [-0.036, 0.02],
    [0.036, 0.02],
    [0.042, -0.026],
    [0.03, -0.026],
    [0.025, 0.008],
    [-0.025, 0.008],
    [-0.03, -0.026],
    [-0.042, -0.026]
  ]);
  const beam = extrude(beamShape, 1.04, 0.004, 4);
  beam.rotateY(Math.PI / 2);
  beam.translate(0, 0.0, -0.08);
  b.add(armMat, beam);
  for (const s of [-1, 1]) {
    const pivot = new THREE.Vector3(s * (CAR.railX - 0.01), railLocalY - 0.035, -0.34);
    const hub = new THREE.Vector3(s * 0.58, 0, 0.0);
    b.add(armMat, barBetween(pivot, hub, 0.05, 0.04, 0.012));
    // 부싱 + 브래킷
    b.add(shockMat, cylX(0.03, pivot.x - 0.035, pivot.x + 0.035, 24, 0.004).translate(0, pivot.y, pivot.z));
    const br = rbox(0.06, 0.04, 0.05, 0.006);
    br.translate(pivot.x, railLocalY - 0.012, pivot.z);
    b.add(armMat, br);
    // 허브 캐리어 + 스핀들
    const carrier = rbox(0.04, 0.09, 0.09, 0.012);
    carrier.translate(s * 0.6, 0, 0);
    b.add(armMat, carrier);
    const x0 = s * 0.6;
    const x1 = s * halfLen;
    b.add(spindleMat, cylX(0.022, Math.min(x0, x1), Math.max(x0, x1), 24, 0.003));
    // 스프링 + 쇼크
    springAndShock(b, springMat, shockMat, spindleMat, new THREE.Vector3(s * (CAR.railX - 0.02), 0.03, -0.1), new THREE.Vector3(s * (CAR.railX - 0.02), railLocalY, -0.1));
  }
  b.flush(g);
  return g;
}

/**
 * 비구동 빔 차축(FR 앞 차축 등). 원점 = 차축 중심. 가운데가 낮은 드롭 빔 + 킹핀 너클 + 스핀들 + 타이로드 + 스프링.
 */
export function buildBeamAxle(halfLen = CAR.hubInnerX + 0.01): THREE.Group {
  const g = new THREE.Group();
  g.name = 'beamAxle';
  const beamMat = paint(0x2e3238, { roughness: 0.5, metalness: 0.35 });
  const knuckleMat = castIron({ color: 0x4a5058 });
  const spindleMat = steel({ roughness: 0.3 });
  const springMat = paint(0xb8452f, { roughness: 0.4 });
  const shockMat = darkSteel({ color: 0x3d434a });
  const b = new MeshBatch();
  const railLocalY = CAR.railY - CAR.axleY - 0.036;
  // 드롭 빔(가운데가 엔진 오일팬 아래로 내려감)
  b.add(
    beamMat,
    tubeThrough(
      [
        new THREE.Vector3(-0.585, 0, 0),
        new THREE.Vector3(-0.42, 0, 0),
        new THREE.Vector3(-0.24, -0.035, 0),
        new THREE.Vector3(0.24, -0.035, 0),
        new THREE.Vector3(0.42, 0, 0),
        new THREE.Vector3(0.585, 0, 0)
      ],
      0.026,
      64,
      16
    )
  );
  for (const s of [-1, 1]) {
    // 킹핀 보스 + 너클
    const boss = new THREE.CylinderGeometry(0.03, 0.03, 0.08, 20);
    boss.translate(s * 0.585, 0, 0);
    b.add(beamMat, boss);
    const kn = rbox(0.035, 0.11, 0.06, 0.01);
    kn.translate(s * 0.615, 0, 0);
    b.add(knuckleMat, kn);
    const x0 = s * 0.62;
    const x1 = s * halfLen;
    b.add(spindleMat, cylX(0.02, Math.min(x0, x1), Math.max(x0, x1), 24, 0.003));
    // 조향 암(뒤쪽)
    b.add(knuckleMat, barBetween(new THREE.Vector3(s * 0.61, -0.03, 0.02), new THREE.Vector3(s * 0.55, -0.03, 0.11), 0.022, 0.018, 0.006));
    // 스프링 + 쇼크
    springAndShock(b, springMat, shockMat, spindleMat, new THREE.Vector3(s * (CAR.railX - 0.02), 0.026, 0), new THREE.Vector3(s * (CAR.railX - 0.02), railLocalY, 0));
  }
  // 타이로드
  b.add(spindleMat, rodBetween(new THREE.Vector3(-0.55, -0.03, 0.11), new THREE.Vector3(0.55, -0.03, 0.11), 0.009, 12));
  for (const s of [-1, 1]) {
    const end = new THREE.SphereGeometry(0.014, 14, 10);
    end.translate(s * 0.55, -0.03, 0.11);
    b.add(knuckleMat, end);
  }
  b.flush(g);
  return g;
}

// ─────────────────────────── 바퀴 지지부(스트럿 코너) ───────────────────────────

/**
 * 고정부 맥퍼슨 스트럿 코너: 너클(허브 링) + 로어 A암(프레임 레일까지) + 코일오버 스트럿.
 * root 좌표 그대로. side=±1(바퀴 x 부호), z=차축선 z. 바퀴·반축과 함께 쓰면 바퀴가 떠 보이지 않는다.
 */
export function buildStrutCorner(side: 1 | -1, z: number): THREE.Group {
  const g = new THREE.Group();
  g.name = 'strutCorner';
  const s = side;
  const knMat = castIron({ color: 0x555c64 });
  const armMat = paint(0x2e3238, { roughness: 0.5, metalness: 0.35 });
  const springMat = paint(0xb8452f, { roughness: 0.4 });
  const shockMat = darkSteel({ color: 0x3d434a });
  const rodMat = chrome();
  const b = new MeshBatch();
  const y = CAR.axleY;
  // 허브 링(반축 스텁이 지나감)
  const ring = latheX(
    [
      [0.02, 0],
      [0.05, 0],
      [0.05, 0.013],
      [0.02, 0.013],
      [0.02, 0]
    ],
    28
  );
  ring.translate(s > 0 ? 0.655 : -0.668, y, z);
  b.add(knMat, ring);
  // 너클 위·아래 팔
  const kTop = new THREE.Vector3(s * 0.635, y + 0.16, z);
  const kBot = new THREE.Vector3(s * 0.645, y - 0.09, z);
  b.add(knMat, barBetween(new THREE.Vector3(s * 0.655, y + 0.045, z), kTop, 0.026, 0.04, 0.008));
  b.add(knMat, barBetween(new THREE.Vector3(s * 0.655, y - 0.045, z), kBot, 0.026, 0.04, 0.008));
  // 로어 A암 + 볼조인트
  const ball = new THREE.SphereGeometry(0.016, 14, 10);
  ball.translate(kBot.x, kBot.y, kBot.z);
  b.add(knMat, ball);
  const inA = new THREE.Vector3(s * (CAR.railX - 0.01), y - 0.07, z - 0.14);
  const inB = new THREE.Vector3(s * (CAR.railX - 0.01), y - 0.07, z + 0.1);
  b.add(armMat, barBetween(kBot, inA, 0.028, 0.02, 0.006), barBetween(kBot, inB, 0.028, 0.02, 0.006));
  for (const p of [inA, inB]) {
    b.add(shockMat, cylX(0.018, p.x - 0.025, p.x + 0.025, 16, 0.003).translate(0, p.y, p.z));
    // 레일까지 브래킷
    b.add(armMat, barBetween(p, new THREE.Vector3(p.x, CAR.railY - 0.03, p.z), 0.03, 0.03, 0.006));
  }
  // 코일오버 스트럿(살짝 안쪽으로 기울어짐) + 상단 마운트
  const sTop = new THREE.Vector3(s * 0.57, 0.56, z + 0.02);
  const dir = sTop.clone().sub(kTop);
  const len = dir.length();
  const strut = new THREE.Group();
  const sb = new MeshBatch();
  const body = new THREE.CylinderGeometry(0.02, 0.02, len * 0.55, 18);
  body.translate(0, len * 0.275, 0);
  sb.add(shockMat, body);
  const rod = new THREE.CylinderGeometry(0.008, 0.008, len * 0.5, 12);
  rod.translate(0, len * 0.75, 0);
  sb.add(rodMat, rod);
  const sp = coilSpring(0.038, len * 0.5, 5, 0.0065);
  sp.translate(0, len * 0.45, 0);
  sb.add(springMat, sp);
  for (const yy of [len * 0.45, len * 0.95]) {
    const seat = new THREE.CylinderGeometry(0.047, 0.047, 0.007, 24);
    seat.translate(0, yy, 0);
    sb.add(shockMat, seat);
  }
  sb.flush(strut);
  strut.position.copy(kTop);
  strut.quaternion.setFromUnitVectors(Y_AXIS, dir.normalize());
  g.add(strut);
  b.flush(g);
  return g;
}

// ─────────────────────────── 엔진 (직렬 4기통) ───────────────────────────

export interface EngineOpts {
  /** 크랭크축 방향 길이 */
  length: number;
  /** 흡·배기 매니폴드 포함 폭 */
  width: number;
  height: number;
  /** 앞(-X) 끝에서 바깥으로 뻗는 마운트 브래킷 길이(가로 배치 FF) */
  mountX?: number;
  /** 양옆(±Z)으로 프레임 레일까지 뻗는 마운트 |z| 끝(세로 배치 FR·AWD) */
  mountZ?: number;
}

/** 볼록 껍질(모노톤 체인) — 벨트가 감기는 풀리들의 바깥 경로 */
function convexHull(pts: V2[]): V2[] {
  const p = [...pts].sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]));
  const cross = (o: V2, a: V2, b: V2): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: V2[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: V2[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, q) <= 0) upper.pop();
    upper.push(q);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

/** V홈 풀리(X축), x 중심 cx */
function pulley(r: number, cx: number, w = 0.022): THREE.BufferGeometry {
  const h = w / 2;
  return latheX(
    [
      [0, cx - h],
      [r, cx - h],
      [r, cx - h * 0.6],
      [r - 0.006, cx - h * 0.3],
      [r - 0.006, cx + h * 0.3],
      [r, cx + h * 0.6],
      [r, cx + h],
      [r * 0.45, cx + h],
      [r * 0.4, cx + h + 0.006],
      [0, cx + h + 0.006]
    ],
    40
  );
}

/** 닫힌 평면 경로(XY) 스윕 — 경로 바깥쪽으로 두께, 단면 b는 +Z */
function sweepPlanarClosed(path: V2[], profile: V2[]): THREE.BufferGeometry {
  const n = path.length;
  const pos: number[] = [];
  const np = profile.length;
  for (let i = 0; i < n; i++) {
    const p = path[i]!;
    const prev = path[(i - 1 + n) % n]!;
    const next = path[(i + 1) % n]!;
    const tx = next[0] - prev[0];
    const ty = next[1] - prev[1];
    const l = Math.hypot(tx, ty) || 1;
    const nx = ty / l; // 반시계 경로의 오른쪽 = 바깥
    const ny = -tx / l;
    for (const [a, bb] of profile) pos.push(p[0] + nx * a, p[1] + ny * a, bb);
  }
  const idx: number[] = [];
  for (let i = 0; i < n; i++) {
    const i1 = (i + 1) % n;
    for (let m = 0; m < np; m++) {
      const m1 = (m + 1) % np;
      idx.push(i * np + m, i1 * np + m, i1 * np + m1, i * np + m, i1 * np + m1, i * np + m1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * 직렬 4기통 엔진. 정규 좌표: 크랭크축 = 로컬 X, 앞(풀리·벨트) = -X, 플라이휠 쪽 = +X,
 * 흡기 = -Z 쪽, 배기 = +Z 쪽, 원점 = 외곽 상자 중심. 크랭크축 높이 = -height/2 + 0.12·(height/0.38).
 * 세로 배치(FR·AWD)는 rotation.y = -π/2 로 돌리면 플라이휠 쪽이 +Z(뒤)를 향한다.
 */
export function buildInline4Engine(o: EngineOpts): THREE.Group {
  const g = new THREE.Group();
  g.name = 'engine';
  const L = o.length;
  const W = o.width;
  const H = o.height;
  const s = H / 0.38;
  const yb = -H / 2;
  const bw = Math.min(0.21, W * 0.55);
  const x0 = -L / 2 + 0.04;
  const x1 = L / 2 - 0.03;
  const bl = x1 - x0;
  const cylPos = (i: number): number => x0 + bl * 0.1 + (bl * 0.8 * (i + 0.5)) / 4;

  const blockMat = castIron({ color: 0x5d636b });
  const headMat = aluminum({ color: 0xbfc5cc, roughness: 0.4 });
  const coverMat = paint(0x2f5f9e, { roughness: 0.38, metalness: 0.4 });
  const blackMat = plastic(0x202328, { roughness: 0.45 });
  const intakeMat = plastic(0x34383e, { roughness: 0.5 });
  const exhMat = darkSteel({ color: 0x84705e, roughness: 0.5 });
  const pulleyMat = steel({ roughness: 0.32 });
  const beltMat = rubber({ roughness: 0.8 });
  beltMat.side = THREE.DoubleSide;
  const filterMat = paint(0x2563b0, { roughness: 0.35 });
  const yellowMat = plastic(0xf2b619, { roughness: 0.4 });
  const panMat = aluminum({ color: 0x8d949c, roughness: 0.5 });
  const b = new MeshBatch();

  // 오일팬(뒤쪽이 깊은 섬프)
  const panTop = yb + 0.08 * s;
  const pan1 = rbox(bl * 0.92, 0.05 * s, 0.17, 0.014);
  pan1.translate((x0 + x1) / 2, panTop - 0.025 * s, 0);
  const pan2 = rbox(bl * 0.4, 0.08 * s, 0.15, 0.018);
  pan2.translate(x1 - bl * 0.26, yb + 0.04 * s, 0);
  b.add(panMat, pan1, pan2);
  // 블록 + 실린더 사이 리브
  const blockH = 0.17 * s;
  const blk = rbox(bl, blockH, bw, 0.016);
  blk.translate((x0 + x1) / 2, yb + 0.07 * s + blockH / 2, 0);
  b.add(blockMat, blk);
  for (let i = 0; i <= 4; i++) {
    const xr = x0 + bl * 0.1 + (bl * 0.8 * i) / 4;
    for (const sz of [-1, 1]) {
      const rib = rbox(0.012, blockH * 0.8, 0.012, 0.004);
      rib.translate(xr, yb + 0.07 * s + blockH * 0.45, sz * (bw / 2 + 0.004));
      b.add(blockMat, rib);
    }
  }
  // 플라이휠 쪽 플랜지(벨 하우징 결합면)
  const crankY = yb + 0.12 * s;
  b.add(blockMat, latheX(rodProfile(Math.min(0.13, H * 0.36), x1 - 0.004, x1 + 0.026, 0.004, 0.004), 40).translate(0, crankY, 0));
  // 실린더 헤드
  const headH = 0.06 * s;
  const head = rbox(bl - 0.004, headH, bw + 0.012, 0.012);
  head.translate((x0 + x1) / 2, yb + 0.24 * s + headH / 2, 0);
  b.add(headMat, head);
  // 헤드 커버(밸브 커버)
  const coverH = 0.05 * s;
  const cover = rbox(bl - 0.04, coverH, bw - 0.03, 0.02, 3);
  const coverY = yb + 0.3 * s + coverH / 2;
  cover.translate((x0 + x1) / 2, coverY, 0);
  b.add(coverMat, cover);
  // 점화 코일 4개 + 커넥터 + 배선 레일
  for (let i = 0; i < 4; i++) {
    const cx = cylPos(i);
    const coil = new THREE.CylinderGeometry(0.019, 0.019, 0.03, 20);
    coil.translate(cx, coverY + coverH / 2 + 0.012, 0);
    const top = rbox(0.05, 0.018, 0.042, 0.006);
    top.translate(cx, coverY + coverH / 2 + 0.034, -0.006);
    const conn = rbox(0.02, 0.016, 0.02, 0.004);
    conn.translate(cx, coverY + coverH / 2 + 0.036, -0.034);
    b.add(blackMat, coil, top, conn);
  }
  b.add(blackMat, rodBetween(new THREE.Vector3(cylPos(0) - 0.03, coverY + coverH / 2 + 0.036, -0.045), new THREE.Vector3(cylPos(3) + 0.03, coverY + coverH / 2 + 0.036, -0.045), 0.006, 10));
  // 오일 주입구 캡
  const cap = new THREE.CylinderGeometry(0.016, 0.016, 0.012, 20);
  cap.translate(x0 + bl * 0.12, coverY + coverH / 2 + 0.006, 0.04);
  b.add(yellowMat, cap);

  // 흡기 매니폴드: 서지 탱크(-Z) + 러너 4개 + 스로틀 바디
  const zPl = -(W / 2 - 0.04);
  const yPl = yb + 0.215 * s;
  const plenum = latheX(
    [
      [0, x0 + 0.06],
      [0.022, x0 + 0.062],
      [0.036, x0 + 0.075],
      [0.038, x0 + 0.09],
      [0.038, x1 - 0.05],
      [0.03, x1 - 0.035],
      [0, x1 - 0.03]
    ],
    32
  );
  plenum.translate(0, yPl, zPl);
  b.add(intakeMat, plenum);
  const headSideY = yb + 0.27 * s;
  for (let i = 0; i < 4; i++) {
    const cx = cylPos(i);
    b.add(
      intakeMat,
      tubeThrough(
        [
          new THREE.Vector3(cx, headSideY, -bw / 2 + 0.01),
          new THREE.Vector3(cx, headSideY + 0.02 * s, -bw / 2 - 0.035),
          new THREE.Vector3(cx, yPl + 0.05 * s, zPl + 0.025),
          new THREE.Vector3(cx, yPl + 0.01, zPl + 0.005)
        ],
        0.016,
        20,
        12
      )
    );
  }
  const tb = cylX(0.03, x0 + 0.02, x0 + 0.065, 28, 0.003);
  tb.translate(0, yPl, zPl);
  b.add(headMat, tb);

  // 배기 매니폴드(+Z): 4-1 집합관 + 다운파이프
  const xc = L * 0.15;
  const zEx = bw / 2 + 0.05;
  for (let i = 0; i < 4; i++) {
    const cx = cylPos(i);
    b.add(
      exhMat,
      tubeThrough(
        [
          new THREE.Vector3(cx, headSideY - 0.005, bw / 2),
          new THREE.Vector3(cx, headSideY - 0.015 * s, bw / 2 + 0.04),
          new THREE.Vector3(cx * 0.55 + xc * 0.45, yb + 0.17 * s, zEx + 0.008),
          new THREE.Vector3(xc, yb + 0.12 * s, zEx)
        ],
        0.014,
        20,
        10
      )
    );
  }
  const coll = new THREE.SphereGeometry(0.03, 18, 12);
  coll.translate(xc, yb + 0.12 * s, zEx);
  b.add(exhMat, coll);
  b.add(
    exhMat,
    tubeThrough(
      [new THREE.Vector3(xc, yb + 0.12 * s, zEx), new THREE.Vector3(xc + 0.05, yb + 0.04 * s, zEx - 0.005), new THREE.Vector3(L / 2 - 0.005, yb + 0.01, zEx - 0.02)],
      0.022,
      16,
      12
    )
  );

  // 앞쪽(-X): 타이밍 커버 + 풀리 + 벨트 + 에어컨 컴프레서
  const tcX = -L / 2 + 0.028;
  const tc = rbox(0.024, 0.23 * s, bw * 0.86, 0.01);
  tc.translate(tcX, yb + 0.07 * s + 0.115 * s, 0);
  b.add(blackMat, tc);
  const px = -L / 2 + 0.012;
  const pulleys: { y: number; z: number; r: number }[] = [
    { y: crankY, z: 0, r: 0.048 },
    { y: yb + 0.25 * s, z: 0.03, r: 0.032 },
    { y: yb + 0.1 * s, z: -(bw / 2 + 0.035), r: 0.03 },
    { y: yb + 0.19 * s, z: bw / 2 - 0.02, r: 0.02 }
  ];
  for (const p of pulleys) b.add(pulleyMat, pulley(p.r, px).translate(0, p.y, p.z));
  const ac = pulleys[2]!;
  const acBody = latheX(rodProfile(0.036, px + 0.014, px + 0.11, 0.008, 0.008), 28);
  acBody.translate(0, ac.y, ac.z);
  b.add(headMat, acBody);
  // 벨트: 풀리 원 둘레 점들의 볼록 껍질 = 바깥에 감긴 벨트 경로
  const hullPts: V2[] = [];
  for (const p of pulleys) {
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * TAU;
      hullPts.push([p.z + Math.cos(a) * (p.r + 0.001), p.y + Math.sin(a) * (p.r + 0.001)]);
    }
  }
  const hull = convexHull(hullPts);
  // 경로 (u, v) = (z, y) → rotateY(-π/2): (u, v, b) → (-b, v, u)
  const beltGeo = sweepPlanarClosed(hull, [
    [0, -0.008],
    [0.006, -0.008],
    [0.006, 0.008],
    [0, 0.008]
  ]);
  beltGeo.rotateY(-Math.PI / 2);
  beltGeo.translate(px, 0, 0);
  b.add(beltMat, beltGeo);

  // 오일 필터(-Z 아래쪽, 바깥을 향함)
  const of = latheZ(rodProfile(0.03, 0, 0.065, 0.006, 0.01), 32);
  of.rotateY(Math.PI); // +Z → -Z
  of.translate(x1 - bl * 0.32, yb + 0.12 * s, -bw / 2 + 0.002);
  b.add(filterMat, of);
  // 오일 게이지(딥스틱) 노란 고리
  const dsx = (cylPos(1) + cylPos(2)) / 2;
  b.add(blackMat, rodBetween(new THREE.Vector3(dsx, yb + 0.14 * s, -bw / 2 - 0.004), new THREE.Vector3(dsx, yb + 0.34 * s, -bw / 2 - 0.022), 0.004, 8));
  const ring = new THREE.TorusGeometry(0.012, 0.004, 8, 20);
  ring.translate(dsx, yb + 0.34 * s + 0.012, -bw / 2 - 0.022);
  b.add(yellowMat, ring);

  // 엔진 마운트
  const mountMat = darkSteel({ color: 0x3d434a });
  if (o.mountX) {
    const a = new THREE.Vector3(-L / 2 + 0.03, yb + 0.2 * s, bw / 2 - 0.02);
    const c = new THREE.Vector3(-L / 2 - o.mountX, yb + 0.2 * s - 0.02, bw / 2 - 0.02);
    b.add(mountMat, barBetween(a, c, 0.04, 0.04, 0.008));
    const bush = new THREE.CylinderGeometry(0.026, 0.026, 0.03, 18);
    bush.translate(c.x + 0.012, c.y - 0.02, c.z);
    b.add(beltMat, bush);
  }
  if (o.mountZ) {
    for (const sz of [-1, 1]) {
      const a = new THREE.Vector3(x0 + bl * 0.28, yb + 0.12 * s, sz * (bw / 2));
      const c = new THREE.Vector3(x0 + bl * 0.28, yb + 0.12 * s, sz * o.mountZ);
      b.add(mountMat, barBetween(a, c, 0.035, 0.04, 0.008));
      const bush = new THREE.CylinderGeometry(0.024, 0.024, 0.03, 18).rotateX(Math.PI / 2);
      bush.translate(c.x, c.y, sz * (o.mountZ - 0.03));
      b.add(beltMat, bush);
    }
  }
  b.flush(g);
  return g;
}

// ─────────────────────────── 변속기 ───────────────────────────

export interface TransmissionOpts {
  /** 입력(벨 하우징 큰 끝) → 출력 플랜지 길이 */
  length: number;
  /** 벨 하우징 큰 끝 반지름 */
  bellR: number;
  /** 입력 쪽 중심을 출력축보다 위로 올리는 양(엔진 크랭크 높이에 맞춤) */
  inputRise?: number;
  /** 출력 플랜지 생략(트랜스퍼 케이스가 뒤에 붙는 AWD) */
  noOutputFlange?: boolean;
}

/**
 * 세로 배치 수동 변속기: 벨 하우징(원뿔대, 플랜지 볼트) + 리브 기어 케이스 + 시프트 타워 + 테일 하우징 + 출력 플랜지.
 * 정규 좌표: 입력 x=0 → 출력 x=length (로컬 +X), 출력축 중심 = 로컬 원점 높이. FR 배치는 rotation.y = -π/2.
 */
export function buildTransmission(o: TransmissionOpts): THREE.Group {
  const g = new THREE.Group();
  g.name = 'transmission';
  const L = o.length;
  const R = o.bellR;
  const rise = o.inputRise ?? 0;
  const caseMat = aluminum({ color: 0xc9ced4, roughness: 0.42 });
  const darkMat = darkSteel({ color: 0x4a525b });
  const b = new MeshBatch();
  const bellLen = L * 0.36;
  const bell = latheX(
    [
      [0, 0],
      [R, 0],
      [R, 0.012],
      [R - 0.008, 0.018],
      [R * 0.7, bellLen],
      [0, bellLen]
    ],
    48,
    30
  );
  // 입력 쪽을 위로 기울여(전단) 엔진 크랭크 높이에 맞춘다
  const pa = bell.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pa.count; i++) {
    const x = pa.getX(i);
    pa.setY(i, pa.getY(i) + rise * (1 - Math.min(1, x / bellLen)));
  }
  pa.needsUpdate = true;
  b.add(caseMat, bell);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU;
    const bolt = new THREE.CylinderGeometry(0.007, 0.007, 0.014, 6).rotateZ(Math.PI / 2);
    bolt.translate(0.018, rise + Math.cos(a) * (R - 0.006), Math.sin(a) * (R - 0.006));
    b.add(darkMat, bolt);
  }
  // 기어 케이스 + 세로 리브
  const c0 = bellLen - 0.005;
  const c1 = L * 0.78;
  const caseH = R * 1.25;
  const caseW = R * 1.15;
  const box = rbox(c1 - c0, caseH, caseW, 0.03, 3);
  box.translate((c0 + c1) / 2, -0.005, 0);
  b.add(caseMat, box);
  for (let i = 1; i <= 3; i++) {
    const xr = c0 + ((c1 - c0) * i) / 4;
    const rib = rbox(0.01, caseH + 0.012, caseW + 0.012, 0.004);
    rib.translate(xr, -0.005, 0);
    b.add(caseMat, rib);
  }
  // 시프트 타워 + 레버 밑동
  const tower = rbox(0.06, 0.05, 0.05, 0.01);
  tower.translate(c0 + (c1 - c0) * 0.65, caseH / 2 + 0.02, 0);
  b.add(caseMat, tower);
  b.add(darkMat, rodBetween(new THREE.Vector3(c0 + (c1 - c0) * 0.65, caseH / 2 + 0.04, 0), new THREE.Vector3(c0 + (c1 - c0) * 0.6, caseH / 2 + 0.1, 0), 0.008, 12));
  // 테일 하우징 + 출력 플랜지
  b.add(
    caseMat,
    latheX(
      [
        [0, c1 - 0.01],
        [R * 0.45, c1 - 0.01],
        [R * 0.36, L - 0.03],
        [0.03, L - 0.018],
        [0, L - 0.018]
      ],
      36
    )
  );
  if (!o.noOutputFlange) b.add(darkMat, latheX(rodProfile(0.036, L - 0.02, L, 0.003, 0.003), 32));
  b.flush(g);
  return g;
}

/**
 * FF 가로 배치 트랜스액슬 — root 좌표 그대로(엔진이 -X 쪽에 붙음).
 * 벨 하우징(엔진 크랭크 높이) + 리브 기어 케이스 + 아래 디퍼렌셜 하우징(반투명 — 정답 차동기어가 안에 보임) + 양쪽 출력 씰.
 * crankY/crankZ: 엔진 크랭크축 높이·z, diffZ: 앞 차축선 z.
 */
export function buildFFTransaxle(crankY: number, crankZ: number, diffZ: number): THREE.Group {
  const g = new THREE.Group();
  g.name = 'transaxle';
  const caseMat = aluminum({ color: 0xc9ced4, roughness: 0.42 });
  const darkMat = darkSteel({ color: 0x4a525b });
  const b = new MeshBatch();
  const x0 = -0.03;
  // 벨 하우징: 엔진 쪽(-X) 큰 끝
  b.add(
    caseMat,
    latheX(
      [
        [0, x0],
        [0.14, x0],
        [0.14, x0 + 0.012],
        [0.132, x0 + 0.018],
        [0.1, x0 + 0.09],
        [0, x0 + 0.09]
      ],
      48,
      30
    ).translate(0, crankY, crankZ)
  );
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU;
    const bolt = new THREE.CylinderGeometry(0.007, 0.007, 0.014, 6).rotateZ(Math.PI / 2);
    bolt.translate(x0 + 0.018, crankY + Math.cos(a) * 0.134, crankZ + Math.sin(a) * 0.134);
    b.add(darkMat, bolt);
  }
  // 기어 케이스(축 2개를 품는 둥근 상자) + 리브
  const gcY = crankY + 0.03;
  const gcZ = (crankZ + diffZ) / 2 + 0.03;
  const gc = rbox(0.19, 0.24, 0.27, 0.05, 3);
  gc.translate(x0 + 0.155, gcY, gcZ);
  b.add(caseMat, gc);
  for (let i = 0; i < 3; i++) {
    const rib = rbox(0.01, 0.25, 0.28, 0.004);
    rib.translate(x0 + 0.1 + i * 0.05, gcY, gcZ);
    b.add(caseMat, rib);
  }
  // 엔드 커버 + 시프트 케이블 브래킷
  b.add(caseMat, latheX(rodProfile(0.08, x0 + 0.245, x0 + 0.275, 0.01, 0.015), 36).translate(0, gcY + 0.03, crankZ + 0.03));
  const shift = rbox(0.05, 0.04, 0.05, 0.008);
  shift.translate(x0 + 0.17, gcY + 0.13, crankZ);
  b.add(darkMat, shift);
  // 출력 씰 플랜지(양쪽)
  b.add(darkMat, cylX(0.05, x0 - 0.012, x0 + 0.002, 32, 0.003).translate(0, CAR.axleY, diffZ));
  b.add(darkMat, cylX(0.05, x0 + 0.256, x0 + 0.27, 32, 0.003).translate(0, CAR.axleY, diffZ));
  b.flush(g);
  // 디퍼렌셜 하우징(반투명) — 링 기어가 들어가는 불룩한 부분
  const dh = latheX(
    [
      [0.046, x0 - 0.0],
      [0.07, x0 + 0.012],
      [0.112, x0 + 0.05],
      [0.112, x0 + 0.1],
      [0.08, x0 + 0.16],
      [0.06, x0 + 0.2],
      [0.05, x0 + 0.258]
    ],
    48,
    50
  );
  dh.translate(0, CAR.axleY, diffZ);
  const diffGhost = ghost(0xc9d4de, 0.32);
  diffGhost.side = THREE.DoubleSide;
  const dm = new THREE.Mesh(dh, diffGhost);
  dm.userData.noAO = true;
  g.add(dm);
  return g;
}

/** 베벨 링 기어 + 디퍼렌셜 케이스 — 로컬 X축, 링 기어 면 x=0 */
function addRingGearCarrier(b: MeshBatch, gearMat: THREE.Material, caseMat: THREE.Material, ringR: number, teeth = 36): void {
  b.add(
    gearMat,
    latheX(
      [
        [ringR * 0.55, -0.012],
        [ringR * 0.96, -0.012],
        [ringR, 0.0],
        [ringR * 0.86, 0.016],
        [ringR * 0.55, 0.016],
        [ringR * 0.55, -0.012]
      ],
      64
    )
  );
  // 이(경사면 위 작은 블록)
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * TAU;
    const t = rbox(0.012, ringR * 0.2, 0.006, 0.002);
    t.rotateZ(-0.6);
    t.translate(0.006, ringR * 0.9, 0);
    t.rotateX(a);
    b.add(gearMat, t);
  }
  // 케이스: 링 기어 안쪽 → 양쪽 사이드 기어 보스
  b.add(
    caseMat,
    latheX(
      [
        [0, -0.06],
        [0.024, -0.06],
        [0.03, -0.04],
        [ringR * 0.6, -0.01],
        [ringR * 0.6, 0.02],
        [0.032, 0.05],
        [0.024, 0.07],
        [0, 0.07]
      ],
      40
    )
  );
}

/**
 * 뒤 디퍼렌셜(호박형 캐리어 + 커버 볼트 + 피니언 노즈). root 좌표 그대로.
 * 중심 = (0, axleY, axleZ), 피니언(프로펠러 샤프트 입력) 플랜지 면은 -Z(앞)쪽 z = noseZ.
 * tubes=true면 반투명 차축 하우징(양쪽 관)과 스프링·쇼크·트레일링 링크까지 붙인 일체형(FR 리지드 액슬),
 * false면 독립현가용 마운트(프레임 크로스멤버) — AWD.
 */
export function buildRearDiff(axleZ: number, noseZ: number, tubes: boolean): THREE.Group {
  const g = new THREE.Group();
  g.name = 'rearDiff';
  const y = CAR.axleY;
  const caseMat = castIron({ color: 0x50575f });
  const coverMat = aluminum({ color: 0xb4bbc3, roughness: 0.45 });
  const darkMat = darkSteel({ color: 0x3d434a });
  const b = new MeshBatch();
  const bowlZ = axleZ;
  b.add(
    caseMat,
    latheZ(
      [
        [0, noseZ],
        [0.03, noseZ],
        [0.034, noseZ + 0.012],
        [0.04, noseZ + 0.04],
        [0.07, bowlZ - 0.09],
        [0.105, bowlZ - 0.05],
        [0.112, bowlZ - 0.0],
        [0.11, bowlZ + 0.06],
        [0.118, bowlZ + 0.062],
        [0.118, bowlZ + 0.074],
        [0, bowlZ + 0.074]
      ],
      48,
      40
    ).translate(0, y, 0)
  );
  // 피니언 컴패니언 플랜지
  b.add(darkMat, latheZ(rodProfile(0.04, noseZ - 0.006, noseZ + 0.006, 0.002, 0.002), 32).translate(0, y, 0));
  // 커버(볼록) + 리브
  b.add(
    coverMat,
    latheZ(
      [
        [0, bowlZ + 0.074],
        [0.116, bowlZ + 0.074],
        [0.112, bowlZ + 0.084],
        [0.09, bowlZ + 0.105],
        [0.05, bowlZ + 0.118],
        [0, bowlZ + 0.122]
      ],
      48,
      40
    ).translate(0, y, 0)
  );
  for (let i = -2; i <= 2; i++) {
    const rib = rbox(0.008, 0.16 - Math.abs(i) * 0.03, 0.03, 0.003);
    rib.translate(i * 0.035, y, bowlZ + 0.104 - Math.abs(i) * 0.006);
    b.add(coverMat, rib);
  }
  // 커버 볼트 10개
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU;
    const bolt = new THREE.CylinderGeometry(0.0065, 0.0065, 0.012, 6).rotateX(Math.PI / 2);
    bolt.translate(Math.cos(a) * 0.104, y + Math.sin(a) * 0.104, bowlZ + 0.082);
    b.add(darkMat, bolt);
  }
  // 사이드 베어링 보스(반축이 나가는 곳)
  b.add(caseMat, cylX(0.058, -0.13, 0.13, 36, 0.01).translate(0, y, axleZ));
  b.flush(g);

  const sb = new MeshBatch();
  if (tubes) {
    // 반투명 차축 하우징 관(끝단 백플레이트 플랜지)
    const tubeGeo = merge([
      latheX(
        [
          [0.05, -0.6],
          [0.05, -0.585],
          [0.036, -0.575],
          [0.036, -0.16],
          [0.05, -0.13],
          [0.05, -0.125]
        ],
        36,
        40
      ),
      latheX(
        [
          [0.05, 0.125],
          [0.05, 0.13],
          [0.036, 0.16],
          [0.036, 0.575],
          [0.05, 0.585],
          [0.05, 0.6]
        ],
        36,
        40
      )
    ]);
    tubeGeo.translate(0, y, axleZ);
    const tm = ghost(0x9fb4c8, 0.4);
    tm.side = THREE.DoubleSide;
    const tube = new THREE.Mesh(tubeGeo, tm);
    tube.userData.noAO = true;
    g.add(tube);
    const springMat = paint(0xb8452f, { roughness: 0.4 });
    const rodMat = chrome();
    for (const s of [-1, 1]) {
      const base = new THREE.Vector3(s * (CAR.railX - 0.02), y + 0.036, axleZ);
      const seat = rbox(0.07, 0.014, 0.07, 0.004);
      seat.translate(base.x, base.y + 0.004, base.z);
      sb.add(darkMat, seat);
      springAndShock(sb, springMat, darkMat, rodMat, base.clone().setY(base.y + 0.011), new THREE.Vector3(base.x, CAR.railY - 0.036, axleZ));
      // 트레일링 링크(관 아래 → 프레임 앞쪽)
      sb.add(darkMat, barBetween(new THREE.Vector3(s * 0.4, y - 0.04, axleZ), new THREE.Vector3(s * (CAR.railX - 0.01), CAR.railY - 0.05, axleZ - 0.32), 0.026, 0.02, 0.006));
    }
  } else {
    // 독립현가용 마운트(프레임 크로스멤버까지)
    for (const s of [-1, 1]) {
      sb.add(darkMat, barBetween(new THREE.Vector3(s * 0.07, y + 0.09, axleZ - 0.02), new THREE.Vector3(s * 0.2, CAR.railY - 0.01, axleZ + 0.1), 0.03, 0.03, 0.008));
    }
    sb.add(darkMat, alignY(rbox(0.05, 2 * CAR.railX, 0.05, 0.012), new THREE.Vector3(-CAR.railX, CAR.railY - 0.01, axleZ + 0.1), new THREE.Vector3(CAR.railX, CAR.railY - 0.01, axleZ + 0.1)));
  }
  sb.flush(g);
  return g;
}

/**
 * AWD 센터 디퍼렌셜(트랜스퍼 케이스) — root 좌표 그대로. 변속기 뒤에 붙는 리브 케이스 + 뒤 출력 플랜지 +
 * 오른쪽(+X) 아래로 앞바퀴용 체인 케이스와 앞 출력 플랜지(-Z 방향).
 * z0: 앞면(변속기 결합), z1: 뒤 출력 플랜지 면, y: 축 높이, frontOut: 앞 출력 플랜지 면 중심.
 */
export function buildTransferCase(z0: number, z1: number, y: number, frontOut: THREE.Vector3): THREE.Group {
  const g = new THREE.Group();
  g.name = 'transferCase';
  const caseMat = aluminum({ color: 0xc2c8cf, roughness: 0.45 });
  const accentMat = paint(0xd9b52e, { roughness: 0.4, metalness: 0.3 });
  const darkMat = darkSteel({ color: 0x4a525b });
  const b = new MeshBatch();
  const len = z1 - z0;
  b.add(
    caseMat,
    latheZ(
      [
        [0, z0],
        [0.1, z0],
        [0.11, z0 + 0.03],
        [0.11, z0 + len * 0.55],
        [0.07, z1 - 0.03],
        [0.04, z1 - 0.012],
        [0, z1 - 0.012]
      ],
      48,
      40
    ).translate(0, y, 0)
  );
  for (let i = 1; i <= 2; i++) {
    b.add(caseMat, latheZ(rodProfile(0.116, z0 + len * 0.18 * i, z0 + len * 0.18 * i + 0.01, 0.003, 0.003), 48).translate(0, y, 0));
  }
  // 센터 디퍼렌셜 표시 띠(라벨 색)
  b.add(accentMat, latheZ(rodProfile(0.113, z0 + len * 0.42, z0 + len * 0.5, 0.003, 0.003), 48).translate(0, y, 0));
  // 뒤 출력 플랜지
  b.add(darkMat, latheZ(rodProfile(0.04, z1 - 0.014, z1, 0.003, 0.003), 32).translate(0, y, 0));
  // 체인 케이스(+X, 아래로) → 앞 출력
  const ccz = (z0 + z1) / 2 - 0.02;
  const chainH = 0.1 + (y - frontOut.y);
  const chain = rbox(frontOut.x + 0.06, chainH, 0.07, 0.03, 3);
  chain.translate(frontOut.x / 2, (y + frontOut.y) / 2, ccz);
  b.add(caseMat, chain);
  b.add(
    caseMat,
    latheZ(
      [
        [0, frontOut.z + 0.014],
        [0.03, frontOut.z + 0.014],
        [0.04, ccz - 0.035],
        [0, ccz - 0.035]
      ],
      32
    ).translate(frontOut.x, frontOut.y, 0)
  );
  b.add(darkMat, latheZ(rodProfile(0.036, frontOut.z, frontOut.z + 0.014, 0.003, 0.003), 32).translate(frontOut.x, frontOut.y, 0));
  b.flush(g);
  return g;
}

function gearMetal(): THREE.MeshStandardMaterial {
  return steel({ color: 0xd2b063, roughness: 0.32 });
}

/**
 * 차동기어 + 등속 반축 2개(FF·AWD 앞 구동축 정답) — root 좌표 그대로, 축선 = (y=axleY, z=axleZ)의 X축.
 * ringX: 링 기어 면 x. housing=true면 작은 디퍼렌셜 케이스(주철)+뒤로 향한 피니언 노즈(AWD 앞 디퍼렌셜),
 * false면 링 기어·케이스만(FF — 트랜스액슬의 반투명 하우징 안에 들어간다).
 */
export function buildDiffWithHalfShafts(axleZ: number, ringX: number, housing: boolean): THREE.Group {
  const g = new THREE.Group();
  g.name = 'diffHalfShafts';
  const y = CAR.axleY;
  const carrier = new THREE.Group();
  const cb = new MeshBatch();
  addRingGearCarrier(cb, gearMetal(), castIron({ color: 0x6a7078 }), 0.085);
  cb.flush(carrier);
  carrier.position.set(ringX, y, axleZ);
  g.add(carrier);
  if (housing) {
    const hm = castIron({ color: 0x50575f });
    const b = new MeshBatch();
    b.add(
      hm,
      latheX(
        [
          [0.04, ringX - 0.08],
          [0.06, ringX - 0.07],
          [0.1, ringX - 0.03],
          [0.105, ringX + 0.01],
          [0.1, ringX + 0.04],
          [0.06, ringX + 0.08],
          [0.04, ringX + 0.09]
        ],
        48,
        45
      ).translate(0, y, axleZ)
    );
    b.add(hm, latheZ(rodProfile(0.04, 0.0, 0.11, 0.004, 0.01), 32).translate(ringX + 0.02, y, axleZ));
    b.flush(g);
  }
  const off = housing ? 0.09 : 0.07;
  g.add(buildHalfShaftBetween(new THREE.Vector3(ringX - off, y, axleZ), new THREE.Vector3(-CAR.hubInnerX, y, axleZ)));
  g.add(buildHalfShaftBetween(new THREE.Vector3(ringX + off, y, axleZ), new THREE.Vector3(CAR.hubInnerX, y, axleZ)));
  return g;
}

// ─────────────────────────── 인트로(순차 등장) 도우미 ───────────────────────────

export const INTRO_DROP = 1.1; // 낙하 시작 높이
export const INTRO_DUR = 0.8; // 부품 1개 등장 시간(s)

export interface IntroItem {
  obj: THREE.Object3D;
  /** 인트로 시작 후 대기(s) */
  delay: number;
  /** 최종 position.y */
  baseY: number;
  /** false면 낙하 없이 페이드만(프레임·셸) */
  drop: boolean;
}

function easeOutCubic(k: number): number {
  return 1 - Math.pow(1 - k, 3);
}

/** 인트로 진행: elapsed(인트로 시작 후 s)에서 각 부품의 낙하·페이드를 적용. 모두 끝났으면 true */
export function applyIntro(items: IntroItem[], elapsed: number): boolean {
  let done = true;
  for (const it of items) {
    const e = Math.min(1, Math.max(0, (elapsed - it.delay) / INTRO_DUR));
    const k = easeOutCubic(e);
    it.obj.visible = e > 0;
    it.obj.position.y = it.baseY + (it.drop ? (1 - k) * INTRO_DROP : 0);
    setOpacityFactor(it.obj, e >= 1 ? 1 : k);
    if (e < 1) done = false;
  }
  return done;
}

/** 인트로 즉시 완료(진행도 복원 등) */
export function finishIntroItems(items: IntroItem[]): void {
  for (const it of items) {
    it.obj.visible = true;
    it.obj.position.y = it.baseY;
    setOpacityFactor(it.obj, 1);
  }
}

/** 인트로 처음 상태(숨김) */
export function hideIntroItems(items: IntroItem[]): void {
  for (const it of items) {
    it.obj.visible = false;
    setOpacityFactor(it.obj, 0);
  }
}

/** 그림자 정리: 반투명(ghost/glass) 재질 메시는 그림자를 드리우지 않게 */
export function fixGhostShadows(root: THREE.Object3D): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const ghosty = mats.some((mat) => {
      const fd = (mat.userData as { fade?: FadeData }).fade;
      return fd ? fd.baseTransparent : mat.transparent;
    });
    if (ghosty) m.castShadow = false;
  });
}
