// 256번 평 풀리 전용 키트 — 상수, 잘린 볼록 림(단면 보이기), 큰 풀리 허브. 설계표 docs/mm507-sheets/256.md
import * as THREE from 'three';
import { brass, darkSteel, paint } from '../../models/materials';
import { lathe, mesh, polygonFace, tubeProfile, type V2 } from '../../models/parts/geom';
import { setMM } from './mm';

/** 256 상수 — 설계표 §부품과 치수 */
export const K256 = {
  C1: [0, 2.12] as [number, number], // 큰 풀리 중심
  C2: [0, 0.82] as [number, number], // 구동 풀리 중심
  ZC: 0.1, // 두 풀리·벨트 가운데 깊이
  R_BELT_BIG: 0.63, // 벨트 경로 반지름(볼록 꼭대기 0.62 + 0.01)
  R_BELT_DRIVE: 0.23, // 벨트 경로 반지름(구동 림 0.22 + 0.01)
  OMEGA: 1.2, // 구동 풀리 각속도 rad/s
  RATIO: 0.36508, // φ1 = RATIO × φ2 (0.63 / 0.22·0.36508 ≈ 벨트 속도 맞춤)
  /** 잘난 자리 평면각 ψ(라디안) — −90° ~ −28° */
  CUT: [(-90 * Math.PI) / 180, (-28 * Math.PI) / 180] as [number, number],
  /** 림·웹 단면 (r, a) 19점 — 앞 4 · 볼록 11 · 뒤 4, 반시계, 닫는 점 없음.
   *  볼록 11점: a = −0.142 + 0.0284k, r = 0.612 + 0.008(1 − (a/0.142)²) */
  RIM256: [
    [0.156, -0.05],
    [0.5, -0.05],
    [0.5, -0.15],
    [0.604, -0.15],
    [0.612, -0.142],
    [0.61488, -0.1136],
    [0.61712, -0.0852],
    [0.61872, -0.0568],
    [0.61968, -0.0284],
    [0.62, 0],
    [0.61968, 0.0284],
    [0.61872, 0.0568],
    [0.61712, 0.0852],
    [0.61488, 0.1136],
    [0.612, 0.142],
    [0.604, 0.15],
    [0.5, 0.15],
    [0.5, 0.05],
    [0.156, 0.05]
  ] as V2[]
};

/** 큰 풀리 림(고정, 잘린 회전체): ψ −90°~−28° 를 잘라 낸 볼록 림·웹 + 주홍 단면판 둘. 원점 = 풀리 중심 */
export function cutRim256(): THREE.Group {
  const g = new THREE.Group();
  // lathe 각 φ 뒤 rotateX(π/2) 면 ψ = φ − 90° — 62°~360° → ψ −28°~270°, ψ −90°~−28° 가 비었다
  const rimGeo = lathe([...K256.RIM256, K256.RIM256[0]!], 72, (62 * Math.PI) / 180, (298 * Math.PI) / 180);
  rimGeo.rotateX(Math.PI / 2);
  const rim = mesh(rimGeo, brass());
  rim.name = 'bigRim';
  g.add(rim);
  // 단면판: 잘난 두 끝단(ψ −90°·−28°)을 막는 주홍 판 — 플랜지도 홈도 없는 넓고 낮게 볼록한 림 단면이 보인다
  const face = (psi: number, name: string): THREE.Mesh => {
    const geo = polygonFace(K256.RIM256); // XY 평면 (r, a)
    geo.rotateX(Math.PI / 2); // (r, a) → (x = r, z = a)
    geo.rotateZ(psi);
    const m = mesh(geo, paint(0xd2552e, { roughness: 0.6 }));
    (m.material as THREE.MeshPhysicalMaterial).side = THREE.DoubleSide;
    m.name = name;
    return m;
  };
  g.add(face(K256.CUT[0], 'bigCutFace'), face(K256.CUT[1], 'bigCutFace2'));
  return g;
}

/** 큰 풀리 회전부: 허브 + 노란 표시 + 바퀴 표식(name bigPulley 는 모델이 붙임). 원점 = 풀리 중심 */
export function bigHub256(): THREE.Group {
  const g = new THREE.Group();
  const hubGeo = lathe(tubeProfile(0.06, 0.16, -0.21, 0.21, 0.006), 48);
  hubGeo.rotateX(Math.PI / 2);
  g.add(mesh(hubGeo, darkSteel()));
  const mark = mesh(new THREE.BoxGeometry(0.05, 0.014, 0.006), paint(0xf2b619));
  mark.position.set(0.11, 0, 0.213);
  g.add(mark);
  setMM(g, {
    kind: 'wheel',
    fn: 'plainPulley256',
    axis: 'z',
    r: 0.612,
    width: 0.3,
    span: [-0.15, 0.15],
    rim: 'flat',
    crowned: true,
    bottom: 0.612,
    outer: 0.62
  });
  return g;
}
