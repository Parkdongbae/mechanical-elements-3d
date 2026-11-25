// 144 레이지 통즈 — X자로 엇갈린 지렛대 4칸. 오른쪽 눈 막대(구동)의 짧은 좌우 왕복이
// 왼쪽 눈 막대에 반대 방향으로 정확히 3배 왕복을 만든다 (설계표 docs/mm507-sheets/144.md,
// 키트 kit/k143.ts 의 144 공용 부품 + kit/k144.ts 의 막대 안내)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, tag } from '../kit';
import { glow } from '../../models/materials';
import { mesh } from '../../models/parts/geom';
import { eyeRod, K144, lazyTongs144, linkBar, pivotPost144, type LazyTongs144 } from '../kit/k143';
import { rodGuide144 } from '../kit/k144';

const DEG = 180 / Math.PI;
/** d = dMid + dAmp·sin(theta − WIDEN_ARG) 의 위상(≈1.993). cos(theta − WIDEN_ARG) > 0 이면 펴지는 중 */
/** 교차점 리벳 핀의 로컬 z 범위 — A·B 두 층의 눈을 한 핀으로 꿴다 */
const RIVET_Z: [number, number] = [-0.045, 0.08];
/** 핀 표식이 모이는 월드 z 평면 */
const MARK_Z = 0.12;

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

/** 칸(1~4)의 층 z: '/' 막대는 A층, '\' 막대는 B층. 칸 홀수 +0.005(B층은 부호 반대) — 겹치는 눈의 단차 0.01 */
const zSlash = (cell: number): number => K144.zA + (cell % 2 === 1 ? 0.005 : -0.005);
const zBack = (cell: number): number => K144.zB + (cell % 2 === 1 ? -0.005 : 0.005);

/** 막대 종류: 0 '/' M(i−1)→T_i · 1 '\' M(i−1)→B_i · 2 '\' T_i→M_i · 3 '/' B_i→M_i */
type Kind = 0 | 1 | 2 | 3;

/** 막대 양 끝 구멍의 월드 좌표(칸 cell, 종류 kind) */
function ends(A: LazyTongs144, cell: number, kind: Kind): { x0: number; y0: number; x1: number; y1: number } {
  const m0 = A.mid[cell - 1]!;
  const m1 = A.mid[cell]!;
  const o = A.out[cell - 1]!;
  const cy = K144.CY;
  switch (kind) {
    case 0: return { x0: m0, y0: cy, x1: o, y1: cy + A.h };
    case 1: return { x0: m0, y0: cy, x1: o, y1: cy - A.h };
    case 2: return { x0: o, y0: cy + A.h, x1: m1, y1: cy };
    case 3: return { x0: o, y0: cy - A.h, x1: m1, y1: cy };
  }
}

export default function buildM144(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 받침 기둥(고정, 유일한 중간 고정점) — 꼭대기 고정 핀이 세 번째 가운데 마디(M3)를 붙든다
  const post = pivotPost144(1.12);
  post.name = 'post';
  post.position.set(K144.XF, K144.CY, 0);
  g.add(post);

  // 링크 막대 16개 — 칸 i 마다 4개. 교차점 11곳에 한쪽 막대가 리벳 핀을 담아 두 층의 눈을 꿴다
  // (T1~T4·B1~B4·M1·M2. M3 은 고정 핀, M0·M4 는 눈 막대 핀이 맡는다)
  const links: { g: THREE.Group; cell: number; kind: Kind; z: number }[] = [];
  let no = 0;
  for (let cell = 1; cell <= 4; cell++) {
    const nm3 = cell === 1 ? [undefined, 'pinM1'] : cell === 3 ? [undefined, 'pinM3'] : cell === 4 ? ['pinB4', undefined] : undefined;
    const defs: { kind: Kind; pins?: number[]; names?: (string | undefined)[]; markWorldZ?: number }[] = [
      { kind: 0, pins: [1], names: cell === 1 ? [undefined, 'pinT1'] : undefined, markWorldZ: MARK_Z }, // M(i−1)→T_i
      { kind: 1, pins: [1] }, // M(i−1)→B_i
      { kind: 2 }, // T_i→M_i
      { kind: 3, pins: cell <= 2 ? [1] : undefined, names: nm3, markWorldZ: cell === 3 ? 0.045 : MARK_Z } // B_i→M_i
    ];
    for (const d of defs) {
      no++;
      const z = d.kind === 0 || d.kind === 3 ? zSlash(cell) : zBack(cell);
      const bar = linkBar(0.5, {
        half: K144.barHalf,
        thick: K144.barT,
        holeR: K144.holeR,
        pins: d.pins,
        pinZ: RIVET_Z,
        names: d.names,
        markZ: d.names !== undefined && d.markWorldZ !== undefined ? d.markWorldZ - z : undefined
      });
      bar.name = `link${no}`;
      bar.position.set(0, 0, z);
      g.add(bar);
      links.push({ g: bar, cell, kind: d.kind, z });
    }
  }

  // 왼쪽 눈 막대(출력, 3배 왕복) — π 로 돌려 −X 로 뻗는다
  const rodL = eyeRod(K144.rodL, { name: 'pinL', pinZ: [-0.13, 0.03], markZ: MARK_Z - K144.zEye });
  rodL.name = 'rodL';
  rodL.rotation.z = Math.PI;
  rodL.position.set(0, K144.CY, K144.zEye);
  // 오른쪽 눈 막대(입력, 구동) — 끝 둥근 자루가 판 밖으로
  const rodR = eyeRod(K144.rodRt, { knob: true, name: 'pinR', pinZ: [-0.13, 0.03], markZ: MARK_Z - K144.zEye });
  rodR.name = 'rodR';
  rodR.position.set(0, K144.CY, K144.zEye);
  g.add(rodL, rodR);

  // 막대 안내 2개(고정) — 왼쪽은 판화의 벽 구멍, 오른쪽은 보충. 최대 펼침에서 목 블록과 스치지 않는 자리
  const guideL = rodGuide144();
  guideL.name = 'guideL';
  guideL.position.set(-1.14, K144.CY, 0);
  const guideR = rodGuide144();
  guideR.name = 'guideR';
  guideR.position.set(1.648, K144.CY, 0);
  g.add(guideL, guideR);

  // 움직임 화살표: 왼쪽 막대 위에서 좌우로 — 막대가 지금 가는 쪽을 가리키고 막대를 따라간다(사용자 지적: 회전 화살표 대신)
  const slide = new THREE.Group();
  {
    const mat = glow(0xd8362f, 0.85);
    const shaftGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.42, 12);
    shaftGeo.rotateZ(Math.PI / 2);
    slide.add(mesh(shaftGeo, mat));
    const headGeo = new THREE.ConeGeometry(0.05, 0.13, 16);
    headGeo.rotateZ(-Math.PI / 2); // 끝이 +X
    headGeo.translate(0.27, 0, 0);
    slide.add(mesh(headGeo, mat));
    slide.traverse((o) => {
      o.layers.set(1);
      o.userData.noAO = true;
    });
  }
  g.add(slide);

  // 이름표 4개 — 셋은 움직이는 부품을 따라간다
  const tagL = tag('왼쪽 막대(3배 왕복)', v(-0.7, 1.62, 0.3));
  const tagR = tag('오른쪽 막대(구동)', v(1.5, 1.6, 0.3));
  const tagLinks = tag('연결 막대 16개', v(0, 1.8, 0.3));
  const tagPost = tag('고정 핀 기둥(고정)', v(1.1, 0.5, 0.3)); // 기둥 상자(x ≤1.03) 밖 — 이름표 가림 경고 해소
  g.add(tagL, tagR, tagLinks, tagPost);

  /** theta 의 닫힌 식으로 전체 자세를 다시 계산(누적 오차·역회전 없음) */
  const pose = (A: LazyTongs144): void => {
    for (const L of links) {
      const e = ends(A, L.cell, L.kind);
      L.g.position.set(e.x0, e.y0, L.z); // 원점 = 시작 구멍(linkBar 원점이 첫 구멍) → 끝 구멍이 정확히 e 에 온다
      L.g.rotation.z = Math.atan2(e.y1 - e.y0, e.x1 - e.x0);
    }
    const m0 = A.mid[0]!;
    const m4 = A.mid[4]!;
    rodL.position.x = m0;
    rodR.position.x = m4;
    slide.position.set(m0 - 0.75, K144.CY + 0.17, K144.zEye + 0.05);
    tagL.position.set(m0 - 0.35, 1.62, 0.3);
    tagR.position.set(m4 + 0.3, 1.6, 0.3);
    tagLinks.position.set((m0 + A.out[0]!) / 2, K144.CY + A.h / 2 + 0.14, 0.3);
  };
  pose(lazyTongs144(0));

  return {
    group: g,
    view: { pos: [0.1, 1.5, 6.4], target: [0.1, 1.3, 0] },
    notes: () => {
      const A = lazyTongs144(theta);
      return [
        { label: '운동 배수', value: '왼쪽 = 오른쪽 ×3(반대 방향)' },
        { label: '칸 길이·기울기', value: `d ${A.d.toFixed(3)} · ${(A.alpha * DEG).toFixed(1)}°` },
        { label: '왼쪽 눈 위치', value: `0.85 − 3d = ${(0.85 - 3 * A.d).toFixed(2)} (행정 0.80)` },
        { label: '진행', value: `s = ${(A.s * 100).toFixed(0)} %(접힘 0 ~ 펴짐 100)` }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      const A = lazyTongs144(theta);
      pose(A);
      // 왼쪽 막대가 지금 움직이는 방향(역재생 반영)
      const v = (lazyTongs144(theta + 0.01).mid[0]! - A.mid[0]!) * (speed < 0 ? -1 : 1);
      if (Math.abs(v) > 1e-7) slide.scale.x = v > 0 ? 1 : -1;
    }
  };
}
