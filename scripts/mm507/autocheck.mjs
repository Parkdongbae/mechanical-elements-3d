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
// 메시 기하 검사(2026-11 개선): 부품끼리 박힘 = 메시 표본점이 다른 부품 메시 안(세 축 광선 홀짝)에 든 깊이,
//   뜬 부품 = 메시 접촉 그래프에서 전시대와 이어지지 않는 무리, 기어 물림 = 실제 메시 단면끼리 침범 깊이,
//   감긴 각 = 경로 꺾임 합(접점 사이 호만), 속도비 = 잘게 나눠 누적한 회전각(X·Y·Z 아무 축).

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
  const h = md.search(/^(?:#+[^\n]*|[★*\s]*)검사\s*선언/m);
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

  let geoStamp = 0; // seek 마다 +1 — 월드 삼각형 캐시 무효화
  const seek = (t, sp = 1) => {
    M.seek(t, sp);
    g.updateMatrixWorld(true);
    geoStamp++;
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
    /**
     * 실제 감긴 각: 구간 안 점에서 경로 방향이 바퀴 평면에서 꺾인 각의 합(들어오는 가닥 방향 → 나가는 가닥 방향).
     * 앉음 창(dev ≤ hi) 은 접점 밖 직선 가닥도 몇 cm 품으므로(반지름 0.3 에서 접점 양쪽 ~13°) 각 범위로 재면 부푼다.
     * 직선 가닥 점에서는 꺾임이 0 이라 접점 사이의 호만 더해진다.
     */
    const turnOf = (run) => {
      const idx = (k) => (Rp.closed ? ((k % N) + N) % N : k);
      // 닫힌 경로에서 이음매를 넘는 구간은 run 이 [..., N−1, 0, 1, ...] 로 이어져 있다 — 차례대로 따라간다
      const seq = [run[0] - 1, ...run, run.at(-1) + 1];
      const dirs = [];
      let prev = null;
      for (const k of seq) {
        const ia = idx(k);
        if (ia < 0 || ia >= N) continue;
        const q = P[ia];
        if (prev) {
          const d = q.clone().sub(prev);
          const x = d.dot(e1);
          const y = d.dot(e2);
          if (Math.hypot(x, y) > 1e-7) dirs.push([x, y]);
        }
        prev = q;
      }
      let s = 0;
      for (let k = 1; k < dirs.length; k++) {
        const [ax, ay] = dirs[k - 1];
        const [bx, by] = dirs[k];
        s += Math.atan2(ax * by - ay * bx, ax * bx + ay * by);
      }
      return s;
    };
    // 앉은 호
    for (const run of runsOf((c) => c === 1)) {
      const swRange = sweepOf(run);
      if (run.length < 3 || Math.abs(deg(swRange)) < 3) continue;
      const swTurn = turnOf(run);
      // 꺾임 합이 각 범위보다 클 수는 없다(점이 원 위에서만 꺾일 때) — 경로가 구간 안에서 크게 다른 쪽으로 꺾이면 각 범위를 쓴다
      const sw = Math.sign(swTurn) === Math.sign(swRange) && Math.abs(swTurn) <= Math.abs(swRange) + 0.05 ? swTurn : swRange;
      if (decl.__debug) console.log('[autocheck] turn', Rp.name, W.name, deg(swTurn).toFixed(1), deg(swRange).toFixed(1), run.length);
      if (Math.abs(deg(sw)) < 1) continue;
      const sgn = sw >= 0 ? 1 : -1;
      const devs = run.map((i) => info[i].dev);
      const rc = Math.min(...run.map((i) => info[i].rr)) + 0.0005; // 호의 반지름(직선이 접선으로 스치는 구간이 섞여도 원 쪽)
      const as = run.map((i) => info[i].a);
      const aMean = as.reduce((s, x) => s + x, 0) / as.length;
      const aSpread = Math.max(...as) - Math.min(...as);
      const iMid = run[Math.floor(run.length / 2)];
      const S = { wheel: W.name, deg: Math.round(Math.abs(deg(sw))), range: Math.round(Math.abs(deg(swRange))), ccw: sgn > 0, devMin: r3(Math.min(...devs)), devMax: r3(Math.max(...devs)), axialOff: r3(aMean - mid), at: ptOf(iMid), rc };
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

  // ── 메시 기하: 월드 삼각형·표본점·광선 격자·거리 격자 (박힘·뜬 부품·기어 단면 검사용) ──
  const geoCache = new Map();
  /** 메시의 월드 삼각형(Float32Array 9개씩)·상자·꼭짓점. InstancedMesh 는 인스턴스를 펼친다 */
  const worldGeo = (m) => {
    const c = geoCache.get(m);
    if (c && c.stamp === geoStamp) return c;
    const geo = m.geometry;
    const pos = geo?.attributes?.position;
    const G = { stamp: geoStamp, m, tris: new Float32Array(0), nt: 0, box: new THREE.Box3(), verts: new Float32Array(0), grids: [null, null, null], dgrid: null, samples: null };
    if (!pos || pos.count === 0) {
      geoCache.set(m, G);
      return G;
    }
    const idx = geo.index;
    const nt0 = Math.floor((idx ? idx.count : pos.count) / 3);
    const mats = [];
    if (m.isInstancedMesh) {
      for (let i = 0; i < m.count; i++) {
        const im = new THREE.Matrix4();
        m.getMatrixAt(i, im);
        mats.push(m.matrixWorld.clone().multiply(im));
      }
    } else mats.push(m.matrixWorld);
    const tris = new Float32Array(nt0 * 9 * mats.length);
    const verts = new Float32Array(pos.count * 3 * mats.length);
    const tmp = V();
    let o = 0;
    let vo = 0;
    for (const M4 of mats) {
      const base = vo;
      for (let i = 0; i < pos.count; i++) {
        tmp.fromBufferAttribute(pos, i).applyMatrix4(M4);
        verts[vo++] = tmp.x;
        verts[vo++] = tmp.y;
        verts[vo++] = tmp.z;
      }
      for (let t = 0; t < nt0; t++)
        for (let k = 0; k < 3; k++) {
          const vi = idx ? idx.getX(3 * t + k) : 3 * t + k;
          tris[o++] = verts[base + 3 * vi];
          tris[o++] = verts[base + 3 * vi + 1];
          tris[o++] = verts[base + 3 * vi + 2];
        }
    }
    G.tris = tris;
    G.nt = nt0 * mats.length;
    G.verts = verts;
    const b = G.box;
    for (let i = 0; i < verts.length; i += 3) {
      if (!Number.isFinite(verts[i] + verts[i + 1] + verts[i + 2])) continue;
      b.expandByPoint(tmp.set(verts[i], verts[i + 1], verts[i + 2]));
    }
    geoCache.set(m, G);
    return G;
  };
  /** 표면 표본점: 꼭짓점 + 면 중심 + 큰 면은 h 간격 겹 무게중심 점 */
  const samplesOf = (G, h = 0.025) => {
    if (G.samples) return G.samples;
    const out = [];
    const { verts, tris, nt } = G;
    const vs = Math.max(1, Math.floor(verts.length / 3 / 2500));
    for (let i = 0; i < verts.length / 3; i += vs) out.push(verts[3 * i], verts[3 * i + 1], verts[3 * i + 2]);
    const ts = Math.max(1, Math.floor(nt / 4000));
    for (let t = 0; t < nt; t += ts) {
      const o = 9 * t;
      const ax = tris[o], ay = tris[o + 1], az = tris[o + 2];
      const bx = tris[o + 3], by = tris[o + 4], bz = tris[o + 5];
      const cx = tris[o + 6], cy = tris[o + 7], cz = tris[o + 8];
      const L = Math.max(Math.hypot(bx - ax, by - ay, bz - az), Math.hypot(cx - bx, cy - by, cz - bz), Math.hypot(ax - cx, ay - cy, az - cz));
      const n = Math.min(10, Math.max(1, Math.ceil(L / h)));
      if (n === 1) {
        out.push((ax + bx + cx) / 3, (ay + by + cy) / 3, (az + bz + cz) / 3);
        continue;
      }
      for (let i = 0; i <= n; i++)
        for (let j = 0; i + j <= n; j++) {
          const k = n - i - j;
          if ((i === n || j === n || k === n) && n > 1) continue; // 꼭짓점은 위에서
          const u = (i + 1 / 3) / (n + 1), w = (j + 1 / 3) / (n + 1), z = 1 - u - w;
          out.push(u * ax + w * bx + z * cx, u * ay + w * by + z * cy, u * az + w * bz + z * cz);
        }
    }
    G.samples = new Float32Array(out);
    return G.samples;
  };
  /** 광선 격자: ax 방향 광선, 나머지 두 좌표 평면에 삼각형 투영을 칸에 담는다 */
  const rayGrid = (G, ax) => {
    if (G.grids[ax]) return G.grids[ax];
    const u = (ax + 1) % 3;
    const v = (ax + 2) % 3;
    const bmin = G.box.min.toArray();
    const bmax = G.box.max.toArray();
    const n = Math.max(1, Math.min(64, Math.ceil(Math.sqrt(G.nt) / 1.5)));
    const u0 = bmin[u], v0 = bmin[v];
    const du = (bmax[u] - u0) / n || 1e-9;
    const dv = (bmax[v] - v0) / n || 1e-9;
    const cells = Array.from({ length: n * n }, () => []);
    const T = G.tris;
    for (let t = 0; t < G.nt; t++) {
      const o = 9 * t;
      const pu = [T[o + u], T[o + 3 + u], T[o + 6 + u]];
      const pv = [T[o + v], T[o + 3 + v], T[o + 6 + v]];
      const area = (pu[1] - pu[0]) * (pv[2] - pv[0]) - (pu[2] - pu[0]) * (pv[1] - pv[0]);
      if (Math.abs(area) < 1e-14 || !Number.isFinite(area)) continue;
      const i0 = Math.max(0, Math.floor((Math.min(...pu) - u0) / du));
      const i1 = Math.min(n - 1, Math.floor((Math.max(...pu) - u0) / du));
      const j0 = Math.max(0, Math.floor((Math.min(...pv) - v0) / dv));
      const j1 = Math.min(n - 1, Math.floor((Math.max(...pv) - v0) / dv));
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) cells[i * n + j].push(t);
    }
    G.grids[ax] = { u, v, n, u0, v0, du, dv, cells };
    return G.grids[ax];
  };
  /** 점 p(배열) 에서 ax 방향 직선과 메시의 교차: 홀짝(+방향)·가장 가까운 교차까지 거리 */
  const rayCross = (G, ax, p) => {
    const R = rayGrid(G, ax);
    const pu = p[R.u] + 1.37e-6;
    const pv = p[R.v] + 0.73e-6;
    const i = Math.floor((pu - R.u0) / R.du);
    const j = Math.floor((pv - R.v0) / R.dv);
    if (i < 0 || j < 0 || i >= R.n || j >= R.n) return { odd: false, near: Infinity };
    const T = G.tris;
    let cnt = 0;
    let near = Infinity;
    for (const t of R.cells[i * R.n + j]) {
      const o = 9 * t;
      const au = T[o + R.u], av = T[o + R.v], bu = T[o + 3 + R.u], bv = T[o + 3 + R.v], cu = T[o + 6 + R.u], cv = T[o + 6 + R.v];
      const d = (bu - au) * (cv - av) - (cu - au) * (bv - av);
      const w0 = ((bu - pu) * (cv - pv) - (cu - pu) * (bv - pv)) / d;
      const w1 = ((cu - pu) * (av - pv) - (au - pu) * (cv - pv)) / d;
      const w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const h = w0 * T[o + ax] + w1 * T[o + 3 + ax] + w2 * T[o + 6 + ax];
      if (h > p[ax]) cnt++;
      near = Math.min(near, Math.abs(h - p[ax]));
    }
    return { odd: cnt % 2 === 1, near };
  };
  /** 점이 메시 안이면 깊이(축 6 방향 가장 가까운 면까지 — 실제 거리의 윗값), 밖이면 −1. 세 축 가운데 둘 이상이 홀수일 때 안 */
  const insideDepth = (G, p) => {
    const b = G.box;
    if (p[0] < b.min.x || p[0] > b.max.x || p[1] < b.min.y || p[1] > b.max.y || p[2] < b.min.z || p[2] > b.max.z) return -1;
    let votes = 0;
    let near = Infinity;
    for (let ax = 0; ax < 3; ax++) {
      const r = rayCross(G, ax, p);
      if (r.odd) votes++;
      near = Math.min(near, r.near);
      if (ax === 1 && votes === 0) return -1;
    }
    if (votes < 2) return -1;
    // 축 방향 거리는 실제 거리의 윗값(회전체 축 위 점은 부채꼴 꼭짓점을 놓쳐 크게 나온다) — 0.06 안은 삼각형 거리로 고친다
    return Math.min(near, exactDist(G, p, Math.min(near, 0.06)));
  };
  /** 점에서 메시 표면까지 거리(r 안에서만 찾고, 없으면 r) */
  const exactDist = (G, p, r) => {
    if (!(r > 0)) return 0;
    const cells = distGrid(G);
    let best = r * r;
    const [px, py, pz] = p;
    const i0 = Math.floor((px - r) / DG_H), i1 = Math.floor((px + r) / DG_H);
    const j0 = Math.floor((py - r) / DG_H), j1 = Math.floor((py + r) / DG_H);
    const k0 = Math.floor((pz - r) / DG_H), k1 = Math.floor((pz + r) / DG_H);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) for (let k = k0; k <= k1; k++) {
      const a = cells.get(`${i},${j},${k}`);
      if (a) for (const t of a) best = Math.min(best, triDist2(G.tris, 9 * t, px, py, pz));
    }
    return Math.sqrt(best);
  };
  /** 점-삼각형 최소 거리 제곱 (Ericson) */
  const triDist2 = (T, o, px, py, pz) => {
    const ax = T[o], ay = T[o + 1], az = T[o + 2];
    const abx = T[o + 3] - ax, aby = T[o + 4] - ay, abz = T[o + 5] - az;
    const acx = T[o + 6] - ax, acy = T[o + 7] - ay, acz = T[o + 8] - az;
    const apx = px - ax, apy = py - ay, apz = pz - az;
    const d1 = abx * apx + aby * apy + abz * apz;
    const d2 = acx * apx + acy * apy + acz * apz;
    let qx, qy, qz;
    if (d1 <= 0 && d2 <= 0) (qx = ax), (qy = ay), (qz = az);
    else {
      const bpx = px - T[o + 3], bpy = py - T[o + 4], bpz = pz - T[o + 5];
      const d3 = abx * bpx + aby * bpy + abz * bpz;
      const d4 = acx * bpx + acy * bpy + acz * bpz;
      const cpx = px - T[o + 6], cpy = py - T[o + 7], cpz = pz - T[o + 8];
      const d5 = abx * cpx + aby * cpy + abz * cpz;
      const d6 = acx * cpx + acy * cpy + acz * cpz;
      const vc = d1 * d4 - d3 * d2;
      const vb = d5 * d2 - d1 * d6;
      const va = d3 * d6 - d5 * d4;
      if (d3 >= 0 && d4 <= d3) (qx = T[o + 3]), (qy = T[o + 4]), (qz = T[o + 5]);
      else if (d6 >= 0 && d5 <= d6) (qx = T[o + 6]), (qy = T[o + 7]), (qz = T[o + 8]);
      else if (vc <= 0 && d1 >= 0 && d3 <= 0) {
        const s = d1 / (d1 - d3);
        (qx = ax + s * abx), (qy = ay + s * aby), (qz = az + s * abz);
      } else if (vb <= 0 && d2 >= 0 && d6 <= 0) {
        const s = d2 / (d2 - d6);
        (qx = ax + s * acx), (qy = ay + s * acy), (qz = az + s * acz);
      } else if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
        const s = (d4 - d3) / (d4 - d3 + (d5 - d6));
        (qx = T[o + 3] + s * (T[o + 6] - T[o + 3])), (qy = T[o + 4] + s * (T[o + 7] - T[o + 4])), (qz = T[o + 5] + s * (T[o + 8] - T[o + 5]));
      } else {
        const den = 1 / (va + vb + vc);
        const v2 = vb * den;
        const w2 = vc * den;
        (qx = ax + abx * v2 + acx * w2), (qy = ay + aby * v2 + acy * w2), (qz = az + abz * v2 + acz * w2);
      }
    }
    return (px - qx) ** 2 + (py - qy) ** 2 + (pz - qz) ** 2;
  };
  /** 거리 격자(칸 h): 점 근처 삼각형만 */
  const DG_H = 0.05;
  const distGrid = (G) => {
    if (G.dgrid) return G.dgrid;
    const cells = new Map();
    const T = G.tris;
    for (let t = 0; t < G.nt; t++) {
      const o = 9 * t;
      const lo = [0, 1, 2].map((k) => Math.floor(Math.min(T[o + k], T[o + 3 + k], T[o + 6 + k]) / DG_H));
      const hi = [0, 1, 2].map((k) => Math.floor(Math.max(T[o + k], T[o + 3 + k], T[o + 6 + k]) / DG_H));
      if (!lo.every(Number.isFinite) || !hi.every(Number.isFinite)) continue;
      if ((hi[0] - lo[0] + 1) * (hi[1] - lo[1] + 1) * (hi[2] - lo[2] + 1) > 20000) continue;
      for (let i = lo[0]; i <= hi[0]; i++) for (let j = lo[1]; j <= hi[1]; j++) for (let k = lo[2]; k <= hi[2]; k++) {
        const key = `${i},${j},${k}`;
        let a = cells.get(key);
        if (!a) cells.set(key, (a = []));
        a.push(t);
      }
    }
    G.dgrid = cells;
    return cells;
  };
  /** 점에서 메시까지 거리가 tol 이하인가 */
  const nearMesh = (G, px, py, pz, tol) => {
    const b = G.box;
    if (px < b.min.x - tol || px > b.max.x + tol || py < b.min.y - tol || py > b.max.y + tol || pz < b.min.z - tol || pz > b.max.z + tol) return false;
    const cells = distGrid(G);
    const t2 = tol * tol;
    const i0 = Math.floor((px - tol) / DG_H), i1 = Math.floor((px + tol) / DG_H);
    const j0 = Math.floor((py - tol) / DG_H), j1 = Math.floor((py + tol) / DG_H);
    const k0 = Math.floor((pz - tol) / DG_H), k1 = Math.floor((pz + tol) / DG_H);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) for (let k = k0; k <= k1; k++) {
      const a = cells.get(`${i},${j},${k}`);
      if (!a) continue;
      for (const t of a) if (triDist2(G.tris, 9 * t, px, py, pz) <= t2) return true;
    }
    return false;
  };
  const boxGap = (a, b) => Math.max(a.min.x - b.max.x, b.min.x - a.max.x, a.min.y - b.max.y, b.min.y - a.max.y, a.min.z - b.max.z, b.min.z - a.max.z);
  /** 두 메시가 tol 안에서 닿는가: 표본점 거리 또는 한쪽 표본점이 다른 쪽 안 */
  const meshTouch = (GA, GB, tol) => {
    if (boxGap(GA.box, GB.box) > tol) return false;
    for (const [P, Q] of [[GA, GB], [GB, GA]]) {
      const S = samplesOf(P);
      const bb = Q.box;
      let insideTried = 0;
      for (let i = 0; i < S.length; i += 3) {
        const x = S[i], y = S[i + 1], z = S[i + 2];
        if (x < bb.min.x - tol || x > bb.max.x + tol || y < bb.min.y - tol || y > bb.max.y + tol || z < bb.min.z - tol || z > bb.max.z + tol) continue;
        if (nearMesh(Q, x, y, z, tol)) return true;
        if (insideTried < 400 && x >= bb.min.x && x <= bb.max.x && y >= bb.min.y && y <= bb.max.y && z >= bb.min.z && z <= bb.max.z) {
          insideTried++;
          if (insideDepth(Q, [x, y, z]) > 0) return true;
        }
      }
    }
    return false;
  };

  // ── 줄 판독 묶음(한 시각) ──
  const ropeReport = (label) => {
    const W = wheelDiscs();
    const Rs = ropes();
    const pairs = [];
    for (const R of Rs) for (const w of W) {
      const r = ropeWheel(R, w);
      if (r) pairs.push({ rope: R.name, R, Wd: w, ...r });
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
  const mats2 = new Map();
  for (const m of meshes()) {
    mats2.set(m, m.matrixWorld.clone());
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

  // 8) 속도비·방향 — t1 → t2 를 잘게 나눠(한 걸음 회전 < 1.2 rad 가 될 때까지 4배씩) 회전각을 누적한다(±π 접힘 없음).
  //    회전축: 선언 axisA/axisB(['x'|'y'|'z'] 또는 [x,y,z] 월드) > 표식 mm.axis(물체 로컬, 걸음마다 월드로) >
  //    쿼터니언 차에서 뽑은 축(로컬 Z 와 나란하면 로컬 Z — 예전 판정과 같은 부호, 아니면 월드 축을 큰 성분이 + 가 되게).
  //    뽑은 축끼리 나란하면 b 의 축을 a 쪽으로 맞춘다(같은 방향 회전 = 양수).
  const quatOf = (o) => o.getWorldQuaternion(new THREE.Quaternion());
  const stepRot = (q0, q1) => {
    const dq = q1.clone().multiply(q0.clone().invert());
    if (dq.w < 0) (dq.x = -dq.x), (dq.y = -dq.y), (dq.z = -dq.z), (dq.w = -dq.w);
    const v = V(dq.x, dq.y, dq.z);
    const s = v.length();
    return { ang: 2 * Math.atan2(s, dq.w), axis: s < 1e-12 ? null : v.multiplyScalar(1 / s) };
  };
  const declAxis = (a) => (a === undefined ? null : typeof a === 'string' ? V(...axisVec(a)) : Array.isArray(a) ? V(...a).normalize() : null);
  /** objs: [{o, axis?}] → 누적 회전각 배열(rad), 축 설명 */
  const accumRot = (items) => {
    for (let n = 16; n <= 1024; n *= 4) {
      seek(t1);
      const st = items.map((it) => ({ ...it, q: quatOf(it.o), sum: 0, ref: it.fixed ?? null, how: it.fixed ? '선언' : it.o.userData?.mm?.axis ? `mm.axis ${it.o.userData.mm.axis}` : null }));
      let tooBig = false;
      for (let k = 1; k <= n && !tooBig; k++) {
        seek(t1 + ((t2 - t1) * k) / n);
        for (const s of st) {
          const q = quatOf(s.o);
          const r = stepRot(s.q, q);
          s.q = q;
          if (r.ang > 1.2) tooBig = true;
          if (!r.axis || r.ang < 1e-9) continue;
          let ref;
          if (s.fixed) ref = s.fixed;
          else if (s.o.userData?.mm?.axis) ref = wdir(s.o, axisVec(s.o.userData.mm.axis));
          else {
            if (!s.ref && r.ang > 1e-5) {
              const lz = wdir(s.o, [0, 0, 1]);
              if (Math.abs(r.axis.dot(lz)) > 0.9) (s.useLZ = true), (s.how = '로컬 Z');
              else {
                const a = r.axis.clone();
                const big = [a.x, a.y, a.z].reduce((bi, x, i, arr) => (Math.abs(x) > Math.abs(arr[bi]) ? i : bi), 0);
                if ([a.x, a.y, a.z][big] < 0) a.negate();
                s.ref = a;
                s.how = `뽑은 축 (${r3(a.x)}, ${r3(a.y)}, ${r3(a.z)})`;
              }
            }
            ref = s.useLZ ? wdir(s.o, [0, 0, 1]) : s.ref;
          }
          if (ref) s.sum += r.ang * r.axis.dot(ref);
        }
      }
      if (!tooBig || n === 1024) return st;
    }
    return [];
  };
  if ((decl.ratios ?? []).length) {
    const bad = [];
    const got = [];
    for (const r of decl.ratios) {
      const a = namedObj(r.a);
      const b = namedObj(r.b);
      if (!a || !b) {
        bad.push(`${r.a}/${r.b}: 이름을 찾지 못함`);
        continue;
      }
      const [A, B] = accumRot([{ o: a, fixed: declAxis(r.axisA) }, { o: b, fixed: declAxis(r.axisB) }]);
      // 뽑은 축끼리(또는 뽑은 축 ↔ 다른 축) 나란하면 b 를 a 쪽으로
      if (B.ref && !B.fixed && !b.userData?.mm?.axis) {
        const refA = A.fixed ?? (a.userData?.mm?.axis ? wdir(a, axisVec(a.userData.mm.axis)) : A.useLZ ? wdir(a, [0, 0, 1]) : A.ref);
        if (refA && Math.abs(refA.dot(B.ref)) > 0.99 && refA.dot(B.ref) < 0) B.sum = -B.sum;
      }
      const ratio = Math.abs(A.sum) < 1e-6 ? NaN : B.sum / A.sum;
      got.push(`${r.b}/${r.a} = ${r3(ratio)}`);
      if (!Number.isFinite(ratio) || Math.abs(ratio - r.ratio) > (r.tol ?? 0.02)) bad.push(`${r.b}/${r.a} = ${r3(ratio)} (선언 ${r.ratio}±${r.tol ?? 0.02}; ${r.a} ${r3(A.sum)} rad [${A.how ?? '회전 없음'}], ${r.b} ${r3(B.sum)} rad [${B.how ?? '회전 없음'}])`);
    }
    seek(t2);
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

  // 10) 기어 물림 — (가) 평행 축 원형 기어 중심 거리 = m(z1±z2)/2 ±0.005
  //     (나) 이 윤곽 침범: 물리는 짝(기어끼리, 기어 × userData.outline 부품)의 실제 메시를 축에 수직인 평면(겹친 폭의 25·50·75%)으로 잘라
  //          한쪽 단면 꼭짓점이 다른 쪽 단면 안에 든 깊이를 여러 시각에서 잰다. > 0.01 이면 fail(위상 틀림·이끼리 박힘).
  {
    seek(t1);
    const gs = [];
    g.traverse((o) => {
      const mm = o.userData?.mm;
      if (mm?.kind === 'gear' && !mm.noncircular && typeof mm.rp === 'number' && visibleChain(o) && mm.fn !== 'wormScrew' && mm.fn !== 'bevelGear' && mm.fn !== 'crownGear' && mm.fn !== 'flutedCone' && mm.fn !== 'coneBevelGear' && mm.fn !== 'sectorBevelGear') {
        gs.push({ o, mm, c: wpos(o), d: wdir(o, axisVec(mm.axis ?? 'z')), name: o.name || mm.fn });
      }
    });
    // 윤곽 부품(기어 표식 밖): 로컬 Z 가 회전축
    const ols = [];
    g.traverse((o) => {
      if (!visibleChain(o) || under(o, ['gear'])) return;
      const ud = o.userData ?? {};
      if (Array.isArray(ud.outline) || (ud.outlines && typeof ud.outlines === 'object')) ols.push({ o, mm: null, c: wpos(o), d: wdir(o, [0, 0, 1]), name: o.name || 'outline' });
    });
    const centerBad = [];
    const centerOk = [];
    const meshPairs = []; // 윤곽 침범을 잴 짝
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
      meshPairs.push([A, B]);
      if (Math.abs(err) > 0.005) {
        centerBad.push(`${pathName(A.o)} × ${pathName(B.o)}: 중심 거리 ${r3(dist)} (m(z1±z2)/2 = ${r3(exp)})`);
        spot(A.c.clone().lerp(B.c, 0.5), 0.35, 'fail', '기어 중심 거리');
      } else centerOk.push(`${A.mm.teeth}×${B.mm.teeth}`);
    }
    // 기어 × 윤곽 부품: 평행 축, 폭 겹침, 바깥 원이 겹치는 짝
    const outerR = (X) => {
      if (X.mm) return X.mm.internal ? (X.mm.rOut ?? X.mm.rf ?? X.mm.rp * 1.2) : (X.mm.ra ?? X.mm.rp);
      const ud = X.o.userData;
      const all = [...(Array.isArray(ud.outline) ? ud.outline : []), ...Object.values(ud.outlines ?? {}).flat()];
      return all.reduce((m, p) => (Array.isArray(p) ? Math.max(m, Math.hypot(p[0], p[1])) : m), 0);
    };
    for (const A of gs) for (const B of ols) {
      if (Math.abs(A.d.dot(B.d)) < 0.995) continue;
      const u = B.c.clone().sub(A.c);
      const ax = u.dot(A.d);
      if (Math.abs(ax) > 0.3) continue;
      const dist = u.clone().sub(A.d.clone().multiplyScalar(ax)).length();
      if (dist < 1e-3 || dist > outerR(A) + outerR(B) + 0.01) continue;
      meshPairs.push([A, B]);
    }

    /** obj 의 메시를 평면 (p − c0)·d = a 로 자른 선분들(평면 좌표 e1·e2, 원점 c0) */
    const slice = (obj, c0, d, e1, e2, a) => {
      const segs = [];
      obj.traverse((m) => {
        if (!m.isMesh || isOverlay(m) || !visibleChain(m)) return;
        const G = worldGeo(m);
        const T = G.tris;
        for (let t = 0; t < G.nt; t++) {
          const o = 9 * t;
          const P = [0, 1, 2].map((k) => [T[o + 3 * k] - c0.x, T[o + 3 * k + 1] - c0.y, T[o + 3 * k + 2] - c0.z]);
          const sd = P.map((p) => p[0] * d.x + p[1] * d.y + p[2] * d.z - a);
          if ((sd[0] > 0 && sd[1] > 0 && sd[2] > 0) || (sd[0] < 0 && sd[1] < 0 && sd[2] < 0)) continue;
          const pts = [];
          for (let k = 0; k < 3; k++) {
            const k2 = (k + 1) % 3;
            if ((sd[k] > 0) === (sd[k2] > 0)) continue;
            const f = sd[k] / (sd[k] - sd[k2]);
            const q = [0, 1, 2].map((c) => P[k][c] + f * (P[k2][c] - P[k][c]));
            pts.push([q[0] * e1.x + q[1] * e1.y + q[2] * e1.z, q[0] * e2.x + q[1] * e2.y + q[2] * e2.z]);
          }
          if (pts.length === 2) segs.push(pts[0][0], pts[0][1], pts[1][0], pts[1][1]);
        }
      });
      return segs;
    };
    /** 단면 선분을 중심 (cx, cy) 둘레 각도 칸에 담는다 — 지름 방향 광선 홀짝·가까운 선분 찾기 */
    const NB = 720;
    const binSec = (segs, cx, cy) => {
      const bins = Array.from({ length: NB }, () => []);
      let rMax = 0;
      for (let s = 0; s < segs.length; s += 4) {
        const a1 = Math.atan2(segs[s + 1] - cy, segs[s] - cx);
        const a2 = Math.atan2(segs[s + 3] - cy, segs[s + 2] - cx);
        rMax = Math.max(rMax, Math.hypot(segs[s] - cx, segs[s + 1] - cy), Math.hypot(segs[s + 2] - cx, segs[s + 3] - cy));
        let lo = a1;
        let span = a2 - a1;
        if (span > Math.PI) span -= 2 * Math.PI;
        if (span < -Math.PI) span += 2 * Math.PI;
        if (span < 0) (lo = a2), (span = -span);
        const b0 = Math.floor(((lo + Math.PI) / (2 * Math.PI)) * NB);
        const nb = Math.min(NB, Math.floor((span / (2 * Math.PI)) * NB) + 2);
        for (let k = 0; k < nb; k++) bins[(((b0 + k) % NB) + NB) % NB].push(s);
      }
      return { segs, cx, cy, bins, rMax };
    };
    /** 점이 단면 안이면 경계까지 거리(≤ 0.05 로 자름), 밖이면 −1 */
    const secDepth = (S, px, py) => {
      const dx = px - S.cx;
      const dy = py - S.cy;
      const r = Math.hypot(dx, dy);
      if (r > S.rMax || r < 1e-6) return -1;
      const ux = dx / r;
      const uy = dy / r;
      const ang = Math.atan2(dy, dx);
      const b = Math.floor(((ang + Math.PI) / (2 * Math.PI)) * NB) % NB;
      const sg = S.segs;
      let cnt = 0;
      const seen = new Set();
      for (const s of S.bins[b]) {
        if (seen.has(s)) continue;
        seen.add(s);
        // 광선 p + t·u (t > 0) × 선분
        const ax = sg[s] - px, ay = sg[s + 1] - py, bx = sg[s + 2] - px, by = sg[s + 3] - py;
        // 광선에 수직인 성분으로 부호 바뀜 판정(약간 비틀어 꼭짓점 통과를 피함)
        const na = -uy * ax + ux * ay + 1.1e-7;
        const nbv = -uy * bx + ux * by + 1.1e-7;
        if ((na > 0) === (nbv > 0)) continue;
        const f = na / (na - nbv);
        const tAlong = (ax + f * (bx - ax)) * ux + (ay + f * (by - ay)) * uy;
        if (tAlong > 0) cnt++;
      }
      if (cnt % 2 === 0) return -1;
      // 경계까지 거리: 각도 창 안의 선분
      const lim = 0.05;
      const w = Math.min(NB / 2, Math.ceil((lim / r / (2 * Math.PI)) * NB) + 1);
      let best = lim;
      const seen2 = new Set();
      for (let k = -w; k <= w; k++) for (const s of S.bins[(((b + k) % NB) + NB) % NB]) {
        if (seen2.has(s)) continue;
        seen2.add(s);
        const ax = sg[s], ay = sg[s + 1], bx = sg[s + 2], by = sg[s + 3];
        const ex = bx - ax, ey = by - ay;
        const L = ex * ex + ey * ey || 1e-18;
        const t = Math.max(0, Math.min(1, ((px - ax) * ex + (py - ay) * ey) / L));
        best = Math.min(best, Math.hypot(px - ax - t * ex, py - ay - t * ey));
      }
      return best;
    };
    const axialRange = (obj, c0, d) => {
      let lo = Infinity;
      let hi = -Infinity;
      obj.traverse((m) => {
        if (!m.isMesh || isOverlay(m) || !visibleChain(m)) return;
        const vs = worldGeo(m).verts;
        for (let i = 0; i < vs.length; i += 3) {
          const a = (vs[i] - c0.x) * d.x + (vs[i + 1] - c0.y) * d.y + (vs[i + 2] - c0.z) * d.z;
          lo = Math.min(lo, a);
          hi = Math.max(hi, a);
        }
      });
      return [lo, hi];
    };
    const span = decl.period ?? 12;
    const tList = [t1, t2, ...Array.from({ length: 6 }, (_, k) => (span * (k + 0.5)) / 6)];
    let worst = { d: 0 };
    let sliced = 0;
    for (const t of tList) {
      if (!meshPairs.length) break;
      seek(t);
      for (const [A, B] of meshPairs) {
        const c0 = wpos(A.o);
        const d = wdir(A.o, A.mm ? axisVec(A.mm.axis ?? 'z') : [0, 0, 1]);
        const cB = wpos(B.o);
        const ref = Math.abs(d.x) < 0.9 ? V(1, 0, 0) : V(0, 1, 0);
        const e1 = ref.sub(d.clone().multiplyScalar(ref.dot(d))).normalize();
        const e2 = d.clone().cross(e1);
        const ra = axialRange(A.o, c0, d);
        const rb = axialRange(B.o, c0, d);
        const lo = Math.max(ra[0], rb[0]);
        const hi = Math.min(ra[1], rb[1]);
        if (!(hi - lo > 0.004)) continue;
        const bq = cB.clone().sub(c0);
        const bx = bq.dot(e1);
        const by = bq.dot(e2);
        for (const f of [0.25, 0.5, 0.75]) {
          const a = lo + f * (hi - lo) + 1.3e-5;
          const SA = binSec(slice(A.o, c0, d, e1, e2, a), 0, 0);
          const SB = binSec(slice(B.o, c0, d, e1, e2, a), bx, by);
          if (!SA.segs.length || !SB.segs.length) continue;
          sliced++;
          for (const [P, Q] of [[SA, SB], [SB, SA]]) {
            const sg = P.segs;
            for (let s = 0; s < sg.length; s += 2) {
              const px = sg[s];
              const py = sg[s + 1];
              if (Math.hypot(px - Q.cx, py - Q.cy) > Q.rMax) continue;
              const dd = secDepth(Q, px, py);
              if (dd > worst.d && decl.__debug) {
                const near = (S) => { const o = []; for (let q = 0; q < S.segs.length; q += 4) if (Math.hypot(S.segs[q] - px, S.segs[q + 1] - py) < 0.12) o.push(S.segs.slice(q, q + 4).map(r3)); return o; };
                window.__dbgSec = { px, py, dd, which: P === SA ? 'A' : 'B', A: near(SA), B: near(SB), t, f };
              }
              if (dd > worst.d) worst = { d: dd, t, f, a: pathName(A.o), b: pathName(B.o), at: c0.clone().add(e1.clone().multiplyScalar(px)).add(e2.clone().multiplyScalar(py)).add(d.clone().multiplyScalar(a)) };
            }
          }
        }
      }
    }
    seek(t1);
    const meshBad = worst.d > 0.01;
    if (meshBad) spot(worst.at, 0.3, 'fail', '이 윤곽 침범');
    const lines = [...centerBad];
    if (meshBad) lines.push(`이 윤곽 침범 ${r3(worst.d)} (t=${r3(worst.t)}, 겹친 폭 ${Math.round(worst.f * 100)}% 단면, ${worst.a} × ${worst.b}, 기준 0.01)`);
    if (!anyMM) add('gears', '기어 물림', 'skip', SKIP_NO_MM);
    else if (!meshPairs.length) add('gears', '기어 물림', 'skip', gs.length < 2 && !ols.length ? `평행 축 원형 기어 ${gs.length}개` : '물리는 짝(같은 모듈·평행 축·중심 거리)을 찾지 못함');
    else add('gears', '기어 물림', lines.length ? 'fail' : 'pass', lines.join(' / ') || `물림 ${meshPairs.length}쌍${centerOk.length ? ` 중심 거리 맞음(${centerOk.join(', ')})` : ''} — 이 윤곽 최대 침범 ${r3(worst.d)} (단면 ${sliced}개, ${tList.length} 시각)`, { meshDepth: r3(worst.d), at: worst.at ? worst.at.toArray().map(r3) : null, t: worst.t ?? null });
  }

  // 11) 다각형 침범(userData.outline(s))
  {
    const polys = [];
    g.traverse((o) => {
      if (!visibleChain(o)) return;
      if (Array.isArray(o.userData?.outline)) polys.push({ o, name: 'outline', pts: o.userData.outline, hole: false });
      const ol = o.userData?.outlines;
      if (ol && typeof ol === 'object') for (const [k, v] of Object.entries(ol)) if (Array.isArray(v)) polys.push({ o, name: k, pts: v, hole: /hole|groove|slot/i.test(k) });
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
      // 부품(메시들)의 꼭짓점을 법선 n 에 투영한 [최소, 최대] — 두 범위 사이 틈(겹치면 음수)
      const nRange = (o, n) => {
        let lo = Infinity, hi = -Infinity;
        const v = V();
        o.traverse((m) => {
          if (!m.isMesh || !visibleChain(m)) return;
          const pos = m.geometry?.attributes?.position;
          if (!pos) return;
          const step = Math.max(1, Math.floor(pos.count / 2000));
          for (let i = 0; i < pos.count; i += step) {
            const d = v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld).dot(n);
            if (d < lo) lo = d;
            if (d > hi) hi = d;
          }
        });
        return [lo, hi];
      };
      const layerGap = (a, b, n) => {
        const [a0, a1] = nRange(a, n);
        const [b0, b1] = nRange(b, n);
        if (!Number.isFinite(a0) || !Number.isFinite(b0)) return -1;
        return Math.max(b0 - a1, a0 - b1);
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
            // 두 부품의 실제 두께 범위(법선 방향)가 겹치지 않으면 다른 층 — 앞뒤 층으로 나뉜 폴·돌기·걸쇠를 같은 평면으로 보던 거짓 불합격(206·217·218)
            if (layerGap(A.o, B.o, nB) > 0.002) continue;
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

  // 14) 부품끼리 박힘 — 한 부품 메시의 표본점(꼭짓점·면 중심·큰 면 격자점)이 다른 부품 메시 안(세 축 광선 홀짝, 둘 이상)에
  //     깊이 OV_D 넘게 든 것. 같은 축의 회전체(축 × 허브·베어링 구멍, 바퀴 × 축)와 물린 기어끼리(기어 단면 검사가 맡음)는 뺀다.
  //     깊이 = 그 점에서 축 6 방향으로 가장 가까운 면까지(실제 거리의 윗값).
  //     서로 움직이는 짝이 깊게(≥ OV_FAIL) 박히면 fail, 그 밖은 warn.
  const unitOf = (m) => {
    let top = m;
    let kit = null;
    for (let c = m; c && c !== g; c = c.parent) {
      top = c;
      const k = c.userData?.mm?.kind;
      if (k && k !== 'tag' && k !== 'arrow') kit = c;
    }
    return kit ?? top;
  };
  const revAxes = (m) => {
    const out = [];
    for (let c = m; c && c !== g; c = c.parent) {
      const mm = c.userData?.mm;
      if (!mm) continue;
      if (mm.kind === 'rod' && Array.isArray(mm.a) && Array.isArray(mm.b)) {
        const a = wpos(c, mm.a);
        const b = wpos(c, mm.b);
        if (a.distanceTo(b) > 1e-6) out.push({ p: a, d: b.sub(a).normalize() });
      } else if (['wheel', 'gear', 'shaft', 'pillow', 'block'].includes(mm.kind) && typeof mm.axis === 'string') {
        out.push({ p: wpos(c, [0, mm.kind === 'pillow' ? (mm.bossY ?? 0) : 0, 0]), d: wdir(c, axisVec(mm.axis)) });
      } else if (mm.kind === 'block' || mm.kind === 'wheel') out.push({ p: wpos(c), d: wdir(c, [0, 0, 1]) });
    }
    if (!m.isInstancedMesh && m.geometry) {
      const geo = m.geometry;
      if (!geo.boundingBox) geo.computeBoundingBox();
      const bb = geo.boundingBox;
      const ext = bb.max.clone().sub(bb.min).toArray();
      const ctr = bb.getCenter(V());
      for (let k = 0; k < 3; k++) {
        const a = ext[(k + 1) % 3];
        const b = ext[(k + 2) % 3];
        if (Math.abs(a - b) <= Math.max(0.003, 0.03 * Math.max(a, b))) {
          const p0 = ctr.clone().applyMatrix4(m.matrixWorld);
          const p1 = ctr.clone().add(V(...axisVec(['x', 'y', 'z'][k]))).applyMatrix4(m.matrixWorld);
          out.push({ p: p0, d: p1.sub(p0).normalize() });
        }
      }
    }
    return out;
  };
  const coaxial = (A, B) => {
    for (const a of A) for (const b of B) {
      if (Math.abs(a.d.dot(b.d)) < 0.995) continue;
      const w = b.p.clone().sub(a.p);
      if (w.sub(a.d.clone().multiplyScalar(w.dot(a.d))).length() < 0.012) return true;
    }
    return false;
  };
  /** 축처럼 긴 회전체면 그 축(길이 ≥ 2.5×지름), 아니면 null */
  const rodAxis = (m, axes) => {
    const G = worldGeo(m);
    for (const a of axes) {
      const ext = extentsAlong(G, a.d);
      if (ext.L >= 2.5 * Math.min(ext.U, ext.W) && Math.abs(ext.U - ext.W) <= 0.2 * Math.max(ext.U, ext.W)) return a;
    }
    return null;
  };
  /** 메시 꼭짓점을 방향 d 와 그에 수직인 두 방향으로 잰 폭 */
  const extentsAlong = (G, d) => {
    const ref = Math.abs(d.x) < 0.9 ? V(1, 0, 0) : V(0, 1, 0);
    const u = ref.sub(d.clone().multiplyScalar(ref.dot(d))).normalize();
    const w = d.clone().cross(u);
    const r = [[Infinity, -Infinity], [Infinity, -Infinity], [Infinity, -Infinity]];
    const vs = G.verts;
    const st = Math.max(1, Math.floor(vs.length / 3 / 3000));
    for (let i = 0; i < vs.length / 3; i += st) {
      const x = vs[3 * i], y = vs[3 * i + 1], z = vs[3 * i + 2];
      const a = [d.x * x + d.y * y + d.z * z, u.x * x + u.y * y + u.z * z, w.x * x + w.y * y + w.z * z];
      for (let k = 0; k < 3; k++) (r[k][0] = Math.min(r[k][0], a[k])), (r[k][1] = Math.max(r[k][1], a[k]));
    }
    return { L: r[0][1] - r[0][0], U: r[1][1] - r[1][0], W: r[2][1] - r[2][0], lo: r[0][0], hi: r[0][1] };
  };
  /**
   * 축 A 가 B 를 두께 방향으로 꿰뚫고 지나가는가 — 핀·축이 레버·팔·띠쇠 끝·고리 구멍을 지나는 것(구멍을 안 판 판도 눈으로는 정상).
   * 조건: A 가 축 방향으로 B 의 양쪽 밖까지 나가고, B 의 축 방향 두께 ≤ max(축 지름, 0.6 × B 의 다른 두 폭 중 작은 것).
   * (040 옛 판처럼 축보다 굵은 기둥 끝이 축에 박히거나 고리가 옆으로 꿰인 것은 걸린다)
   */
  const throughPlate = (rodA, A, B) => {
    if (!rodA) return false;
    const ea = extentsAlong(worldGeo(A), rodA.d);
    const e = extentsAlong(worldGeo(B), rodA.d);
    if (ea.lo > e.lo + 0.002 || ea.hi < e.hi - 0.002) return false;
    return e.L <= Math.max(Math.min(ea.U, ea.W), 0.6 * Math.min(e.U, e.W));
  };
  const relMoved = (A, B) => {
    const a1 = mats1.get(A);
    const b1 = mats1.get(B);
    const a2 = mats2.get(A);
    const b2 = mats2.get(B);
    if (!a1 || !b1 || !a2 || !b2) return false;
    const r1 = a1.clone().invert().multiply(b1).elements;
    const r2 = a2.clone().invert().multiply(b2).elements;
    return r1.some((x, i) => Math.abs(x - r2[i]) > 1e-3);
  };
  /** 상자가 겹치거나(gap ≤ tol) 가까운 메시 쌍(x 축 쓸기) */
  const boxPairs = (list, tol) => {
    const items = list.map((m, i) => ({ i, b: worldGeo(m).box })).filter((x) => !x.b.isEmpty()).sort((a, b) => a.b.min.x - b.b.min.x);
    const out = [];
    for (let a = 0; a < items.length; a++) {
      const A = items[a];
      for (let b = a + 1; b < items.length; b++) {
        const B = items[b];
        if (B.b.min.x > A.b.max.x + tol) break;
        if (boxGap(A.b, B.b) <= tol) out.push([A.i, B.i, boxGap(A.b, B.b)]);
      }
    }
    return out;
  };
  const OV_D = 0.01;
  const OV_FAIL = 0.04;
  {
    seek(t1);
    const list = meshes().filter((m) => !inStand(m) && !under(m, ['rope', 'belt']));
    const units = list.map(unitOf);
    const axesCache = new Map();
    const axesOf = (i) => {
      if (!axesCache.has(i)) axesCache.set(i, revAxes(list[i]));
      return axesCache.get(i);
    };
    const members = new Map();
    list.forEach((m, i) => {
      if (!members.has(units[i])) members.set(units[i], []);
      members.get(units[i]).push(i);
    });
    /** 축 rod 가 지나는 B 의 부품(키트 축받이·팔 등) 안에 그 축과 같은 축의 회전체(베어링 고리)가 있는가 */
    const bearingFor = (rod, iB) => rod && (members.get(units[iB]) ?? []).some((k) => coaxial([rod], axesOf(k)));
    const flatC = new Map();
    /** 모든 꼭짓점이 한 평면 위(두께 없는 판) */
    const isFlat = (m) => {
      if (flatC.has(m)) return flatC.get(m);
      const G = worldGeo(m);
      const T = G.tris;
      let f = false;
      for (let t = 0; t < G.nt && !f; t++) {
        const o = 9 * t;
        const a = V(T[o], T[o + 1], T[o + 2]);
        const n = V(T[o + 3], T[o + 4], T[o + 5]).sub(a).cross(V(T[o + 6], T[o + 7], T[o + 8]).sub(a));
        if (n.lengthSq() < 1e-16) continue;
        n.normalize();
        const vs = G.verts;
        f = true;
        for (let i = 0; i < vs.length; i += 3) if (Math.abs((vs[i] - a.x) * n.x + (vs[i + 1] - a.y) * n.y + (vs[i + 2] - a.z) * n.z) > 1e-5) {
          f = false;
          break;
        }
        break;
      }
      flatC.set(m, f);
      return f;
    };
    const GA_ = (m) => worldGeo(m);
    const GB_ = GA_;
    const minExt = (m) => {
      const sz = worldGeo(m).box.getSize(V());
      return Math.min(sz.x, sz.y, sz.z);
    };
    /** 축 rod(메시 G)를 B 가 둘레째 감싸는가: 겹친 구간 가운데에서 축 표면 바로 밖 8 점이 모두 B 안 */
    const envelops = (rod, G, GBm) => {
      if (!rod) return false;
      const ea = extentsAlong(G, rod.d);
      const eb = extentsAlong(GBm, rod.d);
      const lo = Math.max(ea.lo, eb.lo);
      const hi = Math.min(ea.hi, eb.hi);
      if (!(hi > lo)) return false;
      const rr = Math.min(ea.U, ea.W) / 2 + 0.003;
      const t0 = (lo + hi) / 2 - rod.p.dot(rod.d);
      const c = rod.p.clone().add(rod.d.clone().multiplyScalar(t0));
      const ref = Math.abs(rod.d.x) < 0.9 ? V(1, 0, 0) : V(0, 1, 0);
      const u = ref.sub(rod.d.clone().multiplyScalar(ref.dot(rod.d))).normalize();
      const w = rod.d.clone().cross(u);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * 2 * Math.PI;
        const q = c.clone().add(u.clone().multiplyScalar(rr * Math.cos(a))).add(w.clone().multiplyScalar(rr * Math.sin(a)));
        if (insideDepth(GBm, q.toArray()) < 0) return false;
      }
      return true;
    };
    const res = new Map(); // 부품 쌍 → 가장 깊은 것
    let tested = 0;
    for (const [i, j] of boxPairs(list, -0.004)) {
      if (units[i] === units[j]) continue;
      const A = list[i];
      const B = list[j];
      if (under(A, ['gear']) && under(B, ['gear'])) continue; // 물린 기어끼리 — 기어 단면 검사
      if (coaxial(axesOf(i), axesOf(j))) continue;
      if (under(A, ['anchor']) && under(B, ['anchor'])) continue; // 꿰인 고리·갈고리끼리
      const rA = rodAxis(A, axesOf(i));
      const rB = rodAxis(B, axesOf(j));
      if (throughPlate(rA, A, B) || throughPlate(rB, B, A)) continue;
      if (bearingFor(rA, j) || bearingFor(rB, i)) continue; // 축받이 팔을 지나는 축(같은 부품에 베어링 고리)
      if (envelops(rA, GA_(A), GB_(B)) || envelops(rB, GB_(B), GA_(A))) continue; // 축을 둘레째 감싼 받침 덩어리(구멍을 안 판 축받이)
      // 얇은 표시 띠·점(가장 얇은 폭 ≤ 0.02)이 함께 움직이는(상대 자세 그대로) 것에 묻힌 것
      if ((minExt(A) <= 0.02 || minExt(B) <= 0.02) && !relMoved(A, B)) continue;
      if (isFlat(A) || isFlat(B)) continue; // 두께 없는 판(컷어웨이 단면 뚜껑 등) — 안팎이 없다
      const isTorus = (m) => m.geometry?.type === 'TorusGeometry';
      if ((isTorus(A) || isTorus(B)) && !relMoved(A, B)) continue; // 들보·띠쇠에 박아 붙인 눈고리(고정)
      tested++;
      const GA = worldGeo(A);
      const GB = worldGeo(B);
      let nDeep = 0;
      let dMax = 0;
      let at = null;
      for (const [P, Q] of [[GA, GB], [GB, GA]]) {
        const S = samplesOf(P);
        const bb = Q.box;
        const idx = [];
        for (let k = 0; k < S.length; k += 3) if (S[k] > bb.min.x && S[k] < bb.max.x && S[k + 1] > bb.min.y && S[k + 1] < bb.max.y && S[k + 2] > bb.min.z && S[k + 2] < bb.max.z) idx.push(k);
        const step = Math.max(1, Math.floor(idx.length / 900));
        for (let q = 0; q < idx.length; q += step) {
          const k = idx[q];
          const p = [S[k], S[k + 1], S[k + 2]];
          const d = insideDepth(Q, p);
          if (d >= OV_D) {
            if (decl.__debug && d > 0.1) console.log('[autocheck] deep', pathName(P.m), '→', pathName(Q.m), p.map(r3).join(','), [0, 1, 2].map((ax) => JSON.stringify(rayCross(Q, ax, p))).join(' '), Q.nt);
            nDeep++;
            if (d > dMax) (dMax = d), (at = V(...p));
          }
        }
      }
      // 축이 받침·띠쇠에 얕게(축 반지름의 55% 이하) 앉은 것은 뺀다 — 040 옛 판은 축 반지름만큼(0.047) 박혀 걸린다
      const rodR = Math.max(rA ? Math.min(extentsAlong(GA, rA.d).U, extentsAlong(GA, rA.d).W) / 2 : 0, rB ? Math.min(extentsAlong(GB, rB.d).U, extentsAlong(GB, rB.d).W) / 2 : 0);
      if (rodR > 0 && dMax <= 0.55 * rodR) continue;
      if (nDeep >= 3 || dMax >= 0.015) {
        const ua = units[i];
        const ub = units[j];
        const key = ua.id < ub.id ? `${ua.id}:${ub.id}` : `${ub.id}:${ua.id}`;
        const moving = relMoved(A, B);
        const prev = res.get(key);
        if (!prev || dMax > prev.d) res.set(key, { a: pathName(A), b: pathName(B), d: r3(dMax), n: nDeep + (prev?.n ?? 0), moving: moving || !!prev?.moving, at, ga: `${A.geometry?.type} ${GA.box.min.toArray().map(r3)}~${GA.box.max.toArray().map(r3)}`, gb: `${B.geometry?.type} ${GB.box.min.toArray().map(r3)}~${GB.box.max.toArray().map(r3)}` });
        else prev.n += nDeep;
      }
    }
    const ov = [...res.values()].sort((a, b) => b.d - a.d);
    for (const o of ov) o.level = o.moving && o.d >= OV_FAIL && o.n >= 3 ? 'fail' : 'warn';
    for (const o of ov.slice(0, 3)) spot(o.at, 0.35, o.level, '부품 박힘');
    const st = ov.some((o) => o.level === 'fail') ? 'fail' : ov.length ? 'warn' : 'pass';
    add('overlap', '부품끼리 박힘', st, ov.slice(0, 5).map((o) => `${o.a} × ${o.b} 깊이 ${o.d}(점 ${o.n}${o.moving ? ', 서로 움직임' : ''})`).join(' / ') || `메시 표본점 박힘 없음(깊이 ${OV_D} 기준, 상자 겹친 쌍 ${tested}개 검사)`, { items: ov.slice(0, 12).map((o) => ({ ...o, at: o.at.toArray().map(r3) })) });
  }

  // 16) 뜬 부품 — 메시 접촉 그래프(최소 거리 ≤ 0.01, 줄·벨트는 0.02)에서 전시대와 이어지지 않는 무리
  //     줄·벨트는 앉은 바퀴·끝이 붙은 고리/표면과 잇는다. 키트 부품(표식 있는 그룹) 안의 메시는 한 덩어리로 본다.
  if (!stand) add('float', '뜬 부품', 'skip', '전시대(stand) 표식 없음');
  else {
    seek(t1);
    const all = meshes();
    const N = all.length;
    const par = all.map((_, i) => i);
    const find = (i) => {
      while (par[i] !== i) i = par[i] = par[par[i]];
      return i;
    };
    const join = (a, b) => {
      const x = find(a);
      const y = find(b);
      if (x !== y) par[x] = y;
    };
    const ix = new Map(all.map((m, i) => [m, i]));
    const meshesIn = (o) => {
      const a = [];
      o.traverse((c) => {
        if (ix.has(c)) a.push(ix.get(c));
      });
      return a;
    };
    const joinAll = (a, b) => {
      if (!a.length || !b.length) return;
      for (const x of a) join(x, a[0]);
      for (const y of b) join(y, a[0]);
    };
    // 전시대 메시 한 덩어리, 키트 부품 안 메시 한 덩어리
    const standIx = meshesIn(stand);
    for (const x of standIx) join(x, standIx[0]);
    const kitUnits = new Map();
    all.forEach((m, i) => {
      const u = unitOf(m);
      if (!u.userData?.mm?.kind) return;
      if (!kitUnits.has(u)) kitUnits.set(u, i);
      else join(i, kitUnits.get(u));
    });
    const isCord = all.map((m) => !!under(m, ['rope', 'belt']));
    // 줄·벨트 ↔ 앉은 바퀴, 끝 ↔ 고리·표면
    if (rep1) {
      for (const pr of rep1.pairs) if (pr.seated.length || pr.cls[1] >= 3) joinAll(meshesIn(pr.R.obj), meshesIn(pr.Wd.obj));
      const anchors = byKind('anchor').map((o) => ({ o, mm: o.userData.mm, p: wpos(o, o.userData.mm.point ?? [0, 0, 0]) }));
      for (const R of rep1.Rs) {
        const rm = meshesIn(R.obj);
        for (const E of R.ends) {
          let hit = null;
          for (const A of anchors) {
            const d = E.distanceTo(A.p);
            const gap = A.mm.ring !== undefined ? Math.max(0, Math.min(d, E.distanceTo(wpos(A.o, A.mm.center ?? A.mm.point ?? [0, 0, 0])) - A.mm.ring - (A.mm.tube ?? 0))) : d;
            if (gap <= 0.012) hit = A.o;
          }
          if (hit) joinAll(rm, meshesIn(hit));
          else {
            const s = surfDist(E, (m) => insideOf(m, R.obj), 0.05);
            if (s.who && s.d - R.rho <= 0.012 && ix.has(s.who)) joinAll(rm, [ix.get(s.who)]);
          }
        }
      }
    }
    const pairs = boxPairs(all, 0.03).sort((a, b) => a[2] - b[2]);
    const isStand = all.map((m) => inStand(m));
    // 같은 축에 꿴 회전체(축 × 허브 구멍 — 틈이 있어도 받쳐진 것)는 상자가 겹치면 잇는다
    const axC = new Map();
    const axOf = (i) => {
      if (!axC.has(i)) axC.set(i, revAxes(all[i]));
      return axC.get(i);
    };
    for (const [i, j, gap] of pairs) if (gap <= 0 && find(i) !== find(j) && !isCord[i] && !isCord[j] && coaxial(axOf(i), axOf(j))) join(i, j);
    let touchTests = 0;
    for (const [i, j, gap] of pairs) {
      // 뒤판·받침에 붙인 것은 0.03(앞에서 보면 붙어 보이는 틈 — 12번 들보 0.025), 줄·벨트 0.02, 그 밖 0.012
      const tol = isStand[i] || isStand[j] ? 0.03 : isCord[i] || isCord[j] ? 0.02 : 0.012;
      if (gap > tol) continue;
      if (find(i) === find(j)) continue;
      touchTests++;
      if (meshTouch(worldGeo(all[i]), worldGeo(all[j]), tol)) join(i, j);
      else if (decl.__debug) console.log('[autocheck] notouch', pathName(all[i]), pathName(all[j]), r3(gap), all[i].geometry?.type, all[j].geometry?.type);
    }
    const root = standIx.length ? find(standIx[0]) : -1;
    if (decl.__debug) all.forEach((m, i) => { const b = worldGeo(m).box; if (b.max.y > 2.5) console.log('[autocheck] mesh', i, find(i) === root ? 'ROOT' : find(i), pathName(m), m.geometry?.type, b.min.toArray().map(r3).join(','), b.max.toArray().map(r3).join(',')); });
    const comps = new Map();
    all.forEach((m, i) => {
      const r = find(i);
      if (r === root) return;
      if (!comps.has(r)) comps.set(r, []);
      comps.get(r).push(i);
    });
    const flAll = [...comps.values()].map((ids) => {
      const b = new THREE.Box3();
      for (const i of ids) b.union(worldGeo(all[i]).box);
      const names = [...new Set(ids.map((i) => pathName(unitOf(all[i]))))];
      const size = b.getSize(V());
      return { names, n: ids.length, at: b.getCenter(V()), size: Math.max(size.x, size.y, size.z) };
    }).sort((a, b) => b.size - a.size);
    // 크기 0.08 미만(눈금·표시점 같은 장식)은 경보에서 빼고 수만 적는다
    const fl = flAll.filter((f) => f.size >= 0.08);
    const tiny = flAll.length - fl.length;
    for (const f of fl.slice(0, 3)) spot(f.at, Math.max(0.3, Math.min(0.6, f.size)), 'warn', '뜬 부품');
    add('float', '뜬 부품', fl.length ? 'warn' : 'pass', fl.slice(0, 5).map((f) => `${f.names.slice(0, 3).join(', ')}${f.names.length > 3 ? ` 외 ${f.names.length - 3}` : ''} (메시 ${f.n}, 크기 ${r3(f.size)}) @ (${r3(f.at.x)}, ${r3(f.at.y)}, ${r3(f.at.z)})`).join(' / ') || `메시 ${N}개 모두 전시대와 닿아 이어짐(접촉 시험 ${touchTests}쌍${tiny ? `, 크기 0.08 미만 장식 ${tiny}개는 뺌` : ''})`, { items: fl.slice(0, 12).map((f) => ({ ...f, at: f.at.toArray().map(r3) })) });
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
