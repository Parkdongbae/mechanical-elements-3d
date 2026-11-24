// 80·81·82번 전용 키트 — 갈고리 폴 두 개로 올리는 홈 랙(080), 결손 기어 + 랙 막대 + 되돌림 스프링(081), 두 발판 래칫(082)
// 설계표: docs/mm507-sheets/080.md · 081.md · 082.md. 치수·운동식의 근거와 침범 검사는 shots/_verify/s080.mjs · s081.mjs · s082.mjs.
// 모든 자세 함수(k80State · rackLift81 · k82State)는 구동 누적각 theta 의 절대 함수다(누적 오차 없음).
import * as THREE from 'three';
import { brass, bronze, castIron, darkSteel, paint, steel, wood } from '../../models/materials';
import { TAU, circlePath, extrude, lathe, mesh, rodProfile, shapeFrom, stadiumShape, tubeProfile, type V2 } from '../../models/parts/geom';
import { involuteOutline } from '../../models/parts/gears';
import { STAGE } from './stand';
import { markAnchor, markPin, setMM } from './mm';

const MARK = 0xf2b619;
const DEG = Math.PI / 180;

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

/** Z 축 원통(핀·보스): 반지름 r, z0 → z1 */
function pinZ(r: number, z0: number, z1: number, mat: THREE.Material): THREE.Mesh {
  const geo = lathe(rodProfile(r, Math.min(z0, z1), Math.max(z0, z1), r * 0.2, r * 0.2), 20);
  geo.rotateX(Math.PI / 2);
  return mesh(geo, mat);
}

const rot2 = (p: V2, a: number): V2 => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
};
const smooth = (x: number): number => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
};
const posMod = (x: number, m: number): number => ((x % m) + m) % m;

// ═════════════════════════ 080 갈고리 폴로 올리는 홈 랙 ═════════════════════════
// 좌표: 레버 받침 핀 O 가 원점. 막대 A 의 "막대 좌표" v 는 톱니 격자 기준(이뿌리 구석 k 가 v = −k·p).
// 막대 원점(v = 0)의 높이 = O.y + barY. 톱니는 좌우 대칭: 아래를 보는 평평한 면(갈고리가 받치는 면) + 그 위 비탈.

export const K80 = (() => {
  const p = 0.09; // 톱니 피치
  const depth = 0.045; // 톱니 깊이
  const wr = 0.21; // 이뿌리 반폭
  const a = 0.45; // 받침 핀에서 폴 핀까지
  const L = 1.14; // 폴 핀 → 갈고리 끝
  const j = 2; // 반 행정에 올리는 톱니 수
  const eps = 0.012; // 헛걸음(갈고리가 톱니 밑으로 더 내려가는 여유)
  const S = j * p + eps; // 폴 핀의 세로 행정
  const PHI = Math.asin(S / (2 * a)); // 레버 흔들림 진폭
  const gPhi = Math.sqrt(L * L - (wr + a * Math.cos(PHI)) ** 2);
  const Y0 = S / 2 - gPhi; // theta = 0 의 barY
  return {
    p, depth, wr, wt: wr + depth, a, L, j, eps, S, PHI, Y0,
    /** 톱니 번호 범위(위 kTop … 아래 kBot) */
    kTop: -5, kBot: 10,
    /** 아래 자루 반폭·아래 끝 v, 머리 시작·꼭대기 v, 머리 반폭 */
    ws: 0.16, vShank: -0.93, vBot: -1.07, vHead: 1.0, vTop: 1.2, headW: 0.3,
    /** 긴 홈: 반폭, 위 끝·아래 끝(중심선의 v) */
    slotW: 0.036, slotTop: -Y0 + 0.045 - 0.036, slotBot: -0.4,
    /** 받침 핀 반지름, 안내 블록이 핀 아래로 내려온 거리·반높이 */
    studR: 0.03, blockDrop: 0.12, blockH: 0.035,
    /** 올림 구간(theta) · 한 주기(theta) · 올림 총량 */
    LIFT_END: 2 * TAU, CYCLE: 3 * TAU, liftTotal: 4 * j * p,
    /** 되돌림 때 폴을 젖히는 각 */
    holdOut: 0.085,
    /** 되돌림 때 갈고리를 풀려고 막대를 살짝 드는 양 */
    bump: 0.05,
    /** 폴의 기준 기울기(레버 수평, 끝이 이뿌리에 있을 때 세로에서 잰 각) */
    psiNom: Math.asin((wr + a) / L),
    /** 레버: 팔 끝 반길이, 공 반지름 */
    armLen: 0.9, ballR: 0.1
  } as const;
})();

export interface K80State {
  /** 레버 각(rad, 반시계 +: 오른쪽이 올라감) */
  phi: number;
  /** 막대 원점(v = 0)의 높이 − 받침 핀 높이 */
  barY: number;
  /** 처음 자리에서 올라간 양(0 … liftTotal, 뒤집힐 때 −eps/2 까지 살짝 내려앉음) */
  lift: number;
  /** 왼쪽 핀에 달린 폴(오른쪽 톱니에 걸림)의 기울기 — 세로에서 잰 각, 그룹 rotation.z = +psi1 */
  psi1: number;
  /** 오른쪽 핀에 달린 폴(왼쪽 톱니에 걸림) — 그룹 rotation.z = −psi2 */
  psi2: number;
  /** 지금 막대를 받치는 폴(0 = 되돌림 중이라 없음) */
  holder: 0 | 1 | 2;
  /** 'lift' = 올리는 중, 'reset' = 폴을 젖히고 막대를 내리는 중(판화에 없는 전시용 되돌림) */
  phase: 'lift' | 'reset';
  /** 올림 구간에서 지금까지 넘긴 톱니 수 */
  teethUp: number;
}

function k80PawlAngle(phi: number, pinY: number, barY: number): { psi: number; engaged: boolean } {
  const K = K80;
  const px = -K.a * Math.cos(phi); // 거울 좌표(톱니가 +x 쪽)
  const psiLo = Math.asin((K.wr - px) / K.L);
  const h = pinY - K.L * Math.cos(psiLo); // 끝이 이뿌리 선에 있을 때 높이
  const e = barY - h;
  const k = Math.floor(e / K.p + 1e-7);
  const d = e - k * K.p;
  if (d < 1e-6) return { psi: psiLo, engaged: true };
  const m = k + 1; // 끝이 얹힌 비탈의 톱니 번호
  if (m < K.kTop || m > K.kBot) return { psi: psiLo, engaged: false };
  // 비탈: 이끝 (wt, −m·p) → 이뿌리 (wr, −(m−1)·p)
  const F = (psi: number): number => {
    const x = px + K.L * Math.sin(psi);
    const v = pinY - K.L * Math.cos(psi) - barY;
    return x - (K.wt - (K.depth * (v + m * K.p)) / K.p);
  };
  let lo = psiLo;
  let hi = psiLo + 0.12;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (F(mid) < 0) lo = mid;
    else hi = mid;
  }
  return { psi: hi, engaged: false };
}

/** 080 의 모든 자세. theta = 구동 누적각(레버 한 번 왕복 = 2π, 한 주기 = 6π: 두 번 왕복하며 올리고 한 번 왕복하는 동안 되돌림) */
export function k80State(theta: number): K80State {
  const K = K80;
  const tau = posMod(theta, K.CYCLE);
  const phi = -K.PHI * Math.cos(tau);
  const g = Math.sqrt(K.L * K.L - (K.wr + K.a * Math.cos(phi)) ** 2);
  const h1 = -K.a * Math.sin(phi) - g; // 왼쪽 핀 폴의 끝 높이(이뿌리에 걸렸을 때)
  const h2 = K.a * Math.sin(phi) - g;
  const jp = K.j * K.p;
  let barY: number;
  let hold = 0;
  let holder: 0 | 1 | 2 = 0;
  let phase: 'lift' | 'reset' = 'lift';
  let teethUp = 0;
  if (tau < K.LIFT_END) {
    const A1 = h1 + 2 * jp * Math.floor((tau + Math.PI) / TAU);
    const A2 = h2 + jp * (1 + 2 * Math.floor(tau / TAU));
    barY = Math.max(A1, A2);
    holder = A1 >= A2 ? 1 : 2;
    teethUp = Math.max(0, Math.round((barY - K.Y0) / K.p - 0.49));
  } else {
    phase = 'reset';
    const u = tau - K.LIFT_END;
    // 손으로 하는 되돌림: 막대를 살짝(bump) 들어 갈고리를 풀고 → 폴을 젖히고 → 막대를 내리고 → 폴을 놓고 → 막대를 갈고리에 얹는다
    const bump = K.bump * Math.min(smooth(u / 0.2), 1 - smooth((u - (TAU - 0.28)) / 0.24));
    const hand = K.Y0 + K.liftTotal * (1 - smooth((u - 0.6) / (TAU - 1.6))) + bump;
    barY = u > TAU - 0.7 ? Math.max(hand, h1, h2 + jp) : hand;
    hold = Math.min(smooth((u - 0.12) / 0.3), 1 - smooth((u - (TAU - 0.7)) / 0.35));
    teethUp = Math.max(0, Math.min(4 * K.j, Math.round((hand - bump - K.Y0) / K.p)));
  }
  const s1 = k80PawlAngle(phi, -K.a * Math.sin(phi), barY);
  const s2 = k80PawlAngle(phi, K.a * Math.sin(phi), barY);
  return { phi, barY, lift: barY - K.Y0, psi1: s1.psi + hold * K.holdOut, psi2: s2.psi + hold * K.holdOut, holder, phase, teethUp };
}

/** 홈 랙 막대 A 의 윤곽(막대 좌표, 반시계): 양쪽 톱니 + 나팔 머리 + 아래 자루 */
export function rackOutline80(): V2[] {
  const K = K80;
  const right: V2[] = [[K.ws, K.vBot], [K.ws, K.vShank], [K.wr, K.vShank]];
  for (let k = K.kBot; k >= K.kTop; k--) right.push([K.wr, -k * K.p], [K.wt, -k * K.p]);
  right.push([K.wr, -(K.kTop - 1) * K.p], [K.wr, K.vHead]);
  // 머리: 오목하게 벌어지는 나팔
  for (let i = 1; i <= 6; i++) {
    const t = i / 6;
    right.push([K.wr + (K.headW - K.wr) * t * t, K.vHead + (K.vTop - K.vHead) * t]);
  }
  const left: V2[] = right
    .slice()
    .reverse()
    .map(([x, y]): V2 => [-x, y]);
  return [...right, ...left];
}

/** 갈고리 코의 윤곽(폴 로컬: 원점 = 폴 핀, 기울기 0 일 때 끝이 (0, −L)). mirror = 오른쪽 핀에 달린 폴(왼쪽 톱니) */
export function hookNoseOutline80(mirror = false): V2[] {
  const K = K80;
  // 기준 자세(끝이 이뿌리, 레버 수평)에서 끝을 원점으로 한 모양: 윗면 거의 수평(4° 물러남), 아랫면 40° 로 내려감
  const w: V2[] = [[0, 0], [0.075, -0.005], [0.125, -0.005], [0.125, -0.115], [0.07, -0.115], [0.07, -0.058]];
  return w.map((q): V2 => {
    const r = rot2(q, -K.psiNom);
    const x = r[0];
    const y = r[1] - K.L;
    return mirror ? [-x, y] : [x, y];
  });
}

/** 홈 랙 막대 A. 원점 = 막대 좌표 (0, 0), 두께 thick(z 가운데 0). userData.outline = 바깥 윤곽 */
export function slottedRack80(thick = 0.07): THREE.Group {
  const K = K80;
  const outline = rackOutline80();
  const shape = shapeFrom(outline);
  const slot = stadiumShape(0, K.slotBot, 0, K.slotTop, K.slotW);
  shape.holes.push(new THREE.Path(slot.getPoints(10)));
  const g = new THREE.Group();
  g.add(mesh(extrude(shape, thick, 0.006), brass()));
  // 올라가는 양이 보이게 밝은 눈금 하나
  g.add(meshAt(new THREE.BoxGeometry(0.12, 0.014, 0.008), paint(MARK), 0, K.vHead - 0.1, thick / 2 + 0.003));
  g.userData.outline = outline;
  setMM(g, { kind: 'part', fn: 'slottedRack80', pitch: K.p, depth: K.depth, thickness: thick });
  return g;
}

/**
 * 갈고리 폴. 원점 = 폴 핀(회전축 로컬 Z), 기울기 0 일 때 끝이 (0, −L).
 * 판(막대 앞을 비스듬히 지나는 띠)은 z = plateZ, 갈고리 코(톱니에 걸리는 덩어리)는 z = noseZ(막대와 같은 층)에 두고 둘 사이를 이어 붙인다.
 * mirror = 오른쪽 핀에 달린 폴. 코 메시에 userData.outline.
 */
export function hookPawl80(mirror: boolean, plateZ: number, noseZ: number, thick = 0.045, noseThick = 0.06): THREE.Group {
  const g = new THREE.Group();
  const nose = hookNoseOutline80(mirror);
  // 코 바깥 덩어리의 가운데(판이 닿는 곳)
  const bx = (nose[2]![0] + nose[4]![0]) / 2;
  const by = (nose[2]![1] + nose[4]![1]) / 2;
  const bar = stadiumShape(0, 0, bx, by, 0.024);
  bar.holes.push(circlePath(0, 0, 0.02));
  const eye = new THREE.Shape();
  eye.absarc(0, 0, 0.05, 0, TAU, false);
  eye.holes.push(circlePath(0, 0, 0.02));
  g.add(meshAt(extrude([bar, eye], thick, 0.006), steel(), 0, 0, plateZ));
  const noseMesh = meshAt(extrude(shapeFrom(nose), noseThick, 0.004), darkSteel(), 0, 0, noseZ);
  noseMesh.userData.outline = nose;
  g.add(noseMesh);
  // 판과 코를 잇는 덩어리(코 바깥쪽, 막대 톱니 밖)
  const z0 = Math.min(plateZ, noseZ);
  const z1 = Math.max(plateZ, noseZ);
  g.add(meshAt(new THREE.BoxGeometry(0.045, 0.045, z1 - z0), darkSteel(), bx, by, (z0 + z1) / 2));
  setMM(g, { kind: 'part', fn: 'hookPawl80', length: K80.L, tip: [0, -K80.L, noseZ] });
  return g;
}

/**
 * 흔들 레버 C: 가운데 받침 구멍이 원점, 양 팔 끝에 공(손잡이). 두께 thick(z 가운데 0).
 * 폴 핀 두 개(±a)가 z = pinZ1 까지 앞으로 나온다. userData.pins = [왼쪽 핀, 오른쪽 핀].
 */
export function rockLever80(pinZ1: number, thick = 0.05): THREE.Group {
  const K = K80;
  const g = new THREE.Group();
  const x1 = K.armLen - 0.03;
  const outline: V2[] = [[-x1, -0.04], [0, -0.09], [x1, -0.04], [x1, 0.04], [0, 0.09], [-x1, 0.04]];
  const shape = shapeFrom(outline);
  shape.holes.push(circlePath(0, 0, K.studR + 0.004));
  g.add(mesh(extrude(shape, thick, 0.008), steel()));
  const pins: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    g.add(meshAt(new THREE.SphereGeometry(K.ballR, 24, 16), wood(), s * (K.armLen + K.ballR * 0.6), 0, 0));
    const pin = pinZ(0.02, -thick / 2, pinZ1, darkSteel());
    pin.position.set(s * K.a, 0, 0);
    markPin(pin, [0, 0, 0]);
    pins.push(pin);
    g.add(pin);
    g.add(meshAt(new THREE.CylinderGeometry(0.032, 0.032, 0.012, 16).rotateX(Math.PI / 2), darkSteel(), s * K.a, 0, pinZ1));
  }
  g.add(meshAt(new THREE.BoxGeometry(0.06, 0.014, 0.008), paint(MARK), 0.25, 0, thick / 2 + 0.003));
  g.userData.pins = pins; // [왼쪽 핀, 오른쪽 핀] — 모델이 name 을 붙인다
  setMM(g, { kind: 'lever', length: K.armLen, pivot: [0, 0, 0], tip: [K.armLen, 0, 0] });
  return g;
}

/**
 * 받침 핀 앞 덮개 + 안내 블록(판화의 홈 속 네모): 원점 = 받침 핀 중심. 덮개 판은 z = plateZ(막대 앞),
 * 안내 블록은 핀 아래 blockDrop 에서 z = blockZ0 … plateZ 로 홈 속에 들어가 막대가 돌지 않게 잡는다. 고정 부품.
 */
export function slotKeeper80(plateZ: number, blockZ0: number): THREE.Group {
  const K = K80;
  const g = new THREE.Group();
  const plate = stadiumShape(0, 0.02, 0, -K.blockDrop - 0.02, 0.05);
  g.add(meshAt(extrude(plate, 0.02, 0.004), castIron(), 0, 0, plateZ));
  const len = plateZ - blockZ0;
  g.add(meshAt(new THREE.BoxGeometry(K.slotW * 2 - 0.008, K.blockH * 2, len), darkSteel(), 0, -K.blockDrop, blockZ0 + len / 2));
  setMM(g, { kind: 'part', fn: 'slotKeeper80' });
  return g;
}

// ═════════════════════════ 081 결손 기어로 올리는 랙 막대 ═════════════════════════
// 기어 A: 잇수 16, 모듈 0.028, 이는 5개만(로컬 이 번호 10 … 14). 시계 방향으로 돈다: rotation.z = −thetaE.
// 랙 좌표: 원점 = 피치선 위의 점, +X = 기어 쪽(이가 뻗는 쪽), +Y = 위. 쉬는 자리에서 랙 원점의 높이 = 기어 축 높이 + restY.

export const K81 = (() => {
  const teeth = 16;
  const module = 0.028;
  const rp = (teeth * module) / 2;
  const pc = Math.PI * module;
  return {
    teeth, module, rp, ra: rp + module, rf: rp - 1.25 * module, rb: rp - 1.15 * module, pc,
    /** 이가 남은 구간: 로컬 이 번호 from 부터 count 개 */
    from: 10, count: 5,
    /** 랙: 이 수, 피치선 이 두께(피치의 비), 몸통 두께 */
    rackTeeth: 6, rackThick: 0.4, bodyW: 0.11, bodyEnd: 0.07,
    /** 맨 위 랙 이의 중심(랙 좌표 y) — 아래로 pc 간격 */
    topToothY: 0,
    /** 쉬는 자리에서 랙 원점 높이 − 기어 축 높이 */
    restY: -0.085,
    /** 떨어지는(스프링 되돌림) 데 걸리는 기어 각 */
    fall: 0.35
  } as const;
})();

/** 결손 기어 A 의 윤곽(로컬, 반시계). 이 중심각 = (번호 + 0.5)·22.5° */
export function mutilatedOutline81(): V2[] {
  const K = K81;
  const step = TAU / K.teeth;
  const full = involuteOutline(K.teeth, K.ra, K.rf, Math.PI / K.teeth);
  const regions: V2[][] = Array.from({ length: K.teeth }, () => []);
  for (const q of full) {
    let a = Math.atan2(q[1], q[0]);
    if (a < 0) a += TAU;
    regions[Math.min(K.teeth - 1, Math.floor(a / step))]!.push(q);
  }
  const has = (jj: number): boolean => posMod(jj - K.from, K.teeth) < K.count;
  const out: V2[] = [];
  for (let jj = 0; jj < K.teeth; jj++) {
    if (has(jj)) out.push(...regions[jj]!);
    else for (let k = 0; k < 6; k++) out.push([Math.cos((jj + k / 6) * step) * K.rb, Math.sin((jj + k / 6) * step) * K.rb]);
  }
  return out;
}

/** 랙(이 + 몸통)의 윤곽(랙 좌표, 반시계) */
export function rackOutline81(): V2[] {
  const K = K81;
  const m = K.module;
  const ta = Math.tan(20 * DEG);
  const t0 = K.rackThick * K.pc;
  const half = (x: number): number => t0 / 2 - x * ta;
  const xr = -1.25 * m;
  const yTop = K.topToothY + K.bodyEnd;
  const yBot = K.topToothY - (K.rackTeeth - 1) * K.pc - K.bodyEnd;
  const pts: V2[] = [[xr - K.bodyW, yBot], [xr, yBot]];
  for (let i = K.rackTeeth - 1; i >= 0; i--) {
    const yc = K.topToothY - i * K.pc;
    pts.push([xr, yc - half(xr)], [m, yc - half(m)], [m, yc + half(m)], [xr, yc + half(xr)]);
  }
  pts.push([xr, yTop], [xr - K.bodyW, yTop]);
  return pts;
}

/**
 * 준정적 접촉으로 구운 올림 표: 기어 각 thetaE = LIFT81_T0 + i·0.5° 에서 랙이 쉬는 자리에서 올라간 양.
 * (스프링이 랙을 이에 눌러 붙인 상태 — shots/_verify/s081.mjs 가 이 파일의 윤곽으로 계산. 치수를 바꾸면 다시 굽는다.)
 */
export const LIFT81_T0 = 25;
// prettier-ignore
export const LIFT81: readonly number[] = [
  0.0000, 0.0017, 0.0040, 0.0062, 0.0084, 0.0106, 0.0128, 0.0149, 0.0170, 0.0189, 0.0209, 0.0228, 0.0248, 0.0267, 0.0287, 0.0306,
  0.0326, 0.0345, 0.0365, 0.0384, 0.0404, 0.0423, 0.0443, 0.0462, 0.0482, 0.0501, 0.0520, 0.0540, 0.0559, 0.0578, 0.0598, 0.0617,
  0.0637, 0.0657, 0.0676, 0.0696, 0.0716, 0.0736, 0.0756, 0.0775, 0.0795, 0.0815, 0.0834, 0.0854, 0.0873, 0.0893, 0.0912, 0.0931,
  0.0951, 0.0970, 0.0989, 0.1009, 0.1029, 0.1049, 0.1069, 0.1088, 0.1108, 0.1127, 0.1147, 0.1166, 0.1186, 0.1206, 0.1225, 0.1245,
  0.1264, 0.1284, 0.1303, 0.1323, 0.1342, 0.1362, 0.1381, 0.1401, 0.1420, 0.1440, 0.1460, 0.1479, 0.1499, 0.1518, 0.1538, 0.1557,
  0.1577, 0.1596, 0.1616, 0.1636, 0.1655, 0.1675, 0.1694, 0.1714, 0.1733, 0.1753, 0.1772, 0.1792, 0.1811, 0.1830, 0.1849, 0.1869,
  0.1889, 0.1909, 0.1929, 0.1949, 0.1968, 0.1988, 0.2007, 0.2027, 0.2046, 0.2066, 0.2085, 0.2105, 0.2124, 0.2144, 0.2163, 0.2183,
  0.2203, 0.2222, 0.2241, 0.2261, 0.2280, 0.2300, 0.2320, 0.2339, 0.2359, 0.2378, 0.2398, 0.2417, 0.2437, 0.2457, 0.2476, 0.2496,
  0.2515, 0.2535, 0.2554, 0.2574, 0.2593, 0.2613, 0.2632, 0.2652, 0.2671, 0.2691, 0.2710, 0.2729, 0.2749, 0.2769, 0.2788, 0.2809,
  0.2828, 0.2848, 0.2867, 0.2887, 0.2906, 0.2926, 0.2945, 0.2965, 0.2984, 0.3004, 0.3023, 0.3043, 0.3063, 0.3082, 0.3102, 0.3121,
  0.3140, 0.3160, 0.3180, 0.3199, 0.3219, 0.3238, 0.3258, 0.3277, 0.3297, 0.3317, 0.3336, 0.3356, 0.3375, 0.3395, 0.3414, 0.3434,
  0.3454, 0.3473, 0.3493, 0.3512, 0.3532, 0.3551, 0.3570, 0.3589, 0.3609, 0.3628, 0.3648, 0.3668, 0.3688, 0.3708, 0.3727, 0.3747,
  0.3766, 0.3786, 0.3805, 0.3825, 0.3844, 0.3864, 0.3884, 0.3903, 0.3923, 0.3942, 0.3962, 0.3981, 0.4001, 0.4020, 0.4040, 0.4059,
  0.4079, 0.4099, 0.4118, 0.4138, 0.4157, 0.4177, 0.4196, 0.4216, 0.4235, 0.4255, 0.4275, 0.4294, 0.4314, 0.4333, 0.4353, 0.4372,
  0.4392, 0.4411, 0.4431, 0.4450, 0.4469, 0.4488, 0.4508, 0.4528, 0.4548, 0.4567, 0.4587, 0.4607, 0.4626, 0.4646, 0.4665, 0.4685,
  0.4704, 0.4723, 0.4743, 0.4763, 0.4783, 0.4802, 0.4822, 0.4841, 0.4861, 0.4880, 0.4900, 0.4919, 0.4939, 0.4959, 0.4978, 0.4998,
  0.5017, 0.5037, 0.5056, 0.5076, 0.5096, 0.5115, 0.5135, 0.5154, 0.5174, 0.5193, 0.5213, 0.5232, 0.5252, 0.5271, 0.5290, 0.5309,
  0.5328, 0.5346, 0.5365, 0.5383, 0.5402, 0.5420, 0.5438, 0.5456, 0.5474, 0.5492, 0.5509, 0.5527, 0.5544, 0.5561, 0.5578, 0.5595,
  0.5612, 0.5628, 0.5645, 0.5661, 0.5677, 0.5693, 0.5709, 0.5725, 0.5740, 0.5755, 0.5771, 0.5786, 0.5801, 0.5815, 0.5830, 0.5844,
  0.5859, 0.5873, 0.5887, 0.5901, 0.5914, 0.5928, 0.5941, 0.5954, 0.5967, 0.5980, 0.5992, 0.6005, 0.6017, 0.6023, 0.6023, 0.6023,
  0.6023, 0.6023, 0.6023, 0.6023, 0.6023
];

/** 마지막 이가 랙을 놓는 기어 각(rad)과 그때의 올림 */
export function rackRelease81(): { theta: number; lift: number } {
  const n = LIFT81.length;
  return { theta: (LIFT81_T0 + (n - 1) * 0.5) * DEG, lift: n > 0 ? LIFT81[n - 1]! : 0 };
}

/** 랙 막대가 쉬는 자리에서 올라간 양. thetaE = 기어가 시계로 돈 누적각(rad). 한 바퀴마다 되풀이 */
export function rackLift81(thetaE: number): number {
  const n = LIFT81.length;
  if (n < 2) return 0;
  const td = posMod(thetaE, TAU) / DEG;
  const x = (td - LIFT81_T0) / 0.5;
  if (x <= 0) return 0;
  if (x < n - 1) {
    const i = Math.floor(x);
    return LIFT81[i]! + (LIFT81[i + 1]! - LIFT81[i]!) * (x - i);
  }
  const rel = rackRelease81();
  const u = (td * DEG - rel.theta) / K81.fall;
  return u >= 1 ? 0 : rel.lift * (1 - u * u);
}

/** 결손 기어 A(구동, 청동). 원점 = 축, 회전축 = 로컬 Z, 폭 width. userData.outline */
export function mutilatedGear81(width = 0.1): THREE.Group {
  const K = K81;
  const outline = mutilatedOutline81();
  const shape = shapeFrom(outline);
  shape.holes.push(circlePath(0, 0, 0.04));
  const g = new THREE.Group();
  g.add(mesh(extrude(shape, width, 0.006), bronze({ roughness: 0.34 })));
  // 판화의 안쪽 원(테) — 얕게 도드라진 고리
  const ringGeo = lathe(tubeProfile(K.rf * 0.74, K.rf * 0.8, 0, 0.008, 0.002), 48);
  ringGeo.rotateX(Math.PI / 2);
  g.add(meshAt(ringGeo, darkSteel(), 0, 0, width / 2));
  const hubGeo = lathe(tubeProfile(0.04, 0.075, -width / 2 - 0.015, width / 2 + 0.015, 0.006), 32);
  hubGeo.rotateX(Math.PI / 2);
  g.add(mesh(hubGeo, darkSteel()));
  // 표시점: 이가 있는 구간의 가운데 쪽
  const am = (K.from + K.count / 2) * (TAU / K.teeth);
  g.add(meshAt(new THREE.BoxGeometry(0.03, 0.03, 0.008), paint(MARK), Math.cos(am) * K.rf * 0.55, Math.sin(am) * K.rf * 0.55, width / 2 + 0.003));
  g.userData.outline = outline;
  setMM(g, { kind: 'gear', fn: 'mutilatedGear81', teeth: K.teeth, module: K.module, internal: false, rp: K.rp, ra: K.ra, rf: K.rf, width, axis: 'z', from: K.from, count: K.count });
  return g;
}

/**
 * 랙 막대 B 와 그 둘레의 치수(랙 좌표, 쉬는 자리 기준): 둥근 막대 축의 x·반지름, 깃(스프링 받이)의 윗면 높이·반지름·두께,
 * 막대 위·아래 끝, 올림 총량, 위·아래 안내판의 가운데 높이(고정), 스프링의 쉬는 길이.
 */
export const ROD81 = (() => {
  const K = K81;
  const lift = 0.6023; // LIFT81 의 최댓값
  const yTop = K.topToothY + K.bodyEnd;
  const yBot = K.topToothY - (K.rackTeeth - 1) * K.pc - K.bodyEnd;
  const collarT = 0.03;
  const collarY = yTop + collarT;
  const guideT = 0.035;
  const springMin = 0.2;
  const guideTop = collarY + lift + springMin + guideT / 2;
  const guideBot = yBot - 0.05 - guideT / 2;
  return {
    x: -1.25 * K.module - 0.075, r: 0.02, collarY, collarR: 0.06, collarT, lift, guideT, guideTop, guideBot,
    top: guideTop + guideT / 2 + 0.06, bottom: guideBot - guideT / 2 - lift - 0.08,
    springRest: lift + springMin, springMin
  } as const;
})();

/**
 * 랙 막대 B: 이 달린 납작한 몸통 + 위아래로 뻗은 둥근 막대 + 깃(스프링이 미는 턱). 원점 = 랙 좌표 원점, 폭 width(z 가운데 0).
 * userData.outline = 이 + 몸통 윤곽.
 */
export function rackRod81(width = 0.08): THREE.Group {
  const R = ROD81;
  const outline = rackOutline81();
  const g = new THREE.Group();
  const body = mesh(extrude(shapeFrom(outline), width, 0.004), brass());
  body.userData.outline = outline;
  g.add(body);
  g.add(meshAt(lathe(rodProfile(R.r, R.bottom, R.top, 0.005, 0.005), 20), steel(), R.x, 0, 0));
  g.add(meshAt(lathe(rodProfile(R.collarR, R.collarY - R.collarT, R.collarY, 0.006, 0.006), 28), darkSteel(), R.x, 0, 0));
  g.add(meshAt(new THREE.BoxGeometry(0.05, 0.012, 0.008), paint(MARK), R.x, R.collarY - 0.06, width / 2 + 0.003));
  setMM(g, { kind: 'part', fn: 'rackRod81', module: K81.module, teeth: K81.rackTeeth });
  return g;
}

/**
 * 안내판(고정): 원점 = 막대 축이 지나는 구멍 중심(판 두께 가운데). 가로 판(폭 0.24, 두께 t) + 뒤판(z = STAGE.backZ)까지 가는 받침 팔.
 * zc = 막대 축의 z(그룹은 (x, y, zc) 에 놓는다).
 */
export function guideBracket81(zc: number, t: number = ROD81.guideT): THREE.Group {
  const g = new THREE.Group();
  const plate = new THREE.Shape();
  plate.moveTo(-0.12, -0.055);
  plate.lineTo(0.12, -0.055);
  plate.lineTo(0.12, 0.055);
  plate.lineTo(-0.12, 0.055);
  plate.closePath();
  plate.holes.push(circlePath(0, 0, ROD81.r + 0.004));
  const geo = extrude(plate, t, 0.004);
  geo.rotateX(Math.PI / 2); // 판 법선을 Y 로
  g.add(mesh(geo, castIron()));
  const len = zc - 0.055 - STAGE.backZ;
  g.add(meshAt(new THREE.BoxGeometry(0.08, t, len), castIron(), 0, 0, -0.055 - len / 2));
  setMM(g, { kind: 'part', fn: 'guideBracket81' });
  return g;
}

// ═════════════════════════ 082 두 발판으로 돌리는 래칫 ═════════════════════════
// 좌표는 전시 좌표 그대로(정면 XY). 래칫 바퀴 A 는 반시계로 돈다. 팔 B 둘은 바퀴 축에 헐겁게 끼워져 흔들리고,
// 팔 끝 핀 Q 에 미는 폴이 달려 있다. 팔 끝의 귀 E 와 발판 D 를 이음대가 잇는다. 두 발판은 풀리 C 를 넘는 줄로 서로 묶였다.

const K82_BASE = {
  /** 바퀴 축, 발판 받침축 */
  W: [-0.78, 2.23] as V2,
  F: [-1.39, 0.756] as V2,
  teeth: 30,
  Ra: 0.936,
  Rr: 0.85,
  /** 팔: 폴 핀 반지름, 이음대 귀 반지름(1 = 위 팔·앞, 2 = 아래 팔·뒤) */
  rQ: 1.03,
  rE1: 1.28,
  rE2: 1.16,
  /** 발판: 이음대가 걸리는 자리(받침축에서), 줄이 걸리는 자리, 전체 길이 */
  rho1: 2.0,
  rho2: 1.716,
  rhoC: 2.352,
  tLen: 3.05,
  /** 판화 자세: 올라간 발판의 기울기, 위 팔 꼭대기 각, 아래 팔 바닥 각 */
  gTop: 2.97 * DEG,
  aTop1: 15.6 * DEG,
  aBot2: -26.6 * DEG,
  /** 위 폴의 핀 → 코 사이 중심각, 헛걸음 각 */
  kappa1: 18.8 * DEG,
  eps: 0.6 * DEG
} as const;

function armAngle82(rE: number, rho: number, len: number, gamma: number): number {
  const B = K82_BASE;
  const tx = B.F[0] + rho * Math.cos(gamma);
  const ty = B.F[1] + rho * Math.sin(gamma);
  const dx = tx - B.W[0];
  const dy = ty - B.W[1];
  const d = Math.hypot(dx, dy);
  const a = (rE * rE - len * len + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, rE * rE - a * a));
  const ux = dx / d;
  const uy = dy / d;
  // W→T 의 왼쪽(반시계 쪽) 해
  return Math.atan2(a * uy + h * ux, a * ux - h * uy);
}

function rodLen82(rE: number, rho: number, alpha: number, gamma: number): number {
  const B = K82_BASE;
  return Math.hypot(B.W[0] + rE * Math.cos(alpha) - B.F[0] - rho * Math.cos(gamma), B.W[1] + rE * Math.sin(alpha) - B.F[1] - rho * Math.sin(gamma));
}

export const K82 = (() => {
  const B = K82_BASE;
  const q = TAU / B.teeth;
  const len1 = rodLen82(B.rE1, B.rho1, B.aTop1, B.gTop);
  // 발판 진폭 G: 두 팔의 흔들림 합 = 톱니 2개 + 헛걸음 2개가 되게(이분법)
  const swing = (G: number): { s1: number; s2: number; len2: number } => {
    const len2 = rodLen82(B.rE2, B.rho2, B.aBot2, B.gTop - 2 * G);
    const s1 = B.aTop1 - armAngle82(B.rE1, B.rho1, len1, B.gTop - 2 * G);
    const s2 = armAngle82(B.rE2, B.rho2, len2, B.gTop) - B.aBot2;
    return { s1, s2, len2 };
  };
  let lo = 1.5 * DEG;
  let hi = 6 * DEG;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const s = swing(mid);
    if (s.s1 + s.s2 < 2 * q + 2 * B.eps) lo = mid;
    else hi = mid;
  }
  const G = (lo + hi) / 2;
  const sw = swing(G);
  // 아래 폴의 중심각: 위 팔이 꼭대기일 때 아래 폴이 톱니 면 뒤로 eps 만큼 떨어져 있게
  const nu1max = B.aTop1 + B.kappa1;
  let kappa2 = nu1max - B.eps - B.aBot2;
  let M = 0;
  while (kappa2 - q > 22 * DEG) {
    kappa2 -= q;
    M++;
  }
  const lp = (kappa: number): number => Math.sqrt(B.rQ * B.rQ + B.Rr * B.Rr - 2 * B.rQ * B.Rr * Math.cos(kappa));
  return {
    ...B, q, G, gMid: B.gTop - G, len1, len2: sw.len2, swing1: sw.s1, swing2: sw.s2,
    kappa2, M, Lp1: lp(B.kappa1), Lp2: lp(kappa2),
    /** 풀리 C: 줄 중심 반지름, 축 높이, 축의 x(= 줄이 걸리는 자리) */
    ropeR: 0.122, pulleyY: 1.72, pulleyX: B.F[0] + B.rhoC * Math.cos(B.gTop - G)
  } as const;
})();

export interface K82State {
  /** 발판 기울기(1 = 앞 발판, 2 = 뒤 발판) */
  g1: number;
  g2: number;
  /** 팔 각(1 = 위 팔, 2 = 아래 팔) */
  a1: number;
  a2: number;
  /** 바퀴 A 의 누적 회전각(반시계) — rotation.z */
  wheel: number;
  /** 폴의 전시 좌표 방향각(핀 → 코) — 폴 그룹 rotation.z */
  b1: number;
  b2: number;
  /** 지금 바퀴를 미는 폴 */
  pusher: 1 | 2;
  /** 풀리 C 의 회전각(줄이 지나간 길이 ÷ 줄 반지름; 앞 발판이 올라가면 +) */
  pulley: number;
  /** 점들: 폴 핀 Q, 이음대 귀 E, 발판의 이음대 자리 T, 줄 자리 C */
  Q1: V2; Q2: V2; E1: V2; E2: V2; T1: V2; T2: V2; C1: V2; C2: V2;
}

function pawlAngle82(alpha: number, kappa: number, Lp: number, behind: number): number {
  const K = K82;
  const qx = K.W[0] + K.rQ * Math.cos(alpha);
  const qy = K.W[1] + K.rQ * Math.sin(alpha);
  const nu = alpha + kappa;
  const nx = K.W[0] + K.Rr * Math.cos(nu);
  const ny = K.W[1] + K.Rr * Math.sin(nu);
  const b0 = Math.atan2(ny - qy, nx - qx);
  const d = posMod(behind, K.q);
  if (d < 1e-7 || K.q - d < 1e-7) return b0;
  const face = nu + d; // 코 앞쪽(반시계)의 톱니 곧은 면
  const F = (eta: number): number => {
    const x = qx + Lp * Math.cos(b0 - eta) - K.W[0];
    const y = qy + Lp * Math.sin(b0 - eta) - K.W[1];
    let back = face - Math.atan2(y, x);
    back = posMod(back + Math.PI, TAU) - Math.PI;
    const f = Math.max(0, Math.min(1, back / K.q));
    return Math.hypot(x, y) - (K.Rr + (K.Ra - K.Rr) * f);
  };
  let lo = 0;
  let hi = 0.7;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (F(mid) < 0) lo = mid;
    else hi = mid;
  }
  return b0 - hi;
}

/** 082 의 모든 자세. theta = 구동 누적각(발판 한 번 왕복 = 2π). theta = 0 이 판화 자세(앞 발판·위 팔이 꼭대기) */
export function k82State(theta: number): K82State {
  const K = K82;
  const c = Math.cos(theta);
  const g1 = K.gMid + K.G * c;
  const g2 = K.gMid - K.G * c;
  const a1 = armAngle82(K.rE1, K.rho1, K.len1, g1);
  const a2 = armAngle82(K.rE2, K.rho2, K.len2, g2);
  const A1 = a1 + K.kappa1 + 2 * K.q * Math.floor((theta + Math.PI) / TAU);
  const A2 = a2 + K.kappa2 + K.q * K.M + 2 * K.q * Math.floor(theta / TAU);
  // 넘겨받는 사이(헛걸음)에는 바퀴가 제자리에 선다(뒤로 돌지 않음): 직전 꼭대기 값 P
  const turn = Math.floor(theta / TAU);
  const half = posMod(theta, TAU) < Math.PI;
  const P = half ? K.aTop1 + K.kappa1 + 2 * K.q * turn : K.aBot2 + K.swing2 + K.kappa2 + K.q * K.M + 2 * K.q * turn;
  const wheel = Math.max(A1, A2, P);
  const pt = (o: V2, r: number, a: number): V2 => [o[0] + r * Math.cos(a), o[1] + r * Math.sin(a)];
  const C1 = pt(K.F, K.rhoC, g1);
  const C0 = K.F[1] + K.rhoC * Math.sin(K.gMid);
  return {
    g1, g2, a1, a2, wheel,
    b1: pawlAngle82(a1, K.kappa1, K.Lp1, wheel - A1),
    b2: pawlAngle82(a2, K.kappa2, K.Lp2, wheel - A2),
    pusher: A1 >= A2 ? 1 : 2,
    pulley: (C1[1] - C0) / K.ropeR,
    Q1: pt(K.W, K.rQ, a1), Q2: pt(K.W, K.rQ, a2),
    E1: pt(K.W, K.rE1, a1), E2: pt(K.W, K.rE2, a2),
    T1: pt(K.F, K.rho1, g1), T2: pt(K.F, K.rho2, g2),
    C1, C2: pt(K.F, K.rhoC, g2)
  };
}

/** 래칫 바퀴 A 의 윤곽(로컬, 반시계): 곧은 면이 각 k·q, 그 반시계 쪽이 이끝이고 다음 면까지 비스듬히 내려간다 */
export function ratchetOutline82(): V2[] {
  const K = K82;
  const pts: V2[] = [];
  const SUB = 6;
  for (let k = 0; k < K.teeth; k++) {
    for (let i = 0; i <= SUB; i++) {
      const f = i / SUB;
      const a = (k + f) * K.q;
      const r = K.Ra - (K.Ra - K.Rr) * f;
      pts.push([r * Math.cos(a), r * Math.sin(a)]);
    }
  }
  return pts;
}

/** 래칫 바퀴 A. 원점 = 축, 회전축 = 로컬 Z, 폭 width. userData.outline */
export function ratchetWheel82(width = 0.14): THREE.Group {
  const K = K82;
  const outline = ratchetOutline82();
  const shape = shapeFrom(outline);
  shape.holes.push(circlePath(0, 0, 0.055));
  for (let i = 0; i < 6; i++) shape.holes.push(circlePath(Math.cos((i / 6) * TAU + 0.5) * 0.47, Math.sin((i / 6) * TAU + 0.5) * 0.47, 0.15));
  const g = new THREE.Group();
  g.add(mesh(extrude(shape, width, 0.006), brass()));
  const hubGeo = lathe(tubeProfile(0.055, 0.12, -width / 2 - 0.012, width / 2 + 0.012, 0.008), 36);
  hubGeo.rotateX(Math.PI / 2);
  g.add(mesh(hubGeo, darkSteel()));
  g.add(meshAt(new THREE.BoxGeometry(0.09, 0.022, 0.008), paint(MARK), K.Rr - 0.09, 0, width / 2 + 0.003));
  g.userData.outline = outline;
  setMM(g, { kind: 'part', fn: 'ratchetWheel82', teeth: K.teeth, rOut: K.Ra, rRoot: K.Rr, width });
  return g;
}

function pawlPolys82(kappa: number): { body: V2[]; nose: V2[] } {
  const K = K82;
  const lp = Math.sqrt(K.rQ * K.rQ + K.Rr * K.Rr - 2 * K.rQ * K.Rr * Math.cos(kappa));
  // 걸린 자세의 극좌표(바퀴 축 원점, 코 = 각 0·반지름 Rr, 핀 = 각 −kappa·반지름 rQ)에서 그린 뒤 폴 로컬(핀 원점, 코 +X)로 옮긴다
  const Q: V2 = [K.rQ * Math.cos(-kappa), K.rQ * Math.sin(-kappa)];
  const b0 = Math.atan2(-Q[1], K.Rr - Q[0]);
  const toLocal = (r: number, aDeg: number): V2 => rot2([r * Math.cos(aDeg * DEG) - Q[0], r * Math.sin(aDeg * DEG) - Q[1]], -b0);
  const kd = kappa / DEG;
  const cut = -6; // 몸통과 코가 나뉘는 각
  const rIn = K.Ra + 0.02;
  const rOutNose = K.Ra + 0.085;
  const body: V2[] = [];
  const n = 10;
  for (let i = 0; i <= n; i++) {
    const a = -kd - 3.2 + ((cut + kd + 3.2) * i) / n;
    body.push(toLocal(K.rQ + 0.052 + (rOutNose - K.rQ - 0.052) * (i / n), a));
  }
  for (let i = n; i >= 0; i--) {
    const a = -kd - 3.2 + ((cut + kd + 3.2) * i) / n;
    body.push(toLocal(K.rQ - 0.052 + (rIn - (K.rQ - 0.052)) * (i / n), a));
  }
  const nose: V2[] = [toLocal(rOutNose, cut), toLocal(rOutNose - 0.01, -1.2), [lp, 0], toLocal(rIn, cut)];
  return { body, nose };
}

/** 미는 폴의 코 윤곽(폴 로컬: 원점 = 핀, 코 끝 = (Lp, 0)). which = 1(위 팔) / 2(아래 팔) */
export function pawlNoseOutline82(which: 1 | 2): V2[] {
  return pawlPolys82(which === 1 ? K82.kappa1 : K82.kappa2).nose;
}

/**
 * 미는 폴(바퀴 둘레를 따라 굽은 띠 + 뾰족한 코). 원점 = 팔 끝 핀 Q, 코 끝 = (Lp, 0), 두께 thick(z 가운데 0).
 * 그룹 rotation.z = K82State.b1(b2). 코 메시에 userData.outline.
 */
export function pushPawl82(which: 1 | 2, thick = 0.06): THREE.Group {
  const { body, nose } = pawlPolys82(which === 1 ? K82.kappa1 : K82.kappa2);
  const g = new THREE.Group();
  const shape = shapeFrom(body);
  shape.holes.push(circlePath(0, 0, 0.022));
  g.add(mesh(extrude(shape, thick, 0.005), steel()));
  const noseMesh = mesh(extrude(shapeFrom(nose), thick, 0.004), darkSteel());
  noseMesh.userData.outline = nose;
  g.add(noseMesh);
  setMM(g, { kind: 'part', fn: 'pushPawl82', length: which === 1 ? K82.Lp1 : K82.Lp2 });
  return g;
}

/**
 * 흔들 팔 B: 원점 = 바퀴 축(헐거운 고리), +X 로 폴 핀(rQ)과 이음대 귀(rE). 두께 thick(z 가운데 0).
 * 폴 핀은 z = pawlZ(팔 로컬, 바퀴 쪽)까지, 이음대 핀은 z = rodZ(바깥쪽)까지 나온다.
 * userData.pawlPin · userData.rodPin = 그 핀 메시(검사 표식 pin 의 point 가 핀 끝).
 */
export function rockArm82(which: 1 | 2, pawlZ: number, rodZ: number, thick = 0.05): THREE.Group {
  const K = K82;
  const rE = which === 1 ? K.rE1 : K.rE2;
  const g = new THREE.Group();
  const bar = stadiumShape(0.1, 0, rE, 0, 0.034);
  const ring = new THREE.Shape();
  ring.absarc(0, 0, 0.115, 0, TAU, false);
  ring.holes.push(circlePath(0, 0, 0.054));
  const ear = new THREE.Shape();
  ear.absarc(rE, 0, 0.05, 0, TAU, false);
  g.add(mesh(extrude([bar, ring, ear], thick, 0.006), castIron()));
  const pq = pinZ(0.02, Math.min(0, pawlZ), Math.max(0, pawlZ), darkSteel());
  pq.position.set(K.rQ, 0, 0);
  markPin(pq, [0, 0, pawlZ]);
  g.add(pq);
  const pe = pinZ(0.018, Math.min(0, rodZ), Math.max(0, rodZ), darkSteel());
  pe.position.set(rE, 0, 0);
  markPin(pe, [0, 0, rodZ]);
  g.add(pe);
  g.userData.pawlPin = pq;
  g.userData.rodPin = pe;
  setMM(g, { kind: 'part', fn: 'rockArm82', rQ: K.rQ, rE });
  return g;
}

/** 이음대(양 끝 고리 달린 막대): 원점 = 한쪽 고리 중심, +X 로 len 에 다른 고리. 두께 thick(z 가운데 0) */
export function eyeRod82(len: number, thick = 0.03): THREE.Group {
  const g = new THREE.Group();
  const bar = stadiumShape(0, 0, len, 0, 0.02);
  const e0 = new THREE.Shape();
  e0.absarc(0, 0, 0.042, 0, TAU, false);
  e0.holes.push(circlePath(0, 0, 0.018));
  const e1 = new THREE.Shape();
  e1.absarc(len, 0, 0.042, 0, TAU, false);
  e1.holes.push(circlePath(len, 0, 0.018));
  bar.holes.push(circlePath(0, 0, 0.018), circlePath(len, 0, 0.018));
  g.add(mesh(extrude([bar, e0, e1], thick, 0.005), steel()));
  setMM(g, { kind: 'rod', r: 0.02, a: [0, 0, 0], b: [len, 0, 0], length: len });
  return g;
}

/**
 * 발판 D: 원점 = 받침축, +X 로 길이 tLen 의 납작한 막대, 끝에 발 디딤판. 두께 thick(z 가운데 0).
 * 이음대 핀이 rho(받침축에서) 자리에서 z = rodZ 까지 나오고, 줄 고리가 TREADLE82_EYE 에 선다(userData.mm anchor).
 * userData.rodPin · userData.eye = 그 핀·고리 메시.
 */
export function treadle82(which: 1 | 2, rodZ: number, thick = 0.05): THREE.Group {
  const K = K82;
  const rho = which === 1 ? K.rho1 : K.rho2;
  const g = new THREE.Group();
  const bar = stadiumShape(0, 0, K.tLen, 0, 0.03);
  bar.holes.push(circlePath(0, 0, 0.037));
  const hub = new THREE.Shape();
  hub.absarc(0, 0, 0.07, 0, TAU, false);
  hub.holes.push(circlePath(0, 0, 0.037));
  g.add(mesh(extrude([bar, hub], thick, 0.006), wood()));
  g.add(meshAt(new THREE.BoxGeometry(0.3, 0.025, thick + 0.05), darkSteel(), K.tLen - 0.13, 0.042, 0));
  const pe = pinZ(0.018, Math.min(0, rodZ), Math.max(0, rodZ), darkSteel());
  pe.position.set(rho, 0, 0);
  markPin(pe, [0, 0, rodZ]);
  g.add(pe);
  const eye = meshAt(new THREE.TorusGeometry(0.022, 0.007, 10, 24), steel(), K.rhoC, 0.052, 0);
  eye.rotation.y = Math.PI / 2;
  markAnchor(eye, [0, 0, 0]);
  g.add(eye);
  g.userData.rodPin = pe;
  g.userData.eye = eye;
  setMM(g, { kind: 'lever', length: K.tLen, pivot: [0, 0, 0], tip: [K.tLen, 0, 0] });
  return g;
}

/** 발판에서 줄 고리 중심의 자리(발판 로컬) */
export const TREADLE82_EYE: V2 = [K82_BASE.rhoC, 0.052];

/**
 * 풀리 틀 C(고정): 두 기둥(x = ±half) + 발 + 꼭대기 풀리 축(X 방향). 원점 = 바닥(받침 윗면) 위 두 기둥의 가운데.
 * 축 높이 axleY(원점에서), 기둥은 z 두께 0.09. 풀리는 따로 만들어 축 가운데(원점 x)에 끼운다.
 */
export function pulleyFrame82(axleY: number, half = 0.23): THREE.Group {
  const g = new THREE.Group();
  const h = axleY + 0.08;
  for (const s of [-1, 1]) {
    g.add(meshAt(new THREE.BoxGeometry(0.07, h, 0.09), castIron(), s * half, h / 2, 0));
    g.add(meshAt(new THREE.BoxGeometry(0.2, 0.04, 0.2), castIron(), s * (half + 0.035), 0.02, 0));
  }
  const axle = lathe(rodProfile(0.022, -half - 0.05, half + 0.05, 0.004, 0.004), 20);
  axle.rotateZ(Math.PI / 2);
  g.add(meshAt(axle, steel(), 0, axleY, 0));
  setMM(g, { kind: 'part', fn: 'pulleyFrame82', axleY, half });
  return g;
}

/** 발판 받침대(고정): 원점 = 바닥 위. 받침축 높이 axleY 까지 올라온 주철 받침 + 낮은 단(판화의 단) */
export function treadlePedestal82(axleY: number, depth = 0.14): THREE.Group {
  const g = new THREE.Group();
  g.add(meshAt(new THREE.BoxGeometry(0.62, 0.12, depth + 0.3), wood(), 0, 0.06, 0));
  const pts: V2[] = [[-0.2, 0.12], [0.2, 0.12], [0.2, 0.17], [0.07, 0.24], [0.06, axleY + 0.07], [-0.06, axleY + 0.07], [-0.07, 0.24], [-0.2, 0.17]];
  g.add(mesh(extrude(shapeFrom(pts), depth, 0.006), castIron()));
  setMM(g, { kind: 'part', fn: 'treadlePedestal82', axleY });
  return g;
}
