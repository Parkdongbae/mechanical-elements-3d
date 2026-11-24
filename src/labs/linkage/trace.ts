// 자취 선 — three/examples/jsm/lines 의 굵은 선(1px Line 금지). 점이 2,000개를 넘으면 오래된 것부터 버린다.
// 버퍼를 한 번만 만들고 제자리에서 갱신하므로 지오메트리가 늘지 않는다.

import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';

const MAX_SEG = 2000;
const MIN_STEP = 0.004; // 이보다 가까운 점은 건너뜀
const JUMP = 1.2; // 이보다 멀리 뛰면 새 선으로 시작(끊어진 자세 사이를 잇지 않음)

const _size = new THREE.Vector2();

/** 매 렌더 직전에 선 두께 계산용 해상도를 맞춘다 */
export function hookResolution(obj: THREE.Object3D, mat: LineMaterial): void {
  obj.onBeforeRender = (renderer) => {
    renderer.getSize(_size);
    mat.resolution.set(_size.x, _size.y);
  };
}

export class Trace {
  readonly object: LineSegments2;
  private geo = new LineSegmentsGeometry();
  private mat: LineMaterial;
  private buf: THREE.InterleavedBuffer;
  private arr: Float32Array;
  private n = 0;
  private last: THREE.Vector3 | null = null;

  constructor(color: number, width: number, opacity = 1) {
    this.geo.setPositions(new Float32Array(MAX_SEG * 6));
    this.geo.instanceCount = 0;
    this.buf = (this.geo.getAttribute('instanceStart') as THREE.InterleavedBufferAttribute).data;
    this.arr = this.buf.array as Float32Array;
    this.mat = new LineMaterial({ color, linewidth: width, transparent: opacity < 1, opacity, worldUnits: false, depthTest: true });
    this.object = new LineSegments2(this.geo, this.mat);
    this.object.frustumCulled = false;
    this.object.userData.noAO = true;
    this.object.renderOrder = 5;
    hookResolution(this.object, this.mat);
  }

  push(x: number, y: number, z: number): void {
    const p = new THREE.Vector3(x, y, z);
    if (this.last) {
      const d = this.last.distanceTo(p);
      if (d < MIN_STEP) return;
      if (d > JUMP) this.clear();
    }
    if (this.last) {
      if (this.n >= MAX_SEG) {
        this.arr.copyWithin(0, 6, MAX_SEG * 6);
        this.n = MAX_SEG - 1;
      }
      const o = this.n * 6;
      this.arr[o] = this.last.x;
      this.arr[o + 1] = this.last.y;
      this.arr[o + 2] = this.last.z;
      this.arr[o + 3] = p.x;
      this.arr[o + 4] = p.y;
      this.arr[o + 5] = p.z;
      this.n++;
      this.geo.instanceCount = this.n;
      this.buf.needsUpdate = true;
    }
    this.last = p;
  }

  clear(): void {
    this.n = 0;
    this.last = null;
    this.geo.instanceCount = 0;
  }

  dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
  }
}

/** 한 번 그려 두는 흐린 전체 경로 */
export function pathLine(points: number[], color: number, width: number, opacity: number): Line2 {
  const geo = new LineGeometry();
  geo.setPositions(points);
  const mat = new LineMaterial({ color, linewidth: width, transparent: true, opacity, worldUnits: false, depthWrite: false });
  const line = new Line2(geo, mat);
  line.frustumCulled = false;
  line.userData.noAO = true;
  line.renderOrder = 4;
  hookResolution(line, mat);
  return line;
}

/** 점선(기준선·틈 표시) */
export function dashedLine(points: number[], color: number, width: number, dash = 0.12, gap = 0.09): Line2 {
  const geo = new LineGeometry();
  geo.setPositions(points);
  const mat = new LineMaterial({ color, linewidth: width, dashed: true, dashSize: dash, gapSize: gap, worldUnits: false });
  const line = new Line2(geo, mat);
  line.computeLineDistances();
  line.frustumCulled = false;
  line.userData.noAO = true;
  line.renderOrder = 3;
  hookResolution(line, mat);
  return line;
}
