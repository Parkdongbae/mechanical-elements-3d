// 잡 부품 — 추·지레·회전 화살표·이름표·두 원 교점 (작업 지시서 16 · 3-3)
import * as THREE from 'three';
import { darkSteel, glow, paint, steel, wood } from '../../models/materials';
import { annularSector, extrude, lathe, mesh, rodProfile, roundedRect, stadiumShape } from '../../models/parts/geom';
import { makeLabelSprite } from '../../machines/stlShared';
import type { V2 as BV2 } from './belt';

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}


/** 추: 모따기 상자 + 위 고리 + 밝은 표시줄 */
export function weight(w: number, h: number): THREE.Mesh {
  const d = w * 0.72;
  const c = Math.min(w, h) * 0.12;
  const geo = extrude(roundedRect(-w / 2, -h / 2, w / 2, h / 2, c), d, c * 0.8);
  const m = mesh(geo, darkSteel());
  const ring = meshAt(new THREE.TorusGeometry(w * 0.16, w * 0.045, 12, 32), darkSteel(), 0, h / 2 + w * 0.1, 0);
  m.add(ring);
  const mark = meshAt(new THREE.BoxGeometry(w * 0.5, 0.012, 0.008), paint(0xf2b619), 0, 0, d / 2 + 0.001);
  m.add(mark);
  return m;
}

/** 지레: 원점 = 받침점, +X 방향 막대. handle이면 끝에 세로 손잡이 */
export function lever(length: number, opts: { handle?: boolean } = {}): THREE.Group {
  const g = new THREE.Group();
  // 막대: 받침점 뒤로 살짝 긴 꼬리(반폭 0.03 스타디움 단면)
  const barGeo = extrude(stadiumShape(-length * 0.12, 0, length, 0, 0.03), 0.045, 0.01);
  g.add(mesh(barGeo, steel()));
  // 받침 축(Z축, 양쪽으로 돌출)
  const pivGeo = lathe(rodProfile(0.05, -0.045, 0.045, 0.012), 32);
  pivGeo.rotateX(Math.PI / 2);
  g.add(mesh(pivGeo, darkSteel()));
  // 표시점: 회전·기울기가 보이게
  g.add(meshAt(new THREE.BoxGeometry(0.05, 0.014, 0.01), paint(0xf2b619), length * 0.3, 0, 0.024));
  if (opts.handle === true) {
    const hg = lathe(rodProfile(0.02, 0, 0.14, 0.008, 0.008), 24);
    g.add(meshAt(hg, wood(), length - 0.02, 0.05, 0));
  }
  return g;
}

/** 회전 방향 화살표(호 + 화살촉). layer 1, userData.noAO — 라벨 토글 대상 강조 */
export function rotArrow(r: number, ccw: boolean): THREE.Group {
  const g = new THREE.Group();
  const mat = glow(0xd8362f, 0.85);
  const span = (250 * Math.PI) / 180;
  const a0 = -Math.PI * 0.35;
  const a1 = ccw ? a0 + span : a0 - span;
  const arcGeo = extrude(annularSector(r - 0.02, r + 0.02, a0, a1), 0.014, 0.004, 16);
  g.add(mesh(arcGeo, mat));
  // 화살촉: 끝점 접선 방향으로 눕힌 원뿔
  const ae = a1;
  const ex = Math.cos(ae) * r;
  const ey = Math.sin(ae) * r;
  const tx = ccw ? -Math.sin(ae) : Math.sin(ae);
  const ty = ccw ? Math.cos(ae) : -Math.cos(ae);
  const head = new THREE.ConeGeometry(0.05, 0.14, 16);
  head.rotateX(Math.PI / 2);
  head.rotateY(Math.PI / 2);
  head.rotateZ(Math.atan2(ty, tx));
  head.translate(ex, ey, 0);
  g.add(mesh(head, mat));
  g.traverse((o) => {
    o.layers.set(1);
    o.userData.noAO = true;
  });
  return g;
}

/** 이름표 스프라이트 — stlShared.makeLabelSprite 재사용, layer 1 */
export function tag(text: string, pos: THREE.Vector3): THREE.Sprite {
  const w = 0.55 + text.length * 0.14;
  const s = makeLabelSprite(text, '#f2b619', w, 0.34);
  s.position.copy(pos);
  return s;
}

/** 두 원의 교점(링크 기구 풀이). up=true면 c1→c2 기준 왼쪽 해. 못 만들면 null */
export function circleIntersect(c1: BV2, r1: number, c2: BV2, r2: number, up: boolean): BV2 | null {
  const dx = c2[0] - c1[0];
  const dy = c2[1] - c1[1];
  const d = Math.hypot(dx, dy);
  if (d < 1e-9 || d > r1 + r2 || d < Math.abs(r1 - r2)) return null;
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h2 = r1 * r1 - a * a;
  if (h2 <= 0) return null;
  const h = Math.sqrt(h2);
  const ux = dx / d;
  const uy = dy / d;
  const s = up ? 1 : -1;
  return [c1[0] + ux * a - uy * h * s, c1[1] + uy * a + ux * h * s];
}
