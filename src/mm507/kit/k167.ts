// 167번 전용 키트 — 끝없는 나선 홈 원통(수직 드럼)과 왕복 막대·스터드
//  드럼: 축 = 로컬 Y, 겉면에 한 바퀴 닫힌 나선 홈 — 반 바퀴는 올라가는 기울기, 반 바퀴는 내려오는
//  기울기(판화 167). 막대: 드럼 오른쪽의 세로 왕복 막대, 원점 = 스터드 가운데, 스터드(목+블록)가 홈에 든다.
//  pose167(theta): 막대가 사인으로 왕복하면 드럼 각 phi 는 삼각 물결의 역함수 — 막대가 내려갈 때도
//  올라갈 때도 phi 는 계속 불어나 한 주기(2π)에 정확히 한 바퀴. 주기마다 정확히 닫힌다.
import * as THREE from 'three';
import { castIron, darkSteel, paint, steel } from '../../models/materials';
import { circlePts, lathe, mesh, rodProfile, TAU, tubeProfile } from '../../models/parts/geom';
import type { V2 } from '../../models/parts/geom';
import { markPin, setMM } from './mm';

export const K167 = {
  R: 0.225, // 드럼 반지름
  L: 1.7, // 드럼 길이(축방향)
  CY: 1.4, // 드럼 가운데 높이
  cgo: 0.15, // 홈 가운데선의 드럼 가운데 위 오프셋(판화: 접합점이 가운데보다 아래)
  amp: 0.42, // 홈 반행정(행정 = 2·amp = 0.84)
  dep: 0.06, // 홈 깊이
  wax: 0.1755, // 홈 축방향(세로) 폭 = (블록 0.105 + 틈 0.008)·√(1+tanL²), tanL = 2·amp/(π·R)
  jr: 0.078, // 저널(위·아래 받음대) 반지름
  jl: 0.115, // 저널 내밈 길이
  jY: 0.435, // 아래 저널 축 높이 = CY − L/2 − jl
  jYTop: 2.365, // 위 저널 축 높이 = CY + L/2 + jl
  rodR: 0.072, // 왕복 막대 반지름
  rodL: 2.0, // 막대 길이
  rodX: 0.43, // 막대 축의 x
  studLow: 0.741, // 스터드 → 막대 아래 끝(막대 맨 아래 = 1.13 − 0.741 = 0.389)
  studUp: 1.259, // 스터드 → 막대 위 끝(맨 위 3.229 ≤ 3.3)
  studR: 0.026, // 스터드 목 반지름
  blockC: 0.195, // 블록 가운데의 x(홈 바닥 0.165 ~ 겉면 0.225 의 가운데쯤)
  blockX: 0.05, // 블록 두께(x)
  blockY: 0.105, // 블록 높이(y) — 홈 벽에 수직 폭 0.113 과 맞춤
  blockZ: 0.07, // 블록 나비(z)
  phase: 1.6, // t = 1(theta 1.6)에서 u = 0 — 판화 자세(막대 맨 아래, 접합점이 스터드 앞)
} as const;

const wrapPi = (a: number): number => a - TAU * Math.round(a / TAU);
/** 세로 물결: tri(0) = −1(접합점), tri(±π) = +1(교차점), 주기 2π */
const tri = (a: number): number => (2 * Math.abs(wrapPi(a))) / Math.PI - 1;

/** 홈 중심 높이(드럼 로컬, 드럼 가운데 기준). ψ = 로컬 각(x = R·cosψ, z = R·sinψ) */
export function grooveY167(psi: number): number {
  return K167.cgo + K167.amp * tri(psi);
}

export interface Pose167 {
  /** 주기 위상 [0, 2π) */
  u: number;
  /** 막대 행정(접합점 위로, 0 ~ 2·amp) */
  s: number;
  /** 드럼 절대 각(rotation.y, 위에서 반시계) — 한 주기에 정확히 2π 씩 쌓임 */
  phi: number;
  /** 스터드(막대 원점)의 세계 높이 */
  studY: number;
}

/** 모든 자세의 닫힌 식. u ∈ (0,π) 막대가 오름(드럼 반바퀴), (π,2π) 내림(드럼 반바퀴 더 — 같은 방향) */
export function pose167(theta: number): Pose167 {
  const up = theta - K167.phase;
  const cyc = Math.floor(up / TAU);
  const u = up - cyc * TAU;
  const c = Math.cos(u);
  const s = K167.amp * (1 - c);
  const rel = u <= Math.PI ? (Math.PI * (1 - c)) / 2 : TAU - (Math.PI * (1 - c)) / 2;
  return { u, s, phi: cyc * TAU + rel, studY: K167.CY + K167.cgo - K167.amp + s };
}

function meshAt(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}
function pinMark(name: string, x: number, y: number, z: number): THREE.Object3D {
  const o = new THREE.Object3D();
  o.name = name;
  o.position.set(x, y, z);
  return markPin(o);
}

/**
 * 나선 홈 드럼. group 원점 = 드럼 가운데 — 모델은 (0, K167.CY, 0) 에 놓고 rotation.y = pose167(theta).phi.
 * 겉면에 한 바퀴 닫힌 홈: 로컬 각 ψ 에서 홈 중심 높이 = grooveY167(ψ) (ψ=0 접합점·아래, ψ=π 교차점·위).
 * ψ = π/2 자리에 표시 줄(name `strip`, 노랑)과 그 바깥 표식 `stripMark`(반지름 R+0.115) — 돌 때 같이 도는 자식.
 */
export function drum167(): THREE.Group {
  const { R, L, dep, wax, jr, jl } = K167;
  const g = new THREE.Group();
  const n = 180;
  const profAt = (psi: number): V2[] => {
    const yc = grooveY167(psi);
    return [
      [-L / 2, R],
      [yc - wax / 2, R],
      [yc - wax / 2, R - dep],
      [yc + wax / 2, R - dep],
      [yc + wax / 2, R],
      [L / 2, R],
    ];
  };
  // 겉면: (r·cosψ, 높이, r·sinψ) 로 5띠 감기 — k104 grooveDrum 과 같은 방법, 축만 Y
  const pos: number[] = [];
  const idx: number[] = [];
  for (let e = 0; e < 5; e++) {
    const base = pos.length / 3;
    for (let i = 0; i <= n; i++) {
      const psi = (i / n) * TAU;
      const p = profAt(psi);
      const a = p[e]!;
      const b = p[e + 1]!;
      const c = Math.cos(psi);
      const sn = Math.sin(psi);
      pos.push(a[1] * c, a[0], a[1] * sn, b[1] * c, b[0], b[1] * sn);
    }
    for (let i = 0; i < n; i++) {
      const i0 = base + i * 2;
      idx.push(i0, i0 + 2, i0 + 1, i0 + 1, i0 + 2, i0 + 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  // 원통은 밝은 강철(검은 주철이면 나선 홈이 안 보여 구분이 안 됨 — 사용자 지적)
  const iron = steel();
  g.add(mesh(geo, iron));
  // 마구리 원판(위는 +Y, 아래는 −Y 를 본다)
  for (const sy of [-1, 1]) {
    const cap = new THREE.CircleGeometry(R, 96);
    cap.rotateX((-sy * Math.PI) / 2);
    g.add(meshAt(cap, iron, 0, (sy * L) / 2, 0));
  }
  // 저널(위·아래 둥근 받음대 — 판화의 반원 마디)
  g.add(mesh(lathe(rodProfile(jr, L / 2 - 0.01, L / 2 + jl, 0.008, jr * 0.7), 28), darkSteel()));
  g.add(mesh(lathe(rodProfile(jr, -L / 2 - jl, -L / 2 + 0.01, jr * 0.7, 0.008), 28), darkSteel()));
  // 표시 줄(ψ = π/2 자리, 홈 위의 맨 몸) + 이름표가 따라갈 표식
  g.add(meshAt(new THREE.BoxGeometry(0.03, 0.1, 0.012), paint(0xf2b619), 0, 0.5, R + 0.004));
  g.add(pinMark('stripMark', 0, 0.5, R + 0.115));
  setMM(g, { kind: 'cam', fn: 'drum167', axis: 'y', R, len: L, amp: K167.amp, depth: dep, grooveW: wax });
  return g;
}

/**
 * 왕복 막대 + 스터드. group 원점 = 스터드 가운데 — 모델은 (K167.rodX, pose167(theta).studY, 0) 에 놓는다.
 * 막대(반지름 rodR)는 로컬 y −studLow ~ +studUp 로 섰다. 스터드: 목(반지름 studR, 로컬 x −0.26 ~ −0.062,
 * 축 = X) + 블록(0.05×0.105×0.07, 로컬 x 가운데 −0.235)이 홈 속에 든다(주위 틈 0.004~0.005).
 * 표식 child `studMark` = 블록 가운데.
 */
export function rod167(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(lathe(rodProfile(K167.rodR, -K167.studLow, K167.studUp, 0.01, 0.01), 28), steel()));
  // 스터드 목: 블록 뒷면(로컬 x = blockC − blockX/2 − rodX)에서 막대 심까지
  const x0 = K167.blockC - K167.blockX / 2 - K167.rodX;
  const x1 = -K167.rodR + 0.01;
  const neck = lathe(rodProfile(K167.studR, x0, x1, 0.004, 0.004), 20);
  neck.rotateZ(-Math.PI / 2);
  g.add(mesh(neck, darkSteel()));
  // 환승 블록(홈에 든다)
  const block = meshAt(
    new THREE.BoxGeometry(K167.blockX, K167.blockY, K167.blockZ),
    darkSteel(),
    K167.blockC - K167.rodX,
    0,
    0,
  );
  block.name = 'stud';
  g.add(block);
  g.add(pinMark('studMark', K167.blockC - K167.rodX, 0, 0));
  setMM(g, { kind: 'slider', fn: 'rod167', axis: 'y' });
  return g;
}

/**
 * 바닥에서 선 축대(아래 저널 받침 — 판화에 없음). group 원점 = 링 가운데(저널 축) —
 * 모델은 (0, K167.jY, 0) 에 놓는다. 링: 구멍 Y 방향(저널 0.078 + 틈 0.006), 기둥은 링 바깥면에서 멈춘다.
 * 표식 child `journalMark` = 축 가운데.
 */
export function pedestal167(): THREE.Group {
  const g = new THREE.Group();
  const bore = K167.jr + 0.006;
  const ro = bore + 0.05;
  const floor = 0.18 - K167.jY; // 로컬 −0.255
  g.add(meshAt(new THREE.BoxGeometry(0.2, 0.03, 0.2), castIron(), 0, floor + 0.015, 0));
  const colTop = -ro; // 기둥은 링 표면에서 멈춘다(저널에 박히지 않는다)
  g.add(meshAt(new THREE.BoxGeometry(0.09, colTop - floor - 0.03, 0.14), castIron(), 0, (colTop + floor + 0.03) / 2, 0));
  g.add(mesh(lathe(tubeProfile(bore, ro, -0.07, 0.07, 0.01), 36), darkSteel()));
  g.add(pinMark('journalMark', 0, 0, 0));
  setMM(g, { kind: 'pillow', axis: 'y', bossY: 0, fn: 'pedestal167' });
  return g;
}

export interface GrooveProbe167 {
  /** 모델 루트에 더할 빈 물체(메시 없음) */
  group: THREE.Group;
  /** 매 프레임: phi = 드럼 각(rotation.y), studY = 스터드 세계 높이 */
  set(phi: number, studY: number): void;
}

/**
 * 홈과 스터드의 침범 검사 표식(메시 없음). 드럼 겉면을 펼친 평면(x = R·ψ, y = 드럼 로컬 높이)에서
 * 홈 = userData.outlines.grooveHole(구멍 다각형, ψ −1.5π ~ 1.5π), 스터드 블록 = 원(userData.outline,
 * 반지름 blockY/2). autocheck 의 다각형 침범이 "블록이 홈 안에 있는가"를 한 주기 내내 잰다.
 */
export function grooveProbe167(): GrooveProbe167 {
  const { R, wax, blockY } = K167;
  const group = new THREE.Group();
  group.name = 'grooveProbe167';
  const map = new THREE.Object3D();
  map.name = 'grooveMap167';
  const left: V2[] = [];
  const right: V2[] = [];
  const m = 180;
  for (let i = 0; i <= m; i++) {
    const psi = -1.5 * Math.PI + (3 * Math.PI * i) / m;
    const yc = grooveY167(psi);
    left.push([R * psi, yc - wax / 2]);
    right.push([R * psi, yc + wax / 2]);
  }
  map.userData.outlines = { grooveHole: [...left, ...right.reverse()] };
  const pin = new THREE.Object3D();
  pin.name = 'studSection167';
  pin.userData.outline = circlePts(blockY / 2, 24);
  group.add(map, pin);
  setMM(group, { kind: 'probe', fn: 'grooveProbe167' });
  return {
    group,
    set(phi: number, studY: number): void {
      // 스터드가 바라보는 드럼 로컬 각 = phi (rotation.y = phi 에서 세계 +X 이 로컬 ψ = phi)
      pin.position.set(R * wrapPi(phi), studY - K167.CY, 0);
    },
  };
}

/**
 * 위 저널 받침(고정, 판화에 없음). group 원점 = 링 가운데(위 저널 축) — 모델은 (0, K167.jYTop, 0) 에 놓는다.
 * 링: 구멍 Y 방향(저널 + 틈 0.006), 높이 0.1. 팔: 뒤판 앞면(z −0.30)에서 링 바깥면까지.
 */
export function topBearing167(): THREE.Group {
  const g = new THREE.Group();
  const bore = K167.jr + 0.006;
  const ro = bore + 0.05;
  g.add(mesh(lathe(tubeProfile(bore, ro, -0.05, 0.05, 0.01), 36), darkSteel()));
  const z0 = -0.3;
  const z1 = -ro + 0.004;
  g.add(meshAt(new THREE.BoxGeometry(0.12, 0.07, z1 - z0), castIron(), 0, 0, (z0 + z1) / 2));
  g.add(pinMark('topJournalMark', 0, 0, 0));
  setMM(g, { kind: 'pillow', axis: 'y', bossY: 0, fn: 'topBearing167' });
  return g;
}

/**
 * 왕복 막대 안내(고정, 판화에 없음). group 원점 = 링 가운데(막대 축) — 모델은 (K167.rodX, y, 0) 에 놓는다.
 * 링: 구멍 Y 방향(막대 + 틈 0.005), 높이 0.08. 팔: 뒤판 앞면에서 링 바깥면까지.
 */
export function rodGuide167(): THREE.Group {
  const g = new THREE.Group();
  const bore = K167.rodR + 0.005;
  const ro = bore + 0.04;
  g.add(mesh(lathe(tubeProfile(bore, ro, -0.04, 0.04, 0.008), 36), castIron()));
  const z0 = -0.3;
  const z1 = -ro + 0.004;
  g.add(meshAt(new THREE.BoxGeometry(0.1, 0.06, z1 - z0), castIron(), 0, 0, (z0 + z1) / 2));
  setMM(g, { kind: 'pillow', axis: 'y', bossY: 0, fn: 'rodGuide167' });
  return g;
}
