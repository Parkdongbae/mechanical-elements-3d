// 번호 전용 키트 (507 · 144번) — k143.ts 에 있는 144 부품(링크 막대·눈 막대·받침 기둥) 외에
// 없는 것 하나만 여기에 더한다: 막대 안내(바닥에 선 눈 달린 판).
// 공용 키트와 k143.ts 는 고치지 않는다. 모델은 '../kit/k143' 과 '../kit/k144' 에서 import 한다.
import * as THREE from 'three';
import { castIron } from '../../models/materials';
import { circlePath, extrude, mesh, shapeFrom } from '../../models/parts/geom';
import type { V2 } from '../../models/parts/geom';
import { setMM } from './mm';
import { K144 } from './k143';

export interface RodGuide144Opts {
  /** 판 반폭. 기본 0.05 — 오른쪽 안내에서 목 블록(0.09 높이)과 최소 0.012 틈 */
  halfW?: number;
  /** 눈 테: 구멍 바깥 반지름. 기본 0.05 */
  eyeR?: number;
  /** 구멍 반지름(판 앞뒤 면에서). 기본 K144.rodR + 0.004 */
  bore?: number;
}

/**
 * 막대 안내(144): 판화의 왼쪽 벽 구멍을 줄인 것(오른쪽은 판화에 없는 보충).
 * 얇은 판이 발판에서 올라와 위쪽 눈 보스에서 끝나고, 막대는 눈의 X 방향(막대 축과 나란한) 관통 구멍을 지난다
 * — 옛 판은 평면 구멍을 두께 방향으로 뚫어 막대가 판 살에 박혔다. 원점 = 구멍 중심 (막대 축 위)
 * → 모델은 position.set(안내 x, K144.CY, 0). zc = 판의 월드 z 가운데.
 */
export function rodGuide144(zc?: number, o: RodGuide144Opts = {}): THREE.Group {
  const z = zc ?? K144.zEye;
  const halfW = o.halfW ?? 0.05;
  const eyeR = o.eyeR ?? 0.05;
  const bore = o.bore ?? K144.rodR + 0.004;
  const drop = K144.CY - 0.18; // 구멍에서 받침대 윗면(0.18)까지
  const g = new THREE.Group();
  // 단면(z, y): 반두께 0.02 판이 y −0.06 에서 눈 보스(반지름 eyeR)로 넓어진다 — 구멍이 얇은 판을 가르지 않게
  const zt = 0.02;
  const fs = -0.06;
  const pts: V2[] = [
    [-zt, -drop + 0.05],
    [zt, -drop + 0.05],
    [zt, fs],
    [eyeR, fs],
    [eyeR, 0]
  ];
  for (let i = 1; i <= 12; i++) {
    const a = (Math.PI * i) / 12; // 0° → 180°, 위로 넘어가는 눈 원호
    pts.push([eyeR * Math.cos(a), eyeR * Math.sin(a)]);
  }
  pts.push([-eyeR, fs], [-zt, fs]);
  const sh = shapeFrom(pts.map(([pz, py]) => [-pz, py] as V2)); // (z, y) → 평면 (x, y)
  sh.holes.push(circlePath(0, 0, bore + 0.006)); // 모따기 0.006 이 x 단면에서 bore 로 좁힌다 — 구멍은 X 방향 관통
  const geo = extrude(sh, halfW * 2, 0.006, 28);
  geo.rotateY(Math.PI / 2); // 압출 방향 → X(막대 축), 단면의 z → 월드 z
  const plate = mesh(geo, castIron({ roughness: 0.6 }));
  plate.position.z = z;
  g.add(plate);
  // 발판: 받침대 윗면에 붙는 넓은 밑동
  const foot = mesh(new THREE.BoxGeometry(0.18, 0.05, 0.14), castIron({ roughness: 0.6 }));
  foot.position.set(0, -drop + 0.025, z);
  g.add(foot);
  setMM(g, { kind: 'guide', fn: 'rodGuide144', axis: 'x', r: bore });
  return g;
}
