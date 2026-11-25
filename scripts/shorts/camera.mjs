// 쇼츠 카메라 경로(PRD §4, 지시서 21 · 2단계). record.mjs 가 부른다.
//   planCamera(page, n) — 페이지(preview.html?mm=n)의 window.__mm 으로 장면을 읽어 프레임별 카메라·재생 위상·강조 이름표를 만든다.
//   결과는 shorts/_work/cam/NNN.json 에 남는다. 그 파일에 "manual": true 가 있으면 다시 계산하지 않고 그대로 쓴다(사람이 손본 값).
// 키프레임(영상 시각, lib.mjs T):
//   rec0~ghostEnd 정면(판화 구도) → orbitEnd 오른쪽 위 45°·거리 0.8배 → closeIn 핵심 접촉부로(거리 0.35배)
//   → closeEnd 머묾(0.5배 재생, 이름표 강조) → pullEnd 전체로 물러남 → end(아웃트로) 천천히 돎
import fs from 'node:fs';
import path from 'node:path';
import { FPS, REC_FRAMES, ROOT, T, ensureDir, lerp, pad3, smooth } from './lib.mjs';

/** 페이지 안에서: 부품 상자, 이름표, 접촉점, 화각 */
async function sceneInfo(page) {
  return page.evaluate(() => {
    const m = window.__mm;
    const TH = m.THREE;
    const g = m.group;
    g.updateMatrixWorld(true);
    const skip = (o) => {
      for (let p = o; p && p !== g; p = p.parent) {
        const mm = p.userData.mm;
        if (p.userData.mmStandPart || p.userData.mmTag || p.userData.mmLeader) return true;
        if (mm && (mm.kind === 'stand' || mm.kind === 'arrow' || mm.kind === 'tag')) return true;
        if (!p.visible) return true;
      }
      return false;
    };
    const box = new TH.Box3();
    const tmp = new TH.Box3();
    g.traverse((o) => {
      if (!o.isMesh || skip(o) || o.layers.mask === 2) return;
      tmp.setFromObject(o);
      if (!tmp.isEmpty()) box.union(tmp);
    });
    const parts = [];
    g.traverse((o) => {
      const mm = o.userData.mm;
      if (mm && mm.kind) parts.push({ o, mm });
    });
    const wp = (o, local) => {
      const v = new TH.Vector3(...local);
      return v.applyMatrix4(o.matrixWorld).toArray();
    };
    // 접촉점 후보: ① 맞물린 기어 쌍 ② 벨트·줄 wraps 가 풀리에 닿는 점 ③ 이름표 무게중심
    let contact = null;
    let why = '';
    const gears = parts.filter((p) => p.mm.kind === 'gear' && typeof p.mm.rp === 'number');
    for (let i = 0; i < gears.length && !contact; i++)
      for (let j = i + 1; j < gears.length && !contact; j++) {
        const a = gears[i];
        const b = gears[j];
        const ca = new TH.Vector3().setFromMatrixPosition(a.o.matrixWorld);
        const cb = new TH.Vector3().setFromMatrixPosition(b.o.matrixWorld);
        const d = ca.distanceTo(cb);
        const s = a.mm.rp + b.mm.rp;
        if (Math.abs(d - s) < 0.15 * s) {
          contact = ca.clone().lerp(cb, a.mm.rp / s).toArray();
          why = 'gear-mesh';
        }
      }
    if (!contact) {
      const belt = parts.find((p) => (p.mm.kind === 'belt' || p.mm.kind === 'rope' || p.mm.kind === 'chain') && Array.isArray(p.mm.wraps) && p.mm.wraps.length);
      if (belt) {
        const w = belt.mm.wraps[belt.mm.wraps.length - 1];
        const at = w.from ?? w.c;
        contact = wp(belt.o, at.length === 2 ? [at[0], at[1], w.c[2] ?? 0] : at);
        why = 'belt-wrap';
      }
    }
    const tags = m.tags();
    if (!contact && tags.length) {
      const c = [0, 0, 0];
      tags.forEach((t) => t.pos.forEach((v, k) => (c[k] += v / tags.length)));
      contact = c;
      why = 'tag-centroid';
    }
    if (!contact) {
      contact = box.getCenter(new TH.Vector3()).toArray();
      why = 'box-center';
    }
    const view = m.model.view ?? { pos: [0, 2.1, 6.2], target: [0, 1.75, 0] };
    return {
      box: [box.min.toArray(), box.max.toArray()],
      tags,
      contact,
      why,
      view,
      fov: m.camera.fov,
      aspect: m.camera.aspect
    };
  });
}

/** 판화 정합용: 정면 시점에서 부품 상자의 화면 사각형(px) */
async function projectBox(page, cam, box) {
  return page.evaluate(
    ({ cam, box }) => {
      const m = window.__mm;
      const TH = m.THREE;
      m.cam(...cam);
      const c = m.camera;
      c.updateMatrixWorld(true);
      const W = innerWidth;
      const H = innerHeight;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const x of [box[0][0], box[1][0]])
        for (const y of [box[0][1], box[1][1]])
          for (const z of [box[0][2], box[1][2]]) {
            const v = new TH.Vector3(x, y, z).project(c);
            const px = ((v.x + 1) / 2) * W;
            const py = ((1 - v.y) / 2) * H;
            x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
          }
      return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    },
    { cam, box }
  );
}

const DEG = Math.PI / 180;

export async function planCamera(page, n, { force = false } = {}) {
  const file = path.join(ensureDir(path.join(ROOT, 'shorts', '_work', 'cam')), `${pad3(n)}.json`);
  if (!force && fs.existsSync(file)) {
    const old = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (old.manual === true) return old;
  }
  const info = await sceneInfo(page);
  const [mn, mx] = info.box;
  const center = mn.map((v, i) => (v + mx[i]) / 2);
  const size = mn.map((v, i) => mx[i] - v);
  // 시선 방향: 모델 view(판화 구도)의 방향
  const vd = info.view.pos.map((v, i) => v - info.view.target[i]);
  const vl = Math.hypot(...vd);
  const yaw0 = Math.atan2(vd[0], vd[2]);
  const pitch0 = Math.asin(vd[1] / vl);
  // 거리: 부품 높이가 화면 높이의 42%(분할 화면 아래 칸 960px 안에 들어가게), 폭(이름표 포함)이 85% 이하
  const tanV = Math.tan((info.fov * DEG) / 2);
  let wMin = mn[0];
  let wMax = mx[0];
  for (const t of info.tags) {
    wMin = Math.min(wMin, t.pos[0] - 0.45);
    wMax = Math.max(wMax, t.pos[0] + 0.45);
  }
  const halfW = Math.max(Math.abs(wMin - center[0]), Math.abs(wMax - center[0]));
  const dH = size[1] / 2 / (0.42 * tanV);
  const dW = halfW / (0.85 * tanV * info.aspect);
  const d0 = Math.max(dH, dW, 1.2) + size[2] / 2;

  const P0 = info.contact;
  // 강조 이름표: 접촉점에 가장 가까운 이름표
  let emphTag = null;
  let emphPos = null;
  let best = Infinity;
  for (const t of info.tags) {
    const d = Math.hypot(...t.pos.map((v, i) => v - P0[i]));
    if (d < best) {
      best = d;
      emphTag = t.text;
      emphPos = t.pos;
    }
  }
  // 클로즈업 목표 = 접촉점과 강조 이름표 사이(둘 다 화면 안). 거리는 0.35배 이상, 둘의 간격(+이름표 폭)이 화면 폭 70% 안에
  const P = emphPos ? P0.map((v, i) => lerp(v, emphPos[i], 0.4)) : P0;
  const span = emphPos ? Math.hypot(P0[0] - emphPos[0], P0[1] - emphPos[1]) + 0.9 : 0;
  const closeK = Math.max(0.35, span / 2 / (0.7 * tanV * info.aspect) / d0);
  const tgtOf = (k) => (k === 'p' ? P : center);
  const K = [
    { t: T.rec0, yaw: 0, pitch: 0, dist: 1, tgt: 'c' },
    { t: T.ghostEnd, yaw: 0, pitch: 0, dist: 1, tgt: 'c' },
    { t: T.orbitEnd, yaw: 45, pitch: 22, dist: 0.8, tgt: 'c' },
    { t: T.closeIn, yaw: 30, pitch: 12, dist: closeK, tgt: 'p' },
    { t: T.closeEnd, yaw: 22, pitch: 9, dist: closeK * 0.94, tgt: 'p' },
    { t: T.pullEnd, yaw: 15, pitch: 8, dist: 1.05, tgt: 'c' },
    { t: T.end, yaw: 32, pitch: 12, dist: 1.1, tgt: 'c' }
  ];
  // 재생 속도: 클로즈업 때 0.5배(앞뒤 0.4초에 걸쳐 바뀜)
  const speedAt = (t) => {
    const a = smooth((t - (T.closeIn - 0.2)) / 0.4);
    const b = smooth((t - (T.closeEnd - 0.2)) / 0.4);
    return 1 - 0.5 * a + 0.5 * b;
  };
  const frames = [];
  let phase = 0;
  for (let i = 0; i < REC_FRAMES; i++) {
    const t = T.rec0 + i / FPS;
    let j = 0;
    while (j < K.length - 2 && t >= K[j + 1].t) j++;
    const a = K[j];
    const b = K[j + 1];
    const k = smooth((t - a.t) / (b.t - a.t));
    const yaw = yaw0 + lerp(a.yaw, b.yaw, k) * DEG;
    const pitch = pitch0 + lerp(a.pitch, b.pitch, k) * DEG;
    const dist = d0 * lerp(a.dist, b.dist, k);
    const ta = tgtOf(a.tgt);
    const tb = tgtOf(b.tgt);
    const tgt = ta.map((v, q) => lerp(v, tb[q], k));
    const pos = [tgt[0] + dist * Math.cos(pitch) * Math.sin(yaw), tgt[1] + dist * Math.sin(pitch), tgt[2] + dist * Math.cos(pitch) * Math.cos(yaw)];
    const r4 = (v) => Math.round(v * 1e4) / 1e4;
    const emph = t >= T.closeIn - 0.1 && t < T.closeEnd + 0.2 ? emphTag : null;
    frames.push({ t: r4(t), phase: r4(phase), cam: [...pos, ...tgt].map(r4), emph });
    phase += speedAt(t) / FPS;
  }
  const front = frames[0].cam;
  const screenRect = await projectBox(page, front, info.box);
  const plan = {
    n,
    manual: false,
    note: 'manual 을 true 로 바꾸면 record.mjs 가 이 파일을 그대로 쓴다(frames 를 손봐도 된다)',
    fps: FPS,
    contact: P0,
    closeTarget: P,
    closeK,
    contactWhy: info.why,
    emphTag,
    d0,
    center,
    screenRect, // 정면 시점에서 부품의 화면 사각형(1080×1920 기준) — 판화 정합에 쓴다
    frames
  };
  fs.writeFileSync(file, JSON.stringify(plan, null, 1));
  return plan;
}
