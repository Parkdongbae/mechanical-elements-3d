// 축용 기계요소: 차축, 전동축, 크랭크축, 볼 베어링

import * as THREE from 'three';
import { steel, darkSteel, chrome, brass, paint, castIron } from '../materials';
import {
  type V2,
  TAU,
  mesh,
  merge,
  lathe,
  hexPrism,
  threadedRod,
  radialSurface,
  steppedProfile,
  extrude,
  circlePath,
  polygonFace,
  sweep
} from './geom';

/** Y축 지오메트리를 X축으로 눕힘 (+Y → +X) */
function toX(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  geo.rotateZ(-Math.PI / 2);
  return geo;
}

/** 차축: 양끝 나사부 + 너트, 중앙 허브 접촉부(평면 가공부 = 돌지 않는 고정축) */
export function buildAxle(): THREE.Group {
  const g = new THREE.Group();
  const rMaj = 0.085;
  const pitch = 0.05;
  const depth = pitch * 0.541;
  const L = 0.85;
  const parts: THREE.BufferGeometry[] = [];
  // 오른쪽 나사부(+y), 왼쪽 나사부(-y: 뒤집어서 같은 함수 사용)
  for (const sgn of [1, -1]) {
    const th = threadedRod({ rMajor: rMaj, depth, pitch, y0: -L, y1: -0.4, chamfer0: true, fade1: pitch, segs: 56 });
    if (sgn > 0) th.rotateZ(Math.PI);
    parts.push(th);
  }
  // 나사부 사이 축(바깥지름)
  parts.push(lathe([[rMaj, -0.401], [rMaj, 0.401]], 56));
  // 중앙 칼라: 위아래 평면 가공 + 양끝 모따기
  const rc = 0.14;
  const flat = 0.1;
  const hc = 0.2;
  const ys: number[] = [];
  for (let i = 0; i <= 4; i++) ys.push(-hc + 0.02 * (i / 4));
  ys.push(0);
  for (let i = 4; i >= 0; i--) ys.push(hc - 0.02 * (i / 4));
  parts.push(
    radialSurface(
      (th, y) => {
        const flatR = flat / Math.max(1e-6, Math.abs(Math.sin(th)));
        const cone = rc - 0.02 + (hc - Math.abs(y));
        return Math.min(rc, flatR, cone);
      },
      ys,
      96,
      rMaj,
      rMaj,
      30
    )
  );
  const axleMat = steel({ roughness: 0.28 });
  mesh(toX(merge(parts)), axleMat, g);

  // 허브 콘(베어링 궤도면) + 와셔 + 너트 (양쪽)
  const coneMat = chrome({ roughness: 0.14 });
  const nutMat = darkSteel({ roughness: 0.38 });
  for (const sgn of [1, -1]) {
    const cone = lathe(
      [
        [rMaj - depth * 0.5, 0],
        [0.12, 0],
        [0.158, 0.035],
        [0.165, 0.06],
        [0.165, 0.09],
        [0.145, 0.1],
        [rMaj - depth * 0.5, 0.1]
      ],
      64
    );
    cone.translate(0, 0.22, 0);
    const washer = lathe([[rMaj - depth * 0.3, 0.34], [0.155, 0.34], [0.16, 0.345], [0.16, 0.36], [0.155, 0.365], [rMaj - depth * 0.3, 0.365]], 56);
    const nut = hexPrism(0.24, 0.12, true, true, rMaj - depth * 0.9);
    nut.translate(0, 0.425, 0);
    const lock = hexPrism(0.26, 0.11, true, true, rMaj - depth * 0.9);
    lock.translate(0, 0.66, 0);
    for (const geo of [cone, washer, nut, lock]) {
      if (sgn < 0) geo.rotateZ(Math.PI);
      toX(geo);
    }
    mesh(cone, coneMat, g);
    mesh(merge([washer]), coneMat, g);
    mesh(merge([nut, lock]), nutMat, g);
  }
  g.rotation.order = 'YXZ';
  g.rotation.set(0.5, 0.45, 0.1);
  return g;
}

/** 키 홈이 파인 원형 단면 Shape (홈은 +Y) */
function keyedCircle(r: number, keyW: number, keyD: number): THREE.Shape {
  const w = keyW / 2;
  const a1 = Math.acos(w / r);
  const a2 = Math.PI - a1;
  const s = new THREE.Shape();
  s.moveTo(-w, Math.sin(a2) * r);
  s.absarc(0, 0, r, a2, a1 + TAU, false);
  s.lineTo(w, r - keyD);
  s.lineTo(-w, r - keyD);
  s.closePath();
  return s;
}

/** 전동축: 키 홈 + 계단(단차) 축 + 한쪽 끝 플랜지 커플링 */
export function buildDriveShaft(): THREE.Group {
  const g = new THREE.Group();
  const shaftMat = steel({ roughness: 0.26 });
  // 키 홈 구간: x ∈ [-0.85, -0.45]
  const keyLen = 0.4;
  const keyed = extrude(keyedCircle(0.075, 0.048, 0.03), keyLen, 0.008, 48);
  keyed.rotateY(Math.PI / 2);
  keyed.translate(-0.85 + keyLen / 2, 0, 0);
  // 계단 축: y(=x) -0.45 → 0.62
  const prof = steppedProfile(
    [
      { r: 0.075, len: 0.02 },
      { r: 0.092, len: 0.17 },
      { r: 0.115, len: 0.56 },
      { r: 0.14, len: 0.06 },
      { r: 0.095, len: 0.2 },
      { r: 0.13, len: 0.08 }
    ],
    -0.47,
    0.01
  );
  const body = toX(lathe(prof, 64));
  mesh(merge([keyed, body]), shaftMat, g);

  // 플랜지: x ∈ [0.62, 0.72], 볼트 구멍 6개
  const fl = new THREE.Shape();
  fl.absarc(0, 0, 0.3, 0, TAU, false);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + Math.PI / 6;
    fl.holes.push(circlePath(Math.cos(a) * 0.215, Math.sin(a) * 0.215, 0.032));
  }
  const flange = extrude(fl, 0.1, 0.014, 64);
  flange.rotateY(Math.PI / 2);
  flange.translate(0.67, 0, 0);
  // 플랜지 허브 필렛
  const hub = toX(lathe([[0.12, 0.58], [0.13, 0.6], [0.16, 0.615], [0.19, 0.62], [0.19, 0.625], [0.12, 0.625]], 64));
  mesh(merge([flange, hub]), steel({ color: 0x9aa4ae, roughness: 0.4 }), g);
  // 중심 맞춤용 보스
  const spigot = toX(lathe([[0, 0.72], [0.1, 0.72], [0.11, 0.73], [0.11, 0.75], [0.1, 0.76], [0, 0.76]], 48));
  mesh(spigot, shaftMat, g);

  g.rotation.order = 'YXZ';
  g.rotation.set(0.85, 0.05, 0.12);
  return g;
}

/** 크랭크 암(웹) 단면: 핀 보스(+Y, 편심 e) + 반대쪽 부채꼴 균형추 */
function crankWebShape(e: number, rBoss: number, rCw: number, halfAng: number): THREE.Shape {
  const s = new THREE.Shape();
  const g = 0.18;
  // 균형추 원호(아래) 오른쪽 끝에서 시작해 반시계로
  const aR = -Math.PI / 2 + halfAng;
  const aL = -Math.PI / 2 - halfAng;
  s.moveTo(Math.cos(aR) * rCw, Math.sin(aR) * rCw);
  // 오른쪽 옆선 → 보스 원호(위) → 왼쪽 옆선
  s.quadraticCurveTo(rBoss * 1.05, e * 0.2, Math.cos(-g) * rBoss, e + Math.sin(-g) * rBoss);
  s.absarc(0, e, rBoss, -g, Math.PI + g, false);
  s.quadraticCurveTo(-rBoss * 1.05, e * 0.2, Math.cos(aL) * rCw, Math.sin(aL) * rCw);
  s.absarc(0, 0, rCw, aL, aR, false);
  s.closePath();
  return s;
}

/** 크랭크축: 메인 저널–크랭크 암(웹)–크랭크 핀–균형추, 2기통 180° 배치 */
export function buildCrankShaft(): THREE.Group {
  const g = new THREE.Group();
  const e = 0.17;
  const rJ = 0.075;
  const rP = 0.068;
  const webT = 0.075;
  const journalMat = steel({ roughness: 0.18 });
  const webMat = castIron({ color: 0x7a838d, roughness: 0.5 });
  const pinMat = steel({ roughness: 0.16 });

  // 축 방향 배치(x): 앞 스너트 → J1 → W → P1 → W → J2 → W → P2 → W → J3 → 플랜지
  const journalGeo: THREE.BufferGeometry[] = [];
  const addJournal = (x0: number, x1: number, r: number): void => {
    journalGeo.push(toX(lathe([[0, x0], [r - 0.008, x0], [r, x0 + 0.008], [r, x1 - 0.008], [r - 0.008, x1], [0, x1]], 48)));
  };
  // 스너트(계단) + 키 홈 대신 작은 기어 자리
  journalGeo.push(toX(lathe(steppedProfile([{ r: 0.045, len: 0.12 }, { r: 0.058, len: 0.08 }], -0.9, 0.008), 40)));
  addJournal(-0.71, -0.47, rJ);
  addJournal(-0.13, 0.13, rJ);
  addJournal(0.47, 0.66, rJ);
  mesh(merge(journalGeo), journalMat, g);

  const webs: THREE.BufferGeometry[] = [];
  const pins: THREE.BufferGeometry[] = [];
  const throws: { x0: number; dir: number }[] = [
    { x0: -0.47, dir: 1 },
    { x0: 0.13, dir: -1 }
  ];
  for (const t of throws) {
    const pinLen = 0.19;
    const xs = [t.x0 + webT / 2, t.x0 + webT + pinLen + webT / 2];
    for (const x of xs) {
      const w = extrude(crankWebShape(e, 0.115, 0.27, 1.05), webT, 0.014, 32, 2);
      w.rotateY(Math.PI / 2);
      if (t.dir < 0) w.rotateX(Math.PI);
      w.translate(x, 0, 0);
      webs.push(w);
    }
    const px0 = t.x0 + webT;
    const pin = toX(lathe([[0, px0 - 0.01], [rP, px0 - 0.01], [rP, px0 + pinLen + 0.01], [0, px0 + pinLen + 0.01]], 48));
    // 핀 양끝 필렛 링
    pin.translate(0, e * t.dir, 0);
    pins.push(pin);
  }
  mesh(merge(webs), webMat, g);
  mesh(merge(pins), pinMat, g);

  // 뒤쪽 플라이휠 플랜지 (볼트 구멍 6)
  const fl = new THREE.Shape();
  fl.absarc(0, 0, 0.2, 0, TAU, false);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    fl.holes.push(circlePath(Math.cos(a) * 0.14, Math.sin(a) * 0.14, 0.018));
  }
  fl.holes.push(circlePath(0, 0, 0.035));
  const flange = extrude(fl, 0.07, 0.012, 48);
  flange.rotateY(Math.PI / 2);
  flange.translate(0.695, 0, 0);
  mesh(flange, webMat, g);

  g.rotation.order = 'YXZ';
  g.rotation.set(-0.6, 0.0, 0.1);
  return g;
}

/** 볼 베어링: 내륜·외륜(궤도 홈), 볼 9개, 리본형 리테이너. 80° 단면 절개(절단면 위 볼은 반구로) */
export function buildBearing(): THREE.Group {
  const g = new THREE.Group();
  const h = 0.08;
  const Rp = 0.24;
  const rb = 0.052;
  const rg = 0.055;
  const RiO = 0.285; // 외륜 안지름
  const RoO = 0.36;
  const RoI = 0.195; // 내륜 바깥지름
  const RiI = 0.125;
  const c = 0.012;
  const c2 = 0.006;
  const nB = 9;
  const pitchA = TAU / nB;
  const cutStart = (70 * Math.PI) / 180; // 재료가 있는 구간 시작(φ) — 절개 중심이 카메라(φ≈30°) 쪽
  const cutLen = TAU - 2 * pitchA;

  const arc = (from: number, to: number, n: number): V2[] => {
    const out: V2[] = [];
    for (let i = 0; i <= n; i++) {
      const a = from + ((to - from) * i) / n;
      out.push([Rp + rg * Math.cos(a), rg * Math.sin(a)]);
    }
    return out;
  };
  const psiO = Math.acos((RiO - Rp) / rg);
  const outer: V2[] = [
    [RoO - c, -h],
    [RoO, -h + c],
    [RoO, h - c],
    [RoO - c, h],
    [RiO + c2, h],
    [RiO, h - c2],
    ...arc(psiO, -psiO, 14),
    [RiO, -h + c2],
    [RiO + c2, -h],
    [RoO - c, -h]
  ];
  const psiI = Math.acos((RoI - Rp) / rg);
  const inner: V2[] = [
    [RiI + c, -h],
    [RoI - c2, -h],
    [RoI, -h + c2],
    ...arc(-psiI, -(TAU - psiI), 14),
    [RoI, h - c2],
    [RoI - c2, h],
    [RiI + c, h],
    [RiI, h - c],
    [RiI, -h + c],
    [RiI + c, -h]
  ];
  const ringMat = steel({ roughness: 0.2 });
  const cutMat = paint(0xd8362f, { roughness: 0.5 });
  cutMat.side = THREE.DoubleSide;
  const rings = merge([lathe(outer, 96, cutStart, cutLen, 40), lathe(inner, 96, cutStart, cutLen, 40)]);
  mesh(rings, ringMat, g);
  // 단면(컷 면)
  const faces: THREE.BufferGeometry[] = [];
  for (const phi of [cutStart, cutStart + cutLen]) {
    for (const loop of [outer, inner]) {
      const f = polygonFace(loop.slice(0, -1));
      f.rotateY(phi - Math.PI / 2);
      faces.push(f);
    }
  }

  // 볼: 절단면 두 곳에 볼 중심이 오도록 배치. 절개 구간 안의 볼은 생략, 절단면 위 볼은 반구 + 빨간 단면
  const ballPhi = (k: number): number => cutStart + k * pitchA;
  const ballMat = chrome({ roughness: 0.06 });
  const fullBalls = nB - 3;
  const balls = new THREE.InstancedMesh(new THREE.SphereGeometry(rb, 32, 20), ballMat, fullBalls);
  const mtx = new THREE.Matrix4();
  for (let k = 1; k <= fullBalls; k++) {
    const p = ballPhi(k);
    mtx.makeTranslation(Rp * Math.sin(p), 0, Rp * Math.cos(p));
    balls.setMatrixAt(k - 1, mtx);
  }
  balls.castShadow = true;
  balls.receiveShadow = true;
  g.add(balls);
  const halfGeos: THREE.BufferGeometry[] = [];
  const discGeos: THREE.BufferGeometry[] = [];
  for (const [phi, sgn] of [[cutStart, 1], [cutStart + cutLen, -1]] as const) {
    const hemi = new THREE.SphereGeometry(rb, 32, 16, 0, Math.PI);
    const disc = new THREE.CircleGeometry(rb * 0.999, 32);
    for (const geo of [hemi, disc]) {
      geo.rotateY(phi + (sgn * Math.PI) / 2);
      geo.translate(Rp * Math.sin(phi), 0, Rp * Math.cos(phi));
    }
    halfGeos.push(hemi);
    discGeos.push(disc);
  }
  mesh(merge(halfGeos), ballMat, g);
  faces.push(...discGeos);

  // 리본형 리테이너(위·아래 두 장): 볼마다 반구 포켓
  const Rc = rb + 0.009;
  const t = 0.008;
  const w = 0.032;
  const cageGeos: THREE.BufferGeometry[] = [];
  for (const side of [1, -1]) {
    const pts: THREE.Vector3[] = [];
    const ns: THREE.Vector3[] = [];
    const bs: THREE.Vector3[] = [];
    const n = 360;
    for (let i = 0; i <= n; i++) {
      const phi = cutStart + (cutLen * i) / n;
      let z = 0;
      for (let k = 0; k < nB; k++) {
        let d = phi - ballPhi(k);
        d = Math.atan2(Math.sin(d), Math.cos(d));
        const s = Rp * d;
        if (Math.abs(s) < Rc) z = Math.max(z, Math.sqrt(Rc * Rc - s * s));
      }
      const y = side * (z + t / 2);
      pts.push(new THREE.Vector3(Rp * Math.sin(phi), y, Rp * Math.cos(phi)));
      ns.push(new THREE.Vector3(Math.sin(phi), 0, Math.cos(phi)));
    }
    for (let i = 0; i <= n; i++) {
      const T = pts[Math.min(n, i + 1)]!.clone().sub(pts[Math.max(0, i - 1)]!).normalize();
      bs.push(new THREE.Vector3().crossVectors(T, ns[i]!).normalize());
    }
    const prof: V2[] = [
      [-w / 2, -t / 2],
      [w / 2, -t / 2],
      [w / 2, t / 2],
      [-w / 2, t / 2]
    ];
    cageGeos.push(sweep(pts, ns, bs, side > 0 ? prof : prof.map(([a, b]) => [a, -b] as V2).reverse(), false, true));
  }
  // 리벳 (볼 사이)
  for (let k = 0; k < nB; k++) {
    const p = ballPhi(k) + Math.PI / nB;
    let d = p - cutStart;
    d = ((d % TAU) + TAU) % TAU;
    if (d > cutLen) continue;
    const rv = lathe([[0, -t - 0.008], [0.009, -t - 0.006], [0.011, -t], [0.006, -t], [0.006, t], [0.011, t], [0.009, t + 0.006], [0, t + 0.008]], 12);
    rv.translate(Rp * Math.sin(p), 0, Rp * Math.cos(p));
    cageGeos.push(rv);
  }
  mesh(merge(cageGeos), brass({ roughness: 0.35 }), g);
  mesh(merge(faces), cutMat, g);

  g.rotation.set(0.42, 0, 0);
  return g;
}
