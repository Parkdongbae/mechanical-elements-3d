// 12번 스크립트 공용: 페이지 주소 결정.
// 기본은 dev 서버(http://localhost:5273). dev 서버가 없을 때는 WIND_DIST=<vite build 결과 폴더>를 주면
// 서버를 띄우지 않고 playwright 요청 가로채기로 빌드 결과를 직접 읽어 준다.
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.stl': 'application/octet-stream', '.woff2': 'font/woff2' };

export async function windPage(browser, viewport, query) {
  const page = await browser.newPage({ viewport });
  const dist = process.env.WIND_DIST;
  if (!dist) {
    await page.goto(`http://localhost:5273/preview.html?${query}`, { waitUntil: 'load' });
    return page;
  }
  await page.route('http://wind.local/**', async (route) => {
    const url = new URL(route.request().url());
    const file = join(dist, decodeURIComponent(url.pathname));
    try {
      const body = await readFile(file);
      await route.fulfill({ status: 200, body, contentType: TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream' });
    } catch {
      await route.fulfill({ status: 404, body: 'not found' });
    }
  });
  await page.goto(`http://wind.local/preview.html?${query}`, { waitUntil: 'load' });
  return page;
}
