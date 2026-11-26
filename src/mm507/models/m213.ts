// 213 다른 종류의 멈추개 — 아래 톱니바퀴의 핀이 한 바퀴마다 B 원판의 홈 하나를 밀어 18° 돌리고,
// 홈 줄이 끝나면 높은 테가 핀을 막아 약 6.84 바퀴에서 멈춘다 (판화 213번)
//  설계표 docs/mm507-sheets/213.md · 부품·운동식은 kit/k213 조립만 한다
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, shaftZ, tag } from '../kit';
import { K213, lamps213, sawWheel213, state213, stopWheel213 } from '../kit/k213';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const D2R = Math.PI / 180;
const PHASE_TEXT = { wind: '감는 중', holdF: '멈춤 — 핀이 높은 테에 막힘', unwind: '푸는 중', holdB: '멈춤 — 다 풀림' } as const;

export default function buildM213(): MovementModel {
  const g = new THREE.Group();
  g.add(displayStand());
  const [ax, ay] = K213.OA;
  const [bx, by] = K213.OB;

  const stop = stopWheel213();
  stop.position.set(bx, by, 0);
  const shaftB = shaftZ(bx, by, 0.21, 0.05);
  const saw = sawWheel213();
  saw.position.set(ax, ay, 0);
  const shaftA = shaftZ(ax, ay, 0.27, 0.05);
  const lamps = lamps213(6);
  const setLit = lamps.userData.setLit as (k: number) => void;
  g.add(stop, shaftB, saw, shaftA, lamps);

  const arrCcw = rotArrow(0.3, true);
  const arrCw = rotArrow(0.3, false);
  arrCcw.position.set(ax, ay, 0.43);
  arrCw.position.set(ax, ay, 0.43);
  g.add(arrCcw, arrCw);

  const stepF = stop.getObjectByName('stepF') as THREE.Mesh;
  const stepB = stop.getObjectByName('stepB') as THREE.Mesh;
  const matF = stepF.userData.mat as THREE.MeshPhysicalMaterial;
  const matB = stepB.userData.mat as THREE.MeshPhysicalMaterial;

  g.add(
    leaderTo(tag('B 멈춤 원판(홈 6개)', v(-1.55, 3.0, 0.55)), 'stopWheel'),
    leaderTo(tag('핀', v(-1.55, 1.45, 0.55)), 'pin'),
    leaderTo(tag('감기 톱니바퀴', v(-1.55, 0.4, 0.55)), 'ratchet'),
    leaderTo(tag('높은 테(멈추는 곳)', v(1.45, 3.05, 0.55)), 'stepF'),
    leaderTo(tag('바퀴 수 표시등', v(1.75, 0.3, 0.55)), 'lamps')
  );

  let t = 0;
  let st = state213(0);
  const place = (): void => {
    st = state213(t);
    saw.rotation.z = st.alpha * D2R;
    shaftA.rotation.z = st.alpha * D2R;
    stop.rotation.z = st.beta * D2R;
    shaftB.rotation.z = st.beta * D2R;
    setLit(Math.min(6, Math.floor(st.turns + 0.001)));
    matF.emissive.setHex(st.stopped === 'F' ? 0xff2020 : 0x000000);
    matB.emissive.setHex(st.stopped === 'B' ? 0xff2020 : 0x000000);
    arrCcw.visible = st.phase === 'wind';
    arrCw.visible = st.phase === 'unwind';
  };
  place();

  return {
    group: g,
    view: { pos: [0.3, 1.7, 6.2], target: [0.1, 1.65, 0.1] },
    notes: () => [
      { label: '상태', value: PHASE_TEXT[st.phase] },
      { label: '감은 바퀴 수', value: `${st.turns.toFixed(2)} 바퀴 (0.00 ~ 6.84)` },
      { label: 'B 각', value: `${st.beta.toFixed(1)}°` },
      { label: '핀 하나', value: '한 바퀴에 홈 한 칸(18°), 홈 6개 → 약 6.8바퀴' },
      { label: '원리', value: '212 는 볼록한 옆면이, 213 은 홈이 끝난 높은 테가 핀을 막는다' }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed;
      place();
    }
  };
}
