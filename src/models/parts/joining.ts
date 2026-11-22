// 결합용 기계요소: 볼트·너트, 평행 핀, 테이퍼 핀, 분할 핀

import * as THREE from 'three';
import { steel, darkSteel, chrome } from '../materials';
import { type V2, TAU, mesh, merge, lathe, hexPrism, threadedRod, sweepPlanar } from './geom';

/** 육각 볼트 + 와셔 + 반쯤 끼운 너트. 실제 나선 나사산(ISO 60°) */
export function buildBolt(): THREE.Group {
  const g = new THREE.Group();
  const rMaj = 0.1;
  const pitch = 0.062;
  const depth = pitch * 0.541;
  const yTip = -0.5;
  const yThreadEnd = 0.16;
  const yHeadBottom = 0.5;
  const headH = 0.15;

  const thread = threadedRod({ rMajor: rMaj, depth, pitch, y0: yTip, y1: yThreadEnd, chamfer0: true, fade1: pitch * 1.2, segs: 72 });
  const shank = lathe([[rMaj, yThreadEnd], [rMaj, yHeadBottom - 0.018], [rMaj + 0.014, yHeadBottom - 0.004], [rMaj + 0.03, yHeadBottom], [0, yHeadBottom]], 64);
  const head = hexPrism(0.32, headH, false, true);
  head.translate(0, yHeadBottom + headH / 2 + 0.012, 0);
  const washerFace = lathe([[0, yHeadBottom], [0.148, yHeadBottom], [0.15, yHeadBottom + 0.006], [0.15, yHeadBottom + 0.012], [0, yHeadBottom + 0.012]], 64);
  const boltMat = steel({ roughness: 0.3 });
  mesh(merge([thread, shank, head, washerFace]), boltMat, g);

  // 너트: 나사부 가운데쯤, 와셔는 너트 위(머리 쪽)
  const nutH = 0.17;
  const nutY = -0.17;
  const nut = hexPrism(0.32, nutH, true, true, rMaj - depth * 0.9);
  nut.translate(0, nutY, 0);
  mesh(nut, steel({ color: 0xaab4bf, roughness: 0.38 }), g);
  const wy = nutY + nutH / 2;
  const washer = lathe(
    [
      [rMaj + 0.008, wy],
      [0.2, wy],
      [0.205, wy + 0.008],
      [0.205, wy + 0.026],
      [0.2, wy + 0.032],
      [rMaj + 0.008, wy + 0.032],
      [rMaj + 0.004, wy + 0.028],
      [rMaj + 0.004, wy + 0.004],
      [rMaj + 0.008, wy]
    ],
    72
  );
  mesh(washer, chrome({ roughness: 0.22 }), g);

  g.rotation.set(0.25, 0.5, -1.05);
  return g;
}

/** 평행 핀: 굵기 일정, 양끝 모따기 */
export function buildPinParallel(): THREE.Group {
  const g = new THREE.Group();
  const r = 0.085;
  const L = 1.1;
  const c = 0.022;
  const prof: V2[] = [
    [0, -L / 2],
    [r - c, -L / 2],
    [r - c * 0.25, -L / 2 + c * 0.6],
    [r, -L / 2 + c * 1.2],
    [r, L / 2 - c * 1.2],
    [r - c * 0.25, L / 2 - c * 0.6],
    [r - c, L / 2],
    [0, L / 2]
  ];
  mesh(lathe(prof, 56, 0, TAU, 30), steel({ roughness: 0.22 }), g);
  g.rotation.set(0.3, 0, -1.25);
  return g;
}

/** 테이퍼 핀: 과장된 기울기(약 1:7), 굵은 쪽 둥근 머리, 가는 쪽 모따기 */
export function buildPinTaper(): THREE.Group {
  const g = new THREE.Group();
  const L = 1.1;
  const rThin = 0.05;
  const rThick = 0.13;
  const y0 = -L / 2;
  const yDome = L / 2 - 0.045;
  const prof: V2[] = [[0, y0], [rThin - 0.014, y0], [rThin, y0 + 0.014]];
  prof.push([rThick, yDome]);
  // 굵은 쪽 끝: 구면 캡
  const yTop = L / 2;
  const yc = (rThick * rThick + yDome * yDome - yTop * yTop) / (2 * (yDome - yTop));
  const R = yTop - yc;
  const a0 = Math.atan2(yDome - yc, rThick);
  for (let i = 1; i <= 10; i++) {
    const a = a0 + ((Math.PI / 2 - a0) * i) / 10;
    prof.push([Math.cos(a) * R, yc + Math.sin(a) * R]);
  }
  mesh(lathe(prof, 56, 0, TAU, 30), steel({ roughness: 0.26 }), g);
  g.rotation.set(0.3, 0, -1.25);
  return g;
}

/** 분할 핀: 반원 단면 철사 두 가닥, 둥근 고리 머리, 벌어진 끝 */
export function buildPinSplit(): THREE.Group {
  const g = new THREE.Group();
  const wr = 0.058; // 반원 반지름
  const eps = 0.0015;
  const Ri = 0.07; // 고리 안쪽 반지름
  const yc = 0.115;
  const path: V2[] = [];
  const bez = (p0: V2, p1: V2, p2: V2, p3: V2, n: number, skipFirst = true): void => {
    for (let i = skipFirst ? 1 : 0; i <= n; i++) {
      const t = i / n;
      const u = 1 - t;
      path.push([
        u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
        u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]
      ]);
    }
  };
  // 다리 A(긴 쪽): 끝이 바깥(+x)으로 벌어짐 → 위로
  const aTip: V2 = [eps + 0.15, -0.86];
  const aBend: V2 = [eps, -0.58];
  bez(aTip, [eps + 0.1, -0.76], [eps, -0.68], aBend, 10, false);
  for (let i = 1; i <= 6; i++) path.push([eps, -0.58 + (0.58 * i) / 6]);
  // 목 → 고리(약 290°) → 목
  const aStart = -Math.PI * 0.32;
  const aEnd = Math.PI + Math.PI * 0.32;
  const ps: V2 = [Math.cos(aStart) * Ri, yc + Math.sin(aStart) * Ri];
  const ts: V2 = [-Math.sin(aStart), Math.cos(aStart)];
  bez([eps, 0], [eps, 0.03], [ps[0] - ts[0] * 0.03, ps[1] - ts[1] * 0.03], ps, 8);
  for (let i = 1; i <= 40; i++) {
    const a = aStart + ((aEnd - aStart) * i) / 40;
    path.push([Math.cos(a) * Ri, yc + Math.sin(a) * Ri]);
  }
  const pe: V2 = [Math.cos(aEnd) * Ri, yc + Math.sin(aEnd) * Ri];
  const te: V2 = [-Math.sin(aEnd), Math.cos(aEnd)];
  bez(pe, [pe[0] + te[0] * 0.03, pe[1] + te[1] * 0.03], [-eps, 0.03], [-eps, 0], 8);
  // 다리 B(짧은 쪽): 아래로 → 끝이 바깥(-x)으로 벌어짐
  for (let i = 1; i <= 5; i++) path.push([-eps, -(0.5 * i) / 5]);
  bez([-eps, -0.5], [-eps, -0.6], [-eps - 0.06, -0.66], [-eps - 0.13, -0.74], 10);

  // 반원 단면: 평평한 면(n=0)이 진행방향 왼쪽(두 다리가 맞닿는 안쪽), 둥근 면이 바깥
  const prof: V2[] = [[0, wr]];
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI / 2 + (Math.PI * i) / 12;
    prof.push([Math.cos(a) * wr, Math.sin(a) * wr]);
  }
  prof.push([0, -wr]);
  const geo = sweepPlanar(path, prof, false, true);
  mesh(geo, darkSteel({ color: 0xa9b3bd, roughness: 0.32 }), g);
  g.rotation.set(-0.55, 0.35, -1.0);
  return g;
}
