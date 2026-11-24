// 507 기계 운동 자동 검사기 (작업 지시서 20 · 3-4)
//
//   node scripts/mm507/autocheck.mjs <n|a-b|n,n,…> [--jobs 4] [--no-shots] [--sheet] [--base http://localhost:5274/]
//                                    [--file src/mm507/models/_old_m017.ts]   (그 모듈을 n 번으로 검사 — 옛 판 비교용, 번호 하나만)
//                                    [--times 1,1.6] [--out shots/mm/auto]
//   → shots/mm/auto/NNN.json (판정), NNN-cmp.png (판화 | t1 정면 | t2 정면 | 비스듬), NNN-close.png (근접 격자)
//     표준 출력에 번호별 한 줄 요약. 종료 코드 0 = 전부 fail 없음.
//   --sheet: shots/mm/auto/sheet-AAA-BBB.html (번호마다 cmp 한 줄 + 판정) — 사용자 확인용 1쪽
//
// 검사 서버: npm run dev:check (포트 5274, HMR 끔). 5273 은 사용자·수동 확인용이라 쓰지 않는다.
// 검사 기준은 모델이 아니라 설계표(docs/mm507-sheets/NNN.md)의 「검사 선언」 JSON 에서 읽는다(없는 항목은 자동/건너뜀).
// 부품 정보는 키트가 남긴 userData.mm(필드 표: shots/_verify/USERDATA.md)에서 읽는다 — 표식이 없으면 그 검사는 「건너뜀」.

import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

// ───────────────────────── 인자 ─────────────────────────
const argv = process.argv.slice(2);
const opt = { jobs: 4, shots: true, sheet: false, base: process.env.BASE_URL ?? 'http://localhost:5274/', file: null, times: null, out: 'shots/mm/auto' };
const nums = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--jobs') opt.jobs = Math.max(1, Number(argv[++i]));
  else if (a === '--no-shots') opt.shots = false;
  else if (a === '--sheet') opt.sheet = true;
  else if (a === '--base') opt.base = argv[++i].replace(/\/?$/, '/');
  else if (a === '--file') opt.file = argv[++i];
  else if (a === '--times') opt.times = argv[++i].split(',').map(Number);
  else if (a === '--out') opt.out = argv[++i];
  else if (/^[\d,\-]+$/.test(a)) {
    for (const part of a.split(',')) {
      const m = /^(\d+)-(\d+)$/.exec(part);
      if (m) for (let k = Number(m[1]); k <= Number(m[2]); k++) nums.push(k);
      else if (part) nums.push(Number(part));
    }
  } else {
    console.error(`알 수 없는 인자: ${a}`);
    process.exit(2);
  }
}
if (!nums.length) {
  console.error('사용: node scripts/mm507/autocheck.mjs <n|a-b|n,n,…> [--jobs 4] [--no-shots] [--sheet] [--base URL] [--file 모듈.ts]');
  process.exit(2);
}
if (opt.file && nums.length !== 1) {
  console.error('--file 은 번호 하나와 같이 쓴다');
  process.exit(2);
}
const id3 = (n) => String(n).padStart(3, '0');
mkdirSync(opt.out, { recursive: true });

// ───────────────────────── 설계표 「검사 선언」 ─────────────────────────
/** docs/mm507-sheets/NNN.md 에서 「검사 선언」 제목 뒤 첫 ```json 블록 */
function readDecl(n) {
  const p = `docs/mm507-sheets/${id3(n)}.md`;
  if (!existsSync(p)) return { decl: {}, src: null, err: null };
  const md = readFileSync(p, 'utf8');
  const h = md.search(/^#+[^\n]*검사\s*선언/m);
  if (h < 0) return { decl: {}, src: null, err: null };
  const m = /```json\s*\n([\s\S]*?)```/.exec(md.slice(h));
  if (!m) return { decl: {}, src: p, err: '검사 선언 절은 있으나 ```json 블록이 없음' };
  try {
    return { decl: JSON.parse(m[1]), src: p, err: null };
  } catch (e) {
    return { decl: {}, src: p, err: `검사 선언 JSON 읽기 실패: ${e.message}` };
  }
}

// ───────────────────────── 페이지 안 검사 ─────────────────────────
// page.evaluate 로 넘기는 자기완결 함수. window.__mm(preview.ts) 의 같은 모델 인스턴스를 쓴다.
async function pageAnalyze({ decl, times: T0 }) {
  const M = window.__mm;
  const THREE = M.THREE;
  const g = M.group;
  const model = M.model;
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const r3 = (x) => (Number.isFinite(x) ? Math.round(x * 1000) / 1000 : x);
  const deg = (r) => (r * 180) / Math.PI;
  const checks = [];
  const spots = []; // 근접 격자에 넣을 자리 {p:[x,y,z], s, level, label}
  const add = (id, name, status, detail, extra = {}) => checks.push({ id, name, status, detail, ...extra });
  const spot = (p, s, level, label) => spots.push({ p: [r3(p.x), r3(p.y), r3(p.z)], s: r3(s), level, label });
  const times = (decl.times && decl.times.length >= 2 ? decl.times : T0).slice();
  const t1 = times[0];
  const t2 = times[1];

  // ── 물체 분류 ──
  const visibleChain = (o) => {
    for (let c = o; c; c = c.parent) if (!c.visible) return false;
    return true;
  };
  const kindOf = (o) => o.userData?.mm?.kind;
  const under = (o, kinds) => {
    for (let c = o; c && c !== g.parent; c = c.parent) if (kinds.includes(kindOf(c))) return c;
    return null;
  };
  const isOverlay = (o) => o.isSprite || o.userData?.mmTag === true || (o.layers && o.layers.mask === 2) || under(o, ['arrow', 'tag']);
  const stand = (() => {
    let s = null;
    g.traverse((o) => {
      if (!s && kindOf(o) === 'stand') s = o;
    });
    return s;
  })();
  const inStand = (o) => {
    for (let c = o; c; c = c.parent) if (c === stand) return true;
    return false;
  };
  const meshes = () => {
    const a = [];
    g.traverse((o) => {
      if (o.isMesh && !isOverlay(o) && visibleChain(o)) a.push(o);
    });
    return a;
  };
  const byKind = (k) => {
    const a = [];
    g.traverse((o) => {
      if (kindOf(o) === k && visibleChain(o)) a.push(o);
    });
    return a;
  };
  const anyMM = (() => {
    let n = 0;
    g.traverse((o) => {
      if (o.userData?.mm) n++;
    });
    return n;
  })();
  const SKIP_NO_MM = 'userData.mm 표식 없음(옛 모델) — 건너뜀';

  const seek = (t, sp = 1) => {
    M.seek(t, sp);
    g.updateMatrixWorld(true);
  };
  const wpos = (o, p = [0, 0, 0]) => o.localToWorld(V(p[0], p[1], p[2]));
  const wdir = (o, d) => V(...d).transformDirection(o.matrixWorld);
  const axisVec = (a) => (a === 'x' ? [1, 0, 0] : a === 'y' ? [0, 1, 0] : [0, 0, 1]);

  // ── 메시 꼭짓점·상자 ──
  const vertsOf = (o, cap = 3000) => {
    const out = [];
    o.traverse((c) => {
      if (!c.isMesh || isOverlay(c) || !visibleChain(c)) return;
      const p = c.geometry?.attributes?.position;
      if (!p) return;
      const k = Math.max(1, Math.floor(p.count / cap));
      for (let i = 0; i < p.count; i += k) out.push(V().fromBufferAttribute(p, i).applyMatrix4(c.matrixWorld));
    });
    return out;
  };
  const boxOf = (o) => {
    const b = new THREE.Box3();
    for (const v of vertsOf(o)) b.expandByPoint(v);
    return b;
  };

  // ── 바퀴 ──
  /** 바퀴 표식 → 검사용 원판 목록(단차는 단마다 하나) */
  const wheelDiscs = () => {
    const out = [];
    for (const o of byKind('wheel')) {
      const mm = o.userData.mm;
      const c = wpos(o);
      const d = wdir(o, axisVec(mm.axis ?? 'z'));
      const span = mm.span ?? (mm.zMin !== undefined ? [mm.zMin, mm.zMax] : [-(mm.width ?? 0.1) / 2, (mm.width ?? 0.1) / 2]);
      const name = o.name || mm.fn || 'wheel';
      const base = { obj: o, mm, c, d, name, rim: mm.rim ?? 'flat', groove: mm.groove };
      if (Array.isArray(mm.steps) && mm.steps.length) {
        mm.steps.forEach((st, i) => out.push({ ...base, name: `${name}[단${i}]`, a0: st.z0, a1: st.z1, R: () => st.r, bottom: st.r, outer: st.r }));
      } else if (mm.r0 !== undefined && mm.r1 !== undefined) {
        const L = mm.length ?? mm.width;
        const R = (a) => {
          const t = Math.min(1, Math.max(0, (a + L / 2) / L));
          return mm.r0 + (mm.r1 - mm.r0) * t + (mm.bulge ?? 0) * Math.sin(Math.PI * t);
        };
        out.push({ ...base, a0: span[0], a1: span[1], R, bottom: Math.min(mm.r0, mm.r1), outer: mm.outer ?? Math.max(mm.r0, mm.r1), cone: true });
      } else {
        const bottom = mm.bottom ?? mm.r;
        out.push({ ...base, a0: span[0], a1: span[1], R: () => bottom, bottom, outer: mm.outer ?? mm.r, ropeR: mm.ropeR, r: mm.r, width: mm.width });
      }
    }
    return out;
  };
  /** 줄 단면 반지름 rho 가 바퀴에 앉을 때 중심선 반지름(축방향 a 에서)과 허용 창 [lo, hi] (중심선 − 자리) */
  const seatOf = (W, rho, flatBelt) => {
    if (W.rim === 'groove' && W.groove === 'round') {
      if (W.ropeR !== undefined && Math.abs(rho - 0.045) < 0.006) return { seat: () => W.ropeR, lo: -0.008, hi: 0.008, kind: '로프+둥근 홈' };
      return { seat: () => W.bottom + rho, lo: -0.008, hi: 0.012, kind: '줄+둥근 홈' };
    }
    if (W.rim === 'groove' && W.groove === 'v') {
      // V 홈: 벽 기울기 0.7(반폭/깊이) — 줄이 두 벽에 닿는 높이. 홈 입구 반폭 gw/2 = min(0.32w, 0.055)/2
      const w = W.width ?? W.a1 - W.a0;
      const gw = Math.min(w * 0.32, 0.055);
      const apex = W.r - gw / 2 / 0.7;
      const s = Math.max(W.bottom + rho, apex + rho / Math.sin(Math.atan(0.7)));
      return { seat: () => s, lo: -0.012, hi: 0.008, kind: '줄+V 홈' };
    }
    // 납작 림(평벨트·마찰 바퀴·원뿔·단차): 띠 안쪽면이 림 위 −0.002~+0.01 (볼록 림은 가운데가 더 높다)
    const crown = W.mm.crowned ? W.outer - W.bottom : 0;
    return { seat: (a) => W.R(a) + rho, lo: -0.002 - crown, hi: 0.01, kind: flatBelt ? '평벨트+납작 림' : '줄+납작 림' };
  };

  // ── 줄·벨트 ──
  const ropes = () =>
    [...byKind('rope'), ...byKind('belt')]
      .filter((o) => Array.isArray(o.userData.mm.path) && o.userData.mm.path.length >= 2)
      .map((o) => {
        const mm = o.userData.mm;
        const flat = mm.kind === 'belt' && mm.style === 'flat';
        const rho = flat ? (mm.thickness ?? 0.02) / 2 : (mm.radius ?? 0.014);
        const raw = mm.path.map((p) => o.localToWorld(V(p.x, p.y, p.z)));
        // 촘촘히(0.01): 직선 가닥이 점 두 개뿐인 경로도 교차를 잰다
        const pts = [];
        const n = raw.length;
        const segs = mm.closed ? n : n - 1;
        for (let i = 0; i < segs; i++) {
          const a = raw[i];
          const b = raw[(i + 1) % n];
          const k = Math.max(1, Math.ceil(a.distanceTo(b) / 0.01));
          for (let j = 0; j < k; j++) pts.push(a.clone().lerp(b, j / k));
        }
        if (!mm.closed) pts.push(raw[n - 1].clone());
        const ends = Array.isArray(mm.ends) && mm.ends.length === 2 ? mm.ends.map((e) => o.localToWorld(V(...e))) : mm.closed ? [] : [raw[0], raw[n - 1]];
        return { obj: o, mm, name: o.name || (mm.kind === 'belt' ? `벨트(${mm.style})` : '줄'), closed: !!mm.closed, flat, rho, bw: flat ? (mm.width ?? 0.13) : 0, pts, ends };
      });

  /** 줄 R × 바퀴 W 판독: 앉은 호(runs), 묻힘, 교차, 떠 있음, 감긴 각, 접점 밖 호, 치우침 */
  const ropeWheel = (Rp, W) => {
    const { seat, lo, hi, kind } = seatOf(W, Rp.rho, Rp.flat);
    const ref = Math.abs(W.d.z) > 0.9 ? V(1, 0, 0) : V(0, 0, 1);
    const e1 = ref.clone().sub(W.d.clone().multiplyScalar(ref.dot(W.d))).normalize();
    const e2 = W.d.clone().cross(e1);
    const half = (W.a1 - W.a0) / 2;
    const mid = (W.a0 + W.a1) / 2;
    const P = Rp.pts;
    const N = P.length;
    const info = P.map((p) => {
      const u = p.clone().sub(W.c);
      const a = u.dot(W.d);
      const x = u.dot(e1);
      const y = u.dot(e2);
      const rr = Math.hypot(x, y);
      const aa = Math.min(W.a1, Math.max(W.a0, a));
      return { a, rr, th: Math.atan2(y, x), dev: rr - seat(aa) };
    });
    const axialOK = (s) => Math.abs(s.a - mid) <= half + Rp.rho + Rp.bw / 2;
    const near = info.map((s) => axialOK(s) && s.rr <= W.outer + Rp.rho + 0.03);
    if (!near.some(Boolean)) return null;
    const cls = info.map((s, i) => {
      if (!near[i]) return 0;
      if (s.dev < lo - 0.004) return s.rr < 0.6 * W.bottom ? 4 : 3; // 3 = 림 속(묻힘/교차), 4 = 허브·살 쪽
      if (s.dev <= hi + 0.004) return 1; // 앉음
      if (s.dev <= hi + 0.03 && s.rr <= W.outer + Rp.rho + 0.012) return 2; // 림 위로 살짝 뜬
      return 0;
    });
    // 연속 구간(닫힌 경로는 이음매를 잇는다)
    const runsOf = (want) => {
      const runs = [];
      let cur = null;
      for (let i = 0; i < N; i++) {
        if (want(cls[i])) {
          if (cur) cur.push(i);
          else runs.push((cur = [i]));
        } else cur = null;
      }
      if (Rp.closed && runs.length > 1 && runs[0][0] === 0 && runs[runs.length - 1].at(-1) === N - 1) runs[0] = [...runs.pop(), ...runs[0]];
      return runs;
    };
    const sweepOf = (run) => {
      let s = 0;
      for (let k = 1; k < run.length; k++) {
        let d = info[run[k]].th - info[run[k - 1]].th;
        if (d > Math.PI) d -= 2 * Math.PI;
        if (d < -Math.PI) d += 2 * Math.PI;
        s += d;
      }
      return s;
    };
    const ptOf = (i) => P[i];
    const out = { wheel: W.name, kind, seated: [], problems: [], cls: [0, 1, 2, 3, 4].map((k) => cls.filter((c) => c === k).length) };
    // 림 속 구간: 일정 반지름 호면 너무 깊게 감김(묻힘), 아니면 직선 가닥이 바퀴를 지나감
    /** 구간에서 가장 안쪽 반지름 +0.002 안의 점(= 호 부분)만 */
    const arcPart = (run) => {
      const m = Math.min(...run.map((i) => info[i].rr));
      return run.filter((i) => info[i].rr - m < 0.002);
    };
    for (const run of runsOf((c) => c === 3)) {
      const arc = arcPart(run);
      const spread = 0;
      const sw = arc.length >= 3 ? Math.abs(deg(sweepOf(arc))) : 0;
      const worst = run.reduce((b, i) => (info[i].dev < info[b].dev ? i : b), run[0]);
      const depth = lo - info[worst].dev;
      if (spread < 0.006 && sw >= 15) out.problems.push({ type: 'sink', level: 'fail', msg: `${W.name}: 줄이 림 속으로 묻혀 감김(중심선 − 자리 ${r3(info[worst].dev)}, 허용 ${lo}~${hi}, ${kind})`, at: ptOf(worst) });
      else if (depth > 0.003 || run.length >= 2) out.problems.push({ type: 'cross', level: 'fail', msg: `${W.name}: 직선 가닥이 바퀴 림을 지나감(깊이 ${r3(depth)}, 길이 ${r3(run.length * 0.01)})`, at: ptOf(worst) });
    }
    for (const run of runsOf((c) => c === 4)) {
      if (run.length < 2) continue;
      out.problems.push({ type: 'hub', level: 'warn', msg: `${W.name}: 줄이 바퀴 살·허브 쪽(반지름 ${r3(info[run[0]].rr)})을 지나감`, at: ptOf(run[Math.floor(run.length / 2)]) });
    }
    // 뜬 호: 일정 반지름으로 20° 넘게 림 위에 떠서 돈다
    for (const run of runsOf((c) => c === 2)) {
      const arc = arcPart(run);
      const sw = arc.length >= 3 ? Math.abs(deg(sweepOf(arc))) : 0;
      if (sw >= 20) {
        const i = arc[Math.floor(arc.length / 2)];
        out.problems.push({ type: 'float', level: 'fail', msg: `${W.name}: 줄이 림 위에 떠서 감김(중심선 − 자리 ${r3(info[i].dev)}, 허용 ${lo}~${hi}, ${kind})`, at: ptOf(i) });
      }
    }
    // 앉은 호
    for (const run of runsOf((c) => c === 1)) {
      const sw = sweepOf(run);
      if (run.length < 3 || Math.abs(deg(sw)) < 3) continue;
      const sgn = sw >= 0 ? 1 : -1;
      const devs = run.map((i) => info[i].dev);
      const rc = Math.min(...run.map((i) => info[i].rr)) + 0.0005; // 호의 반지름(직선이 접선으로 스치는 구간이 섞여도 원 쪽)
      const as = run.map((i) => info[i].a);
      const aMean = as.reduce((s, x) => s + x, 0) / as.length;
      const aSpread = Math.max(...as) - Math.min(...as);
      const iMid = run[Math.floor(run.length / 2)];
      const S = { wheel: W.name, deg: Math.round(Math.abs(deg(sw))), ccw: sgn > 0, devMin: r3(Math.min(...devs)), devMax: r3(Math.max(...devs)), axialOff: r3(aMean - mid), at: ptOf(iMid), rc };
      // 접점 밖 감김: 들어오고 나가는 직선 가닥(끝 F)에서 원에 그은 접점 T 를 지나서도 호가 이어지면
      const strandF = (iEnd, dir) => {
        // iEnd 에서 dir(+1 나감/−1 들어옴) 쪽으로 직선인 동안 가장 먼 점(≤ 0.3)
        let best = null;
        for (const L of [0.3, 0.2, 0.12]) {
          const steps = Math.round(L / 0.01);
          let j = iEnd + dir * steps;
          if (Rp.closed) j = ((j % N) + N) % N;
          else if (j < 0 || j >= N) {
            j = dir > 0 ? N - 1 : 0;
            if (Math.abs(j - iEnd) < 6) continue;
          }
          const E = P[iEnd];
          const F = P[j];
          const LF = E.distanceTo(F);
          if (LF < 0.1) continue;
          let ok = true;
          const ab = F.clone().sub(E).normalize();
          for (let k = 1; ok && k < Math.abs(steps); k++) {
            let q = iEnd + dir * k;
            if (Rp.closed) q = ((q % N) + N) % N;
            if (q < 0 || q >= N) break;
            if (q === j) break;
            const w = P[q].clone().sub(E);
            if (w.clone().sub(ab.clone().multiplyScalar(w.dot(ab))).length() > 0.002) ok = false;
          }
          if (ok) {
            best = F;
            break;
          }
        }
        return best;
      };
      const plane = (p) => {
        const u = p.clone().sub(W.c);
        return [u.dot(e1), u.dot(e2)];
      };
      const tangentAt = (F, exit) => {
        const [fx, fy] = plane(F);
        const dF = Math.hypot(fx, fy);
        if (dF <= rc * 1.02) return null;
        const phi = Math.atan2(fy, fx);
        const al = Math.acos(rc / dF);
        for (const th of [phi + al, phi - al]) {
          const tx = -Math.sin(th) * sgn;
          const ty = Math.cos(th) * sgn;
          const vx = fx - rc * Math.cos(th);
          const vy = fy - rc * Math.sin(th);
          const dot = (tx * vx + ty * vy) * (exit ? 1 : -1);
          if (dot > 0) return th;
        }
        return null;
      };
      const wrapPi = (x) => Math.atan2(Math.sin(x), Math.cos(x));
      // 호를 따라 펼친 각(감긴 각이 180° 를 넘어도 끝끼리 헷갈리지 않게)
      const phi = [info[run[0]].th];
      for (let k = 1; k < run.length; k++) phi.push(phi[k - 1] + wrapPi(info[run[k]].th - info[run[k - 1]].th));
      const excessAt = (exit) => {
        const iEnd = exit ? run.at(-1) : run[0];
        const F = strandF(iEnd, exit ? 1 : -1);
        if (!F) return null;
        // 가닥이 바퀴 평면을 크게 벗어나면(1/4 비틀림 등) 평면 접선 판정을 하지 않는다
        const sd = F.clone().sub(P[iEnd]).normalize();
        if (Math.abs(sd.dot(W.d)) > 0.35) return null;
        const thT0 = tangentAt(F, exit);
        if (thT0 === null) return null;
        const phE = exit ? phi.at(-1) : phi[0];
        const thT = phE + wrapPi(thT0 - phE);
        let ex = 0;
        for (let k = 0; k < run.length; k++) {
          const i = run[k];
          const D = sgn * (exit ? phi[k] - thT : thT - phi[k]);
          if (D <= 0.035 || D > Math.PI / 2) continue;
          const lineOff = rc / Math.cos(D) - rc;
          if (info[i].rr - rc < 0.5 * lineOff) ex = Math.max(ex, D);
        }
        return { ex: deg(ex), F };
      };
      const eIn = excessAt(false);
      const eOut = excessAt(true);
      S.excessIn = eIn ? Math.round(eIn.ex) : null;
      S.excessOut = eOut ? Math.round(eOut.ex) : null;
      for (const [e, lab, iE] of [[eIn, '들어오는', run[0]], [eOut, '나가는', run.at(-1)]]) {
        if (e && e.ex > 8) out.problems.push({ type: 'offarc', level: 'fail', msg: `${W.name}: ${lab} 가닥의 접점 밖까지 ${Math.round(e.ex)}° 더 감김(접촉 호 밖 감김)`, at: ptOf(iE) });
      }
      // 과다 감김·반대 호
      if (Math.abs(deg(sw)) > 350 && aSpread < 2.5 * Rp.rho) out.problems.push({ type: 'overwrap', level: 'fail', msg: `${W.name}: ${S.deg}° 감김(350° 초과)`, at: ptOf(iMid) });
      if (eIn && eOut) {
        const u1 = V(...plane(eIn.F), 0).normalize();
        const u2 = V(...plane(eOut.F), 0).normalize();
        const sum = u1.clone().add(u2);
        const [mx, my] = plane(P[iMid]);
        const m = V(mx, my, 0).normalize();
        if (sum.length() > 0.5 && m.dot(sum.normalize()) > 0.3 && Math.abs(deg(sw)) < 300) out.problems.push({ type: 'reverse', level: 'fail', msg: `${W.name}: 감긴 호 가운데가 줄이 가는 쪽을 향함(호가 반대로 돎)`, at: ptOf(iMid) });
      }
      // 축방향 치우침
      const w = W.a1 - W.a0;
      // 넓은 드럼 위를 옮겨 다니는 띠(벨트 옮기개 등)는 빼고: 바퀴 폭 ≤ max(2.5·띠 폭, 8·줄 반지름) 일 때만
      const narrow = w <= Math.max(2.5 * Rp.bw, 8 * Rp.rho);
      if (!W.cone && narrow && Math.abs(aMean - mid) > 0.2 * w && !Array.isArray(W.mm.steps)) out.problems.push({ type: 'axial', level: 'fail', msg: `${W.name}: 감긴 호가 바퀴 폭 가운데에서 ${r3(aMean - mid)} 치우침(폭 ${r3(w)}의 20% 초과)`, at: ptOf(iMid) });
      out.seated.push(S);
    }
    return out;
  };

  // ── 표면 거리(삼각형) ──
  const tri = new THREE.Triangle();
  const cp = V();
  const surfDist = (p, exclude, maxD = 0.2) => {
    let best = Infinity;
    let who = null;
    const pa = V();
    const pb = V();
    const pc = V();
    for (const m of meshes()) {
      if (exclude(m)) continue;
      const geo = m.geometry;
      if (!geo.boundingBox) geo.computeBoundingBox();
      const lb = geo.boundingBox.clone().applyMatrix4(m.matrixWorld).expandByScalar(maxD);
      if (!lb.containsPoint(p)) continue;
      const pos = geo.attributes.position;
      const idx = geo.index;
      const nt = idx ? idx.count / 3 : pos.count / 3;
      for (let t = 0; t < nt; t++) {
        const i0 = idx ? idx.getX(3 * t) : 3 * t;
        const i1 = idx ? idx.getX(3 * t + 1) : 3 * t + 1;
        const i2 = idx ? idx.getX(3 * t + 2) : 3 * t + 2;
        pa.fromBufferAttribute(pos, i0).applyMatrix4(m.matrixWorld);
        pb.fromBufferAttribute(pos, i1).applyMatrix4(m.matrixWorld);
        pc.fromBufferAttribute(pos, i2).applyMatrix4(m.matrixWorld);
        tri.set(pa, pb, pc);
        tri.closestPointToPoint(p, cp);
        const d = cp.distanceTo(p);
        if (d < best) {
          best = d;
          who = m;
        }
      }
    }
    return { d: best, who };
  };
  const insideOf = (m, root) => {
    for (let c = m; c; c = c.parent) if (c === root) return true;
    return false;
  };
  const pathName = (o) => {
    const parts = [];
    for (let c = o; c && c !== g; c = c.parent) parts.unshift(c.name || c.userData?.mm?.fn || c.userData?.mm?.kind || c.type);
    return parts.slice(-3).join('/');
  };

  // ── 줄 판독 묶음(한 시각) ──
  const ropeReport = (label) => {
    const W = wheelDiscs();
    const Rs = ropes();
    const pairs = [];
    for (const R of Rs) for (const w of W) {
      const r = ropeWheel(R, w);
      if (r) pairs.push({ rope: R.name, ...r });
      if (r && decl.__debug) console.log('[autocheck]', R.name, w.name, JSON.stringify(r.cls), JSON.stringify(r.problems.map((p) => p.msg)));
    }
    return { label, W, Rs, pairs };
  };

  // ── 연결(줄 끝·고리) ──
  const joints = (Rs, label) => {
    const res = [];
    const anchors = byKind('anchor').map((o) => ({ o, mm: o.userData.mm, p: wpos(o, o.userData.mm.point ?? [0, 0, 0]) }));
    const maxGap = 0.012;
    for (const R of Rs) {
      R.ends.forEach((E, k) => {
        let best = { gap: Infinity, what: '' };
        for (const A of anchors) {
          const d = E.distanceTo(A.p);
          const gap = A.mm.ring !== undefined ? Math.max(0, d - A.mm.ring - (A.mm.tube ?? 0)) : d;
          if (gap < best.gap) best = { gap, what: `고리(${A.mm.of ?? 'anchor'}) ${pathName(A.o)}` };
        }
        if (best.gap > maxGap) {
          const s = surfDist(E, (m) => insideOf(m, R.obj), 0.1);
          const gap = Math.max(0, s.d - R.rho);
          if (gap < best.gap) best = { gap, what: s.who ? `표면 ${pathName(s.who)}` : '' };
        }
        res.push({ rope: R.name, end: k, gap: r3(best.gap), to: best.what, ok: best.gap <= maxGap, at: E, label });
      });
    }
    return res;
  };

  // ── 전시 영역 ──
  const zMax = decl.depth?.zMax ?? 0.8;
  const envelope = (label) => {
    const bad = [];
    for (const c of g.children) {
      if (c === stand || isOverlay(c) || !visibleChain(c)) continue;
      const vs = vertsOf(c);
      if (!vs.length) continue;
      const b = new THREE.Box3();
      for (const v of vs) b.expandByPoint(v);
      const E = 0.01; // 메시 두께·모따기 몫 허용(37번 z 0.808 같은 것)
      const lim = [b.min.x < -2.2 - E, b.max.x > 2.2 + E, b.min.y < -0.02 - E, b.max.y > 3.3 + E, b.min.z < -0.37 - E, b.max.z > zMax + E];
      if (lim.some(Boolean)) {
        bad.push({ label, obj: pathName(c), box: [b.min.toArray().map(r3), b.max.toArray().map(r3)] });
      }
    }
    return bad;
  };

  // ════════════════ 검사 시작 ════════════════
  seek(t1);
  // 1) 로드·콘솔
  {
    const errs = (M.errors ?? []).filter((e) => !/^warn:/.test(e));
    const warns = (M.errors ?? []).filter((e) => /^warn:/.test(e));
    let nan = 0;
    let empty = 0;
    for (const m of meshes()) {
      const p = m.geometry?.attributes?.position;
      if (!p || p.count === 0) {
        empty++;
        continue;
      }
      const e = m.matrixWorld.elements;
      if (e.some((x) => !Number.isFinite(x))) nan++;
      else {
        const k = Math.max(1, Math.floor(p.count / 200));
        for (let i = 0; i < p.count; i += k)
          if (!Number.isFinite(p.getX(i)) || !Number.isFinite(p.getY(i)) || !Number.isFinite(p.getZ(i))) {
            nan++;
            break;
          }
      }
    }
    const st = errs.length || nan ? 'fail' : warns.length || empty ? 'warn' : 'pass';
    add('load', '로드·콘솔', st, [errs.length ? `에러 ${errs.length}: ${errs.slice(0, 3).join(' | ')}` : '', warns.length ? `경고 ${warns.length}: ${warns.slice(0, 2).join(' | ')}` : '', nan ? `NaN 좌표 메시 ${nan}` : '', empty ? `빈 메시 ${empty}` : ''].filter(Boolean).join(' / ') || '에러·NaN 없음');
  }
  // 2) 이름표 (t1 ↔ t2 따라가기)
  const tagObjs = [];
  g.traverse((o) => {
    if (o.userData?.mmTag === true) tagObjs.push(o);
  });
  const tagPos1 = tagObjs.map((o) => o.getWorldPosition(V()));
  const topBoxes1 = g.children.filter((c) => c !== stand && !isOverlay(c) && visibleChain(c)).map((c) => ({ c, b: boxOf(c) }));
  const mats1 = new Map();
  for (const m of meshes()) mats1.set(m, m.matrixWorld.clone());
  const rep1 = anyMM ? ropeReport(`t=${t1}`) : null;
  const tops1 = topBoxes1.map(({ c, b }) => ({ c, ctr: b.getCenter(V()) }));
  const notes1 = model.notes?.() ?? [];
  const named1 = new Map();
  const namedObj = (nm) => g.getObjectByName(nm);
  const declNames = new Set();
  for (const r of decl.ratios ?? []) declNames.add(r.a), declNames.add(r.b);
  if (decl.gain) declNames.add(decl.gain.pull), declNames.add(decl.gain.load);
  for (const nm of declNames) {
    const o = namedObj(nm);
    if (o) named1.set(nm, { p: o.getWorldPosition(V()), q: o.getWorldQuaternion(new THREE.Quaternion()) });
  }
  const links1 = (decl.links ?? []).map((L) => {
    const a = namedObj(L.a);
    const b = namedObj(L.b);
    return a && b ? wpos(a, a.userData?.mm?.point ?? [0, 0, 0]).distanceTo(wpos(b, b.userData?.mm?.point ?? [0, 0, 0])) : null;
  });
  // 벨트 표시 흐름: t1 에서 짧게(0.05) 움직여 바퀴 회전과 비교
  const beltFlow = [];
  if (rep1) {
    for (const R of rep1.Rs) {
      if (R.mm.kind !== 'belt' || typeof R.mm.offset !== 'number') continue;
      const pr = rep1.pairs.find((p) => p.rope === R.name && p.seated.length);
      if (!pr) continue;
      const W = rep1.W.find((w) => w.name === pr.wheel);
      const S = pr.seated[0];
      beltFlow.push({ R, W, S, off0: R.mm.offset, q0: W.obj.getWorldQuaternion(new THREE.Quaternion()) });
    }
    if (beltFlow.length) {
      seek(t1 + 0.05);
      for (const b of beltFlow) {
        b.off1 = b.R.mm.offset;
        b.q1 = b.W.obj.getWorldQuaternion(new THREE.Quaternion());
      }
      seek(t1);
    }
  }

  seek(t2);
  const tagPos2 = tagObjs.map((o) => o.getWorldPosition(V()));
  const tops2 = g.children.filter((c) => c !== stand && !isOverlay(c) && visibleChain(c)).map((c) => ({ c, ctr: boxOf(c).getCenter(V()) }));
  let movedMeshes = 0;
  for (const m of meshes()) {
    const a = mats1.get(m);
    if (!a) continue;
    const e1 = a.elements;
    const e2 = m.matrixWorld.elements;
    if (e1.some((x, i) => Math.abs(x - e2[i]) > 1e-4)) movedMeshes++;
  }
  const rep2 = anyMM ? ropeReport(`t=${t2}`) : null;
  const notes2 = model.notes?.() ?? [];

  {
    const n = tagObjs.length;
    const issues = [];
    let st = 'pass';
    const [tmin, tmax] = decl.counts?.tags ?? [1, 99];
    if (n === 0) (st = 'fail'), issues.push('이름표 0개');
    else if (n < tmin || n > tmax) (st = 'fail'), issues.push(`이름표 ${n}개(선언 ${tmin}~${tmax})`);
    // 가림: 이름표 중심이 맨 위 부품 상자(xy) 안
    tagObjs.forEach((o, i) => {
      const p = tagPos1[i];
      const hit = topBoxes1.filter(({ b }) => p.x > b.min.x && p.x < b.max.x && p.y > b.min.y && p.y < b.max.y && p.z < b.max.z + 0.05).map(({ c }) => pathName(c));
      if (hit.length && !hit.includes(pathName(o.parent === g ? o : o.parent))) {
        if (st === 'pass') st = 'warn';
        issues.push(`「${o.userData.mm?.text ?? i}」 중심이 ${hit[0]} 상자 안(가림?)`);
        spot(p, 0.4, 'warn', '이름표 가림?');
      }
    });
    // 따라가기: 이름표가 안 움직였는데 가장 가까운 맨 위 부품이 0.08 넘게 움직였으면
    tagObjs.forEach((o, i) => {
      if (tagPos1[i].distanceTo(tagPos2[i]) > 0.01) return;
      let best = null;
      tops1.forEach((t, k) => {
        const d = t.ctr.distanceTo(tagPos1[i]);
        if (!best || d < best.d) best = { d, k };
      });
      if (!best || best.d > 0.9) return;
      const mv = tops1[best.k].ctr.distanceTo(tops2[best.k]?.ctr ?? tops1[best.k].ctr);
      if (mv > 0.08) {
        if (st === 'pass') st = 'warn';
        issues.push(`「${o.userData.mm?.text ?? i}」 이 움직이는 ${pathName(tops1[best.k].c)}(이동 ${r3(mv)})를 따라가지 않음`);
      }
    });
    add('tags', '이름표', st, issues.join(' / ') || `${n}개`, { count: n, texts: tagObjs.map((o) => o.userData.mm?.text ?? null) });
  }

  // 3) 움직임
  add('motion', '움직임', movedMeshes === 0 ? 'fail' : 'pass', `t=${t1}→${t2} 에 자세가 바뀐 메시 ${movedMeshes}개`);
  if (beltFlow.length) {
    const bad = [];
    for (const b of beltFlow) {
      const dq = b.q1.clone().multiply(b.q0.clone().invert());
      const ang = 2 * Math.atan2(Math.hypot(dq.x, dq.y, dq.z), dq.w);
      const ax = V(dq.x, dq.y, dq.z);
      const sgnW = ax.lengthSq() < 1e-12 ? 0 : Math.sign(ax.dot(b.W.d));
      const dth = ((ang > Math.PI ? ang - 2 * Math.PI : ang) * sgnW) || 0; // 바퀴 축 둘레 회전(rad, 반시계 +)
      const ds = b.off1 - b.off0;
      const surf = dth * b.S.rc * (b.S.ccw ? 1 : -1); // 경로 진행 방향으로 잰 바퀴 둘레 속도
      if (Math.abs(surf) < 1e-4 && Math.abs(ds) < 1e-4) continue;
      if (Math.abs(ds) < 1e-5) continue; // 표시가 없는 벨트(오프셋을 안 쓰는 모델)
      if (Math.sign(ds) !== Math.sign(surf)) bad.push({ level: 'fail', msg: `${b.R.name}: 표시가 ${b.W.name} 회전과 반대로 흐름(Δs ${r3(ds)}, 둘레 ${r3(surf)})` });
      else if (Math.abs(Math.abs(ds) - Math.abs(surf)) > 0.15 * Math.abs(surf) + 1e-4) bad.push({ level: 'warn', msg: `${b.R.name}: 표시 흐름 ${r3(Math.abs(ds))} ≠ r·Δθ ${r3(Math.abs(surf))}(${b.W.name})` });
    }
    const st = bad.some((x) => x.level === 'fail') ? 'fail' : bad.length ? 'warn' : 'pass';
    add('beltflow', '벨트 표시 흐름', st, bad.map((x) => x.msg).join(' / ') || `벨트 ${beltFlow.length}개 — 표시가 바퀴 둘레 속도대로 흐름`);
  } else add('beltflow', '벨트 표시 흐름', 'skip', anyMM ? '표시가 흐르는 벨트 없음' : SKIP_NO_MM);

  // 4) 줄·벨트 (t1, t2)
  const ropeChecks = (reps, tagLabel) => {
    const probs = [];
    const seatedAll = [];
    for (const rep of reps) for (const pr of rep.pairs) {
      for (const p of pr.problems) probs.push({ ...p, rope: pr.rope, label: rep.label });
      for (const s of pr.seated) seatedAll.push({ rope: pr.rope, label: rep.label, ...s });
    }
    return { probs, seatedAll, tagLabel };
  };
  const nRopes = rep1 ? rep1.Rs.length : 0;
  const nWheels = rep1 ? rep1.W.length : 0;
  const declWraps = decl.wraps ?? [];
  if (!anyMM) {
    for (const [id, nm] of [['sink', '줄·벨트 묻힘'], ['wrap', '감긴 각'], ['offarc', '접촉 호 밖 감김'], ['axial', '축방향 치우침'], ['cross', '직선 가닥×바퀴 교차'], ['strands', '교차 가닥 틈'], ['joints', '연결 틈']]) add(id, nm, 'skip', SKIP_NO_MM);
  } else if (!nRopes || !nWheels) {
    for (const [id, nm] of [['sink', '줄·벨트 묻힘'], ['wrap', '감긴 각'], ['offarc', '접촉 호 밖 감김'], ['axial', '축방향 치우침'], ['cross', '직선 가닥×바퀴 교차']]) add(id, nm, 'skip', !nRopes ? '표식 있는 줄·벨트 없음' : '표식 있는 바퀴 없음');
  } else {
    const { probs, seatedAll } = ropeChecks([rep1, rep2]);
    const pick = (types) => probs.filter((p) => types.includes(p.type));
    const report = (id, nm, types, okText) => {
      const ps = pick(types);
      const uniq = [];
      for (const p of ps) if (!uniq.some((u) => u.msg === p.msg)) uniq.push(p);
      const st = uniq.some((p) => p.level === 'fail') ? 'fail' : uniq.length ? 'warn' : 'pass';
      for (const p of uniq.slice(0, 4)) spot(p.at, 0.35, p.level, `${nm}`);
      add(id, nm, st, uniq.map((p) => `[${p.label}] ${p.rope} — ${p.msg}`).slice(0, 6).join(' / ') || okText, { items: uniq.map((p) => ({ ...p, at: [r3(p.at.x), r3(p.at.y), r3(p.at.z)] })) });
    };
    const seatedTxt = (lab) => seatedAll.filter((s) => s.label === lab).map((s) => `${s.rope}@${s.wheel} ${s.deg}° (${s.devMin}~${s.devMax})`).join(', ');
    report('sink', '줄·벨트 묻힘', ['sink', 'float'], `앉은 호 ${seatedAll.length}개 모두 허용 창 안 — ${seatedTxt(rep1.label)}`);
    report('cross', '직선 가닥×바퀴 교차', ['cross', 'hub'], '줄이 바퀴 림을 지나가는 곳 없음');
    report('offarc', '접촉 호 밖 감김', ['offarc'], '들어오고 나가는 가닥 모두 접점에서 떠남');
    report('axial', '축방향 치우침', ['axial'], '감긴 호가 바퀴 폭 가운데');
    // 감긴 각: 선언이 있으면 대조, 없으면 과다·반대 호만
    {
      const items = pick(['overwrap', 'reverse']).filter((p, i, a) => a.findIndex((q) => q.msg === p.msg) === i);
      for (const w of declWraps) {
        const ss = seatedAll.filter((s) => s.label === rep1.label && (s.rope === w.rope || (rep1.Rs.find((r) => r.name === s.rope)?.obj.name === w.rope)) && s.wheel.startsWith(w.wheel));
        if (!ss.length) items.push({ level: 'fail', msg: `선언 ${w.rope}@${w.wheel}: 감긴 호를 찾지 못함`, label: rep1.label, rope: w.rope, at: V() });
        else {
          const tot = ss.reduce((s, x) => s + x.deg, 0);
          if (Math.abs(tot - w.deg) > (w.tol ?? 12)) items.push({ level: 'fail', msg: `${w.rope}@${w.wheel}: ${tot}° (선언 ${w.deg}±${w.tol ?? 12})`, label: rep1.label, rope: w.rope, at: ss[0].at });
        }
      }
      const st = items.some((p) => p.level === 'fail') ? 'fail' : items.length ? 'warn' : 'pass';
      for (const p of items.slice(0, 3)) if (p.at) spot(p.at, 0.35, p.level, '감긴 각');
      add('wrap', '감긴 각', st, items.map((p) => `[${p.label}] ${p.rope} — ${p.msg}`).join(' / ') || `${declWraps.length ? '선언과 일치 — ' : '과다·반대 호 없음 — '}${seatedTxt(rep1.label)}`, { seated: seatedAll.map((s) => ({ ...s, at: [r3(s.at.x), r3(s.at.y), r3(s.at.z)] })) });
    }
    // 바퀴 자리(근접 격자)
    for (const s of seatedAll.filter((s) => s.label === rep1.label).slice(0, 6)) spot(s.at, 0.3, 'info', `${s.wheel}`);
  }

  // 5) 교차 가닥 틈 (줄·벨트 중심선끼리 3D 거리)
  if (anyMM && rep1 && rep1.Rs.length) {
    const found = [];
    for (const rep of [rep1, rep2]) {
      const segs = [];
      rep.Rs.forEach((R, ri) => {
        // 한 바퀴에 앉은 점은 그 바퀴 번호로 표시(같은 바퀴에 나란히 감긴 가닥은 빼려고)
        const seatW = (p) => {
          for (let wi = 0; wi < rep.W.length; wi++) {
            const W = rep.W[wi];
            const u = p.clone().sub(W.c);
            const a = u.dot(W.d);
            if (a < W.a0 - R.rho - R.bw / 2 || a > W.a1 + R.rho + R.bw / 2) continue;
            const rr = u.clone().sub(W.d.clone().multiplyScalar(a)).length();
            if (rr < W.outer + R.rho + 0.02) return wi;
          }
          return -1;
        };
        for (let i = 0; i < R.pts.length; i += 2) {
          // 줄 끝(묶은 곳) 0.1 안은 뺀다 — 끝을 제 가닥 옆에 묶는 것은 정상
          if (!R.closed && (i * 0.01 < 0.1 || (R.pts.length - 1 - i) * 0.01 < 0.1)) continue;
          segs.push({ ri, i, p: R.pts[i], rho: R.rho + R.bw / 2, R, w: seatW(R.pts[i]) });
        }
      });
      const cell = 0.08;
      const grid = new Map();
      const key = (p) => `${Math.floor(p.x / cell)},${Math.floor(p.y / cell)},${Math.floor(p.z / cell)}`;
      segs.forEach((s, k) => {
        const kk = key(s.p);
        if (!grid.has(kk)) grid.set(kk, []);
        grid.get(kk).push(k);
      });
      const seen = new Set();
      segs.forEach((s, k) => {
        const cx = Math.floor(s.p.x / cell);
        const cy = Math.floor(s.p.y / cell);
        const cz = Math.floor(s.p.z / cell);
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
          const lst = grid.get(`${cx + dx},${cy + dy},${cz + dz}`);
          if (!lst) continue;
          for (const j of lst) {
            if (j <= k) continue;
            const t = segs[j];
            if (s.w >= 0 && s.w === t.w) continue; // 같은 바퀴에 나란히 감긴 가닥(드럼 감기 등)
            if (t.ri === s.ri) {
              const N = s.R.pts.length;
              let di = Math.abs(t.i - s.i);
              if (s.R.closed) di = Math.min(di, N - di);
              if (di * 0.01 < Math.max(0.35, 6 * s.rho)) continue;
            }
            const d = s.p.distanceTo(t.p);
            const gap = d - s.rho - t.rho;
            if (gap < 0.01) {
              const kk = `${s.ri}:${Math.round(s.i / 15)}|${t.ri}:${Math.round(t.i / 15)}`;
              if (seen.has(kk)) continue;
              seen.add(kk);
              found.push({ label: rep.label, a: s.R.name, b: t.R.name, gap: r3(gap), at: s.p.clone().lerp(t.p, 0.5) });
            }
          }
        }
      });
    }
    // 같은 자리 여러 점 → 가장 좁은 것 하나
    const merged = [];
    for (const f of found.sort((a, b) => a.gap - b.gap)) if (!merged.some((m) => m.at.distanceTo(f.at) < 0.08 && m.label === f.label)) merged.push(f);
    for (const f of merged.slice(0, 3)) spot(f.at, 0.3, 'fail', '가닥 틈');
    add('strands', '교차 가닥 틈', merged.length ? 'fail' : 'pass', merged.map((f) => `[${f.label}] ${f.a} × ${f.b} 틈 ${f.gap} @ (${r3(f.at.x)}, ${r3(f.at.y)}, ${r3(f.at.z)})`).slice(0, 5).join(' / ') || '가닥끼리 0.01 이상 떨어짐', { items: merged.map((f) => ({ ...f, at: f.at.toArray().map(r3) })) });
  } else if (anyMM) add('strands', '교차 가닥 틈', 'skip', '표식 있는 줄·벨트 없음');

  // 6) 연결 틈
  const jointsAt = [];
  if (anyMM) {
    const items = [];
    for (const [rep, lab] of [[rep1, `t=${t1}`], [rep2, `t=${t2}`]]) {
      if (!rep) continue;
      if (lab === `t=${t2}`) seek(t2);
      else seek(t1);
      for (const j of joints(rep === rep1 ? ropes() : ropes(), lab)) items.push(j);
    }
    seek(t2);
    // 선언 joints
    const dj = [];
    for (const J of decl.joints ?? []) {
      const a = namedObj(J.a);
      const b = namedObj(J.b);
      if (!a || !b) {
        dj.push({ ok: false, msg: `${J.a} ↔ ${J.b}: 이름을 찾지 못함` });
        continue;
      }
      for (const t of [t1, t2]) {
        seek(t);
        const d = wpos(a, a.userData?.mm?.point ?? [0, 0, 0]).distanceTo(wpos(b, b.userData?.mm?.point ?? [0, 0, 0]));
        if (d > (J.maxGap ?? 0.012)) dj.push({ ok: false, msg: `[t=${t}] ${J.a} ↔ ${J.b} 거리 ${r3(d)} > ${J.maxGap ?? 0.012}`, at: wpos(a) });
      }
    }
    // 추 고리: 움직이는 추의 고리가 아무것에도 닿지 않으면
    seek(t1);
    const ringItems = [];
    const wts = byKind('anchor').filter((o) => o.userData.mm.of === 'weight');
    const wp1 = wts.map((o) => wpos(o));
    seek(t2);
    wts.forEach((o, i) => {
      const P = wpos(o, o.userData.mm.point ?? [0, 0, 0]);
      const moved = P.distanceTo(wp1[i]) > 0.01;
      const body = o.parent;
      const ringR = (o.userData.mm.ring ?? 0.03) + (o.userData.mm.tube ?? 0.01);
      const s = surfDist(wpos(o, o.userData.mm.center ?? [0, 0, 0]), (m) => insideOf(m, o) || m === body, 0.15);
      const rs = ropes();
      let ropeD = Infinity;
      for (const R of rs) for (const e of R.ends) ropeD = Math.min(ropeD, Math.max(0, e.distanceTo(P) - ringR));
      const gap = Math.min(Math.max(0, s.d - ringR), ropeD);
      if (gap > 0.012) ringItems.push({ ok: false, level: moved ? 'fail' : 'warn', msg: `추 고리(${pathName(o)}) 가 아무것에도 닿지 않음(틈 ${r3(gap)}${moved ? ', 추가 움직임' : ''})`, at: P });
    });
    const bad = items.filter((j) => !j.ok);
    const lines = [...bad.map((j) => `[${j.label}] ${j.rope} 끝${j.end}: 틈 ${j.gap} (가장 가까운 ${j.to || '없음'})`), ...dj.map((d) => d.msg), ...ringItems.map((r) => r.msg)];
    const st = bad.length || dj.length || ringItems.some((r) => r.level === 'fail') ? 'fail' : ringItems.length ? 'warn' : 'pass';
    for (const j of bad.slice(0, 3)) spot(j.at, 0.3, 'fail', '줄 끝 틈');
    for (const r of ringItems.slice(0, 2)) spot(r.at, 0.3, r.level, '추 고리');
    add('joints', '연결 틈', st, lines.slice(0, 6).join(' / ') || `줄 끝 ${items.length}곳 모두 고리·표면에 붙음`, { ends: items.map((j) => ({ ...j, at: [r3(j.at.x), r3(j.at.y), r3(j.at.z)] })) });
    jointsAt.push(...bad);
  }

  // 7) 링크 길이
  if ((decl.links ?? []).length) {
    seek(t2);
    const bad = [];
    (decl.links ?? []).forEach((L, i) => {
      const a = namedObj(L.a);
      const b = namedObj(L.b);
      if (!a || !b || links1[i] === null) return bad.push(`${L.a}–${L.b}: 이름을 찾지 못함`);
      const d2 = wpos(a, a.userData?.mm?.point ?? [0, 0, 0]).distanceTo(wpos(b, b.userData?.mm?.point ?? [0, 0, 0]));
      const ref = L.length ?? links1[i];
      if (Math.abs(links1[i] - ref) > 0.002 || Math.abs(d2 - ref) > 0.002) bad.push(`${L.a}–${L.b}: ${r3(links1[i])} → ${r3(d2)} (기준 ${r3(ref)})`);
    });
    add('links', '링크 길이', bad.length ? 'fail' : 'pass', bad.join(' / ') || `${decl.links.length}개 일정`);
  } else add('links', '링크 길이', 'skip', '선언 links 없음');

  // 8) 속도비·방향
  const rotAbout = (q0, q1, axis) => {
    const dq = q1.clone().multiply(q0.clone().invert());
    const ax = V(dq.x, dq.y, dq.z);
    let ang = 2 * Math.atan2(ax.length(), dq.w);
    if (ang > Math.PI) ang -= 2 * Math.PI;
    return ax.lengthSq() < 1e-14 ? 0 : ang * Math.sign(ax.dot(axis));
  };
  if ((decl.ratios ?? []).length) {
    seek(t2);
    const bad = [];
    const got = [];
    for (const r of decl.ratios) {
      const a = namedObj(r.a);
      const b = namedObj(r.b);
      if (!a || !b || !named1.get(r.a) || !named1.get(r.b)) {
        bad.push(`${r.a}/${r.b}: 이름을 찾지 못함`);
        continue;
      }
      const ax = (o) => wdir(o, axisVec(o.userData?.mm?.axis ?? 'z'));
      const da = rotAbout(named1.get(r.a).q, a.getWorldQuaternion(new THREE.Quaternion()), ax(a));
      const db = rotAbout(named1.get(r.b).q, b.getWorldQuaternion(new THREE.Quaternion()), ax(b));
      const ratio = Math.abs(da) < 1e-6 ? NaN : db / da;
      got.push(`${r.b}/${r.a} = ${r3(ratio)}`);
      if (!Number.isFinite(ratio) || Math.abs(ratio - r.ratio) > (r.tol ?? 0.02)) bad.push(`${r.b}/${r.a} = ${r3(ratio)} (선언 ${r.ratio}±${r.tol ?? 0.02})`);
    }
    add('ratios', '속도비·방향', bad.length ? 'fail' : 'pass', bad.join(' / ') || got.join(', '));
  } else add('ratios', '속도비·방향', 'skip', '선언 ratios 없음');

  // 9) 기계적 이득
  const noteGain = (notes) => {
    const n = notes.find((x) => /이득/.test(x.label));
    const m = n && /(-?\d+(?:\.\d+)?)/.exec(n.value);
    return m ? Number(m[1]) : null;
  };
  if (decl.gain) {
    seek(t2);
    const a = namedObj(decl.gain.pull);
    const b = namedObj(decl.gain.load);
    if (!a || !b || !named1.get(decl.gain.pull) || !named1.get(decl.gain.load)) add('gain', '기계적 이득', 'fail', `${decl.gain.pull}/${decl.gain.load}: 이름을 찾지 못함`);
    else {
      const dp = a.getWorldPosition(V()).distanceTo(named1.get(decl.gain.pull).p);
      const dl = b.getWorldPosition(V()).distanceTo(named1.get(decl.gain.load).p);
      const gv = dl < 1e-6 ? NaN : dp / dl;
      const ng = noteGain(notes2);
      const ok = Number.isFinite(gv) && Math.abs(gv - decl.gain.value) <= 0.05 * decl.gain.value;
      const noteBad = ng !== null && Math.abs(ng - decl.gain.value) > 0.05 * decl.gain.value + 0.05;
      add('gain', '기계적 이득', ok ? (noteBad ? 'warn' : 'pass') : 'fail', `당김 ${r3(dp)} : 짐 ${r3(dl)} = ${r3(gv)} (선언 ${decl.gain.value})${ng !== null ? `, notes ${ng}` : ''}${noteBad ? ' — notes 숫자가 선언과 다름' : ''}`);
    }
  } else add('gain', '기계적 이득', 'skip', `선언 gain 없음${noteGain(notes1) !== null ? ` (notes 이득 ${noteGain(notes1)})` : ''}`);

  // 10) 기어 물림(평행 축 원형 기어: 중심 거리)
  {
    seek(t1);
    const gs = [];
    g.traverse((o) => {
      const mm = o.userData?.mm;
      if (mm?.kind === 'gear' && !mm.noncircular && typeof mm.rp === 'number' && visibleChain(o) && mm.fn !== 'wormScrew' && mm.fn !== 'bevelGear' && mm.fn !== 'crownGear' && mm.fn !== 'flutedCone') {
        gs.push({ o, mm, c: wpos(o), d: wdir(o, axisVec(mm.axis ?? 'z')), name: o.name || mm.fn });
      }
    });
    if (!anyMM) add('gears', '기어 물림', 'skip', SKIP_NO_MM);
    else if (gs.length < 2) add('gears', '기어 물림', 'skip', `평행 축 원형 기어 ${gs.length}개`);
    else {
      const bad = [];
      const ok = [];
      for (let i = 0; i < gs.length; i++) for (let j = i + 1; j < gs.length; j++) {
        const A = gs[i];
        const B = gs[j];
        if (Math.abs(A.d.dot(B.d)) < 0.995) continue;
        if (Math.abs((A.mm.module ?? 0) - (B.mm.module ?? 0)) > 0.01 * (A.mm.module || 1)) continue;
        const u = B.c.clone().sub(A.c);
        const ax = u.dot(A.d);
        if (Math.abs(ax) > ((A.mm.width ?? 0.1) + (B.mm.width ?? 0.1)) / 2) continue;
        const dist = u.clone().sub(A.d.clone().multiplyScalar(ax)).length();
        const exp = A.mm.internal || B.mm.internal ? Math.abs(A.mm.rp - B.mm.rp) : A.mm.rp + B.mm.rp;
        if (Math.abs(dist - exp) > 0.2 * exp + 0.02) continue; // 물리는 짝이 아님
        const err = dist - exp;
        if (Math.abs(err) > 0.005) {
          bad.push(`${pathName(A.o)} × ${pathName(B.o)}: 중심 거리 ${r3(dist)} (m(z1±z2)/2 = ${r3(exp)})`);
          spot(A.c.clone().lerp(B.c, 0.5), 0.35, 'fail', '기어 중심 거리');
        } else ok.push(`${A.mm.teeth}×${B.mm.teeth}`);
      }
      add('gears', '기어 물림', bad.length ? 'fail' : ok.length ? 'pass' : 'skip', bad.join(' / ') || (ok.length ? `물림 ${ok.length}쌍 중심 거리 맞음(${ok.join(', ')}) — 위상은 meshAngle 정보 없어 건너뜀` : '물리는 짝(같은 모듈·평행 축)을 찾지 못함'));
    }
  }

  // 11) 다각형 침범(userData.outline(s))
  {
    const polys = [];
    g.traverse((o) => {
      if (!visibleChain(o)) return;
      if (Array.isArray(o.userData?.outline)) polys.push({ o, name: 'outline', pts: o.userData.outline, hole: false });
      const ol = o.userData?.outlines;
      if (ol && typeof ol === 'object') for (const [k, v] of Object.entries(ol)) if (Array.isArray(v)) polys.push({ o, name: k, pts: v, hole: /hole|groove/.test(k) });
    });
    if (polys.length < 2) add('poly', '다각형 침범', 'skip', `윤곽 ${polys.length}개`);
    else {
      const inPoly = (x, y, P) => {
        let c = false;
        for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
          const [xi, yi] = P[i];
          const [xj, yj] = P[j];
          if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
        }
        return c;
      };
      const edgeDist = (x, y, P) => {
        let b = Infinity;
        for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
          const [ax, ay] = P[j];
          const [bx, by] = P[i];
          const dx = bx - ax;
          const dy = by - ay;
          const L = dx * dx + dy * dy || 1e-12;
          const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L));
          b = Math.min(b, Math.hypot(x - ax - t * dx, y - ay - t * dy));
        }
        return b;
      };
      let worst = { d: 0 };
      let pairsSeen = 0;
      const SAMPLES = 60;
      const span = decl.period ?? 12;
      const sub = (pts, n) => (pts.length <= n ? pts : pts.filter((_, i) => i % Math.ceil(pts.length / n) === 0));
      for (let s = 0; s < SAMPLES; s++) {
        const t = (span * s) / SAMPLES;
        seek(t);
        for (const A of polys) {
          if (A.hole) continue;
          for (const B of polys) {
            if (B.o === A.o) continue;
            const nA = V(0, 0, 1).transformDirection(A.o.matrixWorld);
            const nB = V(0, 0, 1).transformDirection(B.o.matrixWorld);
            if (Math.abs(nA.dot(nB)) < 0.999) continue;
            if (s === 0) pairsSeen++;
            const inv = B.o.matrixWorld.clone().invert();
            const ptsA = sub(A.pts, 400).map(([x, y]) => V(x, y, 0).applyMatrix4(A.o.matrixWorld).applyMatrix4(inv));
            if (Math.abs(ptsA[0].z) > 0.3) continue; // 다른 층
            let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
            for (const [x, y] of B.pts) (minx = Math.min(minx, x)), (maxx = Math.max(maxx, x)), (miny = Math.min(miny, y)), (maxy = Math.max(maxy, y));
            if (B.hole) {
              // A 가 그 구멍(홈) 안에 있어야 하는 짝만: A 중심이 구멍 안
              const cx = ptsA.reduce((s2, p) => s2 + p.x, 0) / ptsA.length;
              const cy = ptsA.reduce((s2, p) => s2 + p.y, 0) / ptsA.length;
              if (!inPoly(cx, cy, B.pts)) continue;
              for (const p of ptsA) if (!inPoly(p.x, p.y, B.pts)) {
                const d = edgeDist(p.x, p.y, B.pts);
                if (d > worst.d) worst = { d, t, a: `${pathName(A.o)}.${A.name}`, b: `${pathName(B.o)}.${B.name}`, at: p.clone().applyMatrix4(B.o.matrixWorld) };
              }
            } else {
              for (const p of ptsA) {
                if (p.x < minx || p.x > maxx || p.y < miny || p.y > maxy) continue;
                if (!inPoly(p.x, p.y, B.pts)) continue;
                const d = edgeDist(p.x, p.y, B.pts);
                if (d > worst.d) worst = { d, t, a: `${pathName(A.o)}.${A.name}`, b: `${pathName(B.o)}.${B.name}`, at: p.clone().applyMatrix4(B.o.matrixWorld) };
              }
            }
          }
        }
      }
      if (worst.d > 0.004) spot(worst.at, 0.3, 'fail', '다각형 침범');
      if (!pairsSeen) add('poly', '다각형 침범', 'skip', `윤곽 ${polys.length}개 — 서로 다른 부품끼리 같은 평면의 짝 없음`);
      else add('poly', '다각형 침범', worst.d > 0.004 ? 'fail' : 'pass', worst.d > 0 ? `최대 깊이 ${r3(worst.d)} (t=${r3(worst.t)}, ${worst.a} → ${worst.b})` : `윤곽 ${polys.length}개, ${SAMPLES} 시각에서 침범 없음`);
    }
  }

  // 12) 전시 영역 (times 전부 + 역회전·긴 시간)
  const envAll = [];
  for (const t of times) {
    seek(t);
    envAll.push(...envelope(`t=${t}`));
  }
  {
    // 원점 근처(배치 안 됨?) — warn
    seek(t1);
    const nearO = [];
    for (const c of g.children) {
      if (c === stand || isOverlay(c) || !visibleChain(c)) continue;
      const b = boxOf(c);
      if (b.isEmpty()) continue;
      const ctr = b.getCenter(V());
      if (Math.hypot(ctr.x, ctr.y) < 0.2) nearO.push(pathName(c));
    }
    const st = envAll.length ? 'fail' : nearO.length ? 'warn' : 'pass';
    for (const e of envAll.slice(0, 2)) spot(V(...e.box[1]), 0.5, 'fail', '전시 영역 밖');
    add('envelope', '전시 영역', st, [...envAll.slice(0, 4).map((e) => `[${e.label}] ${e.obj} 상자 ${JSON.stringify(e.box)} (x ±2.2, y −0.02~3.3, z −0.37~${zMax})`), ...nearO.map((n) => `${n}: 원점 근처(배치 안 됨?)`)].join(' / ') || `x ±2.2, y −0.02~3.3, z −0.37~${zMax} 안 (${times.join(', ')}s)`);
  }

  // 13) 역회전·긴 시간 — 전시 영역·묻힘·연결만
  {
    const lines = [];
    let st = 'pass';
    for (const [t, sp, lab] of [[2, -1, '역회전 2s'], [30, 1, 't=30']]) {
      seek(t, sp);
      const env = envelope(lab);
      if (env.length) (st = 'fail'), lines.push(...env.slice(0, 2).map((e) => `[${lab}] 전시 영역 밖 ${e.obj}`));
      if (anyMM) {
        const rep = ropeReport(lab);
        for (const pr of rep.pairs) for (const p of pr.problems) if (['sink', 'float', 'cross'].includes(p.type) && p.level === 'fail') {
          st = 'fail';
          if (lines.length < 6) lines.push(`[${lab}] ${pr.rope} — ${p.msg}`);
        }
        for (const j of joints(rep.Rs, lab)) if (!j.ok) {
          st = 'fail';
          if (lines.length < 6) lines.push(`[${lab}] ${j.rope} 끝${j.end} 틈 ${j.gap}`);
        }
      }
      let nanN = 0;
      for (const m of meshes()) if (m.matrixWorld.elements.some((x) => !Number.isFinite(x))) nanN++;
      if (nanN) (st = 'fail'), lines.push(`[${lab}] NaN 자세 메시 ${nanN}`);
    }
    add('reverse', '역회전·긴 시간', st, lines.join(' / ') || `역회전(2s)·t=30 에서 전시 영역${anyMM ? '·묻힘·연결' : ''} 이상 없음`);
  }

  // 14) 부품끼리 박힘(맨 위 물체 상자 겹침) — warn 목록만
  {
    seek(t1);
    const solid = g.children
      .filter((c) => c !== stand && !isOverlay(c) && visibleChain(c) && !['rope', 'belt', 'arrow', 'tag', 'shaft', 'rod'].includes(kindOf(c)))
      .map((c) => ({ c, b: boxOf(c) }))
      .filter((x) => !x.b.isEmpty());
    const ov = [];
    const hasGear = (o) => {
      let f = false;
      o.traverse((c) => {
        if (kindOf(c) === 'gear' || kindOf(c) === 'part') f = true;
      });
      return f;
    };
    for (let i = 0; i < solid.length; i++) for (let j = i + 1; j < solid.length; j++) {
      if (hasGear(solid[i].c) && hasGear(solid[j].c)) continue; // 물린 기어끼리(상자는 당연히 겹침 — 침범은 다각형·중심 거리로)
      const a = solid[i].b;
      const b = solid[j].b;
      const d = Math.min(Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x), Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y), Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z));
      if (d > 0.03) {
        const ia = a.clone().intersect(b);
        ov.push({ a: pathName(solid[i].c), b: pathName(solid[j].c), d: r3(d), at: ia.getCenter(V()) });
      }
    }
    ov.sort((a, b) => b.d - a.d);
    for (const o of ov.slice(0, 2)) spot(o.at, 0.35, 'info', '상자 겹침');
    add('overlap', '부품끼리 박힘', ov.length ? 'warn' : 'pass', ov.slice(0, 5).map((o) => `${o.a} × ${o.b} 깊이 ${o.d}`).join(' / ') || '맨 위 물체 상자 겹침 없음', { items: ov.slice(0, 12).map((o) => ({ ...o, at: o.at.toArray().map(r3) })) });
  }

  // 15) 수 세기
  {
    const cnt = { wheel: 0, rope: 0, gear: 0, anchor: 0 };
    g.traverse((o) => {
      const k = kindOf(o);
      if (!visibleChain(o)) return;
      if (k === 'wheel' && !o.userData.mm.inBlock) cnt.wheel++;
      else if (k === 'wheel') cnt.wheel++;
      else if (k === 'rope' || k === 'belt') cnt.rope++;
      else if (k === 'gear') cnt.gear++;
      else if (k === 'anchor') cnt.anchor++;
    });
    const C = decl.counts;
    if (!C) add('counts', '수 세기', anyMM ? 'skip' : 'skip', `선언 counts 없음 — 바퀴 ${cnt.wheel}, 줄·벨트 ${cnt.rope}, 기어 ${cnt.gear}`, { counted: cnt });
    else {
      const bad = [];
      for (const k of ['wheel', 'rope', 'gear']) if (C[k] !== undefined && C[k] !== cnt[k]) bad.push(`${k} ${cnt[k]} (선언 ${C[k]})`);
      add('counts', '수 세기', bad.length ? 'fail' : 'pass', bad.join(' / ') || `바퀴 ${cnt.wheel}, 줄·벨트 ${cnt.rope}, 기어 ${cnt.gear}`, { counted: cnt });
    }
  }

  // 선언 근접 자리
  for (const c of decl.closeups ?? []) spot(V(c[0], c[1], c[2] ?? 0.2), c[3] ?? 0.35, 'info', '선언 근접');

  seek(t1);
  const view = model.view ?? { pos: [0, 2.1, 6.2], target: [0, 1.75, 0] };
  return { checks, spots, view, times, notes: { [`t=${t1}`]: notes1, [`t=${t2}`]: notes2 }, mmCount: anyMM };
}

// ───────────────────────── 캡처 ─────────────────────────
async function snap(page, { t, sp = 1, cam, labels = true }) {
  await page.evaluate(({ t, sp, cam, labels }) => {
    const M = window.__mm;
    M.seek(t, sp);
    M.labels(labels);
    M.cam(...cam);
    M.render();
  }, { t, sp, cam, labels });
  return page.screenshot({ type: 'png' });
}
const rotY = (view, deg) => {
  const [px, py, pz] = view.pos;
  const [tx, ty, tz] = view.target;
  const a = (deg * Math.PI) / 180;
  const dx = px - tx;
  const dz = pz - tz;
  return [tx + dx * Math.cos(a) + dz * Math.sin(a), py, tz - dx * Math.sin(a) + dz * Math.cos(a), tx, ty, tz];
};
const b64 = (buf) => `data:image/png;base64,${buf.toString('base64')}`;
async function compose(browser, html, w, h, out) {
  const p = await browser.newPage({ viewport: { width: w, height: h } });
  await p.setContent(html, { waitUntil: 'load' });
  await p.locator('#root').screenshot({ path: out });
  await p.close();
}

// ───────────────────────── 번호 하나 ─────────────────────────
async function checkOne(browser, page, n) {
  const t0 = Date.now();
  const id = id3(n);
  const { decl, src: declSrc, err: declErr } = readDecl(n);
  const times = opt.times ?? decl.times ?? [1, 1.6];
  const pageErrors = [];
  const onErr = (e) => pageErrors.push(String(e));
  const onCon = (m) => {
    if (m.text().startsWith('[autocheck]')) console.log('   ', m.text());
  };
  const onResp = (r) => {
    if (r.status() >= 400 && !/favicon/.test(r.url())) pageErrors.push(`${r.status()} ${r.url()}`);
  };
  page.on('response', onResp);
  page.on('pageerror', onErr);
  page.on('console', onCon);
  const q = opt.file ? `&mmsrc=${encodeURIComponent('/' + opt.file.replace(/\\/g, '/').replace(/^\//, ''))}` : '';
  let res;
  try {
    await page.goto(`${opt.base}preview.html?mm=${n}&t=0&ui=0${q}`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => window.__mmReady === true, null, { timeout: 60000 });
    const loaded = await page.evaluate(() => !!window.__mm?.model);
    if (!loaded) throw new Error('모델을 만들지 못함: ' + (await page.evaluate(() => (window.__mm?.errors ?? []).join(' | '))));
    res = await page.evaluate(pageAnalyze, { decl: process.env.AUTOCHECK_DEBUG ? { ...decl, __debug: true } : decl, times });
  } catch (e) {
    res = { checks: [{ id: 'load', name: '로드·콘솔', status: 'fail', detail: String(e.message ?? e).slice(0, 400) }], spots: [], view: null, times };
  }
  if (pageErrors.length) {
    const c = res.checks.find((x) => x.id === 'load');
    c.status = 'fail';
    c.detail = `pageerror ${pageErrors.length}: ${pageErrors.slice(0, 3).join(' | ')} / ` + c.detail;
  }
  if (declErr) res.checks.push({ id: 'decl', name: '검사 선언', status: 'fail', detail: declErr });
  else res.checks.push({ id: 'decl', name: '검사 선언', status: declSrc ? 'pass' : 'skip', detail: declSrc ? `${declSrc} 에서 읽음` : '설계표에 검사 선언 없음 — 자동 기준만' });
  const tCheck = Date.now() - t0;

  // 캡처
  const files = {};
  if (opt.shots && res.view) {
    try {
      const v = res.view;
      const front = [...v.pos, ...v.target];
      const [ta, tb] = res.times;
      const s1 = await snap(page, { t: ta, cam: front, labels: true });
      const s2 = await snap(page, { t: tb, cam: front, labels: false });
      const s3 = await snap(page, { t: ta, cam: rotY(v, 45), labels: false });
      const fig = `public/mm507/fig/${id}.png`;
      const figImg = existsSync(fig) ? `<img src="${b64(readFileSync(fig))}" style="height:600px;width:auto">` : `<div style="width:300px;height:600px;display:flex;align-items:center;justify-content:center;border:1px solid #ccc">판화 없음</div>`;
      const cap = (txt) => `<div style="font:14px sans-serif;padding:2px 4px">${txt}</div>`;
      const cell = (img, txt) => `<div>${cap(txt)}<img src="${b64(img)}" style="height:600px;width:auto;display:block"></div>`;
      files.cmp = join(opt.out, `${id}-cmp.png`);
      await compose(browser, `<body style="margin:0;background:#fff"><div id="root" style="display:inline-flex;gap:6px;align-items:flex-end;padding:4px;background:#fff"><div>${cap(`${id} 판화`)}${figImg}</div>${cell(s1, `t=${ta} 정면(이름표)`)}${cell(s2, `t=${tb} 정면`)}${cell(s3, `t=${ta} 비스듬 45°`)}</div></body>`, 3600, 700, files.cmp);
      // 근접 격자: 자리(최대 10, fail·warn 먼저) + 옆(+X)·위(+Y)
      const lvlRank = { fail: 0, warn: 1, info: 2 };
      const sp = [...res.spots].sort((a, b) => lvlRank[a.level] - lvlRank[b.level]);
      const picked = [];
      for (const s of sp) if (!picked.some((p) => Math.hypot(p.p[0] - s.p[0], p.p[1] - s.p[1], p.p[2] - s.p[2]) < 0.15)) picked.push(s);
      const cells = [];
      const dist = Math.hypot(v.pos[0] - v.target[0], v.pos[1] - v.target[1], v.pos[2] - v.target[2]);
      for (const s of picked.slice(0, 10)) {
        const d = Math.max(0.55, s.s * 2.6);
        const dir = [0.55, 0.45, 0.7];
        const L = Math.hypot(...dir);
        const cam = [s.p[0] + (dir[0] / L) * d, s.p[1] + (dir[1] / L) * d, s.p[2] + (dir[2] / L) * d, ...s.p];
        cells.push({ img: await snap(page, { t: ta, cam, labels: false }), txt: `${s.label} (${s.p.join(', ')})`, level: s.level });
      }
      cells.push({ img: await snap(page, { t: ta, cam: [v.target[0] + dist, v.target[1], v.target[2] + 0.001, ...v.target], labels: false }), txt: '옆(+X)', level: 'info' });
      cells.push({ img: await snap(page, { t: ta, cam: [v.target[0], v.target[1] + dist, v.target[2] + 0.02, ...v.target], labels: false }), txt: '위(+Y)', level: 'info' });
      const color = { fail: '#d62828', warn: '#f08c00', info: '#bbb' };
      const grid = cells.map((c) => `<div style="border:4px solid ${color[c.level]};width:400px">${cap(c.txt)}<img src="${b64(c.img)}" style="width:400px;display:block"></div>`).join('');
      files.close = join(opt.out, `${id}-close.png`);
      await compose(browser, `<body style="margin:0;background:#fff"><div id="root" style="display:grid;grid-template-columns:repeat(4,408px);gap:4px;padding:4px;background:#fff;width:${4 * 412 + 8}px">${grid}</div></body>`, 1700, 1400, files.close);
    } catch (e) {
      res.checks.push({ id: 'shots', name: '캡처', status: 'warn', detail: `캡처 실패: ${String(e.message ?? e).slice(0, 200)}` });
    }
  }
  page.off('pageerror', onErr);
  page.off('console', onCon);
  page.off('response', onResp);

  const fail = res.checks.filter((c) => c.status === 'fail');
  const warn = res.checks.filter((c) => c.status === 'warn');
  const skip = res.checks.filter((c) => c.status === 'skip');
  const verdict = fail.length ? 'fail' : warn.length ? 'warn' : 'pass';
  const ms = Date.now() - t0;
  const out = { n, id, verdict, ms, msCheck: tCheck, file: opt.file ?? null, times: res.times, fail: fail.map((c) => c.id), warn: warn.map((c) => c.id), skip: skip.map((c) => c.id), checks: res.checks, spots: res.spots, notes: res.notes, mmMarkers: res.mmCount ?? 0, shots: files, decl };
  writeFileSync(join(opt.out, `${id}.json`), JSON.stringify(out, null, 1));
  return out;
}

// ───────────────────────── 실행 ─────────────────────────
try {
  const r = await fetch(opt.base + 'preview.html');
  if (!r.ok) throw new Error(String(r.status));
} catch (e) {
  console.error(`검사 서버(${opt.base})에 닿지 않음 — 먼저 \`npm run dev:check\` (포트 5274, HMR 끔)`);
  process.exit(2);
}
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader']
});
const queue = [...nums];
const results = [];
const tAll = Date.now();
await Promise.all(
  Array.from({ length: Math.min(opt.jobs, nums.length) }, async () => {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    while (queue.length) {
      const n = queue.shift();
      const r = await checkOne(browser, page, n);
      results.push(r);
      const pick = (st) => r.checks.filter((c) => c.status === st).map((c) => `${c.id}: ${c.detail}`);
      const line = `${r.id} ${r.verdict.toUpperCase().padEnd(4)} ${(r.ms / 1000).toFixed(1)}s  fail[${r.fail.join(',')}] warn[${r.warn.join(',')}] skip ${r.skip.length}${r.mmMarkers ? '' : ' (표식 없음)'}`;
      console.log(line);
      for (const f of pick('fail')) console.log('    ✗ ' + f.slice(0, 300));
    }
    await page.close();
  })
);
results.sort((a, b) => a.n - b.n);

if (opt.sheet && results.length) {
  const a = id3(results[0].n);
  const b = id3(results.at(-1).n);
  const file = join(opt.out, `sheet-${a}-${b}.html`);
  const color = { pass: '#2b8a3e', warn: '#e67700', fail: '#c92a2a' };
  const rows = results
    .map((r) => {
      const img = r.shots.cmp ? `<img src="${relative(dirname(file), r.shots.cmp).replace(/\\/g, '/')}" style="width:100%;max-width:1800px">` : '(캡처 없음)';
      const lines = r.checks.filter((c) => c.status === 'fail' || c.status === 'warn').map((c) => `<li style="color:${color[c.status]}">${c.name}: ${c.detail.replace(/</g, '&lt;')}</li>`).join('');
      return `<section style="margin:0 0 24px"><h2 style="margin:4px 0;color:${color[r.verdict]}">${r.id} — ${r.verdict}</h2>${img}<ul style="margin:4px 0;font-size:13px">${lines || '<li>이상 없음</li>'}</ul></section>`;
    })
    .join('\n');
  writeFileSync(file, `<!doctype html><meta charset="utf-8"><title>507 대조판 ${a}–${b}</title><body style="font-family:sans-serif;margin:16px"><h1>507 대조판 ${a}–${b}</h1><p>pass ${results.filter((r) => r.verdict === 'pass').length} · warn ${results.filter((r) => r.verdict === 'warn').length} · fail ${results.filter((r) => r.verdict === 'fail').length}</p>${rows}</body>`);
  console.log(`대조판: ${file}`);
}
await browser.close();
const nf = results.filter((r) => r.verdict === 'fail').length;
console.log(`합계 ${results.length}개 — pass ${results.filter((r) => r.verdict === 'pass').length}, warn ${results.filter((r) => r.verdict === 'warn').length}, fail ${nf} (${((Date.now() - tAll) / 1000).toFixed(1)}s)`);
process.exitCode = nf ? 1 : 0;
