// 215 멈추개 변형 2 — 212 와 같은 원리. 큰 원판의 핀이 홈 6개 별 바퀴를 60° 씩 밀고, 잠금 원판이 사이를 잡는다.
// 약 5바퀴 감으면 볼록 옆면이 잠금 원판에 걸려 멈춘다 — 설계표 docs/mm507-sheets/215.md
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, shaftZ, tag } from '../kit';
import { D2R, lampsGroup, setLamps } from '../kit/k212';
import { K215, driver215, star215, state215 } from '../kit/k215';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const K = K215;
const Q = 90 * D2R; // 계산 틀 → 세계 −90°

const PHASE_TEXT = {
  wind: '감는 중',
  stopF: '멈춤 — 볼록 옆면이 잠금 원판에 걸림',
  unwind: '푸는 중',
  stopB: '멈춤 — 다 풀림'
} as const;

export default function buildM215(): MovementModel {
  const g = new THREE.Group();
  g.add(displayStand());
  const [ax, ay] = K.A;
  const [bx, by] = K.B;

  const disc = driver215();
  disc.position.set(ax, ay, 0);
  const shA = shaftZ(ax, ay, 0.22, 0.05);
  const star = star215();
  star.position.set(bx, by, 0);
  const shB = shaftZ(bx, by, 0.18, 0.05);
  g.add(disc, shA, star, shB);

  const arrCcw = rotArrow(0.3, true);
  arrCcw.position.set(ax, ay, 0.42);
  const arrCw = rotArrow(0.3, false);
  arrCw.position.set(ax, ay, 0.42);
  g.add(arrCcw, arrCw);

  const lamps = lampsGroup(-0.2, 0.5, 1.4, 0.16, [[-0.8, 0.5], [-0.5, 0.5], [-0.2, 0.5], [0.1, 0.5], [0.4, 0.5]], -0.25);
  g.add(lamps);

  g.add(
    leaderTo(tag('구동 원판', v(-1.8, 0.85, 0.55)), 'discA'),
    leaderTo(tag('잠금 원판(오목 파냄)', v(-1.75, 2.85, 0.55)), 'lockA'),
    leaderTo(tag('핀', v(-0.55, 3.1, 0.55)), 'pinA'),
    leaderTo(tag('별 바퀴(홈 6개)', v(1.55, 2.85, 0.55)), 'starB'),
    leaderTo(tag('볼록 옆면(멈추개)', v(1.65, 0.75, 0.55)), 'stopFlank'),
    leaderTo(tag('바퀴 수 표시등', v(0.95, 0.25, 0.55)), 'lamps')
  );

  const bandMat = (star.getObjectByName('stopFlank') as THREE.Mesh).material as THREE.MeshPhysicalMaterial;
  const lockMat = (disc.getObjectByName('lockA') as THREE.Mesh).material as THREE.MeshStandardMaterial;

  let t = 0;
  let st = state215(0);
  const place = (): void => {
    st = state215(t);
    disc.rotation.z = st.alpha * D2R - Q;
    shA.rotation.z = st.alpha * D2R - Q;
    star.rotation.z = st.beta * D2R - Q;
    shB.rotation.z = st.beta * D2R - Q;
    arrCcw.visible = st.phase === 'wind';
    arrCw.visible = st.phase === 'unwind';
    bandMat.emissive.setHex(st.stopped ? 0xff2020 : 0x000000);
    lockMat.emissive.setHex(st.stopped ? 0x400000 : 0x000000);
    setLamps(lamps, Math.min(5, Math.floor(st.turns + 0.001)), 5);
  };
  place();

  return {
    group: g,
    view: { pos: [-0.1, 1.75, 6.0], target: [-0.1, 1.7, 0.05] },
    notes: () => [
      { label: '상태', value: PHASE_TEXT[st.phase] },
      { label: '감은 바퀴 수', value: `${st.turns.toFixed(2)} 바퀴 (0.00 ~ 5.01)` },
      { label: '별 바퀴 각', value: `${(((st.beta % 360) + 360) % 360).toFixed(1)}°` },
      { label: '한 칸', value: '핀 한 번에 60°, 오목 옆면 5곳 → 약 5바퀴(212 는 4곳 → 약 4바퀴)' },
      { label: '원리', value: '잠금 원판의 둥근 테는 오목 옆면에만 맞는다 — 볼록 옆면 쪽으로는 별 바퀴가 못 돌아 원판도 멈춘다' }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed;
      place();
    }
  };
}
