// 507 번역 사전 도구. 사용: node scripts/mm507/build_i18n.mjs [--check] [--extract]
//  --extract : 코드에서 tag/notes label/phrases 한글 후보를 모아 scripts/mm507/i18n_keys.json 로 출력
//  --check   : src/mm507/i18n/en.json 에 빠진 키와 catalog titleEn 누락을 출력(번역은 사람이/에이전트가 채움)
import fs from 'fs';
import path from 'path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../..');
const dirs = ['src/mm507/models', 'src/mm507/kit'].map((d) => path.join(root, d));
const files = dirs.flatMap((d) => fs.readdirSync(d).filter((f) => f.endsWith('.ts')).map((f) => path.join(d, f)));
const KO = /[가-힣]/;
const tags = new Set(), notes = new Set(), skipped = new Set(), phr = new Map();
const strRe = (q) => q === "'" ? /'((?:[^'\\n]|\.)*)'/g : /"((?:[^"\\n]|\.)*)"/g;
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(/\btag\(\s*(['"`])((?:(?!\1)[^\\n]|\.)*)\1/g)) {
    if (m[1] === '`' && m[2].includes('${')) { if (KO.test(m[2])) skipped.add(m[2]); continue; }
    if (KO.test(m[2])) tags.add(m[2]);
  }
  for (const m of s.matchAll(/\btag\(\s*[^'"`\s)]/g)) skipped.add(path.basename(f) + ': ' + s.slice(m.index, m.index + 40).replace(/\n/g, ' '));
  for (const m of s.matchAll(/label:\s*(['"`])((?:(?!\1)[^\\n]|\.)*)\1/g)) if (KO.test(m[2])) notes.add(m[2]);
  for (const m of s.matchAll(/value:\s*([^\n]*)/g)) {
    for (const k of m[1].matchAll(/(['"`])((?:(?!\1)[^\\n]|\.)*)\1/g)) for (const w of k[2].match(/[가-힣]+(?: [가-힣]+)*/g) || []) phr.set(w.trim(), (phr.get(w.trim()) || 0) + 1);
  }
}
const phrases = [...phr.entries()].sort((a, b) => b[1] - a[1]).slice(0, 300).map((e) => e[0]);
const enPath = path.join(root, 'src/mm507/i18n/en.json');
const en = fs.existsSync(enPath) ? JSON.parse(fs.readFileSync(enPath, 'utf8')) : { tags: {}, notes: {}, phrases: {} };
if (process.argv.includes('--extract')) {
  fs.writeFileSync(path.join(root, 'scripts/mm507/i18n_keys.json'), JSON.stringify({ tags: [...tags], notes: [...notes], phrases, skipped: [...skipped] }, null, 1));
  console.log('tags', tags.size, 'notes', notes.size, 'phrases', phrases.length, 'skipped(변수 섞임)', skipped.size);
}
if (process.argv.includes('--check')) {
  const miss = (set, d) => [...set].filter((k) => !(k in d));
  const mt = miss(tags, en.tags), mn = miss(notes, en.notes), mp = miss(phrases, en.phrases);
  console.log('빠진 tags', mt.length, mt, '\n빠진 notes', mn.length, mn, '\n빠진 phrases', mp.length, mp);
  const cat = JSON.parse(fs.readFileSync(path.join(root, 'public/mm507/catalog.json'), 'utf8'));
  console.log('titleEn 없는 항목', cat.filter((c) => !c.titleEn).map((c) => c.n).join(','));
  if (skipped.size) console.log('변수 섞여 건너뜀', [...skipped]);
}
