// 202번 장구형(힌들리) 웜 전용 키트 — 설계표 docs/mm507-sheets/202.md 의 '키트 추가' 식 그대로 (207번도 같은 키트를 쓴다)
import * as THREE from 'three';
import { brass, bronze } from '../../models/materials';
import { creased, lathe, mesh } from '../../models/parts/geom';
import { setMM } from './mm';

export const K202 = { teeth: 50, module: 0.036, rw: 0.17, phiMax: 0.628319, hand: 1 as 1 | -1, driver: true, stepsPerTurn: 64, xEnd: 0.60 } as const;

export interface GloboidOpts {
  teeth: number;
  module: number;
  rw: number;
  phiMax: number;
  hand: 1 | -1;
  driver: boolean;
  stepsPerTurn: number;
  xEnd: number;
}

/**
 * 장구형(힌들리) 웜: 로컬 X = 축, 원점 = 목 가운데, 휠은 로컬 +Y 쪽(축에서 CC = rp + rw 떨어짐).
 * 몸통은 휠 피치원 호를 축 둘레로 감은 회전체, 나사산은 휠 평면 극좌표(ρ, φ)에서 풀어 만든 이어진 띠 하나.
 */
export function globoidWorm(o: GloboidOpts): THREE.Group {
  const rp = (o.teeth * o.module) / 2; // 휠 피치 반지름
  const cc = rp + o.rw; // 축 간 거리
  const p = Math.PI * o.module; // 축방향 피치
  const rhoIn = rp + 1.25 * o.module + 0.006; // 산 뿌리(휠 중심 기준, 몸통에 0.006 묻음)
  const rhoTip = rp - o.module; // 산 끝(휠 중심 기준)
  const t20 = Math.tan((20 * Math.PI) / 180);
  const delta = (rho: number): number => (0.19 * p + (rho - rp) * t20) / rho; // 산 반폭(휠각)
  const mat = o.driver === true ? bronze() : brass();
  const g = new THREE.Group();

  // 몸통(core): r(x) = CC − √((rp+1.25m)² − x²) 프로파일을 lathe 로 돌려 X축으로 눕힌다
  const prof: [number, number][] = [[0, -o.xEnd]];
  for (let i = 0; i <= 40; i++) {
    const x = -o.xEnd + (2 * o.xEnd * i) / 40;
    prof.push([cc - Math.sqrt((rp + 1.25 * o.module) ** 2 - x * x), x]);
  }
  prof.push([0, o.xEnd]);
  const coreGeo = lathe(prof, 64);
  coreGeo.rotateZ(-Math.PI / 2); // lathe 의 Y 축 → X 축
  g.add(mesh(coreGeo, mat));

  // 나사산(한 줄): ψ ∈ ±teeth·phiMax(10바퀴)를 2π/stepsPerTurn 간격 고리로, 고리 사이를 사각형 4개로 잇는다
  const psi0 = -o.teeth * o.phiMax;
  const psi1 = o.teeth * o.phiMax;
  const nLoop = Math.round(((psi1 - psi0) * o.stepsPerTurn) / (2 * Math.PI)); // 640 → 고리 641
  const ringAt = (psi: number): [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3] => {
    const fc = o.hand * (psi / o.teeth); // 가운데 휠각
    const pt = (rho: number, phi: number): THREE.Vector3 => {
      const rr = cc - rho * Math.cos(phi); // 웜 축에서의 반지름
      return new THREE.Vector3(rho * Math.sin(phi), rr * Math.cos(psi), rr * Math.sin(psi));
    };
    return [
      pt(rhoIn, fc - delta(rhoIn)), // A 뿌리 왼쪽
      pt(rhoTip, fc - delta(rhoTip)), // B 끝 왼쪽
      pt(rhoTip, fc + delta(rhoTip)), // C 끝 오른쪽
      pt(rhoIn, fc + delta(rhoIn)) // D 뿌리 오른쪽
    ];
  };
  const loops: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3][] = [];
  for (let j = 0; j <= nLoop; j++) loops.push(ringAt(psi0 + ((psi1 - psi0) * j) / nLoop));
  const pos: number[] = [];
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): void => {
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  };
  for (let j = 0; j < nLoop; j++) {
    const [A0, B0, C0, D0] = loops[j]!;
    const [A1, B1, C1, D1] = loops[j + 1]!;
    // 바깥을 향하게: 왼옆 A–B, 산끝 B–C, 오른옆 C–D, 뿌리 D–A
    tri(A0, A1, B1);
    tri(A0, B1, B0);
    tri(B0, B1, C1);
    tri(B0, C1, C0);
    tri(C0, C1, D1);
    tri(C0, D1, D0);
    tri(D0, D1, A1);
    tri(D0, A1, A0);
  }
  // 양끝 사각 뚜껑(시작 뚜껑은 −z, 끝 뚜껑은 +z 를 본다)
  const [As, Bs, Cs, Ds] = loops[0]!;
  const [Ae, Be, Ce, De] = loops[nLoop]!;
  tri(As, Bs, Cs);
  tri(As, Cs, Ds);
  tri(Ae, Ce, Be);
  tri(Ae, De, Ce);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.add(mesh(creased(geo, 40), mat));

  setMM(g, { kind: 'worm', fn: 'globoidWorm', teeth: 1, module: o.module, rp, rw: o.rw, cc, axis: 'x' }); // 검사 표식
  return g;
}
