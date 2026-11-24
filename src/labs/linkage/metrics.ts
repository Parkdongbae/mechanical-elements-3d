// 숫자판·그래프 계산 — 순수 TS. 한 바퀴 전체에서 나오는 값은 sweep 에서 실제로 재고, 닫힌 식이 있으면 basis 에 적는다.
import type { MechanismDef, Pose, Readout, Sweep, Vec2 } from './types';
import { fourbarDims, grashof } from './solver';
import type { FourbarDims } from './solver';

const DEG = 180 / Math.PI;
const TWO_PI = Math.PI * 2;

// ───────────── 모양 다듬기 ─────────────
function clean(v: number): number {
  return Math.abs(v) < 5e-10 ? 0 : v;
}
function fixed(v: number, dec: number): string {
  const s = clean(v).toFixed(dec);
  return /^-0(\.0+)?$/.test(s) ? s.slice(1) : s;
}
/** 각도(도) 0.1 단위 */
function degStr(d: number, sign = false): string {
  const s = fixed(d, 1);
  return (sign && clean(d) > 0 && Number(s) !== 0 ? '+' : '') + s + '°';
}
/** 식에 쓰는 수: 소수 둘째 자리까지, 뒤의 0은 뗀다 */
function num(v: number, dec = 2): string {
  return String(Number(clean(v).toFixed(dec)));
}
function lenStr(v: number, unit: string, dec: number): string {
  return `${fixed(v, dec)} ${unit}`;
}
function norm360(d: number): number {
  return ((d % 360) + 360) % 360;
}
function wrap180(d: number): number {
  const x = norm360(d);
  return x > 180 ? x - 360 : x;
}
function pt(p: Pose, id: string): Vec2 {
  return p.pts[id] ?? [0, 0];
}
function angOf(from: Vec2, to: Vec2): number {
  return Math.atan2(to[1] - from[1], to[0] - from[0]);
}
function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}
function qNum(p: Pose): number {
  return typeof p.q === 'number' ? p.q : 0;
}
function minOf(a: number[]): number {
  return a.reduce((m, v) => (v < m ? v : m), Infinity);
}
function maxOf(a: number[]): number {
  return a.reduce((m, v) => (v > m ? v : m), -Infinity);
}
/** 각도(도) 배열을 이어 붙여(unwrap) 튀지 않게 */
function unwrapDeg(a: number[]): number[] {
  const out: number[] = [];
  let prev = 0;
  a.forEach((v, i) => {
    if (i === 0) out.push(v);
    else {
      let d = v - prev;
      while (d > 180) d -= 360;
      while (d < -180) d += 360;
      out.push((out[i - 1] as number) + d);
    }
    prev = v;
  });
  return out;
}

// ───────────── sweep 값 기억(숫자판은 0.1초마다 불린다) ─────────────
const memoMap = new WeakMap<Sweep, Map<string, unknown>>();
function memo<T>(sw: Sweep, key: string, make: () => T): T {
  let m = memoMap.get(sw);
  if (!m) {
    m = new Map<string, unknown>();
    memoMap.set(sw, m);
  }
  if (m.has(key)) return m.get(key) as T;
  const v = make();
  m.set(key, v);
  return v;
}

// ───────────── 그라스호프 식 한 줄 ─────────────
export function grashofText(a: number, b: number, c: number, d: number): string {
  const g = grashof(a, b, c, d);
  if (g.kind === 'impossible') return `${num(g.l)} ≥ ${num(g.s)} + ${num(g.p)} + ${num(g.q)} = ${num(g.s + g.p + g.q)} → 조립 불가`;
  const lhs = `${num(g.s)} + ${num(g.l)}`;
  const rhs = `${num(g.p)} + ${num(g.q)}`;
  if (g.kind === 'change-point') return `${lhs} = ${rhs} = ${num(g.s + g.l)} → 경계`;
  if (g.kind === 'non-grashof') return `${lhs} = ${num(g.s + g.l)} > ${rhs} = ${num(g.p + g.q)} → 불만족 → 이중 로커(어느 링크도 한 바퀴 돌지 못해요)`;
  const head = `${lhs} = ${num(g.s + g.l)} ≤ ${rhs} = ${num(g.p + g.q)} → 만족, 가장 짧은 링크가 `;
  if (g.kind === 'crank-rocker') return head + '구동 링크 → 크랭크-로커';
  if (g.kind === 'double-crank') return head + '고정 링크 → 이중 크랭크';
  if (g.kind === 'double-rocker') return head + '커플러 → 이중 로커';
  return head + '따라 움직이는 링크 → 크랭크-로커(한 바퀴 도는 쪽은 c)';
}

/** 전달각 μ(도) — 커플러와 따라 움직이는 링크 사이의 각 */
function transmission(f: FourbarDims, pose: Pose): number {
  const aO4 = dist(pt(pose, f.A), pt(pose, f.o4));
  const cs = (f.b * f.b + f.c * f.c - aO4 * aO4) / (2 * f.b * f.c);
  return Math.acos(Math.max(-1, Math.min(1, cs))) * DEG;
}
/** 따라 움직이는 링크 각 ψ(도) = atan2(B − O4) */
function followerAngle(f: FourbarDims, pose: Pose): number {
  return angOf(pt(pose, f.o4), pt(pose, f.B)) * DEG;
}
/** 전달각 색 띠 기준: 'good' 40°~140° 사이(90°에 가까울수록 좋음) / 'warn' 40° 미만·140° 초과 */
export function transmissionBand(mu: number): 'good' | 'warn' {
  return mu < 40 || mu > 140 ? 'warn' : 'good';
}

function psiStats(f: FourbarDims, sw: Sweep, key: string): { min: number; max: number; rot: boolean; un: number[] } {
  return memo(sw, key + ':psi', () => {
    const raw = sw.poses.map((p) => followerAngle(f, p));
    const un = unwrapDeg(raw);
    let winding = (un[un.length - 1] ?? 0) - (un[0] ?? 0);
    if (sw.full && raw.length > 1) winding += wrap180((raw[0] as number) - (raw[raw.length - 1] as number)); // 닫는 구간
    const rot = sw.full && Math.abs(winding) > 180;
    return { min: minOf(un), max: maxOf(un), rot, un };
  });
}
function muStats(f: FourbarDims, sw: Sweep, key: string): { min: number; max: number } {
  return memo(sw, key + ':mu', () => {
    const v = sw.poses.map((p) => transmission(f, p));
    return { min: minOf(v), max: maxOf(v) };
  });
}

function fourbarCommon(def: MechanismDef, f: FourbarDims, pose: Pose, sw: Sweep): Readout[] {
  const theta = norm360(angOf(pt(pose, f.o2), pt(pose, f.A)) * DEG);
  const psi = followerAngle(f, pose);
  const ps = psiStats(f, sw, def.id);
  const mu = transmission(f, pose);
  const ms = muStats(f, sw, def.id);
  const out: Readout[] = [
    { key: 'theta', label: '크랭크 각 θ', value: degStr(theta) },
    { key: 'psi', label: '로커 각 ψ', value: degStr(psi), basis: 'ψ = atan2(B − O4)' },
  ];
  if (ps.rot) out.push({ key: 'swing', label: '로커의 움직임', value: '한 바퀴 돌아요' });
  else
    out.push({
      key: 'swing',
      label: '흔들리는 범위',
      value: degStr(ps.max - ps.min),
      basis: `ψ 최대 − ψ 최소 = ${degStr(ps.max)} − ${degStr(ps.min)}`,
    });
  out.push({
    key: 'mu',
    label: '전달각 μ',
    value: degStr(mu),
    basis: `μ = acos((b² + c² − |AO4|²) / (2bc)), b = ${num(f.b)}, c = ${num(f.c)}`,
  });
  out.push({ key: 'muRange', label: '전달각의 범위', value: `${degStr(ms.min)} ~ ${degStr(ms.max)}` });
  return out;
}

// ───────────── 기구별 숫자판 ─────────────
function crankRocker(def: MechanismDef, pose: Pose, sw: Sweep): Readout[] {
  const f = fourbarDims(def);
  if (!f) return [];
  return [...fourbarCommon(def, f, pose, sw), { key: 'grashof', label: '그라스호프 조건', value: grashofText(f.a, f.b, f.c, f.d) }];
}

function parallel(def: MechanismDef, pose: Pose): Readout[] {
  const f = fourbarDims(def);
  if (!f) return [];
  const left = angOf(pt(pose, f.o2), pt(pose, f.A)) * DEG;
  const right = angOf(pt(pose, f.o4), pt(pose, f.B)) * DEG;
  const slope = wrap180(angOf(pt(pose, f.A), pt(pose, f.B)) * DEG);
  return [
    { key: 'left', label: '왼쪽 바퀴 각', value: degStr(norm360(left)) },
    { key: 'right', label: '오른쪽 바퀴 각', value: degStr(norm360(right)) },
    { key: 'diff', label: '두 각의 차', value: degStr(wrap180(right - left)) },
    { key: 'slope', label: '연결봉의 기울기', value: degStr(slope), basis: '연결봉 A–B 가 고정 링크와 나란하면 0°' },
    { key: 'grashof', label: '그라스호프 조건', value: grashofText(f.a, f.b, f.c, f.d) },
  ];
}

function steeringNeutral(f: FourbarDims): { left: number; right: number } {
  const t0 = -90 + Math.asin((f.d - f.b) / 2 / f.a) * DEG; // 왼쪽 팔 중립 각
  return { left: t0, right: -180 - t0 };
}
function steering(def: MechanismDef, pose: Pose): Readout[] {
  const f = fourbarDims(def);
  if (!f) return [];
  const n = steeringNeutral(f);
  const theta = angOf(pt(pose, f.o2), pt(pose, f.A)) * DEG;
  const dL = wrap180(theta - n.left);
  const dR = wrap180(followerAngle(f, pose) - n.right);
  const gap = Math.abs(Math.abs(dL) - Math.abs(dR));
  let curve: string;
  if (Math.abs(dL) < 0.05 && Math.abs(dR) < 0.05) curve = '지금은 곧게 가는 중이에요';
  else if (gap < 0.05) curve = `지금은 ${dL > 0 ? '왼쪽' : '오른쪽'} 커브 — 두 바퀴가 같은 각이에요`;
  else {
    const leftInner = dL > 0 ? Math.abs(dL) > Math.abs(dR) : Math.abs(dR) > Math.abs(dL);
    curve = `지금은 ${dL > 0 ? '왼쪽' : '오른쪽'} 커브 — 안쪽 바퀴가 ${degStr(gap)} 더 꺾였어요`;
    if (!leftInner) curve = `지금은 ${dL > 0 ? '왼쪽' : '오른쪽'} 커브 — 바깥쪽 바퀴가 ${degStr(gap)} 더 꺾였어요`;
  }
  return [
    { key: 'dL', label: '왼쪽 바퀴 꺾임각 δL', value: degStr(dL, true), basis: `δL = θ − θ0 = θ − (${degStr(n.left)})` },
    { key: 'dR', label: '오른쪽 바퀴 꺾임각 δR', value: degStr(dR, true), basis: `δR = atan2(B − O4) − (${degStr(n.right)})` },
    { key: 'diff', label: '두 각의 차', value: degStr(Math.abs(dL) - Math.abs(dR), true), basis: '|δL| − |δR|' },
    { key: 'curve', label: '커브', value: curve },
    { key: 'grashof', label: '그라스호프 조건', value: grashofText(f.a, f.b, f.c, f.d) },
  ];
}

function sliderCrank(def: MechanismDef, pose: Pose, sw: Sweep): Readout[] {
  const crank = def.steps.find((s) => s.k === 'crank');
  const rp = def.steps.find((s) => s.k === 'rp');
  if (!crank || crank.k !== 'crank' || !rp || rp.k !== 'rp') return [];
  const r = crank.r;
  const l = rp.r;
  const theta = norm360(qNum(pose) * DEG);
  const A = pt(pose, crank.id);
  const C = pt(pose, rp.id);
  const x = C[0];
  const s = x - (l - r);
  const xs = memo(sw, 'xs', () => sw.poses.map((p) => pt(p, rp.id)[0]));
  const stroke = maxOf(xs) - minOf(xs);
  const phi = Math.atan2(A[1] - C[1], C[0] - A[0]) * DEG;
  const phiMax = memo(sw, 'phiMax', () => maxOf(sw.poses.map((p) => Math.abs(Math.atan2(pt(p, crank.id)[1] - pt(p, rp.id)[1], pt(p, rp.id)[0] - pt(p, crank.id)[0]) * DEG))));
  return [
    { key: 'theta', label: '크랭크 각 θ', value: degStr(theta) },
    { key: 'x', label: '피스톤 위치 x', value: lenStr(x, 'cm', 2), basis: `x = r cosθ + √(l² − r² sin²θ), r = ${num(r)}, l = ${num(l)}` },
    { key: 's', label: '가장 안쪽에서 잰 거리 s', value: lenStr(s, 'cm', 2), basis: `s = x − (l − r) = ${fixed(x, 2)} − ${num(l - r)}` },
    { key: 'stroke', label: '행정', value: lenStr(stroke, 'cm', 2), basis: `행정 = 2 × 크랭크 길이 = 2 × ${num(r)} = ${num(2 * r)} cm` },
    { key: 'phi', label: '연결봉 기울기 φ', value: degStr(phi), basis: `φ = asin(r sinθ / l), 최대 ${degStr(phiMax)} = asin(${num(r)} ÷ ${num(l)})` },
  ];
}

function ramStats(def: MechanismDef, sw: Sweep): { tMin: number; tMax: number; min: number; max: number } {
  return memo(sw, 'ram', () => {
    const rp = def.steps.find((s) => s.k === 'rp');
    const id = rp && rp.k === 'rp' ? rp.id : 'R';
    let iMin = 0;
    let iMax = 0;
    sw.poses.forEach((p, i) => {
      const x = pt(p, id)[0];
      if (x < pt(sw.poses[iMin] as Pose, id)[0]) iMin = i;
      if (x > pt(sw.poses[iMax] as Pose, id)[0]) iMax = i;
    });
    const mn = sw.poses[iMin];
    const mx = sw.poses[iMax];
    return {
      tMin: mn ? norm360(qNum(mn) * DEG) : 0,
      tMax: mx ? norm360(qNum(mx) * DEG) : 0,
      min: mn ? pt(mn, id)[0] : 0,
      max: mx ? pt(mx, id)[0] : 0,
    };
  });
}
function quickReturn(def: MechanismDef, pose: Pose, sw: Sweep): Readout[] {
  const crank = def.steps.find((s) => s.k === 'crank');
  const rigid = def.steps.find((s) => s.k === 'rigid');
  const rp = def.steps.find((s) => s.k === 'rp');
  if (!crank || crank.k !== 'crank' || !rigid || rigid.k !== 'rigid' || !rp || rp.k !== 'rp') return [];
  const centre = def.steps.find((s) => s.k === 'fix' && s.id === crank.o);
  const pivot = def.steps.find((s) => s.k === 'fix' && s.id === rigid.a);
  if (!centre || centre.k !== 'fix' || !pivot || pivot.k !== 'fix') return [];
  const rc = crank.r;
  const dc = dist(centre.at, pivot.at);
  const lever = rigid.u;
  const beta = Math.asin(rc / dc) * DEG;
  const slow = 180 + 2 * beta;
  const fast = 180 - 2 * beta;
  const ratio = slow / fast;
  const ratioStr = Math.abs(ratio - Math.round(ratio)) < 0.005 ? `${Math.round(ratio)} : 1` : `${fixed(ratio, 2)} : 1`;
  const theta = norm360(qNum(pose) * DEG);
  const rs = ramStats(def, sw);
  const R = pt(pose, rp.id);
  const stroke = rs.max - rs.min;
  const inFast = norm360(theta - rs.tMin) <= norm360(rs.tMax - rs.tMin);
  return [
    { key: 'theta', label: '크랭크 각 θ', value: degStr(theta) },
    { key: 'ram', label: '램 위치', value: lenStr(R[0], 'cm', 2) },
    {
      key: 'stroke',
      label: '행정',
      value: lenStr(stroke, 'cm', 2),
      basis: `행정 = 2 × 지렛대 길이 × 크랭크 길이 ÷ 중심 거리 = 2 × ${num(lever)} × ${num(rc)} ÷ ${num(dc)} = ${num((2 * lever * rc) / dc)} cm`,
    },
    { key: 'phase', label: '지금 구간', value: inFast ? '빨리 돌아오는 중' : '천천히 가는 중' },
    {
      key: 'ratio',
      label: '시간 비(천천히 : 빨리)',
      value: ratioStr,
      basis: `(180° + 2β) : (180° − 2β) = ${num(slow, 1)}° : ${num(fast, 1)}°, β = asin(${num(rc)} ÷ ${num(dc)}) = ${num(beta, 1)}°`,
    },
  ];
}

function straightLine(def: MechanismDef, pose: Pose, sw: Sweep, axis: 'y' | 'x'): Readout[] {
  const f = fourbarDims(def);
  const P = pt(pose, 'P');
  const isCheb = axis === 'y';
  const line = isCheb ? 4 : 6;
  const k = isCheb ? 1 : 0;
  const dev = Math.abs(P[k] - line);
  const out: Readout[] = [
    { key: 'q', label: '입력 각', value: degStr(qNum(pose) * DEG) },
    { key: 'pos', label: 'P의 위치 (x, y)', value: `(${fixed(P[0], 2)}, ${fixed(P[1], 2)}) cm` },
    {
      key: 'dev',
      label: `곧은 선(${axis}=${line})에서 벗어난 거리`,
      value: lenStr(dev, 'cm', 3),
      basis: `|${axis} − ${line}| = |${fixed(P[k], 3)} − ${line}|`,
    },
  ];
  if (isCheb) {
    const z = memo(sw, 'zone', () => {
      const ps = sw.poses.filter((p) => qNum(p) * DEG >= 40 - 1e-6 && qNum(p) * DEG <= 90 + 1e-6);
      const xs = ps.map((p) => pt(p, 'P')[0]);
      const ds = ps.map((p) => Math.abs(pt(p, 'P')[1] - line));
      return { len: maxOf(xs) - minOf(xs), dev: maxOf(ds) };
    });
    out.push({
      key: 'zone',
      label: '곧은 구간(θ 40°~90°)',
      value: `길이 ${fixed(z.len, 2)} cm, 최대 벗어남 ${fixed(z.dev, 3)} cm`,
      basis: '한 바퀴 훑어 실제로 잰 값',
    });
  } else {
    const z = memo(sw, 'zone', () => {
      const ps = sw.poses.filter((p) => Math.abs(pt(p, 'P')[1] - 1.5) <= 2 + 1e-9);
      return { dev: maxOf(ps.map((p) => Math.abs(pt(p, 'P')[0] - line))) };
    });
    out.push({
      key: 'zone',
      label: '곧은 구간(|y − 1.5| ≤ 2)',
      value: `최대 벗어남 ${fixed(z.dev, 3)} cm`,
      basis: '한 바퀴 훑어 실제로 잰 값',
    });
  }
  if (f) out.push({ key: 'grashof', label: '그라스호프 조건', value: grashofText(f.a, f.b, f.c, f.d) });
  return out;
}

function pantograph(def: MechanismDef, pose: Pose, sw: Sweep): Readout[] {
  const A = def.steps.find((s) => s.k === 'rr' && s.id === 'A');
  const E = def.steps.find((s) => s.k === 'rigid' && s.id === 'E');
  if (!A || A.k !== 'rr' || !E || E.k !== 'rigid') return [];
  const oa = A.ra;
  const oe = E.u;
  const O = pt(pose, 'O');
  const P = pt(pose, 'P');
  const Q = pt(pose, 'Q');
  const first = sw.poses[0];
  const P0 = first ? pt(first, 'P') : P;
  const Q0 = first ? pt(first, 'Q') : Q;
  const dP = dist(P, P0);
  const dQ = dist(Q, Q0);
  const op = dist(O, P);
  const oq = dist(O, Q);
  return [
    { key: 'scale', label: '배율', value: num(oe / oa), basis: `배율 = OE ÷ OA = ${num(oe)} ÷ ${num(oa)} = ${num(oe / oa)}` },
    { key: 'dP', label: 'P가 움직인 거리(시작점 기준)', value: lenStr(dP, 'cm', 2) },
    { key: 'dQ', label: 'Q가 움직인 거리(시작점 기준)', value: lenStr(dQ, 'cm', 2) },
    { key: 'dRatio', label: '두 거리의 비', value: dP > 1e-9 ? fixed(dQ / dP, 2) : '—' },
    { key: 'oRatio', label: '지금 |OQ| ÷ |OP|', value: op > 1e-9 ? fixed(oq / op, 2) : '—', basis: `|OQ| ÷ |OP| = ${fixed(oq, 2)} ÷ ${fixed(op, 2)}` },
  ];
}

interface JansenStat { minY: number; maxY: number; lift: number; run: string; stride: number; arc: number; frac: number }
function jansenStats(sw: Sweep, unit: string): JansenStat {
  return memo(sw, 'jansen:' + unit, () => {
    const ys = sw.poses.map((p) => pt(p, 'F')[1]);
    const minY = minOf(ys);
    const maxY = maxOf(ys);
    const n = ys.length;
    const on = ys.map((y) => y - minY <= 1);
    // 땅에 닿은 가장 긴 연속 구간(원형)
    let bestS = -1;
    let bestLen = 0;
    for (let s = 0; s < n; s++) {
      if (!on[s] || on[(s - 1 + n) % n]) continue;
      let k = 0;
      while (k < n && on[(s + k) % n]) k++;
      if (k > bestLen) {
        bestLen = k;
        bestS = s;
      }
    }
    if (n > 0 && bestLen === n) {
      bestS = 0;
    }
    let run = '없음';
    let stride = 0;
    let arc = 0;
    let frac = 0;
    if (bestS >= 0 && n > 0) {
      const dq = 360 / n;
      arc = bestLen * dq;
      frac = bestLen / n;
      const a0 = norm360((sw.qs[bestS] as number) * DEG);
      const a1 = norm360((sw.qs[(bestS + bestLen - 1) % n] as number) * DEG);
      const xs: number[] = [];
      for (let k = 0; k < bestLen; k++) xs.push(pt(sw.poses[(bestS + k) % n] as Pose, 'F')[0]);
      stride = maxOf(xs) - minOf(xs);
      run = `${degStr(a0)} → ${degStr(a1)} (약 ${fixed(arc, 0)}°, ${fixed(frac * 100, 0)}%)`;
    }
    return { minY, maxY, lift: maxY - minY, run, stride, arc, frac };
  });
}
function jansen(def: MechanismDef, pose: Pose, sw: Sweep): Readout[] {
  const st = jansenStats(sw, def.unit);
  const F = pt(pose, 'F');
  return [
    { key: 'theta', label: '크랭크 각', value: degStr(norm360(qNum(pose) * DEG)) },
    { key: 'h', label: '발끝 높이(가장 낮은 곳 기준)', value: `${fixed(F[1] - st.minY, 1)} ${def.unit}` },
    { key: 'contact', label: '땅에 닿아 있는 구간', value: st.run, basis: '발끝 높이 ≤ 1 단위인 크랭크 각의 범위' },
    { key: 'stride', label: '보폭', value: `${fixed(st.stride, 1)} ${def.unit}`, basis: '땅에 닿은 구간에서 발끝 가로 움직임' },
    { key: 'lift', label: '발을 드는 높이', value: `${fixed(st.lift, 1)} ${def.unit}`, basis: '발끝 높이의 최댓값' },
  ];
}

function gripper(def: MechanismDef, pose: Pose): Readout[] {
  const t1 = def.steps.find((s) => s.k === 'rigid' && s.id === 'T1');
  const j1 = def.steps.find((s) => s.k === 'rr' && s.id === 'J1');
  if (!t1 || t1.k !== 'rigid' || !j1 || j1.k !== 'rr') return [];
  const arm = Math.hypot(t1.u, t1.v);
  const short = j1.rb;
  const T1 = pt(pose, 'T1');
  const T2 = pt(pose, 'T2');
  return [
    { key: 'q', label: '밀대 위치', value: lenStr(pt(pose, 'C')[0], 'cm', 2) },
    { key: 'width', label: '집게 벌어진 폭', value: lenStr(T1[1] - T2[1], 'cm', 2), basis: '폭 = T1의 y − T2의 y' },
    {
      key: 'ratio',
      label: '팔 길이 비',
      value: fixed(arm / short, 2),
      basis: `|F1T1| ÷ |F1J1| = ${fixed(arm, 3)} ÷ ${num(short)} = ${fixed(arm / short, 2)} (끝은 ${fixed(arm / short, 1)}배 크게 움직여요)`,
    },
  ];
}

function custom(def: MechanismDef, pose: Pose, sw: Sweep): Readout[] {
  const f = fourbarDims(def);
  if (!f) return [];
  const g = grashof(f.a, f.b, f.c, f.d);
  if (g.kind === 'impossible' || sw.poses.length === 0) {
    return [{ key: 'grashof', label: '그라스호프 조건', value: grashofText(f.a, f.b, f.c, f.d) }];
  }
  const theta = norm360(angOf(pt(pose, f.o2), pt(pose, f.A)) * DEG);
  const psi = followerAngle(f, pose);
  const mu = transmission(f, pose);
  const ps = psiStats(f, sw, def.id);
  const rangeVal = sw.full ? '한 바퀴(0° ~ 360°)' : `${degStr(norm360(sw.qMin * DEG))} ~ ${degStr(norm360(sw.qMax * DEG))}`;
  const lo = sw.full ? 0 : sw.qMin * DEG;
  const hi = sw.full ? 360 : sw.qMax * DEG;
  return [
    { key: 'theta', label: '구동 링크 각', value: degStr(theta) },
    { key: 'psi', label: '따라 움직이는 링크 각', value: degStr(psi) },
    {
      key: 'mu',
      label: '전달각 μ',
      value: degStr(mu),
      basis: transmissionBand(mu) === 'good' ? '40°~140° 사이 — 설계에서 흔히 쓰는 기준' : '40° 미만이거나 140° 초과 — 주의(설계에서 흔히 쓰는 기준)',
    },
    { key: 'range', label: '구동 링크가 갈 수 있는 범위', value: rangeVal, basis: sw.full ? undefined : `${degStr(lo)} ~ ${degStr(hi)} 사이만 조립돼요` },
    {
      key: 'swing',
      label: '따라 움직이는 링크의 흔들리는 범위',
      value: ps.rot ? '한 바퀴 돌아요' : degStr(ps.max - ps.min),
      basis: ps.rot ? undefined : `ψ 최대 − ψ 최소 = ${degStr(ps.max)} − ${degStr(ps.min)}`,
    },
    { key: 'grashof', label: '그라스호프 조건', value: grashofText(f.a, f.b, f.c, f.d) },
  ];
}

export function readouts(def: MechanismDef, pose: Pose, sw: Sweep): Readout[] {
  switch (def.id) {
    case 'crank-rocker': return crankRocker(def, pose, sw);
    case 'parallel': return parallel(def, pose);
    case 'steering': return steering(def, pose);
    case 'slider-crank': return sliderCrank(def, pose, sw);
    case 'quick-return': return quickReturn(def, pose, sw);
    case 'chebyshev': return straightLine(def, pose, sw, 'y');
    case 'watt': return straightLine(def, pose, sw, 'x');
    case 'pantograph': return pantograph(def, pose, sw);
    case 'jansen': return jansen(def, pose, sw);
    case 'gripper': return gripper(def, pose);
    case 'custom': return custom(def, pose, sw);
    default: return [];
  }
}

// ───────────── 그래프 ─────────────
// ref: 비교용 기준선(조향의 기울기 1 선), bands: 색 띠(빠른 귀환의 천천히/빨리 구간, 입력 단위 rad)
export interface Series {
  label: string;
  unit: string;
  ys: number[];
  ref?: { label: string; ys: number[] };
  bands?: { from: number; to: number; label: string }[];
}

export function series(def: MechanismDef, sw: Sweep): Series | null {
  if (def.input.kind === 'point' || sw.poses.length === 0) return null;
  const ps = sw.poses;
  switch (def.id) {
    case 'crank-rocker': {
      const f = fourbarDims(def);
      if (!f) return null;
      return { label: '로커 각 ψ', unit: '°', ys: ps.map((p) => followerAngle(f, p)) };
    }
    case 'parallel': {
      const f = fourbarDims(def);
      if (!f) return null;
      return { label: '오른쪽 바퀴 각', unit: '°', ys: unwrapDeg(ps.map((p) => angOf(pt(p, f.o4), pt(p, f.B)) * DEG)) };
    }
    case 'steering': {
      const f = fourbarDims(def);
      if (!f) return null;
      const n = steeringNeutral(f);
      return {
        label: '오른쪽 바퀴 꺾임각 δR',
        unit: '°',
        ys: ps.map((p) => wrap180(followerAngle(f, p) - n.right)),
        ref: { label: '두 바퀴가 같은 각일 때(δR = δL)', ys: ps.map((p) => wrap180(angOf(pt(p, f.o2), pt(p, f.A)) * DEG - n.left)) },
      };
    }
    case 'slider-crank': {
      const crank = def.steps.find((s) => s.k === 'crank');
      const rp = def.steps.find((s) => s.k === 'rp');
      if (!crank || crank.k !== 'crank' || !rp || rp.k !== 'rp') return null;
      return { label: '피스톤 위치 s', unit: 'cm', ys: ps.map((p) => pt(p, rp.id)[0] - (rp.r - crank.r)) };
    }
    case 'quick-return': {
      const rs = ramStats(def, sw);
      const a = (rs.tMin * Math.PI) / 180;
      const b = (rs.tMax * Math.PI) / 180;
      const slowLabel = '천천히 가는 구간';
      const fastLabel = '빨리 돌아오는 구간';
      const bands =
        a <= b
          ? [
              { from: 0, to: a, label: slowLabel },
              { from: a, to: b, label: fastLabel },
              { from: b, to: TWO_PI, label: slowLabel },
            ]
          : [
              { from: 0, to: b, label: fastLabel },
              { from: b, to: a, label: slowLabel },
              { from: a, to: TWO_PI, label: fastLabel },
            ];
      return { label: '램 위치', unit: 'cm', ys: ps.map((p) => pt(p, 'R')[0]), bands };
    }
    case 'chebyshev':
      return { label: '곧은 선(y=4)에서 벗어난 거리', unit: 'cm', ys: ps.map((p) => pt(p, 'P')[1] - 4) };
    case 'watt':
      return { label: '곧은 선(x=6)에서 벗어난 거리', unit: 'cm', ys: ps.map((p) => pt(p, 'P')[0] - 6) };
    case 'jansen': {
      const st = jansenStats(sw, def.unit);
      return { label: '발끝 높이', unit: def.unit, ys: ps.map((p) => pt(p, 'F')[1] - st.minY) };
    }
    case 'gripper':
      return { label: '집게 벌어진 폭', unit: 'cm', ys: ps.map((p) => pt(p, 'T1')[1] - pt(p, 'T2')[1]) };
    case 'custom': {
      const f = fourbarDims(def);
      if (!f) return null;
      return { label: '따라 움직이는 링크 각', unit: '°', ys: unwrapDeg(ps.map((p) => followerAngle(f, p))) };
    }
    default:
      return null;
  }
}
