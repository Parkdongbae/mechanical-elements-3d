// 쇼츠 직접 업로드 목록 — 일·중·힌디·아랍 언어로 완성된 모든 번호의 제목·설명·태그를 한 파일로
//   node scripts/shorts/uplist.mjs   → shorts/UPLOAD-ja-zh-hi-ar.md (shorts/ja/NNN.json 이 있는 번호 전부)
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib.mjs';

const L = [
  ['ja', '일본어'],
  ['zh', '중국어'],
  ['hi', '힌디어'],
  ['ar', '아랍어']
];
const dir = (l) => path.join(ROOT, 'shorts', l);
const nums = fs
  .readdirSync(dir('ja'))
  .filter((f) => /^\d{3}\.json$/.test(f))
  .map((f) => Number(f.slice(0, 3)))
  .sort((a, b) => a - b);

/** 1,2,3,5,7,8 → "1~3, 5, 7~8" */
const ranges = (a) => {
  const out = [];
  for (let i = 0; i < a.length; ) {
    let j = i;
    while (j + 1 < a.length && a[j + 1] === a[j] + 1) j++;
    out.push(i === j ? `${a[i]}` : `${a[i]}~${a[j]}`);
    i = j + 1;
  }
  return out.join(', ');
};

let o = `# 쇼츠 직접 업로드 목록 — 일·중·힌디·아랍 ${ranges(nums)}번\n\n세로판(쇼츠)은 shorts/<언어>/NNN.mp4, 가로판은 NNN-wide.mp4. 제목·설명·태그는 NNN.json 에 있다. 재생목록은 언어별로 하나씩.\n`;
for (const [l, name] of L) {
  const first = JSON.parse(fs.readFileSync(path.join(dir(l), '001.json'), 'utf8'));
  o += `\n## ${name}\n\n재생목록: ${first.playlist}\n`;
  for (const n of nums) {
    const id = String(n).padStart(3, '0');
    const f = path.join(dir(l), `${id}.json`);
    if (!fs.existsSync(f)) continue;
    const m = JSON.parse(fs.readFileSync(f, 'utf8'));
    o += `\n### ${n}번 — shorts/${l}/${id}.mp4\n\n제목: ${m.title}\n\n설명:\n\n\`\`\`\n${m.description}\n\`\`\`\n\n태그: ${m.tags.join(', ')}\n`;
  }
}
fs.writeFileSync(path.join(ROOT, 'shorts', 'UPLOAD-ja-zh-hi-ar.md'), o);
console.log(`${nums.length}편 → shorts/UPLOAD-ja-zh-hi-ar.md (${ranges(nums)})`);
