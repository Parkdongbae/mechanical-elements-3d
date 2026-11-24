// 링크 장치 3D 모델 — 세워 놓은 작업판 위에 막대·핀·받침을 올린다. 기구 좌표(x, y) → 월드 (x, y)·판 앞면(z).
// 막대 모양(지오메트리)은 load 때 한 번 만들고, setPose는 위치·회전만 바꾼다. 같은 층끼리는 겹치지 않고 층마다 z를 띄운다.

import * as THREE from 'three';
import type { CameraView } from '../../scene/SceneSetup';
import {
  aluminum, brass, castIron, chrome, darkSteel, ghost, glow, paint, plastic, rubber, steel,
  CATEGORY_COLORS, PALETTE
} from '../../models/materials';
import { extrude, roundedRect, merge, lathe, mesh, TAU, type V2 } from '../../models/parts/geom';
import type { Bar, Decor, MechanismDef, Plate, Pose, Rail, Role, Sweep, Vec2 } from './types';
import {
  BAR_HW, BAR_T, HEAD_R, PIN_R, barGeometry, cylZ, groundSymbol, plateGeometry, slab, tireGeometry, wheelGeometry, zOf
} from './parts';
import { Trace, dashedLine, pathLine } from './trace';

const BOARD_W = 9;
const BOARD_H = 5.6;
const BOARD_CY = 3.0;
const BODY_T = 0.08; // 슬라이더 몸체 두께(막대보다 조금 두꺼워 같은 층 막대와 면이 겹치지 않게)
const ROLES: Role[] = ['ground', 'input', 'coupler', 'output', 'link'];
const DEG = Math.PI / 180;

type Upd = (pose: Pose) => void;

interface JointInfo {
  lo: number; // 붙은 부품의 가장 낮은 면 z
  hi: number; // 가장 높은 면 z
}

/** 자식까지 지오메트리·재질·질감을 정리하고 비운다 */
function clearGroup(g: THREE.Object3D): void {
  for (const child of [...g.children]) {
    clearGroup(child);
    g.remove(child);
    const m = child as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (mat) {
      for (const x of Array.isArray(mat) ? mat : [mat]) {
        const mm = x as THREE.MeshStandardMaterial;
        if (mm.map) mm.map.dispose();
        x.dispose();
      }
    }
  }
}

function labelTexture(text: string, color: string): { tex: THREE.CanvasTexture; aspect: number } {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.font = '700 64px system-ui, "Malgun Gothic", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 12;
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.strokeText(text, 256, 64);
    ctx.fillStyle = color;
    ctx.fillText(text, 256, 64);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { tex, aspect: 4 };
}

function hatchTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 64, 64);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    for (let k = -1; k <= 2; k++) {
      ctx.beginPath();
      ctx.moveTo(k * 32 - 8, 72);
      ctx.lineTo(k * 32 + 72, -8);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class LinkageModel {
  readonly root = new THREE.Group();
  private readonly boardG = new THREE.Group();
  private readonly gridG = new THREE.Group();
  private readonly mechG = new THREE.Group();
  private readonly rangeG = new THREE.Group();
  private readonly gapG = new THREE.Group();
  private readonly traceG = new THREE.Group();
  private readonly fullG = new THREE.Group();
  private readonly guideG = new THREE.Group();
  private failMark: THREE.Mesh | null = null;

  private def: MechanismDef | null = null;
  private s = 1;
  private cx = 0;
  private cy = 0;
  private upd: Upd[] = [];
  private traces: { id: string; trace: Trace }[] = [];
  private lastPose: Pose | null = null;
  private traceZ = 0.5;
  private handleZ = 0.4;
  private handleKnob: THREE.Object3D | null = null;
  private roleMats: Record<Role, THREE.Material[]> = { ground: [], input: [], coupler: [], output: [], link: [] };
  private disposed = false;

  constructor() {
    this.root.name = 'linkage-model';
    this.root.add(this.boardG, this.gridG, this.mechG, this.rangeG, this.gapG, this.traceG, this.fullG, this.guideG);
    this.gapG.visible = false;
    this.buildBoard();
  }

  // ───────────────────────── 작업판 ─────────────────────────

  private buildBoard(): void {
    const g = this.boardG;
    const top = BOARD_CY + BOARD_H / 2;
    const bot = BOARD_CY - BOARD_H / 2;
    // 판 — 앞면이 z=0
    const plate = extrude(roundedRect(-BOARD_W / 2, bot, BOARD_W / 2, top, 0.18), 0.18, 0.02, 12, 2);
    plate.translate(0, 0, -0.09);
    mesh(plate, plastic(0x9fadc0, { roughness: 0.8 }), g);
    // 바닥 받침(판이 꽂힌 턱)
    const foot = new THREE.BoxGeometry(BOARD_W + 0.3, bot, 1.0);
    foot.translate(0, bot / 2, -0.12);
    mesh(foot, castIron(), g);
    // 뒤 받침 다리 + 가로대 + 발판
    const legMat = darkSteel();
    const padMat = castIron();
    for (const x of [-3.5, 3.5]) {
      const a = new THREE.Vector3(x, top - 1.1, -0.2);
      const b = new THREE.Vector3(x, 0.1, -2.3);
      const len = a.distanceTo(b);
      const leg = new THREE.CylinderGeometry(0.075, 0.075, len, 24, 1);
      const m = mesh(leg, legMat, g);
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      const pad = new THREE.BoxGeometry(0.42, 0.1, 0.42);
      pad.translate(x, 0.05, -2.3);
      mesh(pad, padMat, g);
      const hinge = new THREE.CylinderGeometry(0.11, 0.11, 0.3, 24, 1);
      hinge.rotateZ(Math.PI / 2);
      hinge.translate(x, top - 1.1, -0.26);
      mesh(hinge, padMat, g);
    }
    const bar = new THREE.BoxGeometry(7.0, 0.08, 0.1);
    bar.translate(0, 0.14, -2.3);
    mesh(bar, legMat, g);
  }

  private buildGrid(): void {
    clearGroup(this.gridG);
    const s = this.s;
    let step = 1;
    const mults = [2, 2.5, 2];
    let mi = 0;
    while (step * s < 0.3) {
      step *= mults[mi % 3]!;
      mi++;
    }
    const halfW = BOARD_W / 2 - 0.14;
    const y0 = BOARD_CY - BOARD_H / 2 + 0.14;
    const y1 = BOARD_CY + BOARD_H / 2 - 0.14;
    const geos: THREE.BufferGeometry[] = [];
    const kx0 = Math.ceil((-halfW / s + this.cx) / step);
    const kx1 = Math.floor((halfW / s + this.cx) / step);
    for (let k = kx0; k <= kx1; k++) {
      const x = (k * step - this.cx) * s;
      const w = k % 5 === 0 ? 0.011 : 0.005;
      const b = new THREE.BoxGeometry(w, y1 - y0, 0.006);
      b.translate(x, (y0 + y1) / 2, 0.003);
      geos.push(b);
    }
    const ky0 = Math.ceil(((y0 - BOARD_CY) / s + this.cy) / step);
    const ky1 = Math.floor(((y1 - BOARD_CY) / s + this.cy) / step);
    for (let k = ky0; k <= ky1; k++) {
      const y = BOARD_CY + (k * step - this.cy) * s;
      const w = k % 5 === 0 ? 0.011 : 0.005;
      const b = new THREE.BoxGeometry(halfW * 2, w, 0.006);
      b.translate(0, y, 0.0031);
      geos.push(b);
    }
    if (geos.length) mesh(merge(geos), plastic(0xc6d0dd, { roughness: 0.8 }), this.gridG).castShadow = false;
  }

  // ───────────────────────── 좌표 ─────────────────────────

  private W(p: Vec2): [number, number] {
    return [(p[0] - this.cx) * this.s, BOARD_CY + (p[1] - this.cy) * this.s];
  }

  private P(pose: Pose, id: string): [number, number] | null {
    const p = pose.pts[id];
    return p ? this.W(p) : null;
  }

  private computeFrame(def: MechanismDef, sw: Sweep): void {
    const b = { ...sw.bounds };
    const p0 = sw.poses[0];
    const grow = (x: number, y: number, r = 0): void => {
      b.minX = Math.min(b.minX, x - r);
      b.maxX = Math.max(b.maxX, x + r);
      b.minY = Math.min(b.minY, y - r);
      b.maxY = Math.max(b.maxY, y + r);
    };
    for (const r of def.rails ?? []) {
      grow(r.p[0] + r.dir[0] * r.min, r.p[1] + r.dir[1] * r.min);
      grow(r.p[0] + r.dir[0] * r.max, r.p[1] + r.dir[1] * r.max);
    }
    for (const d of def.decor ?? []) {
      const a = p0?.pts[d.a];
      if (!a) continue;
      if (d.kind === 'wheel') grow(a[0], a[1], d.size);
      else if (d.kind === 'tire') grow(a[0], a[1], d.size * 0.6);
    }
    const bw = Math.max(b.maxX - b.minX, 1e-3);
    const bh = Math.max(b.maxY - b.minY, 1e-3);
    // 아래쪽에는 고정 받침 기호(약 0.65)가 내려오므로 그만큼 여유를 두고 조금 위로 올린다
    const s = Math.min((8.0 - 0.6) / bw, (4.8 - 0.6 - 0.7) / bh, 1.6);
    this.s = Math.max(s, 1e-3);
    this.cx = (b.minX + b.maxX) / 2;
    this.cy = (b.minY + b.maxY) / 2 - 0.35 / this.s;
  }

  // ───────────────────────── 기구 만들기 ─────────────────────────

  load(def: MechanismDef, sw: Sweep): void {
    this.clearMech();
    this.def = def;
    this.computeFrame(def, sw);
    this.buildGrid();
    const p0 = sw.poses[0];
    if (!p0) return; // 조립 불가(직접 만들기): setGap으로 그린다
    this.gapG.visible = false;
    this.mechG.visible = true;

    // 재질(역할별로 한 벌)
    const mats: Record<Role, THREE.Material> = {
      input: paint(CATEGORY_COLORS.power),
      output: paint(CATEGORY_COLORS.shaft),
      coupler: aluminum(),
      link: aluminum(),
      ground: darkSteel()
    };
    this.roleMats = { ground: [mats.ground], input: [mats.input], coupler: [mats.coupler], output: [mats.output], link: [mats.link] };
    const pinMat = chrome();
    const headMat = brass();
    const ironMat = castIron();
    const boltMat = steel();
    const rubberMat = rubber();
    const darkMat = darkSteel();

    // 조인트에 붙은 층 모으기 (핀 길이를 정한다)
    const info = new Map<string, JointInfo>();
    const touch = (id: string, layer: number, half = BAR_T / 2): void => {
      const z = zOf(layer);
      const cur = info.get(id);
      if (!cur) info.set(id, { lo: z - half, hi: z + half });
      else {
        cur.lo = Math.min(cur.lo, z - half);
        cur.hi = Math.max(cur.hi, z + half);
      }
    };
    const fixed = new Set<string>();
    for (const st of def.steps) if (st.k === 'fix') fixed.add(st.id);
    const underDecor = new Set<string>();
    for (const d of def.decor ?? []) if (d.kind === 'wheel' || d.kind === 'tire') underDecor.add(d.a);
    const slotBar = def.bars.find((b) => b.slot);
    for (const b of def.bars) {
      touch(b.a, b.layer);
      touch(b.b, b.layer);
      for (const v of b.via ?? []) touch(v, b.layer);
    }
    for (const pl of def.plates ?? []) for (const id of pl.pts) touch(id, pl.layer);
    for (const r of def.rails ?? []) touch(r.at, r.layer, BODY_T / 2);
    for (const d of def.decor ?? []) if (d.kind === 'slotBlock' && slotBar) touch(d.a, slotBar.layer);
    if (!info.has(def.handle) && p0.pts[def.handle]) touch(def.handle, 0);

    // 막대
    for (const bar of def.bars) this.addBar(bar, p0, mats[bar.role], def, sw);
    // 삼각 링크
    for (const pl of def.plates ?? []) this.addPlate(pl, p0, mats[pl.role]);
    // 레일·슬라이더
    for (const r of def.rails ?? []) this.addRail(r, p0, darkMat, ironMat, aluminum());
    // 장식
    for (const d of def.decor ?? []) this.addDecor(d, def, p0, rubberMat, darkMat, headMat);

    // 핀·받침
    let zTop = 0;
    for (const [id, inf] of info) {
      const p = p0.pts[id];
      if (!p) continue;
      const isFixed = fixed.has(id);
      const grp = new THREE.Group();
      const [x0, y0] = this.W(p);
      grp.position.set(x0, y0, 0);
      const stemLo = isFixed ? inf.lo - 0.02 : inf.lo - 0.012;
      mesh(cylZ(PIN_R, stemLo, inf.hi + 0.03, 32), pinMat, grp);
      mesh(cylZ(HEAD_R, inf.hi + 0.0, inf.hi + 0.03, 40), headMat, grp);
      if (!isFixed) mesh(cylZ(HEAD_R * 0.9, stemLo, stemLo + 0.014, 40), headMat, grp); // 아래쪽 와셔
      zTop = Math.max(zTop, inf.hi + 0.03);
      if (isFixed) {
        // 받침 기호(바닥 선·빗금) + 브래킷 판 + 볼트 + 기둥
        const flip = y0 - 0.65 < BOARD_CY - BOARD_H / 2 + 0.05;
        const sym = mesh(groundSymbol(flip), ironMat, grp);
        sym.castShadow = false;
        mesh(cylZ(0.22, 0.03, 0.07, 40), ironMat, grp);
        if (!underDecor.has(id)) {
          for (let k = 0; k < 3; k++) {
            const a = (k / 3) * TAU + Math.PI / 6;
            const bolt = mesh(cylZ(0.03, 0.07, 0.092, 6), boltMat, grp);
            bolt.position.set(Math.cos(a) * 0.15, Math.sin(a) * 0.15, 0);
          }
        }
        mesh(cylZ(0.075, 0.07, Math.max(0.08, inf.lo - 0.0), 32), ironMat, grp);
      }
      this.mechG.add(grp);
      this.upd.push((pose) => {
        const w = this.P(pose, id);
        if (w) grp.position.set(w[0], w[1], 0);
      });
    }
    this.traceZ = zTop + 0.06;

    // 손잡이
    const hInfo = info.get(def.handle);
    if (hInfo && p0.pts[def.handle]) {
      const z0 = hInfo.hi + 0.03;
      this.handleZ = z0;
      const prof: V2[] = [[0, 0], [0.16, 0], [0.18, 0.02], [0.18, 0.07], [0.15, 0.11], [0.08, 0.13], [0, 0.135]];
      const kg = lathe(prof, 40);
      kg.rotateX(Math.PI / 2);
      const knob = new THREE.Group();
      mesh(kg, plastic(PALETTE.paintWhite, { roughness: 0.4 }), knob);
      const dot = new THREE.CylinderGeometry(0.05, 0.05, 0.012, 24, 1);
      dot.rotateX(Math.PI / 2);
      dot.translate(0, 0, 0.138);
      mesh(dot, rubber(), knob);
      const ringG = new THREE.TorusGeometry(0.27, 0.022, 12, 56);
      const ring = new THREE.Mesh(ringG, glow(PALETTE.paintYellow, 1.4));
      ring.position.z = 0.05;
      ring.userData.noAO = true;
      ring.onBeforeRender = (): void => {
        const k = 0.5 + 0.5 * Math.sin(performance.now() / 280);
        ring.scale.setScalar(1 + 0.12 * k);
        (ring.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.7 + 1.1 * k;
      };
      knob.add(ring);
      knob.position.z = z0;
      const hp = this.W(p0.pts[def.handle]!);
      knob.position.set(hp[0], hp[1], z0);
      this.mechG.add(knob);
      this.handleKnob = knob;
      this.upd.push((pose) => {
        const w = this.P(pose, def.handle);
        if (w) knob.position.set(w[0], w[1], z0);
      });
    }

    // 추적점 표시 + 자취
    def.trace.forEach((tp, i) => {
      if (!p0.pts[tp.id]) return;
      const mk = new THREE.Mesh(new THREE.SphereGeometry(i === 0 ? 0.085 : 0.07, 24, 16), glow(CATEGORY_COLORS.joining, 1.1));
      mk.castShadow = true;
      mk.userData.noAO = true;
      this.mechG.add(mk);
      const trace = new Trace(CATEGORY_COLORS.joining, i === 0 ? 3.4 : 2.6, i === 0 ? 1 : 0.85);
      this.traceG.add(trace.object);
      this.traces.push({ id: tp.id, trace });
      this.upd.push((pose) => {
        const w = this.P(pose, tp.id);
        if (w) mk.position.set(w[0], w[1], this.traceZ);
      });
    });

    // 막힘 표시
    const fm = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.03, 12, 48), glow(PALETTE.paintRed, 1.6));
    fm.userData.noAO = true;
    fm.visible = false;
    fm.onBeforeRender = (): void => {
      fm.scale.setScalar(1 + 0.15 * (0.5 + 0.5 * Math.sin(performance.now() / 200)));
    };
    this.mechG.add(fm);
    this.failMark = fm;

    this.lastPose = p0;
    this.applyPose(p0);
  }

  private addBar(bar: Bar, p0: Pose, mat: THREE.Material, def: MechanismDef, sw: Sweep): void {
    const pa = p0.pts[bar.a];
    const pb = p0.pts[bar.b];
    if (!pa || !pb) return;
    const [ax, ay] = this.W(pa);
    const [bx, by] = this.W(pb);
    const len = Math.max(Math.hypot(bx - ax, by - ay), 1e-3);
    const ux = (bx - ax) / len;
    const uy = (by - ay) / len;
    const holes = [0, len];
    for (const v of bar.via ?? []) {
      const pv = p0.pts[v];
      if (!pv) continue;
      const [vx, vy] = this.W(pv);
      holes.push((vx - ax) * ux + (vy - ay) * uy);
    }
    let slot: { x0: number; x1: number } | undefined;
    let blockJoint: string | undefined;
    if (bar.slot) {
      blockJoint = (def.decor ?? []).find((d) => d.kind === 'slotBlock')?.a;
      if (blockJoint) {
        let lo = Infinity;
        let hi = -Infinity;
        for (const ps of sw.poses) {
          const a = this.P(ps, bar.a);
          const b = this.P(ps, bar.b);
          const j = this.P(ps, blockJoint);
          if (!a || !b || !j) continue;
          const l = Math.max(Math.hypot(b[0] - a[0], b[1] - a[1]), 1e-6);
          const x = ((j[0] - a[0]) * (b[0] - a[0]) + (j[1] - a[1]) * (b[1] - a[1])) / l;
          lo = Math.min(lo, x);
          hi = Math.max(hi, x);
        }
        if (Number.isFinite(lo)) slot = { x0: lo, x1: Math.max(hi, lo + 0.02) };
      }
      if (!slot) slot = { x0: len * 0.3, x1: len * 0.85 };
    }
    const m = new THREE.Mesh(barGeometry(len, holes, bar.slot ? 0.14 : BAR_HW, slot), mat);
    m.castShadow = true;
    m.receiveShadow = true;
    const z = zOf(bar.layer);
    m.position.set(ax, ay, z);
    m.rotation.z = Math.atan2(uy, ux);
    this.mechG.add(m);
    let block: THREE.Mesh | null = null;
    if (bar.slot && blockJoint) {
      block = mesh(extrude(roundedRect(-0.1, -0.075, 0.1, 0.075, 0.03), BAR_T + 0.012, 0.006, 8, 1), brass());
      m.add(block);
    }
    const bj = blockJoint;
    this.upd.push((pose) => {
      const a = this.P(pose, bar.a);
      const b = this.P(pose, bar.b);
      if (!a || !b) return;
      m.position.set(a[0], a[1], z);
      m.rotation.z = Math.atan2(b[1] - a[1], b[0] - a[0]);
      if (block && bj) {
        const j = this.P(pose, bj);
        if (j) {
          const l = Math.max(Math.hypot(b[0] - a[0], b[1] - a[1]), 1e-6);
          block.position.set(((j[0] - a[0]) * (b[0] - a[0]) + (j[1] - a[1]) * (b[1] - a[1])) / l, 0, 0);
        }
      }
    });
  }

  private addPlate(pl: Plate, p0: Pose, mat: THREE.Material): void {
    const [i0, i1, i2] = pl.pts;
    const q0 = p0.pts[i0];
    const q1 = p0.pts[i1];
    const q2 = p0.pts[i2];
    if (!q0 || !q1 || !q2) return;
    const w0 = this.W(q0);
    const w1 = this.W(q1);
    const w2 = this.W(q2);
    const ang = Math.atan2(w1[1] - w0[1], w1[0] - w0[0]);
    const c = Math.cos(-ang);
    const s = Math.sin(-ang);
    const loc = (w: [number, number]): Vec2 => [(w[0] - w0[0]) * c - (w[1] - w0[1]) * s, (w[0] - w0[0]) * s + (w[1] - w0[1]) * c];
    const m = new THREE.Mesh(plateGeometry([[0, 0], loc(w1), loc(w2)]), mat);
    m.castShadow = true;
    m.receiveShadow = true;
    const z = zOf(pl.layer);
    m.position.set(w0[0], w0[1], z);
    m.rotation.z = ang;
    this.mechG.add(m);
    this.upd.push((pose) => {
      const a = this.P(pose, i0);
      const b = this.P(pose, i1);
      if (!a || !b) return;
      m.position.set(a[0], a[1], z);
      m.rotation.z = Math.atan2(b[1] - a[1], b[0] - a[0]);
    });
  }

  private addRail(r: Rail, p0: Pose, wallMat: THREE.Material, capMat: THREE.Material, bodyMat: THREE.Material): void {
    const S = this.s;
    const ang = Math.atan2(r.dir[1], r.dir[0]);
    const origin = this.W(r.p);
    const z = zOf(r.layer);
    const x0 = r.min * S;
    const x1 = r.max * S;
    const fixedG = new THREE.Group();
    fixedG.position.set(origin[0], origin[1], 0);
    fixedG.rotation.z = ang;
    const geos: THREE.BufferGeometry[] = [];
    const box = (xa: number, xb: number, ya: number, yb: number, t: number): THREE.BufferGeometry => {
      const g = extrude(roundedRect(xa, ya, xb, yb, Math.min(0.02, (xb - xa) / 2.5, (yb - ya) / 2.5)), t, 0.006, 6, 1);
      g.translate(0, 0, z);
      return g;
    };
    const body = new THREE.Group();
    const bodyGeos: THREE.BufferGeometry[] = [];
    if (r.style === 'piston') {
      // 실린더: 양쪽 벽 + 닫힌 끝(바깥쪽 끝) + 피스톤
      const hw = 0.3;
      geos.push(box(x0 - 0.1, x1 + 0.1, hw, hw + 0.07, 0.06), box(x0 - 0.1, x1 + 0.1, -hw - 0.07, -hw, 0.06), box(x1 + 0.1, x1 + 0.2, -hw - 0.07, hw + 0.07, 0.06));
      bodyGeos.push(extrude(roundedRect(-0.32, -hw + 0.015, 0.32, hw - 0.015, 0.04), BODY_T, 0.01, 8, 1));
      const ringG = extrude(roundedRect(0.1, -hw + 0.012, 0.15, hw - 0.012, 0.01), BODY_T + 0.016, 0.004, 4, 1);
      bodyGeos.push(ringG);
    } else if (r.style === 'ram') {
      // 안내 레일 + 램(끝에 깎는 날)
      const hw = 0.22;
      geos.push(box(x0 - 0.5, x1 + 0.5, hw + 0.0, hw + 0.06, 0.06), box(x0 - 0.5, x1 + 0.5, -hw - 0.06, -hw, 0.06));
      geos.push(box(x0 - 0.56, x0 - 0.44, -hw - 0.06, hw + 0.06, 0.08), box(x1 + 0.44, x1 + 0.56, -hw - 0.06, hw + 0.06, 0.08));
      bodyGeos.push(extrude(roundedRect(-0.5, -hw + 0.012, 0.5, hw - 0.012, 0.03), BODY_T, 0.01, 8, 1));
      const tool = new THREE.Shape();
      tool.moveTo(-0.5, -hw + 0.012);
      tool.lineTo(-0.2, -hw + 0.012);
      tool.lineTo(-0.5, -hw - 0.3);
      tool.closePath();
      bodyGeos.push(extrude(tool, BODY_T - 0.01, 0.006, 4, 1));
    } else {
      // 안내 홈 + 밀대
      const hw = 0.17;
      const xs = x0 - 1.5;
      geos.push(box(xs, x1 + 0.2, hw, hw + 0.05, 0.06), box(xs, x1 + 0.2, -hw - 0.05, -hw, 0.06), box(xs - 0.1, xs, -hw - 0.05, hw + 0.05, 0.06));
      bodyGeos.push(extrude(roundedRect(-1.4, -0.075, 0.0, 0.075, 0.03), BODY_T - 0.012, 0.008, 8, 1));
      bodyGeos.push(extrude(roundedRect(-0.1, -hw + 0.012, 0.18, hw - 0.012, 0.04), BODY_T, 0.01, 8, 1));
    }
    const walls = mesh(merge(geos), wallMat, fixedG);
    walls.castShadow = true;
    void capMat;
    this.mechG.add(fixedG);
    const bm = mesh(merge(bodyGeos.map((g) => g.translate(0, 0, z))), bodyMat, body);
    bm.castShadow = true;
    this.mechG.add(body);
    body.rotation.z = ang;
    const cur = p0.pts[r.at] ? this.W(p0.pts[r.at]!) : origin;
    body.position.set(cur[0], cur[1], 0);
    this.upd.push((pose) => {
      const w = this.P(pose, r.at);
      if (w) body.position.set(w[0], w[1], 0);
    });
  }

  private layerOfJoint(def: MechanismDef, id: string): number {
    for (const b of def.bars) if (b.a === id || b.b === id || b.via?.includes(id)) return b.layer;
    for (const p of def.plates ?? []) if (p.pts.includes(id)) return p.layer;
    return 0;
  }

  private addDecor(d: Decor, def: MechanismDef, p0: Pose, rubberMat: THREE.Material, darkMat: THREE.Material, headMat: THREE.Material): void {
    const S = this.s;
    const pa = p0.pts[d.a];
    if (!pa) return;
    const wa = this.W(pa);
    if (d.kind === 'wheel') {
      const R = d.size * S;
      const g = new THREE.Group();
      mesh(wheelGeometry(R), darkMat, g);
      const pb = d.b ? p0.pts[d.b] : undefined;
      if (pb) {
        const wb = this.W(pb);
        const rb = Math.hypot(wb[0] - wa[0], wb[1] - wa[1]);
        const boss = mesh(cylZ(0.14, -0.034, 0.034, 32), headMat, g);
        boss.position.set(rb, 0, 0);
      }
      g.position.set(wa[0], wa[1], 0.095);
      this.mechG.add(g);
      const bid = d.b;
      this.upd.push((pose) => {
        const a = this.P(pose, d.a);
        const b = bid ? this.P(pose, bid) : null;
        if (a) g.position.set(a[0], a[1], 0.095);
        if (a && b) g.rotation.z = Math.atan2(b[1] - a[1], b[0] - a[0]);
      });
    } else if (d.kind === 'tire') {
      const { tire, rim } = tireGeometry(d.size * S);
      const g = new THREE.Group();
      mesh(tire, rubberMat, g);
      mesh(rim, steel(), g);
      g.position.set(wa[0], wa[1], 0.095);
      this.mechG.add(g);
      const bid = d.b;
      const neutral = d.ang ?? 0;
      this.upd.push((pose) => {
        const a = this.P(pose, d.a);
        const b = bid ? this.P(pose, bid) : null;
        if (a) g.position.set(a[0], a[1], 0.095);
        if (a && b) g.rotation.z = Math.atan2(b[1] - a[1], b[0] - a[0]) - neutral;
      });
    } else if (d.kind === 'blade') {
      const pb = d.b ? p0.pts[d.b] : undefined;
      if (!pb || !d.b) return;
      const wb = this.W(pb);
      const len = Math.max(Math.hypot(wb[0] - wa[0], wb[1] - wa[1]), 1e-3);
      const layer = this.layerOfJoint(def, d.b);
      const z = zOf(layer);
      const m = mesh(extrude(roundedRect(0, BAR_HW - 0.006, len, BAR_HW + 0.08, 0.03), 0.06, 0.008, 8, 1), rubberMat);
      m.position.set(wa[0], wa[1], z);
      this.mechG.add(m);
      const bid = d.b;
      this.upd.push((pose) => {
        const a = this.P(pose, d.a);
        const b = this.P(pose, bid);
        if (!a || !b) return;
        m.position.set(a[0], a[1], z);
        m.rotation.z = Math.atan2(b[1] - a[1], b[0] - a[0]);
      });
    } else if (d.kind === 'floor') {
      const minY = this.W([0, d.size])[1]; // size = 바닥 선의 y 좌표(기구 좌표)
      const y = minY - BAR_HW - 0.02;
      const halfW = BOARD_W / 2 - 0.3;
      const geos: THREE.BufferGeometry[] = [slab(-halfW, y - 0.03, halfW, y - 0.03, 0.06, 0.05, 0.06)];
      for (let x = -halfW + 0.15; x < halfW; x += 0.3) geos.push(slab(x, y - 0.06, x - 0.14, y - 0.2, 0.035, 0.04, 0.06));
      const m = mesh(merge(geos), darkMat);
      m.castShadow = false;
      this.mechG.add(m);
    } else if (d.kind === 'jawPad') {
      const layer = (def.plates ?? []).find((p) => p.pts.includes(d.a))?.layer ?? this.layerOfJoint(def, d.a);
      const z = zOf(layer);
      const g = new THREE.Group();
      const pad = mesh(extrude(roundedRect(0.09, -0.19, 0.27, 0.19, 0.04), BODY_T, 0.01, 8, 1), rubberMat);
      g.add(pad);
      g.position.set(wa[0], wa[1], z);
      this.mechG.add(g);
      const bid = d.b;
      const extra = d.ang ?? 0;
      this.upd.push((pose) => {
        const a = this.P(pose, d.a);
        const b = bid ? this.P(pose, bid) : null;
        if (!a) return;
        g.position.set(a[0], a[1], z);
        if (b) g.rotation.z = Math.atan2(a[1] - b[1], a[0] - b[0]) + extra;
      });
    }
    // slotBlock 은 addBar 에서 홈 막대 위에 올린다
  }

  // ───────────────────────── 자세·자취 ─────────────────────────

  private applyPose(pose: Pose): void {
    for (const u of this.upd) u(pose);
  }

  setPose(pose: Pose): void {
    if (!this.def) return;
    if (!pose.ok) {
      if (this.failMark && this.lastPose && pose.failAt) {
        const w = this.P(this.lastPose, pose.failAt);
        if (w) {
          this.failMark.position.set(w[0], w[1], this.traceZ + 0.05);
          this.failMark.visible = true;
        }
      }
      return;
    }
    if (this.failMark) this.failMark.visible = false;
    this.lastPose = pose;
    this.applyPose(pose);
    for (const t of this.traces) {
      const w = this.P(pose, t.id);
      if (w) t.trace.push(w[0], w[1], this.traceZ);
    }
  }

  setTrace(visible: boolean): void {
    this.traceG.visible = visible;
  }

  clearTrace(): void {
    for (const t of this.traces) t.trace.clear();
  }

  setFullPath(sw: Sweep | null): void {
    clearGroup(this.fullG);
    if (!sw || !this.def || sw.poses.length < 2) return;
    this.def.trace.forEach((tp, i) => {
      const pts: number[] = [];
      for (const ps of sw.poses) {
        const w = this.P(ps, tp.id);
        if (w) pts.push(w[0], w[1], this.traceZ - 0.012);
      }
      if (sw.full && pts.length >= 6) pts.push(pts[0]!, pts[1]!, pts[2]!);
      if (pts.length >= 6) this.fullG.add(pathLine(pts, CATEGORY_COLORS.joining, i === 0 ? 3 : 2.4, 0.25));
    });
  }

  setRoleHighlight(role: Role | null): void {
    for (const r of ROLES) {
      const dim = role !== null && r !== role;
      for (const m of this.roleMats[r]) {
        m.transparent = dim;
        m.opacity = dim ? 0.22 : 1;
        m.needsUpdate = true;
      }
    }
  }

  setGuide(line: { p: Vec2; dir: Vec2 } | null): void {
    clearGroup(this.guideG);
    if (!line || !this.def) return;
    const P = this.W(line.p);
    const len = Math.hypot(line.dir[0], line.dir[1]) || 1;
    const dx = line.dir[0] / len;
    const dy = line.dir[1] / len;
    const xr: [number, number] = [-BOARD_W / 2 + 0.3, BOARD_W / 2 - 0.3];
    const yr: [number, number] = [BOARD_CY - BOARD_H / 2 + 0.3, BOARD_CY + BOARD_H / 2 - 0.3];
    let t0 = -100;
    let t1 = 100;
    const clip = (p: number, d: number, lo: number, hi: number): void => {
      if (Math.abs(d) < 1e-9) return;
      const a = (lo - p) / d;
      const b = (hi - p) / d;
      t0 = Math.max(t0, Math.min(a, b));
      t1 = Math.min(t1, Math.max(a, b));
    };
    clip(P[0], dx, xr[0], xr[1]);
    clip(P[1], dy, yr[0], yr[1]);
    if (t1 <= t0) return;
    this.guideG.add(dashedLine([P[0] + dx * t0, P[1] + dy * t0, 0.025, P[0] + dx * t1, P[1] + dy * t1, 0.025], 0x2f3b4c, 2));
  }

  // ───────────────────────── 직접 만들기 전용 그림 ─────────────────────────

  setRange(min: number, max: number, full: boolean): void {
    clearGroup(this.rangeG);
    const def = this.def;
    const pose = this.lastPose;
    if (!def || !pose) return;
    const cr = def.steps.find((st) => st.k === 'crank');
    if (!cr || cr.k !== 'crank') return;
    const c = this.P(pose, cr.o);
    if (!c) return;
    const R = cr.r * this.s + 0.28;
    const z = 0.04;
    if (full) {
      const disc = new THREE.Mesh(new THREE.CircleGeometry(R, 64), ghost(CATEGORY_COLORS.power, 0.14));
      disc.position.set(c[0], c[1], z);
      disc.userData.noAO = true;
      this.rangeG.add(disc);
      return;
    }
    const span = Math.max(0.001, Math.min(TAU, max - min));
    const ok = new THREE.Mesh(new THREE.CircleGeometry(R, 64, min, span), ghost(CATEGORY_COLORS.power, 0.3));
    ok.position.set(c[0], c[1], z);
    ok.userData.noAO = true;
    this.rangeG.add(ok);
    if (span < TAU - 0.001) {
      const hatch = ghost(0x4a5666, 0.4);
      const tex = hatchTexture();
      tex.repeat.set(R * 1.4, R * 1.4);
      hatch.map = tex;
      hatch.alphaTest = 0.05;
      const no = new THREE.Mesh(new THREE.CircleGeometry(R, 64, max, TAU - span), hatch);
      no.position.set(c[0], c[1], z + 0.002);
      no.userData.noAO = true;
      this.rangeG.add(no);
    }
  }

  setGap(a: number, b: number, c: number, d: number): void {
    clearGroup(this.gapG);
    this.mechG.visible = false;
    this.gapG.visible = true;
    clearGroup(this.rangeG);
    clearGroup(this.guideG);
    const items = [
      { n: 'a', len: a, role: 'input' as Role },
      { n: 'b', len: b, role: 'coupler' as Role },
      { n: 'c', len: c, role: 'output' as Role },
      { n: 'd', len: d, role: 'ground' as Role }
    ];
    const base = items.reduce((m, it) => (it.len > m.len ? it : m), items[0]!);
    const chain = items.filter((it) => it !== base);
    const sum = chain.reduce((t, it) => t + it.len, 0);
    const gap = base.len - sum;
    const s = Math.min(7.6 / Math.max(base.len, sum, 1), 1.4);
    const x0 = -(Math.max(base.len, sum) * s) / 2;
    const yBase = 2.2;
    const yChain = 3.7;
    const gz = (layer: number): number => zOf(layer);
    const mats: Record<Role, THREE.Material> = { input: paint(CATEGORY_COLORS.power), output: paint(CATEGORY_COLORS.shaft), coupler: aluminum(), link: aluminum(), ground: darkSteel() };
    const pinMat = chrome();
    const headMat = brass();
    const addBar = (x: number, y: number, len: number, role: Role, layer: number): void => {
      const L = len * s;
      const m = new THREE.Mesh(barGeometry(L, [0, L]), mats[role]);
      m.castShadow = true;
      m.receiveShadow = true;
      m.position.set(x, y, gz(layer));
      this.gapG.add(m);
    };
    const addPin = (x: number, y: number): void => {
      const grp = new THREE.Group();
      grp.position.set(x, y, 0);
      mesh(cylZ(PIN_R, gz(0) - 0.03, gz(0) + 0.055, 32), pinMat, grp);
      mesh(cylZ(HEAD_R, gz(0) + 0.025, gz(0) + 0.055, 40), headMat, grp);
      this.gapG.add(grp);
    };
    const label = (text: string, x: number, y: number, w: number): void => {
      const { tex, aspect } = labelTexture(text, '#1b2430');
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
      sp.scale.set(w, w / aspect, 1);
      sp.position.set(x, y, 0.5);
      sp.userData.noAO = true;
      this.gapG.add(sp);
    };
    // 기준 막대(가장 긴 링크)
    addBar(x0, yBase, base.len, base.role, 0);
    addPin(x0, yBase);
    addPin(x0 + base.len * s, yBase);
    label(`${base.n}  ${base.len}`, x0 + (base.len * s) / 2, yBase - 0.5, 1.5);
    // 나머지 셋을 한 줄로 이어 붙임
    let x = x0;
    chain.forEach((it, i) => {
      addBar(x, yChain, it.len, it.role, i % 2);
      addPin(x, yChain);
      label(`${it.n}  ${it.len}`, x + (it.len * s) / 2, yChain + 0.42, 1.3);
      x += it.len * s;
    });
    addPin(x, yChain);
    // 모자라는 길이: 점선 + 숫자
    const xe = x0 + base.len * s;
    const z = 0.05;
    const col = 0xd8362f;
    if (gap > 1e-6) {
      this.gapG.add(dashedLine([x, yChain, z, xe, yChain, z], col, 3, 0.1, 0.08));
      this.gapG.add(dashedLine([xe, yChain, z, xe, yBase, z], col, 2, 0.08, 0.07));
      label(`틈 ${Math.round(gap * 100) / 100}`, (x + xe) / 2, yChain + 0.45, 1.5);
    } else {
      this.gapG.add(dashedLine([xe, yChain, z, xe, yBase, z], col, 2, 0.08, 0.07));
      label(gap < -1e-6 ? `겹침 ${Math.round(-gap * 100) / 100}` : '딱 맞음', (x + xe) / 2, yChain + 0.45, 1.5);
    }
  }

  // ───────────────────────── 화면·입력 연동 ─────────────────────────

  boardPoint(ray: THREE.Ray, out: THREE.Vector2): boolean {
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -this.handleZ);
    const hit = ray.intersectPlane(plane, new THREE.Vector3());
    if (!hit) return false;
    out.set(hit.x / this.s + this.cx, (hit.y - BOARD_CY) / this.s + this.cy);
    return true;
  }

  handleWorld(out: THREE.Vector3): THREE.Vector3 {
    if (this.handleKnob) {
      out.copy(this.handleKnob.position);
      out.z += 0.1;
    } else out.set(0, BOARD_CY, 0.4);
    return this.root.localToWorld(out);
  }

  jointWorld(id: string, out: THREE.Vector3): boolean {
    if (!this.lastPose) return false;
    const w = this.P(this.lastPose, id);
    if (!w) return false;
    out.set(w[0], w[1], this.traceZ);
    this.root.localToWorld(out);
    return true;
  }

  view(tilt: boolean, aspect: number): CameraView {
    const fov = 40 * DEG;
    const th = Math.tan(fov / 2);
    const halfH = BOARD_H / 2 + 0.35;
    const halfW = BOARD_W / 2 + 0.25;
    let dist = Math.max(halfH / th, halfW / (th * Math.max(aspect, 0.2))) * 1.02;
    const target: [number, number, number] = [0, BOARD_CY - 0.1, 0.1];
    if (!tilt) return { pos: [0, BOARD_CY - 0.1, dist], target };
    dist *= 1.12;
    const az = 30 * DEG;
    const el = 24 * DEG;
    return {
      pos: [target[0] + dist * Math.sin(az) * Math.cos(el), target[1] + dist * Math.sin(el), target[2] + dist * Math.cos(az) * Math.cos(el)],
      target
    };
  }

  // ───────────────────────── 정리 ─────────────────────────

  private clearMech(): void {
    clearGroup(this.mechG);
    clearGroup(this.rangeG);
    clearGroup(this.gapG);
    clearGroup(this.fullG);
    clearGroup(this.guideG);
    clearGroup(this.gridG);
    for (const t of this.traces) {
      this.traceG.remove(t.trace.object);
      t.trace.dispose();
    }
    this.traces = [];
    this.upd = [];
    this.failMark = null;
    this.handleKnob = null;
    this.lastPose = null;
    this.gapG.visible = false;
    this.mechG.visible = true;
    this.setRoleHighlightReset();
  }

  private setRoleHighlightReset(): void {
    this.roleMats = { ground: [], input: [], coupler: [], output: [], link: [] };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clearMech();
    clearGroup(this.boardG);
    this.root.removeFromParent();
  }
}

// 쓰이지 않는 import 방지용(타입 전용)
export type { Bar, Plate, Rail, Decor };
