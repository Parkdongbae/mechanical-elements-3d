// 13-C 밸브 상태 검산: node scripts/13-steam-valves.mjs
// 단계별 반복 재생 동안 window.__stm.state()를 0.1초마다 읽어, 그 단계 설명과 맞는 밸브 상태인 비율을 출력한다.
// (단계 반복 구간 전체 — 끝에서 잠깐 멈추는 순간 포함 — 에서 설명과 화면 표시가 어긋나지 않아야 한다)
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:5273/';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const v = (st, name) => {
  const x = st.valves.find((q) => q.name.startsWith(name));
  return x ? x.text ?? (x.open ? '열림' : '닫힘') : '?';
};
const CASES = [
  ['newcomen', 0, 1, (s) => v(s, '증기 밸브') === '열림' && v(s, '찬물') === '닫힘'],
  ['newcomen', 0, 2, (s) => v(s, '증기 밸브') === '닫힘' && v(s, '찬물') === '닫힘'],
  ['newcomen', 0, 3, (s) => v(s, '증기 밸브') === '닫힘' && v(s, '찬물') === '열림'],
  ['newcomen', 0, 4, (s) => v(s, '증기 밸브') === '닫힘' && v(s, '찬물') === '닫힘'],
  ['watt', 1, 1, (s) => v(s, '위 증기') === '열림' && v(s, '아래 배기') === '열림' && v(s, '아래 증기') === '닫힘' && v(s, '위 배기') === '닫힘'],
  ['watt', 1, 3, (s) => v(s, '아래 증기') === '열림' && v(s, '위 배기') === '열림' && v(s, '위 증기') === '닫힘' && v(s, '아래 배기') === '닫힘'],
  ['loco', 2, 3, (s) => v(s, '앞쪽') === '증기 들어감' && v(s, '뒤쪽') === '배기(굴뚝으로)'],
  ['loco', 2, 4, (s) => v(s, '뒤쪽') === '증기 들어감' && v(s, '앞쪽') === '배기(굴뚝으로)']
];
for (const [m, tab, stage, ok] of CASES) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    let reloaded = false;
    try {
      await page.goto(`${base}preview.html?mode=steam`, { waitUntil: 'load', timeout: 60000 });
      await page.waitForSelector('.stm-step', { timeout: 30000 });
      page.on('framenavigated', (f) => {
        if (f === page.mainFrame()) reloaded = true;
      });
      await page.click(`.stm-tab >> nth=${tab}`);
      await page.waitForTimeout(500);
      await page.click(`.stm-step >> nth=${stage}`);
      await page.waitForTimeout(300);
      let good = 0;
      let n = 0;
      const bad = new Set();
      for (let i = 0; i < 90; i++) {
        const st = await page.evaluate(() => window.__stm.state());
        n++;
        if (ok(st)) good++;
        else bad.add(st.valves.map((q) => `${q.name}=${q.text ?? (q.open ? '열림' : '닫힘')}`).join(', '));
        await page.waitForTimeout(100);
      }
      const res = await page.evaluate(() => window.__stm.residual());
      if (reloaded) throw new Error('reloaded');
      console.log(`${m} 단계 ${stage}: ${good}/${n} 일치, 링크 오차 최대 ${res.toExponential(2)}${bad.size ? ' | 어긋남: ' + [...bad].slice(0, 2).join(' / ') : ''}`);
      await page.close();
      break;
    } catch (e) {
      console.log('retry', m, stage, String(e).slice(0, 60));
      await page.close();
    }
  }
}
await browser.close();
