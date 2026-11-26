// 204번 비스듬한 축의 구름 접촉 전용 키트 — 쌍곡면 롤러 몸 + 축, 모선(곧은 선) 줄무늬 12개
// 설계표 docs/mm507-sheets/204.md
import * as THREE from 'three';
import { darkSteel, paint } from '../../models/materials';
import { lathe, mesh } from '../../models/parts/geom';
import { setMM } from './mm';
import { rod } from './shaft';

export const K204 = { a: 0.22, alpha: 0.261799, uEnd: 0.815, rEnd: 0.30998, yL: 1.6, zc: 0.28 } as const;
const K = K204;
const TA = Math.tan(K.alpha);
const rOf = (u: number): number => Math.sqrt(K.a * K.a + u * u * TA * TA);

/** 로컬 X 축 쌍곡면 롤러 + 축 막대(왼쪽 끝이 0.05 더 길다) */
export function hyperRoller204(mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const U = K.uEnd;
  const c = 0.012;
  const prof: [number, number][] = [[0, -U], [K.rEnd - c, -U], [rOf(-U + c), -U + c]];
  const N = 48;
  for (let i = 1; i < N; i++) {
    const u = -U + (2 * U * i) / N;
    prof.push([rOf(u), u]);
  }
  prof.push([rOf(U - c), U - c], [K.rEnd - c, U], [0, U]);
  const geo = lathe(prof, 72);
  geo.rotateZ(-Math.PI / 2);
  g.add(mesh(geo, mat));
  g.add(rod(new THREE.Vector3(-1.15, 0, 0), new THREE.Vector3(1.1, 0, 0), 0.035));
  setMM(g, { kind: 'roller', axis: 'x', a: K.a, alpha: K.alpha });
  return g;
}

/** 모선 12개(롤러 자식). sign +1 = 위 롤러, −1 = 아래 롤러. k = 0 은 노랑 */
export function rulings204(sign: 1 | -1): THREE.Group {
  const g = new THREE.Group();
  const sMax = K.uEnd / Math.cos(K.alpha);
  const ca = Math.cos(K.alpha);
  const sa = Math.sin(K.alpha);
  for (let k = 0; k < 12; k++) {
    const phi = (k * Math.PI) / 6;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), phi);
    const off = new THREE.Vector3(0, -sign * 0.006, 0).applyQuaternion(q);
    const pt = (s: number): THREE.Vector3 =>
      new THREE.Vector3(s * ca, -sign * K.a, -sign * s * sa).applyQuaternion(q).add(off);
    const r = rod(pt(-sMax), pt(sMax), 0.006);
    r.material = k === 0 ? paint(0xffcc00) : darkSteel();
    g.add(r);
  }
  return g;
}
