// 물레방아 수치 검사 — 브라우저 없이 `node scripts/19-mill-check.mjs`
// .ts 를 Node 가 직접 읽는다. 확장자 없는 import('./types')를 위한 해석 훅(17-link-check 와 같은 방식).
import { register } from 'node:module';

async function resolve(spec, ctx, next) {
  if (spec.startsWith('.') && !/[.][a-z]+$/.test(spec)) {
    try {
      return await next(spec + '.ts', ctx);
    } catch (e) {
      /* 확장자가 이미 있거나 .ts 가 아님 */
    }
  }
  return next(spec, ctx);
}
register('data:text/javascript,' + encodeURIComponent('export ' + resolve.toString()));

const P = await import('../src/labs/mill/physics.ts');
const T = await import('../src/labs/mill/types.ts');
const { MILL } = T;
const R = Math.PI / 180;
const D = 180 / Math.PI;

const rows = [];
function check(group, name, ok, measured, limit) {
  rows.push({ group, name, ok: !!ok, measured, limit });
}
const f3 = (v) => (typeof v === 'number' ? v.toFixed(3) : String(v));
function near(group, name, got, want, tol) {
  const e = Math.abs(got - want);
  check(group, name, e <= tol, `${f3(got)} (기대 ${f3(want)})`, `오차 ${e.toFixed(4)} ≤ ${tol}`);
}

const lift = (b) => MILL.pestleArm * (Math.sin(b) - Math.sin(MILL.betaRest * R));

// 1. betaCam
{
  const tbl = [[115.71, -3.00, 0.0], [120, 0.0, 0.094], [132, 6.78, 0.307], [144, 11.07, 0.44], [147.59, 11.92, 0.466]];
  for (const [phi, bd, h] of tbl) {
    const b = P.betaCam(phi * R);
    if (b === null) { check('1 betaCam', `φ=${phi}°`, false, 'null', ''); continue; }
    near('1 betaCam', `φ=${phi}° β(°)`, b * D, bd, 0.01 + (phi === 115.71 ? 0.05 : 0));
    near('1 betaCam', `φ=${phi}° 높이(m)`, lift(b), h, 0.001 + (phi === 115.71 ? 0.0005 : 0));
  }
  for (const phi of [100, 150, 300, 0, 200]) {
    check('1 betaCam', `φ=${phi}° 닿지 않음`, P.betaCam(phi * R) === null, String(P.betaCam(phi * R)), 'null');
  }
}

// 2. CAM
near('2 CAM', 'on(°)', P.CAM.on * D, 115.70, 0.01);
near('2 CAM', 'off(°)', P.CAM.off * D, 147.59, 0.01);
near('2 CAM', 'lift(m)', P.CAM.lift, 0.466, 0.001);
near('2 CAM', 'liftEnergy(J)', P.CAM.liftEnergy, 213.3, 0.1);
near('2 CAM', 'G(N·m)', P.CAM.G, 824.04, 0.01);
near('2 CAM', 'I(kg·m²)', P.CAM.I, 157.2, 0.01);
near('2 CAM', '누르는 구간(°)', (P.CAM.off - P.CAM.on) * D, 31.9, 0.05);

// 3. pose
{
  const p = new P.MillPhysics();
  for (const [th, h1, h2] of [[132, 0.307, 0], [42, 0, 0.307], [100, 0, 0]]) {
    p.pose(th * R);
    near('3 pose', `θ=${th}° 방아채1`, p.state.beams[0].lift, h1, 0.001);
    near('3 pose', `θ=${th}° 방아채2`, p.state.beams[1].lift, h2, 0.001);
  }
  for (const [th, h1, h2] of [[120, 0.094, 0], [147, 0.46, 0]]) {
    p.pose(th * R);
    near('3 pose', `θ=${th}° 방아채1 (지시서 9-1)`, p.state.beams[0].lift, h1, 0.01);
    near('3 pose', `θ=${th}° 방아채2`, p.state.beams[1].lift, h2, 0.001);
  }
}

// 공통: 불변식 감시 + 시뮬레이션
function makeMonitor() {
  const m = { bad: 0, both: 0, belowRest: 0, tailOut: 0 };
  return m;
}
function monitor(p, m) {
  const b = p.state.beams;
  if (b[0].engaged && b[1].engaged) m.both++;
  for (let i = 0; i < 2; i++) {
    if (b[i].beta < MILL.betaRest * R - 1e-9) m.belowRest++;
    if (b[i].engaged) {
      let ok = false;
      for (let k = 0; k < 2; k++) {
        const phi = p.state.theta + MILL.armOffset[i] * R + k * Math.PI;
        const c = P.tipPos(phi);
        const d = Math.hypot(MILL.pivotZ - c.z, MILL.pivotY - c.y);
        const bc = P.betaCam(phi);
        if (bc !== null && Math.abs(bc - b[i].beta) < 1e-9 && d <= 1 + 1e-9) ok = true;
      }
      if (!ok) m.tailOut++;
    }
  }
}
function runWater(q, sec, dt, mon) {
  const p = new P.MillPhysics();
  p.q = q; p.gateOpen = true;
  const n = Math.round(sec / dt);
  const strikes = [];
  for (let i = 0; i < n; i++) {
    strikes.push(...p.step(dt));
    if (mon) monitor(p, mon);
  }
  return { p, strikes };
}

// 4. 손으로 아주 천천히
{
  const p = new P.MillPhysics();
  p.mode = 'hand';
  const dt = 0.05;
  const rate = 0.5 * R;
  const steps = Math.ceil((2 * Math.PI) / (rate * dt)) + 20;
  const all = [];
  const mon = makeMonitor();
  for (let i = 0; i < steps; i++) {
    p.handTurn(rate * dt);
    all.push(...p.step(dt));
    monitor(p, mon);
  }
  check('4 손(0.5°/s)', '찧은 횟수 4', all.length === 4, `${all.length}`, '= 4');
  for (const [i, s] of all.entries()) {
    near('4 손(0.5°/s)', `#${i + 1} fallTime`, s.fallTime, 0.318, 0.005);
    near('4 손(0.5°/s)', `#${i + 1} speed`, s.speed, 2.97, 0.03);
    near('4 손(0.5°/s)', `#${i + 1} energy`, s.energy, 213, 3);
  }
  check('4 손(0.5°/s)', '방아채 번갈아', all.length === 4 && all.every((s, i) => s.beam === (i % 2)), all.map((s) => s.beam).join(','), '0,1,0,1');
  check('8 불변식', '손 모드', mon.both === 0 && mon.belowRest === 0 && mon.tailOut === 0, JSON.stringify(mon), '모두 0');
}

// 5. 물 320 L/s, 30초
const base = {};
{
  const mon = makeMonitor();
  const { p, strikes } = runWater(0.32, 30, 1 / 60, mon);
  const st = p.stats();
  const last = strikes[strikes.length - 1];
  base.rpm = st.rpm;
  near('5 320 L/s 30초', '회전(회/분)', st.rpm, 21.5, 0.65);
  near('5 320 L/s 30초', 'speed', last.speed, 3.09, 0.08);
  near('5 320 L/s 30초', 'energy', last.energy, 231, 8);
  near('5 320 L/s 30초', 'fallTime', last.fallTime, 0.424, 0.015);
  near('5 320 L/s 30초', 'peakLift', last.peakLift, 0.504, 0.01);
  const dn = Math.abs(p.state.strikes[0] - p.state.strikes[1]);
  check('5 320 L/s 30초', '두 방아채 횟수 차 ≤ 1', dn <= 1, `${p.state.strikes[0]} / ${p.state.strikes[1]}`, '≤ 1');
  near('5 320 L/s 30초', '공이 하나 횟수(회/분)', st.strikesPerMin, 43.0, 1.5);
  near('5 320 L/s 30초', '실린 물(kg)', p.state.waterMass, 347, 25);
  near('5 320 L/s 30초', '물 일률(kW)', P.waterPower(0.32) / 1000, 8.42, 0.01);
  check('8 불변식', '물 320', mon.both === 0 && mon.belowRest === 0 && mon.tailOut === 0, JSON.stringify(mon), '모두 0');
  // 한 번 찧을 때 누르는 시간(눌림 유지 시간) 0.247 s 근사: 구간 31.9° / ω
  near('5 320 L/s 30초', '누르는 시간(s) = 구간/ω', (P.CAM.off - P.CAM.on) / (st.rpm * Math.PI / 30), 0.247, 0.01);
}

// 6. steadyOmega 표 + 시뮬레이션
{
  const tbl = [[0.05, 8.1, 144, 1.32, 115], [0.16, 15.0, 249, 4.21, 213], [0.24, 18.5, 302, 6.32, 263],
    [0.32, 21.5, 347, 8.42, 306], [0.40, 24.1, 387, 10.53, 343], [0.48, 26.5, 423, 12.64, 377]];
  let prev = 0;
  let mono = true;
  for (const [q, rpm, mass, kw, w] of tbl) {
    const rr = (P.steadyOmega(q) * 60) / (2 * Math.PI);
    near('6 steadyOmega', `${q * 1000} L/s (회/분)`, rr, rpm, 0.1);
    const M = (1000 * q * (140 * R)) / P.steadyOmega(q);
    near('6 steadyOmega', `${q * 1000} L/s 실린 물(kg)`, M, mass, 1);
    near('6 steadyOmega', `${q * 1000} L/s 물 일률(kW)`, P.waterPower(q) / 1000, kw, 0.01);
    near('6 steadyOmega', `${q * 1000} L/s 방아 일률(W)`, (4 * P.CAM.liftEnergy * rr) / 60, w, 1);
    const { p } = runWater(q, 20, 1 / 60);
    const sim = p.stats().rpm;
    check('6 시뮬 20초', `${q * 1000} L/s 최근 한 바퀴 평균`, Math.abs(sim - rr) <= 0.03 * rr, `${sim.toFixed(2)} (닫힌 식 ${rr.toFixed(2)})`, '±3%');
    if (sim <= prev) mono = false;
    prev = sim;
  }
  check('6 단조', '물이 많을수록 회전수 증가', mono, '', '단조 증가');
}

// 7. 물 0 / 수문 닫기
{
  const { p, strikes } = runWater(0, 30, 1 / 60);
  check('7 물 0', '30초 내내 ω = 0, 찧기 0', p.state.omega === 0 && strikes.length === 0 && p.state.theta === 100 * R, `ω=${p.state.omega}, 찧기 ${strikes.length}`, '0');
  const p2 = new P.MillPhysics();
  p2.q = 0.32; p2.gateOpen = true;
  for (let i = 0; i < 60 * 20; i++) p2.step(1 / 60);
  const was = p2.state.omega;
  p2.gateOpen = false;
  let stopT = -1;
  for (let i = 0; i < 60 * 60; i++) {
    p2.step(1 / 60);
    if (p2.state.omega === 0) { stopT = (i + 1) / 60; break; }
  }
  check('7 수문 닫기', '60초 안에 멈춤', stopT > 0, `돌던 ω=${was.toFixed(2)} → ${stopT > 0 ? stopT.toFixed(1) + '초' : '안 멈춤'}`, '< 60 s');
  check('7 수문 닫기', '물 유량 0', p2.state.flow === 0, String(p2.state.flow), '0');
  // 멈춘 뒤 0.5초 안에 숫자판이 '정지'(최근 한 바퀴 평균이 남아 있지 않음)
  for (let i = 0; i < 30; i++) p2.step(1 / 60);
  const rpmStop = p2.stats().rpm;
  const rdStop = P.readouts(p2).find((r) => r.key === 'rpm')?.value;
  check('7 수문 닫기', '멈춘 뒤 0.5초: rpm 0, 숫자판 정지', rpmStop === 0 && rdStop === '정지', `rpm=${rpmStop} "${rdStop}"`, '0, 정지');
  // 손으로 돌리다 손을 떼면 0.5초 안에 정지
  const p3 = new P.MillPhysics();
  p3.mode = 'hand';
  for (let i = 0; i < 60; i++) { p3.handTurn(2 * R); p3.step(1 / 60); }
  const rpmTurn = p3.stats().rpm;
  for (let i = 0; i < 30; i++) p3.step(1 / 60);
  check('7 손 멈춤', '돌리는 중 rpm > 0, 손을 떼고 0.5초 뒤 0', rpmTurn > 0 && p3.stats().rpm === 0, `${rpmTurn.toFixed(1)} → ${p3.stats().rpm}`, '> 0 → 0');
}

// 9. dt 무관
for (const dt of [1 / 30, 1 / 60, 1 / 144]) {
  const { p, strikes } = runWater(0.32, 30, dt);
  const st = p.stats();
  const last = strikes[strikes.length - 1];
  const g = `9 dt=1/${Math.round(1 / dt)}`;
  near(g, '회전(회/분)', st.rpm, 21.5, 0.65);
  near(g, 'speed', last.speed, 3.09, 0.08);
  near(g, 'energy', last.energy, 231, 8);
  near(g, 'fallTime', last.fallTime, 0.424, 0.015);
  near(g, 'peakLift', last.peakLift, 0.504, 0.01);
  check(g, '두 방아채 횟수 차 ≤ 1', Math.abs(p.state.strikes[0] - p.state.strikes[1]) <= 1, `${p.state.strikes[0]} / ${p.state.strikes[1]}`, '≤ 1');
}

// 10. 거꾸로
{
  const p = new P.MillPhysics();
  p.mode = 'hand';
  const t0 = p.state.theta;
  const r = p.handTurn(-0.01);
  p.step(1 / 60);
  check('10 거꾸로', 'handTurn(−0.01) → false, θ 그대로', r === false && p.state.theta === t0, `${r}, Δθ=${p.state.theta - t0}`, 'false, 0');
}

// 읽기값(readouts)이 지시서 8-2 와 맞는지
{
  const { p } = runWater(0.32, 30, 1 / 60);
  const ro = Object.fromEntries(P.readouts(p).map((r) => [r.key, r.value]));
  check('R readouts', '12개 항목', Object.keys(ro).length === 12, String(Object.keys(ro).length), '12');
  check('R readouts', '물의 양 320 L/s', ro.flow === '320 L/s', ro.flow, '320 L/s');
  check('R readouts', '닿는 물 1.98 m/s', ro.hitSpeed === '1.98 m/s', ro.hitSpeed, '1.98 m/s');
  check('R readouts', '물 일률 8.4 kW', ro.waterPower === '8.4 kW', ro.waterPower, '8.4 kW');
  check('R readouts', '들어 올리는 높이 0.47 m', ro.camLift === '0.47 m', ro.camLift, '0.47 m');
  console.log('  readouts:', JSON.stringify(ro));
}

// D. data.ts 문구 점검: 금지어, 구조
{
  const Dt = await import('../src/labs/mill/data.ts');
  const texts = JSON.stringify([Dt.STAGES, Dt.PART_INFO, Dt.ELEMENT_CARD, Dt.SOURCE_CARD, Dt.PROMISE_CARD, Dt.MORE_CARD, Dt.QUIZ, Dt.SOURCE_CITE, Dt.HAND_BLOCK_MSG, Dt.MODEL_NOTE, Dt.POWER_NOTE]);
  const banned = ['수차', '방아다리', '쌀개', '캠축', '상사식', '하사식', '1870', '증기', '10~13', '13㎾', '13 kW'];
  const hit = banned.filter((w) => texts.includes(w));
  check('D data.ts', '금지어 없음', hit.length === 0, hit.join(',') || '없음', '0개');
  check('D data.ts', '단계 5개', Dt.STAGES.length === 5 && Dt.STAGES.every((x, i) => x.id === i + 1), String(Dt.STAGES.length), '5');
  check('D data.ts', '4·5단계만 천천히 보기', Dt.STAGES[3].slow && Dt.STAGES[4].slow && !Dt.STAGES[0].slow, '', '4·5만 켬');
  check('D data.ts', 'PART_INFO 16개', Object.keys(Dt.PART_INFO).length === 16, String(Object.keys(Dt.PART_INFO).length), '16');
  check('D data.ts', '이모지 없음', !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(texts), '', '없음');
}

// ───────────── 결과 출력 ─────────────
let group = '';
let fail = 0;
for (const r of rows) {
  if (r.group !== group) { group = r.group; console.log(`\n[${group}]`); }
  if (!r.ok) fail++;
  console.log(`  ${r.ok ? 'ok  ' : 'FAIL'} ${r.name.padEnd(30)} ${String(r.measured).padEnd(40)} ${r.limit}`);
}
console.log(`\n${rows.length - fail}/${rows.length} 통과${fail ? `, 실패 ${fail}` : ''}`);
process.exit(fail ? 1 : 0);
