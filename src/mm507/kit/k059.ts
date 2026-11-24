// 059·060번 전용 부품 — 속 빈 축(슬리브), 림 줄무늬, YZ 평면 벨트
import * as THREE from 'three';
import { brass, darkSteel, paint } from '../../models/materials';
import { lathe, mesh, tubeProfile } from '../../models/parts/geom';
import { Belt, beltPathAround, type BeltOpts, type V2 } from './belt';

/** 속 빈 축(슬리브): 회전축 = 로컬 Z, z ∈ [0, length], 바깥 반지름 rOut, 안 반지름 rIn */
export function hollowShaft(rOut: number, rIn: number, length: number): THREE.Group {
  const g = new THREE.Group();
  const geo = lathe(tubeProfile(rIn, rOut, 0, length, rOut * 0.12), 32);
  geo.rotateX(Math.PI / 2);
  g.add(mesh(geo, brass()));
  return g;
}

/** 림 줄무늬: 회전이 옆에서도 보이게 림 바깥에 붙이는 밝은 막대 count 개 (회전축 = 로컬 Z, 원점 중심) */
export function rimStripes(r: number, width: number, count = 6): THREE.Group {
  const g = new THREE.Group();
  const mat = paint(0xf2b619);
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const b = mesh(new THREE.BoxGeometry(0.012, 0.02, width * 0.8), mat);
    b.position.set(Math.cos(a) * (r + 0.004), Math.sin(a) * (r + 0.004), 0);
    b.rotation.z = a;
    g.add(b);
  }
  return g;
}

/** 축 받침(뒤판에서 축 끝까지 이어진 짧은 막대 + 블록): 위치 (x, y), 축 높이 z
 *  블록 0.1 × 0.1 × 0.11 — 지름 0.09 축의 끝면이 블록 옆면(x ± 0.05)에 닿게 놓는다(축이 블록 속으로 들어가지 않게).
 *  막대는 블록 뒷면(z − 0.055)까지만 — 전에는 블록 깊이 0.06 < 축 지름이라 축 끝이 블록 밖으로 비어져 나오고 막대가 축 속까지 들어갔다. */
export function wallBracket(x: number, y: number, z: number, backZ: number): THREE.Group {
  const g = new THREE.Group();
  const len = z - 0.055 - backZ;
  const geo = lathe(
    [
      [0, 0],
      [0.035, 0],
      [0.035, len],
      [0, len]
    ],
    16
  );
  geo.rotateX(Math.PI / 2);
  const post = mesh(geo, darkSteel());
  post.position.set(x, y, backZ);
  g.add(post);
  const blk = mesh(new THREE.BoxGeometry(0.1, 0.1, 0.11), darkSteel());
  blk.position.set(x, y, z);
  g.add(blk);
  return g;
}

/**
 * YZ 평면(세로 벨트) 평벨트. 축이 X 인 풀리들을 (z, y) 평면에서 감는다.
 * circles 의 c = [z, y]. 반환 group 은 x 위치만 setX 로 바꾼다(벨트가 풀리 위에서 옆으로 밀림).
 */
export interface VerticalBelt {
  group: THREE.Group;
  belt: Belt;
  setX(x: number): void;
}
export function verticalBelt(circles: { c: V2; r: number; ccw: boolean }[], opts: BeltOpts = {}): VerticalBelt {
  const path2 = beltPathAround(circles);
  const pts = path2.map(([a, b]) => new THREE.Vector3(a, b, 0)); // 로컬 (z, y, 폭 방향)
  const belt = new Belt(pts, { style: 'flat', ...opts });
  const group = new THREE.Group();
  group.rotation.y = -Math.PI / 2; // 로컬 x → 월드 z, 로컬 z → 월드 -x
  group.add(belt.group);
  const outer = new THREE.Group();
  outer.add(group);
  return { group: outer, belt, setX: (x: number) => outer.position.set(x, 0, 0) };
}
