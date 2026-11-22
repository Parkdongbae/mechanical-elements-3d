// 13-D 우물 손펌프 조작 흐름 캡처: node scripts/13-pump-flow.mjs [width] [height] [theme] [only]
// 장면마다 새 페이지를 열어 버튼·드래그로 조작하고 캡처한다(dev 서버 새로고침 시 그 장면만 재시도).
// BASE_URL 환경 변수로 주소를 바꿀 수 있다(기본 http://localhost:5273/).
// only: stages | flow | 장면 이름
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const [, , w = '1280', h = '800', theme = 'light', only = ''] = process.argv;
const base = process.env.BASE_URL ?? 'http://localhost:5273/';
const tag = `${w}-${theme}`;
mkdirSync('shots', { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader']
});
const errors = [];

async function check(page) {
  return page.evaluate(() => {
    const over = document.documentElement.scrollWidth > innerWidth || document.body.scrollWidth > innerWidth;
    const tl = [...document.querySelectorAll('.pmp-wrap *')].filter((e) => {
      if (e.closest('.pmp-tags')) return false;
      const b = e.getBoundingClientRect();
      return getComputedStyle(e).visibility !== 'hidden' && b.width > 0 && b.left < 220 && b.top < 64 && b.right > 0 && b.bottom > 0;
    }).length;
    const tagTl = [...document.querySelectorAll('.pmp-tag-l, .pmp-tick')].filter((e) => {
      const b = e.getBoundingClientRect();
      return getComputedStyle(e).visibility !== 'hidden' && b.width > 0 && b.left < 220 && b.top < 64;
    }).length;
    const wide = [...document.querySelectorAll('.pmp-wrap *')].filter((e) => !e.closest('.pmp-tags') && e.getBoundingClientRect().right > innerWidth + 1).length;
    const txt = (s) => document.querySelector(s)?.textContent ?? '';
    return {
      over,
      topLeft: tl + tagTl,
      wide,
      live: txt('.pmp-live-t'),
      foot: txt('[data-k="foot"] .pmp-valve-s'),
      piston: txt('[data-k="piston"] .pmp-valve-s'),
      press: txt('.pmp-meter-v'),
      nums: [...document.querySelectorAll('.pmp-num-v, .pmp-meter-v')].map((e) => e.textContent).join(' | ')
    };
  });
}

async function scene(name, actions) {
  if (only && only !== name && only !== 'stages' && only !== 'flow') return;
  if (only === 'stages' && !name.startsWith('s')) return;
  if (only === 'flow' && name.startsWith('s')) return;
  for (let attempt = 0; attempt < 6; attempt++) {
    const page = await browser.newPage({ viewport: { width: +w, height: +h } });
    let reloaded = false;
    page.on('pageerror', (e) => errors.push(`${name}: ${String(e)}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !m.text().includes('Failed to load')) errors.push(`${name}: ${m.text()}`);
    });
    try {
      await page.goto(`${base}preview.html?mode=pump&theme=${theme}`, { waitUntil: 'load', timeout: 60000 });
      await page.waitForSelector('.pmp-step', { timeout: 30000 });
      page.on('framenavigated', (f) => {
        if (f === page.mainFrame()) reloaded = true;
      });
      await page.waitForTimeout(1500);
      const shots = [];
      await actions(page, async (suffix) => {
        const file = `shots/13-pump-${name}${suffix ? '-' + suffix : ''}-${tag}.png`;
        await page.screenshot({ path: file });
        const r = await check(page);
        shots.push(`${file} ${JSON.stringify(r)}`);
      });
      if (reloaded) throw new Error('reloaded');
      for (const s of shots) console.log(s);
      await page.close();
      return;
    } catch (e) {
      console.log(`retry ${name}:`, String(e).slice(0, 100));
      await page.close();
    }
  }
}

const step = async (p, i) => {
  await p.click(`.pmp-step >> nth=${i}`);
  await p.waitForTimeout(3500);
};
const click = (p, text) => p.click(`.pmp-wrap button:has-text("${text}")`);
/** 버튼을 누르고 있는 동안 ms 기다린 뒤(누른 채로) 콜백 */
async function holdBtn(p, text, ms, during) {
  const b = await p.$(`.pmp-hold:has-text("${text}")`);
  await b.scrollIntoViewIfNeeded();
  const box = await b.boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await p.mouse.down();
  await p.waitForTimeout(ms);
  if (during) await during();
  await p.mouse.up();
}
async function prime(p) {
  await click(p, '마중물 붓기');
  await p.waitForTimeout(4500);
}
async function strokes(p, n) {
  for (let i = 0; i < n; i++) {
    await click(p, '한 번 펌프질');
    await p.waitForTimeout(2600);
  }
}

if (!only || only === 'stages' || only.startsWith('s')) {
  for (let i = 0; i <= 6; i++) await scene(`s${i}`, async (p, snap) => { await step(p, i); await snap(); });
}

// 마중물 없이 펌프질 → 밸브가 열리지 않음
await scene('dry', async (p, snap) => {
  await step(p, 1);
  await holdBtn(p, '손잡이 내리기', 500, () => snap('down'));
});
// 마중물 붓는 중
await scene('priming', async (p, snap) => {
  await step(p, 1);
  await click(p, '마중물 붓기');
  await p.waitForTimeout(1500);
  await snap();
});
// 마중물 후 첫 내리기(관 속 공기가 빠짐) — 손잡이를 끌어서
await scene('drag', async (p, snap) => {
  await step(p, 2);
  await prime(p);
  const grip = await p.evaluate(() => {
    const t = document.querySelector('.pmp-tag.is-grip');
    const m = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(t?.style.transform ?? '');
    return m ? { x: +m[1], y: +m[2] + 10 } : null;
  });
  if (!grip) throw new Error('no grip tag');
  await p.mouse.move(grip.x, grip.y);
  await p.mouse.down();
  for (let k = 1; k <= 20; k++) {
    await p.mouse.move(grip.x + k * 2, grip.y + k * 14);
    await p.waitForTimeout(60);
  }
  await snap('down');
  await p.mouse.up();
});
// 여러 번 펌프질: 내리는 중(아래 밸브 열림·쏟아짐), 올리는 중(피스톤 밸브 열림)
await scene('pumping', async (p, snap) => {
  await step(p, 4);
  await prime(p);
  await strokes(p, 7);
  await snap('after7');
  await holdBtn(p, '손잡이 내리기', 450, () => snap('down'));
  await holdBtn(p, '손잡이 올리기', 450, () => snap('up'));
  await click(p, '밸브');
  await p.waitForTimeout(2500);
  await holdBtn(p, '손잡이 내리기', 450, () => snap('valve-down'));
  await holdBtn(p, '손잡이 올리기', 450, () => snap('valve-up'));
});
// 겉모습 + 계속 펌프질로 양동이 채우기
await scene('outside', async (p, snap) => {
  await prime(p);
  await click(p, '겉모습');
  await click(p, '펌프');
  await click(p, '계속 펌프질');
  await p.waitForTimeout(14000);
  await snap();
  await click(p, '컷어웨이');
  await p.waitForTimeout(600);
  await snap('cut');
});
// 깊이 11 m: 아무리 해도 안 올라옴
await scene('deep', async (p, snap) => {
  await step(p, 5);
  await click(p, '깊이 11 m로');
  await prime(p);
  await click(p, '계속 펌프질');
  // 헤드리스는 프레임이 느려 펌프질 횟수가 적다 — 관 속 물기둥이 한계 근처에서 멈출 때까지 충분히 기다린다
  await p.waitForTimeout(50000);
  await snap();
});

await browser.close();
console.log(errors.length ? 'ERRORS:\n' + [...new Set(errors)].join('\n') : 'no console errors');
