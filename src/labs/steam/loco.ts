// 증기 기관차(0-6-0, 바깥 실린더 2개) — 화실·연관 보일러·증기 돔(조절 밸브)·연기실(송풍관)·굴뚝,
// 수평 복동 실린더 + 슬라이드 밸브(D 밸브), 크로스헤드, 커넥팅 로드, 동륜 3쌍과 커플링 로드, 편심봉 밸브 장치.
// 크랭크-슬라이더는 매 프레임 정확히 풀고(로드 길이 일정), 슬라이드 밸브는 동륜의 리턴 크랭크 → 편심봉 → 밸브 막대로 움직인다.
// 좌우 크랭크는 90° 어긋나 있다. 레일 위 제자리 주행: 침목이 굴러간 거리만큼 뒤로 흐른다.

import * as THREE from 'three';
import { annularSector, extrude, merge, mesh, shapeFrom, type V2 } from '../../models/parts/geom';
import { brass, castIron, copper, darkSteel, ghost, paint, steel, wood } from '../../models/materials';
import {
  COL,
  Fire,
  Player,
  aimArrow,
  approach,
  arrow,
  box,
  cutMat,
  cutSolid,
  cutVolume,
  cyl,
  fadeGroup,
  pipe,
  stoneMat,
  v3,
  type Seg,
  type SteamModel,
  type ValveInfo
} from './common';
import { FlowPath, Particles } from './particles';

const RW = 0.4;
const AY = 0.64;
const DRV = [-1.3, -0.4, 0.5] as const;
const MAIN = DRV[1];
const RCK = 0.22;
const LC = 1.4;
const PR = 0.825;
const ZC = 0.6;
const ZCR = 0.52;
const ZE = 0.69;
const RE = 0.08;
const LE = 1.7;
const VY = 0.92;
const XV0 = 1.825;
const CYL0 = 1.5;
const CYL1 = 2.15;
const IN0 = 1.54;
const IN1 = 2.11;
const PT = 0.06;
const LAP = 0.008;
const SP = (Math.PI * RW) / 4; // 침목 간격 — 반 바퀴 거리의 1/4이라 단계 반복 때 이음이 보이지 않는다
const BOIL_Y = 1.32;
const WL = 0.14; // 보일러 중심 위 수면 높이
const BGAP = 1.9;
const BDIR = -0.25;

/** 단계별 재생 구간 — u: 동륜 1회전. 3단계 = 오른쪽 피스톤이 앞 끝 → 뒤 끝, 4단계 = 반대 */
export const LOCO_SEGS: (Seg | null)[] = [null, null, null, { a: 0.05, b: 0.47, dur: 3.2 }, { a: 0.55, b: 0.97, dur: 3.2 }, null, null];

interface Side {
  sign: number;
  piston: THREE.Group;
  conrod: THREE.Mesh;
  coupling: THREE.Mesh;
  ecc: THREE.Mesh;
  valve: THREE.Group;
  wheels: THREE.Group[];
  d: number;
  px: number;
  cross: number;
  exhaust: number;
  front?: THREE.Group;
  rear?: THREE.Group;
  fMat?: THREE.MeshStandardMaterial;
  rMat?: THREE.MeshStandardMaterial;
}

function crossOf(alpha: number): { pin: THREE.Vector2; cx: number } {
  const pin = new THREE.Vector2(MAIN + RCK * Math.cos(alpha), AY + RCK * Math.sin(alpha));
  const dy = pin.y - AY;
  return { pin, cx: pin.x + Math.sqrt(LC * LC - dy * dy) };
}

function eccRaw(alpha: number, delta: number): { e: THREE.Vector2; sx: number } {
  const ae = alpha - Math.PI / 2 + delta;
  const e = new THREE.Vector2(MAIN + RE * Math.cos(ae), AY + RE * Math.sin(ae));
  const dy = VY - e.y;
  return { e, sx: e.x + Math.sqrt(LE * LE - dy * dy) };
}

// 편심봉이 비스듬해서 생기는 밸브 시기 어긋남을 리턴 크랭크 각으로 보정한다:
// 피스톤이 양 끝(사점)에 있을 때 밸브가 정확히 가운데에 오도록 각 δ를 이분법으로 찾는다.
const DELTA = ((): number => {
  const f = (d: number): number => eccRaw(0, d).sx - eccRaw(Math.PI, d).sx;
  let lo = -0.6;
  let hi = 0.6;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (f(lo) * f(mid) <= 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
})();
const eccOf = (alpha: number): { e: THREE.Vector2; sx: number } => eccRaw(alpha, DELTA);
const SLIDER_MEAN = (eccOf(0).sx + eccOf(Math.PI).sx) / 2;

/** 원 단면(반지름 r)에서 앞쪽 쐐기를 잘라 내고 y ≤ yMax(또는 ≥ yMin)만 남긴 다각형 — (z, y) 평면 */
function segmentPoly(r: number, gap: number, dir: number, below: boolean, yl: number): V2[] {
  const pts: V2[] = [[0, 0]];
  const n = 48;
  for (let i = 0; i <= n; i++) {
    const phi = dir + gap / 2 + ((Math.PI * 2 - gap) * i) / n;
    pts.push([r * Math.cos(phi), -r * Math.sin(phi)]);
  }
  // 반평면 자르기(서덜랜드-호지먼)
  const inside = (p: V2): boolean => (below ? p[1] <= yl : p[1] >= yl);
  const out: V2[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    const ia = inside(a);
    const ib = inside(b);
    if (ia) out.push(a);
    if (ia !== ib) {
      const k = (yl - a[1]) / (b[1] - a[1]);
      out.push([a[0] + (b[0] - a[0]) * k, yl]);
    }
  }
  return out;
}

export class LocoModel implements SteamModel {
  readonly root = new THREE.Group();
  private player = new Player();
  private stage = 0;
  private sides: Side[] = [];
  private sleepers: THREE.InstancedMesh;
  private fire: Fire;
  private parts = new Particles(1800);
  private flows: FlowPath[] = [];
  private fAdm!: FlowPath;
  private rAdm!: FlowPath;
  private fExh!: FlowPath;
  private rExh!: FlowPath;
  private mainFlow!: FlowPath;
  private gas: FlowPath[] = [];
  private regDisc: THREE.Mesh;
  private chestSteam: THREE.Mesh;
  private pushArrow: THREE.Group;
  private dummy = new THREE.Object3D();
  private acc = { smoke: 0, bub: 0 };
  private err = 0;
  private pK = 0;
  private puffs = 0;

  regulator = 0.6;
  omega = 0;

  constructor() {
    const root = this.root;
    const stone = stoneMat(0x8f8a82);
    const iron = castIron();
    const dark = darkSteel();
    const bright = steel({ roughness: 0.25 });
    const cut = cutMat();
    const green = paint(0x1f5b43, { roughness: 0.38 });
    const black = paint(0x1b1e22, { roughness: 0.5 });
    const red = paint(0xb8322c);

    // ── 선로 ──
    box(root, stone, -3.4, 0, -0.78, 3.4, 0.1, 0.78);
    const slG = new THREE.BoxGeometry(0.13, 0.06, 1.32);
    this.sleepers = new THREE.InstancedMesh(slG, wood(0x4e3826, { roughness: 0.9 }), 21);
    this.sleepers.castShadow = true;
    this.sleepers.receiveShadow = true;
    root.add(this.sleepers);
    const railShape = shapeFrom([[-0.045, 0], [0.045, 0], [0.045, 0.012], [0.01, 0.022], [0.01, 0.058], [0.028, 0.064], [0.028, 0.08], [-0.028, 0.08], [-0.028, 0.064], [-0.01, 0.058], [-0.01, 0.022], [-0.045, 0.012]]);
    const rg = extrude(railShape, 6.8, 0);
    rg.rotateY(Math.PI / 2);
    for (const z of [-0.4, 0.4]) {
      const r = mesh(rg.clone(), bright, root);
      r.position.set(0, 0.16, z);
    }
    rg.dispose();

    // ── 동륜 ──
    const tyre = new THREE.LatheGeometry([[0.36, -0.04], [0.43, -0.04], [0.43, -0.026], [0.4, -0.012], [0.4, 0.04], [0.36, 0.04], [0.36, -0.04]].map(([r, y]) => new THREE.Vector2(r!, y!)), 64);
    tyre.rotateX(Math.PI / 2);
    const bodyParts: THREE.BufferGeometry[] = [];
    const rim = new THREE.LatheGeometry([[0.31, -0.03], [0.365, -0.03], [0.365, 0.03], [0.31, 0.03], [0.31, -0.03]].map(([r, y]) => new THREE.Vector2(r!, y!)), 64);
    rim.rotateX(Math.PI / 2);
    bodyParts.push(rim);
    const hub = new THREE.CylinderGeometry(0.085, 0.085, 0.1, 28);
    hub.rotateX(Math.PI / 2);
    bodyParts.push(hub);
    for (let i = 0; i < 14; i++) {
      const sp = new THREE.BoxGeometry(0.25, 0.03, 0.035);
      sp.translate(0.2, 0, 0);
      sp.rotateZ((i / 14) * Math.PI * 2 + 0.11);
      bodyParts.push(sp);
    }
    bodyParts.push(extrude(annularSector(0.1, 0.32, Math.PI - 0.75, Math.PI + 0.75), 0.05, 0));
    const boss = new THREE.CylinderGeometry(0.065, 0.065, 0.08, 24);
    boss.rotateX(Math.PI / 2);
    boss.translate(RCK, 0, 0);
    bodyParts.push(boss);
    const wheelBody = merge(bodyParts);
    const wheelPaint = paint(0x1f5b43, { roughness: 0.45 });

    // ── 차대·보일러 ──
    for (const z of [-0.3, 0.3]) box(root, black, -2.55, 0.5, z - 0.015, 2.25, 1.04, z + 0.015);
    for (const x of DRV) {
      cyl(root, bright, 0.055, 0.82, 'z', v3(x, AY, 0));
      for (const z of [-0.33, 0.33]) box(root, dark, x - 0.1, AY - 0.1, z - 0.03, x + 0.1, AY + 0.12, z + 0.03);
    }
    box(root, black, -0.95, 1.05, -0.82, 2.25, 1.09, 0.82);
    box(root, red, -0.95, 1.0, 0.79, 2.25, 1.05, 0.82);
    box(root, red, -0.95, 1.0, -0.82, 2.25, 1.05, -0.79);
    // 앞·뒤 완충기
    box(root, red, 2.25, 0.72, -0.8, 2.35, 1.06, 0.8);
    box(root, red, -2.7, 0.72, -0.8, -2.55, 1.06, 0.8);
    for (const z of [-0.55, 0.55]) {
      cyl(root, dark, 0.05, 0.22, 'x', v3(2.46, 0.88, z));
      cyl(root, bright, 0.1, 0.03, 'x', v3(2.58, 0.88, z));
      cyl(root, dark, 0.05, 0.22, 'x', v3(-2.81, 0.88, z));
      cyl(root, bright, 0.1, 0.03, 'x', v3(-2.93, 0.88, z));
    }
    box(root, dark, 2.35, 0.84, -0.03, 2.5, 0.9, 0.03);

    // 보일러 동체(컷어웨이)
    const barrel = cutSolid([[0.37, 0], [0.4, 0], [0.4, 2.4], [0.37, 2.4]], BGAP, BDIR, green, cut, 64);
    barrel.rotation.z = -Math.PI / 2;
    barrel.position.set(-0.95, BOIL_Y, 0);
    root.add(barrel);
    for (const x of [-0.6, 0.55, 1.2]) {
      const band = cutSolid([[0.4, -0.012], [0.408, -0.012], [0.408, 0.012], [0.4, 0.012]], BGAP, BDIR, brass(), cut, 64);
      band.rotation.z = -Math.PI / 2;
      band.position.set(x, BOIL_Y, 0);
      root.add(band);
    }
    const wPoly = segmentPoly(0.368, BGAP, BDIR, true, WL);
    const sPoly = segmentPoly(0.368, BGAP, BDIR, false, WL);
    const toShape = (p: V2[]): THREE.Shape => shapeFrom(p.map(([z, y]): V2 => [-z, y]));
    const waterG = extrude(toShape(wPoly), 2.38, 0);
    waterG.rotateY(Math.PI / 2);
    const water = mesh(waterG, ghost(COL.water, 0.42), root);
    water.position.set(0.25, BOIL_Y, 0);
    water.castShadow = false;
    water.userData.noAO = true;
    const steamM = ghost(COL.steam, 0.45);
    steamM.emissive = new THREE.Color(0xff9db8);
    steamM.emissiveIntensity = 0.2;
    const steamG = extrude(toShape(sPoly), 2.38, 0);
    steamG.rotateY(Math.PI / 2);
    const st = mesh(steamG, steamM, root);
    st.position.set(0.25, BOIL_Y, 0);
    st.castShadow = false;
    st.userData.noAO = true;
    // 연관(불길이 지나는 관)
    const tubes: [number, number][] = [];
    for (let y = -0.27; y <= WL - 0.05; y += 0.085) {
      for (let z = -0.3; z <= 0.3; z += 0.085) {
        if (Math.hypot(y, z) < 0.31) tubes.push([y, z]);
      }
    }
    const tubeG = new THREE.CylinderGeometry(0.028, 0.028, 2.4, 14, 1, true);
    tubeG.rotateZ(Math.PI / 2);
    const tubeM = copper({ roughness: 0.4 });
    tubeM.side = THREE.DoubleSide;
    const tubeIM = new THREE.InstancedMesh(tubeG, tubeM, tubes.length);
    tubes.forEach(([y, z], i) => {
      this.dummy.position.set(0.25, BOIL_Y + y, z);
      this.dummy.updateMatrix();
      tubeIM.setMatrixAt(i, this.dummy.matrix);
    });
    tubeIM.castShadow = true;
    root.add(tubeIM);
    for (const x of [-0.95, 1.45]) {
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.02, 48), copper());
      plate.rotation.z = Math.PI / 2;
      plate.position.set(x, BOIL_Y, 0);
      root.add(plate);
    }
    // 화실(앞면이 열린 상자)
    const fbx = castIron({ color: 0x3a3f45 });
    box(root, fbx, -1.62, 0.95, -0.28, -1.58, 1.72, 0.28);
    box(root, fbx, -1.62, 0.95, -0.28, -0.95, 1.72, -0.25);
    box(root, fbx, -1.62, 1.68, -0.28, -0.95, 1.72, 0.28);
    box(root, fbx, -1.62, 0.95, -0.28, -0.95, 0.99, 0.28);
    box(root, cut, -1.62, 0.95, 0.25, -1.58, 1.72, 0.28);
    box(root, cut, -1.62, 1.68, 0.25, -0.95, 1.72, 0.28);
    box(root, cut, -1.62, 0.95, 0.25, -0.95, 0.99, 0.28);
    this.fire = new Fire(0.5, 0.4, 0.42, 2.6);
    this.fire.group.position.set(-1.28, 0.99, 0);
    root.add(this.fire.group);
    // 연기실(컷어웨이)·문
    const sbox = cutSolid([[0.4, 0], [0.43, 0], [0.43, 0.7], [0, 0.7], [0, 0.67], [0.4, 0.67]], BGAP, BDIR, black, cut, 64);
    sbox.rotation.z = -Math.PI / 2;
    sbox.position.set(1.45, BOIL_Y, 0);
    root.add(sbox);
    cyl(root, dark, 0.34, 0.03, 'x', v3(2.165, BOIL_Y, 0), 48);
    box(root, bright, 2.17, BOIL_Y - 0.02, -0.18, 2.19, BOIL_Y + 0.02, 0.18);
    box(root, black, 1.55, 0.86, -0.42, 2.05, 1.0, 0.42);
    // 송풍관(배기)
    cyl(root, dark, 0.05, 0.5, 'y', v3(1.8, 1.17, 0));
    cyl(root, dark, 0.035, 0.06, 'y', v3(1.8, 1.45, 0));
    // 굴뚝
    const chim = cutSolid([[0, 1.66], [0.17, 1.66], [0.12, 1.78], [0.11, 2.16], [0.15, 2.2], [0.15, 2.28], [0.09, 2.28], [0.09, 1.8], [0, 1.8]], 0, 0, black, undefined, 40);
    chim.position.x = 1.8;
    root.add(chim);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.018, 10, 40), copper());
    lip.rotation.x = Math.PI / 2;
    lip.position.set(1.8, 2.28, 0);
    root.add(lip);
    // 증기 돔(컷어웨이)과 조절 밸브
    const domeP: V2[] = [[0.2, 1.62], [0.21, 1.62], [0.21, 1.82]];
    for (let i = 1; i <= 8; i++) {
      const a = (i / 8) * (Math.PI / 2);
      domeP.push([0.21 * Math.cos(a), 1.82 + 0.17 * Math.sin(a)]);
    }
    domeP.push([0, 1.97]);
    for (let i = 8; i >= 1; i--) {
      const a = (i / 8) * (Math.PI / 2);
      domeP.push([0.19 * Math.cos(a), 1.82 + 0.15 * Math.sin(a)]);
    }
    domeP.push([0.19, 1.82], [0.19, 1.66], [0.2, 1.66]);
    const dome = cutSolid(domeP, 1.6, 0.25, brass(), cut, 48);
    dome.position.x = 0.1;
    root.add(dome);
    const sp = copper();
    cyl(root, sp, 0.04, 0.3, 'y', v3(0.1, 1.7, 0));
    pipe([v3(0.1, 1.56, 0), v3(0.1, 1.5, 0), v3(1.62, 1.5, 0), v3(1.62, 1.15, 0.0)], 0.035, sp, root);
    this.regDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.015, 24), bright);
    this.regDisc.position.set(0.1, 1.87, 0);
    root.add(this.regDisc);
    for (const s of [-1, 1]) pipe([v3(1.62, 1.15, 0), v3(1.68, 1.1, 0.3 * s), v3(1.72, 1.08, 0.44 * s), v3(1.76, 1.0, 0.6 * s)], 0.035, s > 0 ? sp : copper(), root, 0.06);
    // 안전 밸브·기적
    for (const z of [-0.05, 0.05]) cyl(root, brass(), 0.03, 0.16, 'y', v3(-1.3, 1.78, z));
    cyl(root, brass(), 0.02, 0.18, 'y', v3(-1.45, 1.8, 0));

    // ── 운전실·석탄 칸 ──
    const cabSide = new THREE.Shape([new THREE.Vector2(-2.25, 1.09), new THREE.Vector2(-1.62, 1.09), new THREE.Vector2(-1.62, 2.12), new THREE.Vector2(-2.25, 2.12)]);
    const win = new THREE.Path();
    win.moveTo(-2.12, 1.55);
    win.lineTo(-1.72, 1.55);
    win.lineTo(-1.72, 2.0);
    win.lineTo(-2.12, 2.0);
    win.lineTo(-2.12, 1.55);
    cabSide.holes.push(win);
    for (const z of [-0.62, 0.62]) {
      const cs = mesh(extrude(cabSide, 0.03, 0), green, root);
      cs.position.z = z;
    }
    const front = new THREE.Shape([new THREE.Vector2(-0.62, 1.09), new THREE.Vector2(0.62, 1.09), new THREE.Vector2(0.62, 2.12), new THREE.Vector2(-0.62, 2.12)]);
    for (const zc of [-0.38, 0.38]) {
      const h = new THREE.Path();
      h.absarc(zc, 1.92, 0.09, 0, Math.PI * 2, true);
      front.holes.push(h);
    }
    const fg = extrude(front, 0.03, 0);
    fg.rotateY(Math.PI / 2);
    const fm = mesh(fg, green, root);
    fm.position.x = -1.635;
    const roofS = new THREE.Shape();
    roofS.absarc(0, -0.5, 0.86, Math.PI * 0.25, Math.PI * 0.75, false);
    roofS.absarc(0, -0.5, 0.83, Math.PI * 0.75, Math.PI * 0.25, true);
    const roofG = extrude(roofS, 0.8, 0);
    roofG.rotateY(Math.PI / 2);
    const roof = mesh(roofG, black, root);
    roof.position.set(-1.95, 2.12 + 0.5 - 0.86 * Math.sin(Math.PI * 0.25), 0);
    box(root, black, -2.65, 1.04, -0.62, -1.62, 1.09, 0.62);
    box(root, green, -2.6, 1.09, -0.6, -2.25, 1.62, 0.6);
    const coal = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2, 1), castIron({ color: 0x15171a, roughness: 0.9 }));
    coal.scale.set(0.9, 0.35, 1.5);
    coal.position.set(-2.42, 1.64, 0);
    root.add(coal);

    // ── 양쪽 실린더·로드 ──
    for (const sign of [1, -1]) this.sides.push(this.buildSide(sign, tyre, wheelBody, wheelPaint, iron, dark, bright, green, cut));
    this.chestSteam = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.11, 0.2), ghost(COL.steam, 0.5));
    (this.chestSteam.material as THREE.MeshStandardMaterial).emissive = new THREE.Color(0xff9db8);
    (this.chestSteam.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3;
    this.chestSteam.position.set(XV0, 0.92, ZC - 0.02);
    this.chestSteam.userData.noAO = true;
    root.add(this.chestSteam);
    this.pushArrow = arrow(COL.force, 0.17, 0.018);
    root.add(this.pushArrow);

    // ── 흐름 ──
    const exhTail = [v3(XV0, 0.86, ZC), v3(XV0, 0.8, 0.42), v3(1.8, 0.92, 0.1), v3(1.8, 1.47, 0), v3(1.8, 2.25, 0)];
    this.mainFlow = new FlowPath([v3(0.1, 1.86, 0), v3(0.1, 1.5, 0), v3(1.62, 1.5, 0), v3(1.62, 1.15, 0), v3(1.68, 1.1, 0.3), v3(1.76, 1.0, ZC), v3(XV0, 0.93, ZC)], COL.steam, 0.026, 0.1, 0.8);
    this.fAdm = new FlowPath([v3(1.98, 0.93, ZC + 0.03), v3(1.925, 0.85, ZC + 0.04), v3(2.06, 0.74, ZC + 0.08), v3(2.06, 0.64, ZC + 0.12)], COL.steam, 0.024, 0.05, 0.4);
    this.rAdm = new FlowPath([v3(1.67, 0.93, ZC + 0.03), v3(1.725, 0.85, ZC + 0.04), v3(1.59, 0.74, ZC + 0.08), v3(1.59, 0.64, ZC + 0.12)], COL.steam, 0.024, 0.05, 0.4);
    this.fExh = new FlowPath([v3(2.06, 0.64, ZC + 0.12), v3(2.06, 0.74, ZC + 0.08), v3(1.925, 0.85, ZC + 0.04), v3(XV0, 0.9, ZC + 0.03), ...exhTail], COL.used, 0.024, 0.07, 0.7);
    this.rExh = new FlowPath([v3(1.59, 0.64, ZC + 0.12), v3(1.59, 0.74, ZC + 0.08), v3(1.725, 0.85, ZC + 0.04), v3(XV0, 0.9, ZC + 0.03), ...exhTail], COL.used, 0.024, 0.07, 0.7);
    for (const z of [-0.18, 0.0, 0.18]) {
      this.gas.push(new FlowPath([v3(-1.28, 1.15, z * 0.6), v3(-0.95, BOIL_Y - 0.1, z), v3(1.45, BOIL_Y - 0.1, z), v3(1.75, 1.3, z * 0.5), v3(1.8, 1.5, 0), v3(1.8, 2.25, 0)], COL.fire, 0.022, 0.12, 0.8));
    }
    this.flows = [this.mainFlow, this.fAdm, this.rAdm, this.fExh, this.rExh, ...this.gas];
    for (const f of this.flows) root.add(f.mesh);
    root.add(this.parts.points);
    this.solve(0, 0);
  }

  private buildSide(
    sign: number,
    tyre: THREE.BufferGeometry,
    wheelBody: THREE.BufferGeometry,
    wheelPaint: THREE.Material,
    iron: THREE.Material,
    dark: THREE.Material,
    bright: THREE.Material,
    green: THREE.Material,
    cut: THREE.Material
  ): Side {
    const root = this.root;
    const z = (v: number): number => v * sign;
    const wheels: THREE.Group[] = [];
    for (const x of DRV) {
      const w = new THREE.Group();
      w.position.set(x, AY, z(0.41));
      if (sign < 0) w.scale.z = -1;
      mesh(tyre, bright, w);
      mesh(wheelBody, wheelPaint, w);
      const long = x === MAIN;
      const pinLen = long ? 0.22 : 0.15;
      cyl(w, bright, 0.032, pinLen, 'z', v3(RCK, 0, 0.04 + pinLen / 2));
      if (long) {
        // 리턴 크랭크: 크랭크 핀 → 편심 핀(바퀴 중심에서 RE, 핀보다 90° 뒤)
        const a = new THREE.Vector2(RCK, 0);
        const b = new THREE.Vector2(RE * Math.cos(DELTA - Math.PI / 2), RE * Math.sin(DELTA - Math.PI / 2));
        const len = a.distanceTo(b);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(len, 0.045, 0.025), iron);
        arm.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, 0.255);
        arm.rotation.z = Math.atan2(b.y - a.y, b.x - a.x);
        arm.castShadow = true;
        w.add(arm);
        cyl(w, bright, 0.022, 0.06, 'z', v3(b.x, b.y, 0.28));
      }
      root.add(w);
      wheels.push(w);
    }
    // 실린더
    const prof: V2[] = [[0, 0], [0.19, 0], [0.19, CYL1 - CYL0], [0, CYL1 - CYL0], [0, IN1 - CYL0], [0.15, IN1 - CYL0], [0.15, IN0 - CYL0], [0, IN0 - CYL0]];
    const cylG = sign > 0 ? cutSolid(prof, 2.1, 0, green, cut, 48) : cutSolid(prof, 0, 0, green, undefined, 48);
    cylG.rotation.z = -Math.PI / 2;
    cylG.position.set(CYL0, AY, z(ZC));
    root.add(cylG);
    // 증기 상자(바깥면을 잘라 슬라이드 밸브가 보이게)
    const ch = castIron({ color: 0x3f474f });
    const zi = z(ZC - 0.12);
    const zo = z(ZC + 0.12);
    const zlo = Math.min(zi, zo);
    const zhi = Math.max(zi, zo);
    box(root, ch, 1.55, 0.83, zlo, 2.1, 0.86, zhi);
    box(root, ch, 1.55, 0.98, zlo, 2.1, 1.01, zhi);
    box(root, ch, 1.55, 0.83, zlo, 1.58, 1.01, zhi);
    box(root, ch, 2.07, 0.83, zlo, 2.1, 1.01, zhi);
    if (sign > 0) {
      box(root, ch, 1.55, 0.83, zi - 0.0, 2.1, 1.01, zi + 0.02);
      box(root, cut, 1.55, 0.83, zo - 0.02, 2.1, 0.86, zo);
      box(root, cut, 1.55, 0.98, zo - 0.02, 2.1, 1.01, zo);
      // 통로 표시(앞·가운데·뒤)
      const slot = castIron({ color: 0x0d0f12 });
      for (const [x, w] of [[XV0 + 0.1, 0.05], [XV0, 0.06], [XV0 - 0.1, 0.05]] as [number, number][]) box(root, slot, x - w / 2, 0.86, zi + 0.03, x + w / 2, 0.862, zo - 0.03);
    } else {
      box(root, ch, 1.55, 0.83, zlo, 2.1, 1.01, zlo + 0.02);
      box(root, ch, 1.55, 0.83, zhi - 0.02, 2.1, 1.01, zhi);
    }
    // 미끄럼 막대·받침
    for (const y of [AY + 0.075, AY - 0.075]) box(root, bright, 0.68, y - 0.012, z(ZC) - 0.03, CYL0, y + 0.012, z(ZC) + 0.03);
    box(root, dark, 0.92, AY + 0.087, z(ZC) - 0.02, 0.98, 1.05, z(ZC) + 0.02);
    // 밸브 막대 안내
    box(root, dark, 1.22, VY + 0.03, z(ZC) - 0.03, 1.4, VY + 0.05, z(ZC) + 0.03);
    box(root, dark, 1.3, VY + 0.05, z(ZC) - 0.015, 1.33, 1.05, z(ZC) + 0.015);

    // 피스톤 + 피스톤 막대 + 크로스헤드 (원점 = 크로스헤드 핀)
    const piston = new THREE.Group();
    piston.position.set(0, AY, z(ZC));
    const pg = new THREE.CylinderGeometry(0.148, 0.148, PT, 40);
    pg.rotateZ(Math.PI / 2);
    pg.translate(PR, 0, 0);
    mesh(pg, iron, piston);
    const prg = new THREE.CylinderGeometry(0.025, 0.025, PR, 16);
    prg.rotateZ(Math.PI / 2);
    prg.translate(PR / 2, 0, 0);
    mesh(prg, bright, piston);
    box(piston, dark, -0.08, -0.06, -0.05, 0.08, 0.06, 0.05);
    cyl(piston, bright, 0.022, 0.12, 'z', v3(0, 0, 0));
    root.add(piston);

    // 커넥팅 로드(원점 = 크랭크 핀, +x로 LC)
    const rodG = merge([
      extrude(shapeFrom([[0, -0.05], [LC, -0.035], [LC, 0.035], [0, 0.05]]), 0.03, 0),
      (() => {
        const g = new THREE.CylinderGeometry(0.07, 0.07, 0.04, 24);
        g.rotateX(Math.PI / 2);
        return g;
      })(),
      (() => {
        const g = new THREE.CylinderGeometry(0.05, 0.05, 0.04, 24);
        g.rotateX(Math.PI / 2);
        g.translate(LC, 0, 0);
        return g;
      })()
    ]);
    const conrod = mesh(rodG, bright, root);
    conrod.position.z = z(ZC - 0.04);
    // 커플링 로드(앞뒤 동륜 핀 사이)
    const cpParts: THREE.BufferGeometry[] = [new THREE.BoxGeometry(DRV[2] - DRV[0], 0.06, 0.03)];
    for (const x of DRV) {
      const g = new THREE.CylinderGeometry(0.055, 0.055, 0.035, 24);
      g.rotateX(Math.PI / 2);
      g.translate(x - (DRV[0] + DRV[2]) / 2, 0, 0);
      cpParts.push(g);
    }
    const coupling = mesh(merge(cpParts), bright, root);
    // 편심봉(원점 = 편심 핀, +x로 LE)
    const eg = merge([
      new THREE.BoxGeometry(LE, 0.03, 0.02).translate(LE / 2, 0, 0),
      new THREE.CylinderGeometry(0.035, 0.035, 0.025, 20).rotateX(Math.PI / 2),
      new THREE.CylinderGeometry(0.03, 0.03, 0.025, 20).rotateX(Math.PI / 2).translate(LE, 0, 0)
    ]);
    const ecc = mesh(eg, iron, root);
    ecc.position.z = z(ZE);
    // 슬라이드 밸브(D 밸브) + 밸브 막대 + 미끄럼 쇠(원점 = 밸브 중심 기본 위치에서 d만큼)
    const valve = new THREE.Group();
    valve.position.set(0, 0, 0);
    const dv = extrude(shapeFrom([[-0.137, 0], [-0.075, 0], [-0.075, 0.035], [0.075, 0.035], [0.075, 0], [0.137, 0], [0.137, 0.075], [-0.137, 0.075]]), 0.16, 0.004);
    const dvm = mesh(dv, brass(), valve);
    dvm.position.set(XV0, 0.862, z(ZC));
    const spindleLen = XV0 - 0.137 - (SLIDER_MEAN + 0.0);
    const spG = new THREE.CylinderGeometry(0.014, 0.014, spindleLen, 12);
    spG.rotateZ(Math.PI / 2);
    const spm = mesh(spG, bright, valve);
    spm.position.set(SLIDER_MEAN + spindleLen / 2, VY, z(ZC));
    box(valve, dark, SLIDER_MEAN - 0.05, VY - 0.03, z(ZC) - 0.03, SLIDER_MEAN + 0.05, VY + 0.03, z(ZC) + 0.03);
    // 편심봉 쪽으로 튀어나온 핀
    cyl(valve, bright, 0.016, Math.abs(ZE - ZC) + 0.04, 'z', v3(SLIDER_MEAN, VY, z((ZC + ZE) / 2)));
    root.add(valve);

    const side: Side = { sign, piston, conrod, coupling, ecc, valve, wheels, d: 0, px: 0, cross: 0, exhaust: 0 };
    if (sign > 0) {
      const fm = ghost(COL.steam, 0.6);
      fm.emissive = new THREE.Color(0xff9db8);
      const rm = ghost(COL.steam, 0.6);
      rm.emissive = new THREE.Color(0xff9db8);
      const fr = cutVolume(0.146, 2.1, 0, fm);
      const rr = cutVolume(0.146, 2.1, 0, rm);
      for (const g of [fr, rr]) {
        g.rotation.z = -Math.PI / 2;
        g.position.set(0, AY, ZC);
        root.add(g);
      }
      side.front = fr;
      side.rear = rr;
      side.fMat = fm;
      side.rMat = rm;
    }
    return side;
  }

  setStage(i: number): void {
    this.stage = i;
    this.player.play(LOCO_SEGS[i] ?? null);
  }

  private solve(u: number, dt: number): void {
    const a0 = -Math.PI * 2 * u;
    let err = 0;
    for (const s of this.sides) {
      const alpha = s.sign > 0 ? a0 : a0 + Math.PI / 2;
      const { pin, cx } = crossOf(alpha);
      s.cross = cx;
      s.px = cx + PR;
      s.piston.position.x = cx;
      s.conrod.position.x = pin.x;
      s.conrod.position.y = pin.y;
      s.conrod.rotation.z = Math.atan2(AY - pin.y, cx - pin.x);
      err = Math.max(err, Math.abs(Math.hypot(cx - pin.x, AY - pin.y) - LC));
      s.coupling.position.set((DRV[0] + DRV[2]) / 2 + RCK * Math.cos(alpha), AY + RCK * Math.sin(alpha), s.sign * ZCR);
      for (const w of s.wheels) w.rotation.z = alpha;
      const { e, sx } = eccOf(alpha);
      s.ecc.position.x = e.x;
      s.ecc.position.y = e.y;
      s.ecc.rotation.z = Math.atan2(VY - e.y, sx - e.x);
      err = Math.max(err, Math.abs(Math.hypot(sx - e.x, VY - e.y) - LE));
      // 편심 핀이 바퀴(리턴 크랭크)에 붙어 있는지: 바퀴 회전으로 옮긴 점과 같아야 한다
      const ex2 = MAIN + RE * Math.cos(alpha + DELTA - Math.PI / 2);
      const ey2 = AY + RE * Math.sin(alpha + DELTA - Math.PI / 2);
      err = Math.max(err, Math.hypot(ex2 - e.x, ey2 - e.y));
      s.d = sx - SLIDER_MEAN;
      s.valve.position.x = s.d;
      const exh = s.d > 0.004 ? 1 : s.d < -0.004 ? -1 : 0;
      if (dt > 0 && exh !== 0 && exh !== s.exhaust && this.regulator > 0.02) this.puff();
      s.exhaust = exh;
      if (s.front && s.rear) {
        const pf = s.px + PT / 2;
        const pr = s.px - PT / 2;
        s.front.position.x = pf;
        s.front.scale.y = Math.max(0.001, IN1 - pf);
        s.rear.position.x = IN0;
        s.rear.scale.y = Math.max(0.001, pr - IN0);
      }
    }
    this.err = err;
    // 침목: 굴러간 거리 = 바퀴 반지름 × 회전각
    const dist = this.player.u * Math.PI * 2 * RW;
    const off = ((dist % SP) + SP) % SP;
    for (let i = 0; i < this.sleepers.count; i++) {
      this.dummy.position.set(-3.33 + i * SP - off + SP, 0.13, 0);
      this.dummy.updateMatrix();
      this.sleepers.setMatrixAt(i, this.dummy.matrix);
    }
    this.sleepers.instanceMatrix.needsUpdate = true;
  }

  private puff(): void {
    this.puffs++;
    const P = this.parts;
    const k = 0.5 + Math.min(1, this.omega / 3) * 0.8;
    for (let i = 0; i < 16; i++) {
      const r = Math.random;
      P.spawn({ pos: v3(1.8 + (r() - 0.5) * 0.06, 2.3, (r() - 0.5) * 0.06), vel: v3((r() - 0.5) * 0.3 - 0.4 * k, 1.6 * k + r() * 0.8, (r() - 0.5) * 0.3), color: 0xe2e7ec, size: 0.16, grow: 0.8, life: 1.6, alpha: 0.9, drag: 1.4, ay: 0.3 });
    }
  }

  private ports(s: Side): { fa: boolean; ra: boolean; fe: boolean; re: boolean } {
    const steam = this.regulator > 0.02 || this.player.seg !== null;
    return { fa: steam && -s.d > LAP, ra: steam && s.d > LAP, fe: s.d > 0.004, re: s.d < -0.004 };
  }

  update(dt: number, t: number): void {
    const target = this.regulator * 3.2;
    this.omega = approach(this.omega, target, 0.7, dt);
    this.player.update(dt, this.omega / (Math.PI * 2));
    this.solve(this.player.u, dt);
    const R = this.sides[0]!;
    const p = this.ports(R);
    const live = (m: THREE.MeshStandardMaterial, adm: boolean, exh: boolean): void => {
      m.color.setHex(adm ? COL.steam : exh ? COL.used : COL.steam);
      m.emissiveIntensity = adm ? 0.4 : exh ? 0 : 0.15;
      m.opacity = adm ? 0.78 : exh ? 0.22 : 0.45;
    };
    if (R.fMat && R.rMat) {
      live(R.fMat, p.fa, p.fe);
      live(R.rMat, p.ra, p.re);
    }
    const steamOn = this.regulator > 0.02 || this.player.seg !== null;
    this.chestSteam.visible = steamOn;
    this.regDisc.rotation.x = (this.player.seg ? 0.6 : this.regulator) * (Math.PI / 2);
    this.mainFlow.target = steamOn ? 1 : 0;
    this.fAdm.target = p.fa ? 1 : 0;
    this.rAdm.target = p.ra ? 1 : 0;
    this.fExh.target = p.fe ? 1 : 0;
    this.rExh.target = p.re ? 1 : 0;
    const rate = this.player.rate;
    const blast = Math.min(1, rate * 2.2);
    this.fire.level = 0.35 + 0.65 * blast;
    for (const g of this.gas) {
      g.target = 1;
      g.speed = 0.4 + blast * 1.4;
    }
    for (const f of [this.mainFlow, this.fAdm, this.rAdm, this.fExh, this.rExh]) f.speed = 0.35 + rate * 1.8;
    for (const f of this.flows) f.update(dt);
    // 힘 화살표: 증기가 들어가는 쪽에서 피스톤을 민다
    const show = this.stage >= 3 && this.stage <= 5 && (p.fa || p.ra) ? 1 : 0;
    this.pK = approach(this.pK, show, 6, dt);
    if (p.fa) aimArrow(this.pushArrow, v3(Math.min(IN1 - 0.01, R.px + 0.2), AY + 0.05, ZC + 0.1), v3(-1, 0, 0));
    else if (p.ra) aimArrow(this.pushArrow, v3(Math.max(IN0 + 0.01, R.px - 0.2), AY + 0.05, ZC + 0.1), v3(1, 0, 0));
    fadeGroup(this.pushArrow, this.pK);

    this.fire.update(t);
    const P = this.parts;
    this.acc.smoke += dt * (5 + blast * 14);
    while (this.acc.smoke > 1) {
      this.acc.smoke--;
      const r = Math.random;
      P.spawn({ pos: v3(1.8 + (r() - 0.5) * 0.08, 2.3, (r() - 0.5) * 0.08), vel: v3(-0.25 - blast * 0.6, 0.5 + blast * 0.9, (r() - 0.5) * 0.15), color: COL.smoke, size: 0.1, grow: 0.45, life: 2.4, alpha: 0.4, drag: 0.6, ay: 0.15 });
    }
    this.acc.bub += dt * 30;
    while (this.acc.bub > 1) {
      this.acc.bub--;
      const r = Math.random;
      P.spawn({ pos: v3(-0.9 + r() * 2.3, BOIL_Y - 0.25 + r() * 0.1, 0.05 + r() * 0.25), vel: v3(0, 0.35 + r() * 0.2, 0), color: 0xffffff, size: 0.022, life: 0.9, alpha: 0.9 });
    }
    P.update(dt);
  }

  anchor(name: string): THREE.Vector3 | null {
    const R = this.sides[0]!;
    switch (name) {
      case 'firebox': return v3(-1.28, 1.35, 0.25);
      case 'tubes': return v3(0.6, BOIL_Y - 0.05, 0.3);
      case 'water': return v3(-0.3, BOIL_Y - 0.18, 0.32);
      case 'steamSpace': return v3(-0.5, BOIL_Y + 0.27, 0.22);
      case 'dome': return v3(0.1, 1.97, 0.05);
      case 'regulator': return v3(0.1, 1.87, 0.1);
      case 'steamPipe': return v3(1.72, 1.08, 0.44);
      case 'chest': return v3(XV0 + R.d, 0.94, ZC + 0.08);
      case 'frontPort': return v3(2.06, 0.8, ZC + 0.15);
      case 'rearPort': return v3(1.59, 0.8, ZC + 0.15);
      case 'cylinder': return v3(2.0, AY - 0.15, ZC + 0.12);
      case 'piston': return v3(R.px, AY - 0.08, ZC + 0.15);
      case 'crosshead': return v3(R.cross, AY - 0.06, ZC + 0.06);
      case 'conrod': return v3((R.cross + R.conrod.position.x) / 2, (AY + R.conrod.position.y) / 2, ZC);
      case 'coupling': return v3(R.coupling.position.x - 0.45, R.coupling.position.y, ZCR);
      case 'driver': return v3(DRV[0], AY - 0.28, 0.46);
      case 'valveGear': return v3(0.45, 0.82, ZE);
      case 'smokebox': return v3(1.8, 1.0, 0.3);
      case 'blast': return v3(1.8, 1.45, 0.05);
      case 'chimney': return v3(1.8, 2.3, 0);
      case 'rails': return v3(-2.9, 0.22, 0.4);
      case 'cab': return v3(-1.95, 2.25, 0.6);
      default: return null;
    }
  }

  valves(): ValveInfo[] {
    const p = this.ports(this.sides[0]!);
    const reg = this.player.seg ? 60 : Math.round(this.regulator * 100);
    const portText = (adm: boolean, exh: boolean): string => (adm ? '증기 들어감' : exh ? '배기(굴뚝으로)' : '닫힘');
    return [
      { name: '조절 밸브', open: reg > 2, text: reg > 2 ? `${reg}% 열림` : '닫힘' },
      { name: '앞쪽 통로', open: p.fa || p.fe, text: portText(p.fa, p.fe) },
      { name: '뒤쪽 통로', open: p.ra || p.re, text: portText(p.ra, p.re) }
    ];
  }

  force(): string {
    const p = this.ports(this.sides[0]!);
    if (p.fa) return '증기가 피스톤 앞쪽을 밀어 뒤로 보내요';
    if (p.ra) return '증기가 피스톤 뒤쪽을 밀어 앞으로 보내요';
    if (this.regulator <= 0.02 && !this.player.seg) return '조절 밸브가 닫혀 증기가 실린더로 가지 않아요';
    return '밸브가 통로를 바꾸는 순간이에요';
  }

  /** 1회전에 몇 번 배기했는지 세기 위한 누적 배기 횟수 */
  get puffCount(): number {
    return this.puffs;
  }

  /** 동륜이 돈 누적 바퀴 수 */
  get turns(): number {
    return this.player.u;
  }

  /** 동륜 회전(화면 기준, 회전/분) */
  wheelRpm(): number {
    return Math.round(this.player.rate * 60);
  }

  residual(): number {
    return this.err;
  }

  dispose(): void {
    this.parts.dispose();
    this.root.removeFromParent();
  }
}
