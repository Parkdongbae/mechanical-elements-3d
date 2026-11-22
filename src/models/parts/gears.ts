// 기어 치형 (인벌류트풍) + 기계 파일이 직접 쓰는 기어 메시 빌더
// 치형: 압력각 20°, 이 측면은 기초원에서 시작하는 인벌류트 곡선을 샘플링, 이뿌리 필렛·이끝 원호.

import * as THREE from 'three';
import { brass } from '../materials';
import { type V2, TAU, loft, circlePts, type LoftLayer } from './geom';

const PRESSURE = (20 * Math.PI) / 180;
const inv = (a: number): number => Math.tan(a) - a;

/**
 * 인벌류트 치형 외곽 점열(반시계, 닫힘 생략).
 * ra: 이끝원 반지름, rf: 이뿌리원 반지름, phase: 첫 이의 중심각(기본: 반 피치 → 각도 0에 이골).
 */
export function involuteOutline(teeth: number, ra: number, rf: number, phase = Math.PI / teeth, minTipFrac = 0.06): V2[] {
  const N = teeth;
  const step = TAU / N;
  const ha = (ra - rf) / 2.25;
  const rp = ra - ha;
  const rb = rp * Math.cos(PRESSURE);
  const psiP = (Math.PI / (2 * N)) * 0.96; // 약간의 백래시
  const psi = (R: number): number => (R <= rb ? psiP + inv(PRESSURE) : psiP + inv(PRESSURE) - inv(Math.acos(rb / R)));
  // 이끝이 뾰족해지면 이끝원을 낮춘다
  let rTip = ra;
  const minPsi = minTipFrac * step;
  if (psi(ra) < minPsi) {
    let lo = Math.max(rb, rf);
    let hi = ra;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (psi(mid) > minPsi) lo = mid;
      else hi = mid;
    }
    rTip = lo;
  }
  const psiRoot = psi(rf);
  // 이뿌리 필렛 크기: 이골 폭을 넘지 않게
  const gapHalf = step / 2 - psiRoot;
  const f = Math.max(0, Math.min((rTip - rf) * 0.22, gapHalf * rf * 0.6));
  const pol = (R: number, a: number): V2 => [Math.cos(a) * R, Math.sin(a) * R];

  // 한쪽 측면(이뿌리→이끝) 반지름 샘플: 기초원 근처를 촘촘히
  const flankR: number[] = [];
  const r0 = rf + f;
  const nF = 8;
  for (let k = 0; k <= nF; k++) {
    const t = k / nF;
    flankR.push(r0 + (rTip - r0) * (1 - Math.pow(1 - t, 1.6)));
  }
  if (rb > r0 && rb < rTip) {
    flankR.push(rb);
    flankR.sort((a, b) => a - b);
  }

  const out: V2[] = [];
  for (let i = 0; i < N; i++) {
    const c = phase + i * step;
    // 오른쪽 필렛 (이뿌리 원 → 측면)
    const fa = c - psiRoot - (f > 0 ? f / rf : 0);
    out.push(pol(rf, fa));
    if (f > 0) {
      const p0 = pol(rf, fa);
      const pc = pol(rf, c - psiRoot);
      const p1 = pol(r0, c - psi(r0));
      for (const t of [0.33, 0.66]) {
        const u = 1 - t;
        out.push([u * u * p0[0] + 2 * u * t * pc[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * pc[1] + t * t * p1[1]]);
      }
    }
    for (const R of flankR) out.push(pol(R, c - psi(R)));
    // 이끝 원호
    const pt = psi(rTip);
    for (const t of [0.25, 0.5, 0.75]) out.push(pol(rTip, c - pt + 2 * pt * t));
    for (let k = flankR.length - 1; k >= 0; k--) {
      const R = flankR[k]!;
      out.push(pol(R, c + psi(R)));
    }
    const fb = c + psiRoot + (f > 0 ? f / rf : 0);
    if (f > 0) {
      const p0 = pol(r0, c + psi(r0));
      const pc = pol(rf, c + psiRoot);
      const p1 = pol(rf, fb);
      for (const t of [0.33, 0.66]) {
        const u = 1 - t;
        out.push([u * u * p0[0] + 2 * u * t * pc[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * pc[1] + t * t * p1[1]]);
      }
    }
    out.push(pol(rf, fb));
    // 이골 원호
    const next = c + step - psiRoot - (f > 0 ? f / rf : 0);
    for (const t of [0.33, 0.66]) out.push(pol(rf, fb + (next - fb) * t));
  }
  return out;
}

/** 축 구멍 없는 기어 외곽 Shape — 바깥 반지름 r, 이뿌리 r - toothH (기계 파일 호환) */
export function gearShape(teeth: number, r: number, toothH: number, tipFrac = 0.2): THREE.Shape {
  const pts = involuteOutline(teeth, r, r - toothH, Math.PI / teeth, Math.min(0.12, tipFrac * 0.3));
  const shape = new THREE.Shape();
  pts.forEach(([x, y], i) => (i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)));
  shape.closePath();
  return shape;
}

/** 기계 파일용 기어 재질: 지정 색의 가공 금속 */
function gearMaterial(color: number): THREE.MeshStandardMaterial {
  return brass({ color, roughness: 0.32 });
}

/** 양끝 이끝 모따기 + 구멍 모따기 층 구성 */
function chamferLayers(depth: number, c: number, sTip: number, sHole: number, rot: (z: number) => number = () => 0, inner = 1): LoftLayer[] {
  const z0 = -depth / 2;
  const z1 = depth / 2;
  const layers: LoftLayer[] = [{ z: z0, s: sTip, hs: sHole, rot: rot(z0) }];
  const n = Math.max(1, inner);
  for (let i = 0; i <= n; i++) {
    const z = z0 + c + ((depth - 2 * c) * i) / n;
    layers.push({ z, s: 1, hs: 1, rot: rot(z) });
  }
  layers.push({ z: z1, s: sTip, hs: sHole, rot: rot(z1) });
  return layers;
}

/** 축(Z) 구멍이 뚫린 평기어 메시 */
export function buildSpurGearMesh(teeth: number, r: number, toothH: number, depth: number, color: number = 0xd4a94a): THREE.Mesh {
  const outline = involuteOutline(teeth, r, r - toothH);
  const bore = r * 0.16;
  const c = Math.min(toothH * 0.2, depth * 0.14);
  const geo = loft(outline, [circlePts(bore, 32).reverse()], chamferLayers(depth, c, (r - c) / r, (bore + c) / bore));
  const m = new THREE.Mesh(geo, gearMaterial(color));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** 프로파일을 연속적으로 비틀어 직접 만든 헬리컬 기어(층 계단 없음) — twist: 전체 비틀림각(rad) */
export function buildHelicalGearMesh(
  teeth: number,
  r: number,
  toothH: number,
  depth: number,
  twist = 0.55,
  color: number = 0xd4a94a
): THREE.Mesh {
  const outline = involuteOutline(teeth, r, r - toothH);
  const bore = r * 0.16;
  const c = Math.min(toothH * 0.2, depth * 0.1);
  const geo = loft(
    outline,
    [circlePts(bore, 32).reverse()],
    chamferLayers(depth, c, (r - c) / r, (bore + c) / bore, (z) => (twist * z) / depth, 14)
  );
  const m = new THREE.Mesh(geo, gearMaterial(color));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** 이가 원뿔 꼭짓점 쪽으로 수렴하는 베벨 기어 (z=-depth/2가 큰 쪽) */
export function buildBevelGearMesh(
  teeth: number,
  r: number,
  toothH: number,
  depth: number,
  shrink = 0.55,
  color: number = 0xd4a94a
): THREE.Mesh {
  const outline = involuteOutline(teeth, r, r - toothH);
  const bore = Math.max(r * shrink * 0.16, r * 0.1);
  const c = Math.min(toothH * 0.2, depth * 0.1);
  const z0 = -depth / 2;
  const sAt = (z: number): number => 1 - ((1 - shrink) * (z - z0)) / depth;
  const layers: LoftLayer[] = [
    { z: z0, s: (r - c) / r, hs: (bore + c) / bore },
    { z: z0 + c, s: sAt(z0 + c), hs: 1 },
    { z: depth / 2 - c * 0.6, s: sAt(depth / 2 - c * 0.6), hs: 1 },
    { z: depth / 2, s: sAt(depth / 2) * (1 - (c * 0.6) / r), hs: (bore + c * 0.6) / bore }
  ];
  const geo = loft(outline, [circlePts(bore, 32).reverse()], layers);
  const m = new THREE.Mesh(geo, gearMaterial(color));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** 표준 비율 기어 치수: 잇수·피치원 반지름 → 이끝/이뿌리 */
export function gearDims(teeth: number, rp: number): { m: number; ra: number; rf: number } {
  const m = (2 * rp) / teeth;
  return { m, ra: rp + m, rf: rp - 1.25 * m };
}

/**
 * 롤러 체인용 스프로킷 외곽: 피치원 위 롤러 자리(원호 이골) + 볼록한 이 측면 + 좁은 이끝.
 * 각 이골 중심이 각도 phase + i·step.
 */
export function sprocketOutline(teeth: number, pitch: number, rollerR: number, phase = 0): V2[] {
  const N = teeth;
  const step = TAU / N;
  const Rp = pitch / (2 * Math.sin(Math.PI / N));
  const rs = rollerR * 1.03;
  const Rt = Rp + pitch * 0.32;
  const dS = Math.asin(Math.min(0.999, rs / Rp));
  const dT = step / 2 - step * 0.07; // 이끝 원호 시작
  const seat = (d: number): number => Rp * Math.cos(d) - Math.sqrt(Math.max(0, rs * rs - Rp * Rp * Math.sin(d) * Math.sin(d)));
  const rSeatEnd = seat(dS * 0.985);
  const radius = (d: number): number => {
    const a = Math.abs(d);
    if (a < dS * 0.985) return seat(a);
    if (a >= dT) return Rt;
    const t = (a - dS * 0.985) / (dT - dS * 0.985);
    return rSeatEnd + (Rt - rSeatEnd) * Math.sin((t * Math.PI) / 2);
  };
  const out: V2[] = [];
  const per = 36;
  for (let i = 0; i < N; i++) {
    for (let k = 0; k < per; k++) {
      // 이골 근처를 촘촘히 (코사인 분포)
      const t = k / per;
      const d = -step / 2 + step * t;
      const a = phase + i * step + d;
      const R = radius(d);
      out.push([Math.cos(a) * R, Math.sin(a) * R]);
    }
  }
  return out;
}
