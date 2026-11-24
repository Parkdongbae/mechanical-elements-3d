# Fable → Opus 검증 지침서

Opus 에이전트 여러 명이 **같은 기준으로 동시에** 검증하기 위한 문서다. 여기 적힌 항목은 전부 실제로 나왔던 오류이고, 상당수는 앞선 검증자가 "통과"시킨 뒤 사용자가 직접 찾아냈다. **정면 캡처 두 장만 보고 통과시킨 것이 그 원인이었다.**

## 0. 역할과 규칙

| 누가 | 하는 일 |
|---|---|
| Opus | 배정받은 묶음(507 번호 5~10개, 실험 1개, 미션 몇 개)을 이 문서대로 검증. 문제를 찾으면 **자기 묶음의 모델·실험·미션 파일만** 직접 고치고 다시 확인. 5절 형식으로 보고 |
| Fable | 어려운 것(3D 벨트 경로, 비원형 기어, 키트 수정), Opus 가 '남은 문제'로 넘긴 것, 통과분 무작위 재검사 |

- 키트(`src/mm507/kit/*`)·공용 파일(`src/labs/common/*`, `src/dev/preview.ts`, `src/main.ts`, 공용 css)의 문제는 **고치지 말고 보고**한다(파일·줄·재현 번호).
- dev 서버는 이미 떠 있다: `http://localhost:5273/` (다르면 `BASE_URL`). 띄우거나 다시 시작하지 않는다.
- 캡처는 `shots/` 아래(커밋 안 됨). 507 은 `shots/mm/NNN-<이름>.png`, 실험은 `shots/<지시서 번호>/…`, 미션은 `shots/14v/<id>-<이름>.png`.
- 기준 문서: 507 → `docs/work-orders/16-507-전체계획.md` 3·6절 + `docs/mm507-sheets/NNN.md` + 판화 `public/mm507/fig/NNN.png` / 실험 → `docs/work-orders/17`(링크)·`18`(이름표)·`19`(물레방아) / 미션 → `docs/work-orders/14` 3·6절.
- 찍은 PNG 는 **반드시 Read 로 직접 열어 본다.** "저장됨"은 확인이 아니다.

## 1. 507 모델 1개의 검증 절차

모델 `src/mm507/models/mNNN.ts`, 설계표 `docs/mm507-sheets/NNN.md`, 판화 `public/mm507/fig/NNN.png`. 아래에서 `N` = 번호(앞의 0 없이), `NNN` = 세 자리.

### 1-1. 읽기 (캡처 전에)
1. 판화를 Read 로 연다. **줄·벨트가 어느 바퀴의 어느 쪽을 지나 어디로 가는지** 따라가 적는다(가닥 수, 교차 여부, 감긴 바퀴 수, 고정점).
2. 설계표의 "동작"·"notes"·"확인할 것"을 읽고 기대값을 숫자로 적는다: 속도비, 부품별 회전 방향(+/−), 왕복 범위, 기계적 이득.
3. 모델 파일에서 상수(반지름·중심·z)와 `update` 의 식을 본다. 설계표와 식이 다르면 어느 쪽이 판화·원문에 맞는지 따진다.

### 1-2. 캡처
미리보기: `preview.html?mm=N&t=<초>&speed=<배율>&cam=x,y,z,tx,ty,tz&labels=0|1&theme=dark&ui=0`. 구동각 θ = 1.6 × speed × t (rad).

```bash
# 정면 두 시점(θ ≈ 1.6, 2.56 rad). 대기(ms) = t×1000 + 5000
node scripts/shot.mjs "preview.html?mm=N&t=1"   shots/mm/NNN-a.png 6000
node scripts/shot.mjs "preview.html?mm=N&t=1.6" shots/mm/NNN-b.png 6600
# 근접·비스듬 — 접점마다 1장 이상. (cx, cy) = 그 접점의 좌표, 기구 면 z ≈ 0.25
node scripts/shot.mjs "preview.html?mm=N&t=1&labels=0&cam=<cx+0.5>,<cy+0.3>,1.6,<cx>,<cy>,0.25" shots/mm/NNN-c1.png 6000   # 비스듬 근접
node scripts/shot.mjs "preview.html?mm=N&t=1&labels=0&cam=3.2,<cy>,0.25,0,<cy>,0.25"            shots/mm/NNN-side.png 6000 # 옆: z 어긋남·박힘
node scripts/shot.mjs "preview.html?mm=N&t=1&labels=0&cam=<cx>,<cy+2.4>,1.0,<cx>,<cy>,0.25"     shots/mm/NNN-top.png 6000  # 위: 홈 속의 줄, 교차 틈
node scripts/shot.mjs "preview.html?mm=N&t=1&labels=0&cam=<cx+0.4>,<cy-0.9>,1.4,<cx>,<cy>,0.25" shots/mm/NNN-low.png 6000  # 아래에서: 풀리 밑 호
node scripts/shot.mjs "preview.html?mm=N&t=1&theme=dark" shots/mm/NNN-dark.png 6000
```

**근접 캡처를 찍어야 하는 곳(빠짐없이):** 벨트·줄이 바퀴에 닿는 모든 호(풀리마다, 뒤쪽·아래쪽 포함) / 기어 물림점 / 줄이 홈에 앉은 곳 / 가닥이 교차하는 곳 / 드럼·캡스턴에 감긴 곳 / 추·고리·블록이 서로 닿는 곳 / 핀 이음 / 캠과 종동절이 닿는 곳. 변속·왕복처럼 자세가 크게 바뀌는 모델은 **양 끝 자세에서 각각** 찍는다.

**캡처 시간 주의**
- `&t` 는 실제 프레임(dt 최대 0.05 s)을 쌓는다. 헤드리스가 느리면 대기 시간 안에 t 에 못 미친 채 찍힌다 → 대기를 `t×1000+5000` ms 이상으로 하고, 큰 각도는 `&t` 를 키우지 말고 `&speed` 와 섞는다(`t=2&speed=3` = θ 9.6).
- 여러 에이전트가 동시에 캡처하면 더 느려진다. **정확한 시각이 필요한 비교(방향·속도비)는 캡처가 아니라 1-4 수치 검사로 한다**(결정적). 캡처로 비교해야 하면 한 번에 하나씩 찍는다.
- `&speed` 를 빼면 1 이다(예전에는 `Number(null) = 0` 이라 멈춰 있었다). 두 캡처가 똑같으면 이것부터 의심한다.
- 다른 에이전트가 파일을 고치면 HMR 로 페이지가 새로 고쳐진다. 화면이 비었거나 에러가 나면 한 번 더 찍는다.

### 1-3. 판화와 나란히 놓기
아래를 `shots/_verify/mmcmp.mjs` 로 저장한다(`shots/` 는 커밋되지 않고 `node_modules` 를 찾을 수 있는 위치다. **이미 있으면 덮어쓰지 말고 그대로 쓴다**).

```js
// 판화와 캡처를 한 장에 나란히 — node shots/_verify/mmcmp.mjs <n> <캡처.png> [캡처2.png …]  → shots/mm/NNN-cmp.png
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const [, , n, ...shots] = process.argv;
const id = String(n).padStart(3, '0');
const img = (p) => `<img src="data:image/png;base64,${readFileSync(p).toString('base64')}">`;
const html = `<body style="margin:0;display:flex;gap:6px;background:#fff;align-items:flex-start">${[`public/mm507/fig/${id}.png`, ...shots].map(img).join('')}
<style>img{height:640px;width:auto}</style></body>`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 2400, height: 640 } });
await page.setContent(html, { waitUntil: 'load' });
await page.locator('body').screenshot({ path: `shots/mm/${id}-cmp.png` });
await browser.close();
console.log(`saved shots/mm/${id}-cmp.png`);
```

```bash
node shots/_verify/mmcmp.mjs N shots/mm/NNN-a.png shots/mm/NNN-b.png   # → shots/mm/NNN-cmp.png 을 Read 로 연다
```
볼 것: 바퀴 개수·크기 비·축 간 거리 비, **줄이 지나는 길(판화에서 따라간 순서와 같은가)**, 고정점·추·손잡이 위치, 좌우·위아래가 뒤집히지 않았는가.

### 1-4. 수치 검사 (playwright `page.evaluate` 안에서 모델을 직접 빌드)
`shots/_verify/mmcheck.mjs` 로 저장한다(있으면 그대로 사용). `update` 를 0.02 s 씩 직접 부르므로 캡처와 달리 시각이 정확하다.

```js
// 507 모델 수치 검사 — node shots/_verify/mmcheck.mjs <n> [t1=1] [t2=1.6] [probe.json]
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const [, , n = '1', t1 = '1', t2 = '1.6', probeFile] = process.argv;
const probes = probeFile ? JSON.parse(readFileSync(probeFile, 'utf8')) : [];
const base = process.env.BASE_URL ?? 'http://localhost:5273/';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(base + 'preview.html?mm=kit&t=0', { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready === true);
await page.waitForTimeout(1500);
const job = () => page.evaluate(async ({ n, t1, t2, probes }) => {
  const id = String(n).padStart(3, '0');
  const build = (await import(`/src/mm507/models/m${id}.ts`)).default;
  const m = build();
  const g = m.group;
  const V3 = g.position.constructor;
  const r3 = (x) => Math.round(x * 1000) / 1000;
  let now = 0;
  const run = (t) => { while (now < t - 1e-9) { const dt = Math.min(0.02, t - now); m.update(dt, 1); now += dt; } g.updateMatrixWorld(true); };
  const verts = (o, cap = 4000) => { const a = []; o.traverse((c) => { const p = c.isMesh && c.visible && c.geometry.attributes.position; if (!p) return;
    const k = Math.max(1, Math.floor(p.count / cap)); for (let i = 0; i < p.count; i += k) a.push(new V3().fromBufferAttribute(p, i).applyMatrix4(c.matrixWorld)); }); return a; };
  const box = (o) => { const v = verts(o); if (!v.length) return null; const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    for (const p of v) [p.x, p.y, p.z].forEach((q, i) => { lo[i] = Math.min(lo[i], q); hi[i] = Math.max(hi[i], q); }); return { lo: lo.map(r3), hi: hi.map(r3) }; };
  const at = (path) => path.split('.').reduce((o, i) => o.children[Number(i)], g);
  const all = []; // 깊이 2까지의 물체 (경로 = 루트 children 인덱스)
  g.children.forEach((c, i) => { all.push([String(i), c]); c.children.forEach((d, j) => { if (d.children.length || d.isMesh) all.push([`${i}.${j}`, d]); }); });
  const snap = () => all.map(([path, o]) => ({ path, type: o.isSprite ? 'Sprite' : o.geometry?.type ?? o.type, vis: o.visible,
    pos: o.getWorldPosition(new V3()).toArray().map(r3), rot: [o.rotation.x, o.rotation.y, o.rotation.z].map(r3), box: path.includes('.') ? undefined : box(o) }));
  // 축(점 p, 방향 d)에서 본 줄·벨트 꼭짓점: 반지름 범위, 감긴 각, 감긴 부분의 축방향 좌표
  const probe = (q) => {
    const v = verts(at(q.obj), 1e9); const p = new V3(...q.p), d = new V3(...q.d).normalize();
    const ref = Math.abs(d.z) > 0.9 ? new V3(1, 0, 0) : new V3(0, 0, 1); const e1 = ref.clone().sub(d.clone().multiplyScalar(ref.dot(d))).normalize(); const e2 = d.clone().cross(e1);
    const rOf = q.r === undefined ? null : typeof q.r === 'number' ? () => q.r : new Function('a', `return ${q.r}`); // a = 축방향 좌표(원뿔: 'R0 + K*a')
    let rmin = 1e9, sink = 1e9; const rows = v.map((w) => { const u = w.clone().sub(p); const a = u.dot(d); const x = u.dot(e1), y = u.dot(e2); const r = Math.hypot(x, y); return { a, r, ang: Math.atan2(y, x), over: rOf ? r - rOf(a) : 0 }; })
      .filter((s) => q.aRange === undefined || (s.a >= q.aRange[0] && s.a <= q.aRange[1]));
    for (const s of rows) { rmin = Math.min(rmin, s.r); sink = Math.min(sink, s.over); }
    const band = q.band ?? 0.003; const on = rows.filter((s) => (rOf ? s.over - sink : s.r - rmin) < band).sort((s, t) => s.ang - t.ang);
    let gap = 0, gi = 0, a0 = 1e9, a1 = -1e9; on.forEach((s, i) => { const nx = i + 1 < on.length ? on[i + 1].ang : on[0].ang + 2 * Math.PI; if (nx - s.ang > gap) { gap = nx - s.ang; gi = i; } a0 = Math.min(a0, s.a); a1 = Math.max(a1, s.a); });
    const mid = on.length ? on[gi].ang + gap / 2 + Math.PI : 0; const mv = e1.clone().multiplyScalar(Math.cos(mid)).add(e2.clone().multiplyScalar(Math.sin(mid)));
    return { name: q.name, rMin: r3(rmin), sinkMin: rOf ? r3(sink) : undefined, wrapDeg: Math.round(360 - (gap * 180) / Math.PI), wrapMidDir: mv.toArray().map((x) => Math.round(x * 100) / 100), axialOnWrap: [r3(a0), r3(a1)] };
  };
  // 교차점(xy) 둘레 rho 안의 꼭짓점 z — 가장 큰 빈 z 구간이 두 가닥 사이 틈(0 이하면 관통)
  const cross = (q) => { const z = verts(at(q.obj), 1e9).filter((w) => Math.hypot(w.x - q.xy[0], w.y - q.xy[1]) < (q.rho ?? 0.06)).map((w) => w.z).sort((a, b) => a - b);
    let gap = 0; for (let i = 1; i < z.length; i++) gap = Math.max(gap, z[i] - z[i - 1]); return { name: q.name, n: z.length, zMin: r3(z[0]), zMax: r3(z[z.length - 1]), clearGap: r3(gap) }; };
  const measure = () => probes.map((q) => (q.xy ? cross(q) : probe(q)));
  run(t1); const A = snap(), nA = m.notes?.() ?? [], pA = measure();
  run(t2); const B = snap(), nB = m.notes?.() ?? [], pB = measure();
  const moved = A.map((a, i) => ({ path: a.path, type: a.type, pos: a.pos, dPos: a.pos.map((x, k) => r3(B[i].pos[k] - x)), dRot: a.rot.map((x, k) => r3(B[i].rot[k] - x)) }))
    .filter((r) => r.dPos.some((x) => Math.abs(x) > 1e-3) || r.dRot.some((x) => Math.abs(x) > 1e-3));
  const top = B.filter((r) => !r.path.includes('.'));
  const tags = []; g.traverse((o) => { if (o.userData.mmTag) tags.push({ pos: o.getWorldPosition(new V3()).toArray().map(r3), size: [r3(o.scale.x), r3(o.scale.y)], vis: o.visible }); });
  for (const tg of tags) tg.over = top.filter((r) => r.box && r.type !== 'Sprite' && r.path !== '0' && tg.pos[0] > r.box.lo[0] && tg.pos[0] < r.box.hi[0] && tg.pos[1] > r.box.lo[1] && tg.pos[1] < r.box.hi[1]).map((r) => r.path);
  const flags = [];
  for (const r of top) { if (!r.box || r.type === 'Sprite') continue; const c = r.box.lo.map((x, k) => (x + r.box.hi[k]) / 2);
    if (Math.hypot(c[0], c[1]) < 0.2 && r.path !== '0') flags.push(`원점 근처(배치 안 됨?): ${r.path} ${r.type} box ${JSON.stringify(r.box)}`);
    if (r.box.lo[1] < -0.02) flags.push(`바닥 아래: ${r.path} yMin ${r.box.lo[1]}`);
    if (r.box.lo[2] < -0.37 && r.path !== '0') flags.push(`뒤판 뚫음: ${r.path} zMin ${r.box.lo[2]}`);
    if ((r.box.hi[0] > 2.2 || r.box.lo[0] < -2.2 || r.box.hi[1] > 3.3 || r.box.hi[2] > 0.8) && r.path !== '0') flags.push(`전시 영역 밖: ${r.path} box ${JSON.stringify(r.box)}`); }
  const overlaps = []; // 맨 위 물체끼리 상자가 세 축 모두 겹치는 쌍(깊이 = 가장 얕은 축) — 축이 풀리를 꿰는 것처럼 당연한 쌍 말고는 근접 캡처로 확인
  const solid = top.filter((r) => r.box && r.type !== 'Sprite' && r.path !== '0');
  for (let i = 0; i < solid.length; i++) for (let j = i + 1; j < solid.length; j++) { const a = solid[i].box, b = solid[j].box;
    const d = Math.min(...[0, 1, 2].map((k) => Math.min(a.hi[k], b.hi[k]) - Math.max(a.lo[k], b.lo[k]))); if (d > 0.015) overlaps.push(`${solid[i].path} × ${solid[j].path} 깊이 ${r3(d)}`); }
  return { top, moved, notes: { [`t=${t1}`]: nA, [`t=${t2}`]: nB }, probes: { [`t=${t1}`]: pA, [`t=${t2}`]: pB }, tags, flags, overlaps };
}, { n: Number(n), t1: Number(t1), t2: Number(t2), probes });
let out;
for (let i = 0; i < 3 && !out; i++) out = await job().catch(async (e) => { console.log('retry:', e.message.slice(0, 80)); await page.waitForTimeout(2000); });
await browser.close();
const line = (o) => console.log('  ' + JSON.stringify(o));
for (const k of ['top', 'moved', 'tags', 'flags', 'overlaps']) { console.log(`== ${k}`); out[k].forEach(line); }
for (const k of ['notes', 'probes']) { console.log(`== ${k}`); for (const [t, v] of Object.entries(out[k])) { console.log(' ' + t); v.forEach(line); } }
```

```bash
node shots/_verify/mmcheck.mjs N 1 1.6                            # 기본 출력
node shots/_verify/mmcheck.mjs N 1 1.6 shots/_verify/pNNN.json    # 줄·벨트 탐침 포함
```

탐침 파일(JSON 배열). `obj` 는 `== top` 에 나온 경로다 — 벨트 띠는 보통 `<Belt 그룹>.0`(그 뒤 번호는 흐르는 표시), `Rope` 는 그룹 경로 그대로.
```json
[
  {"name":"풀리 A",  "obj":"5.0",  "p":[0,2.55,0],   "d":[0,0,1], "r":0.52},
  {"name":"위 원뿔", "obj":"13.0", "p":[0,2.5,0.25], "d":[1,0,0], "r":"0.36 - 0.311*a"},
  {"name":"교차점",  "obj":"5.0",  "xy":[0,1.75], "rho":0.06}
]
```
`p`·`d` = 바퀴 축 위의 한 점과 축 방향, `r` = 바퀴 표면 반지름(원뿔은 축방향 좌표 `a` 의 식), `xy` = 정면에서 본 교차점.

**출력 읽는 법** (기준값은 m002·m009·m022 에서 실제로 잰 값)

| 출력 | 정상 | 오류 신호 |
|---|---|---|
| `flags` | 비어 있음 | `원점 근처` = 배치를 빠뜨린 부품(20번 고정 도르래 블록) / `바닥 아래`·`뒤판 뚫음`·`전시 영역 밖` |
| `overlaps` | 벨트×풀리, 축×풀리, 화살표×풀리처럼 당연한 쌍만(상자끼리 비교라 많이 나온다) | 추×도르래, 블록×블록, 고리×바퀴 → 근접 캡처로 확인(22번 추 고리) |
| 탐침 `sinkMin` (줄·벨트 안쪽 면 − 바퀴 표면) | 로프 + 홈 림: **−0.035 ± 0.005**(홈 바닥에 앉음) · 평벨트 + 납작 림·원뿔: **0 ~ +0.005** | 더 작으면 **박힘**, +0.01 을 넘으면 떠 있음 |
| 탐침 `wrapDeg` | 열린 벨트 180 ± 2·asin(\|r1−r2\|/D)° (큰 바퀴 +, 작은 바퀴 −) · 엇걸이 180 + 2·asin((r1+r2)/D)° | 직선 가닥을 잘게 쪼갠 모델은 최대 +12° 크게 나온다(m002: 이론 261°, 측정 267°). **이론보다 30° 이상 작거나, 작은 바퀴인데 180° 를 넘으면** 호가 반대쪽으로 돈 것 |
| 탐침 `wrapMidDir` | 상대 바퀴의 **반대쪽**(위 풀리면 [0,1,0]) | 상대 바퀴 쪽을 가리키면 호가 풀리 사이로 돈 것(9번 "중간 이후 줄이 사라짐") |
| 탐침 `axialOnWrap` | 구간의 가운데 = 바퀴 홈(폭)의 중심 좌표 | 가운데가 홈 중심에서 벗어남 = 호에서 z 가 밀린 것. 넓은 드럼인데 가운데가 드럼 중앙이 아님 |
| 교차 `clearGap` | **> 0.01** (두 가닥 중심 간격 ≥ 2·ROPE_R + 여유. m002: 0.02) | 0 에 가까우면 가닥이 서로 뚫고 지나감 |
| `moved` 의 `dRot` | 부호 = 설계표의 회전 방향, 비 = 반지름·잇수의 역비 | 부호·비가 다름, 움직여야 할 부품이 목록에 없음 |
| `moved` 의 `dPos` | 도르래: **당기는 끝 이동 ÷ 짐 이동 = 기계적 이득**(22번: 0.131 ÷ 0.017 ≈ 8) | notes 의 이득과 다름 |
| `moved` 의 `pos`, `pos + dPos` | 링크 양 끝 핀 사이 거리가 두 시각에서 같음(±0.002) | 막대가 늘어남 = 원 교점으로 풀지 않음 |
| `notes` | 설계표·판화의 값과 같고, 변하는 값은 실제로 변함 | 공용 문구를 그대로 쓴 값(20·21번의 2ⁿ) |
| `tags` 의 `over` | 비어 있음 | 이름표 중심이 그 부품의 상자 안 = 부품을 가릴 수 있음 → 정면 캡처로 확인 |

기어 물림 위상은 `evaluate` 안에서 키트 식과 직접 비교한다: `const { meshAngle } = await import('/src/mm507/kit/index.ts')` 로 얻은 `meshAngle(c1, z1, θ1, c2, z2)` 와 종동 기어 `rotation.z` 의 차가 피치각(2π/z2)의 정수배(±0.01 rad)여야 한다. 중심 거리 = m(z1+z2)/2 (±0.005).

### 1-5. 두 캡처 비교 (눈으로)
`NNN-a.png` 와 `NNN-b.png` 에서 **표시점·스포크·벨트 이음매 표시**의 위치를 본다: 구동 바퀴가 0.96 rad(55°) 돌았는가 / 종동이 비율대로 돌았는가 / 방향이 화살표(`rotArrow`)·notes 와 같은가 / 벨트 표시가 바퀴 표면과 같은 방향으로 흘렀는가 / 왕복·간헐 기구는 설계표의 "확인할 것"대로 자세가 달라졌는가. `mmcheck` 의 `moved` 와 어긋나면 캡처 시각 문제이니 다시 찍는다.

### 1-6. 고치고 다시
고친 뒤: `npx tsc --noEmit`(자기 파일 에러 0, 남의 파일 에러는 보고만) → 정면 2장 + 고친 곳 근접 + `mmcheck` 다시. **고친 곳의 근접 캡처 없이 '수정함'이라고 쓰지 않는다.**

## 2. 507 체크리스트

'어떻게' 열의 **근접·옆·위** = 1-2 의 캡처, **탐침·moved·flags** = 1-4 의 출력.

### A. 벨트·줄
| # | 확인할 것 | 어떻게 보는가·재는가 | 틀렸을 때의 모습 |
|---|---|---|---|
| A1 | 줄이 홈 안에 보이고 박히지 않았다 | 풀리마다 위·아래·옆 근접 + 탐침 `sinkMin` | 풀리 근처에서 줄이 사라짐, 림을 뚫고 나옴 |
| A2 | 호 구간에서 줄의 z(축방향)가 홈 중심 | 옆 캡처 + 탐침 `axialOnWrap` 가운데 = 풀리 z | 호에서 줄이 림 한쪽 벽을 타고 넘음(원인: 교차용 z 벌림이 호에도 적용됨) |
| A3 | 감긴 각이 식과 같고 호가 먼 쪽을 돈다 | 탐침 `wrapDeg`·`wrapMidDir`. 열린 벨트 π ± 2·asin((r1−r2)/D). 엇걸이는 아래 풀리도 긴 호(키트 `crossedBeltPath` 수정 때 263°) | 호가 두 풀리 사이로 돎, 한 바퀴 넘게 감김, 엇걸이가 아래 풀리 위쪽으로 짧게 넘어감 |
| A4 | r1 < r2 인 경우(원뿔·단차 풀리의 양 끝) | 양 끝 자세에서 A1~A3 을 다시 | 한쪽 끝 자세에서만 벨트가 원뿔 속으로 들어감("중간 이후 사라짐") |
| A5 | 평벨트가 림에 눕는다 | 비스듬·옆 근접. 축이 X 방향인 풀리(YZ 평면 벨트)는 코드에서 `widthDirs` = X(원뿔은 표면 경사)인지 확인 | 띠가 모서리로 서 있음, 중간에서 꼬임 |
| A6 | 벨트 종류와 림이 맞다 | 코드: `Belt` 기본 = 로프 ↔ `pulley` 기본 = 로프 홈 / `style:'flat'` ↔ `pulley({flat:true})`·원뿔·드럼 | 홈 파인 림 위에 납작 띠, 납작 림 위에 둥근 줄 |
| A7 | 넓은 드럼·풀리에서 벨트가 가운데 | 옆·위 캡처 + `axialOnWrap` | 벨트가 드럼 한쪽 끝에 치우침 |
| A8 | 교차하는 가닥이 서로 뚫지 않는다 | 위·옆 근접 + 교차 탐침 `clearGap` > 0.01. z 벌림은 **직선 교차 구간에만** | X자 가운데서 두 줄이 한 덩어리. 벌림 때문에 A2 가 깨짐 |
| A9 | 캡스턴·드럼에 여러 바퀴 감김 | 판화의 감긴 수를 세고 위·비스듬 근접으로 대조 | 3바퀴여야 할 줄이 한 번만 걸쳐 있음, 감긴 줄끼리 겹침 |
| A10 | 자유 구간은 곧고 팽팽한 접선 | 정면 근접. 코드에 처짐 곡선(`sag`, 중간 제어점, 2차 곡선)이 없는지 `grep` | 줄이 늘어져 휨, 접점에서 꺾여 들어감 |
| A11 | 조임·안내 풀리의 위치와 회전 | 판화 대조: 조임 풀리는 **고리 바깥에서 눌러** 줄이 안으로 꺾인다. `dRot`: 벨트 **등**에 닿는 바퀴는 고리 안쪽 바퀴들과 반대 방향, 크기 = v/r | 조임 풀리가 고리 안에 있음, 줄에 닿지 않음, 같은 방향으로 돎 |
| A12 | 벨트 표시가 흐른다 | 두 캡처의 이음매 표시. 흐른 호장 = r·Δθ(구동) | 표시가 멈춤, 바퀴와 반대로 흐름 |

### B. 기어
| # | 확인할 것 | 어떻게 | 틀렸을 때 |
|---|---|---|---|
| B1 | 이가 이골에 물린다(겹침·틈 없음) | 물림점 정면 근접을 **두 시점**에서 + 1-4 의 `meshAngle` 비교 | 이끼리 겹쳐 뚫음, 이끝끼리 마주 봄, 한 시점만 맞음 |
| B2 | 중심 거리 = m(z1+z2)/2, 내접은 m(z2−z1)/2 | 코드 상수 계산 | 이가 반쯤 박힘, 피치원이 떨어져 있음 |
| B3 | 평기어 외접은 반대 방향, 비 = −z1/z2 | `moved.dRot` | 같은 방향, 비가 다름 |
| B4 | **베벨 기어 회전 부호** | 접점 P 에서 두 표면 속도가 같아야 한다: ω1 × (P − c1) = ω2 × (P − c2). `dRot`/Δt 를 축 벡터로 놓고 직접 외적 | 부호 반대(이가 서로 미끄러져 지나감). 7번에서 실제로 틀렸다 |
| B5 | 웜·크라운·내접·비원형·간헐 기어 | 설계표의 식과 `dRot` 비, 물림점 근접 2시점 | 휠이 반대로 돎, 정지 구간이 없음 |
| B6 | 마찰차·구름 접촉 | 접점 속도 일치(B4 와 같은 식), 표면 간 틈 0 | 바퀴가 겹침·떨어짐 |
| B7 | **공식으로만 맞춘 물림은 다각형 침범 검사를 거친다**(맹글 띠·비원형·사다리꼴 이처럼 `meshAngle` 로 못 재는 것) | 두 2D 윤곽(`userData.outline`·`outlines`)을 여러 시각의 자세로 옮겨 점-다각형 침범 깊이를 잰다. 근접 캡처만으로 통과시키지 않는다 | 식은 맞는데 이끝이 상대 이뿌리·몸통을 파고듦(36번 띠, 37번 리브×돌기, 38번 변속 구간) |

### C. 링크·캠
| # | 확인할 것 | 어떻게 | 틀렸을 때 |
|---|---|---|---|
| C1 | 링크 길이 불변 | `moved` 의 핀 좌표로 두 시각의 거리 비교(±0.002) | 막대가 늘었다 줄었다 함, 핀에서 떨어짐 |
| C2 | 핀이 두 링크의 구멍에 함께 있다 | 핀 이음 비스듬 근접 | 막대 끝이 허공, 핀 없이 겹침 |
| C3 | 슬라이더·가이드 안에서만 움직인다 | 양 끝 자세 캡처 + `dPos` 방향 | 가이드를 벗어남, 벽을 뚫음 |
| C4 | 캠 윤곽과 종동절이 항상 접촉 | 접점 근접(최고·최저 자세) | 종동절이 캠에 박힘, 떠 있음 |
| C5 | 왕복 범위·간헐 순서 | 설계표 값과 `dPos`/`dRot`. 필요하면 t 를 3~4개로 | 범위가 다름, 쉬어야 할 때 움직임 |
| C6 | 겹치는 링크는 z 층이 다르다 | 옆 캡처 | 엇갈린 막대가 서로 관통 |

### D. 도르래·줄 (기계적 이득)
| # | 확인할 것 | 어떻게 | 틀렸을 때 |
|---|---|---|---|
| D1 | 줄이 지나는 길이 판화와 같다 | 1-1 에서 적은 순서 vs 모델 `ropeAround` 의 원 순서·고정점 | 23번: 헐거운 2장 풀리에 건 벨트가 삼각형 배치로 바뀜 |
| D2 | **이득 = 실제 줄 배치에서 센 값** | 짐을 받치는 가닥을 직접 센다 + `dPos` 비(당김 ÷ 짐) | 20번 7배·21번 3배인데 공용 2ⁿ 문구를 씀 |
| D3 | notes·data 의 수치·문장이 D2 와 같다 | `notes` 출력, 설계표, 상세 화면 설명 | 화면 숫자와 그림이 서로 다른 말을 함 |
| D4 | 블록마다 이동량이 배치대로 다르다 | `dPos`(22번: 0.065 / 0.033 / 0.017) | 모든 블록이 같은 속도로 오름 |
| D5 | 줄이 바퀴를 따라 꺾이고 블록·추와 이어진다 | 블록마다 근접 | 줄 끝이 허공, 고리와 떨어짐 |
| D6 | `weight()` 기본 고리 | 추 바로 위에 바퀴가 있으면 근접 필수(고리 크기가 추 폭에 비례) | 넓은 추의 큰 고리가 위 도르래에 박힘(22번) → 고리를 숨기고 작은 눈고리로 |

### E. 배치·뜸
| # | 확인할 것 | 어떻게 | 틀렸을 때 |
|---|---|---|---|
| E1 | 배치 안 된 부품 없음 | `flags` 의 `원점 근처`, 받침 가운데 근접 | 부품이 받침대 한가운데 바닥에 묻혀 있음 |
| E2 | 떠 있는 부품 없음 | 비스듬·옆 캡처: 축·받침·브래킷이 뒤판·받침에 닿는가 | 풀리가 축 없이 허공, 필로 블록이 공중 |
| E3 | 서로 박힌 부품 없음 | `overlaps` + 근접 | 추×바퀴, 블록×들보, 손잡이×뒤판 |
| E4 | 전시 영역 안(폭 4.0 × 높이 2.8, z −0.25~0.6) | `flags`. t 를 바꿔서도(E 는 H4 와 함께) | 뒤판 밖으로 나감, 추가 받침을 뚫고 내려감 |
| E5 | 같은 면에 겹친 두 면(z-fighting) 없음 | 근접에서 줄무늬·얼룩 | 판 두 장이 같은 z |
| E6 | **깊이 방향으로 지름이 나오는 모델**(세로축 원뿔, 축이 X 인 누운 기어) | 깊이 쪽 최대 반지름(이끝·리브 끝·돌기 끝) + 축 깊이 ZC ≤ 전시 깊이(약 0.8), ZC − 반지름이 뒤판을 뚫지 않는지 계산 + `flags` | 정면에서는 멀쩡한데 앞으로 튀어나옴(37번 원뿔, 40번 V자 기어) |

### F. 이름표·글
| # | 확인할 것 | 어떻게 | 틀렸을 때 |
|---|---|---|---|
| F1 | 이름표가 그 부품 옆에 있고 부품을 가리지 않는다 | 정면 `labels=1` 캡처 + `tags.over` | 다른 부품 옆에 붙음, 기구 한가운데를 가림(25번) |
| F2 | 움직이는 부품의 이름표가 따라간다 | `moved` 에 그 Sprite 가 있는가 | 추는 올라갔는데 이름표는 제자리 |
| F3 | 이름표 수·글자 | `node scripts/18-mm-tags.mjs`(0개면 실패), 지시서 18 · 5-2 규칙, 설계표 "표시" | 이름표 없음, 설계표와 다른 용어 |
| F4 | `labels=0` 이면 이름표만 꺼지고 회전 화살표는 남는다 | `labels=0` 캡처 | 화살표까지 사라짐 |
| F5 | notes·설명이 교과 용어이고 확인 안 된 사실이 없다 | 설계표·원문 대조 | 원문에 없는 연도·수치 |

### G. 판화와의 배치
| # | 확인할 것 | 어떻게 | 틀렸을 때 |
|---|---|---|---|
| G1 | 구도·비율(바퀴 크기 비, 축 간 거리 비) | `NNN-cmp.png` | 한눈에 대응이 안 됨, 좌우 반전 |
| G2 | 부품 수·종류 | 판화에서 센 수와 `top` 목록 | 풀리 하나 빠짐, 없던 부품 추가 |
| G3 | 줄·벨트가 지나는 길 | D1 과 같음 | 다른 바퀴를 지남, 교차가 빠짐 |
| G4 | 회전이 보이는 표시(스포크·표시점·이음매) | 두 캡처 | 민판이라 도는지 알 수 없음 |
| G5 | 재질·구동 구분(구동 쪽 bronze) | 캡처. 코드가 `materials.ts`·키트만 쓰는가 | 직접 만든 재질, 구동·종동 구분 없음 |
| G6 | **구성·방향을 판화 확대로 대조** | 판화를 크게 열어 물리는 쪽(띠 안/밖, 내접/외접), 나선·돌기가 오르는 방향, 이가 난 가장자리를 글로 적고 모델 근접과 맞춘다 | 띠 밖을 돌아야 할 피니언이 고리 속을 돎(36번), 나선이 반대로 오름(37번) |

### H. 운동 식과 설계표
| # | 확인할 것 | 어떻게 | 틀렸을 때 |
|---|---|---|---|
| H1 | `update` 가 누적각에서 **모든 자세를 다시 계산** | 코드. 증분 누적은 속도비가 변하는 경우처럼 사유가 있을 때만 | 역회전·긴 재생 뒤 어긋남 |
| H2 | 속도비·방향이 설계표와 같다 | `moved`, notes | 설계표 1:2 인데 1:1 |
| H3 | `speed` 음수(역회전)에서 깨지지 않는다 | `&speed=-1&t=2` 캡처 1장, 콘솔 에러 0 | 벨트 표시만 정방향, NaN 으로 부품이 사라짐 |
| H4 | 긴 시간 뒤에도 정상 | `mmcheck N 1 30` 의 `flags`·`overlaps` 가 t=1 과 같은 수준 | 추가 바닥을 뚫고 계속 내려감, 줄 길이가 음수 |
| H5 | 파일 규약 | 함수형 default export, 클래스 없음, 키트·재질 라이브러리만 사용 | — |

## 3. 탐구 실험 검증 절차

대상: `src/labs/Linkage.ts` + `linkage/*`(지시서 17), 이름표 공용 `src/labs/common/*` 과 전 실험(18), `src/labs/WaterMill.ts` + `mill/*`(19). 기준은 각 지시서의 **검증·수용 기준·완료 기준**(17 · 9절, 18 · 8~9절, 19 · 9절)이다. 표의 숫자를 하나씩 대조한다.

```bash
npx tsc --noEmit
node scripts/17-link-check.mjs ; node scripts/19-mill-check.mjs       # 수치 검사(브라우저 없음)
node scripts/17-link-shots.mjs ; node scripts/17-link-flow.mjs        # 연결 뒤에는 LK_ENTRY="preview.html?mode=link&"
node scripts/19-mill-shots.mjs ; node scripts/19-mill-flow.mjs ; node scripts/19-mill-model.mjs
node scripts/18-labels.mjs [bike car power wind cycle engines steam pump link]
node scripts/18-mm-tags.mjs --ui 1 7 13
node scripts/smoke.mjs                                                # ALL PASS 여야 한다
```
물레방아가 `preview.html?mode=mill` 로 연결됐는지는 `src/dev/preview.ts` 의 `MODE_CTORS` 에서 확인한다. 아니면 `src/labs/mill/dev.html?…`(`WM_ENTRY` 기본값)로 본다.

| # | 확인할 것 | 어떻게 | 틀렸을 때 |
|---|---|---|---|
| L1 | 지시서 수용 기준표의 모든 장면 | 스크립트가 찍는 `__lk.state()`·`__wm.state()` 값을 표의 숫자·허용 오차와 대조, PNG 를 연다 | 숫자판 값이 표와 다름, 장면이 표의 설명과 다름 |
| L2 | 밝음/다크 | `&theme=dark` 캡처 | 글자가 배경에 묻힘, 3D 가 너무 어두움 |
| L3 | 390×844(그리고 360×740) | `node scripts/shot.mjs "<url>" out.png 5000 390 844` | 가로 넘침, 패널이 3D 를 절반 넘게 가림, 글자 잘림, 44px 미만 버튼, 좌상단 홈 버튼 자리 침범 |
| L4 | 이름표 버튼 | `[data-lab="labels-toggle"]` 가 1개·44px 이상. 누르면 전부 꺼지고 새로고침 뒤에도 유지, 다시 누르면 전부 켜짐. 움직이는 부품을 따라감 | 일부만 꺼짐, 상태가 저장 안 됨, 이름표가 패널을 가림 |
| L5 | 이름표 글자 | 지시서 18 · 4절 표(물레방아는 19 · 7절)와 한 글자씩 | 표에 없는 글자, 빠진 이름표 |
| L6 | 스모크 | `node scripts/smoke.mjs` — 콘솔 에러·404·빈 화면·홈 복귀 | 진입 시 에러 |
| L7 | 드나들기 누수 | 진입 → 홈 → 재진입 5~20회 뒤 `__lk.selfLeak()`·`__wm.selfLeak()` 가 늘지 않음, `.lab-tags` 가 쌓이지 않음, 콘솔 에러 0 | 드나들 때마다 DOM·메시가 늘어남 |
| L8 | 3D 모델 자체 | 507 의 C·E 절과 같은 눈으로(관통·뜸·링크 길이). 물레방아: 누름대가 방아채를 뚫지 않고 공이가 확돌 바닥을 뚫지 않음 | — |
| L9 | **507 목록 격자** | `preview.html?mode=mm` 을 1280×800·390×844 로 캡처 + 아래 식 | 타일이 높이 0 으로 찌그러져 목록이 빈 것처럼 보임(격자 항목의 `overflow:hidden` 때문 — `grid-auto-rows: max-content` 로 고쳐 둠) |

```js
// L9 — page.evaluate 안에서. 80 미만이면 실패
Math.min(...[...document.querySelectorAll('.mm-tile')].map((e) => e.getBoundingClientRect().height))
```
같은 실수(격자·flex 항목이 높이 0)는 다른 목록 화면에도 있을 수 있다. 목록·카드가 있는 화면은 요소 높이를 한 번씩 잰다.

## 4. 미션 기계 검증 절차 (`src/machines/*.ts`, 지시서 14 · 3·6절)

```bash
node scripts/shot.mjs "preview.html?machine=<id>&steps=0"         shots/14v/<id>-s0.png 3000
node scripts/shot.mjs "preview.html?machine=<id>&steps=1"         shots/14v/<id>-s1.png 3000
node scripts/shot.mjs "preview.html?machine=<id>&steps=all&t=1"   shots/14v/<id>-t1.png 6000
node scripts/shot.mjs "preview.html?machine=<id>&steps=all&t=2.6" shots/14v/<id>-t2.png 7600
node scripts/shot.mjs "preview.html?machine=<id>&steps=all&t=1&theme=dark" shots/14v/<id>-dark.png 6000
# + 근접: &cam=x,y,z,tx,ty,tz 로 부품이 만나는 곳마다(옆·위·아래에서)
node scripts/ui-flow.mjs <id> light        # 정답 순서로 끝까지 진행되는가
```

| # | 확인할 것 | 어떻게 | 틀렸을 때(실제 사례) |
|---|---|---|---|
| M1 | 부품끼리 관통하지 않는다(움직이는 전 구간) | 접촉부 근접을 동작의 양 끝에서 | 시소의 타이어와 스프링이 겹침, 교문 랙이 담을 뚫고 지나감 |
| M2 | 같은 평면에 겹친 면 없음(z-fighting) | 근접에서 줄무늬·얼룩 | 스테이플러 앞코 |
| M3 | 줄·케이블이 몸체에 묻히지 않는다 | 아래·옆 근접 | 선풍기 전선이 받침 속에 묻힘 |
| M4 | 수평·수직이어야 할 부품의 각도 | 옆·정면 캡처에서 기준선과 비교 | 도어 클로저의 팔이 수평이 아님 |
| M5 | 바닥(y=0)과 높이 | 옆 캡처: 바퀴가 바닥에 닿고 몸체는 그 위 | 킥보드 발판이 y=0 에 깔림 |
| M6 | 바닥 표시·화살표의 방향이 흐름을 보여 준다 | 권장 시점(`view`)에서 캡처 | 바닥 표시가 돌아가 있어 흐름을 읽을 수 없음 |
| M7 | 1초 안에 알아보는가, 충분히 큰가, 슬롯 링이 보이는가 | `steps=0`·`steps=1` | 작은 물건이 화면에서 점처럼 보임 |
| M8 | 떠 있는 부품, 각진 원기둥, 재질 라이브러리 | 비스듬 캡처 | — |
| M9 | 기구학(링크 길이·기어비·방향·스프링 끝점·구름) | `t=1` vs `t=2.6` 비교, 식 읽기 | 스프링이 한쪽 끝에서 떨어짐, 바퀴가 미끄러짐 |
| M10 | `getDisplay()` 수치가 말이 된다 | 화면 값과 손계산 | 단위·크기가 이상함 |
| M11 | `reset()` 후 재조립, 진행도 복원 | `node scripts/smoke.mjs`, `ui-flow` | 복원 시 부품 위치가 두 번 더해짐 |

## 5. 보고 형식

묶음 하나에 표 하나. 판정은 **통과 / 수정함 / 남은 문제** 셋 중 하나.

```
| 번호 | 판정 | 문제·수정 | 캡처 경로 |
|---|---|---|---|
| 026 | 통과 | 없음. wrap 172°/188°(이론 171°/189°), sinkMin −0.035, 속도비 0.50(설계표 1:2) | shots/mm/026-a,b,c1,c2,side,cmp.png |
| 027 | 수정함 | 아래 풀리에서 줄이 림 벽을 넘음(axialOnWrap 가운데 0.29, 홈 0.25) → 호 구간 z 고정(m027.ts 41~58행). 재측정 0.25 | shots/mm/027-side(전), 027-side2(후), 027-a,b.png |
| 028 | 남은 문제 | 베벨 C 의 방향을 접점 속도로 유도하면 반대로 나오는데 확신이 없음 — Fable 확인 요청 | shots/mm/028-mesh1,mesh2.png |
```
(위 세 줄은 쓰는 법을 보이는 예시다. 실제 결과가 아니다.)

표 아래에 적는다: ① 실행한 명령과 결과(`tsc`, `mmcheck`, 스크립트 출력 요약) ② **키트·공용 파일의 문제**(파일·줄·재현 번호 — 고치지 않은 것) ③ 확인하지 못한 것(찍지 못한 접점, 재지 못한 값) ④ 여러 번호에서 되풀이된 실수(설계표 양식을 고칠 거리).

- **확신이 없으면 '통과'가 아니라 '남은 문제'다.** 판화가 흐려 줄의 길을 못 읽은 것, 방향 부호를 유도하지 못한 것, 이득을 세지 못한 것이 모두 해당한다.
- '통과'에는 근거 숫자(탐침 값, 속도비, 이득)를 적는다. "이상 없음"만 쓰지 않는다.
- 캡처 경로에는 **직접 열어 본 것만** 적는다.

## 6. 하지 말 것

- 키트 함수의 **시그니처를 바꾸지 않는다.** 키트·공용 파일은 고치지 말고 보고한다.
- **git 명령 금지**(add·commit·stash·checkout·restore 전부). 다른 에이전트의 작업이 같은 작업 트리에 있다.
- **dev 서버를 띄우거나 다시 시작하지 않는다.** `vite`·`npm run dev`·`npm run build` 를 실행하지 않는다.
- **모든 접점의 근접 캡처 없이 통과시키지 않는다.** 정면 2장은 검증이 아니다.
- 배정받지 않은 번호·파일을 고치지 않는다(다른 번호에서 같은 문제를 봤으면 보고에 적는다).
- 틀린 그림을 notes·주석으로 가리지 않는다. 그림이 판화와 다르면 그림을 고친다.
- 모델의 문제를 카메라 시점으로 숨기지 않는다. `view` 는 잘 보이게 할 때만 바꾼다.
- 스크립트·임시 파일을 `shots/` 밖에 만들지 않는다. `docs/`·`scripts/` 에 새 파일을 만들지 않는다.
- 판화·원문을 길게 옮겨 적지 않는다(설명은 풀어서 쓴다).
