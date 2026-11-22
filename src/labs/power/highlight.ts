// 부품 강조/흐리게: 지금 단계 부품은 은은히 빛나고, 이미 지나온 부품은 반쯤, 나머지는 흐리게.
// 재질의 원래 값을 기억해 두었다가 되돌린다(재질은 부품 그룹마다 따로라서 서로 간섭하지 않는다).

import * as THREE from 'three';

export type HiState = 'normal' | 'focus' | 'pass' | 'dim';

type AnyMat = THREE.Material & { emissive?: THREE.Color; emissiveIntensity?: number; metalness?: number };

interface Entry {
  mat: AnyMat;
  key: string;
  opacity: number;
  transparent: boolean;
  depthWrite: boolean;
  emissive: THREE.Color | null;
  emissiveIntensity: number;
  /** 원래 발광 재질(회전 표시 줄무늬 등) — 색은 건드리지 않는다 */
  glowing: boolean;
}

const FOCUS = new THREE.Color(0xff7a2f);
const EXTRA = new THREE.Color(0x3b8cff);

function materialsOf(objs: THREE.Object3D[]): Set<AnyMat> {
  const out = new Set<AnyMat>();
  for (const o of objs) {
    o.traverse((c) => {
      const m = (c as THREE.Mesh).material as AnyMat | AnyMat[] | undefined;
      if (!m) return;
      for (const x of Array.isArray(m) ? m : [m]) out.add(x);
    });
  }
  return out;
}

export class Highlighter {
  private entries: Entry[] = [];
  private states = new Map<string, HiState>();
  private extra = new Set<AnyMat>();

  register(key: string, objs: THREE.Object3D[]): void {
    for (const mat of materialsOf(objs)) {
      if (this.entries.some((e) => e.mat === mat)) continue;
      const em = mat.emissive ? mat.emissive.clone() : null;
      this.entries.push({
        mat,
        key,
        opacity: mat.opacity,
        transparent: mat.transparent,
        depthWrite: mat.depthWrite,
        emissive: em,
        emissiveIntensity: mat.emissiveIntensity ?? 0,
        glowing: !!em && em.getHex() !== 0 && (mat.emissiveIntensity ?? 0) > 0
      });
    }
  }

  /** states에 없는 키는 normal. extra: 더 강하게(파란빛) 강조할 오브젝트 */
  set(states: Record<string, HiState>, extra: THREE.Object3D[] = []): void {
    this.states = new Map(Object.entries(states));
    this.extra = materialsOf(extra);
    for (const e of this.entries) this.applyBase(e, this.states.get(e.key) ?? 'normal');
  }

  private applyBase(e: Entry, s: HiState): void {
    const m = e.mat;
    const k = s === 'dim' ? 0.13 : s === 'pass' ? 0.5 : 1;
    let transparent = e.transparent;
    let opacity = e.opacity;
    let depthWrite = e.depthWrite;
    if (k < 1) {
      transparent = true;
      opacity = e.opacity * k;
      depthWrite = false;
    } else if (s === 'focus' && e.transparent) {
      opacity = Math.min(1, e.opacity * 1.5);
    }
    if (m.transparent !== transparent) m.needsUpdate = true;
    m.transparent = transparent;
    m.opacity = opacity;
    m.depthWrite = depthWrite;
    if (m.emissive && e.emissive && !e.glowing) {
      m.emissive.copy(e.emissive);
      m.emissiveIntensity = e.emissiveIntensity;
    }
  }

  /** 강조 부품의 발광을 천천히 맥박치게 */
  update(t: number): void {
    const pulse = 0.5 + 0.5 * Math.sin(t * 3.2);
    for (const e of this.entries) {
      const m = e.mat;
      if (!m.emissive || !e.emissive || e.glowing || e.transparent) continue;
      if (this.extra.has(m)) {
        m.emissive.copy(EXTRA);
        m.emissiveIntensity = 0.35 + 0.35 * pulse;
      } else if (this.states.get(e.key) === 'focus') {
        m.emissive.copy(FOCUS);
        m.emissiveIntensity = (0.03 + 0.08 * pulse) * ((m.metalness ?? 0) > 0.5 ? 1 : 0.5);
      }
    }
  }

  /** 원래 재질 상태로 */
  reset(): void {
    this.set({});
  }
}
