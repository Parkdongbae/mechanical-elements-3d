#!/usr/bin/env node
// 507 설계표 검사 — 작업 지시서 20 · 3-5 (새 양식 4-2 기준)
//
//   node scripts/mm507/sheetlint.mjs <n|a-b|n,n,…|파일.md …> [--json] [--quiet]
//     예) node scripts/mm507/sheetlint.mjs 41-60
//         node scripts/mm507/sheetlint.mjs docs/mm507-sheets/051.md --json
//   → 번호마다 "NNN  fail k  warn m" 과 항목. --json 이면 JSON 배열 하나를 표준 출력에.
//   종료 코드 0 = fail 없음, 1 = fail 있음, 2 = 인자 오류.
//
// 보는 것:
//   필수 절(★ 판화 읽기·구동·부품과 치수·동작·표시·notes·확인·★ 줄·벨트 표·★ 연결 표·★ 깊이 계산·★ 검사 선언·★ 난도·질문)
//   판화 읽기 질문 1~9 가 빈칸 없이 / 검사 선언 JSON 이 읽히고 형식이 맞는지 / 깊이(E6) 숫자가 있고 ZC+R ≤ 0.8, ZC−R ≥ −0.25
//   이름표 3개 이상 / 키트에 없는 함수 이름 / 치수 모순(피치 반지름 = 잇수·모듈/2, 같은 기호 두 값, 줄↔림 짝) / 전시 영역(중심±반지름)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SHEETS = path.join(ROOT, 'docs/mm507-sheets');
const KIT = path.join(ROOT, 'src/mm507/kit');

// 전시 영역(지시서 20 · 3-4) / 깊이 규칙(4-1)
const AREA = { x: 2.2, yMin: -0.02, yMax: 3.3, zMin: -0.37, zMax: 0.8 };
const DEPTH = { max: 0.8, min: -0.25 };

// ───────── 인자 ─────────
const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const quiet = argv.includes('--quiet');
const targets = argv.filter((a) => !a.startsWith('--'));
if (targets.length === 0) {
  console.error('사용법: node scripts/mm507/sheetlint.mjs <n|a-b|n,n,…|파일.md …> [--json] [--quiet]');
  process.exit(2);
}
const files = [];
for (const t of targets) {
  if (t.endsWith('.md')) {
    files.push(path.resolve(t));
    continue;
  }
  for (const part of t.split(',')) {
    const m = /^(\d+)(?:-(\d+))?$/.exec(part.trim());
    if (!m) {
      console.error(`알 수 없는 인자: ${part}`);
      process.exit(2);
    }
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    for (let n = a; n <= b; n++) {
      const f = path.join(SHEETS, `${String(n).padStart(3, '0')}.md`);
      if (fs.existsSync(f)) files.push(f);
      else if (a === b) files.push(f); // 하나만 준 번호는 없다고 보고
    }
  }
}

// ───────── 키트 이름 목록 ─────────
function exportsOf(file) {
  if (!fs.existsSync(file)) return [];
  const src = fs.readFileSync(file, 'utf8');
  const out = [];
  for (const m of src.matchAll(/export\s+(?:declare\s+)?(?:async\s+)?(?:function\*?|const|let|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/g)) out.push(m[1]);
  for (const m of src.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const s of m[1].split(',')) {
      const nm = s.trim().split(/\s+as\s+/).pop();
      if (nm) out.push(nm.trim());
    }
  }
  return out;
}
const kitFiles = fs.readdirSync(KIT).filter((f) => f.endsWith('.ts'));
const publicNames = new Map(); // 이름 → 파일
for (const f of kitFiles) {
  if (/^k\d{3}\.ts$/.test(f)) continue;
  for (const nm of exportsOf(path.join(KIT, f))) if (!publicNames.has(nm)) publicNames.set(nm, f);
}
const sharedNames = new Set([
  ...exportsOf(path.join(ROOT, 'src/models/parts/geom.ts')),
  ...exportsOf(path.join(ROOT, 'src/models/parts/gears.ts')),
  ...exportsOf(path.join(ROOT, 'src/models/materials.ts')),
  ...exportsOf(path.join(ROOT, 'src/mm507/types.ts')),
  ...exportsOf(path.join(ROOT, 'src/machines/stlShared.ts'))
]);
const ownKit = (n) => exportsOf(path.join(KIT, `k${n}.ts`));
const otherKits = new Map(); // 이름 → kNNN.ts
for (const f of kitFiles) {
  if (!/^k\d{3}\.ts$/.test(f)) continue;
  for (const nm of exportsOf(path.join(KIT, f))) otherKits.set(nm, f);
}
// 함수처럼 보여도 키트가 아닌 것(JS·THREE·설계표 관용 표기)
const IGNORE = new Set([
  'Math', 'sin', 'cos', 'tan', 'atan', 'atan2', 'asin', 'acos', 'sqrt', 'hypot', 'abs', 'min', 'max', 'floor', 'ceil', 'round', 'sign', 'exp', 'log', 'pow',
  'mod', 'clamp', 'lerp', 'smoothstep', 'f', 'g', 'h', 'r', 'p', 's', 'x', 'y', 'z', 'k', 'n', 'u', 'v', 'w', 'q', 'R', 'S', 'L', 'C', 'K', 'N',
  'Vector3', 'Vector2', 'Group', 'Mesh', 'Shape', 'Path', 'BoxGeometry', 'CylinderGeometry', 'TorusGeometry', 'SphereGeometry', 'ConeGeometry',
  'TubeGeometry', 'CircleGeometry', 'PlaneGeometry', 'ExtrudeGeometry', 'LatheGeometry', 'BufferGeometry', 'CatmullRomCurve3', 'Matrix4', 'Quaternion', 'Euler',
  'update', 'notes', 'view', 'dispose', 'setPath', 'setOffset', 'add', 'set', 'copy', 'clone', 'lookAt', 'rotateX', 'rotateY', 'rotateZ', 'translate',
  'position', 'rotation', 'scale', 'push', 'map', 'filter', 'solve', 'angleB', 'ratio', 'theta', 'phi', 'psi', 'seek', 'cam', 'labels', 'render',
  'setFromUnitVectors', 'setFromAxisAngle', 'setRotationFromAxisAngle', 'applyAxisAngle', 'applyQuaternion', 'applyMatrix4', 'normalize', 'cross', 'crossVectors', 'dot', 'sub', 'multiplyScalar', 'addScaledVector', 'distanceTo', 'makeBasis', 'makeRotationAxis', 'setFromEuler', 'setFromRotationMatrix', 'getWorldPosition', 'localToWorld', 'worldToLocal', 'updateMatrixWorld', 'traverse', 'premultiply', 'multiply',
  'buildM', 'default', 'import', 'require', 'if', 'for', 'while', 'return', 'function', 'new', 'typeof', 'export', 'atan2f'
]);

// ───────── 도우미 ─────────
const normNum = (s) => s.replace(/[−–—]/g, '-').replace(/[＝]/g, '=');
const NUM = String.raw`-?\d+(?:\.\d+)?|-?\.\d+`;
const num = (s) => Number(normNum(s));

/** 절 나누기: '#'·'##'·'###' 머리줄, 또는 ★ 로 시작하는 줄 */
function sections(text) {
  const lines = text.split(/\r?\n/);
  const out = [{ title: '(머리)', key: 'head', lines: [], start: 1 }];
  let inCode = false;
  lines.forEach((ln, i) => {
    if (/^\s*```/.test(ln)) inCode = !inCode;
    const isHead = !inCode && (/^#{1,4}\s+/.test(ln) || /^\s*(?:#{1,4}\s*)?★/.test(ln));
    if (isHead && !/^#\s+\d{3}\b/.test(ln)) {
      const title = ln.replace(/^\s*#{1,4}\s*/, '').replace(/^★\s*/, '').trim();
      out.push({ title, key: keyOf(title), lines: [], start: i + 1 });
    } else out[out.length - 1].lines.push(ln);
  });
  return out;
}
function keyOf(t) {
  const s = t.replace(/\s+/g, '');
  if (/판화읽기/.test(s)) return 'reading';
  if (/^구동/.test(s)) return 'drive';
  if (/부품과치수|^부품/.test(s)) return 'parts';
  if (/^동작/.test(s)) return 'motion';
  if (/^표시/.test(s)) return 'display';
  if (/^notes/i.test(s)) return 'notes';
  if (/^확인/.test(s)) return 'check';
  if (/줄.?벨트표|^줄표|^벨트표/.test(s)) return 'ropes';
  if (/연결표/.test(s)) return 'links';
  if (/깊이계산/.test(s)) return 'depth';
  if (/검사선언/.test(s)) return 'decl';
  if (/난도/.test(s)) return 'grade';
  if (/키트추가/.test(s)) return 'kit';
  if (/검증.*수정|수정.*\(|사용자지적/.test(s)) return 'history';
  if (/의문점|질문/.test(s)) return 'questions';
  return 'other';
}

const REQUIRED = [
  ['reading', '★ 판화 읽기(질문표)'],
  ['drive', '구동'],
  ['parts', '부품과 치수'],
  ['motion', '동작'],
  ['display', '표시'],
  ['notes', 'notes'],
  ['check', '확인'],
  ['ropes', '★ 줄·벨트 표'],
  ['links', '★ 연결 표'],
  ['depth', '★ 깊이 계산'],
  ['decl', '★ 검사 선언(JSON)'],
  ['grade', '★ 난도·질문']
];

const EMPTY_ANS = /^[\s\-—–?？.…·]*$|^(TODO|tbd|미정|빈칸|답|\?\?)$/i;
const NONE_RE = /없음|해당\s*없|필요\s*없|쓰지\s*않|none/i;

// ───────── 한 장 검사 ─────────
function lint(file) {
  const rep = { file: path.relative(ROOT, file).replace(/\\/g, '/'), n: path.basename(file, '.md'), fail: [], warn: [], info: [] };
  const F = (msg) => rep.fail.push(msg);
  const W = (msg) => rep.warn.push(msg);
  const I = (msg) => rep.info.push(msg);
  if (!fs.existsSync(file)) {
    F('파일 없음');
    return rep;
  }
  const raw = fs.readFileSync(file, 'utf8');
  const text = normNum(raw);
  const secs = sections(text);
  const byKey = (k) => secs.filter((s) => s.key === k);
  const body = (k) => byKey(k).map((s) => s.lines.join('\n')).join('\n');
  const has = (k) => byKey(k).length > 0;
  // 검증 기록 절은 옛 값(0.33 → 0.3)을 적으므로 모순·전시 검사에서 뺀다
  const liveText = secs.filter((s) => s.key !== 'history').map((s) => [s.title, ...s.lines].join('\n')).join('\n');

  // 1. 필수 절
  const headText = body('head');
  for (const [k, label] of REQUIRED) {
    if (has(k)) continue;
    if (k === 'drive' && /^\s*구동\s*[:：]/m.test(text)) continue; // 옛 양식: 머리의 "구동:" 줄
    if (k === 'notes' && /notes/i.test(body('display'))) {
      I('notes 는 표시 절 안에 있음(따로 절 없음)');
      continue;
    }
    F(`필수 절 없음: ${label}`);
  }
  if (!/^#\s+\d{3}\s+\S/m.test(text)) F('제목 줄 "# NNN 한글 이름" 없음');
  if (has('reading') && /판화\s*[:：]/.test(headText)) I('머리에 옛 "판화:" 서술도 있음');

  // 2. 판화 읽기 질문 1~9
  if (has('reading')) {
    const lines = body('reading').split('\n');
    const items = new Map();
    let cur = null;
    for (const ln of lines) {
      const t = /^\s*\|\s*(\d)\s*\|(.*)$/.exec(ln); // 표: | 1 | 질문 | 답 |
      const l = /^\s*(?:[-*]\s*)?(?:Q\s*)?(\d)\s*[.)．:]\s*(.*)$/.exec(ln);
      if (t) {
        const cells = t[2].split('|').map((c) => c.trim()).filter((c, i, a) => !(i === a.length - 1 && c === ''));
        items.set(Number(t[1]), cells.length >= 2 ? cells[cells.length - 1] : cells[0] ?? '');
        cur = null;
      } else if (l) {
        cur = Number(l[1]);
        items.set(cur, l[2]);
      } else if (cur !== null && ln.trim() !== '' && !/^\s*\|/.test(ln)) items.set(cur, items.get(cur) + ' ' + ln.trim());
    }
    const missing = [];
    const blank = [];
    for (let q = 1; q <= 9; q++) {
      if (!items.has(q)) {
        missing.push(q);
        continue;
      }
      const s = items.get(q).trim();
      // "질문? → 답", "질문: 답", "질문 — 답" 꼴이면 뒤쪽이 답
      const sep = s.split(/→|=>|[:：]|\s—\s|\s-\s|\?\s|？/);
      const ans = sep.length > 1 ? sep.slice(1).join(' ').trim() : s;
      if (EMPTY_ANS.test(ans) || ans.replace(/[\s*_`]/g, '').length < 2) blank.push(q);
    }
    if (missing.length) F(`판화 읽기: 질문 ${missing.join(',')} 번이 없음`);
    if (blank.length) F(`판화 읽기: 질문 ${blank.join(',')} 번 답이 빈칸`);
    const q9 = items.get(9) ?? '';
    if (/★|질문\s*거리|있다|있음/.test(q9) && !/없(다|음)/.test(q9) && has('grade') && /질문\s*[:：]?\s*없음/.test(body('grade')))
      W('판화 읽기 9번에 질문 거리가 있다는데 난도·질문 절은 "없음"');
  }

  // 3. 검사 선언 JSON
  let decl = null;
  if (has('decl')) {
    const b = body('decl');
    const m = /```(?:json|jsonc)?\s*\n([\s\S]*?)```/.exec(b);
    if (!m) F('검사 선언: ```json 블록 없음');
    else {
      try {
        decl = JSON.parse(m[1]);
      } catch (e) {
        F(`검사 선언 JSON 이 읽히지 않음: ${e.message}`);
      }
    }
    if (decl !== null) checkDecl(decl, F, W);
  }

  // 4. 깊이 계산(E6)
  if (has('depth')) {
    const b = body('depth');
    const zc = [...b.matchAll(new RegExp(String.raw`Z\s*C\s*[=:]?\s*(${NUM})`, 'gi'))].map((m) => num(m[1]));
    const rmax = [...b.matchAll(new RegExp(String.raw`(?:최대\s*반지름|R\s*max|Rmax|반지름\s*최대)\s*[=:]?\s*(${NUM})`, 'gi'))].map((m) => num(m[1]));
    const ranges = [...b.matchAll(new RegExp(String.raw`z\s*(?:범위)?\s*[=:∈]?\s*\[?\s*(${NUM})\s*(?:~|～|…|\.\.|,)\s*(${NUM})`, 'gi'))].map((m) => [num(m[1]), num(m[2])]);
    const anyNum = new RegExp(NUM).test(b.replace(/\b(?:E6|0?4-1|4-2)\b/g, ''));
    if (!anyNum) {
      if (NONE_RE.test(b)) I('깊이 계산: 해당 없음');
      else F('깊이 계산: 숫자가 없음(ZC, 최대 반지름, z 범위)');
    } else {
      let zHi = -Infinity;
      let zLo = Infinity;
      for (const [a, c] of ranges) {
        zLo = Math.min(zLo, a, c);
        zHi = Math.max(zHi, a, c);
      }
      if (zc.length && rmax.length) {
        const Z = zc[0];
        const Rm = Math.max(...rmax);
        zHi = Math.max(zHi, Z + Rm);
        zLo = Math.min(zLo, Z - Rm);
        const stated = ranges[0];
        if (stated && (Math.abs(stated[1] - (Z + Rm)) > 0.011 || Math.abs(stated[0] - (Z - Rm)) > 0.011))
          W(`깊이 계산: 적은 z 범위 ${stated[0]}~${stated[1]} 가 ZC±R = ${(Z - Rm).toFixed(3)}~${(Z + Rm).toFixed(3)} 와 다름`);
      } else if (!ranges.length) W('깊이 계산: ZC·최대 반지름 또는 z 범위를 찾지 못함(형식 "ZC = 0.3, 최대 반지름 0.48, z −0.18~0.78")');
      if (zHi > DEPTH.max + 1e-9) F(`깊이 계산: z 최대 ${zHi.toFixed(3)} > ${DEPTH.max}`);
      if (zLo < DEPTH.min - 1e-9) F(`깊이 계산: z 최소 ${zLo.toFixed(3)} < ${DEPTH.min}`);
    }
  }
  if (decl?.depth?.zMax !== undefined && decl.depth.zMax > DEPTH.max) F(`검사 선언 depth.zMax ${decl.depth.zMax} > ${DEPTH.max}`);

  // 5. 이름표 3개 이상
  const disp = body('display') + '\n' + body('notes');
  const tagLines = disp.split('\n').filter((l) => /tag|이름표/i.test(l));
  const tagNames = new Set();
  for (const l of tagLines) {
    for (const m of l.matchAll(/'([^']+)'|"([^"]+)"|‘([^’]+)’|“([^”]+)”|「([^」]+)」/g)) tagNames.add(m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5]);
  }
  const tagCount = tagNames.size;
  if (tagCount < 3) F(`이름표 ${tagCount}개 — 3개 이상 필요(표시 절의 tag '…')`);
  const ct = decl?.counts?.tags;
  if (Array.isArray(ct) && ct.length === 2 && (tagCount < ct[0] || tagCount > ct[1])) W(`이름표 ${tagCount}개가 검사 선언 counts.tags [${ct}] 밖`);

  // 6. 키트에 없는 함수 이름
  const nnn = rep.n;
  const own = new Set(ownKit(nnn));
  const kitBody = body('kit');
  const proposed = new Set([...kitBody.matchAll(/`?([A-Za-z_]\w*)\s*\(/g)].map((m) => m[1]));
  const unknown = new Set();
  const foreign = new Set();
  const scan = secs.filter((s) => s.key !== 'history' && s.key !== 'kit').map((s) => s.lines.join('\n')).join('\n');
  for (const span of scan.matchAll(/`([^`\n]+)`/g)) {
    for (const m of span[1].matchAll(/(^|[^.\w$])(new\s+)?([A-Za-z_$][\w$]*)\s*\(/g)) {
      const nm = m[3];
      // 키트 이름꼴만 본다: lowerCamel(5자 이상, 대문자 하나 이상) 또는 new 클래스. 한 단어·수식 기호(rad, V3, acc)는 건너뜀
      const kitLike = m[2] ? /^[A-Z][a-z]\w{2,}$/.test(nm) : /^[a-z][a-z0-9]+[A-Z]\w*$/.test(nm) && nm.length >= 5;
      if (!kitLike) continue;
      if (IGNORE.has(nm) || publicNames.has(nm) || sharedNames.has(nm) || own.has(nm) || proposed.has(nm)) continue;
      if (otherKits.has(nm)) foreign.add(`${nm}(${otherKits.get(nm)})`);
      else unknown.add(nm);
    }
  }
  if (unknown.size) F(`키트에 없는 함수: ${[...unknown].join(', ')} (kit/*.ts·k${nnn}.ts·키트 추가 절 어디에도 없음)`);
  if (foreign.size) W(`다른 번호 전용 키트를 부름: ${[...foreign].join(', ')} — 공용 승격 전에는 쓰지 않는다`);
  if (has('kit')) {
    const pubFile = /\b(belt|rope|pulley|gear\d?|misc|shaft|stand|index|mm)\.ts\b/.exec(kitBody);
    if (pubFile && !new RegExp(`k${nnn}\\.ts`).test(kitBody)) W(`키트 추가가 공용 파일 ${pubFile[0]} 을 가리킴 — 새 부품은 kit/k${nnn}.ts 에`);
    for (const nm of proposed) if (publicNames.has(nm) && !own.has(nm) && /export|추가|새/.test(kitBody)) I(`키트 추가의 ${nm} 은 이미 ${publicNames.get(nm)} 에 있음`);
  }

  // 7. 난도·질문
  if (has('grade')) {
    const g = body('grade') + ' ' + byKey('grade').map((s) => s.title).join(' ');
    if (!/(?:^|[^A-Za-z])[ABC](?:[^A-Za-z]|$)/.test(g)) F('난도: A/B/C 가 없음');
    if (!/질문|물을|없음/.test(g)) W('난도·질문: 사용자에게 물을 것(없으면 "없음")이 안 보임');
  }

  // 8. 줄·벨트 표 / 연결 표
  const rows = (k) =>
    body(k)
      .split('\n')
      .filter((l) => /^\s*\|/.test(l) && !/^\s*\|[\s:|-]+\|\s*$/.test(l))
      .slice(1) // 머리줄
      .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
  if (has('ropes')) {
    const rr = rows('ropes');
    if (rr.length === 0 && !NONE_RE.test(body('ropes'))) F('줄·벨트 표: 표가 비었음(줄이 없으면 "없음")');
    for (const r of rr) {
      if (r.length < 5) W(`줄·벨트 표: 칸이 ${r.length}개(줄 | 차례 | 감긴 각·쪽 | 림 | 끝점) — "${r.join(' | ')}"`);
      if (r.some((c) => c === '' || /^[?？-]$/.test(c))) W(`줄·벨트 표: 빈칸 — "${r.join(' | ')}"`);
      const row = r.join(' ');
      const isRope = /로프|밧줄|줄|rope/i.test(r[0] ?? '');
      const isFlat = /평벨트|납작|가죽|flat/i.test(r[0] ?? '');
      if (isRope && !isFlat && /납작|flat/i.test(r[3] ?? '')) W(`줄↔림 짝 어긋남: 로프인데 납작 림 — "${row}"`);
      if (isFlat && /홈|groove/i.test(r[3] ?? '')) W(`줄↔림 짝 어긋남: 평벨트인데 홈 림 — "${row}"`);
      for (const m of row.matchAll(/(\d{3,})\s*°/g)) if (Number(m[1]) > 350) W(`줄·벨트 표: 감긴 각 ${m[1]}° (350° 초과 — 과다 감김?)`);
    }
    const cr = decl?.counts?.rope;
    if (typeof cr === 'number' && rr.length && cr !== rr.length) W(`줄·벨트 표 ${rr.length}줄 ≠ 검사 선언 counts.rope ${cr}`);
  }
  if (has('links')) {
    const lr = rows('links');
    if (lr.length === 0 && !NONE_RE.test(body('links'))) F('연결 표: 표가 비었음(붙는 부품이 없으면 "없음")');
    for (const r of lr) {
      if (r.length < 2 || r.slice(0, 2).some((c) => c === '')) W(`연결 표: 두 점이 다 적히지 않음 — "${r.join(' | ')}"`);
      if (r.length >= 3 && r[2] !== '' && !new RegExp(NUM).test(r[2])) W(`연결 표: 허용 틈이 숫자가 아님 — "${r.join(' | ')}"`);
    }
  }

  // 9. 검사 선언의 이름이 설계표 본문에 나오는가(모델이 그 name 을 붙여야 한다)
  if (decl) {
    const names = new Set();
    for (const k of ['ratios', 'joints', 'links']) for (const it of decl[k] ?? []) for (const f of ['a', 'b']) if (typeof it?.[f] === 'string') names.add(it[f]);
    for (const it of decl.wraps ?? []) for (const f of ['rope', 'wheel']) if (typeof it?.[f] === 'string') names.add(it[f]);
    if (decl.gain) for (const f of ['pull', 'load']) if (typeof decl.gain[f] === 'string') names.add(decl.gain[f]);
    const declText = body('decl').replace(/```[\s\S]*?```/g, '');
    const rest = liveText.replace(/```[\s\S]*?```/g, '') + declText;
    const lost = [...names].filter((nm) => !new RegExp(`\\b${nm.replace(/[$]/g, '\\$')}\\b`).test(rest));
    if (lost.length) W(`검사 선언의 name 이 부품 설명에 없음: ${lost.join(', ')} (어느 부품에 붙일지 부품과 치수에 적을 것)`);
  }

  // 10. 치수 모순
  dims(liveText, decl, F, W, I);
  return rep;
}

function isNum(x) {
  return typeof x === 'number' && Number.isFinite(x);
}
function isStr(x) {
  return typeof x === 'string' && x.length > 0;
}
function isVec(x, n) {
  return Array.isArray(x) && x.length === n && x.every(isNum);
}

/** 3-3 형식 검사 */
function checkDecl(d, F, W) {
  if (typeof d !== 'object' || d === null || Array.isArray(d)) {
    F('검사 선언: JSON 최상위가 객체가 아님');
    return;
  }
  const KNOWN = ['times', 'ratios', 'wraps', 'joints', 'links', 'gain', 'counts', 'depth', 'closeups'];
  for (const k of Object.keys(d)) if (!KNOWN.includes(k)) W(`검사 선언: 모르는 항목 "${k}" (autocheck 가 건너뜀)`);
  const arr = (k, fn) => {
    if (d[k] === undefined) return;
    if (!Array.isArray(d[k])) return F(`검사 선언 ${k}: 배열이어야 함`);
    d[k].forEach((it, i) => {
      const e = fn(it);
      if (e) F(`검사 선언 ${k}[${i}]: ${e}`);
    });
  };
  if (d.times !== undefined) {
    if (!Array.isArray(d.times) || d.times.length < 2 || !d.times.every(isNum)) F('검사 선언 times: 숫자 2개 이상의 배열');
    else {
      if (d.times.some((t) => t < 0)) F('검사 선언 times: 음수 시각');
      if (d.times.some((t, i) => i > 0 && t <= d.times[i - 1])) W('검사 선언 times: 오름차순이 아님(times[0]→[1] 로 속도비를 잰다)');
    }
  } else W('검사 선언: times 없음(autocheck 기본 시각 사용)');
  arr('ratios', (it) => (!isStr(it?.a) || !isStr(it?.b) ? 'a·b 이름 필요' : !isNum(it.ratio) ? 'ratio 숫자 필요' : it.ratio === 0 ? 'ratio 0' : it.tol !== undefined && !(isNum(it.tol) && it.tol >= 0) ? 'tol 은 0 이상 숫자' : null));
  arr('wraps', (it) =>
    !isStr(it?.rope) || !isStr(it?.wheel)
      ? 'rope·wheel 이름 필요'
      : !isNum(it.deg) || it.deg <= 0 || it.deg > 360
        ? 'deg 는 (0, 360]'
        : it.tol !== undefined && !isNum(it.tol)
          ? 'tol 숫자'
          : it.side !== undefined && !isVec(it.side, 3)
            ? 'side 는 [x,y,z]'
            : null
  );
  for (const it of d.wraps ?? []) if (isNum(it?.deg) && it.deg > 350) W(`검사 선언 wraps: ${it.wheel} 감긴 각 ${it.deg}° — 350° 초과는 autocheck 기본 과다 감김 기준과 겹침`);
  arr('joints', (it) => (!isStr(it?.a) || !isStr(it?.b) ? 'a·b 이름 필요' : it.maxGap !== undefined && !(isNum(it.maxGap) && it.maxGap > 0) ? 'maxGap 은 양수' : null));
  arr('links', (it) => (!isStr(it?.a) || !isStr(it?.b) ? 'a·b 이름 필요' : !(isNum(it.length) && it.length > 0) ? 'length 양수 필요' : null));
  if (d.gain !== undefined) {
    const g = d.gain;
    if (!isStr(g?.pull) || !isStr(g?.load) || !(isNum(g?.value) && g.value > 0)) F('검사 선언 gain: { pull, load, value>0 }');
  }
  if (d.counts !== undefined) {
    const c = d.counts;
    for (const k of ['wheel', 'rope', 'gear']) if (c[k] !== undefined && !(Number.isInteger(c[k]) && c[k] >= 0)) F(`검사 선언 counts.${k}: 0 이상 정수`);
    if (c.tags !== undefined && !(isVec(c.tags, 2) && c.tags[0] <= c.tags[1])) F('검사 선언 counts.tags: [최소, 최대]');
    for (const k of Object.keys(c)) if (!['wheel', 'rope', 'gear', 'tags', 'belt', 'anchor', 'weight'].includes(k)) W(`검사 선언 counts: 모르는 kind "${k}"`);
  }
  if (d.depth !== undefined && !(isNum(d.depth?.zMax) || isNum(d.depth?.zMin))) F('검사 선언 depth: { zMax } 숫자');
  arr('closeups', (it) => (!isVec(it, 2) && !isVec(it, 3) ? '[x, y] 또는 [x, y, z]' : Math.abs(it[0]) > AREA.x || it[1] < AREA.yMin || it[1] > AREA.yMax ? '전시 영역 밖' : null));
}

/** 치수 모순·전시 영역 */
function dims(text, decl, F, W, I) {
  const lines = text.split('\n');
  // (가) 피치 반지름 = 잇수·모듈/2
  const gearCall = /(spurGear|wormWheel|internalGear|partialGear|herringboneGear|bevelGear|crownGear)\(\s*(\d+)\s*,\s*(\d*\.?\d+)/;
  for (const ln of lines) {
    const g = gearCall.exec(ln);
    if (!g) continue;
    const rp = (Number(g[2]) * Number(g[3])) / 2;
    const said = [...ln.matchAll(new RegExp(String.raw`피치\s*반지름\s*(?:=|은|는)?\s*(${NUM})(?!\s*[~→])`, 'g'))].map((m) => num(m[1]));
    if (said.length && !said.some((v) => Math.abs(v - rp) < 0.002)) W(`치수 모순: ${g[1]}(${g[2]}, ${g[3]}) 의 피치 반지름은 ${rp.toFixed(4)} 인데 같은 줄에 ${said.join(', ')}`);
  }
  // (나) 같은 기호에 두 값 (ZC = 0.3 / ZC = 0.33). "→"(바꾼 기록) 줄은 뺀다
  const defs = new Map();
  for (const ln of lines) {
    if (/→|->|바꿈|처음/.test(ln)) continue;
    for (const m of ln.matchAll(new RegExp(String.raw`(?:^|[^\w.·])([A-Z][A-Za-z0-9_]{0,7})\s*=\s*(${NUM})(?![\w.(·×*/+])`, 'g'))) {
      const k = m[1];
      if (/^(OMEGA|PI|TAU|E\d|H\d|G\d|B\d|S\d|A|B|C)$/.test(k) && k.length <= 1) continue;
      const v = num(m[2]);
      if (!defs.has(k)) defs.set(k, new Set());
      defs.get(k).add(v);
    }
  }
  for (const [k, vs] of defs) if (vs.size > 1) W(`치수 모순?: ${k} 가 여러 값 ${[...vs].join(', ')}`);
  // (다) 전시 영역 — "중심 (x, y)" + 같은 줄 반지름, "z = …"
  for (const ln of lines) {
    const c = new RegExp(String.raw`중심\s*\(\s*(${NUM})\s*,\s*(${NUM})(?:\s*,\s*(${NUM}))?\s*\)`).exec(ln);
    if (c) {
      const x = num(c[1]);
      const y = num(c[2]);
      let r = 0;
      const g = gearCall.exec(ln);
      if (g) r = (Number(g[2]) * Number(g[3])) / 2 + Number(g[3]);
      const rr = new RegExp(String.raw`(?:바깥\s*)?반지름\s*(?:=|은|는)?\s*(${NUM})`).exec(ln);
      if (rr) r = Math.max(r, num(rr[1]));
      if (Math.abs(x) + r > AREA.x + 1e-9 || y - r < AREA.yMin - 1e-9 || y + r > AREA.yMax + 1e-9)
        W(`전시 영역 밖?: 중심 (${x}, ${y}) ± ${r.toFixed(3)} — x ±${AREA.x}, y ${AREA.yMin}~${AREA.yMax} (줄: "${ln.trim().slice(0, 80)}")`);
    }
    for (const m of ln.matchAll(new RegExp(String.raw`(?:^|[^\w.])z\s*=\s*(${NUM})(?![\w.(])`, 'g'))) {
      const z = num(m[1]);
      if (z > AREA.zMax || z < AREA.zMin) W(`전시 영역 밖?: z = ${z} (z ${AREA.zMin}~${AREA.zMax})`);
    }
  }
  if (decl?.depth?.zMax !== undefined && decl.depth.zMax <= AREA.zMax) I(`전시 깊이 기준 zMax ${decl.depth.zMax}`);
}

// ───────── 실행 ─────────
const reports = files.map(lint);
if (asJson) console.log(JSON.stringify(reports, null, 2));
else {
  for (const r of reports) {
    console.log(`${r.n}  fail ${r.fail.length}  warn ${r.warn.length}${r.fail.length === 0 ? '  ok' : ''}`);
    if (quiet) continue;
    for (const m of r.fail) console.log(`  ✗ ${m}`);
    for (const m of r.warn) console.log(`  ! ${m}`);
    for (const m of r.info) console.log(`  · ${m}`);
  }
}
process.exit(reports.some((r) => r.fail.length) ? 1 : 0);
