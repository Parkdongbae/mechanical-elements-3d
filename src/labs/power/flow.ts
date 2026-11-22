// 동력 흐름 표시: 엔진에서 현재 단계 부품까지 경로를 따라 흐르는 빛 입자 + 옅은 경로선.
// 경로는 본선(엔진→차동기어) 1개와 좌우 갈래(차축→바퀴) 2개. 다른 부품에 가려지지 않게 깊이 검사를 끈다.

import * as THREE from 'three';
import type { Track } from './chassis';

const MAX = 220;
const SPACING = 0.05;
const STEP = 0.01;

interface Prepared {
  /** 누적 거리 */
  cum: number[];
  pts: THREE.Vector3[];
  /** 단계 k(0~7)까지 갔을 때의 길이 */
  stageEnd: number[];
  length: number;
  /** 전체 흐름에서 이 경로가 시작되는 거리(갈래는 본선 길이) */
  start: number;
  line: THREE.Line;
  linePos: Float32Array;
}

export class FlowIndicator {
  readonly group = new THREE.Group();
  private dots: THREE.InstancedMesh;
  private tracks: Prepared[] = [];
  private phase = 0;
  private lineMat: THREE.LineBasicMaterial;
  private dummy = new THREE.Object3D();

  constructor(radius = 0.014) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xff9a2e, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false, toneMapped: false });
    this.dots = new THREE.InstancedMesh(new THREE.SphereGeometry(radius, 12, 8), mat, MAX);
    this.dots.count = 0;
    this.dots.renderOrder = 20;
    this.dots.frustumCulled = false;
    this.lineMat = new THREE.LineBasicMaterial({ color: 0xffb25a, transparent: true, opacity: 0.55, depthTest: false, depthWrite: false, toneMapped: false });
    this.group.add(this.dots);
    this.group.traverse((o) => (o.userData.noAO = true));
  }

  setTracks(tracks: Track[]): void {
    for (const t of this.tracks) {
      t.line.geometry.dispose();
      this.group.remove(t.line);
    }
    this.tracks = [];
    let mainLen = 0;
    tracks.forEach((tr, ti) => {
      const cum = [0];
      for (let i = 1; i < tr.pts.length; i++) cum.push(cum[i - 1]! + tr.pts[i]!.distanceTo(tr.pts[i - 1]!));
      const length = cum[cum.length - 1] ?? 0;
      const stageEnd: number[] = [];
      for (let k = 0; k <= 7; k++) {
        let end = 0;
        tr.stage.forEach((s, i) => {
          if (s <= k) end = Math.max(end, cum[i + 1]!);
        });
        stageEnd.push(end);
      }
      const n = Math.max(2, Math.ceil(length / STEP) + 1);
      const linePos = new Float32Array(n * 3);
      const tmp = new THREE.Vector3();
      for (let i = 0; i < n; i++) {
        this.pointAt(tr.pts, cum, Math.min(length, i * STEP), tmp);
        linePos.set([tmp.x, tmp.y, tmp.z], i * 3);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
      geo.setDrawRange(0, 0);
      const line = new THREE.Line(geo, this.lineMat);
      line.renderOrder = 19;
      line.frustumCulled = false;
      line.userData.noAO = true;
      this.group.add(line);
      if (ti === 0) mainLen = length;
      this.tracks.push({ cum, pts: tr.pts, stageEnd, length, start: ti === 0 ? 0 : mainLen, line, linePos });
    });
  }

  private pointAt(pts: THREE.Vector3[], cum: number[], s: number, out: THREE.Vector3): THREE.Vector3 {
    let i = 1;
    while (i < cum.length - 1 && cum[i]! < s) i++;
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const seg = cum[i]! - cum[i - 1]!;
    const t = seg > 0 ? (s - cum[i - 1]!) / seg : 0;
    return out.lerpVectors(a, b, Math.max(0, Math.min(1, t)));
  }

  /** 본선 전체 길이 + 갈래 길이(전체 흐름 재생 시간 계산용) */
  totalLength(): number {
    const main = this.tracks[0]?.length ?? 0;
    const br = this.tracks[1]?.length ?? 0;
    return main + br;
  }

  /**
   * reach: 단계 k까지(0이면 표시 없음). front: 전체 흐름 재생 중의 앞머리 거리(주면 reach 대신 사용).
   * cut: 본선을 이 길이에서 끊는다(클러치 끊김).
   */
  update(dt: number, speed: number, reach: number, front: number | null, cut: number | null): void {
    this.phase = (this.phase + speed * dt) % SPACING;
    let n = 0;
    for (const tr of this.tracks) {
      let limit: number;
      if (front !== null) limit = Math.min(tr.length, front - tr.start);
      else limit = tr.start === 0 ? tr.stageEnd[Math.min(7, reach)]! : reach >= 6 ? tr.stageEnd[Math.min(7, reach)]! : 0;
      if (cut !== null && tr.start === 0) limit = Math.min(limit, cut);
      else if (cut !== null) limit = 0;
      const cnt = limit > 0 ? Math.min(tr.linePos.length / 3, Math.floor(limit / STEP) + 1) : 0;
      tr.line.geometry.setDrawRange(0, cnt);
      if (limit <= 0) continue;
      // 전체 거리 기준으로 같은 간격 → 본선과 갈래가 끊김 없이 이어진다
      const first = Math.ceil((tr.start - this.phase) / SPACING);
      for (let j = first; n < MAX; j++) {
        const s = j * SPACING + this.phase - tr.start;
        if (s > limit) break;
        if (s < 0) continue;
        this.pointAt(tr.pts, tr.cum, s, this.dummy.position);
        const head = Math.min(1, (limit - s) / 0.12);
        this.dummy.scale.setScalar(0.55 + 0.65 * (1 - head) + 0.25 * head);
        this.dummy.updateMatrix();
        this.dots.setMatrixAt(n++, this.dummy.matrix);
      }
    }
    this.dots.count = n;
    this.dots.instanceMatrix.needsUpdate = true;
  }

  /** 본선에서 단계 k의 끝 거리 */
  stageEnd(k: number): number {
    return this.tracks[0]?.stageEnd[Math.max(0, Math.min(7, k))] ?? 0;
  }

  dispose(): void {
    for (const t of this.tracks) t.line.geometry.dispose();
    this.lineMat.dispose();
    this.dots.geometry.dispose();
    (this.dots.material as THREE.Material).dispose();
  }
}
