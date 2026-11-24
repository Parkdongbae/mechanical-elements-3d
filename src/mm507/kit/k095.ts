// 95·96·97번 전용 키트 — 경사 원판 캠(095), 하트 캠과 작도판(096), 홈이 파인 하트 캠(097), 롤러 달린 막대·안내 블록
// 치수와 접촉은 shots/_verify/s095.mjs · s096.mjs · s097.mjs 로 잰 값이다(설계표 095~097). 함부로 바꾸지 않는다.
import * as THREE from 'three';
import { brass, bronze, castIron, darkSteel, paint, plastic, steel } from '../../models/materials';
import { circlePath, circlePts, creased, extrude, hexPrism, lathe, mesh, pathFrom, rodProfile, roundedRect, shapeFrom, tubeProfile, TAU, type V2 } from '../../models/parts/geom';
import { setMM } from './mm';

// ───────────────────────── 하트 곡선(등속 캠) 공통 ─────────────────────────

/** φ 를 (−π, π] 로 접는다 */
function wrapPi(a: number): number {
  let x = a % TAU;
  if (x > Math.PI) x -= TAU;
  if (x <= -Math.PI) x += TAU;
  return x;
}

/**
 * 등속 하트 곡선의 반지름: r = r0 + h·|φ|/π (φ = 0 이 오목한 눈, φ = π 가 뾰족한 끝).
 * 캠이 ψ 만큼 돌았을 때 +X 쪽 종동절이 보는 반지름도 같은 식이다(좌우 대칭이라 도는 방향과 무관).
 */
export function heartRadius(phi: number, r0: number, h: number): number {
  return r0 + (h * Math.abs(wrapPi(phi))) / Math.PI;
}

/**
 * 하트 곡선을 d 만큼 평행 이동한 닫힌 윤곽(반시계). d > 0 바깥, d < 0 안쪽, d = 0 은 곡선 그대로.
 * 볼록한 모서리(뾰족한 끝)의 바깥쪽과 오목한 모서리(눈)의 안쪽은 반지름 |d| 의 원호로 메우고,
 * 반대쪽은 대칭축에서 잘라 뾰족하게 만난다 — 반지름 |d| 인 롤러(커터)가 곡선을 따라 지나간 자리와 같다.
 * 로컬 +X 가 눈, −X 가 끝. n = 반쪽의 점 수.
 */
export function heartOffsetOutline(r0: number, h: number, d: number, n = 360): V2[] {
  const k = h / Math.PI;
  const upper: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const phi = (Math.PI * i) / n;
    const r = r0 + k * phi;
    const c = Math.cos(phi);
    const s = Math.sin(phi);
    const tx = k * c - r * s;
    const ty = k * s + r * c;
    const tl = Math.hypot(tx, ty);
    upper.push([r * c + (d * ty) / tl, r * s - (d * tx) / tl]);
  }
  // 대칭축(y = 0) 아래로 넘어간 양 끝을 자른다
  const trim = (pts: V2[]): V2[] => {
    let i0 = 0;
    while (i0 < pts.length - 1 && pts[i0]![1] < 0) i0++;
    const out = pts.slice(i0);
    if (i0 > 0) {
      const a = pts[i0 - 1]!;
      const b = pts[i0]!;
      const t = a[1] / (a[1] - b[1]);
      out.unshift([a[0] + (b[0] - a[0]) * t, 0]);
    }
    return out;
  };
  let up = trim(upper);
  up = trim(up.reverse()).reverse();
  const pts: V2[] = [];
  const ad = Math.abs(d);
  // 눈(φ = 0) 쪽: 안쪽 평행선이면 원호(중심 (r0, 0))
  if (d < 0 && up[0]![1] > 1e-9) {
    const e = Math.atan2(up[0]![1], up[0]![0] - r0); // 위쪽 끝점의 각(π 보다 조금 작다)
    const m = Math.max(2, Math.ceil(((Math.PI - e) * 2 * ad) / 0.004));
    for (let i = 1; i < m; i++) {
      const a = TAU - e + ((2 * e - TAU) * i) / m; // 아래 끝(거울 점이 맡는다) → π → 위 끝
      pts.push([r0 + ad * Math.cos(a), ad * Math.sin(a)]);
    }
  }
  pts.push(...up);
  // 끝(φ = π) 쪽: 바깥 평행선이면 원호(중심 (−(r0 + h), 0))
  const last = up[up.length - 1]!;
  if (d > 0 && last[1] > 1e-9) {
    const cx = -(r0 + h);
    const e = Math.atan2(last[1], last[0] - cx);
    const m = Math.max(2, Math.ceil(((Math.PI - e) * 2 * ad) / 0.004));
    for (let i = 1; i < m; i++) {
      const a = e + ((TAU - 2 * e) * i) / m; // 위 끝 → π → 아래 끝
      pts.push([cx + ad * Math.cos(a), ad * Math.sin(a)]);
    }
  }
  // 아래 반쪽(거울). 대칭축 위의 점은 한 번만
  for (let i = up.length - 1; i >= 0; i--) {
    const p = up[i]!;
    if (p[1] > 1e-9) pts.push([p[0], -p[1]]);
  }
  return pts;
}

// ───────────────────────── 095 경사 원판 캠 ─────────────────────────

/** 095 치수. R 원판 반지름, th 두께, alpha 기울기, rc 막대가 얹히는 반지름, rr 롤러(둥근 통) 반지름, rw 롤러 반폭 */
export const SWASH = {
  R: 0.5,
  th: 0.05,
  alpha: (14 * Math.PI) / 180,
  rc: 0.4,
  rr: 0.06,
  rw: 0.03,
  shaftR: 0.06,
  /** 벽 윗면(원판 중심 기준 높이) */
  wallTop: -0.22,
  /** 벽 왼쪽 면(축 기준 x) */
  wallX: 0.325,
  /** 안내 슬리브의 높이 범위(원판 중심 기준) */
  sleeveY0: 0.57,
  sleeveY1: 0.77
} as const;

/**
 * 롤러 중심의 높이(원판 윗면 중심 기준). psi = 원판의 높은 쪽이 막대(+X) 쪽에서 돌아간 각.
 * 둥근 통 롤러(반지름 rr 의 공 띠)가 기운 평면에 닿는 정확한 식: rr/cosα + rc·tanα·cosψ.
 */
export function swashLift(psi: number): number {
  return SWASH.rr / Math.cos(SWASH.alpha) + SWASH.rc * Math.tan(SWASH.alpha) * Math.cos(psi);
}

/**
 * 경사 원판 회전체: 세로 축 + 축 고리 + 나팔 모양 허브 + 기운 원판. 원점 = 원판 윗면의 중심, 회전축 = 로컬 Y.
 * rotation.y = 0 일 때 원판의 높은 쪽이 로컬 +X. shaftDown = 원점에서 축 아래 끝까지의 길이.
 */
export function swashRotor(shaftDown: number): THREE.Group {
  const S = SWASH;
  const g = new THREE.Group();
  const ta = Math.tan(S.alpha);
  // 기운 원판(윗면이 원점을 지난다)
  const discGeo = new THREE.CylinderGeometry(S.R, S.R, S.th, 72);
  discGeo.translate(0, -S.th / 2, 0);
  const disc = mesh(creased(discGeo, 40), bronze({ roughness: 0.36 }));
  disc.rotation.z = S.alpha;
  disc.name = 'swashDisc';
  g.add(disc);
  // 높은 쪽 표시(윗면 가장자리의 어두운 점)
  const dotGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.004, 20);
  dotGeo.translate(S.R - 0.05, 0.002, 0);
  const dot = mesh(dotGeo, darkSteel());
  dot.rotation.z = S.alpha;
  g.add(dot);
  // 나팔 허브: 세로 회전체의 윗부분을 원판 밑면(기운 평면)에 맞춰 깎는다
  const prof: V2[] = [
    [0, -0.19], [0.085, -0.19], [0.085, -0.13], [0.093, -0.1], [0.112, -0.075], [0.15, -0.055], [0.15, 0.02], [0, 0.02]
  ];
  const hubGeo = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 48);
  const pos = hubGeo.getAttribute('position');
  const under = S.th / Math.cos(S.alpha) - 0.01;
  for (let i = 0; i < pos.count; i++) {
    const lim = pos.getX(i) * ta - under;
    if (pos.getY(i) > lim) pos.setY(i, lim);
  }
  pos.needsUpdate = true;
  g.add(mesh(creased(hubGeo, 36), castIron()));
  // 세로 축(허브 속에서 아래 끝까지)과 받침 아래 고리
  g.add(mesh(lathe(rodProfile(S.shaftR, -shaftDown, -0.08, 0.012, 0), 32), steel()));
  g.add(mesh(lathe(tubeProfile(S.shaftR - 0.002, 0.085, -0.555, -0.522, 0.006), 32), darkSteel()));
  // 축의 키 표시(도는 것이 보이게)
  const key = mesh(new THREE.BoxGeometry(0.014, 0.1, 0.02), darkSteel());
  key.position.set(S.shaftR, -0.255, 0);
  g.add(key);
  setMM(g, { kind: 'swash', R: S.R, th: S.th, alphaDeg: 14, axis: 'y' });
  return g;
}

/**
 * 경사 원판 캠의 고정 틀: 벽(단면 덩어리) + 벽에 볼트로 붙인 축 받침 + 바닥의 축 발받침 + 막대 안내(기둥·팔·슬리브).
 * 원점 = 원판 윗면의 중심(swashRotor 와 같은 자리에 둔다). baseDrop = 원점에서 받침판 윗면까지 내려가는 길이.
 * 발받침·안내는 판화에 없는 보충 부품.
 */
export function swashFrame(baseDrop: number): THREE.Group {
  const S = SWASH;
  const g = new THREE.Group();
  const at = (m: THREE.Mesh, x: number, y: number, z: number): THREE.Mesh => {
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  // 벽: x wallX ~ 1.0, y −baseDrop ~ wallTop, z −0.45 ~ 0.3
  const wallH = baseDrop + S.wallTop;
  at(mesh(new THREE.BoxGeometry(1.0 - S.wallX, wallH, 0.75), castIron()), (1.0 + S.wallX) / 2, S.wallTop - wallH / 2, -0.075);
  // 축 받침(벽 왼쪽 면에 붙은 덩어리, 축 구멍): x −0.105 ~ wallX, y −0.52 ~ −0.32, z ±0.1
  const br = roundedRect(-0.105, -0.1, S.wallX, 0.1, 0.02);
  br.holes.push(circlePath(0, 0, S.shaftR + 0.004));
  const brGeo = extrude(br, 0.2, 0.008);
  brGeo.rotateX(Math.PI / 2);
  at(mesh(brGeo, darkSteel()), 0, -0.42, 0);
  // 받침을 벽에 죄는 볼트 머리(받침 앞면, 벽 가까이)
  const nut = hexPrism(0.05, 0.025, true, true, 0);
  nut.rotateX(Math.PI / 2);
  at(mesh(nut, steel()), S.wallX - 0.06, -0.42, 0.1125);
  // 바닥의 발받침(축 아래 끝을 받친다)
  at(mesh(lathe(rodProfile(0.11, 0, 0.1, 0, 0.015), 32), castIron()), 0, -baseDrop, 0);
  // 막대 안내: 벽 위의 기둥 + 팔 + 슬리브
  const postH = S.sleeveY1 - 0.05 - S.wallTop;
  at(mesh(new THREE.BoxGeometry(0.08, postH, 0.08), castIron()), 0.8, S.wallTop + postH / 2, 0);
  at(mesh(new THREE.BoxGeometry(0.8 + 0.04 - (S.rc + 0.045), 0.1, 0.07), castIron()), (0.84 + S.rc + 0.045) / 2, (S.sleeveY0 + S.sleeveY1) / 2, 0);
  const sleeve = at(mesh(lathe(tubeProfile(0.028, 0.055, S.sleeveY0, S.sleeveY1, 0.008), 32), darkSteel()), S.rc, 0, 0);
  sleeve.name = 'rodGuide';
  setMM(g, { kind: 'frame' });
  return g;
}

/**
 * 포크 끝에 둥근 통 롤러를 문 세로 막대. 원점 = 롤러 중심, 막대는 로컬 +Y 로 len 까지.
 * 롤러(name 'roller')의 축 = 로컬 X(원판의 반지름 방향) — 판화의 포크·핀 방향. 굴림은 roller.rotation.x.
 */
export function forkRod(len: number): THREE.Group {
  const S = SWASH;
  const g = new THREE.Group();
  const roller = new THREE.Group();
  roller.name = 'roller';
  const th0 = Math.acos(S.rw / S.rr);
  const band = new THREE.SphereGeometry(S.rr, 32, 10, 0, TAU, th0, Math.PI - 2 * th0);
  band.rotateZ(Math.PI / 2);
  roller.add(mesh(band, brass({ roughness: 0.3 })));
  const capR = S.rr * Math.sin(th0);
  for (const sx of [-1, 1]) {
    const cap = new THREE.CircleGeometry(capR, 28);
    cap.rotateY((sx * Math.PI) / 2);
    cap.translate(sx * S.rw, 0, 0);
    roller.add(mesh(cap, brass({ roughness: 0.3 })));
    const mark = new THREE.BoxGeometry(0.003, capR * 0.8, 0.012);
    mark.translate(sx * (S.rw + 0.001), capR * 0.5, 0);
    roller.add(mesh(mark, darkSteel()));
  }
  setMM(roller, { kind: 'roller', r: S.rr, axis: 'x' });
  g.add(roller);
  // 핀(양쪽 머리)
  const pinGeo = lathe(rodProfile(0.012, -0.062, 0.062, 0.003, 0.003), 16);
  pinGeo.rotateZ(Math.PI / 2);
  g.add(mesh(pinGeo, darkSteel()));
  for (const sx of [-1, 1]) {
    const head = lathe(rodProfile(0.02, 0, 0.012, 0.003, 0.003), 16);
    head.rotateZ(Math.PI / 2);
    head.translate(sx * 0.062 + (sx > 0 ? 0.012 : 0), 0, 0);
    g.add(mesh(head, darkSteel()));
    // 포크 갈래
    const prong = new THREE.BoxGeometry(0.016, 0.115, 0.05);
    prong.translate(sx * 0.044, 0.0375, 0);
    g.add(mesh(prong, steel()));
  }
  const bridge = new THREE.BoxGeometry(0.104, 0.03, 0.05);
  bridge.translate(0, 0.105, 0);
  g.add(mesh(bridge, steel()));
  g.add(mesh(lathe(rodProfile(0.025, 0.11, len, 0, 0.006), 24), steel()));
  setMM(g, { kind: 'follower', length: len, r: S.rr });
  return g;
}

// ───────────────────────── 096 하트 캠과 작도판 ─────────────────────────

/** 096 치수. r0 눈(최소) 반지름, h 오름(이동 거리), rho 롤러 반지름, div 이동 거리를 나눈 수, gridR 작도판(바깥 원) 반지름 */
export const HEART96 = { r0: 0.26, h: 0.7, rho: 0.06, div: 6, gridR: 0.96, thick: 0.1, hubR: 0.24 } as const;

/** 096 캠 윤곽(하트 곡선 그대로 — 작도 교점을 지난다). 로컬 +X 가 눈 */
export function heartOutline96(): V2[] {
  return heartOffsetOutline(HEART96.r0, HEART96.h, 0, 540);
}

let table96: Float64Array | null = null;
const N96 = 1440;

/**
 * 096 롤러 중심이 캠 축에서 떨어진 거리. psi = 캠이 판화 자세(눈이 롤러 쪽)에서 돈 각(방향 무관).
 * 반지름 rho 의 롤러가 +X 선 위에서 하트 윤곽에 닿는 자리를 윤곽 점으로 풀어 0.25° 표로 만들고 보간한다.
 * 범위 0.334(눈에 앉음) ~ 1.02(끝). 등속(직선)에서 벗어남은 이동 거리의 0.63%(0.0043) 이하.
 */
export function heartRollerX96(psi: number): number {
  if (!table96) {
    const P = heartOutline96();
    const rho = HEART96.rho;
    const t = new Float64Array(N96 + 1);
    for (let i = 0; i <= N96; i++) {
      const a = (TAU * i) / N96;
      const c = Math.cos(a);
      const s = Math.sin(a);
      let best = -Infinity;
      for (const [x, y] of P) {
        const py = x * s + y * c;
        if (py > rho || py < -rho) continue;
        const v = x * c - y * s + Math.sqrt(rho * rho - py * py);
        if (v > best) best = v;
      }
      t[i] = best;
    }
    table96 = t;
  }
  let u = (psi % TAU) / TAU;
  if (u < 0) u += 1;
  const f = u * N96;
  const i = Math.min(N96 - 1, Math.floor(f));
  return table96[i]! + (table96[i + 1]! - table96[i]!) * (f - i);
}

/** 점선 띠 하나(평면 z 위의 납작한 네모)를 배열에 더한다 */
function pushDash(posArr: number[], idx: number[], a: V2, b: V2, z: number, w: number): void {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = Math.hypot(dx, dy) || 1;
  const nx = (-dy / l) * (w / 2);
  const ny = (dx / l) * (w / 2);
  const k = posArr.length / 3;
  posArr.push(a[0] + nx, a[1] + ny, z, a[0] - nx, a[1] - ny, z, b[0] - nx, b[1] - ny, z, b[0] + nx, b[1] + ny, z);
  idx.push(k, k + 1, k + 2, k, k + 2, k + 3);
}

/**
 * 하트 캠(096): 황동 캠 판 + 허브 + 뒤의 작도판(판화의 가는 바깥 원) + 점선 작도(동심원 div+1 개, 방사선 2·div 개) + 교점 표시.
 * 원점 = 축, 회전축 = 로컬 Z, 로컬 +X 가 눈. 캠 판은 z ±thick/2, 작도판은 그 바로 뒤.
 * 점선은 캠 안쪽에서는 캠 앞면에, 바깥에서는 작도판 앞면에 놓인다. userData.outline = 캠 윤곽.
 */
export function heartCam96(): THREE.Group {
  const H = HEART96;
  const g = new THREE.Group();
  const outline = heartOutline96();
  const zf = H.thick / 2;
  g.add(mesh(extrude(shapeFrom(outline), H.thick, 0.006), brass({ roughness: 0.34 })));
  // 허브(앞으로 0.02 나옴)
  const hub = lathe(tubeProfile(0.07, H.hubR, -zf, zf + 0.02, 0.008), 48);
  hub.rotateX(Math.PI / 2);
  g.add(mesh(hub, darkSteel()));
  // 작도판
  const board = new THREE.CylinderGeometry(H.gridR, H.gridR, 0.012, 96);
  board.rotateX(Math.PI / 2);
  const bm = mesh(board, plastic(0xece4d0));
  bm.position.z = -zf - 0.006;
  bm.name = 'gridBoard';
  g.add(bm);
  // 점선
  const posArr: number[] = [];
  const idx: number[] = [];
  const inside = (p: V2): number => {
    const r = Math.hypot(p[0], p[1]);
    const lim = heartRadius(Math.atan2(p[1], p[0]), H.r0, H.h);
    return r < lim - 0.006 ? 1 : r > lim + 0.006 ? -1 : 0;
  };
  const dash = (a: V2, b: V2): void => {
    const ia = inside(a);
    const ib = inside(b);
    if (ia === 0 || ib === 0 || ia !== ib) return;
    const r = Math.hypot((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    if (ia > 0 && r < H.hubR + 0.004) return; // 허브에 가린 곳
    pushDash(posArr, idx, a, b, ia > 0 ? zf + 0.0015 : -zf + 0.0015, 0.009);
  };
  for (let k = 0; k <= H.div; k++) {
    const r = H.r0 + (H.h * k) / H.div;
    if (r > H.gridR - 0.006) continue; // 맨 바깥 원 = 작도판 테두리
    const m = Math.round((TAU * r) / 0.045);
    for (let i = 0; i < m; i++) {
      const a0 = (TAU * i) / m;
      const a1 = (TAU * (i + 0.55)) / m;
      dash([r * Math.cos(a0), r * Math.sin(a0)], [r * Math.cos(a1), r * Math.sin(a1)]);
    }
  }
  for (let j = 0; j < 2 * H.div; j++) {
    const a = (Math.PI * j) / H.div;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const m = Math.round((H.gridR - H.r0) / 0.045);
    for (let i = 0; i < m; i++) {
      const ra = H.r0 + ((H.gridR - H.r0) * i) / m;
      const rb = H.r0 + ((H.gridR - H.r0) * (i + 0.55)) / m;
      dash([ra * c, ra * s], [rb * c, rb * s]);
    }
  }
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
  lineGeo.setIndex(idx);
  lineGeo.computeVertexNormals();
  const lines = mesh(lineGeo, plastic(0x26221c));
  lines.castShadow = false;
  lines.name = 'gridLines';
  g.add(lines);
  // 교점 표시: k 번째 방사선 × k 번째 동심원(위·아래 대칭) — 캠 곡선이 지나는 점
  const dotMat = paint(0xc23a2e);
  for (let j = -H.div + 1; j <= H.div; j++) {
    const a = (Math.PI * j) / H.div;
    const r = H.r0 + (H.h * Math.abs(j)) / H.div - 0.014;
    const d = new THREE.CylinderGeometry(0.014, 0.014, 0.004, 16);
    d.rotateX(Math.PI / 2);
    const dm = mesh(d, dotMat);
    dm.position.set(r * Math.cos(a), r * Math.sin(a), zf + 0.002);
    dm.castShadow = false;
    g.add(dm);
  }
  g.userData.outline = outline;
  setMM(g, { kind: 'cam', fn: 'heartCam96', r0: H.r0, rise: H.h, axis: 'z' });
  return g;
}

// ───────────────────────── 097 홈이 파인 하트 캠 ─────────────────────────

/** 097 치수. r0·h 는 홈 가운데 선(롤러 중심의 길), rho 롤러 반지름, clear 홈 벽 틈, R 원판 반지름, depth 홈 깊이 */
export const HEART97 = { r0: 0.22, h: 0.68, rho: 0.055, clear: 0.003, R: 1.0, hubR: 0.15, depth: 0.08, back: 0.03 } as const;

/** 097 롤러 중심이 원판 축에서 떨어진 거리(정확히 등속): r0 + h·|ψ|/π. psi = 판화 자세에서 원판이 돈 각 */
export function heartPitch97(psi: number): number {
  return heartRadius(psi, HEART97.r0, HEART97.h);
}

/** 097 홈의 안쪽 벽(가운데 섬) 윤곽 */
export function grooveInner97(): V2[] {
  return heartOffsetOutline(HEART97.r0, HEART97.h, -(HEART97.rho + HEART97.clear), 420);
}

/** 097 홈의 바깥쪽 벽 윤곽 */
export function grooveOuter97(): V2[] {
  return heartOffsetOutline(HEART97.r0, HEART97.h, HEART97.rho + HEART97.clear, 420);
}

/**
 * 홈이 파인 하트 캠 원판(097): 뒤판(어두운 홈 바닥) + 바깥 둔덕(원판에서 하트 구멍을 뺀 것) + 가운데 하트 섬 + 허브.
 * 원점 = 축, 회전축 = 로컬 Z, 로컬 +X 가 눈. 앞면 z = +depth/2, 홈 바닥 z = −depth/2 (롤러 가운데 평면 z = 0).
 * userData.outlines = { island: 안쪽 벽, groove: 바깥쪽 벽(구멍) }.
 */
export function groovedHeartDisc97(): THREE.Group {
  const H = HEART97;
  const g = new THREE.Group();
  const inner = grooveInner97();
  const outer = grooveOuter97();
  const zf = H.depth / 2;
  const back = new THREE.CylinderGeometry(H.R, H.R, H.back, 96);
  back.rotateX(Math.PI / 2);
  const bk = mesh(back, castIron());
  bk.position.z = -zf - H.back / 2;
  g.add(bk);
  const land = shapeFrom(circlePts(H.R, 144));
  land.holes.push(pathFrom(outer));
  g.add(mesh(extrude(land, H.depth, 0.005), bronze({ roughness: 0.36 })));
  g.add(mesh(extrude(shapeFrom(inner), H.depth, 0.005), bronze({ roughness: 0.36 })));
  const hub = lathe(tubeProfile(0.055, H.hubR, zf - 0.01, zf + 0.03, 0.008), 40);
  hub.rotateX(Math.PI / 2);
  g.add(mesh(hub, darkSteel()));
  // 눈 방향 표시점(바깥 둔덕 앞면)
  const dot = new THREE.CylinderGeometry(0.025, 0.025, 0.004, 20);
  dot.rotateX(Math.PI / 2);
  const dm = mesh(dot, darkSteel());
  dm.position.set(0.72, 0, zf + 0.002);
  g.add(dm);
  g.userData.outlines = { island: inner, groove: outer };
  setMM(g, { kind: 'cam', fn: 'groovedHeartDisc97', r0: H.r0, rise: H.h, grooveWidth: 2 * (H.rho + H.clear), axis: 'z' });
  return g;
}

// ───────────────────────── 롤러 달린 가로 막대 · 안내 블록 (096·097 공용) ─────────────────────────

/** 가로 막대의 층: 막대 중심 z(롤러 가운데 평면 기준), 막대 반지름, 눈(끝 고리) 반지름 */
export const CAM_BAR = { z: 0.115, r: 0.045, eyeR: 0.065, eyeT: 0.06, rollerW: 0.07 } as const;

/**
 * 끝에 롤러를 단 가로 막대. 원점 = 롤러 중심(캠 판의 가운데 평면), 막대는 로컬 +X 로 len 까지, 캠 앞(z = CAM_BAR.z)을 지난다.
 * 롤러(name 'roller', userData.outline = 반지름 rho 의 원)는 핀으로 막대 끝 눈에 달린다.
 * collarAt 를 주면 그 x 자리에 스프링 받이 고리(두께 0.03, 반지름 0.09)를 끼운다.
 */
export function camBar(len: number, rho: number, opts: { collarAt?: number } = {}): THREE.Group {
  const B = CAM_BAR;
  const g = new THREE.Group();
  const rg = new THREE.CylinderGeometry(rho, rho, B.rollerW, 40);
  rg.rotateX(Math.PI / 2);
  const roller = mesh(rg, steel());
  roller.name = 'roller';
  roller.userData.outline = circlePts(rho, 72);
  setMM(roller, { kind: 'roller', r: rho, axis: 'z' });
  g.add(roller);
  const pin = lathe(rodProfile(0.016, -B.rollerW / 2 - 0.004, B.z + B.eyeT / 2 + 0.012, 0.003, 0.003), 16);
  pin.rotateX(Math.PI / 2);
  g.add(mesh(pin, darkSteel()));
  const eye = new THREE.CylinderGeometry(B.eyeR, B.eyeR, B.eyeT, 32);
  eye.rotateX(Math.PI / 2);
  eye.translate(0, 0, B.z);
  g.add(mesh(eye, steel()));
  const body = lathe(rodProfile(B.r, 0.03, len, 0, 0.008), 28);
  body.rotateZ(-Math.PI / 2);
  body.translate(0, 0, B.z);
  g.add(mesh(body, steel()));
  if (opts.collarAt !== undefined) {
    const col = lathe(tubeProfile(B.r - 0.002, 0.09, opts.collarAt - 0.015, opts.collarAt + 0.015, 0.005), 28);
    col.rotateZ(-Math.PI / 2);
    col.translate(0, 0, B.z);
    const cm = mesh(col, darkSteel());
    cm.name = 'collar';
    g.add(cm);
  }
  setMM(g, { kind: 'follower', length: len, r: rho, axis: 'x' });
  return g;
}

/**
 * 가로 막대의 안내 블록. 원점 = 막대 중심선 위(구멍 중심), 구멍은 로컬 X. 블록 x ±0.075.
 * 뒤로 뻗은 팔이 뒤판(로컬 z = zBack, 음수)에 붙는다. 판화에 없는 보충 부품.
 */
export function barGuide(zBack: number): THREE.Group {
  const g = new THREE.Group();
  const blk = roundedRect(-0.085, -0.085, 0.085, 0.085, 0.02);
  blk.holes.push(circlePath(0, 0, CAM_BAR.r + 0.003));
  const geo = extrude(blk, 0.15, 0.008);
  geo.rotateY(Math.PI / 2);
  g.add(mesh(geo, castIron()));
  const armLen = -zBack - 0.085;
  const arm = mesh(new THREE.BoxGeometry(0.07, 0.07, armLen), castIron());
  arm.position.set(0, 0, -0.085 - armLen / 2);
  g.add(arm);
  const flange = mesh(new THREE.BoxGeometry(0.18, 0.18, 0.02), darkSteel());
  flange.position.set(0, 0, zBack + 0.01);
  g.add(flange);
  setMM(g, { kind: 'guide', axis: 'x' });
  return g;
}
