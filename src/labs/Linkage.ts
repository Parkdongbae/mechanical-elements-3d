// 탐구 실험 17 — 링크 장치: 여러 가지 링크를 골라 돌려 보고, 손으로 끌어 보고, 점이 그리는 자취를 본다.
// 기구학은 평면에서 닫힌 식으로 풀고(solver), 3D 부품(model)은 그 자세를 그대로 보여 준다.
// 이 파일은 둘을 잇는 화면 모드(AppMode)다. 캡처·검사용 쿼리: lk, lkq, lkplay, lkdim, lktilt, lkfull, lklabel, lktrace, lktab.

import * as THREE from 'three';
import type { AppMode, ModeContext } from '../modes/types';
import type { CameraView } from '../scene/SceneSetup';
import type { InputValue, MechanismDef, Pose, Readout, Role, Sweep, Vec2, GrashofResult } from './linkage/types';
import { solve, advance, sweep, inputFromPoint, fourbar, grashof, inputRange, pathPoint } from './linkage/solver';
import { readouts, series } from './linkage/metrics';
import { MECHANISMS } from './linkage/mechanisms';
import { LinkageModel } from './linkage/model';
import { Graph, slowFastBands, type GraphData } from './linkage/graph';
import { mechanismIcon, startInput } from './linkage/icons';
import { LinkPanel, DEFAULT_DIMS, type CustomDims, type TabKey, type ToggleKey } from './linkage/panel';
import { el } from '../modes/dom';

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
const GUIDES: Record<string, { p: Vec2; dir: Vec2 }> = {
  chebyshev: { p: [0, 4], dir: [1, 0] },
  watt: { p: [6, 0], dir: [0, 1] }
};

type PlayMode = 'rot' | 'osc' | 'path';

interface Tag {
  el: HTMLElement;
  id: string;
}

function wrapPi(a: number): number {
  return a - TAU * Math.round(a / TAU);
}

function isVec(q: InputValue): q is Vec2 {
  return typeof q !== 'number';
}

/** 진행도 t의 도형 위 점에서 가장 가까운 진행도 */
function nearestProgress(pts: readonly Vec2[], p: Vec2): number {
  let best = 0;
  let bd = Infinity;
  for (let i = 0; i < 400; i++) {
    const t = i / 400;
    const c = pathPoint(pts, t);
    const d = (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2;
    if (d < bd) {
      bd = d;
      best = t;
    }
  }
  return best;
}

export class Linkage implements AppMode {
  private ctx: ModeContext | null = null;
  private model: LinkageModel | null = null;
  private panel: LinkPanel | null = null;
  private graph: Graph | null = null;
  private topEl: HTMLElement | null = null;

  private defs: MechanismDef[] = [];
  private def: MechanismDef | null = null;
  private sw: Sweep | null = null;
  private swCache = new Map<string, Sweep>();
  private pose: Pose | null = null;
  private prevPose: Pose | null = null;
  private blocked = false;
  private failAt = '';
  private customOn = false;
  private dims: CustomDims = { ...DEFAULT_DIMS };
  private customDirty = false;
  private grash: GrashofResult | null = null;
  private canPlay = true;
  private rngLo = 0;
  private rngHi = 0;

  private mode: PlayMode = 'rot';
  private playing = true;
  private dir = 1;
  private rpm = 10;
  private phase = 0;
  private progress = 0;
  private shape = 0;
  private offPath = false;
  private tilt = false;
  private tog = { trace: true, full: false, label: false };

  private tags: Tag[] = [];
  private readT = 0;
  private lastCur = NaN;
  private dragging = false;
  private tab: TabKey = 'list';
  private frameKey = '';
  private frameT = 0;
  private saved: { enabled: boolean; rotate: boolean; minD: number; maxD: number; polar: number } | null = null;
  private lastReads: Readout[] = [];

  private ray = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private v2 = new THREE.Vector2();
  private v3 = new THREE.Vector3();

  // ───────────────────────── 생명주기 ─────────────────────────

  enter(ctx: ModeContext): void {
    this.ctx = ctx;
    const q = new URLSearchParams(location.search);
    this.defs = [...MECHANISMS.filter((d) => d.id !== 'custom'), this.makeCustom(this.dims)];
    this.playing = true;
    this.forcedStop = false;
    this.customKeep = false;
    this.dir = 1;
    this.rpm = 10;
    this.shape = 0;
    this.progress = 0;
    this.tilt = q.get('lktilt') === '1';
    this.tog = { trace: q.get('lktrace') !== '0', full: q.get('lkfull') === '1', label: q.get('lklabel') === '1' };
    this.dims = { ...DEFAULT_DIMS };
    const dim = (q.get('lkdim') ?? '').split(',').map(Number);
    if (dim.length >= 4 && dim.every((x) => Number.isFinite(x))) {
      this.dims = { a: dim[0]!, b: dim[1]!, c: dim[2]!, d: dim[3]!, u: dim[4] ?? DEFAULT_DIMS.u, v: dim[5] ?? DEFAULT_DIMS.v };
    }
    const tabArg = q.get('lktab');
    this.tab = tabArg === 'uses' || tabArg === 'nums' || tabArg === 'list' ? tabArg : 'list';

    const sm = ctx.sceneMgr;
    const m = new LinkageModel();
    this.model = m;
    sm.add(m.root);
    const c = sm.controls;
    this.saved = { enabled: c.enabled, rotate: c.enableRotate, minD: c.minDistance, maxD: c.maxDistance, polar: c.maxPolarAngle };
    c.minDistance = 2;
    c.maxPolarAngle = Math.PI * 0.6;

    const graph = new Graph();
    this.graph = graph;
    this.panel = new LinkPanel(
      ctx.root,
      {
        select: (id) => this.select(id),
        togglePlay: () => this.togglePlay(),
        reverse: () => this.reverse(),
        speed: (r) => {
          this.rpm = r;
          this.panel?.setSpeed(r, this.mode !== 'rot');
        },
        scrub: (v) => this.onScrub(v),
        shape: (i) => this.setShape(i),
        toggle: (k, on) => this.setToggle(k, on),
        clearTrace: () => this.model?.clearTrace(),
        reset: () => this.reset(),
        highlight: (r) => this.model?.setRoleHighlight(r as Role | null),
        custom: (d) => this.onCustom(d),
        tab: (t) => this.setTab(t)
      },
      this.defs,
      (d) => mechanismIcon(d),
      graph
    );
    this.topEl = null;
    const cv = sm.renderer.domElement;
    cv.addEventListener('pointerdown', this.onDown, { capture: true });
    cv.addEventListener('pointermove', this.onHover);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('resize', this.onResize);

    (['trace', 'full', 'label'] as const).forEach((k) => this.panel?.setToggle(k, this.tog[k]));
    this.panel.setToggle('tilt', this.tilt);
    sm.controls.enableRotate = this.tilt;
    this.panel.setTab(this.tab);
    this.panel.setSpeed(this.rpm, false);
    this.panel.setReversed(false);

    const id = q.get('lk') ?? 'crank-rocker';
    const lkq = q.get('lkq');
    this.select(this.defs.some((d) => d.id === id) ? id : 'crank-rocker', lkq);
    if (lkq !== null) this.playing = q.get('lkplay') === '1';
    else if (q.get('lkplay') === '0') this.playing = false;
    this.syncPlayUi();

    (window as unknown as Record<string, unknown>).__lk = {
      state: () => this.state(),
      selfLeak: () => ctx.sceneMgr.renderer.info.memory.geometries
    };
  }

  exit(): void {
    const ctx = this.ctx;
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('resize', this.onResize);
    if (ctx) {
      const sm = ctx.sceneMgr;
      const cv = sm.renderer.domElement;
      cv.removeEventListener('pointerdown', this.onDown, { capture: true });
      cv.removeEventListener('pointermove', this.onHover);
      cv.style.cursor = '';
      const s = this.saved;
      if (s) {
        sm.controls.enabled = s.enabled;
        sm.controls.enableRotate = s.rotate;
        sm.controls.minDistance = s.minD;
        sm.controls.maxDistance = s.maxD;
        sm.controls.maxPolarAngle = s.polar;
      } else sm.controls.enabled = true;
      sm.camera.clearViewOffset();
      if (this.model) sm.remove(this.model.root);
    }
    this.model?.dispose();
    this.model = null;
    this.panel?.dispose();
    this.panel = null;
    this.graph?.dispose();
    this.graph = null;
    this.topEl?.remove();
    this.topEl = null;
    this.tags = [];
    this.swCache.clear();
    this.def = null;
    this.sw = null;
    this.pose = null;
    this.prevPose = null;
    this.saved = null;
    this.dragging = false;
    this.frameKey = '';
    delete (window as unknown as Record<string, unknown>).__lk;
    this.ctx = null;
  }

  // ───────────────────────── 기구 고르기 ─────────────────────────

  private makeCustom(d: CustomDims): MechanismDef {
    const def = fourbar(d.a, d.b, d.c, d.d, d.u, d.v);
    return { ...def, id: 'custom', name: '직접 만들기', oneLine: def.oneLine || '길이를 바꿔 나만의 4절 링크 장치를 만들어요' };
  }

  private sweepOf(def: MechanismDef): Sweep {
    const hit = this.swCache.get(def.id);
    if (hit) return hit;
    const s = sweep(def);
    if (def.id !== 'custom') this.swCache.set(def.id, s);
    return s;
  }

  /** lkq 문자열을 입력값으로 */
  private parseQ(def: MechanismDef, s: string): InputValue | null {
    if (def.input.kind === 'point') {
      const [a, b] = s.split(':');
      const i = Math.max(0, Math.min(def.input.paths.length - 1, Math.round(Number(a))));
      const t = Number(b);
      if (!Number.isFinite(i) || !Number.isFinite(t)) return null;
      this.shape = i;
      this.progress = t;
      return pathPoint(def.input.paths[i]!.pts, t);
    }
    const v = Number(s);
    if (!Number.isFinite(v)) return null;
    return def.input.kind === 'slide' ? v : v * DEG;
  }

  private select(id: string, lkq: string | null = null): void {
    const m = this.model;
    const panel = this.panel;
    if (!m || !panel) return;
    const custom = id === 'custom';
    this.customOn = custom;
    this.blocked = false;
    this.failAt = '';
    panel.clearPin();
    m.setRoleHighlight(null);
    if (custom) {
      this.customKeep = false; // 다른 기구의 입력값을 이어받지 않는다
      this.def = this.makeCustom(this.dims);
      this.defs[this.defs.length - 1] = this.def;
      panel.setDims(this.dims);
      this.loadCustom(lkq);
    } else {
      const def = this.defs.find((d) => d.id === id);
      if (!def) return;
      this.def = def;
      this.sw = this.sweepOf(def);
      this.canPlay = true;
      if (this.forcedStop) {
        this.playing = true;
        this.forcedStop = false;
      }
      this.grash = null;
      this.shape = 0;
      this.progress = 0;
      m.load(def, this.sw);
      this.startPose(lkq);
      this.setupInput();
    }
    const def = this.def;
    if (!def) return;
    panel.setCurrent(def, custom);
    m.setGuide(GUIDES[def.id] ?? null);
    m.setTrace(this.tog.trace);
    m.setFullPath(this.tog.full && this.sw && this.canPlay ? this.sw : null);
    this.buildGraph();
    this.buildTags();
    this.syncPlayUi();
    this.refreshReads();
    this.fit(false);
  }

  /** q0(또는 lkq)에서 시작 자세를 만든다. lkq면 q0에서 그 값까지 따라가 자취도 그려 둔다 */
  private startPose(lkq: string | null): void {
    const def = this.def;
    const m = this.model;
    if (!def || !m) return;
    const q0 = startInput(def);
    this.pose = solve(def, q0, null);
    this.prevPose = null;
    m.clearTrace();
    m.setPose(this.pose);
    if (lkq !== null) {
      const target = this.parseQ(def, lkq);
      if (target !== null) this.stepTo(target, true);
    }
    this.offPath = false;
    this.syncPhase();
  }

  private setupInput(): void {
    const def = this.def;
    const sw = this.sw;
    if (!def || !sw) return;
    const inp = def.input;
    const panel = this.panel;
    if (!panel) return;
    let cfg: { label: string; min: number; max: number; step: number };
    let shapes: string[] | null = null;
    if (inp.kind === 'point') {
      this.mode = 'path';
      this.rngLo = 0;
      this.rngHi = 1;
      cfg = { label: '도형 따라가기', min: 0, max: 1, step: 0.005 };
      shapes = inp.paths.map((p) => p.name);
    } else if (inp.kind === 'rotate' && sw.full) {
      this.mode = 'rot';
      cfg = { label: '구동 링크 각(크랭크)', min: 0, max: 360, step: 0.5 };
    } else {
      this.mode = 'osc';
      if (inp.kind === 'rotate') {
        this.rngLo = sw.qMin;
        this.rngHi = sw.qMax;
      } else {
        this.rngLo = inp.min;
        this.rngHi = inp.max;
      }
      const slide = inp.kind === 'slide';
      cfg = slide
        ? { label: '밀대 위치', min: this.rngLo, max: this.rngHi, step: 0.01 }
        : { label: '입력 각', min: Math.round(this.rngLo / DEG * 10) / 10, max: Math.round(this.rngHi / DEG * 10) / 10, step: 0.1 };
      // 끝점에서 조립이 어긋나지 않게 아주 조금 안쪽으로
      const e = slide ? 1e-6 : 1e-6;
      this.rngLo += e;
      this.rngHi -= e;
    }
    panel.config(cfg, shapes, this.shape, !this.canPlay);
    panel.setSpeed(this.rpm, this.mode !== 'rot');
    panel.setShapeSel(this.shape);
    this.syncPhase();
    this.lastCur = NaN;
  }

  // ───────────────────────── 직접 만들기 ─────────────────────────

  private onCustom(d: CustomDims): void {
    this.dims = { ...d };
    this.customDirty = true;
    this.grash = grashof(d.a, d.b, d.c, d.d);
    this.panel?.setGrashof(this.grash);
  }

  /** 슬라이더가 바뀐 프레임에 한 번만 다시 조립한다 */
  private loadCustom(lkq: string | null = null): void {
    const m = this.model;
    const panel = this.panel;
    if (!m || !panel) return;
    const d = this.dims;
    this.customDirty = false;
    const g = grashof(d.a, d.b, d.c, d.d);
    const rng = inputRange(d.a, d.b, d.c, d.d);
    this.grash = g;
    panel.setGrashof(g);
    const def = this.makeCustom(d);
    this.def = def;
    this.defs[this.defs.length - 1] = def;
    this.blocked = false;
    if (g.kind === 'impossible' || !rng) {
      const big = Math.max(d.a, d.b, d.c, d.d);
      this.sw = {
        poses: [],
        qs: [],
        full: false,
        qMin: 0,
        qMax: 0,
        bounds: { minX: -big * 0.6, maxX: d.d + big * 0.6, minY: -big * 0.8, maxY: big * 0.8 }
      };
      this.canPlay = false;
      this.pose = null;
      this.prevPose = null;
      if (this.playing) this.forcedStop = true;
      this.playing = false;
      m.load(def, this.sw);
      m.setGap(d.a, d.b, d.c, d.d);
      m.setFullPath(null);
      this.mode = 'osc';
      panel.config({ label: '입력 각', min: 0, max: 1, step: 0.1 }, null, 0, true);
      panel.setWarn('조립할 수 없어요. 재생과 끌기는 꺼졌어요.');
      panel.setReadouts([]);
      this.buildGraph();
      this.syncPlayUi();
      return;
    }
    const keep = this.pose && !this.blocked ? this.pose.q : null;
    this.sw = sweep(def);
    this.canPlay = this.sw.poses.length > 0;
    if (this.forcedStop && this.canPlay) {
      this.playing = true;
      this.forcedStop = false;
    }
    m.load(def, this.sw);
    m.setRange(rng.min, rng.max, rng.full);
    m.setFullPath(this.tog.full ? this.sw : null);
    this.setupInput();
    let q: InputValue = startInput(def);
    if (typeof keep === 'number' && this.customKeep) {
      q = this.mode === 'osc' ? Math.max(this.rngLo, Math.min(this.rngHi, keep)) : keep;
    }
    this.customKeep = true;
    this.pose = solve(def, q, null);
    this.prevPose = null;
    m.clearTrace();
    m.setPose(this.pose);
    if (lkq !== null) {
      const t = this.parseQ(def, lkq);
      if (t !== null) this.stepTo(t, true);
    }
    this.syncPhase();
    panel.setWarn(null);
    this.syncPlayUi();
    this.refreshReads();
  }

  private customKeep = false;
  private forcedStop = false;

  // ───────────────────────── 입력 진행 ─────────────────────────

  /** 입력값 → 위상(왕복 사인의 위치) */
  private syncPhase(): void {
    const pose = this.pose;
    if (!pose) return;
    if (this.mode === 'osc' && typeof pose.q === 'number') {
      const mid = (this.rngLo + this.rngHi) / 2;
      const amp = (this.rngHi - this.rngLo) / 2;
      this.phase = Math.asin(Math.max(-1, Math.min(1, amp > 0 ? (pose.q - mid) / amp : 0)));
    } else if (this.mode === 'path' && this.offPath === false) {
      const p = this.def?.input.kind === 'point' ? this.def.input.paths[this.shape]?.pts : undefined;
      if (p && isVec(pose.q)) this.progress = nearestProgress(p, pose.q);
    }
  }

  /** 입력값을 target까지 잘게 나눠 따라간다(가지가 뒤집히지 않게). 막히면 그 앞에서 멈춘다 */
  private stepTo(target: InputValue, dense: boolean): boolean {
    const def = this.def;
    const m = this.model;
    const pose = this.pose;
    if (!def || !m || !pose) return false;
    const cur = pose.q;
    let dist: number;
    let step: number;
    if (typeof target === 'number' && typeof cur === 'number') {
      dist = Math.abs(target - cur);
      step = def.input.kind === 'slide' ? ((def.input.max - def.input.min) / 90) * (dense ? 0.5 : 1) : (dense ? 1 : 2) * DEG;
    } else if (isVec(target) && isVec(cur)) {
      dist = Math.hypot(target[0] - cur[0], target[1] - cur[1]);
      step = dense ? 0.1 : 0.2;
    } else return false;
    const n = Math.max(1, Math.min(720, Math.ceil(dist / step)));
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      let qi: InputValue;
      if (typeof target === 'number' && typeof cur === 'number') qi = cur + (target - cur) * t;
      else {
        const a = cur as Vec2;
        const b = target as Vec2;
        qi = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] as Vec2;
      }
      const next = advance(def, this.pose!, qi, this.prevPose);
      if (!next.ok) {
        this.blocked = true;
        this.failAt = next.failAt ?? '';
        m.setPose(next);
        return false;
      }
      this.blocked = false;
      this.prevPose = this.pose;
      this.pose = next;
      m.setPose(next);
    }
    return true;
  }

  private togglePlay(): void {
    if (!this.canPlay) return;
    this.playing = !this.playing;
    if (this.playing) this.beginPlay();
    this.syncPlayUi();
  }

  private beginPlay(): void {
    if (this.mode === 'path' && this.offPath && this.def?.input.kind === 'point') {
      const pts = this.def.input.paths[this.shape]!.pts;
      const q = this.pose?.q;
      if (q && isVec(q)) this.progress = nearestProgress(pts, q);
      this.offPath = false;
    } else this.syncPhase();
  }

  private reverse(): void {
    this.dir = -this.dir;
    this.panel?.setReversed(this.dir < 0);
  }

  private reset(): void {
    if (!this.def) return;
    if (this.customOn) {
      this.dims = { ...DEFAULT_DIMS };
      this.panel?.setDims(this.dims);
      this.customKeep = false;
      this.loadCustom();
      return;
    }
    this.blocked = false;
    this.shape = 0;
    this.progress = 0;
    this.startPose(null);
    this.panel?.setShapeSel(0);
    this.panel?.setWarn(null);
  }

  private setShape(i: number): void {
    const def = this.def;
    if (!def || def.input.kind !== 'point') return;
    this.shape = i;
    this.panel?.setShapeSel(i);
    const pts = def.input.paths[i]?.pts;
    if (!pts) return;
    this.offPath = false;
    this.model?.clearTrace();
    this.stepTo(pathPoint(pts, this.progress), true);
  }

  private onScrub(v: number): void {
    const pose = this.pose;
    if (!pose || !this.def) return;
    this.playing = false;
    this.syncPlayUi();
    if (this.mode === 'path' && this.def.input.kind === 'point') {
      this.progress = v;
      this.offPath = false;
      this.stepTo(pathPoint(this.def.input.paths[this.shape]!.pts, v), true);
      return;
    }
    if (typeof pose.q !== 'number') return;
    let target: number;
    if (this.mode === 'rot') target = pose.q + wrapPi(v * DEG - pose.q);
    else if (this.def.input.kind === 'slide') target = v;
    else target = v * DEG;
    if (this.mode === 'osc') target = Math.max(this.rngLo, Math.min(this.rngHi, target));
    this.stepTo(target, true);
    this.syncPhase();
  }

  private nudge(sign: number, big: boolean): void {
    const pose = this.pose;
    const def = this.def;
    if (!pose || !def || !this.canPlay) return;
    this.playing = false;
    this.syncPlayUi();
    if (this.mode === 'path' && def.input.kind === 'point') {
      this.progress += sign * (big ? 0.05 : 0.01);
      this.offPath = false;
      this.stepTo(pathPoint(def.input.paths[this.shape]!.pts, this.progress), true);
      return;
    }
    if (typeof pose.q !== 'number') return;
    const d = def.input.kind === 'slide' ? (big ? 0.2 : 0.02) : (big ? 10 : 1) * DEG;
    let t = pose.q + sign * d;
    if (this.mode === 'osc') t = Math.max(this.rngLo, Math.min(this.rngHi, t));
    this.stepTo(t, true);
    this.syncPhase();
  }

  private setToggle(k: ToggleKey, on: boolean): void {
    const m = this.model;
    this.panel?.setToggle(k, on);
    if (k === 'tilt') {
      this.tilt = on;
      if (this.ctx) this.ctx.sceneMgr.controls.enableRotate = on;
      this.fit(false);
      return;
    }
    this.tog[k] = on;
    if (!m) return;
    if (k === 'trace') m.setTrace(on);
    else if (k === 'full') m.setFullPath(on && this.sw && this.canPlay ? this.sw : null);
    else if (k === 'label') this.buildTags();
  }

  private setTab(t: TabKey): void {
    this.tab = t;
    this.panel?.setTab(t);
    this.frameKey = '';
  }

  private syncPlayUi(): void {
    this.panel?.setPlaying(this.playing && this.canPlay, this.canPlay);
  }

  // ───────────────────────── 손으로 끌기 ─────────────────────────

  private handleScreen(): { x: number; y: number } | null {
    const ctx = this.ctx;
    const m = this.model;
    if (!ctx || !m) return null;
    const r = ctx.sceneMgr.renderer.domElement.getBoundingClientRect();
    m.handleWorld(this.v3);
    this.v3.project(ctx.sceneMgr.camera);
    if (this.v3.z > 1) return null;
    return { x: r.left + ((this.v3.x + 1) / 2) * r.width, y: r.top + ((1 - this.v3.y) / 2) * r.height };
  }

  private nearHandle(e: PointerEvent): boolean {
    if (!this.canPlay || !this.pose) return false;
    const h = this.handleScreen();
    if (!h) return false;
    const lim = e.pointerType === 'touch' ? 44 : 36;
    return Math.hypot(e.clientX - h.x, e.clientY - h.y) <= lim;
  }

  private onDown = (e: PointerEvent): void => {
    const ctx = this.ctx;
    if (!ctx || e.button !== 0 || !this.nearHandle(e)) return;
    ctx.sceneMgr.controls.enabled = false;
    this.dragging = true;
    this.playing = false;
    this.syncPlayUi();
    ctx.sceneMgr.renderer.domElement.style.cursor = 'grabbing';
    this.dragTo(e);
    e.preventDefault();
    e.stopPropagation();
  };

  private onHover = (e: PointerEvent): void => {
    if (this.dragging || !this.ctx || e.pointerType !== 'mouse') return;
    this.ctx.sceneMgr.renderer.domElement.style.cursor = this.nearHandle(e) ? 'grab' : '';
  };

  private onMove = (e: PointerEvent): void => {
    if (this.dragging) this.dragTo(e);
  };

  private onUp = (): void => {
    const ctx = this.ctx;
    if (!this.dragging || !ctx) return;
    this.dragging = false;
    ctx.sceneMgr.controls.enabled = true;
    ctx.sceneMgr.renderer.domElement.style.cursor = '';
    this.syncPhase();
  };

  private dragTo(e: PointerEvent): void {
    const ctx = this.ctx;
    const m = this.model;
    const def = this.def;
    const pose = this.pose;
    if (!ctx || !m || !def || !pose) return;
    const r = ctx.sceneMgr.renderer.domElement.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, ctx.sceneMgr.camera);
    if (!m.boardPoint(this.ray.ray, this.v2)) return;
    const target = inputFromPoint(def, pose, [this.v2.x, this.v2.y]);
    if (def.input.kind === 'point') this.offPath = true;
    this.stepTo(target, false);
  }

  // ───────────────────────── 키보드·크기 ─────────────────────────

  private onKey = (e: KeyboardEvent): void => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target as HTMLElement | null;
    const tag = t?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.key === ' ' || e.key === 'Enter') {
      if (tag === 'BUTTON') return; // 버튼은 스스로 눌린다
      if (e.key === 'Enter') return;
      this.togglePlay();
    } else if (e.key === 'ArrowRight') this.nudge(1, e.shiftKey);
    else if (e.key === 'ArrowLeft') this.nudge(-1, e.shiftKey);
    else if (e.key === 'r' || e.key === 'R') this.reverse();
    else if (e.key === 't' || e.key === 'T') this.setToggle('trace', !this.tog.trace);
    else if (e.key === '[' || e.key === ']') {
      const i = this.defs.findIndex((d) => d.id === this.def?.id);
      const n = Math.max(0, Math.min(this.defs.length - 1, i + (e.key === ']' ? 1 : -1)));
      if (n !== i) this.select(this.defs[n]!.id);
    } else return;
    e.preventDefault();
  };

  private onResize = (): void => {
    this.frameKey = '';
    this.fit(true);
  };

  // ───────────────────────── 카메라·이름표 ─────────────────────────

  /** 패널에 가리지 않는 영역 한가운데에 기구가 가득 차게 */
  private fit(immediate: boolean): void {
    const ctx = this.ctx;
    const m = this.model;
    const panel = this.panel;
    if (!ctx || !m || !panel || !this.def) return;
    const r = panel.region();
    const H = window.innerHeight;
    const hh = Math.max(120, r.y1 - r.y0);
    const ww = Math.max(120, r.x1 - r.x0);
    const v = m.view(this.tilt, ww / hh);
    const k = H / hh;
    const t = new THREE.Vector3(...v.target);
    const p = new THREE.Vector3(...v.pos);
    p.sub(t).multiplyScalar(k).add(t);
    const view: CameraView = { pos: [p.x, p.y, p.z], target: v.target };
    ctx.sceneMgr.flyTo(view, immediate);
    this.applyOffset();
  }

  private applyOffset(): void {
    const ctx = this.ctx;
    const panel = this.panel;
    if (!ctx || !panel) return;
    const r = panel.region();
    const W = window.innerWidth;
    const H = window.innerHeight;
    const cx = (r.x0 + r.x1) / 2;
    const cy = (r.y0 + r.y1) / 2;
    const key = `${W}x${H}:${Math.round(cx)},${Math.round(cy)}`;
    if (key === this.frameKey) return;
    const first = this.frameKey === '';
    this.frameKey = key;
    ctx.sceneMgr.camera.setViewOffset(W, H, W / 2 - cx, H / 2 - cy, W, H);
    if (!first) this.fitSoon = true;
  }

  private fitSoon = false;

  private buildTags(): void {
    const panel = this.panel;
    const def = this.def;
    if (!panel) return;
    panel.tags.replaceChildren();
    this.tags = [];
    if (!def || !this.tog.label) return;
    for (const s of def.steps) {
      const t = el('div', `lk-tag${s.id === def.handle ? ' is-handle' : ''}`);
      t.append(el('span', 'lk-tag-l', s.id === def.handle ? `${s.id} 끌어 보세요` : s.id));
      panel.tags.append(t);
      this.tags.push({ el: t, id: s.id });
    }
  }

  private updateTags(): void {
    const ctx = this.ctx;
    const m = this.model;
    const panel = this.panel;
    if (!ctx || !m || !panel || this.tags.length === 0) return;
    const cam = ctx.sceneMgr.camera;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const r = panel.region();
    for (const t of this.tags) {
      if (!m.jointWorld(t.id, this.v3)) {
        t.el.style.visibility = 'hidden';
        continue;
      }
      this.v3.project(cam);
      const x = ((this.v3.x + 1) / 2) * W;
      const y = ((1 - this.v3.y) / 2) * H;
      const hide = this.v3.z > 1 || x < r.x0 + 4 || x > r.x1 - 4 || y < Math.max(r.y0, 8) || y > r.y1 - 4 || (x < 232 && y < 76);
      t.el.style.visibility = hide ? 'hidden' : 'visible';
      if (!hide) t.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    }
  }

  // ───────────────────────── 그래프·숫자판 ─────────────────────────

  private cursorX(q: number): number {
    const def = this.def;
    if (!def) return NaN;
    if (def.input.kind === 'slide') return q;
    const deg = q / DEG;
    return def.id === 'steering' && def.input.kind === 'swing' ? deg - def.input.q0 / DEG : deg;
  }

  private buildGraph(): void {
    const g = this.graph;
    const panel = this.panel;
    const def = this.def;
    const sw = this.sw;
    if (!g || !panel || !def || !sw) return;
    g.set(null);
    panel.setGraphVisible(false);
    if (def.input.kind === 'point' || this.customOn || !this.canPlay || sw.qs.length < 2) return;
    const sr = series(def, sw);
    if (!sr || sr.ys.length !== sw.qs.length) return;
    const xs = sw.qs.map((q) => this.cursorX(q));
    const slide = def.input.kind === 'slide';
    const steer = def.id === 'steering';
    const data: GraphData = {
      xs,
      ys: sr.ys,
      xLabel: slide ? '밀대 위치 (cm)' : steer ? '왼쪽 바퀴 꺾임 δL (°)' : '구동 링크 각 θ (°)',
      yLabel: `${sr.label} (${sr.unit})`,
      refLine: steer,
      bands: def.id === 'quick-return' ? slowFastBands(xs, sr.ys, '°', this.mode === 'rot' ? 360 : 0) : undefined,
      wrap: this.mode === 'rot' ? 360 : undefined
    };
    g.set(data);
    panel.setGraphVisible(true);
    this.lastCur = NaN;
  }

  private refreshReads(): void {
    const def = this.def;
    const sw = this.sw;
    const pose = this.pose;
    if (!def || !sw || !pose || !this.panel || !this.canPlay) return;
    this.lastReads = readouts(def, pose, sw);
    this.panel.setReadouts(this.lastReads);
  }

  private updateScrub(): void {
    const pose = this.pose;
    const panel = this.panel;
    const def = this.def;
    if (!pose || !panel || !def) return;
    const q = pose.q;
    if (this.mode === 'path') {
      panel.setScrub(((this.progress % 1) + 1) % 1, `${Math.round((((this.progress % 1) + 1) % 1) * 100)}%`);
      return;
    }
    if (typeof q !== 'number') return;
    if (this.mode === 'rot') {
      const d = ((q / DEG) % 360 + 360) % 360;
      panel.setScrub(Math.round(d * 2) / 2, `${d.toFixed(0)}°`);
    } else if (def.input.kind === 'slide') panel.setScrub(q, `${q.toFixed(2)} cm`);
    else panel.setScrub(Math.round((q / DEG) * 10) / 10, `${(q / DEG).toFixed(1)}°`);
  }

  private updateWarn(): void {
    const panel = this.panel;
    if (!panel) return;
    if (!this.canPlay) return; // 조립 불가는 loadCustom이 알렸다
    if (this.blocked) {
      panel.setWarn(`${this.failAt ? `${this.failAt} 조인트를 ` : ''}조립할 수 없어요. 여기서 막혔어요.`);
      return;
    }
    const pose = this.pose;
    if (this.customOn && this.mode === 'osc' && pose && typeof pose.q === 'number' && (!this.playing || this.dragging)) {
      const eps = 0.004;
      if (pose.q <= this.rngLo + eps || pose.q >= this.rngHi - eps) {
        panel.setWarn('여기서 더는 못 가요(사점). 커플러와 따라 움직이는 링크가 한 줄이 되었어요.');
        return;
      }
    }
    panel.setWarn(null);
  }

  /** 검사 스크립트용: 조인트의 화면 좌표(px) */
  private screenPoints(): Record<string, { x: number; y: number }> {
    const out: Record<string, { x: number; y: number }> = {};
    const ctx = this.ctx;
    const m = this.model;
    const def = this.def;
    if (!ctx || !m || !def) return out;
    const r = ctx.sceneMgr.renderer.domElement.getBoundingClientRect();
    for (const st of def.steps) {
      if (!m.jointWorld(st.id, this.v3)) continue;
      this.v3.project(ctx.sceneMgr.camera);
      out[st.id] = { x: r.left + ((this.v3.x + 1) / 2) * r.width, y: r.top + ((1 - this.v3.y) / 2) * r.height };
    }
    return out;
  }

  private state(): Record<string, unknown> {
    const pose = this.pose;
    const q = pose?.q;
    const cp = this.ctx?.sceneMgr.camera.position;
    return {
      screen: this.screenPoints(),
      camPos: cp ? [cp.x, cp.y, cp.z] : null,
      handle: this.def?.handle ?? '',
      id: this.def?.id ?? '',
      q: q ?? null,
      deg: typeof q === 'number' && this.def?.input.kind !== 'slide' ? q / DEG : null,
      ok: !this.blocked && this.canPlay,
      failAt: this.failAt || undefined,
      readouts: this.lastReads.map((r) => ({ ...r })),
      grashof: this.customOn && this.grash ? { ...this.grash } : undefined,
      playing: this.playing,
      tilt: this.tilt,
      dragging: this.dragging
    };
  }

  // ───────────────────────── 매 프레임 ─────────────────────────

  update(dt: number, t: number): void {
    void t;
    const m = this.model;
    const def = this.def;
    if (!m || !def || !this.ctx || !this.panel) return;

    if (this.customDirty) this.loadCustom();

    // 재생: 입력값을 진행시켜 풀고 3D에 반영
    if (this.playing && this.canPlay && !this.dragging && this.pose && !this.blocked) {
      const rate = this.rpm / 60;
      if (this.mode === 'rot' && typeof this.pose.q === 'number') {
        this.stepTo(this.pose.q + this.dir * TAU * rate * dt, false);
      } else if (this.mode === 'osc') {
        this.phase += this.dir * TAU * rate * dt;
        const mid = (this.rngLo + this.rngHi) / 2;
        const amp = (this.rngHi - this.rngLo) / 2;
        this.stepTo(mid + amp * Math.sin(this.phase), false);
      } else if (this.mode === 'path' && def.input.kind === 'point') {
        const pts = def.input.paths[this.shape]!.pts;
        this.progress += this.dir * rate * dt;
        this.stepTo(pathPoint(pts, this.progress), false);
      }
      if (this.blocked) {
        this.playing = false;
        this.syncPlayUi();
      }
    }

    // 막혔다가 풀린 경우(끌던 손을 되돌림): 다음 입력이 성공하면 blocked가 풀린다
    this.updateScrub();
    const pose = this.pose;
    if (pose && this.graph && typeof pose.q === 'number') {
      const cx = this.cursorX(pose.q);
      if (cx !== this.lastCur) {
        this.lastCur = cx;
        this.graph.setCursor(cx);
      }
    }

    this.readT += dt;
    if (this.readT >= 0.1) {
      this.readT = 0;
      this.refreshReads();
      this.updateWarn();
    }

    this.frameT += dt;
    if (this.frameT > 0.2 || this.fitSoon) {
      this.frameT = 0;
      this.applyOffset();
      if (this.fitSoon) {
        this.fitSoon = false;
        this.fit(false);
      }
    }
    if (this.tog.label) this.updateTags();
  }
}
