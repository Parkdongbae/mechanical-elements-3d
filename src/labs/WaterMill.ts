// 탐구 실험 19 — 물레방아(물의 힘 → 물레바퀴 → 굴통 → 누름대 → 방아채 → 방아공이)
// 화면·통합: 계산(mill/physics) → 3D(mill/model) → 패널(mill/panel) · 그래프(mill/graph) · 공용 이름표(common/labels).
// 쿼리(캡처·검사용): wmq wmt wmth wmpause wmstage wmview wmslow wmlabel wmtab — window.__wm 은 검사용.

import * as THREE from 'three';
import type { AppMode, ModeContext } from '../modes/types';
import type { CameraView } from '../scene/SceneSetup';
import { LabLabels, type LabelSide, type LabelSpec, type LabelTone } from './common/labels';
import { MillModel } from './mill/model';
import { MillPhysics, readouts } from './mill/physics';
import { STAGES, PART_INFO, HAND_BLOCK_MSG } from './mill/data';
import { MillPanel, buildCards, type TabKey } from './mill/panel';
import { LiftGraph } from './mill/graph';
import { MILL } from './mill/types';
import type { DriveMode, PartKey, Strike, ViewKey } from './mill/types';

const D2R = Math.PI / 180;
const TWO_PI = Math.PI * 2;
const DT_MAX = 1 / 20; // 탭을 오래 떠났다 돌아와도 바퀴가 튀지 않게
const PRE_DT = 1 / 120; // wmt 미리 계산 간격

interface LabelDef {
  key: PartKey;
  twin?: PartKey; // 방아채 2 쪽 부품(같은 이름 — 강조할 때만 글자를 붙인다)
  side: LabelSide;
  priority: 1 | 2 | 3;
  tone: LabelTone;
}
// 우선순위: 누름대 > 방아채 > 방아공이 > 물레바퀴 > 굴통 > 나머지
const LABEL_DEFS: LabelDef[] = [
  { key: 'arm1', twin: 'arm2', side: 'left', priority: 1, tone: 'power' },
  { key: 'beam1', twin: 'beam2', side: 'above', priority: 1, tone: 'power' },
  { key: 'pestle1', twin: 'pestle2', side: 'right', priority: 1, tone: 'power' },
  { key: 'wheel', side: 'left', priority: 2, tone: 'shaft' },
  { key: 'shaft', side: 'below', priority: 2, tone: 'accent' },
  { key: 'pivot1', twin: 'pivot2', side: 'below', priority: 2, tone: 'accent' },
  { key: 'bowl1', twin: 'bowl2', side: 'below', priority: 2, tone: 'accent' },
  { key: 'chute', side: 'above', priority: 2, tone: 'shaft' },
  { key: 'gate', side: 'above', priority: 3, tone: 'shaft' },
  { key: 'blade', side: 'left', priority: 3, tone: 'shaft' },
  { key: 'post', side: 'below', priority: 3, tone: 'accent' }
];

const wrapDeg = (d: number): number => ((((d + 180) % 360) + 360) % 360) - 180;
const wrapRad = (r: number): number => ((((r + Math.PI) % TWO_PI) + TWO_PI) % TWO_PI) - Math.PI;

export class WaterMill implements AppMode {
  private ctx: ModeContext | null = null;
  private model: MillModel | null = null;
  private phys = new MillPhysics();
  private panel: MillPanel | null = null;
  private graph: LiftGraph | null = null;
  private labels: LabLabels | null = null;
  private offs: (() => void)[] = [];

  private stage = 0;
  private viewKey: ViewKey = 'all';
  private mode: DriveMode = 'water';
  private slow = false;
  private paused = false;
  private focus: PartKey[] | null = null;
  private frameKey = '';
  private frameT = 0;
  private uiT = 0;
  private bounds = { x0: 0, y0: 0, x1: 1, y1: 1 };
  private saved = { min: 2, max: 18 };
  private lastHintAt = -1e9;
  private downX = 0;
  private downY = 0;

  // 손으로 돌리기(캔버스 드래그)
  private dragging = false;
  private grabOffset = 0;
  private readonly ray = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private readonly hit = new THREE.Vector3();

  // ───────────────────────── 생명주기 ─────────────────────────

  enter(ctx: ModeContext): void {
    this.ctx = ctx;
    const q = new URLSearchParams(location.search);
    this.phys = new MillPhysics();
    this.phys.reset();
    this.stage = 0;
    this.viewKey = 'all';
    this.mode = 'water';
    this.slow = false;
    this.paused = false;
    this.focus = null;
    this.frameKey = '';
    this.dragging = false;
    this.lastHintAt = -1e9;

    const model = new MillModel();
    this.model = model;
    ctx.sceneMgr.add(model.root);
    model.root.updateMatrixWorld(true);

    const sm = ctx.sceneMgr;
    this.saved = { min: sm.controls.minDistance, max: sm.controls.maxDistance };
    sm.controls.minDistance = 1.5;
    sm.controls.maxDistance = Math.max(this.saved.max, 30);

    this.graph = new LiftGraph();
    const cards = buildCards();
    const panel = new MillPanel(
      {
        stage: (i) => this.go(i, false),
        gate: () => this.toggleGate(),
        flow: (lps) => this.setFlow(lps),
        mode: (m) => this.setMode(m),
        slow: (on) => this.setSlow(on),
        view: (v) => this.setView(v, false),
        reset: () => this.resetAll(),
        scrub: (deg) => this.scrubTo(deg)
      },
      STAGES.map((s) => ({ title: s.title, body: s.body })),
      cards,
      this.graph
    );
    this.panel = panel;
    ctx.root.append(panel.wrap);

    this.labels = new LabLabels(ctx, panel.wrap, {
      bounds: () => this.bounds,
      onToggle: () => this.refreshLabelFocus()
    });
    panel.setLabelButton(this.labels.button);
    this.on(this.labels.layer, 'click', this.onTagClick as EventListener);
    this.on(sm.renderer.domElement, 'click', this.onCanvasClick as EventListener);

    // 입력
    const cv = sm.renderer.domElement;
    this.on(cv, 'pointerdown', this.onDown as EventListener, { capture: true });
    this.on(cv, 'pointermove', this.onHover as EventListener);
    this.on(window, 'pointermove', this.onMove as EventListener);
    this.on(window, 'pointerup', this.onUp as EventListener);
    this.on(window, 'pointercancel', this.onUp as EventListener);
    this.on(window, 'keydown', this.onKey as EventListener);
    this.on(window, 'resize', this.onResize);

    this.applyQuery(q);
    this.updateFrame(true);
    this.flyView(this.viewKey, true);
    this.buildLabels();
    this.refreshUi(true);
    this.install();
  }

  exit(): void {
    for (const off of this.offs) off();
    this.offs = [];
    const ctx = this.ctx;
    if (ctx) {
      const sm = ctx.sceneMgr;
      sm.renderer.domElement.style.cursor = '';
      sm.controls.enabled = true;
      sm.controls.minDistance = this.saved.min;
      sm.controls.maxDistance = this.saved.max;
      sm.camera.clearViewOffset();
      if (this.model) sm.remove(this.model.root);
    }
    this.labels?.dispose();
    this.labels = null;
    this.panel?.dispose();
    this.panel = null;
    this.graph?.dispose();
    this.graph = null;
    this.model?.dispose();
    this.model = null;
    this.dragging = false;
    const w = window as unknown as Record<string, unknown>;
    delete w.__wm;
    this.ctx = null;
  }

  private on(target: EventTarget, type: string, fn: EventListener, opts?: AddEventListenerOptions): void {
    target.addEventListener(type, fn, opts);
    this.offs.push(() => target.removeEventListener(type, fn, opts));
  }

  // ───────────────────────── 쿼리 ─────────────────────────

  private applyQuery(q: URLSearchParams): void {
    const phys = this.phys;
    const panel = this.panel!;
    const num = (k: string): number | null => {
      const v = q.get(k);
      if (v === null || v === '') return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    const wmth = num('wmth');
    const wmq = num('wmq');
    if (wmq !== null) {
      const lps = Math.max(0, Math.min(480, wmq));
      phys.q = lps / 1000;
      panel.setFlow(lps);
      phys.gateOpen = true;
      panel.setGate(true);
    } else {
      phys.q = 0.32;
    }
    if (wmth !== null) {
      this.mode = 'hand';
      phys.mode = 'hand';
      phys.gateOpen = false;
      panel.setGate(false);
      panel.setMode('hand');
      phys.pose(wmth * D2R);
    }
    const wmt = num('wmt');
    if (wmt !== null && wmt > 0) this.precompute(wmt);
    this.model!.apply(phys.state);

    const stage = num('wmstage');
    if (stage !== null && stage >= 1 && stage <= STAGES.length) this.go(Math.round(stage), true);
    const view = q.get('wmview');
    if (view === 'all' || view === 'wheel' || view === 'cam' || view === 'pestle') this.setView(view, true);
    if (q.get('wmslow') === '1') this.setSlow(true);
    const lab = q.get('wmlabel');
    if (lab === '0' || lab === '1') this.labels!.setVisible(lab === '1');
    const tab = q.get('wmtab');
    if (tab === 'stage' || tab === 'nums' || tab === 'info') panel.setTab(tab as TabKey);
    if (q.get('wmpause') === '1') this.paused = true;
  }

  /** 화면을 그리기 전에 고정 간격으로 미리 계산(같은 쿼리면 항상 같은 결과) */
  private precompute(sec: number): void {
    const m = this.model!;
    const phys = this.phys;
    const n = Math.round(sec / PRE_DT);
    const tailWater = Math.round(3 / PRE_DT);
    const tailGraph = Math.round(4.5 / PRE_DT);
    const s = phys.state;
    const saved = phys.timeScale;
    phys.timeScale = 1;
    for (let i = 0; i < n; i++) {
      const strikes = phys.step(PRE_DT);
      const left = n - i;
      if (left <= tailGraph) this.graph?.push(s.t, s.beams[0].lift, s.beams[1].lift);
      if (left <= tailWater) {
        m.apply(s);
        m.updateWater(s, PRE_DT);
        for (const k of strikes) m.strike(k.beam, k.energy);
      }
    }
    phys.timeScale = saved;
  }

  // ───────────────────────── 조작 ─────────────────────────

  private toggleGate(): void {
    if (this.mode !== 'water') return;
    this.phys.gateOpen = !this.phys.gateOpen;
    this.panel?.setGate(this.phys.gateOpen);
  }

  private setFlow(lps: number): void {
    const v = Math.max(0, Math.min(480, Math.round(lps / 10) * 10));
    this.phys.q = v / 1000;
    this.panel?.setFlow(v);
  }

  private setMode(m: DriveMode): void {
    if (m === this.mode) return;
    this.mode = m;
    this.phys.mode = m;
    if (m === 'hand') {
      this.phys.gateOpen = false;
      this.panel?.setGate(false);
    }
    this.panel?.setMode(m);
    this.dragging = false;
    this.ctx?.sceneMgr.renderer.domElement.style.removeProperty('cursor');
    this.syncScrub();
  }

  private setSlow(on: boolean): void {
    this.slow = on;
    this.phys.timeScale = on ? 0.25 : 1;
    this.panel?.setSlow(on);
  }

  private setView(v: ViewKey, immediate: boolean): void {
    this.viewKey = v;
    this.model?.setView(v);
    this.panel?.setView(v);
    this.flyView(v, immediate);
  }

  private go(i: number, immediate: boolean): void {
    this.stage = i;
    this.panel?.setStage(i);
    const s = i >= 1 ? STAGES[i - 1] : undefined;
    this.focus = s ? s.focus : null;
    this.model?.setFocus(this.focus);
    if (s) {
      this.setSlow(s.slow);
      this.setView(s.view, immediate);
    }
    this.buildLabels();
  }

  private resetAll(): void {
    const phys = this.phys;
    phys.mode = 'water';
    this.mode = 'water';
    phys.gateOpen = false;
    phys.reset();
    this.panel?.setMode('water');
    this.panel?.setGate(false);
    this.panel?.showPart(null);
    this.graph?.clear();
    this.model?.apply(phys.state);
    this.go(0, false);
    this.setSlow(false);
    this.setView('all', false);
    this.syncScrub();
  }

  private scrubTo(deg: number): void {
    if (this.mode !== 'hand') return;
    const cur = this.thetaDeg();
    const d = wrapDeg(deg - cur);
    if (d > 0.01) this.turn(d * D2R);
    else if (d < -0.01) {
      this.hint();
      this.panel?.setScrub(cur);
    }
  }

  /** 손으로 앞으로만 돌린다(큰 각은 잘게 나눠 넘긴다) */
  private turn(rad: number): boolean {
    let ok = true;
    let rest = rad;
    while (rest > 1e-9) {
      const d = Math.min(rest, 1.5 * D2R);
      if (!this.phys.handTurn(d)) ok = false;
      rest -= d;
    }
    if (rad < 0) ok = this.phys.handTurn(rad);
    return ok;
  }

  private hint(): void {
    const now = performance.now();
    if (now - this.lastHintAt < 2500) return;
    this.lastHintAt = now;
    this.panel?.note(HAND_BLOCK_MSG);
  }

  private thetaDeg(): number {
    return (((this.phys.state.theta / D2R) % 360) + 360) % 360;
  }

  private syncScrub(): void {
    this.panel?.setScrub(this.thetaDeg());
  }

  // ───────────────────────── 포인터·키보드 ─────────────────────────

  /** 포인터 아래 바퀴 평면의 각(굴통 각 θ 와 같은 방향·0 = 위). 바퀴 둘레 근처가 아니면 null */
  private pointerAngle(e: PointerEvent): number | null {
    const ctx = this.ctx;
    const m = this.model;
    if (!ctx || !m) return null;
    const r = ctx.sceneMgr.renderer.domElement.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, ctx.sceneMgr.camera);
    // rimPoint 는 월드 레이를 받아 root 로컬(실제 m)의 교점을 돌려준다
    if (!m.rimPoint(this.ray.ray, this.hit)) return null;
    const dz = this.hit.z;
    const dy = this.hit.y - MILL.axisY;
    const rr = Math.hypot(dz, dy);
    if (rr < MILL.wheelR * 0.6 || rr > MILL.wheelR * 1.25) return null;
    return Math.atan2(dz, dy);
  }

  private onDown = (e: PointerEvent): void => {
    const ctx = this.ctx;
    this.downX = e.clientX;
    this.downY = e.clientY;
    if (!ctx || this.mode !== 'hand' || e.button !== 0) return;
    const a = this.pointerAngle(e);
    if (a === null) return;
    ctx.sceneMgr.controls.enabled = false; // OrbitControls 보다 먼저(캡처 단계) 받아 카메라 회전을 막는다
    this.dragging = true;
    this.grabOffset = wrapRad(this.phys.state.theta - a);
    ctx.sceneMgr.renderer.domElement.style.cursor = 'grabbing';
    e.preventDefault();
  };

  private onHover = (e: PointerEvent): void => {
    const ctx = this.ctx;
    if (!ctx || this.dragging || e.pointerType !== 'mouse') return;
    const cv = ctx.sceneMgr.renderer.domElement;
    if (this.mode !== 'hand') {
      cv.style.removeProperty('cursor');
      return;
    }
    cv.style.cursor = this.pointerAngle(e) !== null ? 'grab' : '';
  };

  private onMove = (e: PointerEvent): void => {
    if (!this.dragging) return;
    const a = this.pointerAngle(e);
    if (a === null) return;
    const target = a + this.grabOffset;
    const d = wrapRad(target - this.phys.state.theta);
    if (d > 0.002) this.turn(d);
    else if (d < -0.02) this.hint();
  };

  private onUp = (): void => {
    if (!this.dragging || !this.ctx) return;
    this.dragging = false;
    this.ctx.sceneMgr.controls.enabled = true;
    this.ctx.sceneMgr.renderer.domElement.style.removeProperty('cursor');
  };

  private onKey = (e: KeyboardEvent): void => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const onButton = !!t && t.tagName === 'BUTTON';
    const k = e.key;
    if (k === ' ' || k === 'Spacebar') {
      if (onButton) return; // 버튼의 Space 는 그 버튼이 처리
      this.toggleGate();
    } else if (k === 'ArrowRight' || k === 'ArrowLeft') {
      if (this.mode === 'hand') {
        if (k === 'ArrowRight') this.turn(2 * D2R);
        else this.hint();
      } else {
        this.setFlow(Math.round(this.phys.q * 1000) + (k === 'ArrowRight' ? 10 : -10));
      }
    } else if (k === 's' || k === 'S') {
      this.setSlow(!this.slow);
    } else if (k === 'l' || k === 'L') {
      this.labels?.setVisible(!this.labels.visible);
    } else if (k >= '1' && k <= '5') {
      this.go(Number(k), false);
    } else return;
    e.preventDefault();
  };

  private onResize = (): void => {
    this.updateFrame(true);
    this.flyView(this.viewKey, false);
  };

  // ───────────────────────── 카메라·이름표 ─────────────────────────

  /** 3D 가 보이는 영역(패널·조작 막대·시트를 뺀 곳)의 가운데로 화면을 옮긴다 */
  private updateFrame(force = false): void {
    const ctx = this.ctx;
    const p = this.panel;
    if (!ctx || !p) return;
    const W = window.innerWidth;
    const H = window.innerHeight;
    let x0 = 0;
    let x1 = W;
    let y0 = 0;
    let y1 = H;
    if (W >= 820) {
      x1 = p.side.getBoundingClientRect().left - 8;
      y1 = p.bar.getBoundingClientRect().top - 8;
    } else {
      y0 = 56;
      y1 = p.dock.getBoundingClientRect().top - 4;
    }
    y1 = Math.max(y1, y0 + 80);
    this.bounds = { x0, y0, x1, y1 };
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const key = `${W}x${H}:${Math.round(cx)},${Math.round(cy)}`;
    if (key === this.frameKey && !force) return;
    this.frameKey = key;
    ctx.sceneMgr.camera.setViewOffset(W, H, W / 2 - cx, H / 2 - cy, W, H);
  }

  private flyView(key: ViewKey, immediate: boolean): void {
    const ctx = this.ctx;
    const m = this.model;
    if (!ctx || !m) return;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const bw = this.bounds.x1 - this.bounds.x0;
    const bh = this.bounds.y1 - this.bounds.y0;
    const v = m.view(key, bw / Math.max(bh, 1));
    // 보이는 영역이 화면보다 낮은 만큼 더 물러난다
    const k = 1 + Math.max(0, H / Math.max(bh, 1) - 1) * 0.6;
    const t = new THREE.Vector3(...v.target);
    const p = new THREE.Vector3(...v.pos);
    p.sub(t).multiplyScalar(k).add(t);
    const out: CameraView = { pos: [p.x, p.y, p.z], target: v.target };
    ctx.sceneMgr.flyTo(out, immediate);
    void W;
  }

  private buildLabels(): void {
    const labels = this.labels;
    const m = this.model;
    if (!labels || !m) return;
    const focus = new Set<PartKey>(this.focus ?? []);
    const anchor = (key: PartKey) => (out: THREE.Vector3): boolean => {
      const p = m.anchor(key);
      if (!p) return false;
      out.copy(p);
      m.root.localToWorld(out);
      return true;
    };
    const specs: LabelSpec[] = [];
    const add = (key: PartKey, d: LabelDef): void => {
      const f = focus.has(key);
      specs.push({
        key,
        text: PART_INFO[key].name,
        at: anchor(key),
        side: d.side,
        kind: 'part',
        priority: f ? 1 : d.priority,
        tone: d.tone
      });
    };
    for (const d of LABEL_DEFS) {
      add(d.key, d);
      if (d.twin && focus.has(d.twin)) add(d.twin, d);
    }
    labels.set(specs);
    this.refreshLabelFocus();
  }

  private refreshLabelFocus(): void {
    const layer = this.labels?.layer;
    if (!layer) return;
    const focus = new Set<string>(this.focus ?? []);
    if (this.panel) this.panel.wrap.dataset.focus = focus.size ? 'on' : 'off';
    layer.querySelectorAll<HTMLElement>('.lab-tag').forEach((e) => {
      if (focus.has(e.dataset.key ?? '')) e.dataset.wmFocus = 'true';
      else e.removeAttribute('data-wm-focus');
    });
  }

  /** 펼쳐진 이름표(글자·점)를 캔버스에서 눌러도 설명 카드가 뜬다 — 공용 이름표는 접힌 점만 눌리기 때문 */
  private onCanvasClick = (e: MouseEvent): void => {
    const layer = this.labels?.layer;
    if (!layer || !this.labels?.visible) return;
    if (Math.hypot(e.clientX - this.downX, e.clientY - this.downY) > 6) return; // 끌기였다
    let best: { key: string; d: number } | null = null;
    layer.querySelectorAll<HTMLElement>('.lab-tag').forEach((t) => {
      if (t.style.display === 'none' || t.dataset.collapsed === 'true') return;
      const key = t.dataset.key;
      if (!key) return;
      const dot = t.querySelector('.lab-tag-dot')?.getBoundingClientRect();
      const lab = t.querySelector('.lab-tag-l')?.getBoundingClientRect();
      let d = Infinity;
      if (dot) d = Math.min(d, Math.hypot(e.clientX - (dot.left + dot.width / 2), e.clientY - (dot.top + dot.height / 2)));
      if (lab && e.clientX >= lab.left - 4 && e.clientX <= lab.right + 4 && e.clientY >= lab.top - 4 && e.clientY <= lab.bottom + 4) d = Math.min(d, 0);
      if (d <= 16 && (!best || d < best.d)) best = { key, d };
    });
    const hit = best as { key: string; d: number } | null;
    if (hit && hit.key in PART_INFO) {
      const info = PART_INFO[hit.key as PartKey];
      this.panel?.showPart(info.name, info.desc);
    }
  };

  private onTagClick = (e: MouseEvent): void => {
    const t = e.target as Element | null;
    const key = t?.closest<HTMLElement>('.lab-tag')?.dataset.key as PartKey | undefined;
    if (!key || !(key in PART_INFO)) return;
    const info = PART_INFO[key];
    this.panel?.showPart(info.name, info.desc);
  };

  // ───────────────────────── 프레임 ─────────────────────────

  update(dt: number, t: number): void {
    void t;
    const m = this.model;
    const ctx = this.ctx;
    if (!m || !ctx) return;
    const sdt = Math.min(dt, DT_MAX);
    const s = this.phys.state;
    if (!this.paused) {
      const strikes: Strike[] = this.phys.step(sdt);
      m.apply(s);
      m.updateWater(s, sdt * this.phys.timeScale);
      for (const k of strikes) m.strike(k.beam, k.energy);
      this.graph?.push(s.t, s.beams[0].lift, s.beams[1].lift);
    }
    this.labels?.update();

    this.frameT += dt;
    if (this.frameT > 0.2) {
      this.frameT = 0;
      this.updateFrame();
    }
    this.uiT += dt;
    if (this.uiT > 0.1) {
      this.uiT = 0;
      this.refreshUi(false);
    }
  }

  private refreshUi(force: boolean): void {
    const p = this.panel;
    if (!p) return;
    p.setReadouts(readouts(this.phys));
    this.graph?.render(this.phys.state.t);
    if (this.mode === 'hand' || force) this.syncScrub();
  }

  // ───────────────────────── 검사용 ─────────────────────────

  private install(): void {
    const w = window as unknown as Record<string, unknown>;
    w.__wm = {
      state: () => {
        const s = this.phys.state;
        const st = this.phys.stats();
        const tags = this.labels
          ? [...this.labels.layer.querySelectorAll<HTMLElement>('.lab-tag')].filter(
              (e) => e.style.display !== 'none' && e.dataset.collapsed !== 'true'
            ).length
          : 0;
        return {
          t: s.t,
          theta: this.thetaDeg(),
          omega: s.omega,
          rpm: st.rpm,
          flow: s.flow,
          waterMass: s.waterMass,
          lift: [s.beams[0].lift, s.beams[1].lift],
          engaged: [s.beams[0].engaged, s.beams[1].engaged],
          strikes: [s.strikes[0], s.strikes[1]],
          last: [s.last[0], s.last[1]],
          readouts: readouts(this.phys),
          labels: tags,
          mode: this.mode,
          gate: this.phys.gateOpen,
          stage: this.stage,
          view: this.viewKey,
          slow: this.slow
        };
      },
      /** 굴통 각 deg·반지름 r(m) 지점의 화면 좌표(px) — 손으로 돌리기 검사용 */
      screenOf: (deg: number, r = 1.45): { x: number; y: number } | null => {
        const ctx = this.ctx;
        const m = this.model;
        if (!ctx || !m) return null;
        const v = new THREE.Vector3(0, MILL.axisY + r * Math.cos(deg * D2R), r * Math.sin(deg * D2R));
        m.root.localToWorld(v);
        v.project(ctx.sceneMgr.camera);
        return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight };
      },
      /** 새 자원이 남는지 보는 수 — enter/exit 를 되풀이해도 늘지 않아야 한다 */
      selfLeak: (): number => {
        const ctx = this.ctx;
        if (!ctx) return -1;
        const mem = ctx.sceneMgr.renderer.info.memory;
        return mem.geometries + mem.textures + ctx.root.querySelectorAll('*').length + this.offs.length;
      }
    };
  }
}
