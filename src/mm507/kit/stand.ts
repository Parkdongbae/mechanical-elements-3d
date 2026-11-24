// 전시대 — 나무 받침 + 세워진 뒤판 (모든 507 운동의 무대)
import * as THREE from 'three';
import { wood } from '../../models/materials';
import { extrude, mesh, roundedRect } from '../../models/parts/geom';
import { setMM } from './mm';

/** 전시 영역: 폭 4.0 × 높이 2.8, 중심 (cx, cy). 뒤판 앞면이 z = backZ */
export const STAGE = { w: 4.0, h: 2.8, cx: 0, cy: 1.75, backZ: -0.30 } as const;

/** 받침(4.6×0.18×1.6) + 뒤판(4.4×3.1×0.12, 모서리 둥글게). 뒤판은 receiveShadow */
export function displayStand(): THREE.Group {
  const g = new THREE.Group();
  // 받침: 둥근 모서리 프로파일을 세로(Y)로 압출
  const baseGeo = extrude(roundedRect(-2.3, -0.8, 2.3, 0.8, 0.05), 0.18, 0.012);
  baseGeo.rotateX(Math.PI / 2);
  const base = mesh(baseGeo, wood());
  base.position.y = 0.09;
  g.add(base);
  // 뒤판: 앞면이 정확히 backZ에 오도록 두께 절반만큼 뒤로 배치
  const panelGeo = extrude(roundedRect(-2.2, 0.05, 2.2, 3.15, 0.09), 0.12, 0.01);
  const panel = mesh(panelGeo, wood(0xa17248));
  panel.position.z = STAGE.backZ - 0.06;
  g.add(panel);
  setMM(g, { kind: 'stand' });
  return g;
}
