// 와트의 회전식 증기 기관 — 분리 응축기·공기 펌프(찬물 통 속), 늘 뜨거운(증기로 감싼) 복동 실린더와 밸브 4개,
// 무쇠 흔들보, 크로스헤드(직선 안내), 연결봉 → 크랭크 → 플라이휠, 벨트로 도는 원심 조속기와 조절 밸브.
// 기구는 크랭크 각에서 출발해 원의 교점으로 흔들보 각을 풀고, 짧은 링크로 크로스헤드·공기 펌프 막대 높이를 구한다.

import * as THREE from 'three';
import { extrude, merge, mesh, shapeFrom, type V2 } from '../../models/parts/geom';
import { brass, castIron, copper, darkSteel, ghost, glass, paint, steel, wood } from '../../models/materials';
import {
  COL,
  Fire,
  Player,
  ValveMark,
  aimArrow,
  approach,
  arrow,
  box,
  brickMat,
  circles,
  cutMat,
  cutSolid,
  cutVolume,
  cyl,
  fadeGroup,
  flange,
  pipe,
  stoneMat,
  v3,
  type Seg,
  type SteamModel,
  type ValveInfo
} from './common';
import { FlowPath, Particles } from './particles';

const PIV = new THREE.Vector2(0, 3.05);
const LB = 1.5;
const S = new THREE.Vector2(1.5, 1.1);
const RC = 0.4;
const LR = 1.95;
const CYLX = -1.5;
const LINK = 0.5;
const BORE0 = 0.52;
const BORE1 = 1.72;
const RI = 0.36;
const PH = 0.12;
const ROD = 1.37;
const AP_ARM = 0.45;
const AP_X = -0.45;
const AP_LINK = 0.3;
const AP_ROD = 2.35;
const CND = new THREE.Vector3(-0.75, 0, 0.28);
const GAP = 2.0;
const DIR = 0.3;
const OMEGA_N = 2.4;
const GOV = new THREE.Vector3(2.3, 3.1, -1.1);
const ARM = 0.3;
const ARM_AT = 0.15;
const GLINK = 0.17;
const COLLAR = 0.035;
const LEV_PIV = new THREE.Vector2(2.45, 0);
const LEV_L = 0.15;
const LEV_R = 0.25;
const VALVE_AX = new THREE.Vector2(2.6, 2.3);
const VCRANK = 0.1;
const BETA_N = 0.6;
const PULLEY = [0.2, 0.11] as const;

/** 단계별 재생 구간 — u=0 피스톤 꼭대기, 0.5 바닥 */
export const WATT_SEGS: (Seg | null)[] = [null, { a: 0.02, b: 0.48, dur: 3.4 }, { a: 0.02, b: 0.48, dur: 3.4 }, { a: 0.52, b: 0.98, dur: 3.4 }, null, null, null];

export type Load = 'light' | 'normal' | 'heavy';
const LOAD: Record<Load, number> = { light: 0.6, normal: 1, heavy: 1.5 };

function unit<T extends THREE.Object3D>(o: T): T {
  o.userData.unit = true;
  return o;
}

function sleeveOf(beta: number): number {
  const ax = ARM_AT * Math.sin(beta);
  const ay = -ARM_AT * Math.cos(beta);
  return GOV.y + ay - Math.sqrt(GLINK * GLINK - (ax - COLLAR) * (ax - COLLAR));
}
const SLEEVE_N = sleeveOf(BETA_N);

export class WattModel implements SteamModel {
  readonly root = new THREE.Group();
  private player = new Player();
  private beam = new THREE.Group();
  private piston = new THREE.Group();
  private link: THREE.Mesh;
  private apRod = new THREE.Group();
  private apLink: THREE.Mesh;
  private conrod: THREE.Mesh;
  private crank = new THREE.Group();
  private flywheel: THREE.Mesh;
  private govPulley: THREE.Mesh;
  private govSpin = new THREE.Group();
  private govArms: THREE.Group[] = [];
  private govLinks: THREE.Mesh[] = [];
  private sleeve: THREE.Mesh;
  private lever: THREE.Mesh;
  private vrod: THREE.Mesh;
  private vcrank: THREE.Mesh;
  private top: THREE.Group;
  private bot: THREE.Group;
  private topMat: THREE.MeshStandardMaterial;
  private botMat: THREE.MeshStandardMaterial;
  private marks: ValveMark[] = [];
  private pushArrow: THREE.Group;
  private turnArrow: THREE.Group;
  private fire: Fire;
  private parts = new Particles(1400);
  private flows: Record<'main' | 'topIn' | 'botIn' | 'topOut' | 'botOut' | 'air' | 'inj', FlowPath>;
  private acc = { cond: 0, spray: 0, smoke: 0, jet: 0 };
  private stage = 0;
  private u = 0;
  private alpha = 0;
  private theta = 0;
  private err = 0;
  private pK = 0;
  private tK = 0;
  private lastAp = 0;
  private apUp = false;

  // 조속기 상태
  omega = OMEGA_N;
  load: Load = 'normal';
  governor = true;
  throttle = 0.5;
  private beta = BETA_N;
  private psi = 0;

  constructor() {
    const root = this.root;
    const stone = stoneMat();
    const iron = castIron();
    const dark = darkSteel();
    const bright = steel();
    const cut = cutMat();
    const brick = brickMat();
    const green = paint(0x3d5a45, { roughness: 0.5 });

    // 바닥·받침
    box(root, stone, -2.6, 0, -1.25, 2.95, 0.03, 0.85);
    box(root, stone, -1.98, 0.03, -0.58, -1.02, 0.42, 0.58);

    // ── 실린더(복동, 위아래 막힘) ──
    const liner: V2[] = [[0, 0.42], [0.5, 0.42], [0.5, 0.52], [0.39, 0.52], [0.39, 1.72], [0.5, 1.72], [0.5, 1.82], [0.05, 1.82], [0.05, BORE1], [RI, BORE1], [RI, BORE0], [0, BORE0]];
    const c1 = cutSolid(liner, GAP, DIR, iron, cut);
    c1.position.x = CYLX;
    root.add(c1);
    const jacketWall = cutSolid([[0.43, 0.52], [0.46, 0.52], [0.46, 1.72], [0.43, 1.72]], GAP, DIR, green, cut);
    jacketWall.position.x = CYLX;
    root.add(jacketWall);
    const jm = ghost(COL.steam, 0.75);
    jm.emissive = new THREE.Color(0xff9db8);
    jm.emissiveIntensity = 0.25;
    const jacket = cutSolid([[0.39, 0.52], [0.43, 0.52], [0.43, 1.72], [0.39, 1.72]], GAP, DIR, jm, jm, 40);
    jacket.position.x = CYLX;
    jacket.traverse((o) => (o.userData.noAO = true));
    root.add(jacket);
    cyl(root, iron, 0.08, 0.1, 'y', v3(CYLX, 1.87, 0));
    // 증기 공간(위·아래)
    this.topMat = ghost(COL.steam, 0.6);
    this.topMat.emissive = new THREE.Color(COL.steam);
    this.botMat = ghost(COL.steam, 0.6);
    this.botMat.emissive = new THREE.Color(COL.steam);
    this.top = cutVolume(RI - 0.004, GAP, DIR, this.topMat);
    this.bot = cutVolume(RI - 0.004, GAP, DIR, this.botMat);
    this.top.position.x = CYLX;
    this.bot.position.set(CYLX, BORE0, 0);
    root.add(this.top, this.bot);

    // 피스톤 + 막대 + 크로스헤드 (원점 = 피스톤 아랫면)
    const pg = new THREE.CylinderGeometry(RI - 0.006, RI - 0.006, PH, 48);
    pg.translate(0, PH / 2, 0);
    mesh(pg, iron, this.piston);
    const rg = new THREE.CylinderGeometry(0.045, 0.045, ROD, 16);
    rg.translate(0, PH + ROD / 2, 0);
    mesh(rg, bright, this.piston);
    box(this.piston, dark, -0.1, PH + ROD - 0.04, -0.11, 0.1, PH + ROD + 0.05, 0.11);
    cyl(this.piston, bright, 0.03, 0.26, 'z', v3(0, PH + ROD, 0));
    this.piston.position.x = CYLX;
    root.add(this.piston);
    // 안내 막대
    for (const z of [-0.13, 0.13]) box(root, bright, CYLX - 0.03, 1.82, z - 0.02, CYLX + 0.03, 3.0, z + 0.02);
    box(root, iron, CYLX - 0.05, 1.82, -0.17, CYLX + 0.05, 1.86, 0.17);

    this.pushArrow = arrow(COL.force, 0.42, 0.03);
    root.add(this.pushArrow);

    // ── 밸브 상자(실린더 왼쪽) ──
    const chest = castIron({ color: 0x4b5157 });
    box(root, chest, -2.3, 1.5, -0.16, -1.96, 1.92, 0.16);
    box(root, chest, -2.3, 0.45, -0.16, -1.96, 0.85, 0.16);
    box(root, chest, -2.0, 1.62, -0.07, -1.9, 1.7, 0.07);
    box(root, chest, -2.0, 0.54, -0.07, -1.9, 0.62, 0.07);
    cyl(root, chest, 0.04, 0.66, 'y', v3(-2.2, 1.175, 0.12));
    cyl(root, chest, 0.04, 0.66, 'y', v3(-2.2, 1.175, -0.12));
    const valveY = [1.8, 1.6, 0.75, 0.55];
    const valveZ = [0.08, -0.08, 0.08, -0.08];
    valveY.forEach((y, i) => {
      cyl(root, brass(), 0.035, 0.08, 'x', v3(-2.34, y, valveZ[i]!));
      cyl(root, bright, 0.012, 0.1, 'x', v3(-2.42, y, valveZ[i]!));
      this.marks.push(new ValveMark(root, v3(-2.48, y, valveZ[i]!), 0.03));
    });

    // ── 보일러(마차형)·화로·굴뚝 ──
    box(root, brick, 0.9, 0.03, -2.05, 2.75, 0.45, -1.9);
    box(root, brick, 0.9, 0.03, -1.46, 2.75, 0.45, -1.3);
    box(root, brick, 0.9, 0.03, -1.9, 1.05, 0.45, -1.46);
    const fd = new THREE.Shape([new THREE.Vector2(-2.05, 0.03), new THREE.Vector2(-1.3, 0.03), new THREE.Vector2(-1.3, 0.45), new THREE.Vector2(-2.05, 0.45)]);
    const hole = new THREE.Path();
    hole.moveTo(-1.82, 0.07);
    hole.lineTo(-1.54, 0.07);
    hole.lineTo(-1.54, 0.24);
    hole.absarc(-1.68, 0.24, 0.14, 0, Math.PI, false);
    hole.lineTo(-1.82, 0.07);
    fd.holes.push(hole);
    const fdg = extrude(fd, 0.12, 0);
    fdg.rotateY(-Math.PI / 2);
    const fdm = mesh(fdg, brick, root);
    fdm.position.x = 2.69;
    this.fire = new Fire(0.5, 0.4, 0.3, 2.0);
    this.fire.group.position.set(2.35, 0.05, -1.68);
    root.add(this.fire.group);
    const wag: V2[] = [[-0.32, 0], [0.32, 0], [0.32, 0.26]];
    for (let i = 1; i < 16; i++) {
      const a = (i / 16) * Math.PI;
      wag.push([0.32 * Math.cos(a), 0.26 + 0.32 * Math.sin(a)]);
    }
    wag.push([-0.32, 0.26]);
    const wg = extrude(shapeFrom(wag), 1.8, 0.02);
    wg.rotateY(Math.PI / 2);
    const wm = mesh(wg, castIron({ color: 0x5b5048 }), root);
    wm.position.set(1.85, 0.45, -1.68);
    cyl(root, castIron({ color: 0x5b5048 }), 0.09, 0.16, 'y', v3(2.45, 1.08, -1.68));
    box(root, brick, 0.6, 0.03, -1.86, 0.95, 3.5, -1.5);
    box(root, stone, 0.56, 3.45, -1.9, 0.99, 3.56, -1.46);

    // ── 증기관·조절 밸브 ──
    const pipeMat = copper();
    pipe([v3(2.45, 1.1, -1.68), v3(2.45, 2.3, -1.68), v3(2.45, 2.3, -1.2)], 0.05, pipeMat, root);
    pipe([v3(2.2, 2.3, -1.1), v3(-2.12, 2.3, -1.1), v3(-2.12, 2.3, 0), v3(-2.12, 1.92, 0)], 0.05, pipeMat, root);
    flange(root, pipeMat, v3(-2.12, 1.93, 0), 'y', 0.08);
    box(root, iron, 2.2, 2.18, -1.2, 2.7, 2.42, -1.0);
    // 조속기 기둥·기어 상자
    box(root, dark, 2.22, 2.42, -1.18, 2.38, 2.5, -1.02);
    cyl(root, bright, 0.018, 0.75, 'y', v3(GOV.x, 2.82, GOV.z));
    cyl(root, bright, 0.016, 0.14, 'z', v3(GOV.x, 2.46, -0.96));
    // 벨트 풀리
    const pul = (r: number): THREE.BufferGeometry => {
      const g = new THREE.CylinderGeometry(r, r, 0.06, 32);
      g.rotateX(Math.PI / 2);
      return g;
    };
    this.govPulley = mesh(pul(PULLEY[1]), iron, root);
    this.govPulley.position.set(GOV.x, 2.46, -0.92);
    box(this.govPulley, dark, -0.012, 0, -0.035, 0.012, PULLEY[1], 0.035);
    this.buildBelt(root, new THREE.Vector2(S.x, S.y), PULLEY[0], new THREE.Vector2(GOV.x, 2.46), PULLEY[1], -0.92);
    // 조속기 팔·공
    this.govSpin.position.copy(GOV);
    root.add(this.govSpin);
    cyl(this.govSpin, brass(), 0.03, 0.04, 'y', v3(0, 0.02, 0));
    for (let k = 0; k < 2; k++) {
      const g = new THREE.Group();
      const armM = new THREE.Mesh(new THREE.BoxGeometry(0.018, ARM, 0.018), bright);
      armM.geometry.translate(0, -ARM / 2, 0);
      armM.castShadow = true;
      g.add(armM);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.055, 24, 16), brass());
      ball.position.y = -ARM;
      ball.castShadow = true;
      g.add(ball);
      this.govSpin.add(g);
      this.govArms.push(g);
      const lk = unit(new THREE.Mesh(new THREE.BoxGeometry(0.012, 1, 0.012), bright));
      this.govSpin.add(lk);
      this.govLinks.push(lk);
    }
    this.sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 20), brass());
    this.sleeve.castShadow = true;
    this.govSpin.add(this.sleeve);
    // 지렛대·막대·밸브 크랭크
    box(root, dark, LEV_PIV.x - 0.015, 2.42, -1.04, LEV_PIV.x + 0.015, SLEEVE_N, -1.0);
    const lv = new THREE.BoxGeometry(LEV_L + LEV_R, 0.022, 0.02);
    lv.translate((LEV_R - LEV_L) / 2, 0, 0);
    this.lever = mesh(lv, dark, root);
    this.lever.position.set(LEV_PIV.x, SLEEVE_N, -1.02);
    this.vrod = unit(mesh(new THREE.BoxGeometry(0.014, 1, 0.014), bright, root));
    const vc = new THREE.BoxGeometry(VCRANK, 0.02, 0.016);
    vc.translate(VCRANK / 2, 0, 0);
    this.vcrank = mesh(vc, dark, root);
    this.vcrank.position.set(VALVE_AX.x, VALVE_AX.y, -0.985);

    // ── 흔들보·기둥 ──
    for (const z of [-0.3, 0.3]) {
      const col: V2[] = [[0, 0.03], [0.15, 0.03], [0.15, 0.12], [0.1, 0.18], [0.085, 2.7], [0.13, 2.78], [0.13, 2.86], [0, 2.86]];
      const cg = cutSolid(col, 0, 0, iron, undefined, 32);
      cg.position.z = z;
      root.add(cg);
      box(root, dark, -0.1, 2.86, z - 0.08, 0.1, 3.12, z + 0.08);
    }
    cyl(root, bright, 0.04, 0.76, 'z', v3(PIV.x, PIV.y, 0));
    this.beam.position.set(PIV.x, PIV.y, 0);
    root.add(this.beam);
    const belly: V2[] = [];
    const N = 24;
    for (let i = 0; i <= N; i++) {
      const x = -1.6 + (3.2 * i) / N;
      belly.push([x, 0.08 + 0.15 * (1 - (x / 1.6) ** 2)]);
    }
    for (let i = N; i >= 0; i--) {
      const x = -1.6 + (3.2 * i) / N;
      belly.push([x, -(0.08 + 0.15 * (1 - (x / 1.6) ** 2))]);
    }
    const bs = shapeFrom(belly);
    for (const cx of [-0.85, 0.85]) {
      const h = new THREE.Path();
      h.absellipse(cx, 0, 0.33, 0.07, 0, Math.PI * 2, true, 0);
      bs.holes.push(h);
    }
    mesh(extrude(bs, 0.08, 0.012), iron, this.beam);
    for (const x of [-LB, LB, 0, -AP_ARM]) cyl(this.beam, x === 0 ? iron : bright, x === 0 ? 0.09 : 0.045, x === 0 ? 0.14 : 0.2, 'z', v3(x, 0, 0));

    // 크로스헤드 링크
    this.link = unit(mesh(new THREE.BoxGeometry(0.05, 1, 0.03), dark, root));
    // 공기 펌프 막대
    const apg = new THREE.CylinderGeometry(0.025, 0.025, AP_ROD, 12);
    apg.translate(0, -AP_ROD / 2, 0);
    mesh(apg, bright, this.apRod);
    const bucket = new THREE.CylinderGeometry(0.115, 0.115, 0.07, 32);
    bucket.translate(0, -AP_ROD, 0);
    mesh(bucket, brass(), this.apRod);
    this.apRod.position.x = AP_X;
    root.add(this.apRod);
    this.apLink = unit(mesh(new THREE.BoxGeometry(0.04, 1, 0.025), dark, root));

    // ── 찬물 통·응축기·공기 펌프 ──
    const plate = castIron({ color: 0x55606b });
    box(root, plate, -0.98, 0.03, -0.45, -0.2, 0.06, 0.6);
    box(root, plate, -0.98, 0.03, -0.45, -0.95, 0.85, 0.6);
    box(root, plate, -0.23, 0.03, -0.45, -0.2, 0.85, 0.6);
    box(root, plate, -0.98, 0.03, -0.45, -0.2, 0.85, -0.42);
    const gl = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.8, 0.01), glass(0xcfe8ff, 0.12));
    gl.position.set(-0.59, 0.45, 0.595);
    root.add(gl);
    const cw = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.66, 1.0), ghost(COL.cold, 0.22));
    cw.position.set(-0.59, 0.39, 0.075);
    cw.userData.noAO = true;
    root.add(cw);
    const cndShell = cutSolid([[0, 0.08], [0.15, 0.08], [0.15, 0.7], [0.13, 0.7], [0.13, 0.11], [0, 0.11]], 2.4, 0.1, copper(), cut);
    cndShell.position.set(CND.x, 0, CND.z);
    root.add(cndShell);
    cyl(root, copper(), 0.15, 0.03, 'y', v3(CND.x, 0.715, CND.z));
    const apShell = cutSolid([[0.12, 0.08], [0.14, 0.08], [0.14, 0.74], [0.12, 0.74]], 1.8, 0.2, brass(), cut);
    apShell.position.set(AP_X, 0, 0);
    root.add(apShell);
    box(root, brass(), AP_X - 0.16, 0.74, -0.16, AP_X + 0.16, 0.77, 0.16);
    pipe([v3(CND.x, 0.14, CND.z - 0.1), v3(CND.x, 0.14, 0.12), v3(AP_X - 0.05, 0.14, 0.12), v3(AP_X - 0.05, 0.14, 0.05)], 0.035, copper(), root, 0.05);
    // 온수 통
    const tub = cutSolid([[0, 0.03], [0.16, 0.03], [0.18, 0.36], [0.16, 0.36], [0.14, 0.06], [0, 0.06]], 0, 0, wood(0x7a5232), undefined, 32);
    tub.position.set(AP_X, 0, -0.72);
    root.add(tub);
    const tw = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.2, 24), ghost(COL.water, 0.6));
    tw.position.set(AP_X, 0.16, -0.72);
    root.add(tw);
    pipe([v3(AP_X + 0.08, 0.76, -0.05), v3(AP_X + 0.08, 0.95, -0.05), v3(AP_X + 0.08, 0.95, -0.66), v3(AP_X + 0.08, 0.5, -0.66)], 0.03, copper(), root, 0.05);
    // 배기관(밸브 상자 → 응축기)
    const exh = [v3(-2.12, 0.45, 0), v3(-2.12, 0.3, 0), v3(-2.12, 0.3, -0.75), v3(-0.75, 0.3, -0.75), v3(-0.75, 0.3, CND.z - 0.14)];
    pipe(exh, 0.05, castIron({ color: 0x4b5157 }), root);

    // ── 크랭크·플라이휠 ──
    for (const z of [-0.18, -0.78]) {
      box(root, iron, S.x - 0.13, 0.03, z - 0.07, S.x + 0.13, 1.03, z + 0.07);
      box(root, dark, S.x - 0.1, 1.03, z - 0.07, S.x + 0.1, 1.18, z + 0.07);
    }
    cyl(root, bright, 0.06, 1.16, 'z', v3(S.x, S.y, -0.44));
    this.crank.position.set(S.x, S.y, 0);
    root.add(this.crank);
    box(this.crank, iron, -0.08, -0.07, 0.08, RC + 0.06, 0.07, 0.14);
    cyl(this.crank, bright, 0.04, 0.17, 'z', v3(RC, 0, 0.03));
    const fwParts: THREE.BufferGeometry[] = [];
    const rim = new THREE.LatheGeometry([new THREE.Vector2(0.84, -0.06), new THREE.Vector2(0.95, -0.06), new THREE.Vector2(0.95, 0.06), new THREE.Vector2(0.84, 0.06), new THREE.Vector2(0.84, -0.06)], 72);
    rim.rotateX(Math.PI / 2);
    fwParts.push(rim);
    for (let i = 0; i < 6; i++) {
      const sp = new THREE.BoxGeometry(0.76, 0.07, 0.05);
      sp.translate(0.48, 0, 0);
      sp.rotateZ((i / 6) * Math.PI * 2);
      fwParts.push(sp);
    }
    const hub = new THREE.CylinderGeometry(0.13, 0.13, 0.15, 32);
    hub.rotateX(Math.PI / 2);
    fwParts.push(hub);
    this.flywheel = mesh(merge(fwParts), iron, root);
    this.flywheel.position.set(S.x, S.y, -0.48);
    const mp = mesh(pul(PULLEY[0]), iron, this.flywheel);
    mp.position.z = -0.44;
    this.conrod = mesh(new THREE.BoxGeometry(0.07, LR, 0.05), iron, root);
    this.turnArrow = this.makeTurnArrow();
    this.turnArrow.position.set(S.x, S.y, 0.2);
    root.add(this.turnArrow);

    // ── 흐름 ──
    const exhTail = exh.slice(1).concat([v3(CND.x, 0.42, CND.z)]);
    this.flows = {
      main: new FlowPath([v3(2.45, 1.1, -1.68), v3(2.45, 2.3, -1.68), v3(2.45, 2.3, -1.1), v3(-2.12, 2.3, -1.1), v3(-2.12, 2.3, 0), v3(-2.12, 1.86, 0)], COL.steam, 0.026, 0.12, 0.9),
      topIn: new FlowPath([v3(-2.12, 1.84, 0.05), v3(-2.0, 1.66, 0.05), v3(-1.5, 1.66, 0.12)], COL.steam, 0.026, 0.07, 0.45),
      botIn: new FlowPath([v3(-2.2, 1.5, 0.12), v3(-2.2, 0.82, 0.12), v3(-2.0, 0.58, 0.05), v3(-1.5, 0.58, 0.12)], COL.steam, 0.026, 0.08, 0.6),
      topOut: new FlowPath([v3(-1.5, 1.66, 0.12), v3(-2.0, 1.66, 0), v3(-2.2, 1.55, -0.12), v3(-2.2, 0.8, -0.12), ...exhTail], COL.used, 0.024, 0.09, 0.8),
      botOut: new FlowPath([v3(-1.5, 0.58, 0.12), v3(-2.0, 0.58, 0), ...exhTail], COL.used, 0.024, 0.09, 0.8),
      air: new FlowPath([v3(AP_X + 0.08, 0.6, -0.05), v3(AP_X + 0.08, 0.95, -0.05), v3(AP_X + 0.08, 0.95, -0.66), v3(AP_X + 0.08, 0.45, -0.66)], COL.water, 0.022, 0.08, 0.5),
      inj: new FlowPath([v3(CND.x + 0.1, 0.6, CND.z + 0.3), v3(CND.x + 0.1, 0.78, CND.z + 0.1), v3(CND.x, 0.66, CND.z)], COL.cold, 0.02, 0.06, 0.4)
    };
    for (const f of Object.values(this.flows)) root.add(f.mesh);
    root.add(this.parts.points);
    this.solve(0, 0);
  }

  private buildBelt(root: THREE.Object3D, c1: THREE.Vector2, r1: number, c2: THREE.Vector2, r2: number, z: number): void {
    const d = c2.clone().sub(c1);
    const L = d.length();
    const phi = Math.atan2(d.y, d.x);
    const b = Math.acos((r1 - r2) / L);
    const pts: THREE.Vector3[] = [];
    const n = 24;
    // 큰 풀리: φ+β → φ+2π-β(뒤쪽으로 감김), 작은 풀리: φ-β → φ+β
    for (let i = 0; i <= n; i++) {
      const a = phi + b + ((2 * Math.PI - 2 * b) * i) / n;
      pts.push(new THREE.Vector3(c1.x + r1 * Math.cos(a), c1.y + r1 * Math.sin(a), z));
    }
    for (let i = 0; i <= n; i++) {
      const a = phi - b + (2 * b * i) / n;
      pts.push(new THREE.Vector3(c2.x + r2 * Math.cos(a), c2.y + r2 * Math.sin(a), z));
    }
    const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.1);
    const g = new THREE.TubeGeometry(curve, 160, 0.012, 6, true);
    g.scale(1, 1, 3);
    g.translate(0, 0, -2 * z);
    mesh(g, wood(0x5a3a22, { roughness: 0.8 }), root);
  }

  private makeTurnArrow(): THREE.Group {
    const g = new THREE.Group();
    const mat = paint(COL.force);
    mat.emissive = new THREE.Color(COL.force);
    mat.emissiveIntensity = 0.5;
    mat.transparent = true;
    const tor = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.025, 8, 48, Math.PI * 1.3), mat);
    g.add(tor);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.15, 16), mat);
    const a = Math.PI * 1.3;
    cone.position.set(0.62 * Math.cos(a), 0.62 * Math.sin(a), 0);
    cone.rotation.z = a;
    g.add(cone);
    g.traverse((o) => (o.userData.noAO = true));
    return g;
  }

  setStage(i: number): void {
    this.stage = i;
    this.player.play(WATT_SEGS[i] ?? null);
  }

  setLoad(l: Load): void {
    this.load = l;
  }

  private beamFromCrank(alpha: number): number {
    const px = S.x + RC * Math.cos(alpha);
    const py = S.y + RC * Math.sin(alpha);
    const sol = circles(PIV.x, PIV.y, LB, px, py, LR);
    if (!sol) return this.theta;
    const [a, b] = sol;
    const p = a[1] > b[1] ? a : b;
    return Math.atan2(p[1] - PIV.y, p[0] - PIV.x);
  }

  private solve(u: number, dt: number): void {
    this.u = u;
    const alpha = -Math.PI / 2 + Math.PI * 2 * u;
    this.alpha = alpha;
    const th = this.beamFromCrank(alpha);
    this.theta = th;
    this.beam.rotation.z = th;
    // 왼쪽 끝 → 크로스헤드
    const ex = PIV.x - LB * Math.cos(th);
    const ey = PIV.y - LB * Math.sin(th);
    const cy = ey - Math.sqrt(LINK * LINK - (CYLX - ex) * (CYLX - ex));
    const pBottom = cy - ROD - PH;
    this.piston.position.y = pBottom;
    this.placeBar(this.link, ex, ey, CYLX, cy, 0.07);
    // 공기 펌프
    const ax = PIV.x - AP_ARM * Math.cos(th);
    const ay = PIV.y - AP_ARM * Math.sin(th);
    const ry = ay - Math.sqrt(AP_LINK * AP_LINK - (AP_X - ax) * (AP_X - ax));
    if (dt > 0) this.apUp = ry > this.lastAp;
    this.lastAp = ry;
    this.apRod.position.y = ry;
    this.placeBar(this.apLink, ax, ay, AP_X, ry, 0.06);
    // 크랭크·연결봉
    this.crank.rotation.z = alpha;
    this.flywheel.rotation.z = alpha;
    const px = S.x + RC * Math.cos(alpha);
    const py = S.y + RC * Math.sin(alpha);
    const rx = PIV.x + LB * Math.cos(th);
    const ry2 = PIV.y + LB * Math.sin(th);
    this.placeBar(this.conrod, px, py, rx, ry2, 0.0);
    this.err = Math.max(Math.abs(Math.hypot(rx - px, ry2 - py) - LR), Math.abs(Math.hypot(CYLX - ex, cy - ey) - LINK));
    // 증기 공간
    const pTop = pBottom + PH;
    this.top.position.y = pTop;
    this.top.scale.y = Math.max(0.001, BORE1 - pTop);
    this.bot.scale.y = Math.max(0.001, pBottom - BORE0);
  }

  /** 길이 1짜리 막대(세로)를 두 점 사이에 놓는다 */
  private placeBar(m: THREE.Mesh, x0: number, y0: number, x1: number, y1: number, z: number): void {
    const len = Math.hypot(x1 - x0, y1 - y0);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, z);
    m.rotation.z = Math.atan2(y1 - y0, x1 - x0) - Math.PI / 2;
    if (m.userData.unit) m.scale.y = len;
  }

  private down(): boolean {
    return this.u < 0.5;
  }

  update(dt: number, t: number): void {
    // 조속기 → 조절 밸브 → 속도
    const L = LOAD[this.load];
    // 단계 보기(느린 재생) 중에도 조속기는 기관의 실제 속도(omega)에 반응한다
    const targetBeta = Math.min(1.0, Math.max(0.3, BETA_N + 0.9 * (this.omega / OMEGA_N - 1)));
    this.beta = approach(this.beta, targetBeta, 4, dt);
    const sleeveY = sleeveOf(this.beta);
    const sinL = Math.max(-0.95, Math.min(0.95, (sleeveY - SLEEVE_N) / LEV_L));
    const lam = Math.asin(sinL);
    const qx = LEV_PIV.x + LEV_R * Math.cos(lam);
    const qy = SLEEVE_N - LEV_R * Math.sin(lam);
    const vrodLen = SLEEVE_N - VALVE_AX.y;
    const sol = circles(VALVE_AX.x, VALVE_AX.y, VCRANK, qx, qy, vrodLen);
    let mu = 0;
    if (sol) {
      const p = sol[0][0] > sol[1][0] ? sol[0] : sol[1];
      mu = Math.atan2(p[1] - VALVE_AX.y, p[0] - VALVE_AX.x);
      const cx = VALVE_AX.x + VCRANK * Math.cos(mu);
      const cyy = VALVE_AX.y + VCRANK * Math.sin(mu);
      this.placeBar(this.vrod, cx, cyy, qx, qy, -1.0);
    }
    this.lever.rotation.z = -lam;
    // 조속기를 끄면 지렛대와 밸브 사이 연결봉을 떼어 낸 것으로 보여 준다(밸브는 가운데에 고정)
    this.vrod.visible = this.governor;
    this.vcrank.rotation.z = this.governor ? mu : 0;
    const open = this.governor ? Math.min(1, Math.max(0.05, 0.5 + mu * 1.2)) : 0.5;
    this.throttle = open;
    this.omega += (2 * OMEGA_N * open - L * this.omega) * 1.1 * dt;
    this.omega = Math.max(0.2, this.omega);

    this.player.update(dt, this.omega / (Math.PI * 2));
    this.solve(this.player.phase, dt);

    // 조속기 회전
    this.psi += (dt * (this.player.rate * Math.PI * 2) * PULLEY[0]) / PULLEY[1];
    this.govSpin.rotation.y = this.psi;
    this.govPulley.rotation.z = this.psi;
    this.govArms.forEach((g, i) => {
      g.rotation.z = (i === 0 ? -1 : 1) * this.beta;
    });
    const ax = ARM_AT * Math.sin(this.beta);
    const ay = -ARM_AT * Math.cos(this.beta);
    const sy = sleeveY - GOV.y;
    this.sleeve.position.y = sy;
    this.govLinks.forEach((lk, i) => {
      const s = i === 0 ? -1 : 1;
      this.placeBar(lk, s * ax, ay, s * COLLAR, sy, 0);
    });

    // 밸브
    const dn = this.down();
    const st = [dn, !dn, !dn, dn]; // 위 증기, 위 배기, 아래 증기, 아래 배기
    st.forEach((o, i) => this.marks[i]!.set(o));
    // 증기 공간 색: 들어오는 증기는 진하게, 응축기로 빠지는 쪽은 옅은 회색
    const live = (m: THREE.MeshStandardMaterial, on: boolean): void => {
      m.color.setHex(on ? COL.steam : COL.used);
      m.emissive.setHex(on ? 0xff9db8 : 0x000000);
      m.emissiveIntensity = on ? 0.35 : 0;
      m.opacity = on ? 0.72 : 0.22;
    };
    live(this.topMat, dn);
    live(this.botMat, !dn);
    this.flows.main.target = 1;
    this.flows.topIn.target = dn ? 1 : 0;
    this.flows.botOut.target = dn ? 1 : 0;
    this.flows.botIn.target = dn ? 0 : 1;
    this.flows.topOut.target = dn ? 0 : 1;
    this.flows.air.target = this.apUp ? 1 : 0;
    this.flows.inj.target = 1;
    const sp = 0.4 + this.player.rate * 2;
    for (const f of Object.values(this.flows)) {
      f.speed = sp * (f === this.flows.main ? 1.6 : 1);
      f.update(dt);
    }

    // 화살표
    const pt = this.stage >= 1 && this.stage <= 3 ? 1 : 0;
    this.pK = approach(this.pK, pt, 6, dt);
    const py = this.piston.position.y;
    if (dn) aimArrow(this.pushArrow, v3(CYLX + 0.12, Math.min(BORE1 - 0.02, py + PH + 0.42), 0.12), v3(0, -1, 0));
    else aimArrow(this.pushArrow, v3(CYLX + 0.12, Math.max(BORE0 + 0.02, py - 0.42), 0.12), v3(0, 1, 0));
    fadeGroup(this.pushArrow, this.pK);
    this.tK = approach(this.tK, this.stage === 4 ? 1 : 0, 6, dt);
    fadeGroup(this.turnArrow, this.tK);
    this.turnArrow.rotation.z = (t * 0.6) % (Math.PI * 2);

    this.fire.level = 0.5 + 0.5 * this.throttle;
    this.fire.update(t);
    this.emit(dt, dn);
    this.parts.update(dt);
  }

  private emit(dt: number, dn: boolean): void {
    const P = this.parts;
    const a = this.acc;
    const rnd = Math.random;
    const k = 0.4 + this.player.rate * 2.2;
    a.cond += dt * 26 * k;
    while (a.cond > 1) {
      a.cond--;
      P.spawn({ pos: v3(CND.x + (rnd() - 0.5) * 0.08, 0.36, CND.z + 0.02), vel: v3((rnd() - 0.5) * 0.3, 0.3 + rnd() * 0.3, (rnd() - 0.2) * 0.2), color: COL.used, size: 0.05, grow: -0.05, life: 0.45, alpha: 0.7, drag: 3 });
    }
    a.spray += dt * 50;
    while (a.spray > 1) {
      a.spray--;
      P.spawn({ pos: v3(CND.x, 0.67, CND.z), vel: v3((rnd() - 0.5) * 0.5, -0.4 - rnd() * 0.6, (rnd() - 0.2) * 0.5), color: COL.cold, size: 0.025, life: 0.45, alpha: 1, ay: -5 });
    }
    a.smoke += dt * 5;
    while (a.smoke > 1) {
      a.smoke--;
      P.spawn({ pos: v3(0.78 + (rnd() - 0.5) * 0.15, 3.6, -1.68), vel: v3(0.12, 0.35, (rnd() - 0.5) * 0.1), color: COL.smoke, size: 0.16, grow: 0.35, life: 3, alpha: 0.32, drag: 0.2 });
    }
    // 실린더로 들어가는 증기 입자
    a.jet += dt * 22 * k;
    while (a.jet > 1) {
      a.jet--;
      const y = dn ? 1.66 : 0.58;
      P.spawn({ pos: v3(CYLX - 0.33, y, 0.08), vel: v3(0.5 + rnd() * 0.3, (rnd() - 0.5) * 0.15, (rnd() - 0.3) * 0.2), color: COL.steam, size: 0.05, grow: 0.15, life: 0.45, alpha: 0.7, drag: 3 });
    }
  }

  anchor(name: string): THREE.Vector3 | null {
    const py = this.piston.position.y;
    switch (name) {
      case 'boiler': return v3(2.65, 1.0, -1.5);
      case 'fire': return v3(2.72, 0.2, -1.68);
      case 'cylinder': return v3(CYLX + 0.2, 1.3, 0.42);
      case 'piston': return v3(CYLX + 0.12, py + PH / 2, 0.2);
      case 'jacket': return v3(CYLX + 0.41 * Math.sin(DIR + GAP / 2), 1.0, 0.41 * Math.cos(DIR + GAP / 2));
      case 'top': return v3(CYLX + 0.12, (py + PH + BORE1) / 2, 0.2);
      case 'bot': return v3(CYLX + 0.12, (BORE0 + py) / 2, 0.2);
      case 'v0': return v3(-2.48, 1.8, 0.08);
      case 'v1': return v3(-2.48, 1.6, -0.08);
      case 'v2': return v3(-2.48, 0.75, 0.08);
      case 'v3': return v3(-2.48, 0.55, -0.08);
      case 'condenser': return v3(CND.x, 0.55, CND.z + 0.15);
      case 'airpump': return v3(AP_X + 0.1, 0.62, 0.1);
      case 'cistern': return v3(-0.3, 0.82, 0.55);
      case 'exhaust': return v3(-1.3, 0.3, -0.75);
      case 'beam': return v3(0.75, 3.05 + 0.75 * Math.sin(this.theta) + 0.2, 0);
      case 'crosshead': return v3(CYLX, py + PH + ROD, 0.12);
      case 'conrod': return v3((S.x + PIV.x + LB) / 2 + 0.05, 2.1, 0.02);
      case 'crank': return v3(S.x + RC * Math.cos(this.alpha), S.y + RC * Math.sin(this.alpha), 0.1);
      case 'flywheel': return v3(S.x + 0.68, S.y - 0.68, -0.42);
      case 'governor': return v3(GOV.x, GOV.y - 0.2, GOV.z);
      case 'throttle': return v3(2.45, 2.2, -1.0);
      case 'steamMain': return v3(0.6, 2.3, -1.1);
      case 'hotwell': return v3(AP_X, 0.36, -0.72);
      default: return null;
    }
  }

  valves(): ValveInfo[] {
    const dn = this.down();
    return [
      { name: '위 증기 밸브', open: dn },
      { name: '위 배기 밸브(→응축기)', open: !dn },
      { name: '아래 증기 밸브', open: !dn },
      { name: '아래 배기 밸브(→응축기)', open: dn },
      { name: '조절 밸브(조속기)', open: true, text: `${Math.round(this.throttle * 100)}% 열림` }
    ];
  }

  force(): string {
    return this.down() ? '증기가 피스톤 위를 밀어 내려요 (아래는 응축기 쪽 — 압력 낮음)' : '증기가 피스톤 아래를 밀어 올려요 (위는 응축기 쪽 — 압력 낮음)';
  }

  /** 화면 속 플라이휠 속도(보통 = 100) */
  speedPct(): number {
    return Math.round((this.omega / OMEGA_N) * 100);
  }

  residual(): number {
    return this.err;
  }

  dispose(): void {
    this.parts.dispose();
    this.root.removeFromParent();
  }
}
