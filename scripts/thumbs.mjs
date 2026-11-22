// 홈 카드 썸네일 생성: 각 미션의 완성 상태를 미리보기 페이지에서 캡처해 public/thumbs/<id>.jpg 로 저장.
// 사용: node scripts/thumbs.mjs [id ...]   (dev 서버 필요, 모델을 바꾼 뒤 다시 실행)
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';

mkdirSync('public/thumbs', { recursive: true });
const src = readFileSync('src/data/machines.ts', 'utf8');
const all = [...src.matchAll(/^\s{4}id: '([\w-]+)'/gm)].map((m) => m[1]);
const ids = process.argv.length > 2 ? process.argv.slice(2) : all;

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 800, height: 500 }, deviceScaleFactor: 1 });
for (const id of ids) {
  await page.goto(`http://localhost:5273/preview.html?machine=${id}&steps=all&labels=0&ui=0&thumb=1`);
  await page.waitForTimeout(9000);
  await page.screenshot({ path: `public/thumbs/${id}.jpg`, type: 'jpeg', quality: 82 });
  console.log('thumb', id);
}
await browser.close();
