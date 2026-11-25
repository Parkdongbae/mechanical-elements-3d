// 「507 기계 운동」 3D 이름표 지시선 — 이름표(tag 스프라이트)에서 가장 가까운 부재 표면 점까지 가는 선 + 끝 점.
// 모델 파일에는 대상 좌표가 없으므로 모델이 처음 자세를 잡은 뒤 한 번 자동으로 고른다.
// 고른 점은 그 메시의 로컬 좌표로 저장 → 매 프레임 matrixWorld 로 다시 구해 움직이는 부재를 따라간다.
// 이름표가 꺼지거나(visible) 이름표·대상의 조상이 숨으면 지시선도 숨는다.

import * as THREE from 'three';

const LINE_COLOR = 0xf2b619;
/** 이 거리(월드)보다 먼 부재는 대상으로 삼지 않는다 */
const MAX_DIST = 1.6;
/** 이름표 바로 뒤에 붙은 부재는 지시선이 거의 안 보이므로 최소 길이 아래면 선을 숨긴다 */
const MIN_LEN = 0.02;

interface Leader {
  tag: THREE.Sprite;
  target: THREE.Mesh;
  local: THREE.Vector3;
  line: THREE.Line;
  dot: THREE.Points;
  pos: THREE.BufferAttribute;
  dotPos: THREE.BufferAttribute;
}

function isMesh(o: THREE.Object3D): o is THREE.Mesh {
  return (o as THREE.Mesh).isMesh === true;
}

/** 대상 후보에서 빼는 것: 전시대 받침·뒤판, 이름표, 화살표, 투명 ghost, 레이어 1(덧그림) */
function excludedSubtree(o: THREE.Object3D): boolean {
  if (o.userData.mmTag === true || o.userData.mmLeader === true || o.userData.mmStandPart === true) return true;
  const mm = o.userData.mm as { kind?: unknown } | undefined;
  return mm?.kind === 'arrow';
}

function isGhost(m: THREE.Mesh): boolean {
  const mats = Array.isArray(m.material) ? m.material : [m.material];
  return mats.every((x) => x.transparent && x.opacity < 0.6);
}

/** 조상까지 모두 visible 인지 */
function shownInWorld(o: THREE.Object3D | null): boolean {
  for (let p = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}

/** 이름표 낱말 → 부재 표식(kind·fn·name) 낱말. 맞으면 그 부재를 우선한다 */
const WORDS: [RegExp, RegExp][] = [
  [/풀리|도르래|바퀴|휠|원판|드럼|바퀴통/, /wheel|pulley|disc|disk|drum|flywheel|sheave|block/],
  [/기어|피니언|톱니|웜/, /gear|pinion|worm|rack|ratchet|tooth/],
  [/래크|랙/, /rack/],
  [/벨트|로프|줄|띠|체인|끈/, /belt|rope|chain|strap|cord/],
  [/추$|추|^추|무게/, /weight/],
  [/캠/, /cam/],
  [/크랭크/, /crank/],
  [/막대|로드|봉|링크/, /rod|link|bar|lever|beam|arm/],
  [/지레|레버|팔/, /lever|arm|beam/],
  [/축/, /shaft|spindle|axle|arbor/],
  [/스프링|용수철/, /spring|coil/],
  [/래칫/, /ratchet/],
  [/멈춤쇠|폴/, /pawl|catch/],
  [/나사/, /screw|thread|nut/],
  [/요크/, /yoke/],
  [/기둥|받침/, /post|support|frame|standard|bracket|pillow/],
  [/미끄럼|슬라이드|활주/, /slide|slider|carriage/]
];
const FLEX = /belt|rope|chain|strap|cord/;
const FLEX_TAG = /벨트|로프|줄|띠|체인|끈/;

/** 메시와 조상(루트 전까지)의 kind·fn·name 을 한 문자열로 */
function descriptor(m: THREE.Object3D, root: THREE.Object3D): string {
  const out: string[] = [];
  for (let p: THREE.Object3D | null = m; p && p !== root; p = p.parent) {
    const mm = p.userData.mm as { kind?: unknown; fn?: unknown } | undefined;
    if (p.name) out.push(p.name);
    if (mm?.kind !== undefined) out.push(String(mm.kind));
    if (mm?.fn !== undefined) out.push(String(mm.fn));
  }
  return out.join(' ').toLowerCase();
}

/** 거리 배율: 낱말이 맞으면 0.5, 이름표가 줄·벨트를 말하지 않는데 줄·벨트면 3 */
function factorFor(tagText: string, desc: string): number {
  let f = 1;
  if (FLEX.test(desc) && !FLEX_TAG.test(tagText)) f *= 3;
  for (const [ko, en] of WORDS) {
    if (ko.test(tagText) && en.test(desc)) {
      f *= 0.5;
      break;
    }
  }
  return f;
}
const MIN_FACTOR = 0.5;

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _q = new THREE.Vector3();
const _tri = new THREE.Triangle();
const _sphere = new THREE.Sphere();

/** p(월드)에서 메시 표면의 가장 가까운 점(월드)을 out 에 — 거리 제곱 반환 */
function closestOnMesh(m: THREE.Mesh, p: THREE.Vector3, out: THREE.Vector3, limit2: number): number {
  const geo = m.geometry;
  const pos = geo.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (!pos) return Infinity;
  const mw = m.matrixWorld;
  const idx = geo.getIndex();
  const triCount = idx ? idx.count / 3 : pos.count / 3;
  // 삼각형이 아주 많으면 건너뛰며 표본(근사) — 가장 큰 기어도 수만 개 안쪽
  const stride = triCount > 40000 ? Math.ceil(triCount / 40000) : 1;
  let best = limit2;
  for (let t = 0; t < triCount; t += stride) {
    const i0 = idx ? idx.getX(t * 3) : t * 3;
    const i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
    const i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
    _a.fromBufferAttribute(pos, i0).applyMatrix4(mw);
    _b.fromBufferAttribute(pos, i1).applyMatrix4(mw);
    _c.fromBufferAttribute(pos, i2).applyMatrix4(mw);
    _tri.set(_a, _b, _c);
    _tri.closestPointToPoint(p, _q);
    const d2 = _q.distanceToSquared(p);
    if (d2 < best) {
      best = d2;
      out.copy(_q);
    }
  }
  return best;
}

export class TagLeaders {
  readonly group = new THREE.Group();
  private items: Leader[] = [];
  private visible = true;

  constructor(private root: THREE.Object3D) {
    this.group.name = 'mm-leaders';
    this.group.userData.mmLeader = true;
    this.group.matrixAutoUpdate = false; // 월드 좌표를 그대로 쓰기 위해 root 의 역행렬을 매 프레임 넣는다
    root.add(this.group);
    this.build();
  }

  private build(): void {
    const root = this.root;
    root.updateMatrixWorld(true);
    const tags: THREE.Sprite[] = [];
    const meshes: { m: THREE.Mesh; c: THREE.Vector3; r: number; desc: string }[] = [];
    const walk = (o: THREE.Object3D): void => {
      if (o.userData.mmTag === true && o instanceof THREE.Sprite) {
        tags.push(o);
        return;
      }
      if (excludedSubtree(o)) return;
      if (isMesh(o) && o.layers.mask !== 2 && !isGhost(o)) {
        const g = o.geometry;
        if (!g.boundingSphere) g.computeBoundingSphere();
        if (g.boundingSphere) {
          _sphere.copy(g.boundingSphere).applyMatrix4(o.matrixWorld);
          meshes.push({ m: o, c: _sphere.center.clone(), r: _sphere.radius, desc: descriptor(o, root) });
        }
      }
      for (const ch of o.children) walk(ch);
    };
    walk(root);

    const p = new THREE.Vector3();
    const hit = new THREE.Vector3();
    const bestHit = new THREE.Vector3();
    for (const tag of tags) {
      tag.getWorldPosition(p);
      // 괄호 앞 낱말이 본 이름 — '링 기어(안쪽 이, 열린 벨트)' 는 기어를 가리킨다
      const text = String(tag.userData.mmTagText ?? '').split('(')[0] ?? '';
      // 점수 = 표면까지 거리 × 배율(factorFor). 경계구 최소 거리로 정렬해 가까운 것부터 정밀 계산,
      // 가장 좋은 배율로도 지금 최고점을 못 넘는 구가 나오면 멈춘다
      const cands = meshes
        .map((x) => ({ ...x, lb: Math.max(0, x.c.distanceTo(p) - x.r), f: factorFor(text, x.desc) }))
        .filter((x) => x.lb < MAX_DIST)
        .sort((a, b) => a.lb - b.lb);
      let bestScore = MAX_DIST;
      let target: THREE.Mesh | null = null;
      for (const cd of cands) {
        if (cd.lb * MIN_FACTOR >= bestScore) break;
        if (cd.lb * cd.f >= bestScore) continue;
        const lim = bestScore / cd.f;
        const d2 = closestOnMesh(cd.m, p, hit, lim * lim);
        const score = Math.sqrt(d2) * cd.f;
        if (score < bestScore) {
          bestScore = score;
          target = cd.m;
          bestHit.copy(hit);
        }
      }
      if (!target) continue;
      const local = target.worldToLocal(bestHit.clone());
      this.items.push(this.makeLeader(tag, target, local));
    }
    this.update();
  }

  private makeLeader(tag: THREE.Sprite, target: THREE.Mesh, local: THREE.Vector3): Leader {
    const geo = new THREE.BufferGeometry();
    const pos = new THREE.BufferAttribute(new Float32Array(6), 3);
    geo.setAttribute('position', pos);
    const line = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({ color: LINE_COLOR, depthTest: false, depthWrite: false, transparent: true, opacity: 0.95, toneMapped: false })
    );
    line.renderOrder = 9; // 이름표(10) 바로 아래 — 선이 이름표 글자를 가리지 않는다
    line.frustumCulled = false;
    const dgeo = new THREE.BufferGeometry();
    const dotPos = new THREE.BufferAttribute(new Float32Array(3), 3);
    dgeo.setAttribute('position', dotPos);
    const dot = new THREE.Points(
      dgeo,
      new THREE.PointsMaterial({ color: LINE_COLOR, size: 7, sizeAttenuation: false, depthTest: false, depthWrite: false, toneMapped: false })
    );
    dot.renderOrder = 9;
    dot.frustumCulled = false;
    for (const o of [line, dot]) {
      o.layers.set(1);
      o.userData.mmLeader = true;
      o.userData.noAO = true;
      this.group.add(o);
    }
    return { tag, target, local, line, dot, pos, dotPos };
  }

  setVisible(on: boolean): void {
    this.visible = on;
    this.update();
  }

  /** 매 프레임 — 선 시작 = 이름표 월드 위치, 끝 = 대상 메시 로컬 점의 월드 위치 */
  update(): void {
    this.group.visible = this.visible;
    if (!this.visible || this.items.length === 0) return;
    this.root.updateMatrixWorld(true);
    // group 의 월드 행렬 = 단위 → 로컬 = 월드
    const parentInv = this.group.parent ? this.group.parent.matrixWorld.clone().invert() : new THREE.Matrix4();
    this.group.matrix.copy(parentInv);
    this.group.matrixWorld.identity();
    for (const it of this.items) {
      const show = shownInWorld(it.tag) && shownInWorld(it.target);
      it.tag.getWorldPosition(_a);
      _b.copy(it.local).applyMatrix4(it.target.matrixWorld);
      const ok = show && _a.distanceTo(_b) > MIN_LEN;
      it.line.visible = ok;
      it.dot.visible = ok;
      if (!ok) continue;
      it.pos.setXYZ(0, _a.x, _a.y, _a.z);
      it.pos.setXYZ(1, _b.x, _b.y, _b.z);
      it.pos.needsUpdate = true;
      it.dotPos.setXYZ(0, _b.x, _b.y, _b.z);
      it.dotPos.needsUpdate = true;
    }
  }

  /** 검사용: 이름표 글자 → 대상 메시 이름(조상 이름 포함) */
  describe(): { tag: string; target: string }[] {
    return this.items.map((it) => {
      const names: string[] = [];
      for (let p: THREE.Object3D | null = it.target; p && p !== this.root; p = p.parent) {
        const mm = p.userData.mm as { kind?: unknown; fn?: unknown } | undefined;
        const n = p.name || (mm ? String(mm.fn ?? mm.kind ?? '') : '');
        if (n) names.push(n);
      }
      return { tag: String(it.tag.userData.mmTagShown ?? it.tag.userData.mmTagText ?? ''), target: names.join(' < ') || '(이름 없음)' };
    });
  }

  dispose(): void {
    this.group.removeFromParent();
    this.group.traverse((o) => {
      const x = o as THREE.Line;
      if (x.geometry) x.geometry.dispose();
      const mat = (x as { material?: THREE.Material }).material;
      mat?.dispose();
    });
    this.items = [];
  }
}
