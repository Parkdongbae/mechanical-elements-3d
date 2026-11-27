// 255번 플랜지 풀리 전용 키트 — 상수, 잘린 림(단면 보이기), 큰 풀리 허브. 설계표 docs/mm507-sheets/255.md
import * as THREE from 'three';
import { brass, darkSteel, paint } from '../../models/materials';
import { lathe, mesh, polygonFace, tubeProfile, type V2 } from '../../models/parts/geom';
import { setMM } from './mm';

/** 255 상수 — 설계표 §부품과 치수 */
export const K255 = {
  C1: [0, 2.12] as [number, number], // 큰 풀리 중심
  C2: [0, 0.82] as [number, number], // 구동 풀리 중심
  ZC: 0.1, // 두 풀리·벨트 가운데 깊이
  R_BELT_BIG: 0.565, // 벨트 경로 반지름(큰 풀리 드럼 0.555 + 0.01)
  R_BELT_DRIVE: 0.23, // 벨트 경로 반지름(구동 림 0.22 + 0.01)
  OMEGA: 1.2, // 구동 풀리 각속도 rad/s
  RATIO: 0.40708, // φ1 = RATIO × φ2
  /** 잘난 자리 평면각 ψ(라디안) — −90° ~ −25° */
  CUT: [(-90 * Math.PI) / 180, (-25 * Math.PI) / 180] as [number, number],
  /** 림·웹 단면 (r, a) 14점 — 반시계, 닫는 점 없음 */
  RIM255: [
    [0.156, -0.04],
    [0.47, -0.04],
    [0.47, -0.17],
    [0.612, -0.17],
    [0.62, -0.162],
    [0.62, -0.1],
    [0.555, -0.1],
    [0.555, 0.1],
    [0.62, 0.1],
    [0.62, 0.162],
    [0.612, 0.17],
    [0.47, 0.17],
    [0.47, 0.04],
    [0.156, 0.04]
  ] as V2[]
};

/** 큰 풀리 림(고정, 잘린 회전체): ψ −90°~−25° 를 잘라 낸 림·웹 + 주홍 단면판 둘. 원점 = 풀리 중심 */
export function cutRim255(): THREE.Group {
  const g = new THREE.Group();
  // lathe 각 φ 뒤 rotateX(π/2) 면 ψ = φ − 90° — 65°~360° → ψ −25°~270°, ψ −90°~−25° 가 비었다
  const rimGeo = lathe(K255.RIM255, 72, (65 * Math.PI) / 180, (295 * Math.PI) / 180);
  rimGeo.rotateX(Math.PI / 2);
  const rim = mesh(rimGeo, brass());
  rim.name = 'bigRim';
  g.add(rim);
  // 단면판: 잘난 두 끝단(ψ −90°·−25°)을 막는 주홍 판 — 플랜지 둘 + 낮은 드럼면의 凹 단면이 보인다
  const face = (psi: number, name: string): THREE.Mesh => {
    const geo = polygonFace(K255.RIM255); // XY 평면 (r, a)
    geo.rotateX(Math.PI / 2); // (r, a) → (x = r, z = a)
    geo.rotateZ(psi);
    const m = mesh(geo, paint(0xd2552e, { roughness: 0.6 }));
    (m.material as THREE.MeshPhysicalMaterial).side = THREE.DoubleSide;
    m.name = name;
    return m;
  };
  g.add(face(K255.CUT[0], 'bigCutFace'), face(K255.CUT[1], 'bigCutFace2'));
  return g;
}

/** 큰 풀리 회전부: 허브 + 노란 표시 + 바퀴 표식(name bigPulley 는 모델이 붙임). 원점 = 풀리 중심 */
export function bigHub255(): THREE.Group {
  const g = new THREE.Group();
  const hubGeo = lathe(tubeProfile(0.06, 0.16, -0.23, 0.23, 0.006), 48);
  hubGeo.rotateX(Math.PI / 2);
  g.add(mesh(hubGeo, darkSteel()));
  const mark = mesh(new THREE.BoxGeometry(0.05, 0.014, 0.006), paint(0xf2b619));
  mark.position.set(0.11, 0, 0.233);
  g.add(mark);
  setMM(g, {
    kind: 'wheel',
    fn: 'flangedPulley255',
    axis: 'z',
    r: 0.555,
    width: 0.2,
    span: [-0.1, 0.1],
    rim: 'flat',
    bottom: 0.555,
    outer: 0.62
  });
  return g;
}
