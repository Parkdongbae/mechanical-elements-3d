// 쇼츠 대본 검사 — shorts/scripts/<lang>.json 의 한 번호가 6개 언어 모두 형식·길이를 지키는지.
//   node scripts/shorts/scriptlint.mjs <번호> [--quiet]   → 모두 통과면 종료 코드 0
// 길이 등급은 shorts/scripts/len.json(없는 번호는 15초). 길이(훅+풀이+끝 문장 합계) 허용 범위:
//   15초: 한 45~60자(공백 뺌), 일 45~58자, 중 40~58자, 영 24~32낱말, 힌디 18~25낱말, 아랍 14~20낱말.
//   20초: 한 70~85자, 일 66~82자, 중 60~82자, 영 36~46낱말, 힌디 27~36낱말, 아랍 21~28낱말.
//   25초: 한 90~105자, 일 85~100자, 중 78~100자, 영 46~57낱말, 힌디 35~44낱말, 아랍 27~35낱말.
// 끝 문장(cta)은 그 언어 파일의 1번 cta 와 똑같아야 한다(1~5번에서 길이를 맞춘 문장).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, lenOf } from './lib.mjs';
import { ALL_LANGS } from './langs.mjs';

const RULES = {
  15: {
    ko: { unit: 'chars', min: 45, max: 60 },
    ja: { unit: 'chars', min: 45, max: 58 },
    zh: { unit: 'chars', min: 40, max: 58 },
    en: { unit: 'words', min: 24, max: 32 },
    hi: { unit: 'words', min: 18, max: 25 },
    ar: { unit: 'words', min: 14, max: 20 }
  },
  20: {
    ko: { unit: 'chars', min: 70, max: 85 },
    ja: { unit: 'chars', min: 66, max: 82 },
    zh: { unit: 'chars', min: 60, max: 82 },
    en: { unit: 'words', min: 36, max: 46 },
    hi: { unit: 'words', min: 27, max: 36 },
    ar: { unit: 'words', min: 21, max: 28 }
  },
  25: {
    ko: { unit: 'chars', min: 90, max: 105 },
    ja: { unit: 'chars', min: 85, max: 100 },
    zh: { unit: 'chars', min: 78, max: 100 },
    en: { unit: 'words', min: 46, max: 57 },
    hi: { unit: 'words', min: 35, max: 44 },
    ar: { unit: 'words', min: 27, max: 35 }
  }
};
const HANGUL = /[㄰-㆏가-힣]/;

export function lintScript(n) {
  const out = [];
  const grade = lenOf(n);
  for (const lang of ALL_LANGS) {
    const f = path.join(ROOT, 'shorts', 'scripts', `${lang}.json`);
    let all;
    try {
      all = JSON.parse(fs.readFileSync(f, 'utf8'));
    } catch (e) {
      out.push({ lang, ok: false, msg: `JSON 읽기 실패: ${e.message}` });
      continue;
    }
    const s = all[String(n)];
    if (!s) {
      out.push({ lang, ok: false, msg: '대본 없음' });
      continue;
    }
    const bad = [];
    for (const k of ['hook', 'body', 'cta']) if (typeof s[k] !== 'string' || !s[k].trim()) bad.push(`${k} 비어 있음`);
    if (!bad.length) {
      if (all['1'] && s.cta !== all['1'].cta) bad.push(`cta 가 1번과 다름(1번: "${all['1'].cta}")`);
      const r = RULES[grade][lang];
      const text = `${s.hook} ${s.body} ${s.cta}`;
      const len = r.unit === 'chars' ? text.replace(/\s/g, '').length : text.trim().split(/\s+/).length;
      if (len < r.min || len > r.max) bad.push(`길이 ${len}${r.unit === 'chars' ? '자' : '낱말'} (${grade}초 허용 ${r.min}~${r.max})`);
      if (lang !== 'ko' && HANGUL.test(text)) bad.push('한글이 섞임');
      if (/\b[A-H]\b/.test(`${s.hook} ${s.body}`) && lang !== 'en') bad.push('판화 기호(A·B…)를 쓰지 말 것');
      out.push({ lang, ok: bad.length === 0, len, grade, msg: bad.join(' / ') || 'OK' });
    } else out.push({ lang, ok: false, msg: bad.join(' / ') });
  }
  return out;
}

if (process.argv[1] && path.basename(process.argv[1]) === 'scriptlint.mjs') {
  const n = Number(process.argv[2]);
  const res = lintScript(n);
  if (!process.argv.includes('--quiet')) for (const r of res) console.log(`${r.ok ? 'OK ' : 'BAD'} ${n} ${r.lang} [${lenOf(n)}초] ${r.msg}`);
  process.exit(res.every((r) => r.ok) ? 0 : 1);
}
