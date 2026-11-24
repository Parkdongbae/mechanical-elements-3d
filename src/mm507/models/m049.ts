// 049 래칫 베벨 기어 전동 — 가로 축의 왕복 회전이 두 래칫 휠(톱니·폴이 서로 반대)을 거쳐 세로 축을 한 방향으로 계속 돌린다 (판화 49번)
// 판화: 받침 기둥 2개 위 가로 축, 이가 서로를 향한 베벨 L·R, 그 위를 덮는 꼭대기 베벨(이가 아래), 베벨 바깥에 래칫 휠, 휠 꼭대기에 폴.
// 조립체 전부는 kit/gear6.ts 의 ratchetBevelDrive() — 이 파일은 전시대·화살표·이름표·수치만 더한다.
// 입력 레버는 판화에 없음(보충 — 왕복 입력이 보이게).
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, tag } from '../kit';
import { ratchetBevelDrive, type RatchetState } from '../kit/gear6';

const DEG = 180 / Math.PI;
const HALF_DEG = 0.5 / DEG;

export default function buildM049(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  const asm = ratchetBevelDrive();
  g.add(asm.group);
  let st: RatchetState = asm.set(theta);

  // 회전 화살표: 세로 출력축(한 방향), 입력 왕복(두 방향)
  const aTop = rotArrow(0.3, true);
  aTop.rotation.x = -Math.PI / 2;
  aTop.position.set(0, 1.95, 0.28);
  const aIn1 = rotArrow(0.4, true);
  aIn1.rotation.y = Math.PI / 2;
  aIn1.position.set(-1.45, 1.15, 0.28);
  const aIn2 = rotArrow(0.4, false);
  aIn2.rotation.y = Math.PI / 2;
  aIn2.position.set(-1.58, 1.15, 0.28);
  g.add(aTop, aIn1, aIn2);

  const a = asm.anchors;
  const pick = (k: string): THREE.Vector3 => a[k] ?? new THREE.Vector3();
  g.add(
    tag('입력 레버(왕복)', pick('lever')),
    tag('래칫 휠 L', pick('ratchetL')),
    tag('래칫 휠 R', pick('ratchetR')),
    tag('베벨 기어 L·R + 꼭대기 기어', pick('bevel')),
    tag('폴(걸쇠) L', pick('pawlL')),
    tag('폴(걸쇠) R', pick('pawlR')),
    tag('세로 출력축', pick('top'))
  );

  return {
    group: g,
    notes: () => [
      { label: '입력 회전각(도)', value: `${(st.s * DEG).toFixed(0)}°` },
      { label: '출력(세로축) 누적각(도)', value: `${(st.alpha * DEG).toFixed(0)}°` },
      { label: '걸린 폴', value: st.pL < HALF_DEG ? 'L(앞 행정)' : st.pR < HALF_DEG ? 'R(뒤 행정)' : '미끄러지는 중' },
      { label: '입력 한 주기당 출력', value: '180° (톱니 헛걸음 10°×2 손실)' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      st = asm.set(theta);
    }
  };
}
