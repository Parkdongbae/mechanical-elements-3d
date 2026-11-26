// 212 제네바 스톱 — 손가락 바퀴 A 의 핀이 별 바퀴 B 의 홈을 한 칸(72°)씩 밀고, 사이에는 A 의 둥근 테가 B 의 오목 옆면을 잡는다.
// 4바퀴쯤 감으면 B 의 볼록한 호(a~b)가 A 의 테에 걸려 더 못 돈다 — 설계표 docs/mm507-sheets/212.md
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, shaftZ, tag } from '../kit';
import { D2R, K212, driver212, lampsGroup, setLamps, star212, state212 } from '../kit/k212';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const K = K212;

const PHASE_TEXT = {
  wind: '감는 중',
  stopF: '멈춤 — 볼록한 a·b 가 A 에 걸림',
  unwind: '푸는 중',
  stopB: '멈춤 — 다 풀림'
} as const;

export default function buildM212(): MovementModel {
  const g = new THREE.Group();
  g.add(displayStand());
  const [ax, ay] = K.OA;
  const [bx, by] = K.OB;

  const star = star212();
  star.position.set(bx, by, 0);
  const shB = shaftZ(bx, by, 0.2, 0.05);
  const wheel = driver212();
  wheel.position.set(ax, ay, 0);
  const shA = shaftZ(ax, ay, 0.24, 0.05);
  g.add(star, shB, wheel, shA);

  const arrCcw = rotArrow(0.3, true);
  arrCcw.position.set(ax, ay, 0.42);
  const arrCw = rotArrow(0.3, false);
  arrCw.position.set(ax, ay, 0.42);
  g.add(arrCcw, arrCw);

  const lamps = lampsGroup(1.3, 0.975, 0.16, 1.0, [[1.3, 0.6], [1.3, 0.85], [1.3, 1.1], [1.3, 1.35]], -0.25);
  g.add(lamps);

  g.add(
    leaderTo(tag('A 감는 바퀴', v(-1.55, 0.55, 0.55)), 'wheelA'),
    leaderTo(tag('B 별 바퀴', v(-1.55, 2.95, 0.55)), 'starB'),
    leaderTo(tag('a', v(0.3, 3.2, 0.55)), 'ptA'),
    leaderTo(tag('b', v(1.35, 2.95, 0.55)), 'ptB'),
    leaderTo(tag('손가락 핀', v(-1.6, 1.75, 0.55)), 'fingerA'),
    leaderTo(tag('바퀴 수 표시등', v(1.75, 0.3, 0.55)), 'lamps')
  );

  const band = star.getObjectByName('stopAB') as THREE.Mesh;
  const bandMat = band.material as THREE.MeshPhysicalMaterial;
  const disc = wheel.getObjectByName('discA') as THREE.Mesh;
  const discMat = disc.material as THREE.MeshStandardMaterial;

  let t = 0;
  let st = state212(0);
  const place = (): void => {
    st = state212(t);
    wheel.rotation.z = st.alpha * D2R;
    shA.rotation.z = st.alpha * D2R;
    star.rotation.z = st.beta * D2R;
    shB.rotation.z = st.beta * D2R;
    arrCcw.visible = st.phase === 'wind';
    arrCw.visible = st.phase === 'unwind';
    bandMat.emissive.setHex(st.stopped ? 0xff2020 : 0x000000);
    discMat.emissive.setHex(st.stopped ? 0x400000 : 0x000000);
    setLamps(lamps, Math.min(4, Math.floor(st.turns + 0.001)), 4);
  };
  place();

  return {
    group: g,
    view: { pos: [0.4, 1.75, 6.2], target: [0.1, 1.72, 0.1] },
    notes: () => [
      { label: '상태', value: PHASE_TEXT[st.phase] },
      { label: '감은 바퀴 수 n', value: `${st.turns.toFixed(2)} 바퀴 (0.00 ~ 4.01)` },
      { label: 'B 각 β', value: `${(((st.beta % 360) + 360) % 360).toFixed(1)}°` },
      { label: '한 칸', value: '손가락 한 번에 B 72°, 오목 옆면 4곳 → 약 4바퀴에서 멈춤' },
      { label: '원리', value: '볼록한 a·b 는 A 의 둥근 테에 맞지 않아 그쪽으로는 B 가 더 못 돈다 — 그래서 A(태엽)도 멈춘다' }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed;
      place();
    }
  };
}
