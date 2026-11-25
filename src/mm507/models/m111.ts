// 111 마이크로미터 나사 — 굵은 나사와 가는 나사가 한 몸. 고정 너트 안에서 돌며 오르내리고,
// 돌지 못하게 잡힌 이동 너트는 피치의 차(0.2 − 0.1 = 0.1)만큼만 따라 오른다 (판화 111번, 원문 설명대로).
// 나사산 모양은 원문·판화대로 방향이 반대(굵은 나사 오른나사, 가는 나사 왼나사) — 사용자 결정. 움직임은 설명(차)을 따른다.
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, tag } from '../kit';
import { K111, diff111, diffScrew111, nutFrame111, travelNut111 } from '../kit/k110';

const ZC = 0.3; // 축의 깊이
const Y_FIX = 2.2; // 고정 너트 가운데 높이
const Y0 = Y_FIX - K111.fixAt; // 나사 원점(두 나사가 만나는 곳)의 쉬는 높이 = 1.82
const Y_NUT = Y0 - K111.movAt; // 이동 너트의 쉬는 높이 = 1.37

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM111(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 고정 너트 틀(고정) — 구멍 난 덩이 + 뒤판까지 받침 팔 + 아래로 드리운 안내 막대 2개
  const nutFrame = nutFrame111(0.6);
  nutFrame.name = 'nutFrame';
  nutFrame.position.set(0, Y_FIX, ZC);
  g.add(nutFrame);

  // 나사 한 몸(머리 + 굵은 나사 + 가는 나사 + 손잡이 막대) — 고정 너트 안에서 돌며 오르내린다
  const screw = diffScrew111(-1); // 안 나: 가는 나사는 왼나사(판화·원문대로 반대 방향)
  screw.name = 'screw';
  screw.position.set(0, Y0, ZC);
  g.add(screw);

  // 이동 너트(다이) — 안내 막대에 걸려 돌지 못하고 오르내리기만 한다
  const travelNut = travelNut111();
  travelNut.name = 'travelNut';
  travelNut.position.set(0, Y_NUT, ZC);
  g.add(travelNut);

  // 회전 화살표 2개 — 도는 방향이 바뀌므로 번갈아 보인다. 눕혀 손잡이 막대 높이에, 나사를 따라 오르내린다
  const arrowUp = rotArrow(0.42, true); // 위에서 보아 반시계(올라가는 중)
  const arrowDn = rotArrow(0.42, false); // 시계(내려가는 중)
  arrowUp.rotation.x = -Math.PI / 2;
  arrowDn.rotation.x = -Math.PI / 2;
  g.add(arrowUp, arrowDn);

  // 이름표 4개 — 이동 너트 것만 너트를 따라 오르내린다
  g.add(tag('굵은 나사', v(-1.1, 2.75, ZC)), tag('고정 너트', v(1.3, Y_FIX, ZC)), tag('가는 나사', v(-1.1, 0.95, ZC)));
  const tagNut = tag('이동 너트', v(1.3, Y_NUT, ZC));
  g.add(tagNut);

  // 모든 자세는 theta 의 닫힌 식 diff111(theta, 1) 에서
  const place = (): void => {
    const D = diff111(theta, 1);
    screw.rotation.y = D.psi;
    screw.position.y = Y0 + D.screwY;
    travelNut.position.y = Y_NUT + D.nutY;
    const yh = Y0 + K111.handleY + D.screwY; // 손잡이 막대 높이
    arrowUp.position.set(0, yh, ZC);
    arrowDn.position.set(0, yh, ZC);
    arrowUp.visible = D.dir === 1;
    arrowDn.visible = D.dir === -1;
    tagNut.position.y = Y_NUT + D.nutY;
  };
  place();

  return {
    group: g,
    view: { pos: [0.8, 2.3, 6.3], target: [0, 1.7, 0.2] },
    notes: () => {
      const D = diff111(theta, 1);
      const s = D.turns >= 0 ? '+' : '−';
      const n = Math.abs(D.turns);
      return [
        { label: '돌린 양', value: `${s}${n.toFixed(2)} 바퀴(±1바퀴 사이를 오감)` },
        { label: '나사 이동', value: `굵은 피치 0.2 × ${n.toFixed(2)} = ${s}${(K111.p1 * n).toFixed(3)}` },
        { label: '너트 이동', value: `(0.2 − 0.1) × ${n.toFixed(2)} = ${s}${((K111.p1 - K111.p2) * n).toFixed(3)}` },
        { label: '나사 방향', value: '굵은 나사 오른나사 · 가는 나사 왼나사(반대)' },
        { label: '견줌', value: '너트는 나사의 1/2 만 간다 → 그만큼 정밀하고 미는 힘은 2배' }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt; // 누적 각 — 되돌이 회전은 diff111 안의 sin
      place();
    }
  };
}
