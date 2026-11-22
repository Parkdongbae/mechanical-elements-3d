// 뉴커먼의 대기압 기관 — 기관실(벽돌), 보일러, 위가 열린 실린더, 흔들보(아치 머리 + 사슬), 광산 펌프 막대, 찬물 분사.
// 흔들보 양 끝은 회전 중심을 중심으로 하는 원호(아치 머리)이고 사슬이 그 원호에 감겨 수직으로 내려간다.
// 그래서 피스톤 막대·펌프 막대는 정확히 수직으로 움직이고, 감긴 길이 + 늘어진 길이 = 사슬 전체 길이가 늘 일정하다.

import * as THREE from 'three';
import { annularSector, extrude, mesh, type V2 } from '../../models/parts/geom';
import { castIron, copper, darkSteel, plastic, steel, wood, ghost, brass } from '../../models/materials';
import {
  COL,
  Fire,
  Player,
  ValveMark,
  aimArrow,
  arrow,
  box,
  brickMat,
  clamp01,
  cutMat,
  cutSolid,
  cutVolume,
  cyl,
  fadeGroup,
  flange,
  pipe,
  smooth,
  stoneMat,
  v3,
  type Seg,
  type SteamModel,
  type ValveInfo
} from './common';
import { FlowPath, Particles } from './particles';

const CX = -1.7; // 보일러·실린더 축
const PIV = new THREE.Vector2(-0.2, 3.75);
const R = 1.5; // 사슬이 감기는 원호 반지름(= 회전 중심에서 막대까지 수평 거리)
const WRAP0 = 0.32; // 가운데 자세에서 원호에 감긴 각도
const STROKE = 0.72;
const PUMP_X = PIV.x + R;
const CYL_FLOOR = 1.66;
const CYL_RI = 0.4;
const PISTON_H = 0.12;
const P_BOTTOM0 = 1.7;
const ROD_L = 0.7;
const PUMP_MID = 2.55;
const GAP = 2.1;
const DIR = 0.35;

/** 단계별 재생 구간(u: 한 사이클 0~1). null = 사이클 전체 연속 재생 */
export const NEWCOMEN_SEGS: (Seg | null)[] = [null, { a: 0, b: 0.285, dur: 3.2 }, { a: 0.3, b: 0.42, dur: 1.8 }, { a: 0.43, b: 0.545, dur: 2.6 }, { a: 0.565, b: 1, dur: 3.8 }, null];

/** 피스톤 높이(0 바닥 ~ 1 꼭대기) */
function pistonS(u: number): number {
  if (u < 0.03) return 0;
  if (u < 0.28) return smooth((u - 0.03) / 0.25);
  if (u < 0.58) return 1;
  if (u < 0.84) {
    const k = (u - 0.58) / 0.26;
    return 1 - k * k;
  }
  return 0;
}

export class NewcomenModel implements SteamModel {
  readonly root = new THREE.Group();
  private player = new Player();
  private stage = 0;
  private beam = new THREE.Group();
  private piston = new THREE.Group();
  private pumpRod: THREE.Mesh;
  private chainL: THREE.InstancedMesh;
  private chainR: THREE.InstancedMesh;
  private steamVol: THREE.Group;
  private steamMat: THREE.MeshStandardMaterial;
  private pool: THREE.Group;
  private airArrows = new THREE.Group();
  private weightArrow: THREE.Group;
  private liftArrow: THREE.Group;
  private steamLever: THREE.Mesh;
  private injLever: THREE.Mesh;
  private steamMark: ValveMark;
  private injMark: ValveMark;
  private fire: Fire;
  private parts = new Particles(1500);
  private flows: { steam: FlowPath; inj: FlowPath; pump: FlowPath };
  private u = 0;
  private theta = 0;
  private err = 0;
  private acc = { bub: 0, steam: 0, spray: 0, smoke: 0, water: 0 };
  private dummy = new THREE.Object3D();
  private airK = 0;
  private wK = 0;
  private lK = 0;
  private chainLen: [number, number] = [0, 0];

  constructor() {
    const root = this.root;
    const brick = brickMat();
    const stone = stoneMat();
    const iron = castIron();
    const dark = darkSteel();
    const cut = cutMat();
    const timber = wood(0x8a5a33);
    const timberDark = wood(0x6b4426);

    // ── 기관실 ──
    box(root, stone, -2.85, 0, -1.3, 0.05, 0.04, 0.95);
    box(root, brick, -2.85, 0.04, -1.3, 0.02, 3.48, -1.0); // 뒷벽
    box(root, brick, -2.85, 0.04, -1.0, -2.55, 3.48, 0.9); // 왼쪽 벽
    box(root, brick, -0.42, 0.04, -1.0, 0.02, 3.48, 0.9); // 흔들보 벽(밥 월)
    box(root, stone, -0.48, 3.42, -1.06, 0.08, 3.5, 0.96);
    box(root, stone, -2.91, 3.42, -1.36, 0.08, 3.5, -0.94);
    box(root, stone, -2.91, 3.42, -1.0, -2.49, 3.5, 0.96);
    // 굴뚝
    box(root, brick, -2.85, 0, -1.78, -2.3, 4.55, -1.3);
    box(root, stone, -2.9, 4.5, -1.83, -2.25, 4.62, -1.25);
    // 실린더를 받치는 들보(왼쪽 벽 ↔ 밥 월)
    box(root, timberDark, -2.55, 1.46, -0.56, -0.42, 1.6, -0.44);
    box(root, timberDark, -2.55, 1.46, 0.44, -0.42, 1.6, 0.56);

    // ── 화로·보일러 ──
    box(root, brick, -2.35, 0.04, -0.65, -1.05, 0.6, -0.5);
    box(root, brick, -2.35, 0.04, -0.5, -2.2, 0.6, 0.5);
    box(root, brick, -1.2, 0.04, -0.5, -1.05, 0.6, 0.5);
    const front = new THREE.Shape([new THREE.Vector2(-2.35, 0.04), new THREE.Vector2(-1.05, 0.04), new THREE.Vector2(-1.05, 0.6), new THREE.Vector2(-2.35, 0.6)]);
    const door = new THREE.Path();
    door.moveTo(-1.88, 0.08);
    door.lineTo(-1.52, 0.08);
    door.lineTo(-1.52, 0.28);
    door.absarc(-1.7, 0.28, 0.18, 0, Math.PI, false);
    door.lineTo(-1.88, 0.08);
    front.holes.push(door);
    const fw = mesh(extrude(front, 0.15, 0), brick, root);
    fw.position.z = 0.575;
    box(root, stone, -2.4, 0.6, -0.7, -1.0, 0.65, 0.7);
    this.fire = new Fire(0.8, 0.7, 0.45, 2.4);
    this.fire.group.position.set(CX, 0.06, 0);
    root.add(this.fire.group);

    const shell: V2[] = [[0, 0.65], [0.6, 0.65], [0.6, 1.05]];
    const inner: V2[] = [];
    for (let i = 1; i <= 10; i++) {
      const a = (i / 10) * (Math.PI / 2);
      shell.push([0.1 + 0.5 * Math.cos(a), 1.05 + 0.37 * Math.sin(a)]);
    }
    for (let i = 10; i >= 1; i--) {
      const a = (i / 10) * (Math.PI / 2);
      inner.push([0.1 + 0.47 * Math.cos(a), 1.05 + 0.34 * Math.sin(a)]);
    }
    const boilerProf: V2[] = [...shell, [0.1, 1.45], [0.07, 1.45], ...inner.map(([r, y]): V2 => [Math.max(0.07, r - 0.03), y]), [0.57, 1.05], [0.57, 0.68], [0, 0.68]];
    const boiler = cutSolid(boilerProf, GAP, DIR, copper(), cut);
    boiler.position.x = CX;
    root.add(boiler);
    const waterMat = ghost(COL.water, 0.5);
    const water = cutVolume(0.565, GAP, DIR, waterMat);
    water.position.set(CX, 0.68, 0);
    water.scale.y = 0.34;
    root.add(water);
    const boilSteam = ghost(COL.steam, 0.32);
    boilSteam.emissive = new THREE.Color(COL.steam);
    boilSteam.emissiveIntensity = 0.25;
    const domeVol: V2[] = [[0, 1.02], [0.565, 1.02], [0.565, 1.05]];
    for (let i = 1; i <= 8; i++) {
      const a = (i / 8) * (Math.PI / 2);
      domeVol.push([0.08 + 0.48 * Math.cos(a), 1.05 + 0.33 * Math.sin(a)]);
    }
    domeVol.push([0, 1.38]);
    const bs = cutSolid(domeVol, GAP, DIR, boilSteam, boilSteam, 32);
    bs.position.x = CX;
    bs.traverse((o) => (o.userData.noAO = true));
    root.add(bs);

    // 목(증기 밸브) — 보일러 꼭대기와 실린더 바닥 사이
    cyl(root, copper(), 0.085, 0.24, 'y', v3(CX, 1.5, 0));
    box(root, iron, CX - 0.13, 1.45, -0.1, CX + 0.13, 1.56, 0.1);
    const lever = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.28), steel());
    lever.geometry.translate(0, 0, 0.14);
    lever.position.set(CX + 0.06, 1.505, 0.1);
    lever.castShadow = true;
    root.add(lever);
    this.steamLever = lever;
    this.steamMark = new ValveMark(root, v3(CX + 0.06, 1.505, 0.4));

    // ── 실린더(위가 열림) ──
    const cylProf: V2[] = [[0, 1.6], [0.52, 1.6], [0.52, 1.66], [0.45, 1.66], [0.45, 2.69], [0.52, 2.69], [0.52, 2.75], [CYL_RI, 2.75], [CYL_RI, CYL_FLOOR], [0, CYL_FLOOR]];
    const cylinder = cutSolid(cylProf, GAP, DIR, iron, cut);
    cylinder.position.x = CX;
    root.add(cylinder);
    // 실린더 안의 증기
    this.steamMat = ghost(COL.steam, 0.7);
    this.steamMat.emissive = new THREE.Color(COL.steam);
    this.steamMat.emissiveIntensity = 0.35;
    this.steamVol = cutVolume(CYL_RI - 0.005, GAP, DIR, this.steamMat);
    this.steamVol.position.set(CX, CYL_FLOOR, 0);
    root.add(this.steamVol);
    this.pool = cutVolume(CYL_RI - 0.006, GAP, DIR, ghost(COL.cold, 0.75));
    this.pool.position.set(CX, CYL_FLOOR, 0);
    root.add(this.pool);

    // 피스톤 + 막대
    const pmat = iron;
    const pg = new THREE.CylinderGeometry(CYL_RI - 0.008, CYL_RI - 0.008, PISTON_H, 48);
    pg.translate(0, PISTON_H / 2, 0);
    mesh(pg, pmat, this.piston);
    const pack = new THREE.Mesh(new THREE.TorusGeometry(CYL_RI - 0.012, 0.012, 8, 48), plastic(0x3a2a1c));
    pack.rotation.x = Math.PI / 2;
    pack.position.y = PISTON_H * 0.7;
    this.piston.add(pack);
    const rodG = new THREE.CylinderGeometry(0.04, 0.04, ROD_L, 16);
    rodG.translate(0, PISTON_H + ROD_L / 2, 0);
    mesh(rodG, steel(), this.piston);
    const eye = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.012, 8, 16), dark);
    eye.position.y = PISTON_H + ROD_L + 0.02;
    this.piston.add(eye);
    this.piston.position.x = CX;
    root.add(this.piston);

    // 대기압 화살표(피스톤 위)
    for (let i = 0; i < 5; i++) {
      const a = arrow(COL.air, 0.36, 0.022);
      const ang = DIR + (i - 2) * 0.55;
      const rr = i === 2 ? 0.0 : 0.25;
      a.position.set(Math.sin(ang) * rr + (i === 2 ? 0.12 : 0), 0, Math.cos(ang) * rr + 0.1);
      a.userData.base = a.position.clone();
      this.airArrows.add(a);
    }
    this.airArrows.position.x = CX;
    root.add(this.airArrows);

    // ── 흔들보 ──
    const b = this.beam;
    b.position.set(PIV.x, PIV.y, 0);
    root.add(b);
    box(b, timber, -1.32, -0.15, -0.11, 1.32, 0.15, 0.11);
    for (const side of [-1, 1]) {
      const a0 = side < 0 ? Math.PI - 0.36 : -0.36;
      mesh(extrude(annularSector(R - 0.14, R - 0.02, a0, a0 + 0.72), 0.24, 0.01), timber, b);
      const sx = side * (R - 0.08) * Math.cos(0.36);
      const sy = (R - 0.08) * Math.sin(0.36);
      for (const sy2 of [sy, -sy]) {
        const p0 = new THREE.Vector2(sx, sy2);
        const p1 = new THREE.Vector2(side * 0.55, sy2 > 0 ? 0.13 : -0.13);
        const len = p0.distanceTo(p1);
        const st = new THREE.Mesh(new THREE.BoxGeometry(len, 0.09, 0.16), timberDark);
        st.position.set((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, 0);
        st.rotation.z = Math.atan2(p1.y - p0.y, p1.x - p0.x);
        st.castShadow = true;
        b.add(st);
      }
      // 쇠띠
      box(b, dark, side * 1.0 - 0.03, -0.16, -0.12, side * 1.0 + 0.03, 0.16, 0.12);
      box(b, dark, side * 0.4 - 0.03, -0.16, -0.12, side * 0.4 + 0.03, 0.16, 0.12);
    }
    cyl(b, steel(), 0.05, 0.6, 'z', v3(0, 0, 0));
    for (const z of [-0.22, 0.22]) box(root, iron, PIV.x - 0.14, 3.5, z - 0.06, PIV.x + 0.14, 3.72, z + 0.06);

    // 사슬
    const linkG = new THREE.TorusGeometry(0.026, 0.008, 6, 14);
    linkG.scale(1, 1.7, 1);
    this.chainL = new THREE.InstancedMesh(linkG, dark, 60);
    this.chainR = new THREE.InstancedMesh(linkG, dark, 60);
    for (const c of [this.chainL, this.chainR]) {
      c.castShadow = true;
      c.frustumCulled = false;
      root.add(c);
    }

    // ── 광산 쪽: 펌프 막대·갱도 ──
    const rodLen = PUMP_MID - 0.4;
    const prG = new THREE.BoxGeometry(0.1, rodLen, 0.1);
    prG.translate(0, -rodLen / 2, 0);
    this.pumpRod = mesh(prG, timber, root);
    this.pumpRod.position.x = PUMP_X;
    box(this.pumpRod, dark, -0.06, -0.06, -0.06, 0.06, 0, 0.06);
    for (let k = 1; k <= 3; k++) box(this.pumpRod, dark, -0.055, -k * 0.55 - 0.03, -0.055, 0.055, -k * 0.55 + 0.03, 0.055);
    const collar = cutSolid([[0.32, 0], [0.52, 0], [0.52, 0.28], [0.32, 0.28]], 0, 0, stone);
    collar.position.x = PUMP_X;
    root.add(collar);
    const pit = new THREE.Mesh(new THREE.CircleGeometry(0.32, 40), plastic(0x07090c, { roughness: 1 }));
    pit.rotation.x = -Math.PI / 2;
    pit.position.set(PUMP_X, 0.015, 0);
    root.add(pit);
    const main = castIron({ color: 0x4a4f55 });
    cyl(root, main, 0.1, 0.95, 'y', v3(PUMP_X, 0.47, 0));
    flange(root, main, v3(PUMP_X, 0.95, 0), 'y', 0.14);
    pipe([v3(PUMP_X, 0.8, 0), v3(PUMP_X + 0.34, 0.8, 0)], 0.06, main, root);
    // 물받이 홈통
    const trough = new THREE.Group();
    trough.position.set(PUMP_X + 0.85, 0.36, 0);
    trough.rotation.z = -0.04;
    root.add(trough);
    box(trough, timber, -0.55, -0.04, -0.14, 0.75, 0, 0.14);
    box(trough, timber, -0.55, 0, -0.14, 0.75, 0.1, -0.11);
    box(trough, timber, -0.55, 0, 0.11, 0.75, 0.1, 0.14);
    box(trough, timber, -0.58, -0.04, -0.14, -0.55, 0.1, 0.14);
    const tw = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.04, 0.21), ghost(COL.water, 0.6));
    tw.position.set(0.1, 0.03, 0);
    tw.userData.noAO = true;
    trough.add(tw);
    for (const x of [-0.4, 0.55]) box(root, timberDark, PUMP_X + 0.85 + x - 0.04, 0, -0.04, PUMP_X + 0.85 + x + 0.04, 0.34, 0.04);

    // ── 찬물 통과 분사관 ──
    box(root, timberDark, -2.5, 2.78, -1.0, -2.42, 2.86, -0.6);
    box(root, timberDark, -2.0, 2.78, -1.0, -1.92, 2.86, -0.6);
    box(root, timber, -2.52, 2.86, -1.0, -1.9, 3.24, -0.58);
    const cw = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.01, 0.38), ghost(COL.cold, 0.9));
    cw.position.set(-2.21, 3.245, -0.79);
    root.add(cw);
    const injPts = [v3(-2.2, 2.86, -0.8), v3(-2.2, 1.42, -0.8), v3(-1.92, 1.42, -0.8), v3(-1.92, 1.42, -0.2), v3(-1.92, 1.72, -0.2)];
    pipe(injPts, 0.03, copper(), root, 0.06);
    box(root, brass(), -2.26, 2.12, -0.86, -2.14, 2.26, -0.74);
    const il = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.24), steel());
    il.geometry.translate(0, 0, 0.12);
    il.position.set(-2.2, 2.19, -0.74);
    il.castShadow = true;
    root.add(il);
    this.injLever = il;
    this.injMark = new ValveMark(root, v3(-2.2, 2.19, -0.48));

    // 힘 화살표
    this.weightArrow = arrow(COL.force, 0.5, 0.03);
    aimArrow(this.weightArrow, v3(PUMP_X + 0.2, 2.0, 0), v3(0, -1, 0));
    root.add(this.weightArrow);
    this.liftArrow = arrow(COL.force, 0.5, 0.03);
    aimArrow(this.liftArrow, v3(PUMP_X + 0.2, 1.4, 0), v3(0, 1, 0));
    root.add(this.liftArrow);

    // 흐름
    this.flows = {
      steam: new FlowPath([v3(CX, 1.2, 0.05), v3(CX, 1.7, 0.05)], COL.steam, 0.024, 0.07, 0.35),
      inj: new FlowPath(injPts.map((p) => p.clone()), COL.cold, 0.022, 0.08, 0.9),
      pump: new FlowPath([v3(PUMP_X, 0.05, 0), v3(PUMP_X, 0.8, 0), v3(PUMP_X + 0.34, 0.8, 0)], COL.water, 0.026, 0.09, 0.6)
    };
    for (const f of Object.values(this.flows)) root.add(f.mesh);
    root.add(this.parts.points);

    // 사슬 전체 길이(감긴 + 늘어진) — 가운데 자세에서 정해 두고 매 프레임 검산
    this.chainLen = [R * WRAP0 + (PIV.y - (P_BOTTOM0 + 0.5 * STROKE + PISTON_H + ROD_L)), R * WRAP0 + (PIV.y - PUMP_MID)];
    this.solve(0);
  }

  setStage(i: number): void {
    this.stage = i;
    this.player.play(NEWCOMEN_SEGS[i] ?? null);
  }

  private solve(u: number): void {
    this.u = u;
    const s = pistonS(u);
    const pBottom = P_BOTTOM0 + s * STROKE;
    const rodTop = pBottom + PISTON_H + ROD_L;
    // 왼쪽 사슬: 늘어진 길이 = 전체 - 감긴 길이 → θ를 구한다(θ>0: 실린더 쪽이 내려감)
    const hangL = PIV.y - rodTop;
    const wrapL = this.chainLen[0] - hangL;
    this.theta = WRAP0 - wrapL / R;
    const th = this.theta;
    // 오른쪽 사슬: 감긴 각 = WRAP0 + θ
    const wrapR = R * (WRAP0 + th);
    const pumpTop = PIV.y - (this.chainLen[1] - wrapR);
    this.beam.rotation.z = th;
    this.piston.position.y = pBottom;
    this.pumpRod.position.y = pumpTop;
    // 검산: 펌프 막대 꼭대기는 가운데 높이에서 Rθ만큼 위
    this.err = Math.abs(pumpTop - (PUMP_MID + R * th));
    this.layChain(this.chainL, Math.PI, Math.PI - WRAP0 + th, rodTop, -1);
    this.layChain(this.chainR, 0, WRAP0 + th, pumpTop, 1);
    this.steamVol.scale.y = Math.max(0.001, pBottom - CYL_FLOOR);
    this.airArrows.position.y = pBottom + PISTON_H + 0.5;
  }

  /** 원호(회전 중심 기준 tangentAng → attachAng)에 감긴 부분 + 수직으로 늘어진 부분에 고리를 놓는다 */
  private layChain(im: THREE.InstancedMesh, tangentAng: number, attachAng: number, bottomY: number, side: number): void {
    const pts: THREE.Vector3[] = [];
    const n = 10;
    for (let i = 0; i <= n; i++) {
      const a = attachAng + ((tangentAng - attachAng) * i) / n;
      pts.push(new THREE.Vector3(PIV.x + R * Math.cos(a), PIV.y + R * Math.sin(a), 0));
    }
    const x = PIV.x + side * R;
    pts.push(new THREE.Vector3(x, bottomY, 0));
    const step = 0.052;
    let k = 0;
    let carry = 0;
    for (let i = 1; i < pts.length && k < im.count; i++) {
      const a = pts[i - 1]!;
      const b = pts[i]!;
      const seg = a.distanceTo(b);
      const dir = b.clone().sub(a).normalize();
      let d = carry;
      while (d < seg && k < im.count) {
        this.dummy.position.copy(a).addScaledVector(dir, d);
        this.dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        if (k % 2) this.dummy.rotateY(Math.PI / 2);
        this.dummy.updateMatrix();
        im.setMatrixAt(k, this.dummy.matrix);
        k++;
        d += step;
      }
      carry = d - seg;
    }
    for (let j = k; j < im.count; j++) {
      this.dummy.position.set(0, -10, 0);
      this.dummy.scale.setScalar(0);
      this.dummy.updateMatrix();
      im.setMatrixAt(j, this.dummy.matrix);
      this.dummy.scale.setScalar(1);
    }
    im.instanceMatrix.needsUpdate = true;
  }

  private steamOpen(): boolean {
    return this.u < 0.29;
  }
  private injOpen(): boolean {
    return this.u >= 0.43 && this.u < 0.55;
  }

  update(dt: number, t: number): void {
    this.player.update(dt, 1 / 9.5);
    const u = this.player.phase;
    this.solve(u);
    const so = this.steamOpen();
    const io = this.injOpen();
    this.steamMark.set(so);
    this.injMark.set(io);
    this.steamLever.rotation.y = so ? 0 : Math.PI / 2;
    this.injLever.rotation.y = io ? 0 : Math.PI / 2;

    // 실린더 속 증기 농도와 응축수
    let fill = 0.04;
    if (u < 0.29) fill = 0.55 + 0.45 * smooth(u / 0.1);
    else if (u < 0.43) fill = 1;
    else if (u < 0.56) fill = 1 - 0.96 * smooth((u - 0.43) / 0.13);
    this.steamMat.opacity = 0.06 + 0.62 * fill;
    this.steamMat.emissiveIntensity = 0.1 + 0.3 * fill;
    let pool = 0;
    if (u < 0.08) pool = 0.035 * (1 - u / 0.08);
    else if (u >= 0.45) pool = 0.035 * smooth((u - 0.45) / 0.17);
    this.pool.visible = pool > 0.002;
    this.pool.scale.y = Math.max(0.001, pool);

    // 화살표
    const air = u >= 0.565 ? 1 : 0;
    const wt = u >= 0.03 && u < 0.28 ? 1 : 0;
    const lift = u >= 0.58 && u < 0.84 ? 1 : 0;
    this.airK += (air - this.airK) * Math.min(1, dt * 6);
    this.wK += (wt - this.wK) * Math.min(1, dt * 6);
    this.lK += (lift - this.lK) * Math.min(1, dt * 6);
    fadeGroup(this.airArrows, this.airK);
    this.airArrows.children.forEach((a, i) => {
      const base = a.userData.base as THREE.Vector3;
      a.position.y = base.y - ((t * 0.5 + i * 0.13) % 0.12);
    });
    fadeGroup(this.weightArrow, this.wK);
    fadeGroup(this.liftArrow, this.lK);
    this.weightArrow.position.y = this.pumpRod.position.y - 0.4;
    this.liftArrow.position.y = this.pumpRod.position.y - 1.25;

    // 흐름
    this.flows.steam.target = so ? 1 : 0;
    this.flows.inj.target = io ? 1 : 0;
    this.flows.pump.target = lift;
    for (const f of Object.values(this.flows)) f.update(dt);

    // 입자
    this.fire.update(t);
    this.emit(dt, u, so, io, lift > 0);
    this.parts.update(dt);
  }

  private emit(dt: number, u: number, so: boolean, io: boolean, lifting: boolean): void {
    const P = this.parts;
    const a = this.acc;
    const rnd = Math.random;
    a.bub += dt * 26;
    while (a.bub > 1) {
      a.bub--;
      const ang = DIR + GAP / 2 + rnd() * (Math.PI * 2 - GAP);
      const r = 0.1 + rnd() * 0.42;
      P.spawn({ pos: v3(CX + Math.sin(ang) * r, 0.7, Math.cos(ang) * r), vel: v3(0, 0.45 + rnd() * 0.3, 0), color: 0xffffff, size: 0.025, life: 0.6, alpha: 0.9 });
    }
    if (so) {
      a.steam += dt * 34;
      while (a.steam > 1) {
        a.steam--;
        const ang = rnd() * Math.PI * 2;
        const h = this.piston.position.y - CYL_FLOOR;
        P.spawn({ pos: v3(CX + Math.sin(ang) * 0.05, CYL_FLOOR + 0.02, Math.cos(ang) * 0.05), vel: v3(Math.sin(ang) * 0.35, 0.2 + h * 1.2, Math.cos(ang) * 0.35), color: COL.steam, size: 0.07, grow: 0.25, life: 0.6, alpha: 0.6, drag: 2 });
      }
    }
    if (io) {
      a.spray += dt * 160;
      while (a.spray > 1) {
        a.spray--;
        P.spawn({ pos: v3(-1.92, 1.73, -0.2), vel: v3((rnd() - 0.4) * 0.6, 2.2 + rnd() * 0.8, (rnd() - 0.3) * 0.6), color: COL.cold, size: 0.05, life: 0.6, alpha: 1, ay: -7 });
      }
    }
    a.smoke += dt * 6;
    while (a.smoke > 1) {
      a.smoke--;
      P.spawn({ pos: v3(-2.57 + (rnd() - 0.5) * 0.2, 4.65, -1.54), vel: v3(0.12 + rnd() * 0.1, 0.35, (rnd() - 0.5) * 0.1), color: COL.smoke, size: 0.18, grow: 0.35, life: 3.2, alpha: 0.35, drag: 0.2 });
    }
    if (lifting) {
      a.water += dt * 60;
      while (a.water > 1) {
        a.water--;
        P.spawn({ pos: v3(PUMP_X + 0.4, 0.78, (rnd() - 0.5) * 0.06), vel: v3(0.5 + rnd() * 0.3, 0, (rnd() - 0.5) * 0.1), color: COL.water, size: 0.035, life: 0.32, alpha: 1, ay: -9 });
      }
    }
    void u;
  }

  anchor(name: string): THREE.Vector3 | null {
    const py = this.piston.position.y;
    switch (name) {
      case 'boiler': return v3(CX + 0.45, 0.9, 0.35);
      case 'fire': return v3(CX, 0.25, 0.66);
      case 'cylinder': return v3(CX - 0.35, 2.55, 0.32);
      case 'piston': return v3(CX + 0.1, py + PISTON_H, 0.3);
      case 'steamIn': return v3(CX, CYL_FLOOR + Math.max(0.1, (py - CYL_FLOOR) * 0.5), 0.15);
      case 'beam': return v3(0.55, 4.0 + 0.75 * Math.sin(-this.theta), 0);
      case 'chain': return v3(CX, PIV.y - 0.3, 0);
      case 'pumpRod': return v3(PUMP_X, this.pumpRod.position.y - 0.9, 0.05);
      case 'shaft': return v3(PUMP_X, 0.25, 0.45);
      case 'spout': return v3(PUMP_X + 0.9, 0.42, 0.1);
      case 'cistern': return v3(-2.21, 3.24, -0.6);
      case 'steamValve': return v3(CX + 0.06, 1.505, 0.4);
      case 'injValve': return v3(-2.2, 2.19, -0.48);
      case 'air': return v3(CX, py + PISTON_H + 0.62, 0.1);
      case 'vacuum': return v3(CX, CYL_FLOOR + Math.max(0.06, (py - CYL_FLOOR) * 0.5), 0.2);
      case 'nozzle': return v3(-1.92, 1.75, -0.1);
      case 'chimney': return v3(-2.57, 4.62, -1.3);
      default: return null;
    }
  }

  valves(): ValveInfo[] {
    return [
      { name: '증기 밸브', open: this.steamOpen() },
      { name: '찬물 분사 밸브', open: this.injOpen() }
    ];
  }

  force(): string {
    const u = this.u;
    if (u < 0.03) return '피스톤이 바닥 — 응축수를 빼고 증기를 다시 넣어요';
    if (u < 0.29) return '펌프 막대의 무게가 흔들보를 당겨 피스톤을 올려요';
    if (u < 0.43) return '피스톤이 꼭대기에서 기다려요';
    if (u < 0.56) return '찬물이 증기를 식혀 실린더 안 압력이 낮아져요';
    if (u < 0.86) return '대기압이 피스톤을 아래로 눌러요';
    return '대기압에 눌린 피스톤이 바닥까지 내려왔어요';
  }

  residual(): number {
    // 피스톤 막대 쪽 사슬 길이 검산 + 펌프 쪽 검산
    const rodTop = this.piston.position.y + PISTON_H + ROD_L;
    const left = R * (WRAP0 - this.theta) + (PIV.y - rodTop) - this.chainLen[0];
    const right = R * (WRAP0 + this.theta) + (PIV.y - this.pumpRod.position.y) - this.chainLen[1];
    return Math.max(Math.abs(left), Math.abs(right), this.err);
  }

  dispose(): void {
    this.parts.dispose();
    this.root.removeFromParent();
  }

  get stageIndex(): number {
    return this.stage;
  }

  get phase(): number {
    return clamp01(this.u);
  }
}
