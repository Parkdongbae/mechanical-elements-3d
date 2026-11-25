// 잡 부품 — 추·지레·회전 화살표·이름표·두 원 교점 (작업 지시서 16 · 3-3)
import * as THREE from 'three';
import { darkSteel, glow, paint, steel, wood } from '../../models/materials';
import { annularSector, extrude, lathe, mesh, rodProfile, roundedRect, stadiumShape } from '../../models/parts/geom';
import { makeLabelSprite } from '../../machines/stlShared';
import type { V2 as BV2 } from './belt';
import { setMM } from './mm';

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
  // 검사 표식: 추 몸통 + 고리(줄 끝이 붙을 자리 = 고리 꼭대기)
  setMM(m, { kind: 'weight', w, h, d, top: [0, h / 2, 0], ring: [0, h / 2 + w * 0.1, 0] });
  setMM(ring, { kind: 'anchor', of: 'weight', point: [0, w * 0.16, 0], center: [0, 0, 0], ring: w * 0.16, tube: w * 0.045 });
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
  setMM(g, { kind: 'lever', length, pivot: [0, 0, 0], tip: [length, 0, 0] });
  return g;
}

/** 회전 방향 화살표(호 + 화살촉). layer 1, userData.noAO — 라벨 토글 대상 강조 */
export function rotArrow(r: number, ccw: boolean): THREE.Group {
  const g = new THREE.Group();
  const mat = glow(0xd8362f, 0.85);
  const span = (250 * Math.PI) / 180;
  const a0 = -Math.PI * 0.35;
  const a1 = ccw ? a0 + span : a0 - span;
  // annularSector 는 a0 → a1 을 반시계로 그린다. 시계 화살표는 끝점을 바꿔 넣어야 250° 호가 된다(그대로 넣으면 남은 110° 가 그려짐)
  const arcGeo = extrude(annularSector(r - 0.02, r + 0.02, ccw ? a0 : a1, ccw ? a1 : a0), 0.014, 0.004, 16);
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
  setMM(g, { kind: 'arrow', r, ccw });
  return g;
}

/** 이름표 스프라이트 — stlShared.makeLabelSprite 재사용, layer 1 */
export function tag(text: string, pos: THREE.Vector3): THREE.Sprite {
  const s = makeLabelSprite(text, TAG_ACCENT, tagWidth(text), TAG_H);
  s.position.copy(pos);
  s.name = 'mm-tag';
  s.userData.mmTag = true;
  s.userData.mmTagText = text; // 원래(한글) 글자 — 영문 전환 때 사전 키
  setMM(s, { kind: 'tag', text });
  return s;
}

const TAG_ACCENT = '#f2b619';
const TAG_H = 0.34;

/** 이름표 너비 — 한글이 든 글자는 예전 식 그대로, 라틴 글자만이면 글자 폭이 좁아 계수를 줄인다 */
export function tagWidth(text: string): number {
  if (/[ㄱ-힣]/.test(text)) return 0.55 + text.length * 0.14;
  return 0.55 + text.length * 0.085;
}

/**
 * root 아래 tag() 이름표 글자를 바꿔 그린다. dict 에 원래(한글) 글자가 있으면 그 글자로, 없거나 dict=null 이면 원래 글자로.
 * 스프라이트 객체는 그대로 두고(모델이 위치를 움직이므로) 재질의 텍스처·크기만 바꾼다. visible 도 그대로.
 */
export function retextTags(root: THREE.Object3D, dict: Record<string, string> | null): void {
  root.traverse((o) => {
    if (o.userData.mmTag !== true || !(o instanceof THREE.Sprite)) return;
    const mm = o.userData.mm as Record<string, unknown> | undefined;
    const orig = typeof o.userData.mmTagText === 'string' ? o.userData.mmTagText : typeof mm?.text === 'string' ? mm.text : null;
    if (orig === null) return;
    const want = dict?.[orig] ?? orig;
    const shown = typeof o.userData.mmTagShown === 'string' ? o.userData.mmTagShown : orig;
    if (want === shown) return;
    const fresh = makeLabelSprite(want, TAG_ACCENT, tagWidth(want), TAG_H);
    const old = o.material;
    o.material = fresh.material;
    o.scale.x = fresh.scale.x;
    o.scale.y = fresh.scale.y;
    old.map?.dispose();
    old.dispose();
    o.userData.mmTagShown = want;
  });
}

/**
 * root 아래 회전·움직임 화살표(검사 표식 kind 'arrow' 인 객체)의 메시 visible 을 바꾼다.
 * 화살표 그룹 자체의 visible 은 모델이 방향 전환에 쓰므로 건드리지 않는다 — 그룹을 다시 켜도 꺼진 메시는 꺼진 채로 남는다.
 */
export function setArrowsVisible(root: THREE.Object3D, visible: boolean): void {
  root.traverse((o) => {
    const mm = o.userData.mm as { kind?: unknown } | undefined;
    if (mm?.kind !== 'arrow') return;
    o.traverse((c) => {
      if ((c as THREE.Mesh).isMesh === true) c.visible = visible;
    });
  });
}

/** root 아래 tag() 이름표의 visible 만 바꾼다(회전 화살표 등 다른 레이어 1 물체는 그대로) */
export function setTagsVisible(root: THREE.Object3D, visible: boolean): void {
  root.traverse((o) => {
    if (o.userData.mmTag === true) o.visible = visible;
  });
}

/** root 아래 tag() 이름표 개수(검사용) */
export function countTags(root: THREE.Object3D): number {
  let n = 0;
  root.traverse((o) => {
    if (o.userData.mmTag === true) n++;
  });
  return n;
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
