// 242 띠 브레이크 — 레버를 내리면 띠 위 끝이 아래 끝 쪽으로 끌려 띠가 바퀴를 죈다 — 설계표 docs/mm507-sheets/242.md
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, setMM, shaftZ, tag } from '../kit';
import { mesh } from '../../models/parts/geom';
import { darkSteel, paint, steel, wood } from '../../models/materials';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

const W: [number, number] = [-0.65, 1.65];
const RIM = 1.0;
const DB = 1.1;
const AB = -0.26005;
const B: [number, number] = [0.413, 1.3672];
const LBP = 0.34;
const LBH = 1.26;
const LAP = 0.363;
const RT = 1.0125;
const L0 = 6.121087;
const BAND_T = 0.025;
const BAND_W = 0.12;
const E0 = 0.188496;
const ER = 0.624828;
const TWO_PI = Math.PI * 2;
const PERIOD = 12;

const s3 = (u: number): number => {
  const c = Math.min(1, Math.max(0, u));
  return c * c * (3 - 2 * c);
};

function leverAngle(t: number): number {
  const tau = t % PERIOD;
  if (tau < 2) return ER;
  if (tau < 3) return ER + (E0 - ER) * s3(tau - 2);
  if (tau < 8) return E0;
  if (tau < 9) return E0 + (ER - E0) * s3(tau - 8);
  return ER;
}

function wheelState(t: number): { th: number; om: number } {
  const tau = t % PERIOD;
  const base = 9.375 * Math.floor(t / PERIOD);
  if (tau < 3) return { th: base + 1.5 * tau, om: 1.5 };
  if (tau < 4.5) {
    const u = tau - 3;
    return { th: base + 4.5 + 1.5 * u - 0.5 * u * u, om: 1.5 - u };
  }
  if (tau < 9) return { th: base + 5.625, om: 0 };
  if (tau < 10) {
    const u = tau - 9;
    return { th: base + 5.625 + 0.75 * u * u, om: 1.5 * u };
  }
  return { th: base + 6.375 + 1.5 * (tau - 10), om: 1.5 };
}

interface BandSol {
  Rb: number;
  tA: number;
  tB: number;
  wrap: number;
  P: [number, number];
  TA: [number, number];
  TB: [number, number];
  A: [number, number];
}

function solveBand(eps: number): BandSol {
  const Px = B[0] + LBP * Math.cos(eps);
  const Py = B[1] + LBP * Math.sin(eps);
  const dP = Math.hypot(Px - W[0], Py - W[1]);
  const aP = Math.atan2(Py - W[1], Px - W[0]);
  const calc = (Rb: number) => {
    const tA = aP + Math.acos(Rb / dP);
    const sP = Math.sqrt(dP * dP - Rb * Rb);
    const tB = AB - Math.acos(Rb / DB);
    const sB = Math.sqrt(DB * DB - Rb * Rb);
    const wrap = (((tB - tA) % TWO_PI) + TWO_PI) % TWO_PI;
    return { tA, tB, sP, wrap, L: sP - LAP + Rb * wrap + sB };
  };
  let lo = 1.0;
  let hi = 1.06;
  for (let i = 0; i < 60; i++) {
    const m = (lo + hi) / 2;
    if (calc(m).L > L0) hi = m;
    else lo = m;
  }
  const Rb = (lo + hi) / 2;
  const c = calc(Rb);
  const TA: [number, number] = [W[0] + Rb * Math.cos(c.tA), W[1] + Rb * Math.sin(c.tA)];
  const TB: [number, number] = [W[0] + Rb * Math.cos(c.tB), W[1] + Rb * Math.sin(c.tB)];
  const k = LAP / c.sP;
  const A: [number, number] = [Px + (TA[0] - Px) * k, Py + (TA[1] - Py) * k];
  return { Rb, tA: c.tA, tB: c.tB, wrap: c.wrap, P: [Px, Py], TA, TB, A };
}

function cyl(r: number, h: number, mat: THREE.Material, seg = 16): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(r, r, h, seg);
  geo.rotateX(Math.PI / 2);
  return mesh(geo, mat);
}

export default function buildM242(): MovementModel {
  const g = new THREE.Group();
  let t = 0;
  g.add(displayStand());

  // 바퀴 축 + 바퀴
  const shaft = shaftZ(W[0], W[1], 0.13, 0.12);
  shaft.name = 'shaft';
  g.add(shaft);

  const wheel = new THREE.Group();
  wheel.name = 'wheel';
  wheel.position.set(W[0], W[1], 0);
  const rimShape = new THREE.Shape();
  rimShape.absarc(0, 0, RIM, 0, TWO_PI, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, 0.9, 0, TWO_PI, true);
  rimShape.holes.push(hole);
  const rimGeo = new THREE.ExtrudeGeometry(rimShape, { depth: 0.14, bevelEnabled: false, curveSegments: 96 });
  rimGeo.translate(0, 0, -0.07);
  wheel.add(mesh(rimGeo, paint(0xb8c0c8)));
  const plateGeo = new THREE.CylinderGeometry(0.9, 0.9, 0.04, 64);
  plateGeo.rotateX(Math.PI / 2);
  wheel.add(mesh(plateGeo, paint(0xd5dade)));
  wheel.add(cyl(0.3, 0.18, steel(), 48));
  const mark = mesh(new THREE.BoxGeometry(0.58, 0.05, 0.006), paint(0xf2b619));
  mark.position.set(0.6, 0, 0.023);
  wheel.add(mark);
  setMM(wheel, { kind: 'wheel', axis: 'z', r: RIM, width: 0.14, rim: 'flat' });
  g.add(wheel);

  // 받침점 핀
  const pivotB = shaftZ(B[0], B[1], 0.16, 0.03);
  pivotB.name = 'pivotB';
  g.add(pivotB);

  // 레버
  const lever = new THREE.Group();
  lever.name = 'lever';
  lever.position.set(B[0], B[1], 0);
  const bar = mesh(new THREE.BoxGeometry(1.33, 0.07, 0.06), paint(0x3b6ea8));
  bar.position.set(0.595, 0, 0.11);
  const lboss = cyl(0.07, 0.06, steel(), 24);
  lboss.position.set(0, 0, 0.11);
  const lend = cyl(0.035, 0.06, steel(), 16);
  lend.position.set(LBH, 0, 0.11);
  const handGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.22, 16);
  handGeo.rotateZ(Math.PI / 2);
  const handle = mesh(handGeo, wood());
  handle.position.set(1.13, 0, 0.11);
  const pinP = cyl(0.02, 0.12, steel(), 12);
  pinP.name = 'pinP';
  pinP.position.set(LBP, 0, 0.14);
  lever.add(bar, lboss, lend, handle, pinP);
  g.add(lever);

  // 링크 + 핀 A
  const link = new THREE.Group();
  link.name = 'linkA';
  const ls = new THREE.Shape();
  ls.moveTo(0, -0.035);
  ls.lineTo(LAP, -0.035);
  ls.absarc(LAP, 0, 0.035, -Math.PI / 2, Math.PI / 2, false);
  ls.lineTo(0, 0.035);
  ls.absarc(0, 0, 0.035, Math.PI / 2, (3 * Math.PI) / 2, false);
  const lkGeo = new THREE.ExtrudeGeometry(ls, { depth: 0.04, bevelEnabled: false, curveSegments: 16 });
  lkGeo.translate(0, 0, -0.02);
  link.add(mesh(lkGeo, steel()));
  const pinA = cyl(0.02, 0.26, steel(), 12);
  pinA.name = 'pinA';
  pinA.position.set(LAP, 0, -0.1);
  link.add(pinA);
  g.add(link);

  // 띠 (재질 하나, 죄는 동안 빨강으로 바꿔 끼움)
  const bandMat = paint(0x3a3f45);
  const bandRed = paint(0xd8362f);
  const band = mesh(new THREE.BufferGeometry(), bandMat);
  band.name = 'band';
  band.position.set(W[0], W[1], 0);
  const upper = mesh(new THREE.BoxGeometry(1, BAND_T, BAND_W), bandMat);
  upper.name = 'bandUpper';
  const lower = mesh(new THREE.BoxGeometry(1, BAND_T, BAND_W), bandMat);
  lower.name = 'bandLower';
  const eyeA = cyl(0.035, 0.12, bandMat, 16);
  eyeA.name = 'bandEyeA';
  const eyeB = cyl(0.035, 0.12, bandMat, 16);
  eyeB.name = 'bandEyeB';
  eyeB.position.set(B[0], B[1], 0);
  g.add(band, upper, lower, eyeA, eyeB);

  // 위 멈춤 핀·용수철 걸이
  const upStop = cyl(0.04, 0.46, darkSteel(), 16);
  upStop.name = 'upStop';
  upStop.position.set(0.937, 1.837, -0.07);
  const springPeg = cyl(0.04, 0.46, darkSteel(), 16);
  springPeg.name = 'springPeg';
  springPeg.position.set(1.27, 2.79, -0.07);
  g.add(upStop, springPeg);

  // 되돌림 용수철
  const spring = mesh(new THREE.BufferGeometry(), steel());
  spring.name = 'spring';
  g.add(spring);

  // 당김 화살표
  const pullArrow = new THREE.Group();
  pullArrow.name = 'pullArrow';
  const pm = paint(0xd8362f);
  const coneGeo = new THREE.ConeGeometry(0.06, 0.14, 16);
  coneGeo.rotateX(Math.PI);
  const stem = mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.25, 8), pm);
  stem.position.y = 0.195;
  pullArrow.add(mesh(coneGeo, pm), stem);
  g.add(pullArrow);

  // 바퀴 화살표
  const wArrow = rotArrow(0.55, true);
  wArrow.position.set(W[0], W[1], 0.16);
  g.add(wArrow);

  g.add(
    leaderTo(tag('브레이크 바퀴', v(-1.89, 0.48, 0.3)), 'wheel'),
    leaderTo(tag('띠(감긴 각 287°)', v(-1.52, 3.11, 0.3)), 'band'),
    leaderTo(tag('레버(끝을 내리면 죔)', v(1.84, 1.09, 0.3)), 'lever'),
    leaderTo(tag('받침점·띠 아래 끝', v(1.38, 0.42, 0.3)), 'pivotB'),
    leaderTo(tag('띠 위 끝·링크', v(1.06, 3.12, 0.3)), 'linkA'),
    leaderTo(tag('되돌림 용수철', v(2.16, 2.42, 0.3)), 'spring')
  );

  let lastRb = NaN;
  let lastTA = NaN;
  let lastWrap = NaN;
  let lastSpringEps = NaN;
  let gap = 0;
  let wrapDeg = 0;
  let omega = 0;

  const buildBand = (Rb: number, tA: number, wrap: number): void => {
    const sh = new THREE.Shape();
    sh.absarc(0, 0, Rb + BAND_T / 2, tA, tA + wrap, false);
    sh.absarc(0, 0, Rb - BAND_T / 2, tA + wrap, tA, true);
    sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: BAND_W, bevelEnabled: false, curveSegments: 96 });
    geo.translate(0, 0, -BAND_W / 2);
    band.geometry.dispose();
    band.geometry = geo;
  };

  const buildSpring = (S0: THREE.Vector3, S1: THREE.Vector3): void => {
    const d = new THREE.Vector3().subVectors(S1, S0);
    const n1 = new THREE.Vector3(-d.y, d.x, 0).normalize();
    const zz = new THREE.Vector3(0, 0, 1);
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 200; i++) {
      const s = i / 200;
      const p = S0.clone().addScaledVector(d, s);
      p.addScaledVector(n1, 0.045 * Math.cos(20 * Math.PI * s));
      p.addScaledVector(zz, 0.045 * Math.sin(20 * Math.PI * s));
      pts.push(p);
    }
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 400, 0.008, 6);
    spring.geometry.dispose();
    spring.geometry = geo;
  };

  const place = (m: THREE.Mesh, a: [number, number], b: [number, number]): void => {
    m.scale.x = Math.hypot(b[0] - a[0], b[1] - a[1]);
    m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0);
    m.rotation.z = Math.atan2(b[1] - a[1], b[0] - a[0]);
  };

  const apply = (): void => {
    const tau = ((t % PERIOD) + PERIOD) % PERIOD;
    const eps = leverAngle(t);
    const ws = wheelState(t);
    omega = ws.om;
    const sol = solveBand(eps);
    wheel.rotation.z = ws.th;
    shaft.rotation.z = ws.th;
    lever.rotation.z = eps;
    link.position.set(sol.P[0], sol.P[1], 0.17);
    link.rotation.z = Math.atan2(sol.A[1] - sol.P[1], sol.A[0] - sol.P[0]);
    if (!(Math.abs(sol.Rb - lastRb) < 1e-5 && Math.abs(sol.tA - lastTA) < 1e-5 && Math.abs(sol.wrap - lastWrap) < 1e-5)) {
      buildBand(sol.Rb, sol.tA, sol.wrap);
      lastRb = sol.Rb;
      lastTA = sol.tA;
      lastWrap = sol.wrap;
    }
    place(upper, sol.TA, sol.A);
    place(lower, sol.TB, B);
    eyeA.position.set(sol.A[0], sol.A[1], 0);
    if (!(Math.abs(eps - lastSpringEps) < 1e-6)) {
      const c = Math.cos(eps);
      const s = Math.sin(eps);
      buildSpring(v(1.27, 2.75, 0.11), v(B[0] + 0.95 * c - 0.035 * s, B[1] + 0.95 * s + 0.035 * c, 0.11));
      lastSpringEps = eps;
    }
    pullArrow.position.set(B[0] + LBH * Math.cos(eps), B[1] + LBH * Math.sin(eps) + 0.32, 0.25);
    pullArrow.visible = tau >= 2 && tau < 8;
    wArrow.visible = omega > 0.05;
    gap = sol.Rb - RT;
    wrapDeg = (sol.wrap * 180) / Math.PI;
    const m = gap < 0.0005 ? bandRed : bandMat;
    for (const o of [band, upper, lower, eyeA, eyeB]) o.material = m;
  };
  apply();

  return {
    group: g,
    notes: () => [
      { label: '레버', value: gap < 0.0005 ? '내림 — 띠가 죔' : '올림 — 풀림' },
      { label: '띠 틈', value: gap.toFixed(3) + ' (0.029 ~ 0)' },
      { label: '감긴 각', value: wrapDeg.toFixed(0) + '°' },
      { label: '바퀴 빠르기', value: omega.toFixed(2) + ' rad/s' },
      { label: '원리', value: '레버를 내리면 띠 위 끝이 아래 끝 쪽으로 끌려 띠가 바퀴를 죈다' }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed;
      apply();
    },
    dispose(): void {
      bandRed.dispose();
      bandMat.dispose();
    },
    view: { pos: [0.25, 1.95, 6.6], target: [0.15, 1.7, 0.0] }
  };
}
