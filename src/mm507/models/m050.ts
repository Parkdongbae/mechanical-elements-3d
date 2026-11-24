// 050 유니버설 조인트 (1) — 8자 틀 이중 십자형 (판화 50번)
// 판화: 가운데 안경테 같은 8자 틀(두 고리 + 잘록한 허리), 고리마다 X 십자, 양쪽 축 끝의 긴 고리 포크가 고리를 감쌈.
// 두 축은 틀 양 끝에서 각각 45° 아래 바깥으로 꺾여 'ㅅ' 꼴. 꺾임이 같아 출력은 입력과 등속, 틀만 ±9.9° 앞서고 뒤선다.
// 부품·운동식은 kit/gear6.ts 의 universalJointPair 가 모두 담고, 이 파일은 set(theta)·표시·notes 만 한다.
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, tag } from '../kit';
import { quatZTo, universalJointPair } from '../kit/gear6';

const BETA = (45 * Math.PI) / 180;
const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const mod = (a: number, n: number): number => ((a % n) + n) % n;

export default function buildM050(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  const asm = universalJointPair(BETA, BETA);
  g.add(asm.group);

  // 축 방향(설계표): 입력 u1 = (−cosβ, −sinβ, 0), 출력 u2 = (cosβ, −sinβ, 0)
  const u1 = v(-Math.cos(BETA), -Math.sin(BETA), 0);
  const u2 = v(Math.cos(BETA), -Math.sin(BETA), 0);
  const aIn = rotArrow(0.2, false);
  aIn.quaternion.copy(quatZTo(u1));
  aIn.position.set(-1.14, 0.81, 0.28);
  const aOut = rotArrow(0.2, true);
  aOut.quaternion.copy(quatZTo(u2));
  aOut.position.set(1.14, 0.81, 0.28);
  g.add(aIn, aOut);

  // 이름표 자리는 조립체의 anchors(없으면 설계표 좌표)
  const an = (k: string, d: THREE.Vector3): THREE.Vector3 => asm.anchors[k] ?? d;
  g.add(
    tag('입력축', an('input', v(-1.45, 0.38, 0.55))),
    tag('출력축', an('output', v(1.45, 0.38, 0.55))),
    tag('8자 틀(가운데)', an('frame', v(0, 2.05, 0.55))),
    tag('십자(핀)', an('cross1', v(-0.7, 2.45, 0.6)))
  );

  let st = asm.set(theta);

  return {
    group: g,
    view: { pos: [0.5, 2.6, 5.0], target: [0, 1.4, 0.28] },
    notes: () => [
      { label: '입력축 각(도)', value: mod((st.phi1 * 180) / Math.PI, 360).toFixed(1) },
      { label: '가운데 틀 − 입력(도)', value: ((st.dChi * 180) / Math.PI).toFixed(1) },
      { label: '출력 − 입력(도)', value: ((st.dOut * 180) / Math.PI).toFixed(1) + ' (꺾임이 같아 0)' },
      { label: '식(조인트 하나)', value: 'tan χ = cos 45° · tan φ  (최대 ±9.9°)' }
    ],
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      st = asm.set(theta);
    }
  };
}
