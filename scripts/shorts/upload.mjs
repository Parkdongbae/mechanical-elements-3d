// 쇼츠 자동 업로드(지시서 21 · 7단계) — YouTube Data API v3, 추가 패키지 없이 fetch 만 쓴다.
//   처음 한 번:  node scripts/shorts/upload.mjs auth          (브라우저가 열리면 로그인·동의)
//   올리기:      node scripts/shorts/upload.mjs 1 [--lang ko|en|both] [--privacy private|unlisted|public]
//                                                 [--at 2026-11-27T18:00:00+09:00] [--wide] [--force]
//   확인:        node scripts/shorts/upload.mjs list
// 비밀 파일은 저장소 밖에 둔다(기본 E:\youtube, 바꾸려면 YT_DIR):
//   client_secret.json — Google Cloud 의 OAuth 클라이언트(데스크톱 앱)에서 내려받은 파일
//   token.json         — auth 가 만든다(리프레시 토큰). 절대 커밋하지 않는다.
// 올린 기록: shorts/uploads.json (같은 번호·언어를 두 번 올리지 않게. 다시 올리려면 --force)
// 할당량: 하루 기본 10,000 단위. 업로드 1회 1,600 + 재생목록 넣기 50 → 하루 약 6편.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { ROOT, pad3 } from './lib.mjs';

const YT_DIR = process.env.YT_DIR || 'E:\\youtube';
const SECRET = path.join(YT_DIR, 'client_secret.json');
const TOKEN = path.join(YT_DIR, 'token.json');
const LOG = path.join(ROOT, 'shorts', 'uploads.json');
const SCOPES = ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube'];
const API = 'https://www.googleapis.com/youtube/v3';

const argv = process.argv.slice(2);
const opt = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : def;
};
const flag = (name) => argv.includes(`--${name}`);

function client() {
  if (!fs.existsSync(SECRET)) {
    console.error(`OAuth 클라이언트 파일이 없습니다: ${SECRET}\nGoogle Cloud 에서 데스크톱 앱 클라이언트 JSON 을 내려받아 이 이름으로 두세요.`);
    process.exit(2);
  }
  const j = JSON.parse(fs.readFileSync(SECRET, 'utf8'));
  const c = j.installed || j.web;
  if (!c) { console.error('client_secret.json 형식이 다릅니다(installed 항목 없음). 데스크톱 앱으로 만드세요.'); process.exit(2); }
  return c;
}

async function postForm(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body) });
  const j = await r.json();
  if (!r.ok) throw new Error(`${url} ${r.status}: ${JSON.stringify(j)}`);
  return j;
}

// ── 1) 로그인: 내 컴퓨터의 127.0.0.1 로 돌아오는 방식(PKCE) ──
async function auth() {
  const c = client();
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  const state = crypto.randomBytes(8).toString('hex');
  const server = http.createServer();
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const redirect = `http://127.0.0.1:${server.address().port}`;
  const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id: c.client_id, redirect_uri: redirect, response_type: 'code', scope: SCOPES.join(' '),
    access_type: 'offline', prompt: 'consent', code_challenge: challenge, code_challenge_method: 'S256', state,
  });
  console.log('브라우저에서 로그인·동의해 주세요. 자동으로 안 열리면 이 주소를 여세요:\n' + url);
  spawn('cmd', ['/c', 'start', '', url.replace(/&/g, '^&')], { detached: true, stdio: 'ignore' }).unref();
  const code = await new Promise((ok, no) => {
    server.on('request', (req, res) => {
      const q = new URL(req.url, redirect).searchParams;
      if (!q.get('code') && !q.get('error')) { res.end(); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(q.get('code') ? '<h2>연결됐습니다. 이 창을 닫아도 됩니다.</h2>' : '<h2>동의하지 않았습니다.</h2>');
      server.close();
      if (q.get('state') !== state) no(new Error('state 불일치'));
      else if (q.get('error')) no(new Error(q.get('error')));
      else ok(q.get('code'));
    });
  });
  const t = await postForm(c.token_uri || 'https://oauth2.googleapis.com/token', {
    code, client_id: c.client_id, client_secret: c.client_secret, redirect_uri: redirect, grant_type: 'authorization_code', code_verifier: verifier,
  });
  if (!t.refresh_token) throw new Error('리프레시 토큰을 받지 못했습니다. 다시 auth 하세요.');
  fs.mkdirSync(YT_DIR, { recursive: true });
  fs.writeFileSync(TOKEN, JSON.stringify({ refresh_token: t.refresh_token, scope: t.scope, at: new Date().toISOString() }, null, 2));
  const ch = await api('GET', '/channels?part=snippet&mine=true', null, t.access_token);
  console.log(`저장: ${TOKEN}\n채널: ${ch.items?.[0]?.snippet?.title ?? '(채널 없음 — YouTube 에서 채널을 먼저 만드세요)'}`);
}

async function accessToken() {
  if (!fs.existsSync(TOKEN)) { console.error('먼저 로그인하세요: node scripts/shorts/upload.mjs auth'); process.exit(2); }
  const c = client();
  const { refresh_token } = JSON.parse(fs.readFileSync(TOKEN, 'utf8'));
  try {
    const t = await postForm(c.token_uri || 'https://oauth2.googleapis.com/token', {
      refresh_token, client_id: c.client_id, client_secret: c.client_secret, grant_type: 'refresh_token',
    });
    return t.access_token;
  } catch (e) {
    if (String(e).includes('invalid_grant')) {
      console.error('로그인이 만료됐습니다(앱이 「테스트」 상태면 7일마다 만료). 다시: node scripts/shorts/upload.mjs auth');
      process.exit(2);
    }
    throw e;
  }
}

async function api(method, p, body, tok) {
  const r = await fetch(API + p, {
    method, headers: { Authorization: `Bearer ${tok}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = r.status === 204 ? {} : await r.json();
  if (!r.ok) throw new Error(`${method} ${p} ${r.status}: ${JSON.stringify(j.error?.errors ?? j)}`);
  return j;
}

// ── 2) 재생목록: 제목이 같은 것을 찾고 없으면 만든다 ──
async function playlistId(title, lang, tok) {
  let page = '';
  do {
    const j = await api('GET', `/playlists?part=snippet&mine=true&maxResults=50${page ? `&pageToken=${page}` : ''}`, null, tok);
    const hit = j.items?.find((x) => x.snippet.title === title);
    if (hit) return hit.id;
    page = j.nextPageToken || '';
  } while (page);
  const desc = lang === 'ko'
    ? '1868년 원서 「507가지 기계 운동」의 판화를 3D 로 움직여 봅니다. https://mechanical-elements-3d.vercel.app'
    : 'The 1868 engravings of "507 Mechanical Movements", brought to life in 3D. https://mechanical-elements-3d.vercel.app';
  const j = await api('POST', '/playlists?part=snippet,status', {
    snippet: { title, description: desc, defaultLanguage: lang }, status: { privacyStatus: 'public' },
  }, tok);
  console.log(`  재생목록 만듦: ${title}`);
  return j.id;
}

// ── 3) 영상 올리기(재개 가능 업로드) ──
async function uploadOne(n, lang, tok) {
  const id = pad3(n);
  const metaPath = path.join(ROOT, 'shorts', lang, `${id}.json`);
  if (!fs.existsSync(metaPath)) { console.error(`  ${lang} ${id}: 메타데이터 없음(${metaPath}) — 먼저 make.mjs`); return; }
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  const wide = flag('wide');
  const file = path.join(ROOT, wide ? meta.files.wide : meta.files.vertical);
  if (!fs.existsSync(file)) { console.error(`  ${lang} ${id}: 영상 없음(${file})`); return; }
  const log = fs.existsSync(LOG) ? JSON.parse(fs.readFileSync(LOG, 'utf8')) : [];
  const key = `${id}-${lang}${wide ? '-wide' : ''}`;
  const prev = log.find((x) => x.key === key);
  if (prev && !flag('force')) { console.log(`  ${key}: 이미 올림 https://youtu.be/${prev.videoId} (다시 올리려면 --force)`); return; }

  const at = opt('at');
  const privacy = at ? 'private' : opt('privacy', 'private');
  const title = wide ? meta.title.replace(/\s*#shorts\b/i, '') : meta.title;
  const body = {
    snippet: {
      title: title.slice(0, 100), description: meta.description.slice(0, 5000), tags: meta.tags,
      categoryId: meta.categoryId, defaultLanguage: meta.defaultLanguage, defaultAudioLanguage: meta.defaultLanguage,
    },
    status: { privacyStatus: privacy, selfDeclaredMadeForKids: false, embeddable: true, ...(at ? { publishAt: new Date(at).toISOString() } : {}) },
  };
  const size = fs.statSync(file).size;
  const init = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': 'video/mp4', 'X-Upload-Content-Length': String(size) },
    body: JSON.stringify(body),
  });
  if (!init.ok) throw new Error(`업로드 시작 실패 ${init.status}: ${await init.text()}`);
  const loc = init.headers.get('location');
  let video;
  for (let attempt = 1; ; attempt++) {
    const r = await fetch(loc, { method: 'PUT', headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(size) }, body: fs.readFileSync(file) });
    if (r.ok) { video = await r.json(); break; }
    if (attempt >= 3 || r.status < 500) throw new Error(`업로드 실패 ${r.status}: ${await r.text()}`);
    console.log(`  서버 오류 ${r.status}, 다시 시도 ${attempt}`);
    await new Promise((ok) => setTimeout(ok, 5000 * attempt));
  }
  console.log(`  ${key}: 올림 https://youtu.be/${video.id} (${video.status?.privacyStatus}${at ? `, 공개 예약 ${at}` : ''})`);

  try {
    const pl = await playlistId(meta.playlist, lang, tok);
    await api('POST', '/playlistItems?part=snippet', { snippet: { playlistId: pl, resourceId: { kind: 'youtube#video', videoId: video.id } } }, tok);
    console.log(`  재생목록에 넣음: ${meta.playlist}`);
  } catch (e) { console.error(`  재생목록 넣기 실패(영상은 올라감): ${e.message}`); }

  const rest = log.filter((x) => x.key !== key);
  rest.push({ key, n, lang, wide, videoId: video.id, privacy: video.status?.privacyStatus, publishAt: at ?? null, uploadedAt: new Date().toISOString() });
  fs.writeFileSync(LOG, JSON.stringify(rest, null, 2));
}

const cmd = argv[0];
if (cmd === 'auth') await auth();
else if (cmd === 'list') {
  const log = fs.existsSync(LOG) ? JSON.parse(fs.readFileSync(LOG, 'utf8')) : [];
  for (const x of log) console.log(`${x.key}\thttps://youtu.be/${x.videoId}\t${x.privacy}${x.publishAt ? `\t예약 ${x.publishAt}` : ''}`);
  if (!log.length) console.log('(아직 올린 영상 없음)');
} else if (/^\d+$/.test(cmd ?? '')) {
  const langs = opt('lang', 'both') === 'both' ? ['ko', 'en'] : [opt('lang')];
  const tok = await accessToken();
  for (const l of langs) await uploadOne(Number(cmd), l, tok);
} else {
  console.error('사용: node scripts/shorts/upload.mjs auth | list | <번호> [--lang ko|en|both] [--privacy private|unlisted|public] [--at ISO시각] [--wide] [--force]');
  process.exit(2);
}
